import { describe, it, expect } from 'vitest'
import {
  accounts,
  categories,
  operations,
  operationLines,
  openingBalances,
  buildFixtureSnapshot,
} from './fixtures'
import { sum } from '../domain/money'
import { isValidDate } from '../engine/periods'

describe('целостность фикстуры', () => {
  const accIds = new Set(accounts.map((a) => a.id))
  const catIds = new Set(categories.map((c) => c.id))
  const opIds = new Set(operations.map((o) => o.id))

  it('все проводки ссылаются на существующие счёт и операцию', () => {
    for (const l of operationLines) {
      expect(accIds.has(l.accountId)).toBe(true)
      expect(opIds.has(l.operationId)).toBe(true)
    }
  })

  it('все операции имеют валидную дату и (кроме переброски) категорию', () => {
    for (const op of operations) {
      expect(isValidDate(op.date)).toBe(true)
      expect(op.categoryId === null || catIds.has(op.categoryId)).toBe(true)
    }
  })

  it('у каждой операции есть хотя бы одна проводка', () => {
    for (const op of operations) {
      const lines = operationLines.filter((l) => l.operationId === op.id)
      expect(lines.length).toBeGreaterThan(0)
    }
  })

  it('переброска = две проводки, сумма = 0', () => {
    const transfers = operations.filter((o) => o.type === 'transfer')
    expect(transfers.length).toBe(4)
    for (const t of transfers) {
      const lines = operationLines.filter((l) => l.operationId === t.id)
      expect(lines.length).toBe(2)
      expect(sum(lines.map((l) => l.amount))).toBe(0n)
    }
  })

  it('начальные остатки: 4 счёта, итог 5 262 500 сум', () => {
    expect(openingBalances.length).toBe(4)
    expect(sum(openingBalances.map((o) => o.amount))).toBe(526250000n) // 5 262 500 × 100
  })

  it('снимок содержит все сущности', () => {
    const s = buildFixtureSnapshot()
    expect(s.accounts.length).toBe(4)
    expect(s.categories.length).toBe(9)
    expect(s.operations.length).toBe(39)
    expect(s.items.length).toBeGreaterThan(0)
    expect(s.templates.length).toBe(1)
  })
})
