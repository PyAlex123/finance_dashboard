// Строки журнала для таблицы: суммы по счетам разложены по колонкам (field = accountId).

import { createSelector } from '@reduxjs/toolkit'
import type { Money } from '../../domain/money'
import type { Account, Category, Operation, OperationLine, OperationType } from '../../domain/types'
import {
  selectOperations,
  selectOperationLines,
  selectActiveAccounts,
  selectCategories,
  selectLocale,
} from '../../store/selectors'
import { t, LOCALES, type Locale } from '../../i18n'

export interface JournalRow {
  id: string
  index: number
  date: string
  type: OperationType
  typeLabel: string
  description: string
  categoryId: string | null
  categoryName: string
  note: string
  /** Сумма по каждому счёту: ключ = accountId. */
  [accountId: string]: Money | string | number | OperationType | null
}

const TYPES: OperationType[] = ['income', 'expense', 'transfer']

/** Подписи типов операций на заданном (по умолчанию текущем) языке. */
export function typeLabels(locale?: Locale): Record<OperationType, string> {
  return {
    income: t('journal.type.income', undefined, locale),
    expense: t('journal.type.expense', undefined, locale),
    transfer: t('journal.type.transfer', undefined, locale),
  }
}

/**
 * Обратное преобразование: подпись из ячейки → тип операции.
 *
 * Сканирует подписи ВСЕХ локалей, а не только текущей. Так задумано: ячейку
 * «Тип» в ag-grid редактируют выбором из списка, и правка, начатая до
 * переключения языка, обязана примениться после него. Прежняя реализация
 * (модульная карта TYPE_BY_LABEL, построенная один раз при импорте) на смене
 * языка молча переставала распознавать значение и теряла правку.
 */
export function typeFromLabel(label: string): OperationType | null {
  const needle = String(label).trim()
  for (const locale of LOCALES) {
    const labels = typeLabels(locale)
    for (const type of TYPES) {
      if (labels[type] === needle) return type
    }
  }
  return null
}

/** Чистая функция построения строк журнала (переиспользуется в UI и Excel-экспорте). */
export function buildJournalRows(
  operations: Operation[],
  lines: OperationLine[],
  accounts: Account[],
  categories: Category[],
  locale?: Locale,
): JournalRow[] {
  const labels = typeLabels(locale)
  const catById = new Map(categories.map((c) => [c.id, c]))
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
      typeLabel: labels[op.type],
      description: op.description,
      categoryId: op.categoryId,
      categoryName: op.categoryId ? catById.get(op.categoryId)?.name ?? '' : '',
      note: op.note ?? '',
    }
    for (const acc of accounts) {
      row[acc.id] = amounts.get(acc.id) ?? 0n
    }
    return row
  })
}

// Локаль во входах — обязательна: подпись типа операции в строке зависит от
// языка, а без неё reselect вернул бы прежний результат (см. store/uiSlice.ts).
export const selectJournalRows = createSelector(
  [selectOperations, selectOperationLines, selectActiveAccounts, selectCategories, selectLocale],
  (operations, lines, accounts, categories, locale): JournalRow[] =>
    buildJournalRows(operations, lines, accounts, categories, locale),
)
