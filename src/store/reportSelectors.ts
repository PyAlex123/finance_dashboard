// Производные селекторы: отчёт и контрольные суммы. Пересчитываются от данных.
// Ничего вычисляемого не хранится в сторе — только здесь, мемоизировано.

import { createSelector } from '@reduxjs/toolkit'
import { selectData, selectActiveAccounts, selectPeriods, selectLocale } from './selectors'
import { buildReport } from '../engine/report'
import { buildAutoCfItems } from '../engine/autoCf'
import { runChecks, allChecksOk } from '../engine/checks'
import { buildAggContext, aggValue } from '../engine/aggregate'
import type { Money } from '../domain/money'
import type { AggRule, Currency, Item } from '../domain/types'

// ДДС (форма cf). По умолчанию отчёт АВТОМАТИЧЕСКИЙ — статьи синтезируются из
// категорий/счетов (buildAutoCfItems). Ручной режим (cfAuto === false) берёт
// статьи из шаблона (data.items, form='cf'). В обоих случаях считает один движок.
export const selectCfAuto = createSelector([selectData], (data) => data.cfAuto !== false)

/** Действующие статьи ДДС: авто (из данных) или ручные (из шаблона). */
// selectLocale во входах — не украшение: авто-статьи ДДС порождает сам селектор,
// и без языка в ключе мемоизации reselect отдавал бы их на прежнем языке до
// первой правки данных. Ручные статьи (ветка else) — данные пользователя и от
// языка не зависят, но пересчёт ветки дешёвый.
export const selectEffectiveCfItems = createSelector(
  [selectData, selectCfAuto, selectLocale],
  (data, auto, locale): Item[] =>
    auto ? buildAutoCfItems(data, locale) : data.items.filter((it) => it.form === 'cf'),
)

export const selectReport = createSelector(
  [selectData, selectEffectiveCfItems],
  (data, cfItems) => buildReport(
    { ...data, items: [...data.items.filter((it) => it.form !== 'cf'), ...cfItems] },
    { form: 'cf' },
  ),
)

/** Код статьи → правило агрегата (для drill-down) по действующим статьям ДДС. */
export const selectCfAggRuleByCode = createSelector([selectEffectiveCfItems], (items) =>
  new Map<string, AggRule>(
    items.filter((it) => it.kind === 'agg' && it.aggRule).map((it) => [it.code, it.aggRule!]),
  ),
)

export const selectChecks = createSelector([selectData, selectLocale], (data, locale) =>
  runChecks(data, 'cf', locale),
)
export const selectChecksOk = createSelector([selectChecks], (checks) => allChecksOk(checks))

// P&L (форма pl)
export const selectPlReport = createSelector([selectData], (data) => buildReport(data, { form: 'pl' }))
export const selectPlChecks = createSelector([selectData, selectLocale], (data, locale) =>
  runChecks(data, 'pl', locale),
)

// Баланс (форма bs). Точка во времени; главная проверка — балансовое уравнение
// (строка bs_check == 0 по каждой дате). Отдельного набора runChecks не заводим —
// контроль встроен в отчёт строкой bs_check.
export const selectBsReport = createSelector([selectData], (data) => buildReport(data, { form: 'bs' }))

/** Сходится ли баланс на всех датах (Активы = Обязательства + Капитал). null — нет данных. */
export const selectBsBalanced = createSelector([selectBsReport], (report): boolean | null => {
  const row = report.rows.find((r) => r.code === 'bs_check')
  if (!row || row.values.length === 0) return null
  return row.values.every((v) => v === 0n)
})

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

export interface AccountBalance {
  id: string
  name: string
  currency: Currency
  /** Остаток в валюте счёта. */
  native: Money
  /** Остаток в базовой валюте (UZS), пересчитанный по курсу. */
  base: Money
}

/**
 * Остатки по всем активным счетам на конец последнего периода журнала:
 * в валюте счёта (native) и в базовой валюте (base, через агрегат с пересчётом).
 * Для полосы остатков журнала.
 */
export const selectAccountBalances = createSelector(
  [selectData, selectActiveAccounts, selectPeriods],
  (data, accounts, periods): AccountBalance[] => {
    const ctx = buildAggContext(data)
    const last = periods.length ? periods[periods.length - 1] : '9999-12'
    // Остаток в валюте счёта = начальный остаток + все проводки счёта (без пересчёта).
    const nativeById = new Map<string, Money>()
    for (const ob of data.openingBalances) {
      nativeById.set(ob.accountId, (nativeById.get(ob.accountId) ?? 0n) + ob.amount)
    }
    for (const l of data.operationLines) {
      nativeById.set(l.accountId, (nativeById.get(l.accountId) ?? 0n) + l.amount)
    }
    return accounts.map((a) => ({
      id: a.id,
      name: a.name,
      currency: a.currency,
      native: nativeById.get(a.id) ?? 0n,
      base: aggValue(ctx, { measure: 'balance', accountCode: a.code }, last),
    }))
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
