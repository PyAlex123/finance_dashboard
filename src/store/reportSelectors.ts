// Производные селекторы: отчёт и контрольные суммы. Пересчитываются от данных.
// Ничего вычисляемого не хранится в сторе — только здесь, мемоизировано.

import { createSelector } from '@reduxjs/toolkit'
import { selectData } from './selectors'
import { buildReport } from '../engine/report'
import { runChecks, allChecksOk } from '../engine/checks'

// ДДС (форма cf)
export const selectReport = createSelector([selectData], (data) => buildReport(data, { form: 'cf' }))
export const selectChecks = createSelector([selectData], (data) => runChecks(data, 'cf'))
export const selectChecksOk = createSelector([selectChecks], (checks) => allChecksOk(checks))

// P&L (форма pl)
export const selectPlReport = createSelector([selectData], (data) => buildReport(data, { form: 'pl' }))
export const selectPlChecks = createSelector([selectData], (data) => runChecks(data, 'pl'))

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
