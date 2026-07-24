// Счета по умолчанию должны быть в ДДС ВСЕГДА: и на чистом листе,
// и в старых сохранённых снимках без счетов, и после удаления всех счетов.

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Provider } from 'react-redux'
import { makeStore } from './store'
import { hydrate, deleteAccount, ensureDefaultAccounts } from './store/dataSlice'
import { buildEmptySnapshot, withDefaultAccounts } from './data/fixtures'
import { createMemoryRepo } from './data/memoryRepo'
import { initPersistence } from './data/persistence'
import App from './App'

afterEach(cleanup)

const NAMES = ['Р/С', 'Наличные', 'Карта']

describe('счета по умолчанию', () => {
  it('чистый лист содержит три счёта', () => {
    expect(buildEmptySnapshot().accounts.map((a) => a.name)).toEqual(NAMES)
  })

  it('старый снимок без счетов дополняется при загрузке', async () => {
    const legacy = { ...buildEmptySnapshot(), accounts: [] }
    const store = makeStore()
    await initPersistence(store, createMemoryRepo(legacy))
    expect(store.getState().data.accounts.map((a) => a.name)).toEqual(NAMES)
  })

  it('withDefaultAccounts не трогает снимок, где счета уже есть', () => {
    const s = buildEmptySnapshot()
    const one = { ...s, accounts: [s.accounts[0]] }
    expect(withDefaultAccounts(one).accounts).toHaveLength(1)
  })

  it('открытие ДДС восстанавливает счета, если их нет (без перезагрузки)', () => {
    const store = makeStore()
    store.dispatch(hydrate({ ...buildEmptySnapshot(), accounts: [] }))
    expect(store.getState().data.accounts).toHaveLength(0)

    render(
      <Provider store={store}>
        <App />
      </Provider>,
    )

    expect(store.getState().data.accounts.map((a) => a.name)).toEqual(NAMES)
  })

  it('ensureDefaultAccounts идемпотентен', () => {
    const store = makeStore()
    store.dispatch(hydrate(buildEmptySnapshot()))
    store.dispatch(ensureDefaultAccounts())
    expect(store.getState().data.accounts).toHaveLength(3)

    // удалили все счета — следующий вызов вернёт их
    for (const a of [...store.getState().data.accounts]) store.dispatch(deleteAccount(a.id))
    expect(store.getState().data.accounts).toHaveLength(0)
    store.dispatch(ensureDefaultAccounts())
    expect(store.getState().data.accounts.map((a) => a.name)).toEqual(NAMES)
  })
})
