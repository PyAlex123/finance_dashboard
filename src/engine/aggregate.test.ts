import { describe, it, expect } from 'vitest'
import { buildAggContext, aggByPeriods } from './aggregate'
import { buildFixtureSnapshot } from '../data/fixtures'
import { fromMajor } from '../domain/money'

const data = buildFixtureSnapshot()
const ctx = buildAggContext(data)
const P = ['2025-01', '2025-02', '2025-03']
const maj = (arr: number[]) => arr.map((n) => fromMajor(n))

describe('агрегаты журнала vs Excel', () => {
  it('общий приход по периодам', () => {
    expect(aggByPeriods(ctx, { measure: 'in' }, P)).toEqual(maj([2900000, 2450000, 3950000]))
  })

  it('общий расход (магнитуда) по периодам', () => {
    expect(aggByPeriods(ctx, { measure: 'out' }, P)).toEqual(maj([3050000, 3239000, 4688000]))
  })

  it('доходы по категориям', () => {
    expect(aggByPeriods(ctx, { measure: 'in', categoryCode: 'sale' }, P)).toEqual(maj([2600000, 1950000, 2600000]))
    expect(aggByPeriods(ctx, { measure: 'in', categoryCode: 'consult' }, P)).toEqual(maj([300000, 500000, 1200000]))
    expect(aggByPeriods(ctx, { measure: 'in', categoryCode: 'other_in' }, P)).toEqual(maj([0, 0, 150000]))
  })

  it('расходы по категориям', () => {
    expect(aggByPeriods(ctx, { measure: 'out', categoryCode: 'salary' }, P)).toEqual(maj([950000, 950000, 1150000]))
    expect(aggByPeriods(ctx, { measure: 'out', categoryCode: 'rent' }, P)).toEqual(maj([1500000, 1500000, 1500000]))
    expect(aggByPeriods(ctx, { measure: 'out', categoryCode: 'marketing' }, P)).toEqual(maj([320000, 480000, 650000]))
    expect(aggByPeriods(ctx, { measure: 'out', categoryCode: 'office' }, P)).toEqual(maj([85000, 75000, 1120000]))
    expect(aggByPeriods(ctx, { measure: 'out', categoryCode: 'tax' }, P)).toEqual(maj([195000, 234000, 268000]))
  })

  it('остатки по счетам на конец периода (переброски не меняют итог)', () => {
    expect(aggByPeriods(ctx, { measure: 'balance', accountCode: 'cash_uzs' }, P)).toEqual(maj([665000, 2565000, 1445000]))
    expect(aggByPeriods(ctx, { measure: 'balance', accountCode: 'card_uzs' }, P)).toEqual(maj([1230000, 225000, 525000]))
    expect(aggByPeriods(ctx, { measure: 'balance', accountCode: 'card_usd' }, P)).toEqual(maj([2212500, 962500, 1612500]))
    expect(aggByPeriods(ctx, { measure: 'balance', accountCode: 'settle' }, P)).toEqual(maj([1005000, 571000, 3000]))
  })

  it('сальдо (net) = приход − расход', () => {
    expect(aggByPeriods(ctx, { measure: 'net' }, P)).toEqual(maj([-150000, -789000, -738000]))
  })
})
