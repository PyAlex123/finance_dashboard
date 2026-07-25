// Устойчивое хранилище для серверного режима: основной репозиторий — API,
// но с локальным зеркалом (IndexedDB). Если сервер недоступен (сменилась сеть,
// бэкенд лёг) — приложение продолжает работать на локальной копии, данные не
// теряются, а save не бросает (нет спама в консоли). Статус связи — в setConnectivity.
//
// Модель «снимок целиком» делает это согласованным: как только сеть вернётся,
// следующее сохранение отправит на сервер полное актуальное состояние.

import type { Repository } from './repository'
import type { DataSnapshot } from '../domain/types'
import { setConnectivity } from './connectivity'

export function createResilientRepo(primary: Repository, backup: Repository): Repository {
  return {
    async load(): Promise<DataSnapshot | null> {
      try {
        const snap = await primary.load()
        setConnectivity('online')
        // кладём свежую копию в локальный бэкап для будущего офлайна
        if (snap) backup.save(snap).catch(() => {})
        return snap
      } catch {
        // сервер недоступен — поднимаем локальную копию
        setConnectivity('offline')
        try {
          return await backup.load()
        } catch {
          return null
        }
      }
    },

    async save(snapshot: DataSnapshot): Promise<void> {
      // локальный бэкап пишем всегда — данные не потеряются
      await backup.save(snapshot).catch(() => {})
      try {
        await primary.save(snapshot)
        setConnectivity('online')
      } catch {
        // сервер недоступен — не бросаем: снимок уже в локальном бэкапе
        setConnectivity('offline')
      }
    },

    async clear(): Promise<void> {
      await backup.clear().catch(() => {})
      try {
        await primary.clear()
      } catch {
        /* офлайн — локально уже очищено */
      }
    },
  }
}
