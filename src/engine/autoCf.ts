// Автоматический отчёт ДДС: строим дерево статей (Item[]) прямо из данных —
// категорий и счетов, без ручной настройки шаблона. Пользователь просто вносит
// операции, а отчёт (и дашборд) формируются сами.
//
// Структура:
//   Поступления            (header)
//     <каждая доходная категория>  (agg in + categoryCode)
//     Без категории                (agg in + noCategory)   — если таких операций нет, будет 0
//     ИТОГО поступления            (calc SUM(children))
//   Списания               (header)
//     <каждая расходная категория> (agg out + categoryCode)
//     Без категории                (agg out + noCategory)
//     ИТОГО списания               (calc SUM(children))
//   Чистый поток           (calc = поступления − списания)
//   Остатки по счетам      (header)
//     <каждый активный счёт>       (agg balance + accountCode)
//     ИТОГО остаток                (calc SUM(children))
//
// Коды статей детерминированы (из кодов категорий/счетов) — стабильны между
// пересчётами, поэтому drill-down и overrides работают как обычно.

import type { DataSnapshot, Item } from '../domain/types'

const T = 'tpl-dds'
const FORM = 'cf' as const

// Итоговые (calc) коды — на них ссылается «Чистый поток».
const IN_TOTAL = 'auto_in_total'
const OUT_TOTAL = 'auto_out_total'

function header(code: string, name: string, order: number): Item {
  return { id: `auto-${code}`, templateId: T, code, parentCode: null, order, form: FORM, kind: 'header', name }
}
function agg(code: string, name: string, order: number, parentCode: string, aggRule: Item['aggRule']): Item {
  return { id: `auto-${code}`, templateId: T, code, parentCode, order, form: FORM, kind: 'agg', name, aggRule }
}
function calc(code: string, name: string, order: number, parentCode: string | null, formulaDefault: string): Item {
  return { id: `auto-${code}`, templateId: T, code, parentCode, order, form: FORM, kind: 'calc', name, formulaDefault }
}

/** Статьи автоматического отчёта ДДС из категорий и счетов снимка. */
export function buildAutoCfItems(data: DataSnapshot): Item[] {
  const items: Item[] = []
  let order = 0
  const next = () => (order += 1)

  const income = data.categories.filter((c) => c.direction === 'in').sort((a, b) => a.order - b.order)
  const expense = data.categories.filter((c) => c.direction === 'out').sort((a, b) => a.order - b.order)
  const accounts = data.accounts.filter((a) => a.active).sort((a, b) => a.order - b.order)

  // --- Поступления ---
  items.push(header('auto_s_in', 'Поступления', next()))
  for (const c of income) {
    items.push(agg(`auto_in_${c.code}`, c.name, next(), IN_TOTAL, { measure: 'in', categoryCode: c.code }))
  }
  items.push(agg('auto_in_none', 'Без категории', next(), IN_TOTAL, { measure: 'in', noCategory: true }))
  items.push(calc(IN_TOTAL, 'ИТОГО поступления', next(), 'auto_s_in', 'SUM(children)'))

  // --- Списания ---
  items.push(header('auto_s_out', 'Списания', next()))
  for (const c of expense) {
    items.push(agg(`auto_out_${c.code}`, c.name, next(), OUT_TOTAL, { measure: 'out', categoryCode: c.code }))
  }
  items.push(agg('auto_out_none', 'Без категории', next(), OUT_TOTAL, { measure: 'out', noCategory: true }))
  items.push(calc(OUT_TOTAL, 'ИТОГО списания', next(), 'auto_s_out', 'SUM(children)'))

  // --- Чистый поток ---
  items.push(calc('auto_net', 'Чистый поток (поступления − списания)', next(), null, `${IN_TOTAL} - ${OUT_TOTAL}`))

  // --- Остатки по счетам ---
  items.push(header('auto_s_bal', 'Остатки по счетам', next()))
  for (const a of accounts) {
    items.push(agg(`auto_bal_${a.code}`, a.name, next(), 'auto_bal_total', { measure: 'balance', accountCode: a.code }))
  }
  items.push(calc('auto_bal_total', 'ИТОГО остаток', next(), 'auto_s_bal', 'SUM(children)'))

  return items
}
