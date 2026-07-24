import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  readWorkbookGrids, detectReportKind,
  detectPlMapping, parsePlMatrix,
  detectDdsMapping, parseDdsJournal,
  type Grid,
} from './importExcel'
import { parsePeriodLabel } from '../engine/periods'
import { buildReport } from '../engine/report'
import { buildAggContext, aggValue } from '../engine/aggregate'
import { buildEmptySnapshot } from './fixtures'
import { fromMajor } from '../domain/money'
import type { DataSnapshot } from '../domain/types'

const maj = (arr: number[]) => arr.map((n) => fromMajor(n))
const readBook = (path: string) => readWorkbookGrids(new Uint8Array(readFileSync(path)))

describe('parsePeriodLabel', () => {
  it('распознаёт разные форматы', () => {
    expect(parsePeriodLabel('2025-01', 2000)).toBe('2025-01')
    expect(parsePeriodLabel('Январь', 2025)).toBe('2025-01')
    expect(parsePeriodLabel('март 2024', 2025)).toBe('2024-03')
    expect(parsePeriodLabel('01.2025', 2000)).toBe('2025-01')
    expect(parsePeriodLabel('31.03.2025', 2000)).toBe('2025-03')
    expect(parsePeriodLabel('Фев', 2025)).toBe('2025-02')
    expect(parsePeriodLabel('8000000', 2025)).toBeNull()
    expect(parsePeriodLabel('% от выручки', 2025)).toBeNull()
  })
})

describe('парсер P&L-матрицы (синтетика)', () => {
  const grid: Grid = [
    ['Показатель', 'Январь', 'Февраль'],
    ['▌ Выручка', null, null],
    ['Продукт А', 1000, 2000],
    ['Продукт Б', 500, 500],
    ['ИТОГО выручка', 1500, 2500],
  ]
  it('строит input + calc(SUM) и значения', () => {
    const mapping = detectPlMapping(grid, 2025)
    expect(mapping.headerRow).toBe(0)
    expect(mapping.periodCols.map((p) => p.label)).toEqual(['Январь', 'Февраль'])
    const parsed = parsePlMatrix(grid, mapping, { defaultYear: 2025 })
    expect(parsed.periods).toEqual(['2025-01', '2025-02'])

    const s = buildEmptySnapshot()
    s.items = parsed.items
    s.plPeriods = parsed.periods
    s.cellValues = parsed.cellValues
    const rep = buildReport(s, { form: 'pl' })
    const total = rep.rows.find((r) => /итого выручка/i.test(r.name))!
    expect(total.values).toEqual(maj([1500, 2500]))
  })
})

describe('парсер ДДС-журнала (синтетика)', () => {
  const grid: Grid = [
    ['Дата', 'Тип', 'Описание', 'Категория', 'Касса', 'Банк'],
    ['05.01.2025', '🟢 Приход', 'Продажа', 'Выручка', 100000, null],
    ['10.01.2025', '🔴 Расход', 'Аренда', 'Аренда', null, -30000],
    ['12.01.2025', '🔵 Переброска', 'В банк', '', -50000, 50000],
  ]
  it('операции, проводки, типы и категории', () => {
    const mapping = detectDdsMapping(grid)
    expect(mapping.dateCol).toBe(0)
    expect(mapping.accountCols.map((a) => a.name)).toEqual(['Касса', 'Банк'])
    const parsed = parseDdsJournal(grid, mapping, { defaultYear: 2025 })
    expect(parsed.operations).toHaveLength(3)
    expect(parsed.accounts).toHaveLength(2)
    const transfer = parsed.operations.find((o) => o.type === 'transfer')!
    const legs = parsed.operationLines.filter((l) => l.operationId === transfer.id)
    expect(legs.reduce((a, l) => a + l.amount, 0n)).toBe(0n)
  })
})

describe('интеграция: импорт реального 3_PnL_учебный_отчёт.xlsx', () => {
  it('отчёт совпадает с Excel (выручка/валовая/чистая)', () => {
    const { sheetNames, grids } = readBook('3_PnL_учебный_отчёт.xlsx')
    const grid = grids[sheetNames[0]]
    expect(detectReportKind(grid, 2025)).toBe('pl')
    const parsed = parsePlMatrix(grid, detectPlMapping(grid, 2025), { defaultYear: 2025 })

    const s = buildEmptySnapshot()
    s.items = parsed.items
    s.plPeriods = parsed.periods
    s.cellValues = parsed.cellValues
    const rep = buildReport(s, { form: 'pl' })
    const val = (re: RegExp) => rep.rows.find((r) => re.test(r.name))!.values

    expect(rep.periods).toEqual(['2025-01', '2025-02', '2025-03'])
    expect(val(/итого выручка/i)).toEqual(maj([12700000, 14000000, 17300000]))
    expect(val(/валовая прибыл/i)).toEqual(maj([8255000, 9100000, 11245000]))
    expect(val(/чистая прибыл/i)).toEqual(maj([2086750, 2490500, 3344750]))
  })
})

describe('интеграция: импорт реального 1_ДДС_учебный_отчёт.xlsx', () => {
  it('журнал реконструируется, приход/расход и остатки сходятся', () => {
    const { sheetNames, grids } = readBook('1_ДДС_учебный_отчёт.xlsx')
    const grid = grids[sheetNames[0]]
    expect(detectReportKind(grid, 2025)).toBe('dds')
    const parsed = parseDdsJournal(grid, detectDdsMapping(grid), { defaultYear: 2025 })

    expect(parsed.accounts).toHaveLength(4) // Наличные ($) исключён по '$'
    expect(parsed.openingBalances).toHaveLength(4)
    expect(parsed.operations).toHaveLength(39)

    const s: DataSnapshot = {
      ...buildEmptySnapshot(),
      accounts: parsed.accounts,
      categories: parsed.categories,
      operations: parsed.operations,
      operationLines: parsed.operationLines,
      openingBalances: parsed.openingBalances,
    }
    const ctx = buildAggContext(s)
    expect(aggValue(ctx, { measure: 'in' }, '2025-01')).toBe(fromMajor(2900000))
    expect(aggValue(ctx, { measure: 'out' }, '2025-01')).toBe(fromMajor(3050000))

    // итоговый остаток = начало + все проводки
    const opening = parsed.openingBalances.reduce((a, o) => a + o.amount, 0n)
    const flow = parsed.operationLines.reduce((a, l) => a + l.amount, 0n)
    expect(opening + flow).toBe(fromMajor(3585500))
  })
})
