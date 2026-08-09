import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import LoginScreen from './LoginScreen'

afterEach(() => {
  cleanup()
  window.history.replaceState({}, '', '/login')
})

// Тесты идут в локальном режиме (VITE_API_URL пуст): провайдеры недоступны,
// поэтому проверяем видимую логику экрана — подсказки, запасной вход, ошибку.
describe('Экран входа', () => {
  it('обе кнопки провайдеров неактивны, пока сервер их не включил', () => {
    render(<LoginScreen onLogin={() => {}} />)
    expect(screen.getByRole('button', { name: /Войти через Telegram/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Войти через Google/ })).toBeDisabled()
    // при выключенных провайдерах предлагается запасной путь
    expect(screen.getByRole('button', { name: 'Войти по имени' })).toBeInTheDocument()
  })

  it('вход по имени отдаёт введённый юзернейм', () => {
    let entered: string | null = null
    render(<LoginScreen onLogin={(u) => { entered = u }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Войти по имени' }))
    fireEvent.change(screen.getByLabelText('Юзернейм'), { target: { value: '  Алекс  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
    expect(entered).toBe('Алекс')
  })

  it('устаревшая ссылка из бота объясняется человеку', () => {
    window.history.replaceState({}, '', '/login?error=auth_expired')
    render(<LoginScreen onLogin={() => {}} />)
    expect(screen.getByText(/Ссылка для входа устарела/)).toBeInTheDocument()
  })

  it('без ошибки в адресе сообщения нет', () => {
    render(<LoginScreen onLogin={() => {}} />)
    expect(screen.queryByText(/Ссылка для входа устарела/)).toBeNull()
  })
})
