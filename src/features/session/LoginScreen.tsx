import { useCallback, useEffect, useRef, useState } from 'react'
import { BRAND_TAGLINE } from '../../brand'
import { href, linkHandler } from '../../routes'
import { FinloLockup } from '../landing/Logo'
import {
  REMOTE, connectGoogle, fetchPublicConfig, pollTelegramLink, startTelegramLink,
  type PublicConfig, type TelegramLink, type TelegramSession,
} from '../../data/backend'
import '../landing/landing.css'

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const POLL_INTERVAL = 2000

interface GoogleCredential { credential?: string }

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (o: { client_id: string; callback: (r: GoogleCredential) => void }) => void
          renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
        }
      }
    }
  }
}

export interface LoginScreenProps {
  /** Вход по имени (локальный режим и запасной путь, когда провайдеры недоступны). */
  onLogin: (username: string) => void
  /** Успешный вход через провайдера: профиль уже получен с сервера. */
  onSession?: (session: TelegramSession) => void
}

// Экран входа — перенос land/Login.dc.html: никаких полей логина, две кнопки.
//
// Telegram: сайт создаёт одноразовую заявку и открывает бота по ссылке
// t.me/<bot>?start=<код>; пользователь жмёт в чате «Войти с компьютера», а эта
// вкладка всё это время опрашивает сервер и входит сама. Домен бота (/setdomain)
// и виджет не нужны — бот и так настроен.
//
// Google: официальная кнопка Identity Services лежит прозрачным слоем поверх нашей
// (её разметку менять нельзя), ID-токен проверяет сервер.
export default function LoginScreen({ onLogin, onSession }: LoginScreenProps) {
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [ready, setReady] = useState(!REMOTE) // конфиг загружен (или не нужен)
  const [link, setLink] = useState<TelegramLink | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [byName, setByName] = useState(false)
  const [name, setName] = useState('')
  const googleRef = useRef<HTMLDivElement>(null)
  const trimmed = name.trim()

  const enter = useCallback((session: TelegramSession) => {
    onSession?.(session)
  }, [onSession])

  // Что настроено на сервере, то и включаем.
  useEffect(() => {
    if (!REMOTE) return
    let cancelled = false
    void (async () => {
      const c = await fetchPublicConfig()
      if (cancelled) return
      setConfig(c)
      setReady(true)
    })()
    return () => { cancelled = true }
  }, [])

  // Опрос заявки, пока пользователь подтверждает вход в боте.
  useEffect(() => {
    if (!link) return
    let cancelled = false
    const timer = window.setInterval(() => {
      void (async () => {
        const result = await pollTelegramLink(link.nonce)
        if (cancelled || result === 'pending') return
        if (result === 'expired') {
          setLink(null)
          setError('Время ожидания истекло. Попробуйте войти ещё раз.')
          return
        }
        enter(result)
      })()
    }, POLL_INTERVAL)
    return () => { cancelled = true; clearInterval(timer) }
  }, [link, enter])

  // Кнопка Google появляется, только когда сервер отдал Client ID.
  useEffect(() => {
    const clientId = config?.googleClientId
    const container = googleRef.current
    if (!clientId || !container) return
    let cancelled = false

    function render() {
      if (cancelled || !window.google || !container) return
      window.google.accounts.id.initialize({
        client_id: clientId!,
        callback: ({ credential }) => {
          void (async () => {
            if (!credential) return
            const session = await connectGoogle(credential)
            if (!session) {
              setError('Сервер не принял вход через Google. Попробуйте ещё раз.')
              return
            }
            enter(session)
          })()
        },
      })
      window.google.accounts.id.renderButton(container, {
        type: 'standard', theme: 'outline', size: 'large', width: 400,
      })
    }

    if (window.google) {
      render()
      return () => { cancelled = true }
    }
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.onload = render
    document.head.appendChild(script)
    return () => { cancelled = true }
  }, [config, enter])

  async function loginTelegram() {
    setError(null)
    const created = await startTelegramLink()
    if (!created) {
      setError('Не удалось начать вход через Telegram. Попробуйте позже.')
      return
    }
    setLink(created)
    window.open(created.url, '_blank', 'noopener')
  }

  function submitName(e: React.FormEvent) {
    e.preventDefault()
    if (trimmed) onLogin(trimmed)
  }

  const tgReady = ready && !!config?.telegramBot
  const googleReady = ready && !!config?.googleClientId

  return (
    <div className="lp-login">
      <div className="lp-login__blob lp-login__blob--a" aria-hidden="true" />
      <div className="lp-login__blob lp-login__blob--b" aria-hidden="true" />

      <main className="lp-login__main">
        <a className="lp-login__logo" href={href('/')} onClick={linkHandler('/')}>
          <FinloLockup className="lp-login__svg" />
        </a>
        <h1 className="lp-login__title">Войдите, чтобы продолжить</h1>
        <p className="lp-login__sub">{BRAND_TAGLINE}</p>

        {link ? (
          <div className="lp-login__waiting">
            <p className="lp-login__waiting-title">Подтвердите вход в Telegram</p>
            <p className="lp-login__waiting-text">
              В чате с ботом нажмите «Войти с компьютера». Код на этой странице должен
              совпасть с кодом в сообщении.
            </p>
            <p className="lp-login__code">{link.code}</p>
            <div className="lp-login__waiting-actions">
              <a href={link.url} target="_blank" rel="noopener">Открыть Telegram ещё раз</a>
              <button type="button" onClick={() => setLink(null)}>Отмена</button>
            </div>
          </div>
        ) : (
          <div className="lp-login__buttons">
            <button
              className="lp-login__btn lp-login__btn--tg"
              type="button"
              disabled={!tgReady}
              onClick={() => void loginTelegram()}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M21.5 4.3 2.9 11.2c-1 .4-1 1 .1 1.3l4.7 1.5 1.8 5.5c.2.7.5.8 1 .4l2.7-2.2 4.6 3.4c.9.5 1.4.2 1.6-.8l3-14c.2-1-.4-1.4-1-1.1Zm-3.6 3.8-7 6.3-.3 3-1.3-4 8.1-5.6c.4-.2.8 0 .5.3Z" fill="#8FD9C2" />
              </svg>
              Войти через Telegram
            </button>

            <div className="lp-login__google">
              <button className="lp-login__btn lp-login__btn--google" type="button" disabled={!googleReady}>
                <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M23 12.2c0-.8-.1-1.6-.2-2.3H12v4.4h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.5Z" />
                  <path fill="#34A853" d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1a6.8 6.8 0 0 1-6.4-4.7H1.8v3a11.5 11.5 0 0 0 10.2 6.3Z" />
                  <path fill="#FBBC05" d="M5.6 14.2a6.9 6.9 0 0 1 0-4.4v-3H1.8a11.5 11.5 0 0 0 0 10.4l3.8-3Z" />
                  <path fill="#EA4335" d="M12 5.3c1.7 0 3.3.6 4.5 1.8l3.3-3.3A11.4 11.4 0 0 0 1.8 6.8l3.8 3A6.8 6.8 0 0 1 12 5.3Z" />
                </svg>
                Войти через Google
                {!googleReady && <span className="lp-login__soon">скоро</span>}
              </button>
              {/* Официальную кнопку Google перерисовывать нельзя — кладём её
                  прозрачным слоем поверх нашей, клик достаётся ей. */}
              <div className="lp-login__gis" ref={googleRef} />
            </div>
          </div>
        )}

        <p className="lp-login__hint">Впервые здесь? Вход и регистрация — одной кнопкой.</p>
        {error && <p className="lp-login__error">{error}</p>}

        {!tgReady && !googleReady && !byName && (
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
