// Режим отображения рабочей области (Десктоп/Моб.) — переключатель в топбаре
// App.tsx, потребляется таблицами/отчётами ниже по дереву без прокидывания пропсов.

import { createContext, useContext } from 'react'

export type ViewMode = 'desktop' | 'mobile'

const ViewModeContext = createContext<ViewMode>('desktop')

export const ViewModeProvider = ViewModeContext.Provider

export function useViewMode(): ViewMode {
  return useContext(ViewModeContext)
}
