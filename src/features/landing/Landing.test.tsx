import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import Landing from './Landing'

afterEach(cleanup)

describe('Лендинг', () => {
  it('один H1 и все секции на месте', () => {
    const { container } = render(<Landing />)
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    for (const title of [
      'Деньги вроде есть, а где они — непонятно',
      'Три шага до полной картины',
      'Ваш бизнес — под контролем, у бухгалтера — порядок',
      'Всё, чего не хватало в таблице',
      'Ваши цифры остаются вашими',
      'Заодно научитесь финансовому мышлению',
      'Наведите порядок в деньгах уже сегодня',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
  })

  it('якоря навигации ведут на существующие секции', () => {
    const { container } = render(<Landing />)
    for (const id of ['top', 'how', 'audience', 'features', 'learn']) {
      expect(container.querySelector(`#${id}`)).not.toBeNull()
    }
  })

  it('бургер открывает и закрывает мобильное меню', () => {
    const { container } = render(<Landing />)
    const menu = container.querySelector('.lp-menu')!
    expect(menu.classList.contains('is-open')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Меню' }))
    expect(menu.classList.contains('is-open')).toBe(true)
    fireEvent.click(screen.getAllByRole('link', { name: 'Возможности' })[1])
    expect(menu.classList.contains('is-open')).toBe(false)
  })

  it('вошедшему пользователю вместо «Войти» предлагается кабинет', () => {
    render(<Landing loggedIn />)
    expect(screen.getAllByRole('link', { name: 'Открыть кабинет' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('link', { name: 'Войти' })).toBeNull()
  })
})
