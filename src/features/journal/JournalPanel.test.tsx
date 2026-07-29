import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { makeStore } from '../../store'
import { hydrate, deleteOperation } from '../../store/dataSlice'
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
  it('кнопка «Сегодня» открывает попап с подставленной сегодняшней датой', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Сегодня' }))

    expect(screen.getByText('Новая операция')).toBeInTheDocument()
    expect((screen.getByLabelText('Дата') as HTMLInputElement).value).toBe(todayIso())
  })

  it('попап создаёт операцию на сегодня', () => {
    const store = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Сегодня' }))
    fireEvent.change(screen.getByPlaceholderText('650 000'), { target: { value: '500000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }))

    const ops = store.getState().data.operations
    expect(ops).toHaveLength(1)
    expect(ops[0].date).toBe(todayIso())
    expect(screen.queryByText('Новая операция')).toBeNull() // попап закрылся
  })

  it('по умолчанию тип — приход, а не расход', () => {
    const store = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Сегодня' }))
    fireEvent.change(screen.getByPlaceholderText('650 000'), { target: { value: '100000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }))

    const op = store.getState().data.operations[0]
    expect(op.type).toBe('income')
    // приход записывается положительной проводкой
    expect(store.getState().data.operationLines[0].amount > 0n).toBe(true)
  })

  it('удаление операции убирает её вместе с проводками', () => {
    const store = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Сегодня' }))
    fireEvent.change(screen.getByPlaceholderText('650 000'), { target: { value: '100000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }))
    const id = store.getState().data.operations[0].id

    store.dispatch(deleteOperation(id))
    expect(store.getState().data.operations).toHaveLength(0)
    expect(store.getState().data.operationLines).toHaveLength(0)
  })

  it('категорию можно создать прямо в попапе', () => {
    const store = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Сегодня' }))
    fireEvent.click(screen.getByRole('button', { name: '＋ Новая' }))
    fireEvent.change(screen.getByPlaceholderText('Название категории'), { target: { value: 'Аренда' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    const cats = store.getState().data.categories
    expect(cats.map((c) => c.name)).toContain('Аренда')
    expect(cats[0].direction).toBe('in') // тип по умолчанию — приход
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
