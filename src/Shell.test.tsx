import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { makeStore } from './store'
import { hydrate } from './store/dataSlice'
import { buildEmptySnapshot } from './data/fixtures'
import Shell from './Shell'
import { clearUsername } from './features/session/session'
import { loadSession, saveSession } from './features/session/authSession'

afterEach(cleanup)
beforeEach(() => {
  clearUsername()
  window.history.pushState({}, '', '/') // каждый тест стартует с лендинга
})

function renderShell(empty = false) {
  const store = makeStore()
  if (empty) store.dispatch(hydrate(buildEmptySnapshot()))
  return render(
    <Provider store={store}>
      <Shell />
    </Provider>,
  )
}

/**
 * Путь пользователя в браузере: лендинг → «Начать бесплатно» → страница входа.
 * Вход через Telegram здесь недоступен (виджету нужны https и домен бота),
 * поэтому идём запасным путём — по имени.
 */
function loginAs(name: string) {
  fireEvent.click(screen.getAllByRole('link', { name: 'Начать бесплатно' })[0])
  fireEvent.click(screen.getByRole('button', { name: 'Войти по имени' }))
  fireEvent.change(screen.getByLabelText('Юзернейм'), { target: { value: name } })
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
}

describe('Shell — поток экранов', () => {
  it('стартует с лендинга', () => {
    renderShell()
    expect(
      screen.getByRole('heading', { name: /Все ваши деньги/, level: 1 }),
    ).toBeInTheDocument()
  })

  it('«Начать бесплатно» ведёт на страницу входа', () => {
    renderShell()
    fireEvent.click(screen.getAllByRole('link', { name: 'Начать бесплатно' })[0])
    expect(screen.getByRole('heading', { name: 'Войдите, чтобы продолжить' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Войти через Telegram/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Войти через Google/ })).toBeDisabled()
  })

  it('вход по юзернейму → экран выбора модуля с приветствием', () => {
    renderShell()
    loginAs('Алекс')
    expect(screen.getByText('Выберите модуль')).toBeInTheDocument()
    expect(screen.getByText(/Здравствуйте, Алекс/)).toBeInTheDocument()
  })

  it('активен только ДДС; P&L и Баланс — «Скоро» и неактивны', () => {
    renderShell()
    loginAs('Ю')
    expect(screen.getAllByText('Скоро')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /P&L/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Баланс/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /ДДС/ })).not.toBeDisabled()
  })

  it('выбор ДДС открывает рабочую область; «← Модули» возвращает к выбору', () => {
    renderShell()
    loginAs('Ю')
    fireEvent.click(screen.getByRole('button', { name: /ДДС/ }))
    expect(screen.getByText('ДДС — движение денежных средств')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '← Модули' }))
    expect(screen.getByText('Выберите модуль')).toBeInTheDocument()
  })

  it('«Выйти» возвращает на лендинг', () => {
    renderShell()
    loginAs('Ю')
    fireEvent.click(screen.getByRole('button', { name: 'Выйти' }))
    expect(
      screen.getByRole('heading', { name: /Все ваши деньги/, level: 1 }),
    ).toBeInTheDocument()
  })

  it('пустой ДДС: авто-отчёт показывает раздел остатков по счетам', () => {
    renderShell(true)
    loginAs('Ю')
    fireEvent.click(screen.getByRole('button', { name: /ДДС/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Отчёт ДДС' }))
    // отчёт формируется автоматически: даже без операций есть остатки по счетам
    expect(screen.getByText('Остатки по счетам')).toBeInTheDocument()
  })

  it('«Выйти» стирает сохранённую сессию', () => {
    saveSession({ token: 't', workspace: 'tg:8', name: 'Вика' })
    renderShell()
    loginAs('Ю')
    fireEvent.click(screen.getByRole('button', { name: 'Выйти' }))
    expect(loadSession()).toBeNull()
  })

  it('прямой путь /privacy открывает политику конфиденциальности', () => {
    window.history.pushState({}, '', '/privacy')
    renderShell()
    expect(
      screen.getByRole('heading', { name: 'Политика конфиденциальности', level: 1 }),
    ).toBeInTheDocument()
  })
})
