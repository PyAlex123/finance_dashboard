import { describe, it, expect } from 'vitest'
import { buildAggContext, aggValue } from './aggregate'
import { runChecks } from './checks'
import { buildEmptySnapshot } from '../data/fixtures'
import { fromMajor } from '../domain/money'
import type { DataSnapshot } from '../domain/types'

/** ДДС с одним UZS-счётом и одним USD-счётом. */
function dataWithUsd(opts: { withRate: boolean }): DataSnapshot {
  const s = buildEmptySnapshot()
  s.accounts = [
    { id: 'a-uzs', code: 'cash', name: 'Наличные', currency: 'UZS', order: 1, active: true },
    { id: 'a-usd', code: 'cash_usd', name: 'Наличные (USD)', currency: 'USD', order: 2, active: true },
  ]
  s.categories = [{ id: 'c1', code: 'sale', name: 'Продажи', direction: 'in', order: 1 }]
  if (opts.withRate) {
    s.rates = [{ id: 'r1', currency: 'USD', date: '2025-01-01', rate: fromMajor(12500) }]
  }
  s.operations = [
    { id: 'op1', date: '2025-02-10', type: 'income', description: 'В сумах', categoryId: 'c1' },
    { id: 'op2', date: '2025-02-11', type: 'income', description: 'В долларах', categoryId: 'c1' },
  ]
  s.operationLines = [
    { id: 'l1', operationId: 'op1', accountId: 'a-uzs', amount: fromMajor(1000000), currency: 'UZS' },
    { id: 'l2', operationId: 'op2', accountId: 'a-usd', amount: fromMajor(100), currency: 'USD' },
  ]
  return s
}

describe('пересчёт валют по курсу', () => {
  it('$100 при курсе 12 500 даёт 1 250 000 сум в агрегате прихода', () => {
    const ctx = buildAggContext(dataWithUsd({ withRate: true }))
    // 1 000 000 (сум) + 100$ × 12 500 = 1 000 000 + 1 250 000
    expect(aggValue(ctx, { measure: 'in' }, '2025-02')).toBe(fromMajor(2250000))
  })

  it('остаток валютного счёта пересчитывается в базовую валюту', () => {
    const ctx = buildAggContext(dataWithUsd({ withRate: true }))
    expect(aggValue(ctx, { measure: 'balance', accountCode: 'cash_usd' }, '2025-02')).toBe(fromMajor(1250000))
    expect(aggValue(ctx, { measure: 'balance', accountCode: 'cash' }, '2025-02')).toBe(fromMajor(1000000))
  })

  it('начальный остаток в валюте тоже пересчитывается', () => {
    const s = dataWithUsd({ withRate: true })
    s.openingBalances = [{ id: 'ob1', accountId: 'a-usd', date: '2025-01-01', amount: fromMajor(10) }]
    const ctx = buildAggContext(s)
    // 10$ × 12 500 = 125 000, плюс приход 1 250 000
    expect(aggValue(ctx, { measure: 'balance', accountCode: 'cash_usd' }, '2025-02')).toBe(fromMajor(1375000))
  })

  it('без курса сумма не теряется, но проверка «курсы заданы» не сходится', () => {
    const s = dataWithUsd({ withRate: false })
    const ctx = buildAggContext(s)
    expect(ctx.missingRates.length).toBeGreaterThan(0)
    // сумма взята без пересчёта — данные не пропадают молча
    expect(aggValue(ctx, { measure: 'in' }, '2025-02')).toBe(fromMajor(1000100))

    const rates = runChecks(s).find((c) => c.id === 'rates-available')!
    expect(rates.ok).toBe(false)
    expect(rates.severity).toBe('error')
  })

  it('при наличии курса проверка курсов сходится', () => {
    const rates = runChecks(dataWithUsd({ withRate: true })).find((c) => c.id === 'rates-available')!
    expect(rates.ok).toBe(true)
  })
})
