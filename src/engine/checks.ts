// Контрольные суммы. Выполняются после каждого пересчёта, результат виден в UI
// постоянно. Молчаливое несхождение недопустимо — каждое расхождение показывается
// числом. Пять проверок из ARCHITECTURE.md.

import type { DataSnapshot, PeriodKey, ReportForm } from '../domain/types'
import type { Money } from '../domain/money'
import { buildReport } from './report'
import { buildAggContext, aggValue } from './aggregate'
import { derivePeriods, periodOf, formatPeriod, isValidPeriod, comparePeriods } from './periods'
import { t, type Locale } from '../i18n'

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

/**
 * Локаль — необязательный последний параметр: заголовки проверок и подписи
 * расхождений видит пользователь. Селекторы передают её явно, чтобы язык вошёл
 * в ключ мемоизации reselect (см. store/reportSelectors.ts).
 */
export function runChecks(
  data: DataSnapshot,
  form: ReportForm = 'cf',
  locale?: Locale,
): CheckResult[] {
  if (form === 'pl') return runPlChecks(data, locale)
  const periods = derivePeriods(data.operations)
  return [
    checkBalanceIdentity(data, periods, locale),
    checkTransfersZero(data, locale),
    checkTypeMatchesCategory(data, locale),
    checkEmptyOrZeroOperations(data, locale),
    checkDatesInRange(data, locale),
    checkRatesAvailable(data, locale),
  ]
}

/** 6. Для валютных счетов должен быть курс на дату операции. */
function checkRatesAvailable(data: DataSnapshot, locale?: Locale): CheckResult {
  const ctx = buildAggContext(data)
  const descById = new Map(data.operations.map((o) => [o.id, o.description]))
  const seen = new Set<string>()
  const issues: CheckIssue[] = []
  for (const m of ctx.missingRates) {
    const key = `${m.currency}|${m.date}`
    if (seen.has(key)) continue
    seen.add(key)
    const desc = descById.get(m.ref)
    issues.push({
      label: desc
        ? t('checks.rates.issueWithDesc', { date: m.date, currency: m.currency, desc }, locale)
        : t('checks.rates.issue', { date: m.date, currency: m.currency }, locale),
      ref: m.ref,
    })
  }
  return {
    id: 'rates-available',
    title: t('checks.rates.title', undefined, locale),
    ok: issues.length === 0,
    severity: 'error',
    issues,
  }
}

/** Лёгкие проверки P&L: отрицательная выручка/чистая прибыль (предупреждения). */
function runPlChecks(data: DataSnapshot, locale?: Locale): CheckResult[] {
  const rep = buildReport(data, { form: 'pl' })
  const findRow = (codes: string[]) => rep.rows.find((r) => codes.includes(r.code))
  const revenue = findRow(['rev_total'])
  const net = findRow(['net_profit'])

  const revIssues: CheckIssue[] = []
  const netIssues: CheckIssue[] = []
  rep.periods.forEach((p, i) => {
    if (revenue && revenue.values[i] < 0n) {
      const period = formatPeriod(p, { locale })
      revIssues.push({ label: t('checks.plRevenue.issue', { period }, locale), discrepancy: revenue.values[i] })
    }
    if (net && net.values[i] < 0n) {
      const period = formatPeriod(p, { locale })
      netIssues.push({ label: t('checks.plNet.issue', { period }, locale), discrepancy: net.values[i] })
    }
  })

  return [
    {
      id: 'pl-revenue-sign',
      title: t('checks.plRevenue.title', undefined, locale),
      ok: revIssues.length === 0,
      severity: 'warning',
      issues: revIssues,
    },
    {
      id: 'pl-net-sign',
      title: t('checks.plNet.title', undefined, locale),
      ok: netIssues.length === 0,
      severity: 'warning',
      issues: netIssues,
    },
  ]
}

/** 1. Начало + приход − расход = конец (по всем счетам, за каждый период). */
function checkBalanceIdentity(
  data: DataSnapshot,
  periods: PeriodKey[],
  locale?: Locale,
): CheckResult {
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
      const period = formatPeriod(p, { locale })
      issues.push({ label: t('checks.balance.issue', { period }, locale), discrepancy: diff })
    }
  }
  return {
    id: 'balance-identity',
    title: t('checks.balance.title', undefined, locale),
    ok: issues.length === 0,
    severity: 'error',
    issues,
  }
}

/** 2. Сумма проводок каждой переброски = 0. */
function checkTransfersZero(data: DataSnapshot, locale?: Locale): CheckResult {
  const linesByOp = groupLines(data)
  const issues: CheckIssue[] = []
  for (const op of data.operations) {
    if (op.type !== 'transfer') continue
    const lines = linesByOp.get(op.id) ?? []
    const total = lines.reduce((a, l) => a + l, 0n)
    if (total !== 0n) {
      issues.push({
        label: t('checks.transfer.issue', { date: op.date, desc: op.description }, locale),
        discrepancy: total,
        ref: op.id,
      })
    }
  }
  return {
    id: 'transfer-zero',
    title: t('checks.transfer.title', undefined, locale),
    ok: issues.length === 0,
    severity: 'error',
    issues,
  }
}

/** 3. Переброски не входят в приход/расход (тип операции соответствует направлению категории). */
function checkTypeMatchesCategory(data: DataSnapshot, locale?: Locale): CheckResult {
  const dirByCatId = new Map(data.categories.map((c) => [c.id, c.direction]))
  const expected: Record<string, string> = { income: 'in', expense: 'out', transfer: 'transfer' }
  const issues: CheckIssue[] = []
  for (const op of data.operations) {
    if (!op.categoryId) continue
    const dir = dirByCatId.get(op.categoryId)
    if (dir && dir !== expected[op.type]) {
      issues.push({
        label: t(
          'checks.typeCategory.issue',
          { date: op.date, desc: op.description, type: op.type, dir },
          locale,
        ),
        ref: op.id,
      })
    }
  }
  return {
    id: 'type-category',
    title: t('checks.typeCategory.title', undefined, locale),
    ok: issues.length === 0,
    severity: 'error',
    issues,
  }
}

/** 4. Операция без проводок или с нулевой суммой — предупреждение. */
function checkEmptyOrZeroOperations(data: DataSnapshot, locale?: Locale): CheckResult {
  const linesByOp = groupLines(data)
  const issues: CheckIssue[] = []
  for (const op of data.operations) {
    const lines = linesByOp.get(op.id) ?? []
    if (lines.length === 0) {
      issues.push({
        label: t('checks.emptyZero.noLines', { date: op.date, desc: op.description }, locale),
        ref: op.id,
      })
      continue
    }
    // для не-переброски нулевое движение подозрительно
    if (op.type !== 'transfer') {
      const moved = lines.reduce((a, l) => a + (l < 0n ? -l : l), 0n)
      if (moved === 0n) {
        issues.push({
          label: t('checks.emptyZero.zero', { date: op.date, desc: op.description }, locale),
          ref: op.id,
        })
      }
    }
  }
  return {
    id: 'empty-zero',
    title: t('checks.emptyZero.title', undefined, locale),
    ok: issues.length === 0,
    severity: 'warning',
    issues,
  }
}

/** 5. Дата операции вне диапазона периодов проекта — предупреждение. */
function checkDatesInRange(data: DataSnapshot, locale?: Locale): CheckResult {
  const proj = data.projects[0]
  const issues: CheckIssue[] = []
  if (proj && isValidPeriod(proj.periodStart) && isValidPeriod(proj.periodEnd)) {
    for (const op of data.operations) {
      const p = periodOf(op.date)
      const outside =
        comparePeriods(p, proj.periodStart) < 0 || comparePeriods(p, proj.periodEnd) > 0
      if (outside) {
        issues.push({
          label: t('checks.dateRange.issue', { date: op.date, desc: op.description }, locale),
          ref: op.id,
        })
      }
    }
  }
  return {
    id: 'date-range',
    title: t('checks.dateRange.title', undefined, locale),
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
