// Полоса остатков (реальные данные) и сегментный фильтр типов в журнале.

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { makeStore } from '../../store'
import { hydrate } from '../../store/dataSlice'
import { buildFixtureSnapshot } from '../../data/fixtures'
import { selectAccountBalances, selectTotalBalance } from '../../store/reportSelectors'
import { ViewModeProvider } from '../shell/ViewMode'
import JournalPanel from './JournalPanel'

afterEach(cleanup)

function storeWithFixture() {
  const store = makeStore()
  store.dispatch(hydrate(buildFixtureSnapshot()))
  return store
}

describe('полоса остатков — реальные данные', () => {
  it('selectAccountBalances даёт остаток по каждому активному счёту, итог = сумме base', () => {
    const store = storeWithFixture()
    const balances = selectAccountBalances(store.getState())
    const total = selectTotalBalance(store.getState())

    expect(balances.length).toBeGreaterThan(0)
    // итог по всем счетам = сумма base-остатков
    const sum = balances.reduce((a, b) => a + b.base, 0n)
    expect(total).toBe(sum)
  })
})

describe('фильтр типов в журнале', () => {
  it('переключение на «Расход» оставляет только расходные операции (счётчик уменьшается)', () => {
    const store = storeWithFixture()
    render(
      <Provider store={store}>
        <ViewModeProvider value="mobile">
          <JournalPanel />
        </ViewModeProvider>
      </Provider>,
    )

    const allCount = store.getState().data.operations.length
    expect(screen.getByText(`${allCount} оп.`)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Расход' }))

    const expenseCount = store.getState().data.operations.filter((o) => o.type === 'expense').length
    expect(screen.getByText(`${expenseCount} оп.`)).toBeInTheDocument()
    expect(expenseCount).toBeLessThan(allCount)

    // в мобильных карточках показаны только бейджи «Расход»
    const cards = document.querySelectorAll('.jcard')
    expect(cards.length).toBe(expenseCount)
    cards.forEach((c) => {
      expect(within(c as HTMLElement).getByText(/Расход/)).toBeInTheDocument()
    })
  })
})
