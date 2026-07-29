import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { makeStore } from './store'
import { hydrate } from './store/dataSlice'
import { buildEmptySnapshot } from './data/fixtures'
import Shell from './Shell'
import { clearUsername } from './features/session/session'

afterEach(cleanup)
beforeEach(() => clearUsername())

function renderShell(empty = false) {
  const store = makeStore()
  if (empty) store.dispatch(hydrate(buildEmptySnapshot()))
  return render(
    <Provider store={store}>
      <Shell />
    </Provider>,
  )
}

describe('Shell — поток экранов', () => {
  it('стартует с экрана входа', () => {
    renderShell()
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument()
  })

  it('вход по юзернейму → экран выбора модуля с приветствием', () => {
    renderShell()
    fireEvent.change(screen.getByLabelText('Юзернейм'), { target: { value: 'Алекс' } })
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
    expect(screen.getByText('Выберите модуль')).toBeInTheDocument()
    expect(screen.getByText(/Здравствуйте, Алекс/)).toBeInTheDocument()
  })

  it('активен только ДДС; P&L и Баланс — «Скоро» и неактивны', () => {
    renderShell()
    fireEvent.change(screen.getByLabelText('Юзернейм'), { target: { value: 'Ю' } })
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
    expect(screen.getAllByText('Скоро')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /P&L/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Баланс/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /ДДС/ })).not.toBeDisabled()
  })

  it('выбор ДДС открывает рабочую область; «← Модули» возвращает к выбору', () => {
    renderShell()
    fireEvent.change(screen.getByLabelText('Юзернейм'), { target: { value: 'Ю' } })
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
    fireEvent.click(screen.getByRole('button', { name: /ДДС/ }))
    expect(screen.getByText('ДДС — движение денежных средств')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '← Модули' }))
    expect(screen.getByText('Выберите модуль')).toBeInTheDocument()
  })

  it('«Выйти» возвращает на экран входа', () => {
    renderShell()
    fireEvent.change(screen.getByLabelText('Юзернейм'), { target: { value: 'Ю' } })
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
    fireEvent.click(screen.getByRole('button', { name: 'Выйти' }))
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument()
  })

  it('пустой ДДС показывает подсказку пустого отчёта', () => {
    renderShell(true)
    fireEvent.change(screen.getByLabelText('Юзернейм'), { target: { value: 'Ю' } })
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
    fireEvent.click(screen.getByRole('button', { name: /ДДС/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Отчёт ДДС' }))
    expect(screen.getByText('Отчёт пуст')).toBeInTheDocument()
  })
})
