// Дашборд считает KPI из реальных данных (агрегаты журнала), не из демо-чисел.

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Provider } from 'react-redux'
import { makeStore } from '../../store'
import { hydrate } from '../../store/dataSlice'
import { buildFixtureSnapshot, buildEmptySnapshot } from '../../data/fixtures'
import { selectDashboard } from './dashboardSelectors'
import { selectReport } from '../../store/reportSelectors'
import { rowTotal } from '../../engine/report'
import DashboardView from './DashboardView'

afterEach(cleanup)

describe('дашборд — реальные KPI', () => {
  it('результат = приход − расход и совпадает с колонкой ИТОГО отчёта', () => {
    const store = makeStore()
    store.dispatch(hydrate(buildFixtureSnapshot()))
    const dash = selectDashboard(store.getState())

    expect(dash.hasData).toBe(true)
    expect(dash.kpis.result).toBe(dash.kpis.totalIn - dash.kpis.totalOut)

    // сверка с авто-отчётом: «ИТОГО поступления» = totalIn, «ИТОГО списания» = totalOut
    const report = selectReport(store.getState())
    const inRow = report.rows.find((r) => r.code === 'auto_in_total')!
    const outRow = report.rows.find((r) => r.code === 'auto_out_total')!
    expect(rowTotal(inRow)).toBe(dash.kpis.totalIn)
    expect(rowTotal(outRow)).toBe(dash.kpis.totalOut)
  })

  it('пустой журнал → подсказка вместо графиков', () => {
    const store = makeStore()
    store.dispatch(hydrate(buildEmptySnapshot()))
    render(
      <Provider store={store}>
        <DashboardView />
      </Provider>,
    )
    expect(screen.getByText(/Пока нет операций/)).toBeInTheDocument()
  })
})
