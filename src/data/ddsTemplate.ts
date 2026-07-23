// Дефолтный шаблон отчёта ДДС (cf) — дерево статей по структуре учебного Excel-отчёта.
// Ссылки в формулах — по code. parentCode задаёт группировку для SUM(children)
// и не обязан совпадать с порядком отображения (order).

import type { Item, Template } from '../domain/types'

export const DDS_TEMPLATE: Template[] = [
  { id: 'tpl-dds', name: 'ДДС', form: 'cf', version: 1 },
]

const T = 'tpl-dds'

function header(code: string, name: string, order: number): Item {
  return { id: `it-${code}`, templateId: T, code, parentCode: null, order, form: 'cf', kind: 'header', name }
}
function agg(code: string, name: string, order: number, parentCode: string | null, aggRule: Item['aggRule']): Item {
  return { id: `it-${code}`, templateId: T, code, parentCode, order, form: 'cf', kind: 'agg', name, aggRule }
}
function calc(code: string, name: string, order: number, parentCode: string | null, formulaDefault: string): Item {
  return { id: `it-${code}`, templateId: T, code, parentCode, order, form: 'cf', kind: 'calc', name, formulaDefault }
}

export const DDS_ITEMS: Item[] = [
  // Итоги за период
  header('s_totals', 'Итоги за период', 1),
  agg('v_total_in', 'Общий приход', 10, 's_totals', { measure: 'in' }),
  agg('v_total_out', 'Общий расход', 11, 's_totals', { measure: 'out' }),
  calc('v_result', 'Результат (приход − расход)', 12, 's_totals', 'v_total_in - v_total_out'),

  // Доходы по категориям
  header('s_income', 'Доходы по категориям', 20),
  agg('inc_sale', 'Продажа курсов', 21, 'inc_total', { measure: 'in', categoryCode: 'sale' }),
  agg('inc_consult', 'Консультации', 22, 'inc_total', { measure: 'in', categoryCode: 'consult' }),
  agg('inc_other', 'Прочие доходы', 23, 'inc_total', { measure: 'in', categoryCode: 'other_in' }),
  calc('inc_total', 'ИТОГО доходы', 24, 's_income', 'SUM(children)'),

  // Расходы по категориям
  header('s_expense', 'Расходы по категориям', 30),
  agg('exp_salary', 'Оплата труда', 31, 'exp_total', { measure: 'out', categoryCode: 'salary' }),
  agg('exp_rent', 'Аренда', 32, 'exp_total', { measure: 'out', categoryCode: 'rent' }),
  agg('exp_marketing', 'Маркетинг', 33, 'exp_total', { measure: 'out', categoryCode: 'marketing' }),
  agg('exp_office', 'Офисные расходы', 34, 'exp_total', { measure: 'out', categoryCode: 'office' }),
  agg('exp_tax', 'Налоги', 35, 'exp_total', { measure: 'out', categoryCode: 'tax' }),
  calc('exp_total', 'ИТОГО расходы', 36, 's_expense', 'SUM(children)'),

  // Остатки по счетам (остаток на конец периода)
  header('s_balances', 'Остатки по счетам', 40),
  agg('bal_cash', 'Наличные (сум)', 41, 'bal_total', { measure: 'balance', accountCode: 'cash_uzs' }),
  agg('bal_card_uzs', 'Карта UZS', 42, 'bal_total', { measure: 'balance', accountCode: 'card_uzs' }),
  agg('bal_card_usd', 'Карта USD (в сумах)', 43, 'bal_total', { measure: 'balance', accountCode: 'card_usd' }),
  agg('bal_settle', 'Расч. счёт', 44, 'bal_total', { measure: 'balance', accountCode: 'settle' }),
  calc('bal_total', 'ИТОГО по всем счетам', 45, 's_balances', 'SUM(children)'),
]
