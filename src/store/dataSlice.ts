// Слайс данных = слепок исходных данных (журнал, справочники, шаблон, overrides).
// Единственный источник истины. Отчёты НЕ хранятся — вычисляются селекторами.

import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'
import type {
  Account,
  Category,
  DataSnapshot,
  ItemOverride,
  OpeningBalance,
  Operation,
  OperationLine,
} from '../domain/types'
import { buildFixtureSnapshot } from '../data/fixtures'

export type DataState = DataSnapshot

const initialState: DataState = buildFixtureSnapshot()

/** Операция вместе со своими проводками — единица ввода в UI. */
export interface OperationInput {
  operation: Omit<Operation, 'id'>
  lines: Array<Omit<OperationLine, 'id' | 'operationId'>>
}

const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    /** Полная замена состояния (загрузка из хранилища / импорт JSON). */
    hydrate(_state, action: PayloadAction<DataSnapshot>) {
      return action.payload
    },

    // --- Операции ---
    addOperation: {
      reducer(state, action: PayloadAction<{ operation: Operation; lines: OperationLine[] }>) {
        state.operations.push(action.payload.operation)
        state.operationLines.push(...action.payload.lines)
      },
      prepare(input: OperationInput) {
        const opId = nanoid()
        const operation: Operation = { ...input.operation, id: opId }
        const lines: OperationLine[] = input.lines.map((l) => ({
          ...l,
          id: nanoid(),
          operationId: opId,
        }))
        return { payload: { operation, lines } }
      },
    },
    updateOperation(state, action: PayloadAction<{ operation: Operation; lines: OperationLine[] }>) {
      const { operation, lines } = action.payload
      const idx = state.operations.findIndex((o) => o.id === operation.id)
      if (idx >= 0) state.operations[idx] = operation
      state.operationLines = state.operationLines.filter((l) => l.operationId !== operation.id)
      state.operationLines.push(...lines)
    },
    deleteOperation(state, action: PayloadAction<string>) {
      state.operations = state.operations.filter((o) => o.id !== action.payload)
      state.operationLines = state.operationLines.filter((l) => l.operationId !== action.payload)
    },

    // --- Счета ---
    upsertAccount: {
      reducer(state, action: PayloadAction<Account>) {
        const idx = state.accounts.findIndex((a) => a.id === action.payload.id)
        if (idx >= 0) state.accounts[idx] = action.payload
        else state.accounts.push(action.payload)
      },
      prepare(account: Account | Omit<Account, 'id'>) {
        return { payload: 'id' in account ? account : { ...account, id: nanoid() } }
      },
    },
    deleteAccount(state, action: PayloadAction<string>) {
      state.accounts = state.accounts.filter((a) => a.id !== action.payload)
    },

    // --- Категории ---
    upsertCategory: {
      reducer(state, action: PayloadAction<Category>) {
        const idx = state.categories.findIndex((c) => c.id === action.payload.id)
        if (idx >= 0) state.categories[idx] = action.payload
        else state.categories.push(action.payload)
      },
      prepare(category: Category | Omit<Category, 'id'>) {
        return { payload: 'id' in category ? category : { ...category, id: nanoid() } }
      },
    },
    deleteCategory(state, action: PayloadAction<string>) {
      state.categories = state.categories.filter((c) => c.id !== action.payload)
    },

    // --- Начальные остатки ---
    upsertOpeningBalance: {
      reducer(state, action: PayloadAction<OpeningBalance>) {
        const idx = state.openingBalances.findIndex((o) => o.id === action.payload.id)
        if (idx >= 0) state.openingBalances[idx] = action.payload
        else state.openingBalances.push(action.payload)
      },
      prepare(ob: OpeningBalance | Omit<OpeningBalance, 'id'>) {
        return { payload: 'id' in ob ? ob : { ...ob, id: nanoid() } }
      },
    },

    // --- Пользовательские формулы (override) поверх шаблона ---
    setOverride: {
      reducer(state, action: PayloadAction<ItemOverride>) {
        const idx = state.overrides.findIndex((o) => o.itemCode === action.payload.itemCode)
        if (idx >= 0) state.overrides[idx] = action.payload
        else state.overrides.push(action.payload)
      },
      prepare(itemCode: string, formula: string) {
        return { payload: { id: nanoid(), itemCode, formula } }
      },
    },
    clearOverride(state, action: PayloadAction<string>) {
      state.overrides = state.overrides.filter((o) => o.itemCode !== action.payload)
    },
  },
})

export const {
  hydrate,
  addOperation,
  updateOperation,
  deleteOperation,
  upsertAccount,
  deleteAccount,
  upsertCategory,
  deleteCategory,
  upsertOpeningBalance,
  setOverride,
  clearOverride,
} = dataSlice.actions

export default dataSlice.reducer
