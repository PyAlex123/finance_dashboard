import { describe, it, expect } from 'vitest'
import { buildReport, rowTotal } from './report'
import { buildEmptySnapshot } from '../data/fixtures'
import { plTemplate } from '../data/plTemplate'
import { buildPlExample } from '../data/plExample'
import { runChecks, allChecksOk } from './checks'
import { fromMajor } from '../domain/money'
import type { DataSnapshot } from '../domain/types'

const maj = (arr: number[]) => arr.map((n) => fromMajor(n))

function plExampleData(): DataSnapshot {
  const s = buildEmptySnapshot()
  const ex = buildPlExample()
  s.templates = [...s.templates, ...plTemplate()]
  s.items = ex.items
  s.plPeriods = ex.periods
  s.cellValues = ex.cellValues
  return s
}

describe('P&L — совпадение с учебным Excel по строкам и периодам', () => {
  const rep = buildReport(plExampleData(), { form: 'pl' })
  const val = (code: string) => rep.rows.find((r) => r.code === code)!.values
  const total = (code: string) => rowTotal(rep.rows.find((r) => r.code === code)!)

  it('расчёт без ошибок, периоды янв–март', () => {
    expect(rep.error).toBeUndefined()
    expect(rep.periods).toEqual(['2025-01', '2025-02', '2025-03'])
  })

  it('выручка и итог', () => {
    expect(val('rev_group')).toEqual(maj([8000000, 8500000, 10200000]))
    expect(val('rev_total')).toEqual(maj([12700000, 14000000, 17300000]))
    expect(total('rev_total')).toBe(fromMajor(44000000))
  })

  it('себестоимость и валовая прибыль', () => {
    expect(val('cogs_total')).toEqual(maj([4445000, 4900000, 6055000]))
    expect(val('gross')).toEqual(maj([8255000, 9100000, 11245000]))
    expect(total('gross')).toBe(fromMajor(28600000))
  })

  it('операционные расходы и операционная прибыль', () => {
    expect(val('opex_total')).toEqual(maj([5650000, 6020000, 7160000]))
    expect(val('op_profit')).toEqual(maj([2605000, 3080000, 4085000]))
    expect(total('op_profit')).toBe(fromMajor(9770000))
  })

  it('прибыль до налога, налог 15%, чистая прибыль', () => {
    expect(val('pretax')).toEqual(maj([2455000, 2930000, 3935000]))
    expect(val('tax')).toEqual(maj([368250, 439500, 590250]))
    expect(val('net_profit')).toEqual(maj([2086750, 2490500, 3344750]))
    expect(total('net_profit')).toBe(fromMajor(7922000))
    expect(total('tax')).toBe(fromMajor(1398000))
  })

  it('контрольные проверки P&L сходятся (нет убытка/отриц. выручки)', () => {
    expect(allChecksOk(runChecks(plExampleData(), 'pl'))).toBe(true)
  })
})
