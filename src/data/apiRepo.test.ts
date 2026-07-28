// apiRepo: снимок ходит на сервер целиком; суммы (bigint) переживают сеть
// благодаря тегам {$bigint}. Бэкенд их не разбирает — здесь мокаем fetch.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createApiRepo } from './apiRepo'
import { buildEmptySnapshot } from './fixtures'
import type { DataSnapshot } from '../domain/types'

const BASE = 'http://192.168.0.10:8000'
const WS = 'алиса'

function withMoney(): DataSnapshot {
  const snap = buildEmptySnapshot()
  snap.operations = [
    { id: 'op1', date: '2025-03-01', type: 'income', description: 'тест', categoryId: null },
  ]
  snap.operationLines = [
    { id: 'ln1', operationId: 'op1', accountId: 'a1', amount: 1234567n, currency: 'UZS' },
  ]
  return snap
}

afterEach(() => vi.unstubAllGlobals())

describe('apiRepo', () => {
  let lastRequest: { url: string; init?: RequestInit }
  beforeEach(() => {
    lastRequest = { url: '' }
  })

  it('save кодирует bigint в {$bigint} и шлёт PUT', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        lastRequest = { url, init }
        return new Response(null, { status: 200 })
      }),
    )
    const repo = createApiRepo(BASE, WS)
    await repo.save(withMoney())

    expect(lastRequest.url).toBe(`${BASE}/api/snapshot/${encodeURIComponent(WS)}`)
    expect(lastRequest.init?.method).toBe('PUT')
    const body = String(lastRequest.init?.body)
    // сумма закодирована тегом, а не голым bigint (который JSON не умеет)
    expect(body).toContain('"$bigint":"1234567"')
  })

  it('load восстанавливает bigint из ответа сервера', async () => {
    const stored = JSON.stringify({ data: { amount: { $bigint: '999' } } })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(stored, { status: 200 })))
    const repo = createApiRepo(BASE, WS)
    const loaded = (await repo.load()) as unknown as { amount: bigint }
    expect(loaded.amount).toBe(999n)
  })

  it('load возвращает null на 404 (пустое пространство)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 404 })))
    const repo = createApiRepo(BASE, WS)
    expect(await repo.load()).toBeNull()
  })

  it('save бросает ошибку при не-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })))
    const repo = createApiRepo(BASE, WS)
    await expect(repo.save(buildEmptySnapshot())).rejects.toThrow(/500/)
  })

  it('с токеном добавляет Authorization: Bearer (для Telegram-пространств)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        lastRequest = { url, init }
        return new Response(null, { status: 200 })
      }),
    )
    const repo = createApiRepo(BASE, 'tg:7', 'jwt-token-123')
    await repo.save(buildEmptySnapshot())
    const headers = lastRequest.init?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer jwt-token-123')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('без токена заголовка Authorization нет', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        lastRequest = { url, init }
        return new Response(null, { status: 200 })
      }),
    )
    const repo = createApiRepo(BASE, WS)
    await repo.save(buildEmptySnapshot())
    const headers = lastRequest.init?.headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })
})
