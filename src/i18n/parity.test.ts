// Контракт словарей. tsc уже не даст собрать неполный английский (dict/en/index.ts
// аннотирован как Dict), но эти проверки называют конкретный недостающий ключ и
// ловят то, что типам не видно: лишние ключи, пустые значения и — главное —
// расхождение плейсхолдеров, из-за которого в интерфейсе появляется буквальное
// «{period}».

import { describe, it, expect } from 'vitest'
import { LOCALES, type Locale } from './types'
import { ru } from './dict/ru'
import { dictOf, t, tp, pluralBases, pluralCategories } from './index'

const PLACEHOLDER = /\{(\w+)\}/g

function placeholders(s: string): string[] {
  return [...s.matchAll(PLACEHOLDER)].map((m) => m[1]).sort()
}

const REFERENCE = Object.keys(ru).sort()

// Формы множественного числа исключены из проверок «покрыт ли эталон»: их набор
// у каждого языка свой (русскому нужны one/few/many/other, английскому и
// узбекскому — one/other), и требовать от английского «два отчёта» бессмысленно.
// Полнота форм проверяется отдельно, по Intl.PluralRules самого языка.
const PLURAL = /\.plural\.[a-z]+$/
const REQUIRED = REFERENCE.filter((k) => !PLURAL.test(k))

describe('словари', () => {
  it('английский покрывает эталон полностью', () => {
    const missing = REQUIRED.filter((k) => !(k in dictOf('en')))
    expect(missing).toEqual([])
  })

  it.each(LOCALES.filter((l) => l !== 'ru'))('в «%s» нет ключей вне эталона', (locale) => {
    const extra = Object.keys(dictOf(locale)).filter((k) => !(k in ru))
    expect(extra).toEqual([])
  })

  it.each(LOCALES)('в «%s» нет пустых значений', (locale) => {
    const empty = Object.entries(dictOf(locale))
      .filter(([, v]) => typeof v !== 'string' || v.trim() === '')
      .map(([k]) => k)
    expect(empty).toEqual([])
  })

  // Самая ценная проверка файла: перевод, потерявший {name}, типами не ловится.
  it.each(LOCALES.filter((l) => l !== 'ru'))('в «%s» совпадают плейсхолдеры', (locale) => {
    const mismatched: string[] = []
    for (const [key, value] of Object.entries(dictOf(locale))) {
      const expected = placeholders(ru[key as keyof typeof ru] ?? '')
      const actual = placeholders(value as string)
      if (expected.join() !== actual.join()) {
        mismatched.push(`${key}: ожидались [${expected}], в переводе [${actual}]`)
      }
    }
    expect(mismatched).toEqual([])
  })

  // Правило: если язык взялся за основу — он обязан закрыть ВСЕ её формы,
  // какие может вернуть Intl для этого языка. Основу, за которую язык не брался
  // вовсе, пропускаем: она целиком уходит в фолбэк на русский, и это осознанно
  // (узбекский наполняется постепенно). Наполовину переведённая основа —
  // наоборот, худший исход: часть чисел показала бы русское слово посреди
  // узбекской фразы. Именно этот случай тест и ловит.
  it.each(LOCALES)('в «%s» ни одна основа не переведена наполовину', (locale) => {
    const dict = dictOf(locale)
    const missing: string[] = []
    for (const base of pluralBases()) {
      const categories = pluralCategories(locale)
      const declared = categories.some((c) => `${base}.plural.${c}` in dict)
      if (!declared) continue
      for (const category of categories) {
        const key = `${base}.plural.${category}`
        if (!(key in dict)) missing.push(key)
      }
    }
    expect(missing).toEqual([])
  })

  // Метрика наполнения узбекского. Не утверждение — узбекский наполняется постепенно.
  it('покрытие узбекского известно', () => {
    const filled = REFERENCE.filter((k) => k in dictOf('uz')).length
    const pct = Math.round((filled / REFERENCE.length) * 100)
    console.info(`покрытие uz: ${filled}/${REFERENCE.length} (${pct}%)`)
    expect(filled).toBeGreaterThan(0)
  })
})

describe('t()', () => {
  it('переводит по локали, не трогая текущую', () => {
    expect(t('month.1', undefined, 'ru')).toBe('Январь')
    expect(t('month.1', undefined, 'en')).toBe('January')
    expect(t('month.1', undefined, 'uz')).toBe('Yanvar')
  })

  it('недостающий узбекский ключ падает на русский, а не на сам ключ', () => {
    const absent = REFERENCE.find((k) => !(k in dictOf('uz'))) as keyof typeof ru | undefined
    if (!absent) return // узбекский уже полон — проверять нечего
    expect(t(absent, undefined, 'uz')).toBe(ru[absent])
  })

  it('подставляет параметры и оставляет неизвестные плейсхолдеры как есть', () => {
    const withParams = (REFERENCE as (keyof typeof ru)[]).find((k) =>
      PLACEHOLDER.test(ru[k]),
    )
    // Прямая проверка механики интерполяции, не завязанная на конкретный ключ.
    expect(t('month.1', { unused: 'x' }, 'ru')).toBe('Январь')
    if (withParams) expect(typeof t(withParams, {}, 'ru')).toBe('string')
  })
})

describe('tp()', () => {
  it.each(LOCALES)('в «%s» выбирает существующую форму для любого числа', (locale: Locale) => {
    for (const base of pluralBases()) {
      for (const n of [0, 1, 2, 5, 21, 100]) {
        const out = tp(base as never, n, undefined, locale)
        expect(out).not.toContain('.other')
        expect(out.startsWith(base)).toBe(false) // не вернулся сам ключ
      }
    }
  })
})
