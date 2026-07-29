import { useEffect, useState } from 'react'
import { getUsername, setUsername as persistUsername, clearUsername } from './features/session/session'
import { connectBackend, connectTelegram, disconnectBackend } from './data/backend'
import { isTelegram, initTelegramUI, telegramInitData } from './features/session/telegram'
import LoginScreen from './features/session/LoginScreen'
import ModuleChooser, { type ModuleId } from './features/session/ModuleChooser'
import App from './App'
import PlApp from './features/pnl/PlApp'
import BsApp from './features/bs/BsApp'

// В Telegram вход автоматический (по id) — «Выйти» не показываем.
const inTelegram = isTelegram()

// Оболочка-маршрутизатор экранов: вход → выбор модуля → рабочая область.
// Юзернейм запоминается (localStorage); модуль выбирается заново каждую сессию.
export default function Shell() {
  const [username, setUser] = useState<string | null>(() => getUsername())
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined)
  const [module, setModule] = useState<ModuleId | null>(null)

  // Старт: внутри Telegram — авто-вход (initData → JWT), иначе подключаем
  // запомненного пользователя (серверный режим). Локальный режим — no-op.
  useEffect(() => {
    let cancelled = false
    async function boot() {
      if (isTelegram()) {
        initTelegramUI()
        const session = await connectTelegram(telegramInitData())
        if (session && !cancelled) {
          setUser(session.name) // авто-вход: экран входа пропускаем
          setPhotoUrl(session.photoUrl)
          return
        }
      }
      if (username && !cancelled) void connectBackend(username)
    }
    void boot()
    return () => { cancelled = true }
    // один раз при монтировании; последующие входы/выходы обрабатывают login/logout
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function login(name: string) {
    persistUsername(name)
    setUser(name)
    void connectBackend(name)
  }
  function logout() {
    disconnectBackend()
    clearUsername()
    setUser(null)
    setPhotoUrl(undefined)
    setModule(null)
  }

  // «Выйти» доступно только вне Telegram (в браузере/LAN). В Telegram — undefined,
  // и кнопка не рендерится (в модулях она уже под `{onLogout && …}`).
  const onLogout = inTelegram ? undefined : logout

  if (!username) return <LoginScreen onLogin={login} />
  if (!module) {
    return (
      <ModuleChooser
        username={username}
        photoUrl={photoUrl}
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
