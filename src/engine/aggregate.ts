// Агрегаты журнала (статьи kind === 'agg'). Декларативный фильтр по потоку/категории/
// счёту + группировка по периоду. Всё на bigint. Переброски вне in/out/net.

import type { AggRule, DataSnapshot, PeriodKey } from '../domain/types'
import type { Money } from '../domain/money'
import { periodOf, comparePeriods } from './periods'

interface OpMeta {
  period: PeriodKey
  type: 'income' | 'expense' | 'transfer'
  categoryCode: string | null
}

export interface AggContext {
  opMeta: Map<string, OpMeta>
  accCodeById: Map<string, string>
  /** operationId -> [{ accId, amount }] */
  linesByOp: Map<string, { accountId: string; amount: Money }[]>
  /** accountCode -> суммарный начальный остаток */
  openingByAccCode: Map<string, Money>
}

export function buildAggContext(data: DataSnapshot): AggContext {
  const catCodeById = new Map(data.categories.map((c) => [c.id, c.code]))
  const accCodeById = new Map(data.accounts.map((a) => [a.id, a.code]))

  const opMeta = new Map<string, OpMeta>()
  for (const op of data.operations) {
    opMeta.set(op.id, {
      period: periodOf(op.date),
      type: op.type,
      categoryCode: op.categoryId ? catCodeById.get(op.categoryId) ?? null : null,
    })
  }

  const linesByOp = new Map<string, { accountId: string; amount: Money }[]>()
  for (const l of data.operationLines) {
    const arr = linesByOp.get(l.operationId) ?? []
    arr.push({ accountId: l.accountId, amount: l.amount })
    linesByOp.set(l.operationId, arr)
  }

  const openingByAccCode = new Map<string, Money>()
  for (const ob of data.openingBalances) {
    const code = accCodeById.get(ob.accountId)
    if (!code) continue
    openingByAccCode.set(code, (openingByAccCode.get(code) ?? 0n) + ob.amount)
  }

  return { opMeta, accCodeById, linesByOp, openingByAccCode }
}

/** Значение агрегата за конкретный период. */
export function aggValue(ctx: AggContext, rule: AggRule, period: PeriodKey): Money {
  if (rule.measure === 'balance') return balanceAt(ctx, rule.accountCode, period)

  let total = 0n
  for (const [opId, meta] of ctx.opMeta) {
    if (meta.type === 'transfer') continue // переброски вне in/out/net
    if (rule.measure === 'in' && meta.type !== 'income') continue
    if (rule.measure === 'out' && meta.type !== 'expense') continue
    if (meta.period !== period) continue
    if (rule.categoryCode && meta.categoryCode !== rule.categoryCode) continue

    for (const line of ctx.linesByOp.get(opId) ?? []) {
      if (rule.accountCode && ctx.accCodeById.get(line.accountId) !== rule.accountCode) continue
      total += line.amount
    }
  }
  // расход хранится отрицательным — возвращаем магнитуду
  return rule.measure === 'out' ? -total : total
}

/** Остаток счёта на конец периода = начальный + все проводки счёта по период включительно. */
function balanceAt(ctx: AggContext, accountCode: string | undefined, period: PeriodKey): Money {
  if (!accountCode) return 0n
  let total = ctx.openingByAccCode.get(accountCode) ?? 0n
  for (const [opId, meta] of ctx.opMeta) {
    if (comparePeriods(meta.period, period) > 0) continue // будущее — не считаем
    for (const line of ctx.linesByOp.get(opId) ?? []) {
      if (ctx.accCodeById.get(line.accountId) !== accountCode) continue
      total += line.amount
    }
  }
  return total
}

/** Значения агрегата по всем периодам. */
export function aggByPeriods(ctx: AggContext, rule: AggRule, periods: PeriodKey[]): Money[] {
  return periods.map((p) => aggValue(ctx, rule, p))
}
