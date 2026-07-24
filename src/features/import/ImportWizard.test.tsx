import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { Provider } from 'react-redux'
import * as XLSX from 'xlsx'
import { makeStore } from '../../store'
import { hydrate } from '../../store/dataSlice'
import { buildEmptySnapshot } from '../../data/fixtures'
import ImportWizard from './ImportWizard'

afterEach(cleanup)

function bookBuf(aoa: (string | number | null)[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Лист1')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

function renderWizard(buf: ArrayBuffer) {
  const store = makeStore()
  store.dispatch(hydrate(buildEmptySnapshot()))
  render(
    <Provider store={store}>
      <ImportWizard buf={buf} onClose={() => {}} />
    </Provider>,
  )
  return store
}

describe('ImportWizard', () => {
  it('импорт матрицы P&L наполняет стор pl-статьями', () => {
    const buf = bookBuf([
      ['Показатель', 'Январь', 'Февраль'],
      ['▌ Выручка', null, null],
      ['Продукт', 1000, 2000],
      ['ИТОГО выручка', 1000, 2000],
    ])
    const store = renderWizard(buf)
    // автоопределён тип P&L
    expect((screen.getByLabelText('Тип отчёта') as HTMLSelectElement).value).toBe('pl')
    fireEvent.click(screen.getByRole('button', { name: 'Импортировать' }))

    const s = store.getState().data
    expect(s.items.some((i) => i.form === 'pl' && i.kind === 'input')).toBe(true)
    expect(s.cellValues.length).toBeGreaterThan(0)
  })

  it('импорт журнала ДДС наполняет стор операциями', () => {
    const buf = bookBuf([
      ['Дата', 'Тип', 'Описание', 'Категория', 'Касса'],
      ['05.01.2025', 'Приход', 'Продажа', 'Выручка', 1000],
      ['10.01.2025', 'Расход', 'Аренда', 'Аренда', -300],
    ])
    const store = renderWizard(buf)
    expect((screen.getByLabelText('Тип отчёта') as HTMLSelectElement).value).toBe('dds')
    fireEvent.click(screen.getByRole('button', { name: 'Импортировать' }))

    const s = store.getState().data
    expect(s.operations.length).toBe(2)
    expect(s.accounts.length).toBe(1)
    expect(s.items.some((i) => i.form === 'cf' && i.code === 'v_total_in')).toBe(true)
  })
})
