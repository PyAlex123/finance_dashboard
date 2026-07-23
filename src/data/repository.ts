// Абстрактный слой хранилища. Клиент работает только через этот интерфейс,
// чтобы в Фазе 4 переключить IndexedDB → API без правок в UI и движке.
// Фаза 1 — хранилище снимком (load/save целиком); гранулярный CRUD живёт в сторе.

import type { DataSnapshot } from '../domain/types'

export interface Repository {
  /** Загрузить сохранённый слепок; null — если хранилище пустое. */
  load(): Promise<DataSnapshot | null>
  /** Сохранить весь слепок данных (без вычисленных значений). */
  save(snapshot: DataSnapshot): Promise<void>
  /** Очистить хранилище. */
  clear(): Promise<void>
}
