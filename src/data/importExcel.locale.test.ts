// Разбор чужих Excel переживает добавление локальных альтернатив.
//
// Главный риск фазы: регулярки в importExcel.ts выглядят как подписи, но это
// логика разбора — они сравниваются с содержимым файлов, которые пользователь
// уже сдал. Замена русского паттерна на английский сделала бы такие файлы
// нечитаемыми молча: импорт не упал бы, а собрал бы структурно другой отчёт.
// Поэтому здесь проверяется, что альтернативы СТРОГО АДДИТИВНЫ.

import { describe, it, expect, afterEach } from 'vitest'
import { detectDdsMapping, parseDdsJournal } from './importExcel'
import { parsePeriodLabel } from '../engine/periods'
import { LOCALES } from '../i18n/types'
import { setLocaleForTests } from '../i18n/locale'

afterEach(() => setLocaleForTests('ru'))

// Та же сетка, что в importExcel.test.ts — эталон «как было до i18n».
const GRID_RU = [
  ['Дата', 'Тип', 'Описание', 'Категория', 'Наличные', 'Карта'],
  ['2025-01-05', 'Приход', 'Оплата курса', 'Продажи', 650000, ''],
  ['2025-01-15', 'Расход', 'Аренда', 'Аренда', '', -1500000],
  ['2025-01-22', 'Переброска', 'В банк', '', -400000, 400000],
]

const GRID_EN = [
  ['Date', 'Type', 'Description', 'Category', 'Cash', 'Card'],
  ['2025-01-05', 'Income', 'Course payment', 'Sales', 650000, ''],
  ['2025-01-15', 'Expense', 'Rent', 'Rent', '', -1500000],
  ['2025-01-22', 'Transfer', 'To the bank', '', -400000, 400000],
]

const GRID_UZ = [
  ['Sana', 'Turi', 'Tavsif', 'Kategoriya', 'Naqd', 'Karta'],
  ['2025-01-05', 'Kirim', 'Kurs toʻlovi', 'Sotuv', 650000, ''],
  ['2025-01-15', 'Chiqim', 'Ijara', 'Ijara', '', -1500000],
  ['2025-01-22', 'Oʻtkazma', 'Bankka', '', -400000, 400000],
]

describe('русский разбор не изменился', () => {
  it('сопоставление столбцов то же самое', () => {
    const m = detectDdsMapping(GRID_RU)
    expect(m.headerRow).toBe(0)
    expect(m.dateCol).toBe(0)
    expect(m.typeCol).toBe(1)
    expect(m.descCol).toBe(2)
    expect(m.categoryCol).toBe(3)
    expect(m.accountCols.map((a) => a.name)).toEqual(['Наличные', 'Карта'])
  })

  it('операции и типы распознаны как прежде', () => {
    const parsed = parseDdsJournal(GRID_RU, detectDdsMapping(GRID_RU))
    expect(parsed.operations.map((o) => o.type)).toEqual(['income', 'expense', 'transfer'])
    expect(parsed.accounts.map((a) => a.name)).toEqual(['Наличные', 'Карта'])
  })

  // Язык интерфейса не должен влиять на разбор: файл читают тем же кодом,
  // независимо от того, на каком языке пользователь сейчас смотрит приложение.
  it.each(LOCALES)('в локали «%s» русский файл разбирается одинаково', (locale) => {
    setLocaleForTests('ru')
    const reference = parseDdsJournal(GRID_RU, detectDdsMapping(GRID_RU))
    setLocaleForTests(locale)
    const actual = parseDdsJournal(GRID_RU, detectDdsMapping(GRID_RU))
    expect(actual.operations.map((o) => o.type)).toEqual(reference.operations.map((o) => o.type))
    expect(actual.accounts.map((a) => a.name)).toEqual(reference.accounts.map((a) => a.name))
  })
})

describe('английский и узбекский файлы тоже разбираются', () => {
  it('английские заголовки и типы', () => {
    const m = detectDdsMapping(GRID_EN)
    expect(m.dateCol).toBe(0)
    expect(m.typeCol).toBe(1)
    expect(m.descCol).toBe(2)
    expect(m.categoryCol).toBe(3)
    const parsed = parseDdsJournal(GRID_EN, m)
    expect(parsed.operations.map((o) => o.type)).toEqual(['income', 'expense', 'transfer'])
  })

  it('узбекские заголовки и типы', () => {
    const m = detectDdsMapping(GRID_UZ)
    expect(m.dateCol).toBe(0)
    expect(m.typeCol).toBe(1)
    const parsed = parseDdsJournal(GRID_UZ, m)
    expect(parsed.operations.map((o) => o.type)).toEqual(['income', 'expense', 'transfer'])
  })
})

describe('разбор названий месяцев', () => {
  it.each([
    ['январь 2025', '2025-01'],
    ['Янв 2025', '2025-01'],
    ['January 2025', '2025-01'],
    ['Jan 2025', '2025-01'],
    ['yanvar 2025', '2025-01'],
    ['декабрь 2025', '2025-12'],
    ['December 2025', '2025-12'],
    ['dekabr 2025', '2025-12'],
  ])('«%s» → %s', (label, expected) => {
    expect(parsePeriodLabel(label, 2025)).toBe(expected)
  })

  // Сторож порядка MONTH_STEMS: «июль» не должен съедаться основой «июн».
  it('июнь и июль по-прежнему различаются', () => {
    expect(parsePeriodLabel('июнь', 2025)).toBe('2025-06')
    expect(parsePeriodLabel('июль', 2025)).toBe('2025-07')
    expect(parsePeriodLabel('июня', 2025)).toBe('2025-06')
    expect(parsePeriodLabel('июля', 2025)).toBe('2025-07')
  })

  it('март и май не путаются с добавленными основами', () => {
    expect(parsePeriodLabel('March 2025', 2025)).toBe('2025-03')
    expect(parsePeriodLabel('May 2025', 2025)).toBe('2025-05')
    expect(parsePeriodLabel('Mart 2025', 2025)).toBe('2025-03')
  })

  it('нераспознанное остаётся нераспознанным', () => {
    expect(parsePeriodLabel('квартал', 2025)).toBeNull()
    expect(parsePeriodLabel('', 2025)).toBeNull()
  })
})
