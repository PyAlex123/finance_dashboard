import { describe, it, expect } from 'vitest'
import { buildReport } from '../../engine/report'
import { buildBsExample } from '../../data/bsExample'
import { buildEmptySnapshot } from '../../data/fixtures'
import { fromMajor } from '../../domain/money'
import type { DataSnapshot } from '../../domain/types'

function snapshotWithBsExample(): DataSnapshot {
  const ex = buildBsExample()
  return {
    ...buildEmptySnapshot(),
    items: ex.items,
    cellValues: ex.cellValues,
    plPeriods: ex.periods,
  }
}

describe('Баланс — учебный пример', () => {
  it('итоги разделов и балансовое уравнение сходятся (Активы = Обязательства + Капитал)', () => {
    const report = buildReport(snapshotWithBsExample(), { form: 'bs' })
    expect(report.error).toBeUndefined()

    const val = (code: string) => {
      const row = report.rows.find((r) => r.code === code)!
      return row.values[row.values.length - 1]
    }

    expect(val('ca_total')).toBe(fromMajor(5_493_400))
    expect(val('nca_total')).toBe(fromMajor(12_500_000))
    expect(val('assets_total')).toBe(fromMajor(17_993_400))
    expect(val('liab_total')).toBe(fromMajor(8_317_900))
    expect(val('equity_total')).toBe(fromMajor(9_675_500))
    expect(val('passives_total')).toBe(fromMajor(17_993_400))
    // главная проверка баланса — ноль
    expect(val('bs_check')).toBe(0n)
  })

  it('одна дата-срез (точка во времени)', () => {
    const report = buildReport(snapshotWithBsExample(), { form: 'bs' })
    expect(report.periods).toEqual(['2025-03'])
  })
})
