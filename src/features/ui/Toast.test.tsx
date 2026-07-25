// Тосты: flash показывает сообщение, оно исчезает по таймеру.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { ToastProvider, useToast } from './Toast'

afterEach(cleanup)

function Probe() {
  const flash = useToast()
  return <button onClick={() => flash('Готово ✓')}>flash</button>
}

describe('Toast', () => {
  it('показывает сообщение по flash и скрывает по таймеру', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>,
    )
    expect(screen.queryByRole('status')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'flash' }))
    expect(screen.getByRole('status')).toHaveTextContent('Готово ✓')

    act(() => { vi.advanceTimersByTime(2600) })
    expect(screen.queryByRole('status')).toBeNull()
    vi.useRealTimers()
  })

  it('useToast без провайдера — no-op (не падает)', () => {
    render(<Probe />)
    fireEvent.click(screen.getByRole('button', { name: 'flash' }))
    expect(screen.queryByRole('status')).toBeNull()
  })
})
