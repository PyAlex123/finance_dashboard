import { describe, it, expect, beforeEach } from 'vitest'

// В тест-среде globalThis.localStorage не рабочий (методов нет), а модуль читает
// его лениво — подставляем свой до импорта, чтобы проверять именно хранилище,
// а не память-фолбэк.
const store = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
})

const { loadSession, saveSession, clearSession } = await import('./authSession')

const KEY = 'finlo.session'

beforeEach(() => store.clear())

describe('Хранение серверной сессии', () => {
  it('сохраняет и читает профиль', () => {
    saveSession({ token: 't1', workspace: 'tg:8', name: 'Вика', isAdmin: true })
    expect(JSON.parse(store.get(KEY)!)).toMatchObject({ token: 't1', workspace: 'tg:8' })
    expect(loadSession()).toMatchObject({ token: 't1', workspace: 'tg:8', name: 'Вика', isAdmin: true })
  })

  it('пустое хранилище — null', () => {
    expect(loadSession()).toBeNull()
  })

  it('«Выйти» стирает запись', () => {
    saveSession({ token: 't1', workspace: 'tg:8', name: 'Вика' })
    clearSession()
    expect(loadSession()).toBeNull()
    expect(store.has(KEY)).toBe(false)
  })

  it('битый JSON не роняет вход и вычищается', () => {
    store.set(KEY, '{не json')
    expect(loadSession()).toBeNull()
    expect(store.has(KEY)).toBe(false)
  })

  it('запись без токена считается мусором', () => {
    store.set(KEY, JSON.stringify({ workspace: 'tg:8' }))
    expect(loadSession()).toBeNull()
    expect(store.has(KEY)).toBe(false)
  })
})
