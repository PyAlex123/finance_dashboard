import { describe, it, expect } from 'vitest'
import { makeStore } from './index'
import { addOperation, deleteOperation, setOverride, clearOverride } from './dataSlice'
import { selectPeriods, selectActiveAccounts } from './selectors'
import { fromMajor } from '../domain/money'

describe('store', () => {
  it('инициализируется фикстурой', () => {
    const store = makeStore()
    const s = store.getState()
    expect(s.data.operations.length).toBe(39)
    expect(s.data.accounts.length).toBe(4)
    expect(selectPeriods(s)).toEqual(['2025-01', '2025-02', '2025-03'])
    expect(selectActiveAccounts(s).map((a) => a.code)).toEqual([
      'cash_uzs', 'card_uzs', 'card_usd', 'settle',
    ])
  })

  it('addOperation добавляет операцию с проводками и id', () => {
    const store = makeStore()
    const before = store.getState().data.operations.length
    store.dispatch(
      addOperation({
        operation: { date: '2025-03-30', type: 'income', description: 'Тест', categoryId: 'cat-sale' },
        lines: [{ accountId: 'acc-cash-uzs', amount: fromMajor(100000), currency: 'UZS' }],
      }),
    )
    const s = store.getState()
    expect(s.data.operations.length).toBe(before + 1)
    const op = s.data.operations.at(-1)!
    expect(op.id).toBeTruthy()
    const lines = s.data.operationLines.filter((l) => l.operationId === op.id)
    expect(lines.length).toBe(1)
    expect(lines[0].amount).toBe(fromMajor(100000))
  })

  it('deleteOperation убирает операцию и её проводки', () => {
    const store = makeStore()
    const id = store.getState().data.operations[0].id
    store.dispatch(deleteOperation(id))
    const s = store.getState()
    expect(s.data.operations.find((o) => o.id === id)).toBeUndefined()
    expect(s.data.operationLines.find((l) => l.operationId === id)).toBeUndefined()
  })

  it('override устанавливается и откатывается', () => {
    const store = makeStore()
    store.dispatch(setOverride('v_result', 'v_total_in'))
    expect(store.getState().data.overrides).toHaveLength(1)
    store.dispatch(clearOverride('v_result'))
    expect(store.getState().data.overrides).toHaveLength(0)
  })
})
