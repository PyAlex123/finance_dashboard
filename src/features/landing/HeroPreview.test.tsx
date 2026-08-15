// Превью в первом экране: подпись валюты обязана следовать за языком ДАЖЕ
// после того, как отработала анимация счётчика.
//
// Анимация пишет прямо в textContent своего элемента. Пока число и суффикс
// жили в одном узле, это присваивание схлопывало детей React в один текстовый
// узел, и элемент навсегда застревал на языке первой отрисовки: страница,
// открытая по-русски, показывала «сум» даже после переключения на английский.
// Поймано только живой проверкой в браузере — обычные тесты рендерили заново
// и потому проходили.

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import HeroPreview from './HeroPreview'
import { setLocaleForTests } from '../../i18n/locale'
import { moneySuffix } from '../../domain/money'

afterEach(() => {
  cleanup()
  setLocaleForTests('ru')
})

/** Имитация анимации: то же присваивание textContent, что делает countUp. */
function runCountUp(): void {
  for (const el of document.querySelectorAll<HTMLElement>('[data-count]')) {
    el.textContent = '1 782 500'
  }
}

describe('HeroPreview', () => {
  it('суффикс валюты и число живут в разных узлах', () => {
    render(<HeroPreview />)
    const counter = document.querySelector('[data-count]')
    expect(counter).not.toBeNull()
    // Анимируемый узел содержит ТОЛЬКО число: суффикса в нём быть не должно,
    // иначе присваивание textContent снова затрёт узел React.
    expect(counter!.textContent).not.toContain(moneySuffix('ru'))
  })

  it('после анимации подпись валюты всё ещё переключается', () => {
    const { rerender } = render(<HeroPreview />)
    act(() => runCountUp())
    expect(screen.getByText(new RegExp(moneySuffix('ru')))).toBeInTheDocument()

    setLocaleForTests('en')
    rerender(<HeroPreview />)

    expect(screen.getByText(new RegExp(moneySuffix('en')))).toBeInTheDocument()
    expect(screen.queryByText(new RegExp(moneySuffix('ru')))).not.toBeInTheDocument()
  })
})
