import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectData } from '../../store/selectors'
import { selectPlReport } from '../../store/reportSelectors'
import { setCellValue, deleteCellValue, addPeriod, removePeriod, seedItems } from '../../store/dataSlice'
import { rowTotal, type ReportRow } from '../../engine/report'
import { formatPeriod } from '../../engine/periods'
import { formatMoney, parseMoney, toMajorNumber, type Money } from '../../domain/money'
import { PL_ITEMS } from '../../data/plTemplate'
import { buildPlExample } from '../../data/plExample'

function fmt(v: Money | null): { text: string; neg: boolean } {
  if (v === null) return { text: '', neg: false }
  return { text: v === 0n ? '—' : formatMoney(v), neg: v < 0n }
}

export default function PlReport() {
  const dispatch = useAppDispatch()
  const data = useAppSelector(selectData)
  const report = useAppSelector(selectPlReport)
  const plItems = data.items.filter((i) => i.form === 'pl')

  if (plItems.length === 0) return <PlEmpty />

  const cell = new Map<string, Money>()
  for (const cv of data.cellValues) cell.set(`${cv.itemCode}|${cv.period}`, cv.amount)

  const revTotalRow = report.rows.find((r) => r.code === 'rev_total')
  const revTotal = revTotalRow ? rowTotal(revTotalRow) : null

  function addMonth() {
    const p = prompt('Добавить период (ГГГГ-ММ), например 2025-04:')
    if (p && /^\d{4}-(0[1-9]|1[0-2])$/.test(p.trim())) dispatch(addPeriod(p.trim()))
    else if (p) alert('Формат периода: ГГГГ-ММ (год обязателен)')
  }

  return (
    <div className="report-layout">
      <div className="report">
        {report.error && <div className="report__error">Ошибка расчёта: {report.error}</div>}
        <table className="report__table pl__table">
          <thead>
            <tr>
              <th className="report__name-col">Показатель</th>
              {report.periods.map((p) => (
                <th key={p} className="report__num-col">
                  <span>{formatPeriod(p)}</span>
                  <button className="pl__delcol" title="Удалить период" onClick={() => dispatch(removePeriod(p))}>✕</button>
                </th>
              ))}
              <th className="report__num-col report__total-col">ИТОГО</th>
              <th className="report__num-col pl__pct-col">% выр.</th>
              <th className="pl__addcol"><button className="btn btn--small" onClick={addMonth}>+ период</button></th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <PlRow
                key={row.code}
                row={row}
                periods={report.periods}
                cell={cell}
                revTotal={revTotal}
                onCell={(period, text) => {
                  const t = text.trim()
                  if (t === '') dispatch(deleteCellValue({ itemCode: row.code, period }))
                  else {
                    try { dispatch(setCellValue({ itemCode: row.code, period, amount: parseMoney(t) })) }
                    catch { /* игнорируем некорректный ввод */ }
                  }
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PlRow({
  row, periods, cell, revTotal, onCell,
}: {
  row: ReportRow
  periods: string[]
  cell: Map<string, Money>
  revTotal: Money | null
  onCell: (period: string, text: string) => void
}) {
  if (row.kind === 'header') {
    return <tr className="report__row report__row--header"><td colSpan={99}>{row.name}</td></tr>
  }
  const total = rowTotal(row)
  const t = fmt(total)
  const isTotal = row.code.endsWith('_total') || ['gross', 'op_profit', 'pretax', 'net_profit'].includes(row.code)
  const pct = revTotal && revTotal !== 0n && total !== null
    ? `${(toMajorNumber(total) / toMajorNumber(revTotal) * 100).toFixed(1)}%`
    : ''

  return (
    <tr className={`report__row ${isTotal ? 'report__row--total' : ''}`}>
      <td className="report__name" style={{ paddingLeft: 12 + row.depth * 16 }}>{row.name}</td>
      {periods.map((p, i) => (
        <td key={p} className="report__num">
          {row.kind === 'input' ? (
            <input
              className="pl__cell"
              defaultValue={cellMajor(cell.get(`${row.code}|${p}`))}
              key={cellMajor(cell.get(`${row.code}|${p}`))}
              onBlur={(e) => onCell(p, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              inputMode="decimal"
            />
          ) : (
            <ReadCell v={row.values[i]} />
          )}
        </td>
      ))}
      <td className={`report__num report__total-col ${t.neg ? 'report__num--neg' : ''}`}>{t.text}</td>
      <td className="report__num pl__pct-col">{pct}</td>
      <td />
    </tr>
  )
}

function ReadCell({ v }: { v: Money | undefined }) {
  const c = fmt(v ?? 0n)
  return <span className={c.neg ? 'report__num--neg' : ''}>{c.text}</span>
}

function cellMajor(v: Money | undefined): string {
  if (v === undefined) return ''
  return String(toMajorNumber(v))
}

function PlEmpty() {
  const dispatch = useAppDispatch()
  return (
    <div className="report-layout">
      <div className="report empty-state">
        <div className="empty-state__title">P&L пуст</div>
        <p className="empty-state__text">
          Начните со стандартной структуры P&L или загрузите учебный пример.
          Значения по месяцам вводятся вручную, уровни прибыли считаются автоматически.
        </p>
        <div className="empty-state__actions">
          <button
            className="btn btn--primary"
            onClick={() => dispatch(seedItems({ items: structuredClone(PL_ITEMS), periods: [] }))}
          >
            Стандартная структура P&L
          </button>
          <button
            className="btn"
            onClick={() => {
              const ex = buildPlExample()
              dispatch(seedItems({ items: ex.items, periods: ex.periods }))
              for (const cv of ex.cellValues) {
                dispatch(setCellValue({ itemCode: cv.itemCode, period: cv.period, amount: cv.amount }))
              }
            }}
          >
            Загрузить учебный пример
          </button>
        </div>
      </div>
    </div>
  )
}
