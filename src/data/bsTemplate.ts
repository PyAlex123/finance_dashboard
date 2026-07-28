// Дефолтный шаблон Баланса (форма 'bs') — по структуре учебного
// 2_Баланс_учебный_отчёт.xlsx. Баланс — «снимок» на дату (точка во времени, не за
// период). input-строки — ручной ввод по датам-колонкам (cellValues); calc —
// итоги разделов и балансовое уравнение.
//
// Главная проверка: АКТИВЫ = ОБЯЗАТЕЛЬСТВА + КАПИТАЛ (строка bs_check == 0).

import type { Item, Template } from '../domain/types'

export const BS_TEMPLATE: Template[] = [{ id: 'tpl-bs', name: 'Баланс', form: 'bs', version: 1 }]

const T = 'tpl-bs'

function header(code: string, name: string, order: number): Item {
  return { id: `bs-${code}`, templateId: T, code, parentCode: null, order, form: 'bs', kind: 'header', name }
}
function input(code: string, name: string, order: number, parentCode: string | null): Item {
  return { id: `bs-${code}`, templateId: T, code, parentCode, order, form: 'bs', kind: 'input', name }
}
function calc(code: string, name: string, order: number, parentCode: string | null, formulaDefault: string): Item {
  return { id: `bs-${code}`, templateId: T, code, parentCode, order, form: 'bs', kind: 'calc', name, formulaDefault }
}

export const BS_ITEMS: Item[] = [
  // ---------- АКТИВЫ ----------
  header('s_assets', 'АКТИВЫ', 10),

  // Оборотные активы
  header('s_current_assets', 'Оборотные активы', 11),
  input('ca_cash', 'Деньги на счетах и в кассе', 12, 'ca_total'),
  input('ca_receivables', 'Дебиторская задолженность (клиенты должны)', 13, 'ca_total'),
  input('ca_inventory', 'Запасы (материалы, учебные пособия)', 14, 'ca_total'),
  calc('ca_total', 'Итого оборотные активы', 15, 's_current_assets', 'SUM(children)'),

  // Внеоборотные активы
  header('s_noncurrent_assets', 'Внеоборотные активы', 16),
  input('nca_equipment', 'Оборудование (компьютеры, мебель)', 17, 'nca_total'),
  input('nca_renovation', 'Ремонт и отделка офиса', 18, 'nca_total'),
  calc('nca_total', 'Итого внеоборотные активы', 19, 's_noncurrent_assets', 'SUM(children)'),

  // Итог активов
  calc('assets_total', 'ИТОГО АКТИВЫ', 20, null, 'ca_total + nca_total'),

  // ---------- ПАССИВЫ: ОБЯЗАТЕЛЬСТВА ----------
  header('s_liabilities', 'ОБЯЗАТЕЛЬСТВА', 30),

  // Краткосрочные обязательства
  header('s_current_liab', 'Краткосрочные обязательства', 31),
  input('cl_payables', 'Кредиторская задолженность (поставщикам)', 32, 'cl_total'),
  input('cl_taxes', 'Налоги к уплате', 33, 'cl_total'),
  input('cl_salary', 'Зарплата к выплате', 34, 'cl_total'),
  calc('cl_total', 'Итого краткосрочные обязательства', 35, 's_current_liab', 'SUM(children)'),

  // Долгосрочные обязательства
  header('s_longterm_liab', 'Долгосрочные обязательства', 36),
  input('ll_loan', 'Долгосрочный кредит на развитие', 37, 'll_total'),
  calc('ll_total', 'Итого долгосрочные обязательства', 38, 's_longterm_liab', 'SUM(children)'),

  // Итог обязательств
  calc('liab_total', 'ИТОГО ОБЯЗАТЕЛЬСТВА', 39, null, 'cl_total + ll_total'),

  // ---------- ПАССИВЫ: КАПИТАЛ ----------
  header('s_equity', 'КАПИТАЛ', 40),
  input('eq_charter', 'Уставный капитал (вложения собственника)', 41, 'equity_total'),
  input('eq_retained', 'Нераспределённая прибыль (накопленная)', 42, 'equity_total'),
  calc('equity_total', 'Итого капитал', 43, 's_equity', 'SUM(children)'),

  // Итог пассивов и балансовое уравнение
  calc('passives_total', 'ИТОГО ПАССИВЫ (Обязательства + Капитал)', 50, null, 'liab_total + equity_total'),
  calc('bs_check', 'Контроль: Активы − Пассивы', 60, null, 'assets_total - passives_total'),
]

/** Итоговые строки-разделы для выделения жирным (не header-полосы). */
export const BS_TOTAL_CODES = new Set([
  'ca_total', 'nca_total', 'cl_total', 'll_total', 'equity_total',
  'assets_total', 'liab_total', 'passives_total',
])
