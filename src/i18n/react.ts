// Мост i18n → React. useSyncExternalStore (React 18) даёт подписку без tearing
// и без собственного состояния: источник истины остаётся один — i18n/locale.ts.

import { useMemo, useSyncExternalStore } from 'react'
import { DEFAULT_LOCALE, type Locale, type Params } from './types'
import { getLocale, subscribeLocale } from './locale'
import { t, tp, type Key, type PluralKey } from './index'

export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, () => DEFAULT_LOCALE)
}

export interface Translate {
  (key: Key, params?: Params): string
  /** Форма множественного числа: p('refs.count', n). */
  p: (base: PluralKey, count: number, params?: Params) => string
}

/**
 * Переводчик, привязанный к текущей локали.
 *
 * Идентичность возвращённой функции меняется вместе с локалью — поэтому
 * компонент перерисовывается, а любой useMemo с t в зависимостях пересчитывается.
 */
export function useT(): Translate {
  const locale = useLocale()
  return useMemo(
    () =>
      Object.assign((key: Key, params?: Params) => t(key, params, locale), {
        p: (base: PluralKey, count: number, params?: Params) => tp(base, count, params, locale),
      }),
    [locale],
  )
}
