import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { exportXlsx, importXlsx, exportWorkbook } from './xlsx'
import { buildFixtureSnapshot } from './fixtures'
import { buildReport } from '../engine/report'

describe('Excel экспорт/импорт (round-trip)', () => {
  it('round-trip восстанавливает слепок точно (bigint сохраняются)', () => {
    const original = buildFixtureSnapshot()
    const restored = importXlsx(exportXlsx(original))
    expect(restored).toEqual(original)
    expect(typeof restored.operationLines[0].amount).toBe('bigint')
  })

  it('после round-trip отчёт идентичен', () => {
    const original = buildFixtureSnapshot()
    const restored = importXlsx(exportXlsx(original))
    const a = buildReport(original).rows.find((r) => r.code === 'bal_total')!.values
    const b = buildReport(restored).rows.find((r) => r.code === 'bal_total')!.values
    expect(b).toEqual(a)
  })

  it('книга содержит листы Отчёт, Дашборд, Журнал и скрытый Данные', () => {
    const wb = exportWorkbook(buildFixtureSnapshot())
    expect(wb.SheetNames).toContain('Отчёт')
    expect(wb.SheetNames).toContain('Дашборд')
    expect(wb.SheetNames).toContain('Журнал')
    expect(wb.SheetNames).toContain('Данные')
    const idx = wb.SheetNames.indexOf('Данные')
    expect(wb.Workbook?.Sheets?.[idx]?.Hidden).toBe(1)
  })

  it('лист «Отчёт» (авто) содержит итог поступлений в сумах + живую формулу', () => {
    const wb = exportWorkbook(buildFixtureSnapshot())
    const ws = wb.Sheets['Отчёт']
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 })
    // авто-структура: строка «ИТОГО поступления» = весь приход по месяцам + ИТОГО
    const rowIdx = rows.findIndex((r) => String(r[0]).trim() === 'ИТОГО поступления')
    expect(rowIdx).toBeGreaterThan(0)
    expect(rows[rowIdx].slice(1, 5)).toEqual([2900000, 2450000, 3950000, 9300000])
    // ячейка января этой строки — живая формула SUM(...), а не статичное число
    const jan = ws[XLSX.utils.encode_cell({ r: rowIdx, c: 1 })] as XLSX.CellObject
    expect(String(jan.f)).toMatch(/^SUM\(/)
    // колонка ИТОГО — тоже формула
    const total = ws[XLSX.utils.encode_cell({ r: rowIdx, c: 4 })] as XLSX.CellObject
    expect(String(total.f)).toMatch(/^SUM\(/)
  })

  it('лист «Дашборд» содержит KPI поступлений', () => {
    const wb = exportWorkbook(buildFixtureSnapshot())
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets['Дашборд'], { header: 1 })
    const kpi = rows.find((r) => String(r[0]).trim() === 'Итого поступления')!
    expect(kpi[1]).toBe(9300000)
  })

  it('импорт файла без листа «Данные» — понятная ошибка', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'Лист1')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
    expect(() => importXlsx(buf)).toThrow(/Данные/)
  })
})
