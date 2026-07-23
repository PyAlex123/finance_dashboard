// Производные селекторы: отчёт и контрольные суммы. Пересчитываются от данных.
// Ничего вычисляемого не хранится в сторе — только здесь, мемоизировано.

import { createSelector } from '@reduxjs/toolkit'
import { selectData } from './selectors'
import { buildReport } from '../engine/report'
import { runChecks, allChecksOk } from '../engine/checks'

export const selectReport = createSelector([selectData], (data) => buildReport(data))
export const selectChecks = createSelector([selectData], (data) => runChecks(data))
export const selectChecksOk = createSelector([selectChecks], (checks) => allChecksOk(checks))

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
