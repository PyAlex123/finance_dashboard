// Контракт формата файла.
//
// Имя скрытого листа «Данные» — не подпись в интерфейсе, а часть формата: его
// пишет exportWorkbook и по нему же ищет importXlsx. Переименование сделало бы
// неимпортируемыми все ранее выгруженные пользователями файлы, причём молча —
// обычные тесты round-trip этого не заметят, ведь они пишут и читают одной и той
// же версией кода. Поэтому имя проверяется буквально и под каждой локалью.

import { describe, it, expect, afterEach } from 'vitest'
import { LOCALES } from '../i18n/types'
import { setLocaleForTests } from '../i18n/locale'
import { exportWorkbook, exportXlsx, importXlsx } from './xlsx'
import { buildFixtureSnapshot } from './fixtures'

const SNAPSHOT_SHEET = 'Данные'

afterEach(() => setLocaleForTests('ru'))

describe('контракт листа-снимка', () => {
  it.each(LOCALES)('в локали «%s» лист называется «Данные»', (locale) => {
    setLocaleForTests(locale)
    const wb = exportWorkbook(buildFixtureSnapshot())
    expect(wb.SheetNames).toContain(SNAPSHOT_SHEET)
  })

  it.each(LOCALES)('в локали «%s» лист-снимок скрыт', (locale) => {
    setLocaleForTests(locale)
    const wb = exportWorkbook(buildFixtureSnapshot())
    const idx = wb.SheetNames.indexOf(SNAPSHOT_SHEET)
    expect(wb.Workbook?.Sheets?.[idx]?.Hidden).toBe(1)
  })

  // Главное следствие контракта: файл, выгруженный в одной локали, обязан
  // открываться в другой. Пользователь меняет язык между экспортом и импортом.
  it('файл из английской локали читается в русской', () => {
    const source = buildFixtureSnapshot()
    setLocaleForTests('en')
    const buf = exportXlsx(source)
    setLocaleForTests('ru')
    const restored = importXlsx(buf)
    expect(restored).toEqual(source)
  })

  it('файл из русской локали читается в узбекской', () => {
    const source = buildFixtureSnapshot()
    setLocaleForTests('ru')
    const buf = exportXlsx(source)
    setLocaleForTests('uz')
    expect(importXlsx(buf)).toEqual(source)
  })

  it('файл без листа-снимка отвергается понятной ошибкой', () => {
    const empty = new ArrayBuffer(0)
    expect(() => importXlsx(empty)).toThrow()
  })
})
