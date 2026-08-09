// Сессия серверного входа (Telegram/Google) в localStorage — чтобы перезагрузка
// страницы не выкидывала на экран входа. Ключ один на всё приложение.
//
// Хранение с тем же запасным вариантом, что и у имени пользователя (session.ts):
// в приватном режиме localStorage может бросать — тогда живём в памяти вкладки.

const KEY = 'finlo.session'

export interface StoredSession {
  token: string
  workspace: string
  name: string
  photoUrl?: string
  username?: string
  isAdmin?: boolean
}

let memory: StoredSession | null = null

function ls(): Storage | null {
  try {
    const s = globalThis.localStorage
    const probe = '__finlo_probe__'
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    return null
  }
}

export function loadSession(): StoredSession | null {
  const s = ls()
  if (!s) return memory
  const raw = s.getItem(KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>
    // Мусор в хранилище (старый формат, ручная правка) не должен ронять вход.
    if (!parsed?.token || !parsed?.workspace) {
      s.removeItem(KEY)
      return null
    }
    return { name: parsed.workspace, ...parsed } as StoredSession
  } catch {
    s.removeItem(KEY)
    return null
  }
}

export function saveSession(session: StoredSession): void {
  memory = session
  ls()?.setItem(KEY, JSON.stringify(session))
}

export function clearSession(): void {
  memory = null
  ls()?.removeItem(KEY)
}
