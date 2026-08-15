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
import { t, type Locale } from '../i18n'

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

/**
 * Статьи автоматического отчёта ДДС из категорий и счетов снимка.
 *
 * Единственные финансовые названия в продукте, которые переводятся ВЖИВУЮ, а не
 * замерзают при создании: эти статьи синтезируются при каждой сборке отчёта и в
 * снимок не сохраняются, а overrides ссылаются на них по code — он от языка не
 * зависит. Имена категорий и счетов внутри (c.name, a.name) — данные
 * пользователя, их не трогаем.
 *
 * Чтобы смена языка была видна, локаль обязана прийти явно из селектора: без
 * этого reselect отдаст прежний результат (см. store/reportSelectors.ts).
 */
export function buildAutoCfItems(data: DataSnapshot, locale?: Locale): Item[] {
  const tr = (key: Parameters<typeof t>[0]) => t(key, undefined, locale)
  const items: Item[] = []
  let order = 0
  const next = () => (order += 1)

  const income = data.categories.filter((c) => c.direction === 'in').sort((a, b) => a.order - b.order)
  const expense = data.categories.filter((c) => c.direction === 'out').sort((a, b) => a.order - b.order)
  const accounts = data.accounts.filter((a) => a.active).sort((a, b) => a.order - b.order)

  // --- Поступления ---
  items.push(header('auto_s_in', tr('autocf.section.in'), next()))
  for (const c of income) {
    items.push(agg(`auto_in_${c.code}`, c.name, next(), IN_TOTAL, { measure: 'in', categoryCode: c.code }))
  }
  items.push(agg('auto_in_none', tr('autocf.noCategory'), next(), IN_TOTAL, { measure: 'in', noCategory: true }))
  items.push(calc(IN_TOTAL, tr('autocf.total.in'), next(), 'auto_s_in', 'SUM(children)'))

  // --- Списания ---
  items.push(header('auto_s_out', tr('autocf.section.out'), next()))
  for (const c of expense) {
    items.push(agg(`auto_out_${c.code}`, c.name, next(), OUT_TOTAL, { measure: 'out', categoryCode: c.code }))
  }
  items.push(agg('auto_out_none', tr('autocf.noCategory'), next(), OUT_TOTAL, { measure: 'out', noCategory: true }))
  items.push(calc(OUT_TOTAL, tr('autocf.total.out'), next(), 'auto_s_out', 'SUM(children)'))

  // --- Чистый поток ---
  items.push(calc('auto_net', tr('autocf.net'), next(), null, `${IN_TOTAL} - ${OUT_TOTAL}`))

  // --- Остатки по счетам ---
  items.push(header('auto_s_bal', tr('autocf.section.balances'), next()))
  for (const a of accounts) {
    items.push(agg(`auto_bal_${a.code}`, a.name, next(), 'auto_bal_total', { measure: 'balance', accountCode: a.code }))
  }
  items.push(calc('auto_bal_total', tr('autocf.total.balance'), next(), 'auto_s_bal', 'SUM(children)'))

  return items
}
