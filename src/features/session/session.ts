// Локальная «регистрация»: юзернейм в localStorage (одна запись). Не часть DataSnapshot.
// Если localStorage недоступен (приватный режим, тест-среда) — fallback в память.

const KEY = 'fin.username'

let memory: string | null = null

function ls(): Storage | null {
  try {
    const s = globalThis.localStorage
    // проверяем, что хранилище действительно работает
    const probe = '__fin_probe__'
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    return null
  }
}

export function getUsername(): string | null {
  const s = ls()
  if (s) return s.getItem(KEY)
  return memory
}

export function setUsername(name: string): void {
  memory = name
  ls()?.setItem(KEY, name)
}

export function clearUsername(): void {
  memory = null
  ls()?.removeItem(KEY)
}
