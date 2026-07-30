// Экспорт/импорт .xlsx (SheetJS). Человеку — листы «Отчёт» (с живыми формулами),
// «Дашборд» (KPI + помесячно + категории) и «Журнал». Точный round-trip — через
// скрытый лист «Данные» с полным JSON-снимком (bigint сохраняются).
//
// SheetJS community умеет формулы (cell.f), числовой формат (cell.z) и ширины
// (!cols), но НЕ умеет графики и стили ячеек — дашборд отдаём таблицами.

import * as XLSX from 'xlsx'
import type { Account, DataSnapshot, Item } from '../domain/types'
import { toMajorNumber } from '../domain/money'
import { buildReport, rowTotal, type Report } from '../engine/report'
import { buildAutoCfItems } from '../engine/autoCf'
import { formatPeriod } from '../engine/periods'
import { computeDashboard } from '../features/dashboard/dashboardSelectors'
import { buildJournalRows, TYPE_LABEL } from '../features/journal/journalRows'
import { exportJson, importJson } from './json'

const SNAPSHOT_SHEET = 'Данные'
const SNAPSHOT_CELL = 'A1'
const Z_MONEY = '#,##0'
const Z_PCT = '0.0%'

/** Ячейка матрицы для сборки листа: значение + необязательный формат/формула. */
interface Cell {
  v: string | number
  z?: string
  f?: string
  t?: 's' | 'n'
}

/** Собрать лист из матрицы ячеек (null — пустая ячейка). */
function matrixToSheet(matrix: (Cell | null)[][]): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}
  let maxCol = 0
  matrix.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (!cell) return
      const t = cell.t ?? (typeof cell.v === 'number' ? 'n' : 's')
      const obj: XLSX.CellObject = { t, v: cell.v } as XLSX.CellObject
      if (cell.f) obj.f = cell.f
      if (cell.z) obj.z = cell.z
      ws[XLSX.utils.encode_cell({ r, c })] = obj
      if (c > maxCol) maxCol = c
    })
  })
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(matrix.length - 1, 0), c: maxCol } })
  return ws
}

/** Активные счета в порядке отображения (как колонки журнала). */
function activeAccounts(data: DataSnapshot): Account[] {
  return data.accounts.filter((a) => a.active).sort((a, b) => a.order - b.order)
}

/** Действующие статьи ДДС (как в selectReport): авто из данных или ручной шаблон. */
function cfReport(data: DataSnapshot): { report: Report; items: Item[] } {
  const cfItems = data.cfAuto !== false ? buildAutoCfItems(data) : data.items.filter((it) => it.form === 'cf')
  const items = [...data.items.filter((it) => it.form !== 'cf'), ...cfItems]
  return { report: buildReport({ ...data, items }, { form: 'cf' }), items: cfItems }
}

/**
 * Формула Excel для calc-статьи в колонке `col` (A1-буква периода), `prevCol` —
 * предыдущий период (для PREV) или null. Возвращает строку без «=» либо null, если
 * формулу перевести нельзя (тогда пишем статичное значение).
 */
function translateFormula(
  formula: string,
  col: string,
  prevCol: string | null,
  rowByCode: Map<string, number>,
): string | null {
  const tokens = formula.match(/PREV\s*\(\s*[A-Za-z_]\w*\s*\)|[A-Za-z_]\w*|\d+\.?\d*|[-+*/(),]/g)
  if (!tokens) return null
  const out: string[] = []
  for (const tk of tokens) {
    if (/^[-+*/(),]$/.test(tk) || /^\d/.test(tk)) { out.push(tk); continue }
    const prev = tk.match(/^PREV\s*\(\s*([A-Za-z_]\w*)\s*\)$/)
    if (prev) {
      if (!prevCol) return null
      const rr = rowByCode.get(prev[1]); if (rr === undefined) return null
      out.push(`${prevCol}${rr + 1}`); continue
    }
    const rr = rowByCode.get(tk); if (rr === undefined) return null // неизвестный код/функция → статика
    out.push(`${col}${rr + 1}`)
  }
  return out.join('')
}

function reportSheet(data: DataSnapshot): XLSX.WorkSheet {
  const { report, items } = cfReport(data)
  const P = report.periods.length
  const L = (c: number) => XLSX.utils.encode_col(c) // буква колонки

  const itemByCode = new Map(items.map((it) => [it.code, it]))
  const rowByCode = new Map<string, number>() // код → 0-based строка листа
  report.rows.forEach((row, idx) => rowByCode.set(row.code, idx + 1))
  const childrenByParent = new Map<string, string[]>()
  for (const it of items) {
    if (!it.parentCode) continue
    const arr = childrenByParent.get(it.parentCode) ?? []
    arr.push(it.code); childrenByParent.set(it.parentCode, arr)
  }

  const matrix: (Cell | null)[][] = []
  matrix.push([{ v: 'Статья' }, ...report.periods.map((p) => ({ v: formatPeriod(p) })), { v: 'ИТОГО' }])

  report.rows.forEach((row, idx) => {
    const r = idx + 1 // 0-based строка листа
    const line: (Cell | null)[] = [{ v: '  '.repeat(row.depth) + row.name }]
    if (row.kind === 'header') { matrix.push(line); return }

    const item = itemByCode.get(row.code)
    for (let i = 0; i < P; i++) {
      const col = L(i + 1)
      const cached = toMajorNumber(row.values[i] ?? 0n)
      let f: string | undefined
      if (row.kind === 'calc' && item) {
        const kids = (childrenByParent.get(row.code) ?? []).filter((c) => rowByCode.has(c))
        if (item.formulaDefault === 'SUM(children)' && kids.length > 0) {
          f = `SUM(${kids.map((c) => `${col}${rowByCode.get(c)! + 1}`).join(',')})`
        } else if (item.formulaDefault) {
          f = translateFormula(item.formulaDefault, col, i > 0 ? L(i) : null, rowByCode) ?? undefined
        }
      }
      line.push({ v: cached, z: Z_MONEY, ...(f ? { f } : {}) })
    }

    // Колонка ИТОГО по режиму строки (потоки — сумма, остатки — последний период).
    const total = rowTotal(row)
    if (row.totalMode === 'none' || total === null) {
      line.push(null)
    } else if (row.totalMode === 'last' && P > 0) {
      line.push({ v: toMajorNumber(total), z: Z_MONEY, f: `${L(P)}${r + 1}` })
    } else if (P > 0) {
      line.push({ v: toMajorNumber(total), z: Z_MONEY, f: `SUM(${L(1)}${r + 1}:${L(P)}${r + 1})` })
    } else {
      line.push({ v: toMajorNumber(total), z: Z_MONEY })
    }
    matrix.push(line)
  })

  const ws = matrixToSheet(matrix)
  ws['!cols'] = [{ wch: 34 }, ...report.periods.map(() => ({ wch: 14 })), { wch: 16 }]
  return ws
}

function dashboardSheet(data: DataSnapshot): XLSX.WorkSheet {
  const d = computeDashboard(data)
  const m: (Cell | null)[][] = []
  const money = (v: number): Cell => ({ v, z: Z_MONEY })

  m.push([{ v: 'Дашборд ДДС' }])
  m.push([])
  m.push([{ v: 'Ключевые показатели' }])
  m.push([{ v: 'Итого поступления' }, money(toMajorNumber(d.kpis.totalIn))])
  m.push([{ v: 'Итого списания' }, money(toMajorNumber(d.kpis.totalOut))])
  m.push([{ v: 'Чистый результат' }, money(toMajorNumber(d.kpis.result))])
  m.push([{ v: 'Остаток на конец' }, money(toMajorNumber(d.kpis.endingBalance))])
  m.push([])
  m.push([{ v: 'Помесячно' }, { v: 'Приход' }, { v: 'Расход' }, { v: 'Результат' }, { v: 'Остаток' }])
  d.monthLabels.forEach((label, i) => {
    m.push([
      { v: label },
      money(d.inByPeriod[i]), money(d.outByPeriod[i]), money(d.resultByPeriod[i]), money(d.balanceByPeriod[i]),
    ])
  })
  m.push([])
  m.push([{ v: 'Расходы по категориям' }, { v: 'Сумма' }, { v: 'Доля' }])
  d.expenses.forEach((e) => {
    m.push([{ v: e.name }, money(toMajorNumber(e.amount)), { v: e.share, z: Z_PCT }])
  })

  const ws = matrixToSheet(m)
  ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 }]
  return ws
}

function journalSheet(data: DataSnapshot): XLSX.WorkSheet {
  const accounts = activeAccounts(data)
  const journal = buildJournalRows(data.operations, data.operationLines, accounts, data.categories)
  const header = [
    '№', 'Дата', 'Тип', 'Описание', 'Категория',
    ...accounts.map((a) => a.name),
    'Примечание',
  ]
  const rows: (string | number)[][] = [header]
  for (const r of journal) {
    rows.push([
      r.index,
      r.date,
      TYPE_LABEL[r.type],
      r.description,
      r.categoryName,
      ...accounts.map((a) => {
        const v = r[a.id]
        return typeof v === 'bigint' && v !== 0n ? toMajorNumber(v) : ''
      }),
      r.note,
    ])
  }
  return XLSX.utils.aoa_to_sheet(rows)
}

/** Собрать книгу Excel: Отчёт + Дашборд + Журнал + скрытый снимок. */
export function exportWorkbook(data: DataSnapshot): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, reportSheet(data), 'Отчёт')
  XLSX.utils.book_append_sheet(wb, dashboardSheet(data), 'Дашборд')
  XLSX.utils.book_append_sheet(wb, journalSheet(data), 'Журнал')

  const snap = XLSX.utils.aoa_to_sheet([[exportJson(data)]])
  XLSX.utils.book_append_sheet(wb, snap, SNAPSHOT_SHEET)
  // пометить лист-снимок скрытым
  if (wb.Workbook?.Sheets) {
    const idx = wb.SheetNames.indexOf(SNAPSHOT_SHEET)
    if (wb.Workbook.Sheets[idx]) wb.Workbook.Sheets[idx].Hidden = 1
  } else {
    wb.Workbook = { Sheets: wb.SheetNames.map((n) => ({ Hidden: n === SNAPSHOT_SHEET ? 1 : 0 })) }
  }
  return wb
}

export function exportXlsx(data: DataSnapshot): ArrayBuffer {
  return XLSX.write(exportWorkbook(data), { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
}

/** Round-trip импорт: читаем скрытый лист-снимок с JSON. */
export function importXlsx(buf: ArrayBuffer): DataSnapshot {
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[SNAPSHOT_SHEET]
  if (!sheet) {
    throw new Error('Файл без листа «Данные» — экспортируйте его из этого приложения')
  }
  const cell = sheet[SNAPSHOT_CELL] as XLSX.CellObject | undefined
  const json = cell?.v
  if (typeof json !== 'string') {
    throw new Error('Лист «Данные» пуст или повреждён')
  }
  return importJson(json)
}
