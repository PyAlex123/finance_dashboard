// Учебный пример P&L (значения из 3_PnL_учебный_отчёт.xlsx, янв–март 2025).

import type { CellValue, Item, PeriodKey } from '../domain/types'
import { fromMajor } from '../domain/money'
import { buildPlItems } from './plTemplate'

export const PL_PERIODS: PeriodKey[] = ['2025-01', '2025-02', '2025-03']

// код input-статьи -> суммы в сумах по [янв, фев, мар]
const VALUES: Record<string, [number, number, number]> = {
  rev_group: [8000000, 8500000, 10200000],
  rev_individual: [3200000, 3500000, 4100000],
  rev_b2b: [1500000, 2000000, 3000000],
  cogs_teachers: [4445000, 4900000, 6055000],
  opex_salary: [2800000, 2800000, 2950000],
  opex_rent: [1500000, 1500000, 1500000],
  opex_marketing: [800000, 1200000, 2100000],
  opex_office: [350000, 320000, 410000],
  opex_deprec: [200000, 200000, 200000],
  interest: [150000, 150000, 150000],
}

export function buildPlExampleCells(): CellValue[] {
  const cells: CellValue[] = []
  for (const [itemCode, byMonth] of Object.entries(VALUES)) {
    byMonth.forEach((major, i) => {
      cells.push({ itemCode, period: PL_PERIODS[i], amount: fromMajor(major) })
    })
  }
  return cells
}

/** Полный учебный набор P&L: статьи шаблона + периоды + значения. */
export function buildPlExample(): { items: Item[]; periods: PeriodKey[]; cellValues: CellValue[] } {
  return {
    items: buildPlItems(),
    periods: [...PL_PERIODS],
    cellValues: buildPlExampleCells(),
  }
}
