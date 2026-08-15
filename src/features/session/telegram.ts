// Telegram Web App (Фаза 5). Определяем запуск внутри Telegram, отдаём initData
// для обмена на JWT и подгоняем хром Telegram под нашу светлую forest-тему.
// Вне Telegram (обычный браузер) всё это no-op: window.Telegram отсутствует.

interface TelegramWebApp {
  initData: string
  /**
   * Неподписанная копия initData. Для авторизации не годится (её нельзя проверить),
   * но language_code отсюда — лучшая догадка о языке: пользователь уже сидит в
   * клиенте Telegram на этом языке. Читается в src/i18n/detect.ts.
   */
  initDataUnsafe?: { user?: { language_code?: string } }
  ready: () => void
  expand?: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

function webApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null
  return window.Telegram?.WebApp ?? null
}

/** Запущены внутри Telegram (есть подписанный initData). */
export function isTelegram(): boolean {
  const w = webApp()
  return !!(w && typeof w.initData === 'string' && w.initData.length > 0)
}

/** Подписанная строка initData для обмена на JWT на бэкенде. */
export function telegramInitData(): string {
  return webApp()?.initData ?? ''
}

/** Инициализация Telegram-UI: развернуть окно, подогнать цвета хрома. */
export function initTelegramUI(): void {
  const w = webApp()
  if (!w) return
  try {
    w.ready()
    w.expand?.()
    w.setHeaderColor?.('#0b3b32') // forest
    w.setBackgroundColor?.('#f4f7f5') // paper
  } catch {
    /* вне Telegram / старый клиент — игнорируем */
  }
}
