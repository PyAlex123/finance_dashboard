import { useEffect, useState } from 'react'
import { getUsername, setUsername as persistUsername, clearUsername } from './features/session/session'
import { connectBackend, disconnectBackend } from './data/backend'
import LoginScreen from './features/session/LoginScreen'
import ModuleChooser, { type ModuleId } from './features/session/ModuleChooser'
import App from './App'
import PlApp from './features/pnl/PlApp'

// Оболочка-маршрутизатор экранов: вход → выбор модуля → рабочая область.
// Юзернейм запоминается (localStorage); модуль выбирается заново каждую сессию.
export default function Shell() {
  const [username, setUser] = useState<string | null>(() => getUsername())
  const [module, setModule] = useState<ModuleId | null>(null)

  // Серверный режим: подключить пространство запомненного пользователя при старте.
  // Локальный режим — no-op (данные уже загружены в main.tsx).
  useEffect(() => {
    if (username) void connectBackend(username)
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
    setModule(null)
  }

  if (!username) return <LoginScreen onLogin={login} />
  if (!module) return <ModuleChooser username={username} onPick={setModule} onLogout={logout} />

  const workspaceProps = { username, onBack: () => setModule(null), onLogout: logout }
  if (module === 'pl') return <PlApp {...workspaceProps} />
  return <App {...workspaceProps} />
}
