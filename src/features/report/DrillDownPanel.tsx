// Панель «из чего сложилось» — выезжает справа при клике по сумме в отчёте.
// Показывает реальные операции, вошедшие в агрегат (engine/listAggOperations).

import { formatMoney, type Money } from '../../domain/money'
import { formatDateLabel } from '../journal/rowEdit'
import type { AggOperation } from '../../engine/aggregate'
import { useT } from '../../i18n/react'

export interface DrillData {
  title: string
  periodLabel: string
  total: Money
  ops: AggOperation[]
}

export default function DrillDownPanel({ drill, onClose }: { drill: DrillData; onClose: () => void }) {
  const t = useT()
  const neg = drill.total < 0n
  return (
    <div className="drill-backdrop" onClick={onClose}>
      <aside className="drill" onClick={(e) => e.stopPropagation()}>
        <div className="drill__head">
          <div className="drill__top">
            <div className="drill__eyebrow">{t('drill.title', { period: drill.periodLabel })}</div>
            <button className="drill__close" onClick={onClose} title={t('common.close')}>✕</button>
          </div>
          <div className="drill__title">{drill.title}</div>
          <div className={`drill__total ${neg ? 'drill__total--neg' : ''}`}>
            {neg ? `(${formatMoney(-drill.total)})` : formatMoney(drill.total)}
          </div>
        </div>

        <div className="drill__list">
          {drill.ops.length === 0 && <div className="drill__empty">{t('drill.empty')}</div>}
          {drill.ops.map((o) => {
            const oneg = o.amount < 0n
            return (
              <div key={o.operationId} className="drill__op">
                <div className="drill__op-main">
                  <div className="drill__op-desc">{o.description || t('common.dash')}</div>
                  <div className="drill__op-meta">{formatDateLabel(o.date)}{o.accounts ? ` · ${o.accounts}` : ''}</div>
                </div>
                <span className={`drill__op-amount ${oneg ? 'drill__op-amount--neg' : ''}`}>
                  {oneg ? `(${formatMoney(-o.amount)})` : formatMoney(o.amount)}
                </span>
              </div>
            )
          })}
        </div>

        <div className="drill__foot">{t('drill.foot')}</div>
      </aside>
    </div>
  )
}
