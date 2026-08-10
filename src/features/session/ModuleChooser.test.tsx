import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Provider } from 'react-redux'
import { makeStore } from '../../store'
import ModuleChooser from './ModuleChooser'

afterEach(cleanup)

function renderChooser(props: Partial<Parameters<typeof ModuleChooser>[0]> = {}) {
  return render(
    <Provider store={makeStore()}>
      <ModuleChooser username="Alex" onPick={() => {}} {...props} />
    </Provider>,
  )
}

describe('Экран выбора модуля', () => {
  it('не показывает Telegram ID и подсказку про ADMIN_TG_IDS', () => {
    renderChooser()
    expect(screen.queryByText(/Telegram ID/i)).toBeNull()
    expect(screen.queryByText(/ADMIN_TG_IDS/)).toBeNull()
  })

  it('админу тоже не показывает — он уже админ', () => {
    renderChooser({ isAdmin: true, onOpenAdmin: () => {} })
    expect(screen.queryByText(/Telegram ID/i)).toBeNull()
    expect(screen.queryByText(/ADMIN_TG_IDS/)).toBeNull()
  })

  it('кнопка списка пользователей — только у админа', () => {
    renderChooser({ isAdmin: true, onOpenAdmin: () => {} })
    expect(screen.getByRole('button', { name: /Пользователи/ })).toBeInTheDocument()
  })

  it('обычный пользователь кнопки администрирования не видит', () => {
    renderChooser({ onOpenAdmin: () => {} })
    expect(screen.queryByRole('button', { name: /Пользователи/ })).toBeNull()
  })

  it('модули доступны всем, включая админа', () => {
    renderChooser({ isAdmin: true, onOpenAdmin: () => {} })
    expect(screen.getByRole('button', { name: /ДДС/ })).not.toBeDisabled()
  })
})
