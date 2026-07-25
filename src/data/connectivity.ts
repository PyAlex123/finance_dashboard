// Статус связи с сервером (серверный режим). Обновляется устойчивым
// репозиторием при успехе/сбое сети; UI показывает индикатор «офлайн».

import { useSyncExternalStore } from 'react'

export type Connectivity = 'online' | 'offline'

let status: Connectivity = 'online'
const listeners = new Set<() => void>()

export function setConnectivity(next: Connectivity): void {
  if (next === status) return
  status = next
  listeners.forEach((l) => l())
}

/** Текущий статус (для не-React кода и тестов). */
export function getConnectivity(): Connectivity {
  return status
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export function useConnectivity(): Connectivity {
  return useSyncExternalStore(subscribe, () => status, () => 'online')
}
