import { describe, it, expect } from 'vitest'
import {
  periodOf,
  isValidPeriod,
  isValidDate,
  periodsInRange,
  derivePeriods,
  formatPeriod,
} from './periods'
import { operations } from '../data/fixtures'

describe('periods', () => {
  it('periodOf извлекает YYYY-MM', () => {
    expect(periodOf('2025-01-05')).toBe('2025-01')
    expect(periodOf('2025-12-31')).toBe('2025-12')
  })

  it('бросает на дате без года / некорректной', () => {
    expect(() => periodOf('01-05')).toThrow()
    expect(() => periodOf('2025-13-01')).toThrow()
    expect(() => periodOf('2025-00-01')).toThrow()
  })

  it('валидаторы', () => {
    expect(isValidPeriod('2025-03')).toBe(true)
    expect(isValidPeriod('2025-3')).toBe(false)
    expect(isValidPeriod('25-03')).toBe(false)
    expect(isValidDate('2025-03-15')).toBe(true)
    expect(isValidDate('2025-03-32')).toBe(false)
  })

  it('periodsInRange перечисляет месяцы включительно, через границу года', () => {
    expect(periodsInRange('2025-01', '2025-03')).toEqual(['2025-01', '2025-02', '2025-03'])
    expect(periodsInRange('2024-11', '2025-02')).toEqual(['2024-11', '2024-12', '2025-01', '2025-02'])
    expect(periodsInRange('2025-05', '2025-05')).toEqual(['2025-05'])
  })

  it('derivePeriods даёт упорядоченный уникальный набор из журнала', () => {
    expect(derivePeriods(operations)).toEqual(['2025-01', '2025-02', '2025-03'])
  })

  it('formatPeriod', () => {
    expect(formatPeriod('2025-01')).toBe('Январь')
    expect(formatPeriod('2025-03', { withYear: true })).toBe('Март 2025')
  })
})
