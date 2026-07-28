// Определение запуска внутри Telegram и чтение initData.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { isTelegram, telegramInitData } from './telegram'

afterEach(() => { vi.unstubAllGlobals() })

describe('telegram detection', () => {
  it('вне Telegram: isTelegram()=false, initData пустой', () => {
    expect(isTelegram()).toBe(false)
    expect(telegramInitData()).toBe('')
  })

  it('внутри Telegram (есть initData): isTelegram()=true', () => {
    vi.stubGlobal('Telegram', {
      WebApp: { initData: 'auth_date=1&user=%7B%7D&hash=abc', ready: () => {} },
    })
    expect(isTelegram()).toBe(true)
    expect(telegramInitData()).toContain('hash=abc')
  })

  it('пустой initData (открыт вне Telegram-контекста) → false', () => {
    vi.stubGlobal('Telegram', { WebApp: { initData: '', ready: () => {} } })
    expect(isTelegram()).toBe(false)
  })
})
