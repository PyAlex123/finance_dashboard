// Фикстура из учебного файла 1_ДДС_учебный_отчёт.xlsx (журнал за янв–март 2025).
// Широкая таблица Excel (операция × столбцы счетов) развёрнута в проводки operation_lines.
// Столбец «Наличные ($)» — USD-аннотация, в «Итого» не входит и здесь не моделируется.

import type {
  Account,
  Category,
  DataSnapshot,
  Operation,
  OperationLine,
  OpeningBalance,
  Rate,
  Project,
  Scenario,
} from '../domain/types'
import { fromMajor } from '../domain/money'
import { ddsTemplate, buildDdsItems } from './ddsTemplate'
import { t, type Key, type Locale } from '../i18n'

// --- Счета (в сумах; порядок = столбцы G,H,I,J исходной таблицы) ---
// Функции, а не константы: демо-данные создаются на языке, активном в момент
// нажатия «Загрузить пример». См. пояснение в data/ddsTemplate.ts.
export function fixtureAccounts(locale?: Locale): Account[] {
  const tr = (key: Key) => t(key, undefined, locale)
  return [
    { id: 'acc-cash-uzs', code: 'cash_uzs', name: tr('seed.account.cash_uzs'), currency: 'UZS', order: 1, active: true },
    { id: 'acc-card-uzs', code: 'card_uzs', name: tr('seed.account.card_uzs'), currency: 'UZS', order: 2, active: true },
    { id: 'acc-card-usd', code: 'card_usd', name: tr('seed.account.card_usd'), currency: 'UZS', order: 3, active: true },
    { id: 'acc-settle', code: 'settle', name: tr('seed.account.settle'), currency: 'UZS', order: 4, active: true },
  ]
}

// --- Категории ---
export function fixtureCategories(locale?: Locale): Category[] {
  const tr = (key: Key) => t(key, undefined, locale)
  return [
    { id: 'cat-sale', code: 'sale', name: tr('seed.category.sale'), direction: 'in', order: 1 },
    { id: 'cat-consult', code: 'consult', name: tr('seed.category.consult'), direction: 'in', order: 2 },
    { id: 'cat-other', code: 'other_in', name: tr('seed.category.other_in'), direction: 'in', order: 3 },
    { id: 'cat-salary', code: 'salary', name: tr('seed.category.salary'), direction: 'out', order: 4 },
    { id: 'cat-rent', code: 'rent', name: tr('seed.category.rent'), direction: 'out', order: 5 },
    { id: 'cat-marketing', code: 'marketing', name: tr('seed.category.marketing'), direction: 'out', order: 6 },
    { id: 'cat-office', code: 'office', name: tr('seed.category.office'), direction: 'out', order: 7 },
    { id: 'cat-tax', code: 'tax', name: tr('seed.category.tax'), direction: 'out', order: 8 },
    { id: 'cat-transfer', code: 'transfer', name: tr('seed.category.transfer'), direction: 'transfer', order: 9 },
  ]
}

// Коды -> id: от языка не зависят, поэтому берём русский набор как эталон формы.
const codeToAccId: Record<string, string> = Object.fromEntries(
  fixtureAccounts('ru').map((a) => [a.code, a.id]),
)
const codeToCatId: Record<string, string> = Object.fromEntries(
  fixtureCategories('ru').map((c) => [c.code, c.id]),
)

// --- Курс USD (справочник; в фикстуре расчёт уже в сумах, курс не применяется) ---
export const rates: Rate[] = [
  { id: 'rate-usd-2025', currency: 'USD', date: '2025-01-01', rate: fromMajor(12500) },
]

// --- Начальные остатки на 01.01.2025 (отдельная сущность, не операция) ---
export const openingBalances: OpeningBalance[] = [
  { id: 'ob-cash-uzs', accountId: 'acc-cash-uzs', date: '2025-01-01', amount: fromMajor(500000) },
  { id: 'ob-card-uzs', accountId: 'acc-card-uzs', date: '2025-01-01', amount: fromMajor(1200000) },
  { id: 'ob-card-usd', accountId: 'acc-card-usd', date: '2025-01-01', amount: fromMajor(1562500) },
  { id: 'ob-settle', accountId: 'acc-settle', date: '2025-01-01', amount: fromMajor(2000000) },
]

// --- Журнал: компактная таблица, разворачивается в operations + operation_lines ---
type OpType = 'income' | 'expense' | 'transfer'
type OpSpec = {
  date: string
  type: OpType
  cat: string
  descKey: Key
  noteKey?: Key
  // проводки: код счёта -> сумма в сумах (знаковая: приход +, расход −, переброска − и +)
  lines: Record<string, number>
}

const OPS: OpSpec[] = [
  { date: '2025-01-05', type: 'income', cat: 'sale', descKey: 'seed.op.desc.course_alimov', noteKey: 'seed.op.note.by_card', lines: { card_uzs: 650000 } },
  { date: '2025-01-07', type: 'income', cat: 'sale', descKey: 'seed.op.desc.course_ivanova', noteKey: 'seed.op.note.cash', lines: { cash_uzs: 650000 } },
  { date: '2025-01-10', type: 'income', cat: 'sale', descKey: 'seed.op.desc.course_karimov', noteKey: 'seed.op.note.by_card', lines: { card_uzs: 650000 } },
  { date: '2025-01-12', type: 'income', cat: 'consult', descKey: 'seed.op.desc.consult_romashka', noteKey: 'seed.op.note.to_settle', lines: { settle: 300000 } },
  { date: '2025-01-15', type: 'expense', cat: 'salary', descKey: 'seed.op.desc.salary_manager', lines: { card_uzs: -500000 } },
  { date: '2025-01-15', type: 'expense', cat: 'salary', descKey: 'seed.op.desc.salary_admin', lines: { card_uzs: -450000 } },
  { date: '2025-01-17', type: 'expense', cat: 'rent', descKey: 'seed.op.desc.rent_jan', lines: { settle: -1500000 } },
  { date: '2025-01-20', type: 'income', cat: 'sale', descKey: 'seed.op.desc.course_petrova', noteKey: 'seed.op.note.usd_card_52', lines: { card_usd: 650000 } },
  { date: '2025-01-22', type: 'transfer', cat: 'transfer', descKey: 'seed.op.desc.transfer_cash_to_settle', noteKey: 'seed.op.note.cash_to_bank', lines: { cash_uzs: -400000, settle: 400000 } },
  { date: '2025-01-25', type: 'expense', cat: 'marketing', descKey: 'seed.op.desc.ads_instagram', lines: { card_uzs: -320000 } },
  { date: '2025-01-28', type: 'expense', cat: 'office', descKey: 'seed.op.desc.office_supplies', lines: { cash_uzs: -85000 } },
  { date: '2025-01-31', type: 'expense', cat: 'tax', descKey: 'seed.op.desc.tax_jan', noteKey: 'seed.op.note.tax_4pct', lines: { settle: -195000 } },

  { date: '2025-02-03', type: 'income', cat: 'sale', descKey: 'seed.op.desc.course_yusupova', lines: { card_uzs: 650000 } },
  { date: '2025-02-05', type: 'income', cat: 'sale', descKey: 'seed.op.desc.course_akhmedov', lines: { cash_uzs: 650000 } },
  { date: '2025-02-07', type: 'income', cat: 'sale', descKey: 'seed.op.desc.course_nazarova', lines: { card_uzs: 650000 } },
  { date: '2025-02-10', type: 'transfer', cat: 'transfer', descKey: 'seed.op.desc.transfer_card_to_settle', noteKey: 'seed.op.note.topup_for_rent', lines: { card_uzs: -800000, settle: 800000 } },
  { date: '2025-02-12', type: 'expense', cat: 'rent', descKey: 'seed.op.desc.rent_feb', lines: { settle: -1500000 } },
  { date: '2025-02-14', type: 'income', cat: 'consult', descKey: 'seed.op.desc.consult_start', lines: { settle: 500000 } },
  { date: '2025-02-15', type: 'expense', cat: 'salary', descKey: 'seed.op.desc.salary_manager', lines: { card_uzs: -500000 } },
  { date: '2025-02-15', type: 'expense', cat: 'salary', descKey: 'seed.op.desc.salary_admin', lines: { card_uzs: -450000 } },
  { date: '2025-02-20', type: 'expense', cat: 'marketing', descKey: 'seed.op.desc.ads_target', noteKey: 'seed.op.note.fb_ig', lines: { card_uzs: -480000 } },
  { date: '2025-02-22', type: 'expense', cat: 'office', descKey: 'seed.op.desc.subscriptions', lines: { card_uzs: -75000 } },
  { date: '2025-02-25', type: 'transfer', cat: 'transfer', descKey: 'seed.op.desc.transfer_usd_to_cash', noteKey: 'seed.op.note.withdrew_100', lines: { cash_uzs: 1250000, card_usd: -1250000 } },
  { date: '2025-02-28', type: 'expense', cat: 'tax', descKey: 'seed.op.desc.tax_feb', lines: { settle: -234000 } },

  { date: '2025-03-03', type: 'income', cat: 'sale', descKey: 'seed.op.desc.course_rakhimova', lines: { card_uzs: 650000 } },
  { date: '2025-03-04', type: 'income', cat: 'sale', descKey: 'seed.op.desc.course_mirzayev', lines: { card_uzs: 650000 } },
  { date: '2025-03-05', type: 'income', cat: 'sale', descKey: 'seed.op.desc.course_tojiboeva', lines: { cash_uzs: 650000 } },
  { date: '2025-03-07', type: 'income', cat: 'sale', descKey: 'seed.op.desc.course_hamidov', noteKey: 'seed.op.note.usd_card', lines: { card_usd: 650000 } },
  { date: '2025-03-10', type: 'income', cat: 'consult', descKey: 'seed.op.desc.consult_uspeh', lines: { settle: 1200000 } },
  { date: '2025-03-12', type: 'expense', cat: 'rent', descKey: 'seed.op.desc.rent_mar', lines: { settle: -1500000 } },
  { date: '2025-03-15', type: 'expense', cat: 'salary', descKey: 'seed.op.desc.salary_manager', lines: { card_uzs: -500000 } },
  { date: '2025-03-15', type: 'expense', cat: 'salary', descKey: 'seed.op.desc.salary_admin', lines: { card_uzs: -450000 } },
  { date: '2025-03-15', type: 'expense', cat: 'salary', descKey: 'seed.op.desc.bonus_manager', noteKey: 'seed.op.note.sales_bonus', lines: { card_uzs: -200000 } },
  { date: '2025-03-18', type: 'transfer', cat: 'transfer', descKey: 'seed.op.desc.transfer_cash_to_card', noteKey: 'seed.op.note.cash_to_card', lines: { cash_uzs: -650000, card_uzs: 650000 } },
  { date: '2025-03-20', type: 'expense', cat: 'marketing', descKey: 'seed.op.desc.ads_target_mar', noteKey: 'seed.op.note.budget_up', lines: { card_uzs: -650000 } },
  { date: '2025-03-22', type: 'expense', cat: 'office', descKey: 'seed.op.desc.office_supplies', lines: { cash_uzs: -120000 } },
  { date: '2025-03-25', type: 'expense', cat: 'tax', descKey: 'seed.op.desc.tax_mar', lines: { settle: -268000 } },
  { date: '2025-03-28', type: 'income', cat: 'other_in', descKey: 'seed.op.desc.referral_bonus', noteKey: 'seed.op.note.example', lines: { card_uzs: 150000 } },
  { date: '2025-03-28', type: 'expense', cat: 'office', descKey: 'seed.op.desc.office_supplies', noteKey: 'seed.op.note.example', lines: { cash_uzs: -1000000 } },
]

function buildJournal(locale?: Locale): { operations: Operation[]; operationLines: OperationLine[] } {
  const operations: Operation[] = []
  const operationLines: OperationLine[] = []
  OPS.forEach((spec, i) => {
    const opId = `op-${String(i + 1).padStart(3, '0')}`
    operations.push({
      id: opId,
      date: spec.date,
      type: spec.type,
      description: t(spec.descKey, undefined, locale),
      categoryId: codeToCatId[spec.cat] ?? null,
      note: spec.noteKey ? t(spec.noteKey, undefined, locale) : undefined,
    })
    Object.entries(spec.lines).forEach(([accCode, major], j) => {
      operationLines.push({
        id: `${opId}-l${j + 1}`,
        operationId: opId,
        accountId: codeToAccId[accCode],
        amount: fromMajor(major),
        currency: 'UZS',
      })
    })
  })
  return { operations, operationLines }
}

export function fixtureProjects(locale?: Locale): Project[] {
  return [
      {
        id: 'proj-default',
        name: t('seed.project.default', undefined, locale),
        periodStart: '2025-01',
        periodEnd: '2025-03',
      },
  ]
}

export function fixtureScenarios(locale?: Locale): Scenario[] {
  return [
      {
        id: 'scn-fact',
        projectId: 'proj-default',
        name: t('seed.scenario.fact', undefined, locale),
        kind: 'fact',
      },
  ]
}

/** Полный слепок фикстуры для repository / стора. */
export function buildFixtureSnapshot(locale?: Locale): DataSnapshot {
  const journal = buildJournal(locale)
  return {
    accounts: fixtureAccounts(locale),
    categories: fixtureCategories(locale),
    rates: structuredClone(rates),
    openingBalances: structuredClone(openingBalances),
    operations: journal.operations,
    operationLines: journal.operationLines,
    templates: ddsTemplate(locale),
    items: buildDdsItems(locale),
    overrides: [],
    templateVersions: [],
    cellValues: [],
    plPeriods: [],
    cfAuto: true,
    projects: fixtureProjects(locale),
    scenarios: fixtureScenarios(locale),
  }
}

/** Счета по умолчанию для нового ДДС — можно сразу вводить операции. */
export function defaultAccounts(locale?: Locale): Account[] {
  const tr = (key: Key) => t(key, undefined, locale)
  return [
      { id: 'acc-settlement', code: 'settlement', name: tr('seed.account.settlement'), currency: 'UZS', order: 1, active: true },
      { id: 'acc-cash', code: 'cash', name: tr('seed.account.cash'), currency: 'UZS', order: 2, active: true },
      { id: 'acc-card', code: 'card', name: tr('seed.account.card'), currency: 'UZS', order: 3, active: true },
  ]
}

/**
 * Дополнить снимок счетами по умолчанию, если счетов нет вообще.
 * Нужно для снимков, сохранённых до появления счетов по умолчанию.
 */
export function withDefaultAccounts(data: DataSnapshot): DataSnapshot {
  if (data.accounts.length > 0) return data
  return { ...data, accounts: defaultAccounts() }
}

/** Пустой слепок ДДС — «чистый лист» со счетами по умолчанию. */
export function buildEmptySnapshot(): DataSnapshot {
  return {
    accounts: defaultAccounts(),
    defaultsSeeded: true,
    categories: [],
    rates: [],
    openingBalances: [],
    operations: [],
    operationLines: [],
    templates: ddsTemplate(),
    items: [],
    overrides: [],
    templateVersions: [],
    cellValues: [],
    plPeriods: [],
    cfAuto: true,
    projects: [],
    scenarios: [],
  }
}
