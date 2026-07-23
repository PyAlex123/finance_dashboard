// Контрольные суммы. Выполняются после каждого пересчёта, результат виден в UI
// постоянно. Молчаливое несхождение недопустимо — каждое расхождение показывается
// числом. Пять проверок из ARCHITECTURE.md.

import type { DataSnapshot, PeriodKey } from '../domain/types'
import type { Money } from '../domain/money'
import { buildAggContext, aggValue } from './aggregate'
import { derivePeriods, periodOf, formatPeriod, isValidPeriod, comparePeriods } from './periods'

export type Severity = 'error' | 'warning'

export interface CheckIssue {
  label: string
  discrepancy?: Money
  /** id связанной строки (операции) — для подсветки в UI. */
  ref?: string
}

export interface CheckResult {
  id: string
  title: string
  ok: boolean
  severity: Severity
  issues: CheckIssue[]
}

export function runChecks(data: DataSnapshot): CheckResult[] {
  const periods = derivePeriods(data.operations)
  return [
    checkBalanceIdentity(data, periods),
    checkTransfersZero(data),
    checkTypeMatchesCategory(data),
    checkEmptyOrZeroOperations(data),
    checkDatesInRange(data),
  ]
}

/** 1. Начало + приход − расход = конец (по всем счетам, за каждый период). */
function checkBalanceIdentity(data: DataSnapshot, periods: PeriodKey[]): CheckResult {
  const ctx = buildAggContext(data)
  const openingTotal = [...ctx.openingByAccCode.values()].reduce((a, b) => a + b, 0n)
  const accCodes = data.accounts.map((a) => a.code)

  const issues: CheckIssue[] = []
  let cumIn = 0n
  let cumOut = 0n
  for (const p of periods) {
    cumIn += aggValue(ctx, { measure: 'in' }, p)
    cumOut += aggValue(ctx, { measure: 'out' }, p)
    const closing = accCodes.reduce(
      (sum, code) => sum + aggValue(ctx, { measure: 'balance', accountCode: code }, p),
      0n,
    )
    const expected = openingTotal + cumIn - cumOut
    const diff = closing - expected
    if (diff !== 0n) {
      issues.push({ label: `${formatPeriod(p)}: расхождение остатка`, discrepancy: diff })
    }
  }
  return {
    id: 'balance-identity',
    title: 'Остаток на начало + приход − расход = остаток на конец',
    ok: issues.length === 0,
    severity: 'error',
    issues,
  }
}

/** 2. Сумма проводок каждой переброски = 0. */
function checkTransfersZero(data: DataSnapshot): CheckResult {
  const linesByOp = groupLines(data)
  const issues: CheckIssue[] = []
  for (const op of data.operations) {
    if (op.type !== 'transfer') continue
    const lines = linesByOp.get(op.id) ?? []
    const total = lines.reduce((a, l) => a + l, 0n)
    if (total !== 0n) {
      issues.push({ label: `${op.date} · ${op.description}`, discrepancy: total, ref: op.id })
    }
  }
  return {
    id: 'transfer-zero',
    title: 'Переброска: сумма проводок = 0',
    ok: issues.length === 0,
    severity: 'error',
    issues,
  }
}

/** 3. Переброски не входят в приход/расход (тип операции соответствует направлению категории). */
function checkTypeMatchesCategory(data: DataSnapshot): CheckResult {
  const dirByCatId = new Map(data.categories.map((c) => [c.id, c.direction]))
  const expected: Record<string, string> = { income: 'in', expense: 'out', transfer: 'transfer' }
  const issues: CheckIssue[] = []
  for (const op of data.operations) {
    if (!op.categoryId) continue
    const dir = dirByCatId.get(op.categoryId)
    if (dir && dir !== expected[op.type]) {
      issues.push({
        label: `${op.date} · ${op.description}: тип «${op.type}» ≠ направление категории «${dir}»`,
        ref: op.id,
      })
    }
  }
  return {
    id: 'type-category',
    title: 'Переброски вне прихода/расхода (тип ↔ категория)',
    ok: issues.length === 0,
    severity: 'error',
    issues,
  }
}

/** 4. Операция без проводок или с нулевой суммой — предупреждение. */
function checkEmptyOrZeroOperations(data: DataSnapshot): CheckResult {
  const linesByOp = groupLines(data)
  const issues: CheckIssue[] = []
  for (const op of data.operations) {
    const lines = linesByOp.get(op.id) ?? []
    if (lines.length === 0) {
      issues.push({ label: `${op.date} · ${op.description}: нет проводок`, ref: op.id })
      continue
    }
    // для не-переброски нулевое движение подозрительно
    if (op.type !== 'transfer') {
      const moved = lines.reduce((a, l) => a + (l < 0n ? -l : l), 0n)
      if (moved === 0n) {
        issues.push({ label: `${op.date} · ${op.description}: нулевая сумма`, ref: op.id })
      }
    }
  }
  return {
    id: 'empty-zero',
    title: 'Операции без проводок или с нулевой суммой',
    ok: issues.length === 0,
    severity: 'warning',
    issues,
  }
}

/** 5. Дата операции вне диапазона периодов проекта — предупреждение. */
function checkDatesInRange(data: DataSnapshot): CheckResult {
  const proj = data.projects[0]
  const issues: CheckIssue[] = []
  if (proj && isValidPeriod(proj.periodStart) && isValidPeriod(proj.periodEnd)) {
    for (const op of data.operations) {
      const p = periodOf(op.date)
      const outside =
        comparePeriods(p, proj.periodStart) < 0 || comparePeriods(p, proj.periodEnd) > 0
      if (outside) {
        issues.push({ label: `${op.date} · ${op.description}: вне диапазона проекта`, ref: op.id })
      }
    }
  }
  return {
    id: 'date-range',
    title: 'Даты в пределах периодов проекта',
    ok: issues.length === 0,
    severity: 'warning',
    issues,
  }
}

function groupLines(data: DataSnapshot): Map<string, Money[]> {
  const map = new Map<string, Money[]>()
  for (const l of data.operationLines) {
    const arr = map.get(l.operationId) ?? []
    arr.push(l.amount)
    map.set(l.operationId, arr)
  }
  return map
}

/** Все ли проверки сошлись (для индикатора в UI). */
export function allChecksOk(results: CheckResult[]): boolean {
  return results.every((r) => r.ok)
}
