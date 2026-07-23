// Хранилище IndexedDB (Фаза 1). Тот же интерфейс Repository, что и memoryRepo,
// поэтому переключение на API в Фазе 4 не затронет UI и движок.
// structuredClone IndexedDB поддерживает bigint — суммы хранятся как есть.

import { openDB, type IDBPDatabase } from 'idb'
import type { DataSnapshot } from '../domain/types'
import type { Repository } from './repository'

const DB_NAME = 'fin-reports'
const STORE = 'kv'
const KEY = 'snapshot'

async function db(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE)
    },
  })
}

export function createIdbRepo(): Repository {
  return {
    async load() {
      const d = await db()
      const snapshot = (await d.get(STORE, KEY)) as DataSnapshot | undefined
      return snapshot ?? null
    },
    async save(snapshot) {
      const d = await db()
      await d.put(STORE, snapshot, KEY)
    },
    async clear() {
      const d = await db()
      await d.delete(STORE, KEY)
    },
  }
}
