import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import { makeStore } from '../../store'
import { hydrate, addOperation } from '../../store/dataSlice'
import { buildEmptySnapshot } from '../../data/fixtures'
import { fromMajor } from '../../domain/money'
import OperationForm from './OperationForm'

afterEach(cleanup)

/** Стор с одной готовой операцией «Расход 300 000 с Наличных». */
function storeWithOperation() {
  const store = makeStore()
  store.dispatch(hydrate(buildEmptySnapshot()))
  const cash = store.getState().data.accounts.find((a) => a.name === 'Наличные')!
  store.dispatch(addOperation({
    operation: { date: '2025-05-10', type: 'expense', description: 'Обед', categoryId: null, note: 'x' },
    lines: [{ accountId: cash.id, amount: fromMajor(-300000), currency: 'UZS' }],
  }))
  return store
}

function renderForm(store: ReturnType<typeof makeStore>, operationId?: string) {
  render(
    <Provider store={store}>
      <OperationForm operationId={operationId} onClose={() => {}} />
    </Provider>,
  )
}

describe('OperationForm — правка существующей записи', () => {
  it('поля предзаполняются данными операции', () => {
    const store = storeWithOperation()
    const op = store.getState().data.operations[0]
    renderForm(store, op.id)

    expect(screen.getByText('Изменить операцию')).toBeInTheDocument()
    expect((screen.getByLabelText('Дата') as HTMLInputElement).value).toBe('2025-05-10')
    expect((screen.getByPlaceholderText('Оплата курса…') as HTMLInputElement).value).toBe('Обед')
    // сумма показывается по модулю (знак задаёт тип)
    expect((screen.getByPlaceholderText('650000') as HTMLInputElement).value).toBe('300000')
  })

  it('сохранение меняет ту же операцию, а не создаёт новую', () => {
    const store = storeWithOperation()
    const op = store.getState().data.operations[0]
    renderForm(store, op.id)

    fireEvent.change(screen.getByPlaceholderText('650000'), { target: { value: '450000' } })
    fireEvent.change(screen.getByPlaceholderText('Оплата курса…'), { target: { value: 'Ужин' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    const s = store.getState().data
    expect(s.operations).toHaveLength(1)
    expect(s.operations[0].id).toBe(op.id)
    expect(s.operations[0].description).toBe('Ужин')
    expect(s.operationLines).toHaveLength(1)
    expect(s.operationLines[0].amount).toBe(fromMajor(-450000)) // расход остаётся отрицательным
  })
})
