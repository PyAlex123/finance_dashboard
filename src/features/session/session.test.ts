import { describe, it, expect, beforeEach } from 'vitest'
import { getUsername, setUsername, clearUsername } from './session'

describe('сессия (localStorage)', () => {
  beforeEach(() => clearUsername())

  it('по умолчанию юзернейма нет', () => {
    expect(getUsername()).toBeNull()
  })

  it('set/get/clear юзернейма', () => {
    setUsername('Алекс')
    expect(getUsername()).toBe('Алекс')
    clearUsername()
    expect(getUsername()).toBeNull()
  })
})
