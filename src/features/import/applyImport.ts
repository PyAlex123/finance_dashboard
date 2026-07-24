// Применение результатов парсинга к снимку данных (чистые функции — тестируемы).
// mode 'replace' очищает данные соответствующей формы, 'merge' добавляет к существующим.

import type { DataSnapshot } from '../../domain/types'
import { normalizeSnapshot } from '../../data/json'
import { generateDdsTemplate, type ParsedDds, type ParsedPl } from '../../data/importExcel'

export type ImportMode = 'replace' | 'merge'

const PL_TEMPLATE = { id: 'tpl-pl', name: 'P&L', form: 'pl' as const, version: 1 }
const DDS_TEMPLATE = { id: 'tpl-dds', name: 'ДДС', form: 'cf' as const, version: 1 }

export function applyPlImport(current: DataSnapshot, parsed: ParsedPl, mode: ImportMode): DataSnapshot {
  const plCodes = new Set(current.items.filter((i) => i.form === 'pl').map((i) => i.code))
  const base: DataSnapshot = mode === 'replace'
    ? {
        ...current,
        items: current.items.filter((i) => i.form !== 'pl'),
        cellValues: current.cellValues.filter((cv) => !plCodes.has(cv.itemCode)),
        plPeriods: [],
      }
    : current

  const templates = current.templates.some((t) => t.form === 'pl')
    ? current.templates
    : [...current.templates, PL_TEMPLATE]

  return normalizeSnapshot({
    ...base,
    templates,
    items: [...base.items, ...parsed.items],
    cellValues: [...base.cellValues, ...parsed.cellValues],
    plPeriods: [...new Set([...base.plPeriods, ...parsed.periods])],
  })
}

export function applyDdsImport(current: DataSnapshot, parsed: ParsedDds, mode: ImportMode): DataSnapshot {
  const items = generateDdsTemplate(parsed.accounts, parsed.categories)
  const base: DataSnapshot = mode === 'replace'
    ? {
        ...current,
        items: current.items.filter((i) => i.form !== 'cf'),
        accounts: [], categories: [], operations: [], operationLines: [], openingBalances: [],
      }
    : current

  const templates = current.templates.some((t) => t.form === 'cf')
    ? current.templates
    : [...current.templates, DDS_TEMPLATE]

  return normalizeSnapshot({
    ...base,
    templates,
    items: mode === 'replace' ? [...base.items, ...items] : base.items,
    accounts: [...base.accounts, ...parsed.accounts],
    categories: [...base.categories, ...parsed.categories],
    operations: [...base.operations, ...parsed.operations],
    operationLines: [...base.operationLines, ...parsed.operationLines],
    openingBalances: [...base.openingBalances, ...parsed.openingBalances],
  })
}
