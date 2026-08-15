// Базовые селекторы. Производные (отчёт, контрольные суммы) добавляются в Шагах 8–9.

import { createSelector } from '@reduxjs/toolkit'
import type { RootState } from './index'
import { derivePeriods } from '../engine/periods'

export const selectData = (s: RootState) => s.data

/**
 * Текущий язык. Входит в мемоизацию тех селекторов, которые сами порождают текст
 * (авто-статьи ДДС, контрольные суммы, подписи периодов) — иначе reselect отдаст
 * старый язык, пока не изменятся данные. См. комментарий в store/uiSlice.ts.
 */
export const selectLocale = (s: RootState) => s.ui.locale
export const selectAccounts = (s: RootState) => s.data.accounts
export const selectCategories = (s: RootState) => s.data.categories
export const selectOperations = (s: RootState) => s.data.operations
export const selectOperationLines = (s: RootState) => s.data.operationLines
export const selectOpeningBalances = (s: RootState) => s.data.openingBalances
export const selectItems = (s: RootState) => s.data.items
export const selectOverrides = (s: RootState) => s.data.overrides

/** Активные счета в порядке отображения — колонки таблицы строятся отсюда. */
export const selectActiveAccounts = createSelector([selectAccounts], (accounts) =>
  accounts.filter((a) => a.active).sort((a, b) => a.order - b.order),
)

export const selectAccountById = createSelector([selectAccounts], (accounts) =>
  new Map(accounts.map((a) => [a.id, a])),
)

export const selectCategoryById = createSelector([selectCategories], (categories) =>
  new Map(categories.map((c) => [c.id, c])),
)

/** Периоды проекта, выведенные из дат журнала. */
export const selectPeriods = createSelector([selectOperations], (ops) => derivePeriods(ops))
