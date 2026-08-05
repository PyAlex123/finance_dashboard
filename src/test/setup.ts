import '@testing-library/jest-dom/vitest'

// jsdom не реализует scrollTo (его зовёт переход между страницами) — тихая заглушка.
if (typeof window !== 'undefined') {
  window.scrollTo = (() => {}) as typeof window.scrollTo
}

// jsdom не реализует matchMedia — минимальная заглушка (по умолчанию десктоп).
// Тесты, которым нужен мобильный режим, переопределяют window.matchMedia.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
