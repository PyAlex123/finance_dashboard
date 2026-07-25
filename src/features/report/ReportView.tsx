import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectReport, selectFormulaByCode } from '../../store/reportSelectors'
import { setOverride, clearOverride } from '../../store/dataSlice'
import { rowTotal, type ReportRow } from '../../engine/report'
import { formatPeriod } from '../../engine/periods'
import { formatMoney, type Money } from '../../domain/money'
import ChecksPanel from './ChecksPanel'

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
  const [editing, setEditing] = useState<string | null>(null)

  if (report.rows.length === 0) {
    return (
      <div className="report-layout">
        <div className="report empty-state">
          <div className="empty-state__title">Отчёт пуст</div>
          <p className="empty-state__text">
            Добавьте статьи во вкладке «Шаблон», счета и категории — в «Справочниках»,
            операции — в «Журнале». Или нажмите «Загрузить пример» вверху.
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
    </div>
  )
}

function RowView({
  row, editing, onEdit, onClose,
}: { row: ReportRow; editing: boolean; onEdit: () => void; onClose: () => void }) {
  if (row.kind === 'header') {
    return (
      <tr className="report__row report__row--header">
        <td colSpan={99}>{row.name}</td>
      </tr>
    )
  }
  const total = cell(rowTotal(row))
  const isTotalRow = row.code.endsWith('_total')
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
          return (
            <td key={i} className={`report__num ${c.neg ? 'report__num--neg' : ''}`}>{c.text}</td>
          )
        })}
        <td className={`report__num report__total-col ${total.neg ? 'report__num--neg' : ''}`}>{total.text}</td>
      </tr>
      {editing && <FormulaEditor code={row.code} onClose={onClose} />}
    </>
  )
}
