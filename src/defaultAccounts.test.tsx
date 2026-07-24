// Счета по умолчанию (Р/С, Наличные, Карта) должны появляться в ДДС,
// в том числе когда часть счетов пользователь уже завёл сам.

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Provider } from 'react-redux'
import { makeStore } from './store'
import { hydrate, deleteAccount, ensureDefaultAccounts } from './store/dataSlice'
import { buildEmptySnapshot } from './data/fixtures'
import App from './App'
import type { Account, DataSnapshot } from './domain/types'

afterEach(cleanup)

const NAMES = ['Р/С', 'Наличные', 'Карта']

function snapshotWith(accounts: Account[]): DataSnapshot {
  return { ...buildEmptySnapshot(), accounts, defaultsSeeded: false }
}

function openDds(snapshot: DataSnapshot) {
  const store = makeStore()
  store.dispatch(hydrate(snapshot))
  render(
    <Provider store={store}>
      <App />
    </Provider>,
  )
  return store
}

describe('счета по умолчанию', () => {
  it('чистый лист содержит три счёта', () => {
    expect(buildEmptySnapshot().accounts.map((a) => a.name)).toEqual(NAMES)
  })

  it('пустой справочник: при открытии ДДС появляются все три', () => {
    const store = openDds(snapshotWith([]))
    expect(store.getState().data.accounts.map((a) => a.name)).toEqual(NAMES)
  })

  it('РЕАЛЬНЫЙ СЛУЧАЙ: есть «Карта» и «Карта (USD)» → добавляются Р/С и Наличные', () => {
    const existing: Account[] = [
      { id: 'a1', code: 'karta', name: 'Карта', currency: 'UZS', order: 1, active: true },
      { id: 'a2', code: 'karta_usd', name: 'Карта (USD)', currency: 'USD', order: 2, active: true },
    ]
    const store = openDds(snapshotWith(existing))

    const names = store.getState().data.accounts.map((a) => a.name)
    expect(names).toContain('Р/С')
    expect(names).toContain('Наличные')
    // дубля «Карты» не создаётся — она уже была
    expect(names.filter((n) => n === 'Карта')).toHaveLength(1)
    expect(names).toContain('Карта (USD)')
    expect(store.getState().data.accounts).toHaveLength(4)
  })

  it('счёт с таким же кодом не дублируется', () => {
    const existing: Account[] = [
      { id: 'a1', code: 'cash', name: 'Моя касса', currency: 'UZS', order: 1, active: true },
    ]
    const store = openDds(snapshotWith(existing))
    const codes = store.getState().data.accounts.map((a) => a.code)
    expect(codes.filter((c) => c === 'cash')).toHaveLength(1)
    expect(codes).toContain('settlement')
    expect(codes).toContain('card')
  })

  it('после создания удалённые счета не возвращаются', () => {
    const store = makeStore()
    store.dispatch(hydrate(snapshotWith([])))
    store.dispatch(ensureDefaultAccounts())
    expect(store.getState().data.accounts).toHaveLength(3)

    const cash = store.getState().data.accounts.find((a) => a.name === 'Наличные')!
    store.dispatch(deleteAccount(cash.id))
    store.dispatch(ensureDefaultAccounts()) // повторный вызов ничего не возвращает
    expect(store.getState().data.accounts.map((a) => a.name)).toEqual(['Р/С', 'Карта'])
  })
})
