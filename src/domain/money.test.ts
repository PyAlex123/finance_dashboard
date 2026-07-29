import { describe, it, expect } from 'vitest'
import {
  fromMajor,
  parseMoney,
  formatMoney,
  toMajorNumber,
  add,
  sub,
  sum,
  convertUsdToUzs,
  groupThousands,
} from './money'

describe('money — минорные единицы bigint', () => {
  it('fromMajor переводит сумы в тийины', () => {
    expect(fromMajor(500000)).toBe(50000000n)
    expect(fromMajor('1200000')).toBe(120000000n)
    expect(fromMajor(0)).toBe(0n)
  })

  it('parseMoney разбирает разделители, запятую и минус', () => {
    expect(parseMoney('1 200 000')).toBe(120000000n)
    expect(parseMoney('-85 000')).toBe(-8500000n)
    expect(parseMoney('1200000,50')).toBe(120000050n)
    expect(parseMoney('-')).toBe(0n)
    expect(parseMoney('—')).toBe(0n)
  })

  it('parseMoney бросает на мусоре', () => {
    expect(() => parseMoney('abc')).toThrow()
  })

  it('formatMoney возвращает сумы с разрядами и знаком минус U+2212', () => {
    expect(formatMoney(120000000n)).toBe('1 200 000')
    expect(formatMoney(-8500000n)).toBe('−85 000')
    expect(formatMoney(120000050n)).toBe('1 200 000,50')
    expect(formatMoney(50000000n, { suffix: 'сум' })).toBe('500 000 сум')
    expect(formatMoney(120000000n, { sign: true })).toBe('+1 200 000')
  })

  it('арифметика точная, без float-погрешности', () => {
    // 0.1 + 0.2 в сумах = 0.30, а не 0.30000000000000004
    const a = fromMajor('0.10')
    const b = fromMajor('0.20')
    expect(add(a, b)).toBe(fromMajor('0.30'))
    expect(formatMoney(add(a, b))).toBe('0,30')
  })

  it('sum и sub складывают журнал без потерь', () => {
    const lines = [fromMajor(650000), fromMajor(-400000), fromMajor(-85000)]
    expect(sum(lines)).toBe(fromMajor(165000))
    expect(sub(fromMajor(500000), fromMajor(85000))).toBe(fromMajor(415000))
  })

  it('toMajorNumber для процентов/графиков', () => {
    expect(toMajorNumber(fromMajor(7150000))).toBe(7150000)
  })

  it('convertUsdToUzs по курсу 12500 с округлением', () => {
    // $52 * 12500 = 650000 сум
    const usd = fromMajor(52) // 5200 минорных USD
    const rate = fromMajor(12500) // 1 250 000 минорных UZS за 1 USD
    expect(convertUsdToUzs(usd, rate)).toBe(fromMajor(650000))
  })

  it('groupThousands расставляет пробелы по разрядам при вводе', () => {
    expect(groupThousands('650000')).toBe('650 000')
    expect(groupThousands('1200000')).toBe('1 200 000')
    expect(groupThousands('650 000')).toBe('650 000') // повторный прогон стабилен
    expect(groupThousands('')).toBe('')
    expect(groupThousands('0')).toBe('0')
    expect(groupThousands('00123')).toBe('123') // ведущие нули убираем
    expect(groupThousands('-85000')).toBe('-85 000')
  })

  it('groupThousands сохраняет дробную часть и совместим с parseMoney', () => {
    expect(groupThousands('1200000,5')).toBe('1 200 000,5')
    expect(groupThousands('1200000.50')).toBe('1 200 000.50')
    expect(groupThousands('12,999')).toBe('12,99') // не больше 2 знаков
    // главное: результат по-прежнему корректно разбирается
    expect(parseMoney(groupThousands('650000'))).toBe(fromMajor(650000))
    expect(parseMoney(groupThousands('1200000,50'))).toBe(fromMajor('1200000.50'))
  })
})
