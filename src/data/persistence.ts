// Гидрация стора из хранилища при старте и автосохранение изменений (с дебаунсом).

import type { AppStore } from '../store'
import { hydrate } from '../store/dataSlice'
import { normalizeSnapshot } from './json'
import { buildEmptySnapshot, withDefaultAccounts } from './fixtures'
import type { Repository } from './repository'

export async function initPersistence(store: AppStore, repo: Repository): Promise<void> {
  try {
    const saved = await repo.load()
    // Есть сохранённые данные — грузим их (старые снимки без счетов дополняем
    // счетами по умолчанию); иначе стартуем с чистого листа.
    store.dispatch(hydrate(saved ? withDefaultAccounts(normalizeSnapshot(saved)) : buildEmptySnapshot()))
  } catch (e) {
    console.warn('Не удалось загрузить сохранённые данные:', e)
    store.dispatch(hydrate(buildEmptySnapshot()))
  }

  let timer: ReturnType<typeof setTimeout> | null = null
  store.subscribe(() => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      repo.save(store.getState().data).catch((e) => console.warn('Ошибка сохранения:', e))
    }, 400)
  })
}
