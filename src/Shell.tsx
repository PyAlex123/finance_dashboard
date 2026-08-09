import { useCallback, useEffect, useState } from 'react'
import { getUsername, setUsername as persistUsername, clearUsername } from './features/session/session'
import {
  connectBackend, connectTelegram, connectWithToken, disconnectBackend, restoreSession,
  type TelegramSession,
} from './data/backend'
import { isTelegram, initTelegramUI, telegramInitData } from './features/session/telegram'
import LoginScreen from './features/session/LoginScreen'
import ModuleChooser, { type ModuleId } from './features/session/ModuleChooser'
import AdminUsers from './features/admin/AdminUsers'
import Landing from './features/landing/Landing'
import LegalPage from './features/landing/LegalPage'
import { navigate, takeTokenFromUrl, useRoute } from './routes'
import App from './App'
import PlApp from './features/pnl/PlApp'
import BsApp from './features/bs/BsApp'

// В Telegram вход автоматический (по id) — «Выйти» не показываем.
const inTelegram = isTelegram()

// Оболочка: публичные страницы (лендинг, вход, юр-тексты) и кабинет в одном SPA.
// Внутри Telegram Web App путь не имеет значения — там сразу кабинет с автовходом.
// Юзернейм запоминается (localStorage); модуль выбирается заново каждую сессию.
export default function Shell() {
  const route = useRoute()
  const [username, setUser] = useState<string | null>(() => getUsername())
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined)
  const [workspace, setWorkspace] = useState<string | undefined>(undefined)
  const [isAdmin, setIsAdmin] = useState(false)
  const [module, setModule] = useState<ModuleId | null>(null)
  const [admin, setAdmin] = useState(false)

  // Старт: внутри Telegram — авто-вход по initData. В браузере — либо токен,
  // который принесла ссылка из бота, либо сохранённая сессия. Локальный режим — no-op.
  useEffect(() => {
    let cancelled = false
    async function boot() {
      if (isTelegram()) {
        initTelegramUI()
        const session = await connectTelegram(telegramInitData())
        if (session && !cancelled) {
          applySession(session) // авто-вход: экран входа пропускаем
          return
        }
      }

      const token = takeTokenFromUrl()
      if (token) {
        const session = await connectWithToken(token)
        if (session && !cancelled) {
          applySession(session)
          navigate('/app')
          return
        }
        if (!cancelled) navigate('/login?error=auth_expired')
      }

      const restored = await restoreSession()
      if (restored && !cancelled) {
        applySession(restored)
        return
      }
      if (username && !cancelled) void connectBackend(username)
    }
    void boot()
    return () => { cancelled = true }
    // один раз при монтировании; последующие входы/выходы обрабатывают login/logout
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Кабинет без входа — отправляем на страницу входа (прямая ссылка, выход в
  // другой вкладке). В Telegram вход идёт сам, редирект там не нужен.
  useEffect(() => {
    if (inTelegram) return
    if (route === 'app' && !username) navigate('/login')
    if (route === 'login' && username) navigate('/app')
  }, [route, username])

  function applySession(session: TelegramSession) {
    setUser(session.name)
    setPhotoUrl(session.photoUrl)
    setWorkspace(session.workspace)
    setIsAdmin(!!session.isAdmin)
  }

  function login(name: string) {
    persistUsername(name)
    setUser(name)
    void connectBackend(name)
    navigate('/app')
  }

  const loginTelegram = useCallback((session: TelegramSession) => {
    applySession(session)
    navigate('/app')
  }, [])

  function logout() {
    disconnectBackend()
    clearUsername()
    setUser(null)
    setPhotoUrl(undefined)
    setWorkspace(undefined)
    setIsAdmin(false)
    setModule(null)
    setAdmin(false)
    navigate('/')
  }

  // «Выйти» доступно только вне Telegram (в браузере/LAN). В Telegram — undefined,
  // и кнопка не рендерится (в модулях она уже под `{onLogout && …}`).
  const onLogout = inTelegram ? undefined : logout

  if (!inTelegram) {
    if (route === 'landing') return <Landing loggedIn={!!username} />
    if (route === 'privacy') return <LegalPage kind="privacy" />
    if (route === 'terms') return <LegalPage kind="terms" />
    if (route === 'login' || !username) return <LoginScreen onLogin={login} onSession={loginTelegram} />
  }

  if (!username) return <LoginScreen onLogin={login} onSession={loginTelegram} />
  if (admin) return <AdminUsers onBack={() => setAdmin(false)} />
  if (!module) {
    return (
      <ModuleChooser
        username={username}
        photoUrl={photoUrl}
        tgId={workspace?.startsWith('tg:') ? workspace.slice(3) : undefined}
        isAdmin={isAdmin}
        onOpenAdmin={() => setAdmin(true)}
        onPick={setModule}
        onLogout={onLogout}
      />
    )
  }

  const workspaceProps = { username, photoUrl, onBack: () => setModule(null), onLogout }
  if (module === 'bs') return <BsApp {...workspaceProps} />
  if (module === 'pl') return <PlApp {...workspaceProps} />
  return <App {...workspaceProps} />
}
