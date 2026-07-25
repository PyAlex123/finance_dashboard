// Полоса остатков по счетам над журналом. Данные реальные: остаток в валюте
// счёта + итог в базовой валюте (UZS) с пересчётом по курсу. Значения — из
// selectAccountBalances / selectTotalBalance (агрегаты журнала).

import { useAppSelector } from '../../store/hooks'
import { selectAccountBalances, selectTotalBalance } from '../../store/reportSelectors'
import { selectChecksOk } from '../../store/reportSelectors'
import { formatMoney } from '../../domain/money'
import { useViewMode } from '../shell/ViewMode'
import type { AccountBalance } from '../../store/reportSelectors'

const CUR_SYMBOL: Record<string, string> = { USD: '$', UZS: '' }

/** Остаток в валюте счёта: для USD — «$4 820», для UZS — «4 820 000». */
function nativeText(b: AccountBalance): string {
  const sym = CUR_SYMBOL[b.currency] ?? ''
  return sym ? `${sym}${formatMoney(b.native)}` : formatMoney(b.native)
}

export default function BalancesStrip() {
  const balances = useAppSelector(selectAccountBalances)
  const total = useAppSelector(selectTotalBalance)
  const checksOk = useAppSelector(selectChecksOk)
  const mobile = useViewMode() === 'mobile'

  if (balances.length === 0) return null

  if (mobile) {
    return (
      <div className="balances balances--mobile">
        {balances.map((b) => (
          <div key={b.id} className="balances__card">
            <div className="balances__name">{b.name}</div>
            <div className="balances__amount">{nativeText(b)}</div>
          </div>
        ))}
      </div>
    )
  }

  // ширина колонок: по одной на счёт + чуть шире колонка итога
  const gridStyle = { gridTemplateColumns: `repeat(${balances.length}, minmax(0, 1fr)) minmax(0, 1.15fr)` }

  return (
    <>
      <div className="balances__eyebrow">Остатки по счетам</div>
      <div className="balances" style={gridStyle}>
        {balances.map((b) => (
          <div key={b.id} className="balances__card">
            <div className="balances__head">
              {b.name}
              <span className="balances__cur">{b.currency}</span>
            </div>
            <div className="balances__amount">{nativeText(b)}</div>
            {b.currency !== 'UZS' && (
              <div className="balances__sub">≈ {formatMoney(b.base)} сум</div>
            )}
          </div>
        ))}
        <div className="balances__card balances__card--total">
          <div className="balances__head balances__head--total">
            Итого в UZS
            <span className={`balances__pill ${checksOk ? 'balances__pill--ok' : 'balances__pill--warn'}`}>
              ● {checksOk ? 'сходится' : 'расхождение'}
            </span>
          </div>
          <div className="balances__amount balances__amount--total">{formatMoney(total)}</div>
        </div>
      </div>
    </>
  )
}
