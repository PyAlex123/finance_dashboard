// Дефолтный шаблон отчёта ДДС (cf) — дерево статей по структуре учебного Excel-отчёта.
// Ссылки в формулах — по code. parentCode задаёт группировку для SUM(children)
// и не обязан совпадать с порядком отображения (order).

import type { Item, Template } from '../domain/types'
import { t, type Key, type Locale } from '../i18n'

const T = 'tpl-dds'

/**
 * Шаблон и статьи — ФУНКЦИИ, а не константы. Модульная константа вычисляется
 * при импорте и навсегда замораживает язык, который был активен в тот момент;
 * функция берёт язык в момент создания рабочего пространства. Именно это
 * означает «локализуются при создании»: строка уходит в снимок и больше не
 * переводится.
 */
export function ddsTemplate(locale?: Locale): Template[] {
  return [{ id: T, name: t('seed.template.cf', undefined, locale), form: 'cf', version: 1 }]
}

function header(code: string, name: string, order: number): Item {
  return { id: `it-${code}`, templateId: T, code, parentCode: null, order, form: 'cf', kind: 'header', name }
}
function agg(code: string, name: string, order: number, parentCode: string | null, aggRule: Item['aggRule']): Item {
  return { id: `it-${code}`, templateId: T, code, parentCode, order, form: 'cf', kind: 'agg', name, aggRule }
}
function calc(code: string, name: string, order: number, parentCode: string | null, formulaDefault: string): Item {
  return { id: `it-${code}`, templateId: T, code, parentCode, order, form: 'cf', kind: 'calc', name, formulaDefault }
}

export function buildDdsItems(locale?: Locale): Item[] {
  const tr = (key: Key) => t(key, undefined, locale)
  return [
    // Итоги за период
    header('s_totals', tr('seed.dds.s_totals'), 1),
    agg('v_total_in', tr('seed.dds.v_total_in'), 10, 's_totals', { measure: 'in' }),
    agg('v_total_out', tr('seed.dds.v_total_out'), 11, 's_totals', { measure: 'out' }),
    calc('v_result', tr('seed.dds.v_result'), 12, 's_totals', 'v_total_in - v_total_out'),

    // Доходы по категориям
    header('s_income', tr('seed.dds.s_income'), 20),
    agg('inc_sale', tr('seed.dds.inc_sale'), 21, 'inc_total', { measure: 'in', categoryCode: 'sale' }),
    agg('inc_consult', tr('seed.dds.inc_consult'), 22, 'inc_total', { measure: 'in', categoryCode: 'consult' }),
    agg('inc_other', tr('seed.dds.inc_other'), 23, 'inc_total', { measure: 'in', categoryCode: 'other_in' }),
    calc('inc_total', tr('seed.dds.inc_total'), 24, 's_income', 'SUM(children)'),

    // Расходы по категориям
    header('s_expense', tr('seed.dds.s_expense'), 30),
    agg('exp_salary', tr('seed.dds.exp_salary'), 31, 'exp_total', { measure: 'out', categoryCode: 'salary' }),
    agg('exp_rent', tr('seed.dds.exp_rent'), 32, 'exp_total', { measure: 'out', categoryCode: 'rent' }),
    agg('exp_marketing', tr('seed.dds.exp_marketing'), 33, 'exp_total', { measure: 'out', categoryCode: 'marketing' }),
    agg('exp_office', tr('seed.dds.exp_office'), 34, 'exp_total', { measure: 'out', categoryCode: 'office' }),
    agg('exp_tax', tr('seed.dds.exp_tax'), 35, 'exp_total', { measure: 'out', categoryCode: 'tax' }),
    calc('exp_total', tr('seed.dds.exp_total'), 36, 's_expense', 'SUM(children)'),

    // Остатки по счетам (остаток на конец периода)
    header('s_balances', tr('seed.dds.s_balances'), 40),
    agg('bal_cash', tr('seed.dds.bal_cash'), 41, 'bal_total', { measure: 'balance', accountCode: 'cash_uzs' }),
    agg('bal_card_uzs', tr('seed.dds.bal_card_uzs'), 42, 'bal_total', { measure: 'balance', accountCode: 'card_uzs' }),
    agg('bal_card_usd', tr('seed.dds.bal_card_usd'), 43, 'bal_total', { measure: 'balance', accountCode: 'card_usd' }),
    agg('bal_settle', tr('seed.dds.bal_settle'), 44, 'bal_total', { measure: 'balance', accountCode: 'settle' }),
    calc('bal_total', tr('seed.dds.bal_total'), 45, 's_balances', 'SUM(children)'),
  ]
}
