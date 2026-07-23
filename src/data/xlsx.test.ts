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

  it('книга содержит листы Отчёт, Журнал и скрытый Данные', () => {
    const wb = exportWorkbook(buildFixtureSnapshot())
    expect(wb.SheetNames).toContain('Отчёт')
    expect(wb.SheetNames).toContain('Журнал')
    expect(wb.SheetNames).toContain('Данные')
    const idx = wb.SheetNames.indexOf('Данные')
    expect(wb.Workbook?.Sheets?.[idx]?.Hidden).toBe(1)
  })

  it('лист «Отчёт» содержит суммы в сумах, совпадающие с Excel', () => {
    const wb = exportWorkbook(buildFixtureSnapshot())
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets['Отчёт'], { header: 1 })
    // найдём строку общего прихода
    const totalIn = rows.find((r) => String(r[0]).trim() === 'Общий приход')!
    expect(totalIn.slice(1, 5)).toEqual([2900000, 2450000, 3950000, 9300000])
  })

  it('импорт файла без листа «Данные» — понятная ошибка', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'Лист1')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
    expect(() => importXlsx(buf)).toThrow(/Данные/)
  })
})
