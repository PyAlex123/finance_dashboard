import { configureStore } from '@reduxjs/toolkit'
import dataReducer from './dataSlice'
import uiReducer from './uiSlice'

export function makeStore() {
  return configureStore({
    reducer: {
      data: dataReducer,
      ui: uiReducer,
    },
    middleware: (getDefault) =>
      // Деньги — bigint; штатная проверка сериализуемости RTK на них ругается.
      // Мы намеренно храним bigint и сериализуем сами (json.ts), поэтому отключаем.
      getDefault({ serializableCheck: false }),
  })
}

export const store = makeStore()

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
