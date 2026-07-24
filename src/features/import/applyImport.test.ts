import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { applyPlImport, applyDdsImport } from './applyImport'
import {
  readWorkbookGrids, detectPlMapping, parsePlMatrix, detectDdsMapping, parseDdsJournal,
} from '../../data/importExcel'
import { buildEmptySnapshot } from '../../data/fixtures'
import { buildReport } from '../../engine/report'
import { fromMajor } from '../../domain/money'

const readBook = (p: string) => readWorkbookGrids(new Uint8Array(readFileSync(p)))
const maj = (arr: number[]) => arr.map((n) => fromMajor(n))

describe('applyPlImport → отчёт P&L', () => {
  it('импорт реального 3_PnL даёт живой отчёт с чистой прибылью', () => {
    const { sheetNames, grids } = readBook('3_PnL_учебный_отчёт.xlsx')
    const grid = grids[sheetNames[0]]
    const parsed = parsePlMatrix(grid, detectPlMapping(grid, 2025), { defaultYear: 2025 })
    const next = applyPlImport(buildEmptySnapshot(), parsed, 'replace')

    const rep = buildReport(next, { form: 'pl' })
    expect(rep.rows.find((r) => /чистая прибыл/i.test(r.name))!.values).toEqual(maj([2086750, 2490500, 3344750]))
    // ДДС не затронут
    expect(next.operations).toHaveLength(0)
  })
})

describe('applyDdsImport → отчёт ДДС', () => {
  it('импорт реального 1_ДДС строит журнал и стандартный отчёт с остатками', () => {
    const { sheetNames, grids } = readBook('1_ДДС_учебный_отчёт.xlsx')
    const grid = grids[sheetNames[0]]
    const parsed = parseDdsJournal(grid, detectDdsMapping(grid), { defaultYear: 2025 })
    const next = applyDdsImport(buildEmptySnapshot(), parsed, 'replace')

    const rep = buildReport(next, { form: 'cf' })
    expect(rep.periods).toEqual(['2025-01', '2025-02', '2025-03'])
    expect(rep.rows.find((r) => r.code === 'v_total_in')!.values).toEqual(maj([2900000, 2450000, 3950000]))
    expect(rep.rows.find((r) => r.code === 'v_total_out')!.values).toEqual(maj([3050000, 3239000, 4688000]))
    // итог по всем счетам после марта
    const balTotal = rep.rows.find((r) => r.code === 'bal_total')!.values
    expect(balTotal[balTotal.length - 1]).toBe(fromMajor(3585500))
  })

  it('режим merge добавляет к существующим данным', () => {
    const { sheetNames, grids } = readBook('1_ДДС_учебный_отчёт.xlsx')
    const grid = grids[sheetNames[0]]
    const parsed = parseDdsJournal(grid, detectDdsMapping(grid), { defaultYear: 2025 })
    const first = applyDdsImport(buildEmptySnapshot(), parsed, 'replace')
    const merged = applyDdsImport(first, parsed, 'merge')
    expect(merged.operations.length).toBe(first.operations.length * 2)
  })
})
