// Доменная модель. Одна и та же структура работает локально (JSON/IndexedDB) и в MySQL.
// Деньги везде — минорные единицы bigint (см. money.ts). Ссылки в формулах — по code.

import type { Money } from './money'

export type Currency = 'UZS' | 'USD'
export type OperationType = 'income' | 'expense' | 'transfer'
export type CategoryDirection = 'in' | 'out' | 'transfer'
export type ReportForm = 'cf' | 'pl' | 'bs'
export type ItemKind = 'header' | 'input' | 'agg' | 'calc'
export type ScenarioKind = 'plan' | 'fact'

/** Ключ периода — строго YYYY-MM (год обязателен). */
export type PeriodKey = string
/** Дата операции — YYYY-MM-DD. */
export type IsoDate = string

export interface Account {
  id: string
  code: string
  name: string
  currency: Currency
  order: number
  active: boolean
}

export interface Category {
  id: string
  code: string
  name: string
  direction: CategoryDirection
  order: number
}

export interface Rate {
  id: string
  currency: Currency
  date: IsoDate
  /** Минорные UZS за 1 мажорный USD. */
  rate: Money
}

/** Начальный остаток — отдельная сущность, НЕ операция. */
export interface OpeningBalance {
  id: string
  accountId: string
  date: IsoDate
  amount: Money
}

export interface Operation {
  id: string
  date: IsoDate
  type: OperationType
  description: string
  categoryId: string | null
  note?: string
}

/** Проводка. Одна операция = N проводок. Приход/расход — одна, переброска — две. */
export interface OperationLine {
  id: string
  operationId: string
  accountId: string
  /** Знаковый эффект на остаток счёта (приход +, расход −, переброска − и +). */
  amount: Money
  currency: Currency
}

/**
 * Декларативное правило агрегата журнала (kind === 'agg').
 * Не формула: фильтр по потоку/категории/счёту + группировка по периоду.
 */
export interface AggRule {
  /** 'in' — приход, 'out' — расход (магнитуда), 'net' — сальдо, 'balance' — остаток на конец периода. */
  measure: 'in' | 'out' | 'net' | 'balance'
  /** Ограничение по коду категории. */
  categoryCode?: string
  /** Ограничение по коду счёта. */
  accountCode?: string
}

export interface Item {
  id: string
  templateId: string
  code: string
  parentCode: string | null
  order: number
  form: ReportForm
  kind: ItemKind
  name: string
  /** Для kind === 'agg'. */
  aggRule?: AggRule
  /** Для kind === 'calc'. Ссылки по кодам статей. */
  formulaDefault?: string
}

export interface Template {
  id: string
  name: string
  form: ReportForm
  version: number
}

/** Пользовательская формула поверх шаблонной. Не затирает formulaDefault. */
export interface ItemOverride {
  id: string
  itemCode: string
  formula: string
}

export interface Project {
  id: string
  name: string
  periodStart: PeriodKey
  periodEnd: PeriodKey
}

export interface Scenario {
  id: string
  projectId: string
  name: string
  kind: ScenarioKind
}

/** Полный слепок данных (для repository / экспорта / импорта). */
export interface DataSnapshot {
  accounts: Account[]
  categories: Category[]
  rates: Rate[]
  openingBalances: OpeningBalance[]
  operations: Operation[]
  operationLines: OperationLine[]
  templates: Template[]
  items: Item[]
  overrides: ItemOverride[]
  projects: Project[]
  scenarios: Scenario[]
}
