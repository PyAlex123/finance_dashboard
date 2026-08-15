// Определение языка при первом визите. Приоритет: явный выбор пользователя →
// язык клиента Telegram → язык браузера → русский.

import { DEFAULT_LOCALE, isLocale, isOffered, type Locale } from './types'

/** Ключ в localStorage. Рядом с существующим fin.username (features/session/session.ts). */
export const LANG_KEY = 'fin.lang'

/**
 * Рабочее localStorage или null. Проба записью повторяет приём из session.ts:
 * в приватном режиме Safari getItem есть, а setItem бросает.
 */
export function langStorage(): Storage | null {
  try {
    const s = globalThis.localStorage
    const probe = '__fin_lang_probe__'
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    return null
  }
}

/**
 * Сохранённый выбор пользователя, если он был.
 *
 * Здесь принимается ЛЮБОЙ известный язык, даже ещё не предложенный в
 * переключателе: если человек (или тестировщик) уже выбрал узбекский, отбирать
 * у него выбор при следующем заходе нельзя.
 */
function stored(): Locale | null {
  const v = langStorage()?.getItem(LANG_KEY)
  return isLocale(v) ? v : null
}

/**
 * Язык клиента Telegram. Мини-приложение открывается прямо в мессенджере, и его
 * язык — куда более точная догадка, чем язык браузера-обёртки.
 */
function fromTelegram(): Locale | null {
  if (typeof window === 'undefined') return null
  const code = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code
  return normalize(code)
}

function fromNavigator(): Locale | null {
  if (typeof navigator === 'undefined') return null
  for (const tag of navigator.languages ?? [navigator.language]) {
    const l = normalize(tag)
    if (l) return l
  }
  return null
}

/**
 * «en-US» → «en». Неизвестное или пустое — null, решение примет следующий источник.
 *
 * Сверяется с ПРЕДЛОЖЕННЫМИ языками, а не со всеми: угадывать язык, которого
 * нет в переключателе, нельзя — пользователь получил бы наполовину переведённый
 * интерфейс и не нашёл бы, чем это выключить.
 */
function normalize(tag: string | undefined | null): Locale | null {
  if (!tag) return null
  const base = String(tag).toLowerCase().split(/[-_]/)[0]
  return isOffered(base) ? base : null
}

export function detectLocale(): Locale {
  return stored() ?? fromTelegram() ?? fromNavigator() ?? DEFAULT_LOCALE
}
