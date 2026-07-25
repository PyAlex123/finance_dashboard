// Устойчивое хранилище: сервер лёг → работаем на локальной копии, save не бросает.

import { describe, it, expect, beforeEach } from 'vitest'
import { createResilientRepo } from './resilientRepo'
import { createMemoryRepo } from './memoryRepo'
import { getConnectivity } from './connectivity'
import { buildEmptySnapshot } from './fixtures'
import type { Repository } from './repository'
import type { DataSnapshot } from '../domain/types'

/** Репозиторий, который всегда падает по сети. */
function deadRepo(): Repository {
  return {
    load: async () => { throw new TypeError('Failed to fetch') },
    save: async () => { throw new TypeError('Failed to fetch') },
    clear: async () => { throw new TypeError('Failed to fetch') },
  }
}

describe('createResilientRepo', () => {
  let backup: Repository
  beforeEach(() => { backup = createMemoryRepo() })

  it('сервер недоступен: save НЕ бросает и пишет в локальный бэкап', async () => {
    const repo = createResilientRepo(deadRepo(), backup)
    const snap = buildEmptySnapshot()
    await expect(repo.save(snap)).resolves.toBeUndefined() // не бросает
    expect(await backup.load()).not.toBeNull() // данные в локальном бэкапе
    expect(getConnectivity()).toBe('offline')
  })

  it('сервер недоступен: load поднимает локальную копию', async () => {
    await backup.save(buildEmptySnapshot())
    const repo = createResilientRepo(deadRepo(), backup)
    const loaded = await repo.load()
    expect(loaded).not.toBeNull()
    expect(getConnectivity()).toBe('offline')
  })

  it('сервер доступен: load отдаёт серверные данные и зеркалит их локально', async () => {
    const serverSnap: DataSnapshot = { ...buildEmptySnapshot() }
    const primary = createMemoryRepo(serverSnap)
    const repo = createResilientRepo(primary, backup)
    const loaded = await repo.load()
    expect(loaded).not.toBeNull()
    expect(getConnectivity()).toBe('online')
    // локальное зеркало заполнилось
    expect(await backup.load()).not.toBeNull()
  })
})
