import { useEffect, useRef, useState } from 'react'
import { BRAND, BRAND_TAGLINE } from '../../brand'
import { href, linkHandler } from '../../routes'
import {
  REMOTE, connectTelegramWidget, fetchPublicConfig,
  type TelegramSession, type TelegramWidgetUser,
} from '../../data/backend'
import '../landing/landing.css'

const WIDGET_SRC = 'https://telegram.org/js/telegram-widget.js?22'
const WIDGET_TIMEOUT = 4000

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramWidgetUser) => void
  }
}

export interface LoginScreenProps {
  /** Вход по имени (локальный режим и запасной путь, когда Telegram недоступен). */
  onLogin: (username: string) => void
  /** Успешный вход через Telegram: профиль уже получен с сервера. */
  onSession?: (session: TelegramSession) => void
}

// Экран входа — перенос land/Login.dc.html: никаких полей логина, две кнопки.
// Telegram работает по-настоящему (Login Widget → проверка подписи на сервере),
// Google появится позже. Вход по имени остаётся запасным путём: виджет требует
// https и домен, прописанный в @BotFather, поэтому локально его нет.
export default function LoginScreen({ onLogin, onSession }: LoginScreenProps) {
  const [tg, setTg] = useState<'loading' | 'ready' | 'off'>(REMOTE ? 'loading' : 'off')
  const [error, setError] = useState<string | null>(null)
  const [byName, setByName] = useState(false)
  const [name, setName] = useState('')
  const widgetRef = useRef<HTMLDivElement>(null)
  const trimmed = name.trim()

  useEffect(() => {
    if (!REMOTE) return
    let cancelled = false

    window.onTelegramAuth = (user) => {
      void (async () => {
        const session = await connectTelegramWidget(user)
        if (!session) {
          setError('Сервер не принял вход через Telegram. Попробуйте ещё раз.')
          return
        }
        onSession?.(session)
      })()
    }

    void (async () => {
      const config = await fetchPublicConfig()
      const container = widgetRef.current
      if (cancelled || !container) return
      if (!config?.telegramBot) {
        setTg('off')
        return
      }
      const script = document.createElement('script')
      script.src = WIDGET_SRC
      script.async = true
      script.setAttribute('data-telegram-login', config.telegramBot)
      script.setAttribute('data-size', 'large')
      script.setAttribute('data-userpic', 'false')
      script.setAttribute('data-request-access', 'write')
      script.setAttribute('data-onauth', 'onTelegramAuth(user)')
      script.onload = () => { if (!cancelled) setTg('ready') }
      script.onerror = () => { if (!cancelled) setTg('off') }
      container.appendChild(script)
    })()

    // Если виджет не поднялся (нет сети до telegram.org, блокировщик) — не
    // оставляем пользователя без входа, показываем запасной путь.
    const timer = window.setTimeout(() => {
      if (!cancelled) setTg((s) => (s === 'loading' ? 'off' : s))
    }, WIDGET_TIMEOUT)

    return () => {
      cancelled = true
      clearTimeout(timer)
      delete window.onTelegramAuth
    }
  }, [onSession])

  function submitName(e: React.FormEvent) {
    e.preventDefault()
    if (trimmed) onLogin(trimmed)
  }

  return (
    <div className="lp-login">
      <div className="lp-login__blob lp-login__blob--a" aria-hidden="true" />
      <div className="lp-login__blob lp-login__blob--b" aria-hidden="true" />

      <main className="lp-login__main">
        <a className="lp-login__logo" href={href('/')} onClick={linkHandler('/')}>
          <span className="lp-login__mark" aria-hidden="true">
            <span className="lp-login__tick" />
          </span>
          <span className="lp-login__brand">{BRAND}</span>
        </a>
        <h1 className="lp-login__title">Войдите, чтобы продолжить</h1>
        <p className="lp-login__sub">{BRAND_TAGLINE}</p>

        <div className="lp-login__buttons">
          <div className="lp-login__tg">
            <button className="lp-login__btn lp-login__btn--tg" type="button" disabled={tg !== 'ready'}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M21.5 4.3 2.9 11.2c-1 .4-1 1 .1 1.3l4.7 1.5 1.8 5.5c.2.7.5.8 1 .4l2.7-2.2 4.6 3.4c.9.5 1.4.2 1.6-.8l3-14c.2-1-.4-1.4-1-1.1Zm-3.6 3.8-7 6.3-.3 3-1.3-4 8.1-5.6c.4-.2.8 0 .5.3Z" fill="#8FD9C2" />
              </svg>
              Войти через Telegram
            </button>
            {/* Поверх кнопки — настоящий виджет Telegram (прозрачный): кликнуть по
                кросс-доменному iframe программно нельзя, поэтому клик принимает он. */}
            <div className="lp-login__widget" ref={widgetRef} />
          </div>

          <button className="lp-login__btn lp-login__btn--google" type="button" disabled>
            <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23 12.2c0-.8-.1-1.6-.2-2.3H12v4.4h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.5Z" />
              <path fill="#34A853" d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1a6.8 6.8 0 0 1-6.4-4.7H1.8v3a11.5 11.5 0 0 0 10.2 6.3Z" />
              <path fill="#FBBC05" d="M5.6 14.2a6.9 6.9 0 0 1 0-4.4v-3H1.8a11.5 11.5 0 0 0 0 10.4l3.8-3Z" />
              <path fill="#EA4335" d="M12 5.3c1.7 0 3.3.6 4.5 1.8l3.3-3.3A11.4 11.4 0 0 0 1.8 6.8l3.8 3A6.8 6.8 0 0 1 12 5.3Z" />
            </svg>
            Войти через Google
            <span className="lp-login__soon">скоро</span>
          </button>
        </div>

        <p className="lp-login__hint">Впервые здесь? Вход и регистрация — одной кнопкой.</p>
        {error && <p className="lp-login__error">{error}</p>}

        {tg !== 'ready' && !byName && (
          <p className="lp-login__fallback">
            <button type="button" onClick={() => setByName(true)}>Войти по имени</button>
          </p>
        )}
        {byName && (
          <form className="lp-login__form" onSubmit={submitName}>
            <input
              className="lp-login__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Юзернейм"
              aria-label="Юзернейм"
              autoFocus
            />
            <button className="lp-login__btn lp-login__btn--tg" type="submit" disabled={!trimmed}>
              Войти
            </button>
          </form>
        )}

        <div className="lp-login__links">
          <a href={href('/privacy')} onClick={linkHandler('/privacy')}>Политика конфиденциальности</a>
          <a href={href('/terms')} onClick={linkHandler('/terms')}>Условия использования</a>
        </div>
      </main>
    </div>
  )
}
