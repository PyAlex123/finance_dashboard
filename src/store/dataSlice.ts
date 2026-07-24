// Слайс данных = слепок исходных данных (журнал, справочники, шаблон, overrides).
// Единственный источник истины. Отчёты НЕ хранятся — вычисляются селекторами.

import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit'
import type {
  Account,
  Category,
  DataSnapshot,
  Item,
  ItemOverride,
  OpeningBalance,
  Operation,
  OperationLine,
  PeriodKey,
  Rate,
  ReportForm,
} from '../domain/types'
import type { Money } from '../domain/money'
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
    /** Переименовать код счёта и каскадно обновить ссылки в правилах агрегатов. */
    renameAccountCode(state, action: PayloadAction<{ id: string; code: string }>) {
      const { id, code } = action.payload
      const acc = state.accounts.find((a) => a.id === id)
      if (!acc || !code || acc.code === code) return
      if (state.accounts.some((a) => a.id !== id && a.code === code)) return // код занят
      const old = acc.code
      acc.code = code
      for (const it of state.items) {
        if (it.aggRule?.accountCode === old) it.aggRule.accountCode = code
      }
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
    /** Переименовать код категории и каскадно обновить ссылки в правилах агрегатов. */
    renameCategoryCode(state, action: PayloadAction<{ id: string; code: string }>) {
      const { id, code } = action.payload
      const cat = state.categories.find((c) => c.id === id)
      if (!cat || !code || cat.code === code) return
      if (state.categories.some((c) => c.id !== id && c.code === code)) return // код занят
      const old = cat.code
      cat.code = code
      for (const it of state.items) {
        if (it.aggRule?.categoryCode === old) it.aggRule.categoryCode = code
      }
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

    // --- Статьи шаблона (дерево отчёта) ---
    upsertItem: {
      reducer(state, action: PayloadAction<Item>) {
        const idx = state.items.findIndex((i) => i.id === action.payload.id)
        if (idx >= 0) state.items[idx] = action.payload
        else state.items.push(action.payload)
      },
      prepare(item: Item | Omit<Item, 'id'>) {
        return { payload: 'id' in item ? item : { ...item, id: nanoid() } }
      },
    },
    deleteItem(state, action: PayloadAction<string>) {
      // удаляем по code; детей переподвешиваем на родителя удаляемой статьи
      const code = action.payload
      const victim = state.items.find((i) => i.code === code)
      if (!victim) return
      const newParent = victim.parentCode
      for (const it of state.items) {
        if (it.parentCode === code) it.parentCode = newParent
      }
      state.items = state.items.filter((i) => i.code !== code)
      state.overrides = state.overrides.filter((o) => o.itemCode !== code)
    },
    /** Переместить статью вверх/вниз среди соседей (тот же parentCode). */
    moveItem(state, action: PayloadAction<{ code: string; dir: 'up' | 'down' }>) {
      const { code, dir } = action.payload
      const item = state.items.find((i) => i.code === code)
      if (!item) return
      const siblings = state.items
        .filter((i) => i.parentCode === item.parentCode)
        .sort((a, b) => a.order - b.order)
      const pos = siblings.findIndex((i) => i.code === code)
      const swapWith = dir === 'up' ? pos - 1 : pos + 1
      if (swapWith < 0 || swapWith >= siblings.length) return
      const a = siblings[pos]
      const b = siblings[swapWith]
      const ao = a.order
      a.order = b.order
      b.order = ao
    },

    // --- Версии шаблона (лёгкие снимки дерева статей) ---
    saveTemplateVersion: {
      reducer(state, action: PayloadAction<{ id: string; name: string; createdAt: string }>) {
        const form = state.templates[0]?.form ?? 'cf'
        state.templateVersions.push({
          id: action.payload.id,
          name: action.payload.name,
          createdAt: action.payload.createdAt,
          form,
          items: JSON.parse(JSON.stringify(state.items)),
        })
      },
      prepare(name: string) {
        return { payload: { id: nanoid(), name, createdAt: new Date().toISOString() } }
      },
    },
    restoreTemplateVersion(state, action: PayloadAction<string>) {
      const version = state.templateVersions.find((v) => v.id === action.payload)
      if (!version) return
      state.items = JSON.parse(JSON.stringify(version.items))
      if (state.templates[0]) state.templates[0].version += 1
    },
    deleteTemplateVersion(state, action: PayloadAction<string>) {
      state.templateVersions = state.templateVersions.filter((v) => v.id !== action.payload)
    },

    // --- Курсы валют ---
    upsertRate: {
      reducer(state, action: PayloadAction<Rate>) {
        const idx = state.rates.findIndex(
          (r) => r.currency === action.payload.currency && r.date === action.payload.date,
        )
        if (idx >= 0) state.rates[idx] = action.payload
        else state.rates.push(action.payload)
      },
      prepare(rate: Rate | Omit<Rate, 'id'>) {
        return { payload: 'id' in rate ? rate : { ...rate, id: nanoid() } }
      },
    },
    deleteRate(state, action: PayloadAction<string>) {
      state.rates = state.rates.filter((r) => r.id !== action.payload)
    },

    // --- Ручные ячейки (input-статьи по периодам; P&L) ---
    setCellValue(state, action: PayloadAction<{ itemCode: string; period: PeriodKey; amount: Money }>) {
      const { itemCode, period, amount } = action.payload
      const idx = state.cellValues.findIndex((c) => c.itemCode === itemCode && c.period === period)
      if (idx >= 0) state.cellValues[idx].amount = amount
      else state.cellValues.push({ itemCode, period, amount })
    },
    deleteCellValue(state, action: PayloadAction<{ itemCode: string; period: PeriodKey }>) {
      const { itemCode, period } = action.payload
      state.cellValues = state.cellValues.filter(
        (c) => !(c.itemCode === itemCode && c.period === period),
      )
    },

    // --- Колонки-периоды (формы без журнала) ---
    addPeriod(state, action: PayloadAction<PeriodKey>) {
      if (!state.plPeriods.includes(action.payload)) state.plPeriods.push(action.payload)
    },
    removePeriod(state, action: PayloadAction<PeriodKey>) {
      state.plPeriods = state.plPeriods.filter((p) => p !== action.payload)
      state.cellValues = state.cellValues.filter((c) => c.period !== action.payload)
    },

    // --- Наполнение/очистка статей одной формы ---
    seedItems(state, action: PayloadAction<{ items: Item[]; periods?: PeriodKey[] }>) {
      const forms = new Set(action.payload.items.map((i) => i.form))
      const codes = new Set(action.payload.items.map((i) => i.code))
      // убрать прежние статьи тех же форм и связанные ячейки/оверрайды
      state.items = state.items.filter((i) => !forms.has(i.form))
      state.items.push(...action.payload.items)
      state.overrides = state.overrides.filter((o) => !codes.has(o.itemCode))
      if (action.payload.periods) {
        for (const p of action.payload.periods) {
          if (!state.plPeriods.includes(p)) state.plPeriods.push(p)
        }
      }
    },
    clearForm(state, action: PayloadAction<ReportForm>) {
      const form = action.payload
      const codes = new Set(state.items.filter((i) => i.form === form).map((i) => i.code))
      state.items = state.items.filter((i) => i.form !== form)
      state.overrides = state.overrides.filter((o) => !codes.has(o.itemCode))
      state.cellValues = state.cellValues.filter((c) => !codes.has(c.itemCode))
      if (form === 'pl') state.plPeriods = []
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
  renameAccountCode,
  upsertCategory,
  deleteCategory,
  renameCategoryCode,
  upsertOpeningBalance,
  setOverride,
  clearOverride,
  upsertItem,
  deleteItem,
  moveItem,
  saveTemplateVersion,
  restoreTemplateVersion,
  deleteTemplateVersion,
  upsertRate,
  deleteRate,
  setCellValue,
  deleteCellValue,
  addPeriod,
  removePeriod,
  seedItems,
  clearForm,
} = dataSlice.actions

export default dataSlice.reducer
