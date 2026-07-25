// Выбор хранилища для рабочей области. Определяется переменной окружения Vite
// VITE_API_URL: задана — серверный режим (общий бэкенд), пусто — локальный IndexedDB.
//
// В серверном режиме рабочее пространство = имя пользователя: у каждого свои данные,
// доступные с любого устройства в сети. Shell зовёт connect на входе, disconnect на выходе.

import { store } from '../store'
import { connectWorkspace, disconnectWorkspace } from './persistence'
import { createApiRepo } from './apiRepo'
import { createIdbRepo } from './idbRepo'
import { createResilientRepo } from './resilientRepo'

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined)?.trim() ?? ''
export const REMOTE: boolean = API_URL.length > 0

/**
 * Вход: в серверном режиме подключить рабочее пространство пользователя.
 * Хранилище устойчивое: API + локальное зеркало IndexedDB на это пространство —
 * при недоступном сервере приложение работает офлайн без потери данных.
 */
export async function connectBackend(username: string): Promise<void> {
  if (!REMOTE) return
  const api = createApiRepo(API_URL, username)
  const mirror = createIdbRepo(`snapshot:${username}`)
  await connectWorkspace(store, createResilientRepo(api, mirror))
}

/** Выход: в серверном режиме прекратить сохранять. */
export function disconnectBackend(): void {
  if (!REMOTE) return
  disconnectWorkspace()
}
