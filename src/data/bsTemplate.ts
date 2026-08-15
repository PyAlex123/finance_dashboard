// Дефолтный шаблон Баланса (форма 'bs') — по структуре учебного
// 2_Баланс_учебный_отчёт.xlsx. Баланс — «снимок» на дату (точка во времени, не за
// период). input-строки — ручной ввод по датам-колонкам (cellValues); calc —
// итоги разделов и балансовое уравнение.
//
// Главная проверка: АКТИВЫ = ОБЯЗАТЕЛЬСТВА + КАПИТАЛ (строка bs_check == 0).

import type { Item, Template } from '../domain/types'
import { t, type Key, type Locale } from '../i18n'

/** См. пояснение про функции вместо констант в data/ddsTemplate.ts. */
export function bsTemplate(locale?: Locale): Template[] {
  return [{ id: 'tpl-bs', name: t('seed.template.bs', undefined, locale), form: 'bs', version: 1 }]
}

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

export function buildBsItems(locale?: Locale): Item[] {
  const tr = (key: Key) => t(key, undefined, locale)
  return [
    // ---------- АКТИВЫ ----------
    header('s_assets', tr('seed.bs.s_assets'), 10),

    // Оборотные активы
    header('s_current_assets', tr('seed.bs.s_current_assets'), 11),
    input('ca_cash', tr('seed.bs.ca_cash'), 12, 'ca_total'),
    input('ca_receivables', tr('seed.bs.ca_receivables'), 13, 'ca_total'),
    input('ca_inventory', tr('seed.bs.ca_inventory'), 14, 'ca_total'),
    calc('ca_total', tr('seed.bs.ca_total'), 15, 's_current_assets', 'SUM(children)'),

    // Внеоборотные активы
    header('s_noncurrent_assets', tr('seed.bs.s_noncurrent_assets'), 16),
    input('nca_equipment', tr('seed.bs.nca_equipment'), 17, 'nca_total'),
    input('nca_renovation', tr('seed.bs.nca_renovation'), 18, 'nca_total'),
    calc('nca_total', tr('seed.bs.nca_total'), 19, 's_noncurrent_assets', 'SUM(children)'),

    // Итог активов
    calc('assets_total', tr('seed.bs.assets_total'), 20, null, 'ca_total + nca_total'),

    // ---------- ПАССИВЫ: ОБЯЗАТЕЛЬСТВА ----------
    header('s_liabilities', tr('seed.bs.s_liabilities'), 30),

    // Краткосрочные обязательства
    header('s_current_liab', tr('seed.bs.s_current_liab'), 31),
    input('cl_payables', tr('seed.bs.cl_payables'), 32, 'cl_total'),
    input('cl_taxes', tr('seed.bs.cl_taxes'), 33, 'cl_total'),
    input('cl_salary', tr('seed.bs.cl_salary'), 34, 'cl_total'),
    calc('cl_total', tr('seed.bs.cl_total'), 35, 's_current_liab', 'SUM(children)'),

    // Долгосрочные обязательства
    header('s_longterm_liab', tr('seed.bs.s_longterm_liab'), 36),
    input('ll_loan', tr('seed.bs.ll_loan'), 37, 'll_total'),
    calc('ll_total', tr('seed.bs.ll_total'), 38, 's_longterm_liab', 'SUM(children)'),

    // Итог обязательств
    calc('liab_total', tr('seed.bs.liab_total'), 39, null, 'cl_total + ll_total'),

    // ---------- ПАССИВЫ: КАПИТАЛ ----------
    header('s_equity', tr('seed.bs.s_equity'), 40),
    input('eq_charter', tr('seed.bs.eq_charter'), 41, 'equity_total'),
    input('eq_retained', tr('seed.bs.eq_retained'), 42, 'equity_total'),
    calc('equity_total', tr('seed.bs.equity_total'), 43, 's_equity', 'SUM(children)'),

    // Итог пассивов и балансовое уравнение
    calc('passives_total', tr('seed.bs.passives_total'), 50, null, 'liab_total + equity_total'),
    calc('bs_check', tr('seed.bs.bs_check'), 60, null, 'assets_total - passives_total'),
  ]
}

/** Итоговые строки-разделы для выделения жирным (не header-полосы). */
export const BS_TOTAL_CODES = new Set([
  'ca_total', 'nca_total', 'cl_total', 'll_total', 'equity_total',
  'assets_total', 'liab_total', 'passives_total',
])
