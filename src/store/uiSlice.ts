// Состояние интерфейса. Пока в нём только язык — и он здесь не ради компонентов
// (те берут язык напрямую через useT), а ради МЕМОИЗАЦИИ СЕЛЕКТОРОВ.
//
// Селекторы reselect в store/reportSelectors.ts мемоизированы на [selectData].
// Смена языка не меняет data, поэтому без этого среза авто-статьи ДДС и заголовки
// периодов остались бы на прежнем языке до первой правки данных. Добавляя
// selectLocale во входы таких селекторов, мы делаем язык частью ключа мемоизации.
//
// Срез НЕ персистится: data/persistence.ts гидратирует только data, apiRepo шлёт
// только снимок. Формат данных на проводе не меняется, колонка в БД не нужна.

import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { getLocale } from '../i18n/locale'
import type { Locale } from '../i18n/types'

export interface UiState {
  locale: Locale
}

const initialState: UiState = { locale: getLocale() }

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    localeChanged(state, action: PayloadAction<Locale>) {
      state.locale = action.payload
    },
  },
})

export const { localeChanged } = uiSlice.actions
export default uiSlice.reducer
