import { describe, it, expect } from 'vitest'
import { exportJson, importJson } from './json'
import { buildFixtureSnapshot } from './fixtures'
import { buildReport } from '../engine/report'

describe('JSON экспорт/импорт', () => {
  it('round-trip сохраняет данные и bigint-суммы', () => {
    const original = buildFixtureSnapshot()
    const restored = importJson(exportJson(original))
    expect(restored).toEqual(original)
    // суммы остаются bigint
    expect(typeof restored.operationLines[0].amount).toBe('bigint')
    expect(restored.openingBalances[0].amount).toBe(original.openingBalances[0].amount)
  })

  it('после round-trip отчёт считается идентично', () => {
    const original = buildFixtureSnapshot()
    const restored = importJson(exportJson(original))
    const a = buildReport(original).rows.find((r) => r.code === 'bal_total')!.values
    const b = buildReport(restored).rows.find((r) => r.code === 'bal_total')!.values
    expect(b).toEqual(a)
  })

  it('импорт мусора бросает понятную ошибку', () => {
    expect(() => importJson('{"foo":1}')).toThrow(/финансовых отчётов/)
    expect(() => importJson('не json')).toThrow()
  })
})
