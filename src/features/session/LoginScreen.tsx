import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../../i18n/react'
import LangSwitch from '../ui/LangSwitch'
import { href, linkHandler } from '../../routes'
import {
  API_URL, REMOTE, connectGoogle, fetchPublicConfig,
  type PublicConfig, type TelegramSession,
} from '../../data/backend'
import { FinloLockup } from '../landing/Logo'
import '../landing/landing.css'

const GIS_SRC = 'https://accounts.google.com/gsi/client'

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

/** Адрес серверного редиректа в бота (имя бота знает только сервер). */
const telegramLoginUrl = () => `${API_URL.replace(/\/+$/, '')}/api/auth/telegram`

// Экран входа — перенос land/Login.dc.html: никаких полей логина, две кнопки.
//
// Telegram: кнопка ведёт на /api/auth/telegram — сервер редиректит в бота
// (`/start register`), бот присылает одноразовую ссылку, переход по ней возвращает
// в приложение уже с сессией. Ни домена у @BotFather, ни виджета не нужно.
//
// Google: официальная кнопка Identity Services лежит прозрачным слоем поверх нашей
// (её разметку менять нельзя), ID-токен проверяет сервер.
export default function LoginScreen({ onLogin, onSession }: LoginScreenProps) {
  const t = useT()
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [ready, setReady] = useState(!REMOTE) // конфиг загружен (или не нужен)
  const [error, setError] = useState<string | null>(null)
  const [byName, setByName] = useState(false)
  const [name, setName] = useState('')
  const googleRef = useRef<HTMLDivElement>(null)
  const trimmed = name.trim()

  const enter = useCallback((session: TelegramSession) => {
    onSession?.(session)
  }, [onSession])

  // Ссылка из бота одноразовая и живёт минуты: по устаревшей сервер приводит сюда
  // с ?error=auth_expired — объясняем, а не показываем пустой экран входа.
  useEffect(() => {
    const check = () => {
      const reason = new URLSearchParams(window.location.search).get('error')
      if (reason === 'auth_expired') {
        setError(t('login.error.expired'))
      }
    }
    check()
    // На этот же экран можно попасть уже после монтирования (переход внутри SPA,
    // когда токен из бота оказался негодным) — слушаем смену адреса.
    window.addEventListener('popstate', check)
    return () => window.removeEventListener('popstate', check)
  }, [])

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
              setError(t('login.error.google'))
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
        <h1 className="lp-login__title">{t('login.heading')}</h1>
        <p className="lp-login__sub">{t('brand.tagline')}</p>

        <div className="lp-login__buttons">
          {tgReady ? (
            <a className="lp-login__btn lp-login__btn--tg" href={telegramLoginUrl()}>
              <TelegramIcon />
              {t('login.telegram.btn')}
            </a>
          ) : (
            <button className="lp-login__btn lp-login__btn--tg" type="button" disabled>
              <TelegramIcon />
              {t('login.telegram.btn')}
            </button>
          )}

          <div className="lp-login__google">
            <button className="lp-login__btn lp-login__btn--google" type="button" disabled={!googleReady}>
              <GoogleIcon />
              {t('login.google.btn')}
              {!googleReady && <span className="lp-login__soon">{t('login.google.soon')}</span>}
            </button>
            {/* Официальную кнопку Google перерисовывать нельзя — кладём её
                прозрачным слоем поверх нашей, клик достаётся ей. */}
            <div className="lp-login__gis" ref={googleRef} />
          </div>
        </div>

        <p className="lp-login__hint">{t('login.hint')}</p>
        {error && <p className="lp-login__error">{error}</p>}

        {!tgReady && !googleReady && !byName && (
          <p className="lp-login__fallback">
            <button type="button" onClick={() => setByName(true)}>{t('login.byName')}</button>
          </p>
        )}
        {byName && (
          <form className="lp-login__form" onSubmit={submitName}>
            <input
              className="lp-login__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('login.username')}
              aria-label={t('login.username')}
              autoFocus
            />
            <button className="lp-login__btn lp-login__btn--tg" type="submit" disabled={!trimmed}>
              {t('login.submit')}
            </button>
          </form>
        )}

        {/* Переключатель нужен и здесь: по ссылке из Telegram-бота пользователь
            попадает сразу на вход, минуя лендинг. */}
        <LangSwitch className="lp-login__lang" />

        <div className="lp-login__links">
          <a href={href('/privacy')} onClick={linkHandler('/privacy')}>{t('lp.footer.privacy')}</a>
          <a href={href('/terms')} onClick={linkHandler('/terms')}>{t('lp.footer.terms')}</a>
        </div>
      </main>
    </div>
  )
}

function TelegramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21.5 4.3 2.9 11.2c-1 .4-1 1 .1 1.3l4.7 1.5 1.8 5.5c.2.7.5.8 1 .4l2.7-2.2 4.6 3.4c.9.5 1.4.2 1.6-.8l3-14c.2-1-.4-1.4-1-1.1Zm-3.6 3.8-7 6.3-.3 3-1.3-4 8.1-5.6c.4-.2.8 0 .5.3Z" fill="#8FD9C2" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23 12.2c0-.8-.1-1.6-.2-2.3H12v4.4h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.5Z" />
      <path fill="#34A853" d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1a6.8 6.8 0 0 1-6.4-4.7H1.8v3a11.5 11.5 0 0 0 10.2 6.3Z" />
      <path fill="#FBBC05" d="M5.6 14.2a6.9 6.9 0 0 1 0-4.4v-3H1.8a11.5 11.5 0 0 0 0 10.4l3.8-3Z" />
      <path fill="#EA4335" d="M12 5.3c1.7 0 3.3.6 4.5 1.8l3.3-3.3A11.4 11.4 0 0 0 1.8 6.8l3.8 3A6.8 6.8 0 0 1 12 5.3Z" />
    </svg>
  )
}
