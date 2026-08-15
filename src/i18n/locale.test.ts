// Определение и хранение языка. Модуль i18n/locale.ts вычисляет локаль в теле
// модуля, поэтому здесь всё крутится вокруг detectLocale(): её можно звать заново
// при подменённом окружении, не полагаясь на порядок импортов.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { detectLocale, LANG_KEY } from './detect'
import { getLocale, setLocale, setLocaleForTests, subscribeLocale, initLocale } from './locale'

// В этой jsdom-среде globalThis.localStorage есть, но неполон (нет clear). Ставим
// рабочую заглушку в памяти: тест проверяет логику выбора языка, а не хранилище.
// Сам продукт от такой среды защищён пробой записи в detect.ts → langStorage().
function installStorage(): void {
  let store: Record<string, string> = {}
  const stub: Storage = {
    get length() {
      return Object.keys(store).length
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = String(v)
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    clear: () => {
      store = {}
    },
  }
  vi.stubGlobal('localStorage', stub)
}

function setNavigatorLanguages(langs: string[]): void {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(langs)
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(langs[0] ?? '')
}

function setTelegramLanguage(code: string | undefined): void {
  window.Telegram = code
    ? ({ WebApp: { initData: '', ready: () => {}, initDataUnsafe: { user: { language_code: code } } } } as typeof window.Telegram)
    : undefined
}

describe('detectLocale', () => {
  beforeEach(() => {
    installStorage()
    setTelegramLanguage(undefined)
    setNavigatorLanguages(['ru-RU'])
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    setTelegramLanguage(undefined)
    setLocaleForTests('ru')
  })

  it('явный выбор пользователя бьёт и Telegram, и браузер', () => {
    localStorage.setItem(LANG_KEY, 'en')
    setTelegramLanguage('ru')
    setNavigatorLanguages(['uz-UZ'])
    expect(detectLocale()).toBe('en')
  })

  it('язык клиента Telegram бьёт язык браузера', () => {
    setTelegramLanguage('en')
    setNavigatorLanguages(['ru-RU'])
    expect(detectLocale()).toBe('en')
  })

  // Автоопределение выбирает только из ПРЕДЛОЖЕННЫХ языков: угадать узбекский
  // значило бы показать наполовину переведённый интерфейс человеку, который
  // даже не найдёт в переключателе, чем это выключить.
  it('не угадывает язык, которого нет в переключателе', () => {
    setTelegramLanguage('uz')
    setNavigatorLanguages(['uz-UZ'])
    expect(detectLocale()).toBe('ru')
  })

  // Но уже сделанный выбор отбирать нельзя — он живёт в хранилище.
  it('сохранённый непредложенный язык сохраняется', () => {
    localStorage.setItem(LANG_KEY, 'uz')
    setNavigatorLanguages(['en-US'])
    expect(detectLocale()).toBe('uz')
  })

  it('без Telegram берётся язык браузера', () => {
    setNavigatorLanguages(['en-GB'])
    expect(detectLocale()).toBe('en')
  })

  it('перебирает список языков браузера до первого поддержанного', () => {
    setNavigatorLanguages(['de-DE', 'fr-FR', 'en-US'])
    expect(detectLocale()).toBe('en')
  })

  it('неподдерживаемый язык скатывается к русскому', () => {
    setTelegramLanguage('de')
    setNavigatorLanguages(['fr-FR'])
    expect(detectLocale()).toBe('ru')
  })

  it('мусор в хранилище игнорируется, а не принимается за локаль', () => {
    localStorage.setItem(LANG_KEY, 'klingon')
    setNavigatorLanguages(['en-US'])
    expect(detectLocale()).toBe('en')
  })
})

describe('setLocale', () => {
  beforeEach(() => {
    installStorage()
    setLocaleForTests('ru')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    setLocaleForTests('ru')
  })

  it('сохраняет выбор и переживает перечитывание', () => {
    setLocale('en')
    expect(getLocale()).toBe('en')
    expect(localStorage.getItem(LANG_KEY)).toBe('en')
    initLocale()
    expect(getLocale()).toBe('en')
  })

  it('оповещает подписчиков и позволяет отписаться', () => {
    const seen: string[] = []
    const unsubscribe = subscribeLocale(() => seen.push(getLocale()))
    setLocale('en')
    setLocale('uz')
    unsubscribe()
    setLocale('ru')
    expect(seen).toEqual(['en', 'uz'])
  })

  it('повторная установка того же языка не будит подписчиков', () => {
    setLocale('en')
    let calls = 0
    const unsubscribe = subscribeLocale(() => calls++)
    setLocale('en')
    unsubscribe()
    expect(calls).toBe(0)
  })

  // Приватный режим Safari: getItem есть, а setItem бросает. Язык обязан
  // переключиться на текущую сессию, просто без запоминания.
  it('недоступное хранилище не роняет переключение языка', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('QuotaExceededError')
      },
      removeItem: () => {},
    })
    expect(() => setLocale('en')).not.toThrow()
    expect(getLocale()).toBe('en')
  })
})
