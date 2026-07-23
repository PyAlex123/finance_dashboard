// Сборка отчёта: агрегаты журнала + calc-статьи по топологическому порядку.
// Расчёт по всем периодам сразу; PREV разворачивается слева направо.
// Отчёт НЕ хранится — это чистая функция от данных. Циклы/ошибки формул —
// понятное сообщение в report.error, без падения.
// Форм-ориентированность: статьи фильтруются по Item.form (cf = ДДС, pl = P&L).

import type { CellValue, DataSnapshot, Item, ItemKind, PeriodKey, ReportForm } from '../domain/types'
import type { Money } from '../domain/money'
import { derivePeriods, periodsInRange, comparePeriods } from './periods'
import { buildAggContext, aggValue } from './aggregate'
import { buildCalcPlan, childrenByParent } from './formula/graph'
import { evaluateMoney } from './formula/evaluator'
import { FormulaError } from './formula/ast'

/** Как считать колонку ИТОГО: сумма периодов (потоки) / последний период (остатки) / нет. */
export type TotalMode = 'sum' | 'last' | 'none'

export interface ReportRow {
  code: string
  name: string
  kind: ItemKind
  depth: number
  order: number
  /** Значения по периодам (пусто для header). */
  values: Money[]
  /** Формула переопределена пользователем (override). */
  isOverridden: boolean
  /** Режим агрегирования колонки ИТОГО. */
  totalMode: TotalMode
}

export interface Report {
  periods: PeriodKey[]
  rows: ReportRow[]
  /** Понятное сообщение об ошибке (цикл / синтаксис формулы), если расчёт не удался. */
  error?: string
}

export interface BuildReportOptions {
  /** Форма отчёта; по умолчанию 'cf' (ДДС). */
  form?: ReportForm
  /** Явные периоды-колонки (для форм без журнала). */
  periods?: PeriodKey[]
}

/** Значение колонки ИТОГО для строки. */
export function rowTotal(row: ReportRow): Money | null {
  if (row.totalMode === 'none' || row.values.length === 0) return null
  if (row.totalMode === 'last') return row.values[row.values.length - 1]
  return row.values.reduce((a, b) => a + b, 0n)
}

/** Глубина статьи по цепочке parentCode (для отступов в UI). */
function computeDepth(code: string, parentByCode: Map<string, string | null>): number {
  let depth = 0
  let cur = parentByCode.get(code) ?? null
  const guard = new Set<string>()
  while (cur && !guard.has(cur)) {
    guard.add(cur)
    depth++
    cur = parentByCode.get(cur) ?? null
  }
  return depth
}

export function buildReport(data: DataSnapshot, opts: BuildReportOptions = {}): Report {
  const form: ReportForm = opts.form ?? 'cf'
  const items = data.items.filter((it) => it.form === form)
  const periods = opts.periods ?? resolvePeriods(data, form, items)

  const parentByCode = new Map(items.map((it) => [it.code, it.parentCode]))
  const overrideByCode = new Set(data.overrides.map((o) => o.itemCode))
  const totalModeOf = makeTotalModeResolver(items)
  const cellMap = buildCellMap(data.cellValues)

  const rowsMeta = [...items]
    .sort((a, b) => a.order - b.order)
    .map((it) => ({
      code: it.code,
      name: it.name,
      kind: it.kind,
      depth: computeDepth(it.code, parentByCode),
      order: it.order,
      isOverridden: overrideByCode.has(it.code),
      totalMode: totalModeOf(it.code),
    }))

  const resolved = new Map<string, Money[]>()

  // 1) агрегаты журнала (agg) и ручные ячейки (input)
  const aggCtx = buildAggContext(data)
  for (const it of items) {
    if (it.kind === 'agg' && it.aggRule) {
      resolved.set(it.code, periods.map((p) => aggValue(aggCtx, it.aggRule!, p)))
    } else if (it.kind === 'input') {
      resolved.set(it.code, periods.map((p) => cellMap.get(cellKey(it.code, p)) ?? 0n))
    }
  }

  // 2) calc-статьи по топологическому порядку
  try {
    const plan = buildCalcPlan(items, data.overrides)
    for (const code of plan.order) {
      const ast = plan.astByCode.get(code)
      if (!ast) continue
      const arr: Money[] = new Array(periods.length).fill(0n)
      resolved.set(code, arr) // регистрируем заранее для PREV(self)
      for (let i = 0; i < periods.length; i++) {
        arr[i] = evaluateMoney(ast, {
          periods,
          periodIndex: i,
          resolved,
          currentCode: code,
          childrenByCode: plan.childrenByCode,
        })
      }
    }
  } catch (e) {
    const message = e instanceof FormulaError ? e.message : e instanceof Error ? e.message : String(e)
    return {
      periods,
      rows: rowsMeta.map((m) => ({ ...m, values: resolved.get(m.code) ?? [] })),
      error: message,
    }
  }

  const rows: ReportRow[] = rowsMeta.map((m) => ({
    ...m,
    values: m.kind === 'header' ? [] : resolved.get(m.code) ?? periods.map(() => 0n),
  }))

  return { periods, rows }
}

function cellKey(itemCode: string, period: PeriodKey): string {
  return `${itemCode}|${period}`
}

function buildCellMap(cellValues: CellValue[]): Map<string, Money> {
  const m = new Map<string, Money>()
  for (const cv of cellValues) m.set(cellKey(cv.itemCode, cv.period), cv.amount)
  return m
}

/** ИТОГО: остатки (balance) — последний период, потоки — сумма. Для calc — по детям. */
function makeTotalModeResolver(items: Item[]): (code: string) => TotalMode {
  const byCode = new Map(items.map((it) => [it.code, it]))
  const children = childrenByParent(items)
  const memo = new Map<string, TotalMode>()

  const resolve = (code: string): TotalMode => {
    const cached = memo.get(code)
    if (cached) return cached
    memo.set(code, 'sum') // защита от рекурсии
    const it = byCode.get(code)
    let mode: TotalMode = 'sum'
    if (!it || it.kind === 'header') mode = 'none'
    else if (it.kind === 'agg') mode = it.aggRule?.measure === 'balance' ? 'last' : 'sum'
    else if (it.kind === 'calc') {
      const kids = children.get(code) ?? []
      mode = kids.length > 0 && kids.every((c) => resolve(c) === 'last') ? 'last' : 'sum'
    }
    memo.set(code, mode)
    return mode
  }
  return resolve
}

/** Периоды формы: cf — из журнала/проекта; прочие — из явного списка plPeriods ∪ ячеек. */
function resolvePeriods(data: DataSnapshot, form: ReportForm, items: Item[]): PeriodKey[] {
  if (form === 'cf') {
    const derived = derivePeriods(data.operations)
    if (derived.length > 0) return derived
    const proj = data.projects[0]
    return proj ? periodsInRange(proj.periodStart, proj.periodEnd) : []
  }
  // формы без журнала (P&L и т.п.): объединяем явные колонки и периоды из ячеек
  const codes = new Set(items.map((it) => it.code))
  const set = new Set<PeriodKey>(data.plPeriods)
  for (const cv of data.cellValues) {
    if (codes.has(cv.itemCode)) set.add(cv.period)
  }
  return [...set].sort(comparePeriods)
}
