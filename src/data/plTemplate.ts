// Дефолтный шаблон P&L (форма 'pl') — по структуре учебного 3_PnL_учебный_отчёт.xlsx.
// input-строки — ручной ввод по периодам (cellValues); calc — расчётные уровни прибыли.

import type { Item, Template } from '../domain/types'
import { t, type Key, type Locale } from '../i18n'

/** См. пояснение про функции вместо констант в data/ddsTemplate.ts. */
export function plTemplate(locale?: Locale): Template[] {
  return [{ id: 'tpl-pl', name: t('seed.template.pl', undefined, locale), form: 'pl', version: 1 }]
}

const T = 'tpl-pl'

function header(code: string, name: string, order: number): Item {
  return { id: `pl-${code}`, templateId: T, code, parentCode: null, order, form: 'pl', kind: 'header', name }
}
function input(code: string, name: string, order: number, parentCode: string | null): Item {
  return { id: `pl-${code}`, templateId: T, code, parentCode, order, form: 'pl', kind: 'input', name }
}
function calc(code: string, name: string, order: number, parentCode: string | null, formulaDefault: string): Item {
  return { id: `pl-${code}`, templateId: T, code, parentCode, order, form: 'pl', kind: 'calc', name, formulaDefault }
}

export function buildPlItems(locale?: Locale): Item[] {
  const tr = (key: Key) => t(key, undefined, locale)
  return [
    // Выручка
    header('s_revenue', tr('seed.pl.s_revenue'), 10),
    input('rev_group', tr('seed.pl.rev_group'), 11, 'rev_total'),
    input('rev_individual', tr('seed.pl.rev_individual'), 12, 'rev_total'),
    input('rev_b2b', tr('seed.pl.rev_b2b'), 13, 'rev_total'),
    calc('rev_total', tr('seed.pl.rev_total'), 14, 's_revenue', 'SUM(children)'),

    // Себестоимость
    header('s_cogs', tr('seed.pl.s_cogs'), 20),
    input('cogs_teachers', tr('seed.pl.cogs_teachers'), 21, 'cogs_total'),
    calc('cogs_total', tr('seed.pl.cogs_total'), 22, 's_cogs', 'SUM(children)'),

    // Валовая прибыль
    calc('gross', tr('seed.pl.gross'), 30, null, 'rev_total - cogs_total'),

    // Операционные расходы
    header('s_opex', tr('seed.pl.s_opex'), 40),
    input('opex_salary', tr('seed.pl.opex_salary'), 41, 'opex_total'),
    input('opex_rent', tr('seed.pl.opex_rent'), 42, 'opex_total'),
    input('opex_marketing', tr('seed.pl.opex_marketing'), 43, 'opex_total'),
    input('opex_office', tr('seed.pl.opex_office'), 44, 'opex_total'),
    input('opex_deprec', tr('seed.pl.opex_deprec'), 45, 'opex_total'),
    calc('opex_total', tr('seed.pl.opex_total'), 46, 's_opex', 'SUM(children)'),

    // Операционная прибыль
    calc('op_profit', tr('seed.pl.op_profit'), 50, null, 'gross - opex_total'),

    // Прочие статьи
    header('s_other', tr('seed.pl.s_other'), 60),
    input('interest', tr('seed.pl.interest'), 61, 's_other'),

    // Итоговые уровни прибыли
    calc('pretax', tr('seed.pl.pretax'), 70, null, 'op_profit - interest'),
    calc('tax', tr('seed.pl.tax'), 71, null, 'pretax * 0.15'),
    calc('net_profit', tr('seed.pl.net_profit'), 72, null, 'pretax - tax'),
  ]
}
