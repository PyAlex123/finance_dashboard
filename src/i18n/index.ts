// Точка входа i18n: перевод строки по ключу.
//
// Своя реализация вместо i18next — сознательно, тем же доводом, что и минимальный
// роутер в src/routes.ts: три словаря в одном бандле не окупают библиотеку.
// Плюрализацию даёт Intl.PluralRules, интерполяция здесь занимает пять строк,
// а типизация ключей (type Key = keyof typeof ru) достаётся бесплатно.

import { BCP47, DEFAULT_LOCALE, type Locale, type Params } from './types'
import { getLocale } from './locale'
import { ru, type Dict, type Key } from './dict/ru'
import { en } from './dict/en'
import { uz } from './dict/uz'

export type { Locale, Params } from './types'
export type { Key, Dict } from './dict/ru'
export { LOCALES, OFFERED_LOCALES, DEFAULT_LOCALE, LOCALE_LABEL, isLocale, isOffered } from './types'
export { getLocale, setLocale, subscribeLocale, setLocaleForTests } from './locale'

const DICTS: Record<Locale, Dict | Partial<Dict>> = { ru, en, uz }

const PLACEHOLDER = /\{(\w+)\}/g

function interpolate(template: string, params?: Params): string {
  if (!params) return template
  return template.replace(PLACEHOLDER, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  )
}

/**
 * Перевод по ключу. Ключ типизирован — опечатка не компилируется.
 *
 * Фолбэк: локаль → русский эталон → сам ключ. До третьей ступени дойти нельзя:
 * Dict исчерпывающий для en, а ru и есть источник ключей. Она стоит на случай
 * данных из старого кеша и делает поведение предсказуемым вместо undefined.
 */
export function t(key: Key, params?: Params, locale: Locale = getLocale()): string {
  const raw = DICTS[locale]?.[key] ?? ru[key] ?? key
  return interpolate(raw, params)
}

/**
 * Ключи-основы для tp().
 *
 * Формы множественного числа помечаются явным сегментом `.plural.`:
 * 'refs.count.plural.one', '…few', '…many', '…other'. Маркер нужен именно
 * явный — по одному лишь окончанию `.other` основу не отличить от обычного
 * ключа со значением «Прочее» (dashboard.other), и проверка полноты форм
 * начинала требовать от него несуществующих «одна/две штуки».
 */
// Через параметр-посредник, а не `Key extends ...` напрямую: условные типы
// распределяются по объединению только когда проверяется ГОЛЫЙ параметр типа.
// Записанное в лоб выражение проверило бы объединение целиком, не нашло бы
// совпадения и молча свернулось в never — tp() перестал бы принимать что-либо.
type PluralBaseOf<K> = K extends `${infer B}.plural.other` ? B : never

export type PluralKey = PluralBaseOf<Key>

/** Полный набор форм, которые обязаны быть у каждой основы в данной локали. */
export function pluralCategories(locale: Locale): string[] {
  const rules = new Intl.PluralRules(BCP47[locale])
  return [...new Set([0, 1, 2, 3, 5, 11, 21, 100].map((n) => rules.select(n)))]
}

/** Основы множественного числа, объявленные в эталонном словаре. */
export function pluralBases(): string[] {
  return Object.keys(ru)
    .filter((k) => k.endsWith('.plural.other'))
    .map((k) => k.slice(0, -'.plural.other'.length))
}

/**
 * Перевод с учётом числа: tp('refs.count', 5) → 'refs.count.plural.many' (ru).
 * Категорию выбирает Intl.PluralRules — русскому нужны one/few/many,
 * английскому one/other. Число доступно в строке как {count}.
 */
export function tp(
  base: PluralKey,
  count: number,
  params?: Params,
  locale: Locale = getLocale(),
): string {
  const category = new Intl.PluralRules(BCP47[locale]).select(count)
  const key = `${base}.plural.${category}` as Key
  const fallback = `${base}.plural.other` as Key
  const dict = DICTS[locale] ?? {}
  const chosen = key in dict || key in ru ? key : fallback
  return t(chosen, { count, ...params }, locale)
}

/** Словарь локали — для тестов чётности и метрики покрытия. */
export function dictOf(locale: Locale): Dict | Partial<Dict> {
  return DICTS[locale] ?? DICTS[DEFAULT_LOCALE]
}
