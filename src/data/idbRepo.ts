// Хранилище IndexedDB (Фаза 1). Тот же интерфейс Repository, что и memoryRepo,
// поэтому переключение на API в Фазе 4 не затронет UI и движок.
// structuredClone IndexedDB поддерживает bigint — суммы хранятся как есть.

import { openDB, type IDBPDatabase } from 'idb'
import type { DataSnapshot } from '../domain/types'
import type { Repository } from './repository'

const DB_NAME = 'fin-reports'
const STORE = 'kv'
const DEFAULT_KEY = 'snapshot'

async function db(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE)
    },
  })
}

/**
 * Хранилище IndexedDB. key разделяет данные: в серверном режиме используется как
 * локальный бэкап на рабочее пространство (напр. `snapshot:Алекс`).
 */
export function createIdbRepo(key: string = DEFAULT_KEY): Repository {
  return {
    async load() {
      const d = await db()
      const snapshot = (await d.get(STORE, key)) as DataSnapshot | undefined
      return snapshot ?? null
    },
    async save(snapshot) {
      const d = await db()
      await d.put(STORE, snapshot, key)
    },
    async clear() {
      const d = await db()
      await d.delete(STORE, key)
    },
  }
}
