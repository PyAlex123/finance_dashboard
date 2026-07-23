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
import { DDS_TEMPLATE, DDS_ITEMS } from './ddsTemplate'

// --- Счета (в сумах; порядок = столбцы G,H,I,J исходной таблицы) ---
export const accounts: Account[] = [
  { id: 'acc-cash-uzs', code: 'cash_uzs', name: 'Наличные (сум)', currency: 'UZS', order: 1, active: true },
  { id: 'acc-card-uzs', code: 'card_uzs', name: 'Карта UZS', currency: 'UZS', order: 2, active: true },
  { id: 'acc-card-usd', code: 'card_usd', name: 'Карта USD (в сумах)', currency: 'UZS', order: 3, active: true },
  { id: 'acc-settle', code: 'settle', name: 'Расч. счёт', currency: 'UZS', order: 4, active: true },
]

// --- Категории ---
export const categories: Category[] = [
  { id: 'cat-sale', code: 'sale', name: 'Продажа курсов', direction: 'in', order: 1 },
  { id: 'cat-consult', code: 'consult', name: 'Консультации', direction: 'in', order: 2 },
  { id: 'cat-other', code: 'other_in', name: 'Прочие доходы', direction: 'in', order: 3 },
  { id: 'cat-salary', code: 'salary', name: 'Оплата труда', direction: 'out', order: 4 },
  { id: 'cat-rent', code: 'rent', name: 'Аренда', direction: 'out', order: 5 },
  { id: 'cat-marketing', code: 'marketing', name: 'Маркетинг', direction: 'out', order: 6 },
  { id: 'cat-office', code: 'office', name: 'Офисные расходы', direction: 'out', order: 7 },
  { id: 'cat-tax', code: 'tax', name: 'Налоги', direction: 'out', order: 8 },
  { id: 'cat-transfer', code: 'transfer', name: 'Переброска', direction: 'transfer', order: 9 },
]

const codeToAccId: Record<string, string> = Object.fromEntries(
  accounts.map((a) => [a.code, a.id]),
)
const codeToCatId: Record<string, string> = Object.fromEntries(
  categories.map((c) => [c.code, c.id]),
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
  desc: string
  note?: string
  // проводки: код счёта -> сумма в сумах (знаковая: приход +, расход −, переброска − и +)
  lines: Record<string, number>
}

const OPS: OpSpec[] = [
  { date: '2025-01-05', type: 'income', cat: 'sale', desc: 'Оплата курса — Алимов А.', note: 'Оплата картой', lines: { card_uzs: 650000 } },
  { date: '2025-01-07', type: 'income', cat: 'sale', desc: 'Оплата курса — Иванова С.', note: 'Наличные', lines: { cash_uzs: 650000 } },
  { date: '2025-01-10', type: 'income', cat: 'sale', desc: 'Оплата курса — Каримов Б.', note: 'Оплата картой', lines: { card_uzs: 650000 } },
  { date: '2025-01-12', type: 'income', cat: 'consult', desc: 'Консультация для ИП «Ромашка»', note: 'Перевод на расч/счёт', lines: { settle: 300000 } },
  { date: '2025-01-15', type: 'expense', cat: 'salary', desc: 'Зарплата — Менеджер Дилноза', lines: { card_uzs: -500000 } },
  { date: '2025-01-15', type: 'expense', cat: 'salary', desc: 'Зарплата — Администратор Фаррух', lines: { card_uzs: -450000 } },
  { date: '2025-01-17', type: 'expense', cat: 'rent', desc: 'Аренда офиса — январь', lines: { settle: -1500000 } },
  { date: '2025-01-20', type: 'income', cat: 'sale', desc: 'Оплата курса — Петрова М.', note: 'USD картой ($52)', lines: { card_usd: 650000 } },
  { date: '2025-01-22', type: 'transfer', cat: 'transfer', desc: 'Переброска: наличные → расч/счёт', note: 'Сдали наличку в банк', lines: { cash_uzs: -400000, settle: 400000 } },
  { date: '2025-01-25', type: 'expense', cat: 'marketing', desc: 'Реклама в Instagram — январь', lines: { card_uzs: -320000 } },
  { date: '2025-01-28', type: 'expense', cat: 'office', desc: 'Офисные расходы (бумага, кофе)', lines: { cash_uzs: -85000 } },
  { date: '2025-01-31', type: 'expense', cat: 'tax', desc: 'Налог с оборота — январь', note: '4% от выручки', lines: { settle: -195000 } },

  { date: '2025-02-03', type: 'income', cat: 'sale', desc: 'Оплата курса — Юсупова З.', lines: { card_uzs: 650000 } },
  { date: '2025-02-05', type: 'income', cat: 'sale', desc: 'Оплата курса — Ахмедов Р.', lines: { cash_uzs: 650000 } },
  { date: '2025-02-07', type: 'income', cat: 'sale', desc: 'Оплата курса — Назарова Л.', lines: { card_uzs: 650000 } },
  { date: '2025-02-10', type: 'transfer', cat: 'transfer', desc: 'Переброска: карта UZS → расч/счёт', note: 'Пополнение р/счёта для аренды', lines: { card_uzs: -800000, settle: 800000 } },
  { date: '2025-02-12', type: 'expense', cat: 'rent', desc: 'Аренда офиса — февраль', lines: { settle: -1500000 } },
  { date: '2025-02-14', type: 'income', cat: 'consult', desc: 'Консультация — ООО «Старт»', lines: { settle: 500000 } },
  { date: '2025-02-15', type: 'expense', cat: 'salary', desc: 'Зарплата — Менеджер Дилноза', lines: { card_uzs: -500000 } },
  { date: '2025-02-15', type: 'expense', cat: 'salary', desc: 'Зарплата — Администратор Фаррух', lines: { card_uzs: -450000 } },
  { date: '2025-02-20', type: 'expense', cat: 'marketing', desc: 'Таргетированная реклама', note: 'Facebook + Instagram', lines: { card_uzs: -480000 } },
  { date: '2025-02-22', type: 'expense', cat: 'office', desc: 'Подписка Canva + Zoom', lines: { card_uzs: -75000 } },
  { date: '2025-02-25', type: 'transfer', cat: 'transfer', desc: 'Переброска: USD карта → наличные', note: 'Сняли $100 наличными', lines: { cash_uzs: 1250000, card_usd: -1250000 } },
  { date: '2025-02-28', type: 'expense', cat: 'tax', desc: 'Налог с оборота — февраль', lines: { settle: -234000 } },

  { date: '2025-03-03', type: 'income', cat: 'sale', desc: 'Оплата курса — Rakhimova D.', lines: { card_uzs: 650000 } },
  { date: '2025-03-04', type: 'income', cat: 'sale', desc: 'Оплата курса — Mirzayev S.', lines: { card_uzs: 650000 } },
  { date: '2025-03-05', type: 'income', cat: 'sale', desc: 'Оплата курса — Tojiboeva N.', lines: { cash_uzs: 650000 } },
  { date: '2025-03-07', type: 'income', cat: 'sale', desc: 'Оплата курса — Hamidov A.', note: 'USD картой', lines: { card_usd: 650000 } },
  { date: '2025-03-10', type: 'income', cat: 'consult', desc: 'Корпоративный заказ — ООО «Успех»', lines: { settle: 1200000 } },
  { date: '2025-03-12', type: 'expense', cat: 'rent', desc: 'Аренда офиса — март', lines: { settle: -1500000 } },
  { date: '2025-03-15', type: 'expense', cat: 'salary', desc: 'Зарплата — Менеджер Дилноза', lines: { card_uzs: -500000 } },
  { date: '2025-03-15', type: 'expense', cat: 'salary', desc: 'Зарплата — Администратор Фаррух', lines: { card_uzs: -450000 } },
  { date: '2025-03-15', type: 'expense', cat: 'salary', desc: 'Бонус — Менеджер Дилноза', note: 'Бонус за продажи', lines: { card_uzs: -200000 } },
  { date: '2025-03-18', type: 'transfer', cat: 'transfer', desc: 'Переброска: наличные → карта UZS', note: 'Перевели наличку на карту', lines: { cash_uzs: -650000, card_uzs: 650000 } },
  { date: '2025-03-20', type: 'expense', cat: 'marketing', desc: 'Таргетированная реклама — март', note: 'Увеличили бюджет', lines: { card_uzs: -650000 } },
  { date: '2025-03-22', type: 'expense', cat: 'office', desc: 'Офисные расходы (бумага, кофе)', lines: { cash_uzs: -120000 } },
  { date: '2025-03-25', type: 'expense', cat: 'tax', desc: 'Налог с оборота — март', lines: { settle: -268000 } },
  { date: '2025-03-28', type: 'income', cat: 'other_in', desc: 'Реферальный бонус', note: 'Для примера', lines: { card_uzs: 150000 } },
  { date: '2025-03-28', type: 'expense', cat: 'office', desc: 'Офисные расходы (бумага, кофе)', note: 'для примера', lines: { cash_uzs: -1000000 } },
]

function buildJournal(): { operations: Operation[]; operationLines: OperationLine[] } {
  const operations: Operation[] = []
  const operationLines: OperationLine[] = []
  OPS.forEach((spec, i) => {
    const opId = `op-${String(i + 1).padStart(3, '0')}`
    operations.push({
      id: opId,
      date: spec.date,
      type: spec.type,
      description: spec.desc,
      categoryId: codeToCatId[spec.cat] ?? null,
      note: spec.note,
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

const journal = buildJournal()
export const operations = journal.operations
export const operationLines = journal.operationLines

export const projects: Project[] = [
  { id: 'proj-default', name: 'Учебный проект', periodStart: '2025-01', periodEnd: '2025-03' },
]

export const scenarios: Scenario[] = [
  { id: 'scn-fact', projectId: 'proj-default', name: 'Факт', kind: 'fact' },
]

/** Полный слепок фикстуры для repository / стора. */
export function buildFixtureSnapshot(): DataSnapshot {
  return {
    accounts: structuredClone(accounts),
    categories: structuredClone(categories),
    rates: structuredClone(rates),
    openingBalances: structuredClone(openingBalances),
    operations: structuredClone(operations),
    operationLines: structuredClone(operationLines),
    templates: structuredClone(DDS_TEMPLATE),
    items: structuredClone(DDS_ITEMS),
    overrides: [],
    templateVersions: [],
    projects: structuredClone(projects),
    scenarios: structuredClone(scenarios),
  }
}
