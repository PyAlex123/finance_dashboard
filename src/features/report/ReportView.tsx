import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectReport, selectFormulaByCode, selectCfAggRuleByCode } from '../../store/reportSelectors'
import { selectData } from '../../store/selectors'
import { setOverride, clearOverride } from '../../store/dataSlice'
import { rowTotal, type ReportRow } from '../../engine/report'
import { formatPeriod } from '../../engine/periods'
import { formatMoney, type Money } from '../../domain/money'
import { listAggOperations } from '../../engine/aggregate'
import type { PeriodKey } from '../../domain/types'
import ChecksPanel from './ChecksPanel'
import DrillDownPanel, { type DrillData } from './DrillDownPanel'

// Отрицательные суммы — в скобках (терракота), как в эталоне: (1 300 000).
function cell(v: Money | null): { text: string; neg: boolean } {
  if (v === null) return { text: '', neg: false }
  if (v === 0n) return { text: '—', neg: false }
  if (v < 0n) return { text: `(${formatMoney(-v)})`, neg: true }
  return { text: formatMoney(v), neg: false }
}

function FormulaEditor({ code, onClose }: { code: string; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const getFormula = useAppSelector(selectFormulaByCode)
  const info = getFormula(code)
  const [draft, setDraft] = useState(info.current)

  return (
    <tr className="report__editor-row">
      <td colSpan={99}>
        <div className="fx">
          <span className="fx__label">Формула «{code}»:</span>
          <input
            className="fx__input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
          />
          <button className="fx__btn" onClick={() => { dispatch(setOverride(code, draft.trim())); onClose() }}>
            Сохранить
          </button>
          {info.isOverridden && (
            <button
              className="fx__btn fx__btn--revert"
              onClick={() => { dispatch(clearOverride(code)); onClose() }}
              title={`Вернуть шаблонную: ${info.default}`}
            >
              ↺ Как в шаблоне
            </button>
          )}
          <button className="fx__btn fx__btn--ghost" onClick={onClose}>Отмена</button>
        </div>
      </td>
    </tr>
  )
}

export default function ReportView() {
  const report = useAppSelector(selectReport)
  const data = useAppSelector(selectData)
  const [editing, setEditing] = useState<string | null>(null)
  const [drill, setDrill] = useState<DrillData | null>(null)

  // Код статьи → правило агрегата (только agg-строки кликабельны для drill-down).
  // Берём действующие статьи (авто из данных или ручной шаблон).
  const aggRuleByCode = useAppSelector(selectCfAggRuleByCode)

  function openDrill(row: ReportRow, period: PeriodKey | 'total') {
    const rule = aggRuleByCode.get(row.code)
    if (!rule) return
    const periods = period === 'total' ? report.periods : [period]
    const ops = periods.flatMap((p) => listAggOperations(data, rule, p))
    const total = ops.reduce((acc, o) => acc + o.amount, 0n)
    setDrill({
      title: row.name,
      periodLabel: period === 'total' ? 'весь период' : formatPeriod(period),
      total,
      ops,
    })
  }

  if (report.rows.length === 0) {
    return (
      <div className="report-layout">
        <div className="report empty-state">
          <div className="empty-state__title">Пока нет данных</div>
          <p className="empty-state__text">
            Отчёт формируется автоматически. Заведите счета и категории в «Справочниках»
            и внесите операции в «Журнале» — строки появятся сами. Или нажмите
            «Загрузить пример» вверху.
          </p>
        </div>
        <ChecksPanel />
      </div>
    )
  }

  return (
    <div className="report-layout">
      <div className="report-main">
        <div className="report__header">
          <div className="report__eyebrow">Сводный отчёт</div>
          <h2 className="report__heading">Итоги за период · по категориям · остатки</h2>
        </div>
        <div className="report">
        {report.error && <div className="report__error">Ошибка расчёта: {report.error}</div>}
        <table className="report__table">
          <thead>
            <tr>
              <th className="report__name-col">Статья</th>
              {report.periods.map((p) => (
                <th key={p} className="report__num-col">{formatPeriod(p)}</th>
              ))}
              <th className="report__num-col report__total-col">ИТОГО</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <RowView
                key={row.code}
                row={row}
                periods={report.periods}
                drillable={aggRuleByCode.has(row.code)}
                onDrill={(period) => openDrill(row, period)}
                editing={editing === row.code}
                onEdit={() => setEditing(editing === row.code ? null : row.code)}
                onClose={() => setEditing(null)}
              />
            ))}
          </tbody>
        </table>
        </div>
        <div className="report__callout">
          <span className="report__callout-mark">!</span>
          <div className="report__callout-text">
            <b>Ключевая идея.</b> Прибыль ≠ деньги на счёте. Результат периода не равен изменению
            остатка — на остаток влияют переброски, кредиторка и предоплаты.
          </div>
        </div>
        <p className="report__note">
          Клик по сумме открывает операции, из которых она сложилась. Переброски между счетами
          не меняют итоговый остаток.
        </p>
      </div>
      <ChecksPanel />
      {drill && <DrillDownPanel drill={drill} onClose={() => setDrill(null)} />}
    </div>
  )
}

function RowView({
  row, periods, drillable, onDrill, editing, onEdit, onClose,
}: {
  row: ReportRow
  periods: PeriodKey[]
  drillable: boolean
  onDrill: (period: PeriodKey | 'total') => void
  editing: boolean
  onEdit: () => void
  onClose: () => void
}) {
  if (row.kind === 'header') {
    return (
      <tr className="report__row report__row--header">
        <td colSpan={99}>{row.name}</td>
      </tr>
    )
  }
  const total = cell(rowTotal(row))
  const isTotalRow = row.code.endsWith('_total')
  // кликабельны только непустые ячейки drill-able строк (агрегатов)
  const numCls = (c: { neg: boolean; text: string }) =>
    `report__num ${c.neg ? 'report__num--neg' : ''} ${drillable && c.text && c.text !== '—' ? 'report__num--drill' : ''}`
  return (
    <>
      <tr className={`report__row ${isTotalRow ? 'report__row--total' : ''}`}>
        <td className="report__name" style={{ paddingLeft: 12 + row.depth * 16 }}>
          {row.name}
          {row.kind === 'calc' && (
            <button className="report__fx" onClick={onEdit} title="Редактировать формулу">
              ƒ{row.isOverridden ? ' •' : ''}
            </button>
          )}
        </td>
        {row.values.map((v, i) => {
          const c = cell(v)
          const drillOk = drillable && c.text !== '' && c.text !== '—'
          return (
            <td
              key={i}
              className={numCls(c)}
              onClick={drillOk ? () => onDrill(periods[i]) : undefined}
            >
              {c.text}
            </td>
          )
        })}
        <td
          className={`${numCls(total)} report__total-col`}
          onClick={drillable && total.text && total.text !== '—' ? () => onDrill('total') : undefined}
        >
          {total.text}
        </td>
      </tr>
      {editing && <FormulaEditor code={row.code} onClose={onClose} />}
    </>
  )
}
