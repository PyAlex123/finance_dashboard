// Производные селекторы: отчёт и контрольные суммы. Пересчитываются от данных.
// Ничего вычисляемого не хранится в сторе — только здесь, мемоизировано.

import { createSelector } from '@reduxjs/toolkit'
import { selectData, selectActiveAccounts, selectPeriods } from './selectors'
import { buildReport } from '../engine/report'
import { runChecks, allChecksOk } from '../engine/checks'
import { buildAggContext, aggValue } from '../engine/aggregate'
import type { Money } from '../domain/money'

// ДДС (форма cf)
export const selectReport = createSelector([selectData], (data) => buildReport(data, { form: 'cf' }))
export const selectChecks = createSelector([selectData], (data) => runChecks(data, 'cf'))
export const selectChecksOk = createSelector([selectChecks], (checks) => allChecksOk(checks))

// P&L (форма pl)
export const selectPlReport = createSelector([selectData], (data) => buildReport(data, { form: 'pl' }))
export const selectPlChecks = createSelector([selectData], (data) => runChecks(data, 'pl'))

/**
 * Суммарный остаток по всем активным счетам в базовой валюте (UZS) на конец
 * последнего периода журнала. Считается напрямую по агрегатам (не зависит от
 * того, есть ли в шаблоне строки-остатки) — пригодно для пустого/своего шаблона.
 */
export const selectTotalBalance = createSelector(
  [selectData, selectActiveAccounts, selectPeriods],
  (data, accounts, periods): Money => {
    const ctx = buildAggContext(data)
    const last = periods.length ? periods[periods.length - 1] : '9999-12'
    return accounts.reduce(
      (sum, a) => sum + aggValue(ctx, { measure: 'balance', accountCode: a.code }, last),
      0n,
    )
  },
)

/** Чистая прибыль P&L (последний период) — null, если строки/периодов нет. */
export const selectPlNetProfit = createSelector([selectPlReport], (report): Money | null => {
  const row = report.rows.find((r) => r.code === 'net_profit')
  if (!row || row.values.length === 0) return null
  return row.values[row.values.length - 1]
})

/** Действующая формула статьи по коду (override поверх шаблонной) — для редактора. */
export const selectFormulaByCode = createSelector([selectData], (data) => {
  const overrideByCode = new Map(data.overrides.map((o) => [o.itemCode, o.formula]))
  const defaultByCode = new Map(data.items.map((it) => [it.code, it.formulaDefault ?? '']))
  return (code: string) => ({
    current: overrideByCode.get(code) ?? defaultByCode.get(code) ?? '',
    default: defaultByCode.get(code) ?? '',
    isOverridden: overrideByCode.has(code),
  })
})
