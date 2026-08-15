// Хранилище через API (Фаза 4). Тот же интерфейс Repository, что и IndexedDB,
// поэтому переключение не затрагивает UI и движок. Снимок целиком — как в idbRepo.
//
// Бэкенд — тонкое хранилище: он не разбирает суммы. Деньги (bigint) едут в теле
// запроса тегированными объектами {"$bigint": "..."} и восстанавливаются здесь же
// при чтении. Каждому пользователю — своё «рабочее пространство» (workspace).

import type { DataSnapshot } from '../domain/types'
import type { Repository } from './repository'
import { bigintReplacer, bigintReviver } from './json'
import { t } from '../i18n'

function endpoint(baseUrl: string, workspace: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  return `${base}/api/snapshot/${encodeURIComponent(workspace)}`
}

/**
 * @param token — JWT для Telegram-пространств (tg:*): уходит в Authorization.
 *   Для обычных имён (локально/LAN) не нужен.
 */
export function createApiRepo(baseUrl: string, workspace: string, token?: string): Repository {
  const url = endpoint(baseUrl, workspace)
  const headers = (extra?: Record<string, string>): Record<string, string> =>
    token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra }
  return {
    async load() {
      const res = await fetch(url, { headers: headers() })
      if (res.status === 404) return null
      if (!res.ok) throw new Error(t('net.error.load', { status: res.status }))
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
        headers: headers({ 'Content-Type': 'application/json' }),
        body,
      })
      if (!res.ok) throw new Error(t('net.error.save', { status: res.status }))
    },
    async clear() {
      const res = await fetch(url, { method: 'DELETE', headers: headers() })
      if (!res.ok && res.status !== 404) throw new Error(t('net.error.clear', { status: res.status }))
    },
  }
}
