// Данные дашборда — реальные, из агрегатов журнала (не выдуманные числа макета).
// KPI, помесячные приход/расход/результат, остаток по периодам, расходы по
// категориям (донат), динамика остатка главного счёта.

import { createSelector } from '@reduxjs/toolkit'
import { selectData, selectActiveAccounts, selectPeriods } from '../../store/selectors'
import { buildAggContext, aggValue } from '../../engine/aggregate'
import { toMajorNumber, type Money } from '../../domain/money'
import { formatPeriod } from '../../engine/periods'

export interface ExpenseSlice {
  name: string
  amount: Money
  /** Доля в общих расходах, 0..1. */
  share: number
}

export interface DashboardData {
  periods: string[]
  monthLabels: string[]
  /** Помесячные суммы в мажорных единицах (для геометрии графиков). */
  inByPeriod: number[]
  outByPeriod: number[]
  resultByPeriod: number[]
  balanceByPeriod: number[]
  kpis: { totalIn: Money; totalOut: Money; result: Money; endingBalance: Money }
  expenses: ExpenseSlice[]
  mainAccount: { name: string; series: number[] } | null
  hasData: boolean
}

const EMPTY: DashboardData = {
  periods: [], monthLabels: [], inByPeriod: [], outByPeriod: [], resultByPeriod: [],
  balanceByPeriod: [], kpis: { totalIn: 0n, totalOut: 0n, result: 0n, endingBalance: 0n },
  expenses: [], mainAccount: null, hasData: false,
}

export const selectDashboard = createSelector(
  [selectData, selectActiveAccounts, selectPeriods],
  (data, accounts, periods): DashboardData => {
    if (periods.length === 0 || accounts.length === 0) return EMPTY
    const ctx = buildAggContext(data)

    const inByP = periods.map((p) => aggValue(ctx, { measure: 'in' }, p))
    const outByP = periods.map((p) => aggValue(ctx, { measure: 'out' }, p))
    const resultByP = periods.map((_, i) => inByP[i] - outByP[i])
    const balByP = periods.map((p) =>
      accounts.reduce((s, a) => s + aggValue(ctx, { measure: 'balance', accountCode: a.code }, p), 0n),
    )

    const totalIn = inByP.reduce((a, b) => a + b, 0n)
    const totalOut = outByP.reduce((a, b) => a + b, 0n)
    const endingBalance = balByP[balByP.length - 1] ?? 0n

    // Расходы по категориям (все периоды), сортировка по убыванию, топ-5 + «Прочее».
    const last = periods[periods.length - 1]
    const outCats = data.categories.filter((c) => c.direction === 'out')
    const catSums = outCats
      .map((c) => ({
        name: c.name,
        amount: periods.reduce((s, p) => s + aggValue(ctx, { measure: 'out', categoryCode: c.code }, p), 0n),
      }))
      .filter((c) => c.amount > 0n)
      .sort((a, b) => (a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0))

    const TOP = 5
    const top = catSums.slice(0, TOP)
    const restAmount = catSums.slice(TOP).reduce((s, c) => s + c.amount, 0n)
    const sliceList = restAmount > 0n ? [...top, { name: 'Прочее', amount: restAmount }] : top
    const denom = Number(totalOut) || 1
    const expenses: ExpenseSlice[] = sliceList.map((c) => ({
      name: c.name, amount: c.amount, share: Number(c.amount) / denom,
    }))

    // Главный счёт — с наибольшим остатком на конец; его остаток по периодам.
    let mainAccount: DashboardData['mainAccount'] = null
    if (accounts.length > 0) {
      const withBal = accounts.map((a) => ({
        name: a.name,
        end: aggValue(ctx, { measure: 'balance', accountCode: a.code }, last),
        code: a.code,
      }))
      const main = withBal.reduce((m, a) => (a.end > m.end ? a : m), withBal[0])
      mainAccount = {
        name: main.name,
        series: periods.map((p) => toMajorNumber(aggValue(ctx, { measure: 'balance', accountCode: main.code }, p))),
      }
    }

    return {
      periods,
      monthLabels: periods.map((p) => formatPeriod(p)),
      inByPeriod: inByP.map(toMajorNumber),
      outByPeriod: outByP.map(toMajorNumber),
      resultByPeriod: resultByP.map(toMajorNumber),
      balanceByPeriod: balByP.map(toMajorNumber),
      kpis: { totalIn, totalOut, result: totalIn - totalOut, endingBalance },
      expenses,
      mainAccount,
      hasData: true,
    }
  },
)
