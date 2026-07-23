// Строки журнала для таблицы: суммы по счетам разложены по колонкам (field = accountId).

import { createSelector } from '@reduxjs/toolkit'
import type { Money } from '../../domain/money'
import type { OperationType } from '../../domain/types'
import {
  selectOperations,
  selectOperationLines,
  selectActiveAccounts,
  selectCategoryById,
} from '../../store/selectors'

export interface JournalRow {
  id: string
  index: number
  date: string
  type: OperationType
  typeLabel: string
  description: string
  categoryName: string
  note: string
  /** Сумма по каждому счёту: ключ = accountId. */
  [accountId: string]: Money | string | number | OperationType
}

export const TYPE_LABEL: Record<OperationType, string> = {
  income: '🟢 Приход',
  expense: '🔴 Расход',
  transfer: '🔵 Переброска',
}

export const selectJournalRows = createSelector(
  [selectOperations, selectOperationLines, selectActiveAccounts, selectCategoryById],
  (operations, lines, accounts, catById): JournalRow[] => {
    // группировка проводок по операции и счёту
    const byOp = new Map<string, Map<string, Money>>()
    for (const l of lines) {
      let m = byOp.get(l.operationId)
      if (!m) byOp.set(l.operationId, (m = new Map()))
      m.set(l.accountId, (m.get(l.accountId) ?? 0n) + l.amount)
    }
    const ordered = [...operations].sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
    )
    return ordered.map((op, i) => {
      const amounts = byOp.get(op.id) ?? new Map<string, Money>()
      const row: JournalRow = {
        id: op.id,
        index: i + 1,
        date: op.date,
        type: op.type,
        typeLabel: TYPE_LABEL[op.type],
        description: op.description,
        categoryName: op.categoryId ? catById.get(op.categoryId)?.name ?? '' : '',
        note: op.note ?? '',
      }
      for (const acc of accounts) {
        row[acc.id] = amounts.get(acc.id) ?? 0n
      }
      return row
    })
  },
)
