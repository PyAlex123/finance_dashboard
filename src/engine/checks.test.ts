import { describe, it, expect } from 'vitest'
import { runChecks, allChecksOk } from './checks'
import { buildFixtureSnapshot } from '../data/fixtures'
import { fromMajor } from '../domain/money'
import type { DataSnapshot } from '../domain/types'

function checks(data: DataSnapshot) {
  const res = runChecks(data)
  return { res, by: (id: string) => res.find((r) => r.id === id)! }
}

describe('контрольные суммы', () => {
  it('на учебных данных все проверки сходятся', () => {
    const { res } = checks(buildFixtureSnapshot())
    expect(allChecksOk(res)).toBe(true)
    expect(res).toHaveLength(5)
  })

  it('1: несходящаяся переброска ломает тождество остатков', () => {
    const data = buildFixtureSnapshot()
    // переброска перестаёт неттоваться в ноль → приход−расход ≠ Δостаток в целом
    const transfer = data.operations.find((o) => o.type === 'transfer')!
    const line = data.operationLines.find((l) => l.operationId === transfer.id)!
    line.amount += fromMajor(100000)
    const { by } = checks(data)
    const c = by('balance-identity')
    expect(c.ok).toBe(false)
    expect(c.issues[0].discrepancy).toBe(fromMajor(100000))
  })

  it('2: переброска с ненулевой суммой', () => {
    const data = buildFixtureSnapshot()
    const transfer = data.operations.find((o) => o.type === 'transfer')!
    const line = data.operationLines.find((l) => l.operationId === transfer.id)!
    line.amount += fromMajor(1)
    const { by } = checks(data)
    expect(by('transfer-zero').ok).toBe(false)
    expect(by('transfer-zero').issues[0].discrepancy).toBe(fromMajor(1))
  })

  it('3: тип операции не совпадает с направлением категории', () => {
    const data = buildFixtureSnapshot()
    // сделаем расход с категорией дохода
    const exp = data.operations.find((o) => o.type === 'expense')!
    exp.categoryId = 'cat-sale'
    expect(checks(data).by('type-category').ok).toBe(false)
  })

  it('4: операция без проводок → предупреждение', () => {
    const data = buildFixtureSnapshot()
    const op = data.operations[5]
    data.operationLines = data.operationLines.filter((l) => l.operationId !== op.id)
    const c = checks(data).by('empty-zero')
    expect(c.ok).toBe(false)
    expect(c.severity).toBe('warning')
  })

  it('5: дата вне диапазона проекта → предупреждение', () => {
    const data = buildFixtureSnapshot()
    data.operations[0].date = '2024-11-05'
    const c = checks(data).by('date-range')
    expect(c.ok).toBe(false)
    expect(c.severity).toBe('warning')
  })
})
