// Набор локалей продукта. Русский — язык по умолчанию: на нём написан весь исходный
// продукт, и он остаётся эталоном, к которому сводится фолбэк при нехватке перевода.

export const LOCALES = ['ru', 'en', 'uz'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'ru'

/**
 * Языки, которые ПРЕДЛАГАЮТСЯ пользователю: переключатель показывает только их,
 * и только из них выбирается язык при автоопределении.
 *
 * Узбекский намеренно не здесь. Словарь uz заполнен частично, и всё
 * недостающее честно откатывается на русский — но человеку это выглядит как
 * наполовину переведённый интерфейс, что хуже, чем русский целиком. Как только
 * dict/uz будет доведён носителем языка, достаточно вписать сюда 'uz'.
 *
 * Важно: это НЕ отключает узбекский в остальном коде. LOCALES по-прежнему
 * перечисляет все словари, и на них по-прежнему опираются проверка чётности
 * словарей, контракт xlsx и разбор подписей типов операций (journalRows.
 * typeFromLabel обязан понимать все языки, а не только предложенные).
 */
export const OFFERED_LOCALES = ['ru', 'en'] as const satisfies readonly Locale[]

export function isOffered(v: unknown): v is Locale {
  return typeof v === 'string' && (OFFERED_LOCALES as readonly string[]).includes(v)
}

/** Параметры подстановки: в строке словаря они выглядят как {name}. */
export type Params = Record<string, string | number>

/** Теги BCP-47 для Intl.* — единственное место, где локали превращаются в теги. */
export const BCP47: Record<Locale, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  uz: 'uz-UZ',
}

/** Подписи языков в переключателе. Не переводятся: язык всегда назван собой. */
export const LOCALE_LABEL: Record<Locale, string> = {
  ru: 'RU',
  en: 'EN',
  uz: 'UZ',
}

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && (LOCALES as readonly string[]).includes(v)
}
