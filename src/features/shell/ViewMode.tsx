// Режим отображения определяется ШИРИНОЙ ЭКРАНА, а не переключателем: узкий
// экран (телефон) → 'mobile', иначе 'desktop'. Компоненты со структурно разной
// вёрсткой (журнал: карточки vs таблица, дашборд: 1 vs 2 колонки) читают это
// через useViewMode(); чисто визуальную адаптацию делают media-запросы в CSS.

import { useSyncExternalStore } from 'react'

export type ViewMode = 'desktop' | 'mobile'

const QUERY = '(max-width: 768px)'

function mql(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(QUERY)
}

function subscribe(cb: () => void): () => void {
  const m = mql()
  if (!m) return () => {}
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}

function isMobile(): boolean {
  return mql()?.matches ?? false
}

export function useViewMode(): ViewMode {
  const mobile = useSyncExternalStore(subscribe, isMobile, () => false)
  return mobile ? 'mobile' : 'desktop'
}
