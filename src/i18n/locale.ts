// Текущая локаль — единственный источник истины. Живёт вне React и вне Redux,
// потому что её читают и чистые модули (engine/, domain/, data/), которые про
// компоненты ничего не знают.
//
// ВАЖНО: определение языка запускается в теле этого модуля, а не из main.tsx.
// store/dataSlice.ts вызывает buildFixtureSnapshot() тоже в теле модуля, то есть
// ещё до первого рендера. Модули ES вычисляются в глубину по импортам
// (dataSlice → data/fixtures → src/i18n → i18n/locale), поэтому к моменту
// создания фикстур локаль уже определена. Перенос initLocale() в main.tsx молча
// вернёт русские демо-данные англоязычному пользователю.

import { DEFAULT_LOCALE, isLocale, type Locale } from './types'
import { detectLocale, langStorage, LANG_KEY } from './detect'

let current: Locale = DEFAULT_LOCALE

const listeners = new Set<() => void>()

export function getLocale(): Locale {
  return current
}

/** Смена языка пользователем: запоминаем выбор и оповещаем подписчиков. */
export function setLocale(next: Locale): void {
  if (!isLocale(next) || next === current) return
  current = next
  try {
    langStorage()?.setItem(LANG_KEY, next)
  } catch {
    /* хранилище недоступно — язык живёт до перезагрузки вкладки */
  }
  for (const fn of [...listeners]) fn()
}

/** Подписка для useSyncExternalStore и для моста в Redux. Возвращает отписку. */
export function subscribeLocale(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Смена языка в тестах: без записи в хранилище, но с оповещением подписчиков. */
export function setLocaleForTests(next: Locale): void {
  current = next
  for (const fn of [...listeners]) fn()
}

/** Перечитать язык из хранилища/окружения. Экспортируется ради тестов detect. */
export function initLocale(): void {
  current = detectLocale()
}

initLocale()
