// Хранилище через API (Фаза 4). Тот же интерфейс Repository, что и IndexedDB,
// поэтому переключение не затрагивает UI и движок. Снимок целиком — как в idbRepo.
//
// Бэкенд — тонкое хранилище: он не разбирает суммы. Деньги (bigint) едут в теле
// запроса тегированными объектами {"$bigint": "..."} и восстанавливаются здесь же
// при чтении. Каждому пользователю — своё «рабочее пространство» (workspace).

import type { DataSnapshot } from '../domain/types'
import type { Repository } from './repository'
import { bigintReplacer, bigintReviver } from './json'

function endpoint(baseUrl: string, workspace: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  return `${base}/api/snapshot/${encodeURIComponent(workspace)}`
}

export function createApiRepo(baseUrl: string, workspace: string): Repository {
  const url = endpoint(baseUrl, workspace)
  return {
    async load() {
      const res = await fetch(url)
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`Сервер вернул ${res.status} при загрузке`)
      const text = await res.text()
      if (!text) return null
      // Тело: { data: <снимок с тегами $bigint> }
      const env = JSON.parse(text, bigintReviver) as { data?: DataSnapshot | null }
      return env.data ?? null
    },
    async save(snapshot) {
      const body = JSON.stringify({ data: snapshot }, bigintReplacer)
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      if (!res.ok) throw new Error(`Сервер вернул ${res.status} при сохранении`)
    },
    async clear() {
      const res = await fetch(url, { method: 'DELETE' })
      if (!res.ok && res.status !== 404) throw new Error(`Сервер вернул ${res.status} при очистке`)
    },
  }
}
