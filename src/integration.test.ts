import { describe, it, expect } from 'vitest'
import { makeStore } from './store'
import { addOperation, deleteOperation } from './store/dataSlice'
import { buildReport } from './engine/report'
import { runChecks, allChecksOk } from './engine/checks'
import { fromMajor } from './domain/money'

function totalIn(state: ReturnType<ReturnType<typeof makeStore>['getState']>) {
  const rep = buildReport(state.data)
  return rep.rows.find((r) => r.code === 'v_total_in')!.values
}

describe('интеграция: ввод операции → пересчёт отчёта и проверок', () => {
  it('добавление прихода увеличивает общий приход марта и не ломает проверки', () => {
    const store = makeStore()
    const before = totalIn(store.getState())[2]

    store.dispatch(
      addOperation({
        operation: { date: '2025-03-31', type: 'income', description: 'Новый курс', categoryId: 'cat-sale' },
        lines: [{ accountId: 'acc-cash-uzs', amount: fromMajor(500000), currency: 'UZS' }],
      }),
    )

    const after = totalIn(store.getState())[2]
    expect(after - before).toBe(fromMajor(500000))
    expect(allChecksOk(runChecks(store.getState().data))).toBe(true)
  })

  it('добавление переброски не меняет приход/расход и сохраняет баланс', () => {
    const store = makeStore()
    const inBefore = totalIn(store.getState())
    store.dispatch(
      addOperation({
        operation: { date: '2025-03-20', type: 'transfer', description: 'Перевод', categoryId: 'cat-transfer' },
        lines: [
          { accountId: 'acc-cash-uzs', amount: fromMajor(-300000), currency: 'UZS' },
          { accountId: 'acc-settle', amount: fromMajor(300000), currency: 'UZS' },
        ],
      }),
    )
    expect(totalIn(store.getState())).toEqual(inBefore)
    expect(allChecksOk(runChecks(store.getState().data))).toBe(true)
  })

  it('удаление операции откатывает приход', () => {
    const store = makeStore()
    const id = store.getState().data.operations.find((o) => o.type === 'income')!.id
    const before = totalIn(store.getState())
    store.dispatch(deleteOperation(id))
    expect(totalIn(store.getState())).not.toEqual(before)
  })
})
