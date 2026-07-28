// Гидрация стора из хранилища и автосохранение изменений (с дебаунсом).
//
// Локальный режим (IndexedDB): грузим сразу при старте и сохраняем — как в Фазе 1.
// Серверный режим (API): рабочее пространство подключается ПОСЛЕ входа пользователя
// (connectWorkspace) и отключается при выходе (disconnectWorkspace). Автосейв —
// одна общая подписка, которая пишет в текущий активный репозиторий.

import type { AppStore } from '../store'
import { hydrate } from '../store/dataSlice'
import { normalizeSnapshot } from './json'
import { buildEmptySnapshot, withDefaultAccounts } from './fixtures'
import type { Repository } from './repository'
import type { DataSnapshot } from '../domain/types'

let activeRepo: Repository | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let subscribed = false
let boundStore: AppStore | null = null

function toStore(saved: DataSnapshot | null): DataSnapshot {
  // Старые снимки без счетов дополняем счетами по умолчанию; иначе — чистый лист.
  return saved ? withDefaultAccounts(normalizeSnapshot(saved)) : buildEmptySnapshot()
}

// Единственная подписка на стор. Пишет в activeRepo; при null (нет входа/идёт
// загрузка) — молчит, чтобы не затирать чужие данные.
function ensureAutosave(store: AppStore): void {
  boundStore = store
  if (subscribed) return
  subscribed = true
  store.subscribe(() => {
    const repo = activeRepo
    if (!repo) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      repo.save(store.getState().data).catch((e) => console.warn('Ошибка сохранения:', e))
    }, 400)
  })
}

/** Локальный режим (IndexedDB): загрузить сохранённое и включить автосейв. */
export async function initPersistence(store: AppStore, repo: Repository): Promise<void> {
  ensureAutosave(store)
  activeRepo = repo
  try {
    store.dispatch(hydrate(toStore(await repo.load())))
  } catch (e) {
    console.warn('Не удалось загрузить сохранённые данные:', e)
    store.dispatch(hydrate(buildEmptySnapshot()))
  }
}

/** Серверный режим: подключить рабочее пространство пользователя (после входа). */
export async function connectWorkspace(store: AppStore, repo: Repository): Promise<void> {
  ensureAutosave(store)
  activeRepo = null // приостановить автосейв, пока грузим (гидрация не должна писать обратно)
  try {
    store.dispatch(hydrate(toStore(await repo.load())))
  } catch (e) {
    console.warn('Не удалось загрузить данные с сервера:', e)
    store.dispatch(hydrate(buildEmptySnapshot()))
  } finally {
    activeRepo = repo // включить автосейв в это пространство
  }
}

/** Серверный режим: отключить (выход) — прекратить сохранять. */
export function disconnectWorkspace(): void {
  activeRepo = null
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
}

/**
 * Немедленно сохранить отложенные (дебаунс) изменения в текущий репозиторий, если
 * они есть. Нужно перед сменой отчёта, чтобы последние правки не потерялись при
 * переключении быстрее 400 мс.
 */
export async function flushPendingSave(): Promise<void> {
  if (!saveTimer) return
  clearTimeout(saveTimer)
  saveTimer = null
  const repo = activeRepo
  if (!repo || !boundStore) return
  try {
    await repo.save(boundStore.getState().data)
  } catch (e) {
    console.warn('Ошибка сохранения:', e)
  }
}
