// Пересборка операции и её проводок при inline-правке строки журнала (чистые функции).
// Знак нормализуется по типу: приход +|x|, расход −|x|, переброска — как введено
// (минус в одной колонке-счёте, плюс в другой — как в Excel).

import type {
  Account, Category, Operation, OperationLine, OperationType,
} from '../../domain/types'
import type { Money } from '../../domain/money'

export interface RowSnapshot {
  id: string
  date: string
  type: OperationType
  description: string
  categoryId: string | null
  note: string
  /** accountId → сумма в валюте счёта. */
  amounts: Record<string, Money>
}

export type RowPatch = Partial<Omit<RowSnapshot, 'id' | 'amounts'>> & {
  amounts?: Record<string, Money>
}

export function normalizeSign(type: OperationType, amount: Money): Money {
  if (type === 'transfer') return amount
  const abs = amount < 0n ? -amount : amount
  return type === 'expense' ? -abs : abs
}

/** Направление категории, допустимое для типа операции. */
export function directionForType(type: OperationType): Category['direction'] {
  return type === 'income' ? 'in' : type === 'expense' ? 'out' : 'transfer'
}

/** Собрать { operation, lines } для updateOperation после правки ячейки. */
export function buildOperationUpdate(
  row: RowSnapshot,
  patch: RowPatch,
  accounts: Account[],
  categories: Category[] = [],
): { operation: Operation; lines: OperationLine[] } {
  const next: RowSnapshot = {
    ...row,
    ...patch,
    amounts: { ...row.amounts, ...(patch.amounts ?? {}) },
  }
  const type = next.type

  // при смене типа категория другого направления больше не подходит
  let categoryId = next.categoryId
  if (categoryId) {
    const cat = categories.find((c) => c.id === categoryId)
    if (cat && cat.direction !== directionForType(type)) categoryId = null
  }

  const currencyByAccount = new Map(accounts.map((a) => [a.id, a.currency]))
  const lines: OperationLine[] = Object.entries(next.amounts)
    .map(([accountId, amount]) => ({ accountId, amount: normalizeSign(type, amount) }))
    .filter((l) => l.amount !== 0n)
    .map((l, i) => ({
      id: `${row.id}-l${i + 1}`,
      operationId: row.id,
      accountId: l.accountId,
      amount: l.amount,
      currency: currencyByAccount.get(l.accountId) ?? 'UZS',
    }))

  const operation: Operation = {
    id: row.id,
    date: next.date,
    type,
    description: next.description,
    categoryId,
    note: next.note || undefined,
  }
  return { operation, lines }
}

/** Сегодняшняя дата в локальной зоне как YYYY-MM-DD. */
export function todayIso(): string {
  return isoFromDate(new Date())
}

function isoFromDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Подпись даты в журнале: сегодняшняя — словом «Сегодня», вчерашняя — «Вчера». */
export function formatDateLabel(date: string): string {
  if (!date) return ''
  if (date === todayIso()) return 'Сегодня'
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (date === isoFromDate(yesterday)) return 'Вчера'
  return date
}
