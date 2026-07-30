import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectData } from '../../store/selectors'
import { selectBsReport, selectBsBalanced } from '../../store/reportSelectors'
import { setCellValue, deleteCellValue, addPeriod, removePeriod, seedItems } from '../../store/dataSlice'
import { type ReportRow } from '../../engine/report'
import { formatPeriod } from '../../engine/periods'
import { formatMoney, parseMoney, toMajorNumber, type Money } from '../../domain/money'
import { BS_ITEMS, BS_TOTAL_CODES } from '../../data/bsTemplate'
import { buildBsExample } from '../../data/bsExample'

function fmt(v: Money | null): { text: string; neg: boolean } {
  if (v === null) return { text: '', neg: false }
  return { text: v === 0n ? '—' : formatMoney(v), neg: v < 0n }
}

// Отчёт «Баланс»: снимок на дату (колонки — даты срезов). Ручной ввод статей;
// итоги разделов и балансовое уравнение считаются автоматически. Контроль
// «Активы = Обязательства + Капитал» виден строкой bs_check и полосой-статусом.
export default function BsReport() {
  const dispatch = useAppDispatch()
  const data = useAppSelector(selectData)
  const report = useAppSelector(selectBsReport)
  const balanced = useAppSelector(selectBsBalanced)
  const bsItems = data.items.filter((i) => i.form === 'bs')

  if (bsItems.length === 0) return <BsEmpty />

  const cell = new Map<string, Money>()
  for (const cv of data.cellValues) cell.set(`${cv.itemCode}|${cv.period}`, cv.amount)

  function addDate() {
    const p = prompt('Добавить дату-срез (ГГГГ-ММ), например 2025-06:')
    if (p && /^\d{4}-(0[1-9]|1[0-2])$/.test(p.trim())) dispatch(addPeriod(p.trim()))
    else if (p) alert('Формат даты: ГГГГ-ММ (год обязателен)')
  }

  return (
    <div className="report-layout">
      <div className="report">
        {report.error && <div className="report__error">Ошибка расчёта: {report.error}</div>}
        {balanced !== null && (
          <div className={`bs__status ${balanced ? 'bs__status--ok' : 'bs__status--bad'}`}>
            {balanced
              ? '✅ Баланс сходится: Активы = Обязательства + Капитал'
              : '⚠ Баланс не сходится — проверьте статьи (Активы ≠ Обязательства + Капитал)'}
          </div>
        )}
        <table className="report__table pl__table">
          <thead>
            <tr>
              <th className="report__name-col">Статья</th>
              {report.periods.map((p) => (
                <th key={p} className="report__num-col">
                  <span>{formatPeriod(p)}</span>
                  <button className="pl__delcol" title="Удалить дату" onClick={() => dispatch(removePeriod(p))}>✕</button>
                </th>
              ))}
              <th className="pl__addcol"><button className="btn btn--small" onClick={addDate}>+ дата</button></th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <BsRow
                key={row.code}
                row={row}
                periods={report.periods}
                cell={cell}
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

function BsRow({
  row, periods, cell, onCell,
}: {
  row: ReportRow
  periods: string[]
  cell: Map<string, Money>
  onCell: (period: string, text: string) => void
}) {
  if (row.kind === 'header') {
    return <tr className="report__row report__row--header"><td colSpan={99}>{row.name}</td></tr>
  }
  const isCheck = row.code === 'bs_check'
  const isTotal = BS_TOTAL_CODES.has(row.code)

  return (
    <tr className={`report__row ${isTotal ? 'report__row--total' : ''} ${isCheck ? 'report__row--check' : ''}`}>
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
            <ReadCell v={row.values[i]} check={isCheck} />
          )}
        </td>
      ))}
      <td />
    </tr>
  )
}

function ReadCell({ v, check }: { v: Money | undefined; check?: boolean }) {
  if (check) {
    const zero = (v ?? 0n) === 0n
    return <span className={zero ? 'bs__ok' : 'report__num--neg'}>{zero ? '✓ 0' : fmt(v ?? 0n).text}</span>
  }
  const c = fmt(v ?? 0n)
  return <span className={c.neg ? 'report__num--neg' : ''}>{c.text}</span>
}

function cellMajor(v: Money | undefined): string {
  if (v === undefined) return ''
  return String(toMajorNumber(v))
}

function BsEmpty() {
  const dispatch = useAppDispatch()
  return (
    <div className="report-layout">
      <div className="report empty-state">
        <div className="empty-state__title">Баланс пуст</div>
        <p className="empty-state__text">
          Баланс — «снимок» бизнеса на дату: активы (что есть) и пассивы (за чей счёт).
          Начните со стандартной структуры или загрузите учебный пример. Итоги и проверка
          «Активы = Обязательства + Капитал» считаются автоматически.
        </p>
        <div className="empty-state__actions">
          <button
            className="btn btn--primary"
            onClick={() => dispatch(seedItems({ items: structuredClone(BS_ITEMS), periods: [] }))}
          >
            Стандартная структура баланса
          </button>
          <button
            className="btn"
            onClick={() => {
              const ex = buildBsExample()
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
