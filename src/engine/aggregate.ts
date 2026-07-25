// Агрегаты журнала (статьи kind === 'agg'). Декларативный фильтр по потоку/категории/
// счёту + группировка по периоду. Всё на bigint. Переброски вне in/out/net.

import type { AggRule, Currency, DataSnapshot, IsoDate, PeriodKey } from '../domain/types'
import type { Money } from '../domain/money'
import { convertToBase } from '../domain/money'
import { periodOf, comparePeriods } from './periods'

/** Базовая валюта отчёта. Суммы других валют пересчитываются по курсу на дату. */
export const BASE_CURRENCY: Currency = 'UZS'

interface OpMeta {
  period: PeriodKey
  date: IsoDate
  type: 'income' | 'expense' | 'transfer'
  categoryCode: string | null
}

/** Проводка/остаток в валюте, для которой не нашёлся курс. */
export interface MissingRate {
  ref: string
  date: IsoDate
  currency: Currency
}

export interface AggContext {
  opMeta: Map<string, OpMeta>
  accCodeById: Map<string, string>
  /** operationId -> [{ accId, amount }] — суммы УЖЕ в базовой валюте. */
  linesByOp: Map<string, { accountId: string; amount: Money }[]>
  /** accountCode -> суммарный начальный остаток (в базовой валюте) */
  openingByAccCode: Map<string, Money>
  /** Случаи, когда курс не найден и сумма взята без пересчёта. */
  missingRates: MissingRate[]
}

export function buildAggContext(data: DataSnapshot): AggContext {
  const catCodeById = new Map(data.categories.map((c) => [c.id, c.code]))
  const accCodeById = new Map(data.accounts.map((a) => [a.id, a.code]))
  const accCurrencyById = new Map(data.accounts.map((a) => [a.id, a.currency]))
  const missingRates: MissingRate[] = []

  // курсы по валютам, отсортированные по дате
  const ratesByCurrency = new Map<Currency, { date: IsoDate; rate: Money }[]>()
  for (const r of data.rates) {
    const arr = ratesByCurrency.get(r.currency) ?? []
    arr.push({ date: r.date, rate: r.rate })
    ratesByCurrency.set(r.currency, arr)
  }
  for (const arr of ratesByCurrency.values()) arr.sort((a, b) => (a.date < b.date ? -1 : 1))

  /** Курс на дату: последний с датой ≤ нужной, иначе самый ранний доступный. */
  const rateFor = (currency: Currency, date: IsoDate): Money | null => {
    const arr = ratesByCurrency.get(currency)
    if (!arr || arr.length === 0) return null
    let found: Money | null = null
    for (const r of arr) {
      if (r.date <= date) found = r.rate
      else break
    }
    return found ?? arr[0].rate
  }

  /** Пересчёт суммы счёта в базовую валюту. Без курса — сумма как есть + отметка. */
  const toBase = (amount: Money, accountId: string, date: IsoDate, ref: string): Money => {
    const currency = accCurrencyById.get(accountId) ?? BASE_CURRENCY
    if (currency === BASE_CURRENCY) return amount
    const rate = rateFor(currency, date)
    if (rate === null) {
      missingRates.push({ ref, date, currency })
      return amount
    }
    return convertToBase(amount, rate)
  }

  const opMeta = new Map<string, OpMeta>()
  for (const op of data.operations) {
    opMeta.set(op.id, {
      period: periodOf(op.date),
      date: op.date,
      type: op.type,
      categoryCode: op.categoryId ? catCodeById.get(op.categoryId) ?? null : null,
    })
  }

  const linesByOp = new Map<string, { accountId: string; amount: Money }[]>()
  for (const l of data.operationLines) {
    const meta = opMeta.get(l.operationId)
    const date = meta?.date ?? '1970-01-01'
    const arr = linesByOp.get(l.operationId) ?? []
    arr.push({ accountId: l.accountId, amount: toBase(l.amount, l.accountId, date, l.operationId) })
    linesByOp.set(l.operationId, arr)
  }

  const openingByAccCode = new Map<string, Money>()
  for (const ob of data.openingBalances) {
    const code = accCodeById.get(ob.accountId)
    if (!code) continue
    const amount = toBase(ob.amount, ob.accountId, ob.date, ob.id)
    openingByAccCode.set(code, (openingByAccCode.get(code) ?? 0n) + amount)
  }

  return { opMeta, accCodeById, linesByOp, openingByAccCode, missingRates }
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

/** Одна операция, вошедшая в сумму агрегата (для drill-down отчёта). */
export interface AggOperation {
  operationId: string
  date: IsoDate
  description: string
  /** Названия задействованных счетов через запятую. */
  accounts: string
  /** Вклад операции в сумму (в базовой валюте, знак как у показателя). */
  amount: Money
}

/**
 * Операции, из которых сложилась сумма агрегата за период — тот же фильтр, что в
 * aggValue, но возвращает список (для панели «из чего сложилось»). Для measure
 * 'balance' — все операции по счёту с периодом ≤ заданного.
 */
export function listAggOperations(
  data: DataSnapshot,
  rule: AggRule,
  period: PeriodKey,
): AggOperation[] {
  const ctx = buildAggContext(data)
  const accNameById = new Map(data.accounts.map((a) => [a.id, a.name]))
  const descById = new Map(data.operations.map((o) => [o.id, o.description]))
  const out: AggOperation[] = []

  for (const [opId, meta] of ctx.opMeta) {
    if (rule.measure === 'balance') {
      if (comparePeriods(meta.period, period) > 0) continue
    } else {
      if (meta.type === 'transfer') continue
      if (rule.measure === 'in' && meta.type !== 'income') continue
      if (rule.measure === 'out' && meta.type !== 'expense') continue
      if (meta.period !== period) continue
      if (rule.categoryCode && meta.categoryCode !== rule.categoryCode) continue
    }

    let amount = 0n
    const accs = new Set<string>()
    for (const line of ctx.linesByOp.get(opId) ?? []) {
      if (rule.accountCode && ctx.accCodeById.get(line.accountId) !== rule.accountCode) continue
      amount += line.amount
      accs.add(accNameById.get(line.accountId) ?? '')
    }
    if (amount === 0n) continue

    out.push({
      operationId: opId,
      date: meta.date,
      description: descById.get(opId) ?? '',
      accounts: [...accs].join(', '),
      amount: rule.measure === 'out' ? -amount : amount,
    })
  }

  // новее — сверху
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}
