// Учебный пример Баланса (на 31 марта 2025). Значения из 2_Баланс_учебный_отчёт.xlsx,
// приведённые к самосогласованному виду: АКТИВЫ = ОБЯЗАТЕЛЬСТВА + КАПИТАЛ сходится
// точно (нераспределённая прибыль = Активы − Обязательства − Уставный капитал).

import type { CellValue, Item, PeriodKey } from '../domain/types'
import { fromMajor } from '../domain/money'
import { BS_ITEMS } from './bsTemplate'

// Баланс — снимок на дату; колонка = дата среза (месяц). Один срез: март 2025.
export const BS_PERIODS: PeriodKey[] = ['2025-03']

// код input-статьи -> сумма в сумах на дату среза
const VALUES: Record<string, number> = {
  // Активы
  ca_cash: 2_793_400,
  ca_receivables: 1_500_000,
  ca_inventory: 1_200_000,
  nca_equipment: 8_500_000,
  nca_renovation: 4_000_000,
  // Обязательства
  cl_payables: 900_000,
  cl_taxes: 267_900,
  cl_salary: 1_150_000,
  ll_loan: 6_000_000,
  // Капитал (нераспределённая подобрана так, чтобы баланс сходился в ноль)
  eq_charter: 5_000_000,
  eq_retained: 4_675_500,
}

export function buildBsExampleCells(): CellValue[] {
  const cells: CellValue[] = []
  for (const [itemCode, major] of Object.entries(VALUES)) {
    for (const period of BS_PERIODS) {
      cells.push({ itemCode, period, amount: fromMajor(major) })
    }
  }
  return cells
}

/** Полный учебный набор Баланса: статьи шаблона + даты-срезы + значения. */
export function buildBsExample(): { items: Item[]; periods: PeriodKey[]; cellValues: CellValue[] } {
  return {
    items: structuredClone(BS_ITEMS),
    periods: [...BS_PERIODS],
    cellValues: buildBsExampleCells(),
  }
}
