// Дефолтный шаблон P&L (форма 'pl') — по структуре учебного 3_PnL_учебный_отчёт.xlsx.
// input-строки — ручной ввод по периодам (cellValues); calc — расчётные уровни прибыли.

import type { Item, Template } from '../domain/types'

export const PL_TEMPLATE: Template[] = [{ id: 'tpl-pl', name: 'P&L', form: 'pl', version: 1 }]

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

export const PL_ITEMS: Item[] = [
  // Выручка
  header('s_revenue', 'Выручка', 10),
  input('rev_group', 'Групповые курсы', 11, 'rev_total'),
  input('rev_individual', 'Индивидуальные занятия', 12, 'rev_total'),
  input('rev_b2b', 'B2B консультации', 13, 'rev_total'),
  calc('rev_total', 'ИТОГО выручка', 14, 's_revenue', 'SUM(children)'),

  // Себестоимость
  header('s_cogs', 'Себестоимость (прямые затраты)', 20),
  input('cogs_teachers', 'Оплата приглашённым преподавателям', 21, 'cogs_total'),
  calc('cogs_total', 'ИТОГО себестоимость', 22, 's_cogs', 'SUM(children)'),

  // Валовая прибыль
  calc('gross', 'Валовая прибыль', 30, null, 'rev_total - cogs_total'),

  // Операционные расходы
  header('s_opex', 'Операционные расходы', 40),
  input('opex_salary', 'Оплата труда (штат)', 41, 'opex_total'),
  input('opex_rent', 'Аренда', 42, 'opex_total'),
  input('opex_marketing', 'Маркетинг', 43, 'opex_total'),
  input('opex_office', 'Офисные расходы', 44, 'opex_total'),
  input('opex_deprec', 'Амортизация оборудования', 45, 'opex_total'),
  calc('opex_total', 'ИТОГО операционные расходы', 46, 's_opex', 'SUM(children)'),

  // Операционная прибыль
  calc('op_profit', 'Операционная прибыль', 50, null, 'gross - opex_total'),

  // Прочие статьи
  header('s_other', 'Прочие статьи', 60),
  input('interest', 'Проценты по кредиту', 61, 's_other'),

  // Итоговые уровни прибыли
  calc('pretax', 'Прибыль до налогообложения', 70, null, 'op_profit - interest'),
  calc('tax', 'Налог на прибыль (15%)', 71, null, 'pretax * 0.15'),
  calc('net_profit', 'Чистая прибыль', 72, null, 'pretax - tax'),
]
