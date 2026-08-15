// Импорт произвольного Excel. Чистые парсеры (тестируемые) для двух форматов:
// P&L — матрица «показатели × периоды» (input/calc + cellValues);
// ДДС — журнал операций (широкая таблица → operations + operationLines + счета/категории).
// UI-мастер (features/import) даёт предпросмотр и правит автоопределённое сопоставление.

import * as XLSX from 'xlsx'
import { nanoid } from '@reduxjs/toolkit'
import type {
  Account, Category, CellValue, Item, IsoDate, OpeningBalance,
  Operation, OperationLine, OperationType, PeriodKey,
} from '../domain/types'
import type { Money } from '../domain/money'
import { fromMajor, parseMoney } from '../domain/money'
import { parsePeriodLabel } from '../engine/periods'
import { t, type Key, type Locale } from '../i18n'

export type Cell = string | number | null
export type Grid = Cell[][]

export interface WorkbookGrids {
  sheetNames: string[]
  grids: Record<string, Grid>
}

/** Прочитать книгу в простые сетки значений (даты → ISO-строки). */
export function readWorkbookGrids(buf: ArrayBuffer | Uint8Array): WorkbookGrids {
  const wb = XLSX.read(buf, { type: 'array', cellDates: true })
  const grids: Record<string, Grid> = {}
  for (const name of wb.SheetNames) {
    const aoa = XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[name], { header: 1, raw: true, defval: null })
    grids[name] = aoa.map((row) => row.map(normalizeCell))
  }
  return { sheetNames: wb.SheetNames, grids }
}

function normalizeCell(v: unknown): Cell {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'number' || typeof v === 'string') return v
  return String(v)
}

// --- Разбор чисел/дат ячеек ---

function cellToMoney(cell: Cell): Money | null {
  if (cell === null || cell === '') return null
  if (typeof cell === 'number') return Number.isFinite(cell) ? fromMajor(cell) : null
  const s = String(cell).trim()
  if (s === '' || s === '-' || s === '—') return null
  try {
    return parseMoney(s)
  } catch {
    return null
  }
}

function cellToIsoDate(cell: Cell): IsoDate | null {
  if (cell === null) return null
  const s = String(cell).trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})[.](\d{1,2})[.](\d{4})$/) // dd.mm.yyyy
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

function cellText(cell: Cell): string {
  return cell === null ? '' : String(cell).trim()
}

// --- Автоопределение типа отчёта ---

export type ReportKind = 'dds' | 'pl'

export function detectReportKind(grid: Grid, defaultYear = new Date().getFullYear()): ReportKind {
  const scan = grid.slice(0, 15)
  // столбец с датами → журнал ДДС
  const colCount = Math.max(0, ...scan.map((r) => r.length))
  for (let c = 0; c < colCount; c++) {
    const dates = scan.filter((r) => cellToIsoDate(r[c] ?? null) !== null).length
    if (dates >= 2) return 'dds'
  }
  // строка с ≥2 метками-периодами → матрица P&L
  const plScore = Math.max(0, ...scan.map((r) => r.filter((c) => parsePeriodLabel(cellText(c), defaultYear) !== null).length))
  return plScore >= 2 ? 'pl' : 'dds'
}

// ============ P&L (матрица) ============

export interface PlMapping {
  headerRow: number
  labelCol: number
  periodCols: { col: number; label: string }[]
}

export function detectPlMapping(grid: Grid, defaultYear = new Date().getFullYear()): PlMapping {
  let headerRow = 0
  let best = 0
  grid.slice(0, 20).forEach((row, i) => {
    const n = row.filter((c) => parsePeriodLabel(cellText(c), defaultYear) !== null).length
    if (n > best) { best = n; headerRow = i }
  })
  const header = grid[headerRow] ?? []
  const periodCols = header
    .map((c, col) => ({ col, label: cellText(c) }))
    .filter((x) => parsePeriodLabel(x.label, defaultYear) !== null)
  // колонка-подпись — первая текстовая слева от периодов (обычно 0)
  const firstPeriodCol = periodCols.length ? periodCols[0].col : 1
  let labelCol = 0
  for (let c = 0; c < firstPeriodCol; c++) {
    if (cellText(header[c]) !== '' || grid.some((r) => cellText(r[c]) !== '')) { labelCol = c; break }
  }
  return { headerRow, labelCol, periodCols }
}

export interface ParsedPl {
  items: Item[]
  periods: PeriodKey[]
  cellValues: CellValue[]
}

// Классификация строк P&L по названию. ЭТО ЛОГИКА РАЗБОРА ЧУЖИХ ФАЙЛОВ, а не
// подписи интерфейса: паттерны сравниваются с содержимым загружаемого Excel, и
// от языка интерфейса они не зависят — разбирать нужно все языки сразу.
// Альтернативы только ДОПИСЫВАЮТСЯ: русский паттерн не удаляется никогда,
// иначе перестанут открываться файлы, которые пользователи уже сдали.
const RE = {
  total: /итог|всего|total|jami/i,
  gross: /валов|gross|yalpi/i,
  opProfit: /операцион\w*\s+прибыл|operating\s+(profit|income)|operatsion\w*\s+foyda/i,
  pretax: /до\s+налог|before\s+tax|pre-?tax|soliqqacha/i,
  tax: /налог|tax|soliq/i,
  net: /чист\w*\s+прибыл|net\s+(profit|income)|sof\s+foyda/i,
  revenueTotal: /выручк|доход|revenue|turnover|tushum|daromad/i,
  cogsTotal: /себестоим|cost\s+of\s+(sales|goods)|cogs|tannarx/i,
  opexTotal: /расход|expense|opex|xarajat/i,
}

/** Разбор матрицы P&L с умным распознаванием итоговых/расчётных строк. */
export function parsePlMatrix(grid: Grid, mapping: PlMapping, opts: { defaultYear?: number } = {}): ParsedPl {
  const year = opts.defaultYear ?? new Date().getFullYear()
  const cols = mapping.periodCols
    .map((pc) => ({ col: pc.col, period: parsePeriodLabel(pc.label, year) }))
    .filter((x): x is { col: number; period: PeriodKey } => x.period !== null)
  const periods = cols.map((c) => c.period)

  const items: Item[] = []
  const cellValues: CellValue[] = []
  let order = 0
  const push = (it: Omit<Item, 'id' | 'templateId' | 'form' | 'order'>) => {
    const item: Item = { id: nanoid(), templateId: 'tpl-pl', form: 'pl', order: order++, ...it }
    items.push(item)
    return item.code
  }

  let section: string | null = null
  let sectionInputs: string[] = []
  const anchors: Record<string, string | undefined> = {}
  const otherInputs: string[] = []
  const term = (codes: string[]) => (codes.length === 1 ? codes[0] : `(${codes.join(' + ')})`)

  for (let r = 0; r < grid.length; r++) {
    if (r === mapping.headerRow) continue
    const row = grid[r]
    const name = cellText(row[mapping.labelCol])
    if (name === '') continue

    const monies = cols.map((c) => cellToMoney(row[c.col] ?? null))
    const hasNumbers = monies.some((m) => m !== null)
    const code = `p${r}`

    if (!hasNumbers) {
      // короткая безчисловая строка — заголовок секции; длинная — комментарий (пропуск)
      if (name.length <= 45) {
        section = code
        sectionInputs = []
        push({ code, parentCode: null, kind: 'header', name })
      }
      continue
    }

    const lname = name.toLowerCase()
    // классифицируем по «голове» названия (до «=», «(», «—», «-») — описание после не мешает
    const head = lname.split(/[=(—-]/)[0]
    let formula: string | null = null
    let parent: string | null = null

    if (RE.total.test(head)) {
      parent = section
      formula = 'SUM(children)'
      // входные строки секции становятся детьми этого итога (для SUM(children))
      for (const ci of sectionInputs) {
        const it = items.find((x) => x.code === ci)
        if (it) it.parentCode = code
      }
      if (RE.revenueTotal.test(head)) anchors.revTotal = code
      else if (RE.cogsTotal.test(head)) anchors.cogsTotal = code
      else if (RE.opexTotal.test(head)) anchors.opexTotal = code
    } else if (RE.gross.test(head)) {
      const cogs = anchors.cogsTotal ?? (sectionInputs.length ? term(sectionInputs) : null)
      if (anchors.revTotal && cogs) { formula = `${anchors.revTotal} - ${cogs}`; anchors.gross = code }
    } else if (RE.opProfit.test(head)) {
      if (anchors.gross && anchors.opexTotal) { formula = `${anchors.gross} - ${anchors.opexTotal}`; anchors.opProfit = code }
    } else if (RE.pretax.test(head)) {
      const base = anchors.opProfit ?? anchors.gross
      if (base) { formula = otherInputs.length ? `${base} - ${term(otherInputs)}` : base; anchors.pretax = code }
    } else if (!RE.pretax.test(head) && RE.tax.test(head)) {
      if (anchors.pretax) {
        const pct = lname.match(/(\d+(?:[.,]\d+)?)\s*%/)
        const rate = pct ? Number(pct[1].replace(',', '.')) / 100 : 0.15
        formula = `${anchors.pretax} * ${rate}`
        anchors.tax = code
      }
    } else if (RE.net.test(head)) {
      if (anchors.pretax) { formula = anchors.tax ? `${anchors.pretax} - ${anchors.tax}` : anchors.pretax; anchors.net = code }
    }

    if (formula) {
      push({ code, parentCode: parent, kind: 'calc', name, formulaDefault: formula })
    } else {
      // обычная строка ввода
      push({ code, parentCode: section, kind: 'input', name })
      sectionInputs.push(code)
      if (anchors.opProfit && !anchors.pretax) otherInputs.push(code)
      cols.forEach((c, i) => {
        const money = monies[i]
        if (money !== null) cellValues.push({ itemCode: code, period: c.period, amount: money })
      })
    }
  }

  return { items, periods, cellValues }
}

// ============ ДДС (журнал) ============

export interface DdsMapping {
  headerRow: number
  dateCol: number | null
  typeCol: number | null
  descCol: number | null
  categoryCol: number | null
  noteCol: number | null
  accountCols: { col: number; name: string }[]
}

// Заголовок столбца с датой: используется и для поиска строки-заголовка,
// и для самого столбца — держим в одном месте, чтобы они не разъехались.
const RE_HEADER_DATE = /дата|date|sana/i

const IGNORE_COL = /курс|итог|total|jami|kurs|№|\bno\b|\$/i

export function detectDdsMapping(grid: Grid): DdsMapping {
  // строка-заголовок — первая, где встречается «дата», иначе первая непустая
  let headerRow = grid.findIndex((r) => r.some((c) => RE_HEADER_DATE.test(cellText(c))))
  if (headerRow < 0) headerRow = grid.findIndex((r) => r.some((c) => cellText(c) !== ''))
  if (headerRow < 0) headerRow = 0
  const header = grid[headerRow] ?? []
  const find = (re: RegExp) => {
    const idx = header.findIndex((c) => re.test(cellText(c)))
    return idx < 0 ? null : idx
  }
  const dateCol = find(RE_HEADER_DATE)
  const typeCol = find(/тип|type|turi?\b/i)
  const descCol = find(/описан|назначен|коммент|наименован|descript|purpose|comment|name\b|izoh|tavsif|nomi/i)
  const categoryCol = find(/категор|статья|category|item\b|kategoriya|modda/i)
  const noteCol = find(/примечан|заметк|note|remark|eslatma/i)
  const used = new Set([dateCol, typeCol, descCol, categoryCol, noteCol].filter((x) => x !== null))

  const dataRows = grid.slice(headerRow + 1, headerRow + 40)
  const accountCols: { col: number; name: string }[] = []
  header.forEach((c, col) => {
    if (used.has(col)) return
    const name = cellText(c)
    if (name === '' || IGNORE_COL.test(name)) return
    const numeric = dataRows.some((r) => cellToMoney(r[col] ?? null) !== null)
    if (numeric) accountCols.push({ col, name })
  })
  return { headerRow, dateCol, typeCol, descCol, categoryCol, noteCol, accountCols }
}

export interface ParsedDds {
  accounts: Account[]
  categories: Category[]
  operations: Operation[]
  operationLines: OperationLine[]
  openingBalances: OpeningBalance[]
}

// Сравниваются со ЗНАЧЕНИЯМИ ячеек загружаемого файла — см. пояснение у RE выше.
const RE_TYPE = {
  income: /приход|доход|income|inflow|kirim/i,
  expense: /расход|expense|outflow|chiqim/i,
  transfer: /переброск|перевод|transfer|oʻtkazma|o'tkazma|otkazma/i,
}
const RE_OPENING = /остаток|нач\w*\s*остат|opening|balance\s+b\/?f|qoldiq/i

function inferType(lines: { amount: Money }[]): OperationType {
  if (lines.length >= 2) {
    const sum = lines.reduce((a, l) => a + l.amount, 0n)
    const hasPos = lines.some((l) => l.amount > 0n)
    const hasNeg = lines.some((l) => l.amount < 0n)
    if (hasPos && hasNeg && (sum === 0n || (sum < 0n ? -sum : sum) < fromMajor(1))) return 'transfer'
  }
  return lines.some((l) => l.amount < 0n) ? 'expense' : 'income'
}

/** Разбор журнала ДДС: строки → операции с проводками; счета/категории из файла. */
export function parseDdsJournal(grid: Grid, mapping: DdsMapping, opts: { defaultYear?: number } = {}): ParsedDds {
  const year = opts.defaultYear ?? new Date().getFullYear()
  const accounts: Account[] = mapping.accountCols.map((a, i) => ({
    id: nanoid(), code: `acc_${i + 1}`, name: a.name, currency: 'UZS', order: i + 1, active: true,
  }))
  const accByCol = new Map(mapping.accountCols.map((a, i) => [a.col, accounts[i]]))

  const categories: Category[] = []
  const catByName = new Map<string, Category>()
  const ensureCategory = (name: string, direction: Category['direction']): string | null => {
    if (!name) return null
    const existing = catByName.get(name)
    if (existing) return existing.id
    const cat: Category = { id: nanoid(), code: `cat_${categories.length + 1}`, name, direction, order: categories.length + 1 }
    categories.push(cat)
    catByName.set(name, cat)
    return cat.id
  }

  const operations: Operation[] = []
  const operationLines: OperationLine[] = []
  const openingBalances: OpeningBalance[] = []

  for (let r = mapping.headerRow + 1; r < grid.length; r++) {
    const row = grid[r]
    const desc = mapping.descCol !== null ? cellText(row[mapping.descCol]) : ''
    const typeText = mapping.typeCol !== null ? cellText(row[mapping.typeCol]) : ''
    const catName = mapping.categoryCol !== null ? cellText(row[mapping.categoryCol]) : ''
    const note = mapping.noteCol !== null ? cellText(row[mapping.noteCol]) : ''
    const isoDate = mapping.dateCol !== null ? cellToIsoDate(row[mapping.dateCol] ?? null) : null

    const legs = mapping.accountCols
      .map((a) => ({ acc: accByCol.get(a.col)!, money: cellToMoney(row[a.col] ?? null) }))
      .filter((x): x is { acc: Account; money: Money } => x.money !== null)

    if (legs.length === 0) continue

    // начальные остатки — отдельная сущность, не операция
    if (RE_OPENING.test(typeText) || RE_OPENING.test(desc)) {
      const date = isoDate ?? `${year}-01-01`
      for (const leg of legs) openingBalances.push({ id: nanoid(), accountId: leg.acc.id, date, amount: leg.money })
      continue
    }

    if (!isoDate) continue // операция без даты — пропуск

    let type: OperationType
    if (RE_TYPE.transfer.test(typeText)) type = 'transfer'
    else if (RE_TYPE.expense.test(typeText)) type = 'expense'
    else if (RE_TYPE.income.test(typeText)) type = 'income'
    else type = inferType(legs.map((l) => ({ amount: l.money })))

    const dir = type === 'income' ? 'in' : type === 'expense' ? 'out' : 'transfer'
    const categoryId = ensureCategory(catName, dir)

    const opId = nanoid()
    operations.push({ id: opId, date: isoDate, type, description: desc, categoryId, note: note || undefined })
    for (const leg of legs) {
      operationLines.push({ id: nanoid(), operationId: opId, accountId: leg.acc.id, amount: leg.money, currency: 'UZS' })
    }
  }

  return { accounts, categories, operations, operationLines, openingBalances }
}

/** Стандартное дерево статей ДДС под импортированные счета/категории (чтобы отчёт считался). */
export function generateDdsTemplate(
  accounts: Account[],
  categories: Category[],
  locale?: Locale,
): Item[] {
  // Те же ключи, что у шаблона по умолчанию (data/ddsTemplate.ts): дерево одно и
  // то же, просто здесь оно рождается из чужого файла, а не из шаблона.
  const tr = (key: Key) => t(key, undefined, locale)
  const items: Item[] = []
  let order = 0
  const mk = (o: Omit<Item, 'id' | 'templateId' | 'form' | 'order'>) => {
    items.push({ id: nanoid(), templateId: 'tpl-dds', form: 'cf', order: order++, ...o })
  }

  mk({ code: 's_totals', parentCode: null, kind: 'header', name: tr('seed.dds.s_totals') })
  mk({ code: 'v_total_in', parentCode: 's_totals', kind: 'agg', name: tr('seed.dds.v_total_in'), aggRule: { measure: 'in' } })
  mk({ code: 'v_total_out', parentCode: 's_totals', kind: 'agg', name: tr('seed.dds.v_total_out'), aggRule: { measure: 'out' } })
  mk({ code: 'v_result', parentCode: 's_totals', kind: 'calc', name: tr('seed.dds.v_result'), formulaDefault: 'v_total_in - v_total_out' })

  const inc = categories.filter((c) => c.direction === 'in')
  if (inc.length) {
    mk({ code: 's_income', parentCode: null, kind: 'header', name: tr('seed.dds.s_income') })
    for (const c of inc) mk({ code: `inc_${c.code}`, parentCode: 'inc_total', kind: 'agg', name: c.name, aggRule: { measure: 'in', categoryCode: c.code } })
    mk({ code: 'inc_total', parentCode: 's_income', kind: 'calc', name: tr('seed.dds.inc_total'), formulaDefault: 'SUM(children)' })
  }

  const exp = categories.filter((c) => c.direction === 'out')
  if (exp.length) {
    mk({ code: 's_expense', parentCode: null, kind: 'header', name: tr('seed.dds.s_expense') })
    for (const c of exp) mk({ code: `exp_${c.code}`, parentCode: 'exp_total', kind: 'agg', name: c.name, aggRule: { measure: 'out', categoryCode: c.code } })
    mk({ code: 'exp_total', parentCode: 's_expense', kind: 'calc', name: tr('seed.dds.exp_total'), formulaDefault: 'SUM(children)' })
  }

  if (accounts.length) {
    mk({ code: 's_balances', parentCode: null, kind: 'header', name: tr('seed.dds.s_balances') })
    for (const a of accounts) mk({ code: `bal_${a.code}`, parentCode: 'bal_total', kind: 'agg', name: a.name, aggRule: { measure: 'balance', accountCode: a.code } })
    mk({ code: 'bal_total', parentCode: 's_balances', kind: 'calc', name: tr('seed.dds.bal_total'), formulaDefault: 'SUM(children)' })
  }

  return items
}
