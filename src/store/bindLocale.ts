// Мост: смена языка в i18n/locale.ts → действие в сторе. Отдельным файлом, чтобы
// store/index.ts не зависел от i18n, а i18n — от стора.

import { subscribeLocale, getLocale } from '../i18n/locale'
import { localeChanged } from './uiSlice'
import type { AppStore } from './index'

/** Возвращает отписку — она нужна тестам, чтобы стор не пережил свой файл. */
export function bindLocaleToStore(store: AppStore): () => void {
  return subscribeLocale(() => {
    store.dispatch(localeChanged(getLocale()))
  })
}
