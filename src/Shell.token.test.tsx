import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Provider } from 'react-redux'
import { makeStore } from './store'
import { clearUsername } from './features/session/session'

// Серверный режим включаем подменой модуля: VITE_API_URL в тестах пуст, а нам нужно
// проверить именно возврат из бота и восстановление сохранённой сессии.
const connectWithToken = vi.fn(async (_token: string) => ({ name: 'Вика', workspace: 'tg:8' }))
const restoreSession = vi.fn(async () => null as { name: string; workspace: string } | null)

vi.mock('./data/backend', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./data/backend')>()
  return {
    ...actual,
    REMOTE: true,
    connectTelegram: vi.fn(async () => null),
    connectBackend: vi.fn(async () => {}),
    fetchPublicConfig: vi.fn(async () => null),
    connectWithToken: (t: string) => connectWithToken(t),
    restoreSession: () => restoreSession(),
  }
})

const Shell = (await import('./Shell')).default

afterEach(cleanup)
beforeEach(() => {
  clearUsername()
  connectWithToken.mockClear()
  restoreSession.mockClear()
  restoreSession.mockResolvedValue(null)
})

function renderShell() {
  return render(
    <Provider store={makeStore()}>
      <Shell />
    </Provider>,
  )
}

describe('Возврат из бота и сохранённая сессия', () => {
  it('токен из ссылки логинит и исчезает из адреса', async () => {
    window.history.pushState({}, '', '/login#token=bearer-123&oauth=1')
    renderShell()

    expect(await screen.findByText('Выберите модуль')).toBeInTheDocument()
    expect(connectWithToken).toHaveBeenCalledWith('bearer-123')
    expect(screen.getByText(/Здравствуйте, Вика/)).toBeInTheDocument()
    // токен не остаётся ни в адресе, ни в истории вкладки
    expect(window.location.hash).toBe('')
    expect(window.location.pathname).toBe('/app')
  })

  it('негодный токен возвращает на вход с объяснением', async () => {
    connectWithToken.mockResolvedValueOnce(null as never)
    window.history.pushState({}, '', '/login#token=stale')
    renderShell()

    expect(await screen.findByText(/Ссылка для входа устарела/)).toBeInTheDocument()
  })

  it('негодный токен не пускает под ранее сохранённым профилем', async () => {
    // Классический случай: в браузере осталась сессия одного человека, а по
    // ссылке из бота приходит другой. Ссылка протухла — значит вход не состоялся,
    // и показать чужой кабинет нельзя ни при каких условиях.
    connectWithToken.mockResolvedValueOnce(null as never)
    restoreSession.mockResolvedValue({ name: 'Алекс', workspace: 'tg:9' })
    window.history.pushState({}, '', '/login#token=stale')
    renderShell()

    expect(await screen.findByText(/Ссылка для входа устарела/)).toBeInTheDocument()
    expect(screen.queryByText(/Здравствуйте, Алекс/)).toBeNull()
    expect(screen.queryByText('Выберите модуль')).toBeNull()
  })

  it('сохранённая сессия открывает кабинет без экрана входа', async () => {
    restoreSession.mockResolvedValue({ name: 'Алекс', workspace: 'tg:9' })
    window.history.pushState({}, '', '/app')
    renderShell()

    expect(await screen.findByText(/Здравствуйте, Алекс/)).toBeInTheDocument()
  })
})
