// Сборка отчёта: агрегаты журнала + calc-статьи по топологическому порядку.
// Расчёт по всем периодам сразу; PREV разворачивается слева направо.
// Отчёт НЕ хранится — это чистая функция от данных. Циклы/ошибки формул —
// понятное сообщение в report.error, без падения.

import type { DataSnapshot, ItemKind, PeriodKey } from '../domain/types'
import type { Money } from '../domain/money'
import { derivePeriods, periodsInRange } from './periods'
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

export function buildReport(data: DataSnapshot): Report {
  const periods = resolvePeriods(data)
  const parentByCode = new Map(data.items.map((it) => [it.code, it.parentCode]))
  const overrideByCode = new Set(data.overrides.map((o) => o.itemCode))
  const totalModeOf = makeTotalModeResolver(data)

  const rowsMeta = [...data.items]
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

  // 1) агрегаты журнала
  const aggCtx = buildAggContext(data)
  for (const it of data.items) {
    if (it.kind === 'agg' && it.aggRule) {
      resolved.set(it.code, periods.map((p) => aggValue(aggCtx, it.aggRule!, p)))
    } else if (it.kind === 'input') {
      resolved.set(it.code, periods.map(() => 0n))
    }
  }

  // 2) calc-статьи по топологическому порядку
  try {
    const plan = buildCalcPlan(data.items, data.overrides)
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

/** ИТОГО: остатки (balance) — последний период, потоки — сумма. Для calc — по детям. */
function makeTotalModeResolver(data: DataSnapshot): (code: string) => TotalMode {
  const byCode = new Map(data.items.map((it) => [it.code, it]))
  const children = childrenByParent(data.items)
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

function resolvePeriods(data: DataSnapshot): PeriodKey[] {
  const derived = derivePeriods(data.operations)
  if (derived.length > 0) return derived
  const proj = data.projects[0]
  return proj ? periodsInRange(proj.periodStart, proj.periodEnd) : []
}
