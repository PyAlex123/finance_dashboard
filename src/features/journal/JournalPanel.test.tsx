import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { makeStore } from '../../store'
import { hydrate } from '../../store/dataSlice'
import { buildEmptySnapshot } from '../../data/fixtures'
import JournalPanel from './JournalPanel'
import { todayIso } from './rowEdit'

afterEach(cleanup)

function renderPanel() {
  const store = makeStore()
  store.dispatch(hydrate(buildEmptySnapshot()))
  render(
    <Provider store={store}>
      <JournalPanel />
    </Provider>,
  )
  return store
}

describe('JournalPanel — быстрый ввод', () => {
  it('кнопка «Сегодня» создаёт строку с сегодняшней датой', () => {
    const store = renderPanel()
    expect(store.getState().data.operations).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Сегодня' }))

    const ops = store.getState().data.operations
    expect(ops).toHaveLength(1)
    expect(ops[0].date).toBe(todayIso())
    expect(ops[0].type).toBe('expense')
  })

  it('«+ Счёт» добавляет счёт с автоматическим кодом', () => {
    const store = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: '+ Счёт' }))
    fireEvent.change(screen.getByPlaceholderText('Название счёта'), { target: { value: 'Депозит' } })
    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }))

    const accounts = store.getState().data.accounts
    expect(accounts.map((a) => a.name)).toContain('Депозит')
    expect(accounts.find((a) => a.name === 'Депозит')!.code).toBe('depozit')
  })

  it('счета по умолчанию уже есть — вводить можно сразу', () => {
    const store = renderPanel()
    expect(store.getState().data.accounts.map((a) => a.name)).toEqual(['Р/С', 'Наличные', 'Карта'])
  })
})
