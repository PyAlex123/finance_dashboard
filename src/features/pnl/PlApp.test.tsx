import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { makeStore } from '../../store'
import { hydrate } from '../../store/dataSlice'
import { buildEmptySnapshot } from '../../data/fixtures'
import PlApp from './PlApp'

afterEach(cleanup)

// P&L сейчас скрыт заглушкой «Скоро» в выборе модулей, но сам компонент рабочей
// области жив — тестируем его напрямую (вернём в меню, когда снимем заглушку).
function openPl() {
  const store = makeStore()
  store.dispatch(hydrate(buildEmptySnapshot()))
  render(
    <Provider store={store}>
      <PlApp />
    </Provider>,
  )
}

describe('P&L рабочая область', () => {
  it('P&L открывается пустым с кнопками', () => {
    openPl()
    expect(screen.getByText('P&L — прибыли и убытки')).toBeInTheDocument()
    expect(screen.getByText('P&L пуст')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Стандартная структура P&L' })).toBeInTheDocument()
  })

  it('«Загрузить учебный пример» показывает значения из Excel', () => {
    openPl()
    fireEvent.click(screen.getByRole('button', { name: 'Загрузить учебный пример' }))
    // чистая прибыль за январь
    expect(screen.getByText('2 086 750')).toBeInTheDocument()
    // валовая прибыль за январь
    expect(screen.getByText('8 255 000')).toBeInTheDocument()
  })

  it('правка ячейки выручки пересчитывает чистую прибыль', () => {
    openPl()
    fireEvent.click(screen.getByRole('button', { name: 'Загрузить учебный пример' }))
    const cell = screen.getByDisplayValue('8000000') // групповые курсы, январь
    fireEvent.change(cell, { target: { value: '9000000' } })
    fireEvent.blur(cell)
    // +1 000 000 к выручке → +850 000 к чистой прибыли (2 086 750 → 2 936 750)
    expect(screen.getByText('2 936 750')).toBeInTheDocument()
  })

  it('вкладка «Шаблон» P&L показывает статьи P&L', () => {
    openPl()
    fireEvent.click(screen.getByRole('button', { name: 'Загрузить учебный пример' }))
    fireEvent.click(screen.getByRole('button', { name: 'Шаблон' }))
    const table = screen.getByRole('table')
    expect(within(table).getByDisplayValue('Чистая прибыль')).toBeInTheDocument()
  })
})
