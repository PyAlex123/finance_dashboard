// Минимальный роутер на History API — без зависимостей: страниц пять, и ради них
// react-router не тянем. Публичные страницы (лендинг, вход, юр-тексты) и кабинет
// живут в одном SPA, поэтому сервер обязан отдавать index.html на любой путь
// (SPA-fallback в server/app/main.py).
//
// BASE_URL — префикс размещения из Vite (в проде «/dashboards/», локально «/»).

import { useEffect, useState } from 'react'

export type Route = 'landing' | 'login' | 'privacy' | 'terms' | 'app'

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '')

/** Путь внутри приложения (без базы), всегда начинается со «/». */
function pathname(): string {
  const raw = typeof window === 'undefined' ? '/' : window.location.pathname
  const rest = BASE && raw.startsWith(BASE) ? raw.slice(BASE.length) : raw
  return rest.startsWith('/') ? rest : `/${rest}`
}

/** Полный URL для ссылки: «/login» → «/dashboards/login». */
export function href(path: string): string {
  return `${BASE}${path}` || '/'
}

export function routeOf(path: string): Route {
  const p = path.replace(/\/+$/, '') || '/'
  if (p === '/login') return 'login'
  if (p === '/privacy') return 'privacy'
  if (p === '/terms') return 'terms'
  if (p === '/app') return 'app'
  return 'landing' // неизвестный путь — публичная главная, а не 404
}

/** Переход без перезагрузки. Возврат наверх — как при обычной смене страницы. */
export function navigate(path: string): void {
  if (typeof window === 'undefined') return
  window.history.pushState({}, '', href(path))
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo(0, 0)
}

/** Текущий роут; следит за «назад/вперёд» и за navigate(). */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => routeOf(pathname()))
  useEffect(() => {
    const onPop = () => setRoute(routeOf(pathname()))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return route
}

/**
 * Обработчик для ссылок внутри SPA: обычный клик перехватываем, а Ctrl/Cmd/
 * средняя кнопка («открыть в новой вкладке») пусть работают как в браузере.
 */
export function linkHandler(path: string) {
  return (e: React.MouseEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    navigate(path)
  }
}
