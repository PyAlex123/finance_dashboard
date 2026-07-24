import { useMemo, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectData } from '../../store/selectors'
import { hydrate } from '../../store/dataSlice'
import {
  readWorkbookGrids, detectReportKind, detectPlMapping, detectDdsMapping,
  parsePlMatrix, parseDdsJournal, type Grid, type DdsMapping, type ReportKind,
} from '../../data/importExcel'
import { parsePeriodLabel } from '../../engine/periods'
import { applyPlImport, applyDdsImport, type ImportMode } from './applyImport'

type Role = 'none' | 'date' | 'type' | 'desc' | 'category' | 'note' | 'account'
const ROLE_LABEL: Record<Role, string> = {
  none: '—', date: 'Дата', type: 'Тип', desc: 'Описание', category: 'Категория', note: 'Примечание', account: 'Счёт',
}

export default function ImportWizard({ buf, onClose }: { buf: ArrayBuffer; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const current = useAppSelector(selectData)
  const wb = useMemo(() => readWorkbookGrids(buf), [buf])

  const firstReal = wb.sheetNames.find((n) => (wb.grids[n] ?? []).some((r) => r.some((c) => c !== null))) ?? wb.sheetNames[0]
  const [sheet, setSheet] = useState(firstReal)
  const grid: Grid = wb.grids[sheet] ?? []

  const [year, setYear] = useState(new Date().getFullYear())
  const [mode, setMode] = useState<ImportMode>('replace')
  const [kind, setKind] = useState<ReportKind>(() => detectReportKind(grid, year))
  const [error, setError] = useState('')

  // P&L: строка-заголовок и колонка-подпись
  const autoPl = useMemo(() => detectPlMapping(grid, year), [grid, year])
  const [headerRow, setHeaderRow] = useState(autoPl.headerRow)
  const [labelCol, setLabelCol] = useState(autoPl.labelCol)

  // ДДС: роли колонок
  const autoDds = useMemo(() => detectDdsMapping(grid), [grid])
  const [roles, setRoles] = useState<Record<number, Role>>(() => rolesFromDds(autoDds))

  function reDetect(newSheet: string) {
    const g = wb.grids[newSheet] ?? []
    setSheet(newSheet)
    const k = detectReportKind(g, year)
    setKind(k)
    const pl = detectPlMapping(g, year)
    setHeaderRow(pl.headerRow)
    setLabelCol(pl.labelCol)
    setRoles(rolesFromDds(detectDdsMapping(g)))
  }

  const colCount = Math.max(0, ...grid.slice(0, 25).map((r) => r.length))
  const periodCols = (grid[headerRow] ?? [])
    .map((c, col) => ({ col, label: c === null ? '' : String(c) }))
    .filter((x) => parsePeriodLabel(x.label, year) !== null)

  // сводка предпросмотра
  const summary = useMemo(() => {
    try {
      if (kind === 'pl') {
        const p = parsePlMatrix(grid, { headerRow, labelCol, periodCols }, { defaultYear: year })
        const inputs = p.items.filter((i) => i.kind === 'input').length
        const calcs = p.items.filter((i) => i.kind === 'calc').length
        return `Периодов: ${p.periods.length} · строк ввода: ${inputs} · расчётных: ${calcs}`
      }
      const mapping = ddsMappingFrom(roles, headerRowForDds())
      const p = parseDdsJournal(grid, mapping, { defaultYear: year })
      return `Операций: ${p.operations.length} · счетов: ${p.accounts.length} · категорий: ${p.categories.length} · нач. остатков: ${p.openingBalances.length}`
    } catch (e) {
      return 'Ошибка предпросмотра: ' + (e instanceof Error ? e.message : String(e))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, grid, headerRow, labelCol, year, roles])

  function headerRowForDds(): number {
    return autoDds.headerRow
  }
  function ddsMappingFrom(r: Record<number, Role>, hr: number): DdsMapping {
    const findRole = (role: Role) => {
      const e = Object.entries(r).find(([, v]) => v === role)
      return e ? Number(e[0]) : null
    }
    const accountCols = Object.entries(r)
      .filter(([, v]) => v === 'account')
      .map(([col]) => ({ col: Number(col), name: String((grid[hr] ?? [])[Number(col)] ?? `Счёт ${col}`) }))
    return {
      headerRow: hr,
      dateCol: findRole('date'), typeCol: findRole('type'), descCol: findRole('desc'),
      categoryCol: findRole('category'), noteCol: findRole('note'), accountCols,
    }
  }

  function confirm() {
    setError('')
    try {
      const next = kind === 'pl'
        ? applyPlImport(current, parsePlMatrix(grid, { headerRow, labelCol, periodCols }, { defaultYear: year }), mode)
        : applyDdsImport(current, parseDdsJournal(grid, ddsMappingFrom(roles, headerRowForDds()), { defaultYear: year }), mode)
      dispatch(hydrate(next))
      onClose()
    } catch (e) {
      setError('Не удалось импортировать: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal__title">Импорт из Excel</h3>

        <div className="imp__controls">
          {wb.sheetNames.length > 1 && (
            <label className="field">
              <span>Лист</span>
              <select value={sheet} onChange={(e) => reDetect(e.target.value)}>
                {wb.sheetNames.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          )}
          <label className="field">
            <span>Тип отчёта</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as ReportKind)}>
              <option value="dds">ДДС (журнал)</option>
              <option value="pl">P&L (матрица)</option>
            </select>
          </label>
          <label className="field">
            <span>Год по умолчанию</span>
            <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || year)} />
          </label>
          <label className="field">
            <span>Режим</span>
            <select value={mode} onChange={(e) => setMode(e.target.value as ImportMode)}>
              <option value="replace">Заменить</option>
              <option value="merge">Дополнить</option>
            </select>
          </label>
          {kind === 'pl' && (
            <>
              <label className="field">
                <span>Строка-заголовок</span>
                <select value={headerRow} onChange={(e) => setHeaderRow(Number(e.target.value))}>
                  {grid.slice(0, 20).map((_, i) => <option key={i} value={i}>{i + 1}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Колонка названий</span>
                <select value={labelCol} onChange={(e) => setLabelCol(Number(e.target.value))}>
                  {Array.from({ length: colCount }, (_, c) => <option key={c} value={c}>{colName(c)}</option>)}
                </select>
              </label>
            </>
          )}
        </div>

        <div className="imp__summary">{summary}</div>

        <div className="imp__preview">
          <table className="imp__grid">
            <tbody>
              {kind === 'dds' && (
                <tr className="imp__roles">
                  {Array.from({ length: colCount }, (_, c) => (
                    <td key={c}>
                      <select value={roles[c] ?? 'none'} onChange={(e) => setRoles({ ...roles, [c]: e.target.value as Role })}>
                        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                    </td>
                  ))}
                </tr>
              )}
              {grid.slice(0, 14).map((row, r) => (
                <tr key={r} className={kind === 'pl' && r === headerRow ? 'imp__hdr' : ''}>
                  {Array.from({ length: colCount }, (_, c) => {
                    const isPeriod = kind === 'pl' && r === headerRow && periodCols.some((p) => p.col === c)
                    const isLabel = kind === 'pl' && c === labelCol
                    return (
                      <td key={c} className={`${isPeriod ? 'imp__period' : ''} ${isLabel ? 'imp__label' : ''}`}>
                        {cellShort(row[c])}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <div className="modal__error">{error}</div>}

        <div className="modal__actions">
          <button className="btn btn--primary" onClick={confirm}>Импортировать</button>
          <button className="btn" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  )
}

function rolesFromDds(m: DdsMapping): Record<number, Role> {
  const r: Record<number, Role> = {}
  if (m.dateCol !== null) r[m.dateCol] = 'date'
  if (m.typeCol !== null) r[m.typeCol] = 'type'
  if (m.descCol !== null) r[m.descCol] = 'desc'
  if (m.categoryCol !== null) r[m.categoryCol] = 'category'
  if (m.noteCol !== null) r[m.noteCol] = 'note'
  for (const a of m.accountCols) r[a.col] = 'account'
  return r
}

function colName(c: number): string {
  let s = ''
  let n = c
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1 } while (n >= 0)
  return s
}
function cellShort(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return s.length > 18 ? s.slice(0, 17) + '…' : s
}
