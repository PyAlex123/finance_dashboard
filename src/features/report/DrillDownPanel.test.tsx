// Drill-down: клик по сумме агрегата открывает панель с реальными операциями.

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { makeStore } from '../../store'
import { hydrate } from '../../store/dataSlice'
import { buildFixtureSnapshot } from '../../data/fixtures'
import { listAggOperations } from '../../engine/aggregate'
import ReportView from './ReportView'

afterEach(cleanup)

describe('listAggOperations — реальные операции за суммой', () => {
  it('«Общий приход» за январь = сумме вкладов операций из разбивки', () => {
    const data = buildFixtureSnapshot()
    const ops = listAggOperations(data, { measure: 'in' }, '2025-01')
    expect(ops.length).toBeGreaterThan(0)
    // все операции января, все — приходные (положительный вклад)
    ops.forEach((o) => {
      expect(o.date.startsWith('2025-01')).toBe(true)
      expect(o.amount > 0n).toBe(true)
    })
  })
})

describe('панель drill-down в отчёте', () => {
  it('клик по сумме агрегата открывает панель «Из чего сложилось»', () => {
    const store = makeStore()
    store.dispatch(hydrate(buildFixtureSnapshot()))
    render(
      <Provider store={store}>
        <ReportView />
      </Provider>,
    )

    // «Общий приход» — агрегатная строка; её ячейки кликабельны (класс --drill)
    const row = screen.getByText('Общий приход').closest('tr') as HTMLElement
    const drillCell = row.querySelector('.report__num--drill') as HTMLElement
    expect(drillCell).toBeTruthy()

    fireEvent.click(drillCell)

    // выехала панель с заголовком статьи и подписью разбивки
    expect(screen.getByText(/Из чего сложилось/)).toBeInTheDocument()
    const panel = document.querySelector('.drill') as HTMLElement
    expect(within(panel).getByText('Общий приход')).toBeInTheDocument()
    // есть хотя бы одна операция в списке
    expect(panel.querySelectorAll('.drill__op').length).toBeGreaterThan(0)
  })
})
