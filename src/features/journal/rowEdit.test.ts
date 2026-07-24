import { describe, it, expect } from 'vitest'
import { buildOperationUpdate, formatDateLabel, normalizeSign, todayIso, type RowSnapshot } from './rowEdit'
import { fromMajor } from '../../domain/money'
import type { Account, Category } from '../../domain/types'

const accounts: Account[] = [
  { id: 'a1', code: 'cash', name: 'Наличные', currency: 'UZS', order: 1, active: true },
  { id: 'a2', code: 'usd', name: 'Валютный', currency: 'USD', order: 2, active: true },
]
const categories: Category[] = [
  { id: 'c-in', code: 'sale', name: 'Продажи', direction: 'in', order: 1 },
  { id: 'c-out', code: 'rent', name: 'Аренда', direction: 'out', order: 2 },
]

const base: RowSnapshot = {
  id: 'op1', date: '2025-05-01', type: 'expense', description: 'Тест',
  categoryId: 'c-out', note: '', amounts: {},
}

describe('normalizeSign', () => {
  it('приход +, расход −, переброска как есть', () => {
    expect(normalizeSign('income', fromMajor(-100))).toBe(fromMajor(100))
    expect(normalizeSign('expense', fromMajor(100))).toBe(fromMajor(-100))
    expect(normalizeSign('transfer', fromMajor(-100))).toBe(fromMajor(-100))
  })
})

describe('buildOperationUpdate', () => {
  it('расход: введённое положительное число становится отрицательной проводкой', () => {
    const { lines } = buildOperationUpdate(base, { amounts: { a1: fromMajor(500) } }, accounts, categories)
    expect(lines).toHaveLength(1)
    expect(lines[0].amount).toBe(fromMajor(-500))
    expect(lines[0].currency).toBe('UZS')
  })

  it('приход: сумма положительная', () => {
    const row = { ...base, type: 'income' as const, categoryId: 'c-in' }
    const { lines } = buildOperationUpdate(row, { amounts: { a1: fromMajor(500) } }, accounts, categories)
    expect(lines[0].amount).toBe(fromMajor(500))
  })

  it('переброска: минус и плюс в двух колонках дают сумму 0', () => {
    const row = { ...base, type: 'transfer' as const, categoryId: null }
    const { lines } = buildOperationUpdate(
      row, { amounts: { a1: fromMajor(-300), a2: fromMajor(300) } }, accounts, categories,
    )
    expect(lines).toHaveLength(2)
    expect(lines.reduce((a, l) => a + l.amount, 0n)).toBe(0n)
  })

  it('нулевая сумма убирает проводку', () => {
    const row = { ...base, amounts: { a1: fromMajor(-500) } }
    const { lines } = buildOperationUpdate(row, { amounts: { a1: 0n } }, accounts, categories)
    expect(lines).toHaveLength(0)
  })

  it('валюта проводки берётся из счёта', () => {
    const { lines } = buildOperationUpdate(base, { amounts: { a2: fromMajor(100) } }, accounts, categories)
    expect(lines[0].currency).toBe('USD')
  })

  it('смена типа пересчитывает знаки и сбрасывает неподходящую категорию', () => {
    const row = { ...base, amounts: { a1: fromMajor(-500) } } // расход, категория out
    const { operation, lines } = buildOperationUpdate(row, { type: 'income' }, accounts, categories)
    expect(operation.type).toBe('income')
    expect(lines[0].amount).toBe(fromMajor(500))
    expect(operation.categoryId).toBeNull() // категория расхода не подходит приходу
  })

  it('правка даты/описания/примечания сохраняется', () => {
    const { operation } = buildOperationUpdate(
      base, { date: '2025-06-02', description: 'Новое', note: 'коммент' }, accounts, categories,
    )
    expect(operation.date).toBe('2025-06-02')
    expect(operation.description).toBe('Новое')
    expect(operation.note).toBe('коммент')
  })
})

describe('formatDateLabel — слово «Сегодня» в ячейке даты', () => {
  it('сегодняшняя дата показывается словом', () => {
    expect(formatDateLabel(todayIso())).toBe('Сегодня')
  })

  it('вчерашняя — «Вчера», остальные — как есть', () => {
    const y = new Date()
    y.setDate(y.getDate() - 1)
    const p = (n: number) => String(n).padStart(2, '0')
    const yIso = `${y.getFullYear()}-${p(y.getMonth() + 1)}-${p(y.getDate())}`
    expect(formatDateLabel(yIso)).toBe('Вчера')
    expect(formatDateLabel('2025-01-15')).toBe('2025-01-15')
    expect(formatDateLabel('')).toBe('')
  })
})

describe('todayIso', () => {
  it('возвращает локальную дату в формате YYYY-MM-DD', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const d = new Date()
    expect(todayIso()).toBe(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    )
  })
})
