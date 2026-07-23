// Хранилище в памяти (Фаза 0 и тесты). Данные не переживают перезагрузку.

import type { DataSnapshot } from '../domain/types'
import type { Repository } from './repository'
import { buildFixtureSnapshot } from './fixtures'

export function createMemoryRepo(seed?: DataSnapshot): Repository {
  let store: DataSnapshot | null = seed ? structuredClone(seed) : null
  return {
    async load() {
      return store ? structuredClone(store) : null
    },
    async save(snapshot) {
      store = structuredClone(snapshot)
    },
    async clear() {
      store = null
    },
  }
}

/** Репозиторий, всегда отдающий учебную фикстуру (Фаза 0). */
export function createFixtureRepo(): Repository {
  return createMemoryRepo(buildFixtureSnapshot())
}
