import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { makeStore } from './store'
import App from './App'

afterEach(cleanup)

function renderApp() {
  return render(
    <Provider store={makeStore()}>
      <App />
    </Provider>,
  )
}

describe('App (рабочая область ДДС) монтируется без ошибок рантайма', () => {
  it('шапка и вкладки на месте', () => {
    renderApp()
    expect(screen.getByText('ДДС — движение денежных средств')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Отчёт ДДС' })).toBeInTheDocument()
  })

  it('вкладка «Отчёт ДДС» показывает авто-статьи, итоги и зелёную панель проверок', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Отчёт ДДС' }))
    expect(screen.getByText('Поступления')).toBeInTheDocument()
    expect(screen.getByText('ИТОГО поступления')).toBeInTheDocument()
    expect(screen.getByText('ИТОГО остаток')).toBeInTheDocument()
    expect(screen.getByText(/Все контрольные суммы сходятся/)).toBeInTheDocument()
  })

  it('вкладка «Справочники» показывает счета и категории', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Справочники' }))
    expect(screen.getByText('Счета')).toBeInTheDocument()
    expect(screen.getByText('Категории')).toBeInTheDocument()
  })

  it('вкладка «Шаблон»: авто-режим, «Настроить вручную» открывает редактор дерева', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Шаблон' }))
    // ДДС по умолчанию автоматический — виден пояснительный блок, а не редактор
    expect(screen.getByText('Отчёт ДДС — автоматический')).toBeInTheDocument()
    // переходим в ручной режим
    fireEvent.click(screen.getByRole('button', { name: 'Настроить вручную' }))
    expect(screen.getByText('Версии шаблона')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Статья верхнего уровня' })).toBeInTheDocument()
  })
})
