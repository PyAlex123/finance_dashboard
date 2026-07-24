import { describe, it, expect } from 'vitest'
import { slugify, uniqueCode, autoCode, isValidCode } from './codes'

describe('коды справочников', () => {
  it('slugify транслитерирует и чистит', () => {
    expect(slugify('Расчётный счёт')).toBe('raschetnyy_schet')
    expect(slugify('Наличные')).toBe('nalichnye')
    expect(slugify('Р/С')).toBe('r_s')
    expect(slugify('Карта UZS')).toBe('karta_uzs')
    expect(slugify('  ***  ')).toBe('item') // не бывает пустым
  })

  it('uniqueCode добавляет суффикс при конфликте', () => {
    expect(uniqueCode('cash', [])).toBe('cash')
    expect(uniqueCode('cash', ['cash'])).toBe('cash_2')
    expect(uniqueCode('cash', ['cash', 'cash_2'])).toBe('cash_3')
  })

  it('autoCode = slugify + уникальность', () => {
    expect(autoCode('Аренда', ['arenda'])).toBe('arenda_2')
  })

  it('isValidCode', () => {
    expect(isValidCode('cash_2')).toBe(true)
    expect(isValidCode('касса')).toBe(false)
    expect(isValidCode('')).toBe(false)
    expect(isValidCode('a b')).toBe(false)
  })
})
