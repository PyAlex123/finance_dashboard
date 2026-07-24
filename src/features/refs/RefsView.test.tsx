import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { makeStore } from '../../store'
import { hydrate } from '../../store/dataSlice'
import { buildEmptySnapshot, buildFixtureSnapshot } from '../../data/fixtures'
import { buildReport } from '../../engine/report'
import { fromMajor } from '../../domain/money'
import RefsView from './RefsView'
import type { DataSnapshot } from '../../domain/types'

afterEach(cleanup)

function renderRefs(snapshot: DataSnapshot = buildEmptySnapshot()) {
  const store = makeStore()
  store.dispatch(hydrate(snapshot))
  render(
    <Provider store={store}>
      <RefsView />
    </Provider>,
  )
  return store
}

describe('Справочники: автокоды (задание 4)', () => {
  it('счёт добавляется без ввода кода — код генерируется из названия', () => {
    const store = renderRefs()
    fireEvent.change(screen.getByPlaceholderText('название счёта'), { target: { value: 'Депозитный счёт' } })
    fireEvent.click(screen.getByRole('button', { name: 'Добавить счёт' }))

    const acc = store.getState().data.accounts.find((a) => a.name === 'Депозитный счёт')!
    expect(acc.code).toBe('depozitnyy_schet')
    // поля ввода кода больше нет
    expect(screen.queryByPlaceholderText('код')).toBeNull()
  })

  it('категория добавляется без кода, коды уникальны', () => {
    const store = renderRefs()
    const input = screen.getByPlaceholderText('название категории')
    const btn = screen.getByRole('button', { name: 'Добавить категорию' })
    fireEvent.change(input, { target: { value: 'Аренда' } })
    fireEvent.click(btn)
    fireEvent.change(input, { target: { value: 'Аренда' } })
    fireEvent.click(btn)

    const codes = store.getState().data.categories.map((c) => c.code)
    expect(codes).toEqual(['arenda', 'arenda_2'])
  })

  it('код редактируется и каскадно обновляет правила агрегатов — отчёт не ломается', () => {
    const store = renderRefs(buildFixtureSnapshot())
    const before = buildReport(store.getState().data, { form: 'cf' })
      .rows.find((r) => r.code === 'bal_cash')!.values

    // переименовываем код счёта cash_uzs → cash_main
    const codeInput = screen.getByDisplayValue('cash_uzs')
    fireEvent.change(codeInput, { target: { value: 'cash_main' } })
    fireEvent.blur(codeInput)

    const s = store.getState().data
    expect(s.accounts.find((a) => a.name === 'Наличные (сум)')!.code).toBe('cash_main')
    expect(s.items.find((i) => i.code === 'bal_cash')!.aggRule!.accountCode).toBe('cash_main')

    const after = buildReport(s, { form: 'cf' }).rows.find((r) => r.code === 'bal_cash')!.values
    expect(after).toEqual(before) // значения те же
  })

  it('дублирующий код отклоняется', () => {
    const store = renderRefs(buildFixtureSnapshot())
    const codeInput = screen.getByDisplayValue('cash_uzs')
    fireEvent.change(codeInput, { target: { value: 'card_uzs' } }) // уже занят
    fireEvent.blur(codeInput)
    expect(store.getState().data.accounts.find((a) => a.code === 'cash_uzs')).toBeDefined()
  })
})

describe('Справочники: валюты (задание 3)', () => {
  it('кнопка «+ USD» создаёт такой же счёт в долларах', () => {
    const store = renderRefs()
    // у каждого сумового счёта есть кнопка «+ USD»; берём второй — «Наличные»
    fireEvent.click(screen.getAllByTitle('Создать такой же счёт в USD')[1])

    const dup = store.getState().data.accounts.find((a) => a.name === 'Наличные (USD)')!
    expect(dup).toBeDefined()
    expect(dup.currency).toBe('USD')
    expect(dup.code).toBe('nalichnye_usd')
  })

  it('курс добавляется в справочник', () => {
    const store = renderRefs()
    fireEvent.change(screen.getByLabelText('Дата курса'), { target: { value: '2025-01-01' } })
    fireEvent.change(screen.getByPlaceholderText('курс, сум'), { target: { value: '12500' } })
    fireEvent.click(screen.getByRole('button', { name: 'Добавить курс' }))

    const rates = store.getState().data.rates
    expect(rates).toHaveLength(1)
    expect(rates[0].currency).toBe('USD')
    expect(rates[0].rate).toBe(fromMajor(12500))
  })
})
