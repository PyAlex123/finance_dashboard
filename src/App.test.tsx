import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { makeStore } from './store'
import App from './App'

afterEach(cleanup)

function renderApp() {
  return render(
    <Provider store={makeStore()}>
      <App />
    </Provider>,
  )
}

describe('App монтируется без ошибок рантайма', () => {
  it('шапка и вкладки на месте', () => {
    renderApp()
    expect(screen.getByText('Финансовые отчёты — ДДС')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Отчёт ДДС' })).toBeInTheDocument()
  })

  it('вкладка «Отчёт ДДС» показывает статьи, итоги и зелёную панель проверок', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Отчёт ДДС' }))
    expect(screen.getByText('Итоги за период')).toBeInTheDocument()
    expect(screen.getByText('Общий приход')).toBeInTheDocument()
    expect(screen.getByText('ИТОГО по всем счетам')).toBeInTheDocument()
    expect(screen.getByText(/Все контрольные суммы сходятся/)).toBeInTheDocument()
  })

  it('вкладка «Справочники» показывает счета и категории', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Справочники' }))
    expect(screen.getByText('Счета')).toBeInTheDocument()
    expect(screen.getByText('Категории')).toBeInTheDocument()
  })
})
