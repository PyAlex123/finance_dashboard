import { describe, it, expect } from 'vitest'
import { buildReport, rowTotal } from './report'
import { buildFixtureSnapshot } from '../data/fixtures'
import { fromMajor } from '../domain/money'
import type { DataSnapshot } from '../domain/types'

const maj = (arr: number[]) => arr.map((n) => fromMajor(n))

function report() {
  return buildReport(buildFixtureSnapshot())
}
function row(code: string) {
  const r = report().rows.find((x) => x.code === code)
  if (!r) throw new Error(`нет строки ${code}`)
  return r.values
}

describe('отчёт ДДС — совпадение с учебным Excel по строкам и периодам', () => {
  it('нет ошибки расчёта, периоды янв–март', () => {
    const rep = report()
    expect(rep.error).toBeUndefined()
    expect(rep.periods).toEqual(['2025-01', '2025-02', '2025-03'])
  })

  it('итоги за период', () => {
    expect(row('v_total_in')).toEqual(maj([2900000, 2450000, 3950000]))
    expect(row('v_total_out')).toEqual(maj([3050000, 3239000, 4688000]))
    expect(row('v_result')).toEqual(maj([-150000, -789000, -738000]))
  })

  it('доходы по категориям + итог', () => {
    expect(row('inc_sale')).toEqual(maj([2600000, 1950000, 2600000]))
    expect(row('inc_consult')).toEqual(maj([300000, 500000, 1200000]))
    expect(row('inc_other')).toEqual(maj([0, 0, 150000]))
    expect(row('inc_total')).toEqual(maj([2900000, 2450000, 3950000]))
  })

  it('расходы по категориям + итог', () => {
    expect(row('exp_salary')).toEqual(maj([950000, 950000, 1150000]))
    expect(row('exp_rent')).toEqual(maj([1500000, 1500000, 1500000]))
    expect(row('exp_marketing')).toEqual(maj([320000, 480000, 650000]))
    expect(row('exp_office')).toEqual(maj([85000, 75000, 1120000]))
    expect(row('exp_tax')).toEqual(maj([195000, 234000, 268000]))
    expect(row('exp_total')).toEqual(maj([3050000, 3239000, 4688000]))
  })

  it('остатки по счетам + итог (SUM children)', () => {
    expect(row('bal_cash')).toEqual(maj([665000, 2565000, 1445000]))
    expect(row('bal_card_uzs')).toEqual(maj([1230000, 225000, 525000]))
    expect(row('bal_card_usd')).toEqual(maj([2212500, 962500, 1612500]))
    expect(row('bal_settle')).toEqual(maj([1005000, 571000, 3000]))
    expect(row('bal_total')).toEqual(maj([5112500, 4323500, 3585500]))
  })

  it('колонка ИТОГО: потоки — сумма, остатки — последний период', () => {
    const rep = report()
    const total = (code: string) => rowTotal(rep.rows.find((r) => r.code === code)!)
    expect(total('v_total_in')).toBe(fromMajor(9300000)) // сумма
    expect(total('exp_total')).toBe(fromMajor(10977000)) // сумма
    expect(total('v_result')).toBe(fromMajor(-1677000)) // сумма
    expect(total('bal_total')).toBe(fromMajor(3585500)) // последний период
    expect(total('bal_cash')).toBe(fromMajor(1445000)) // остаток → последний
    expect(rowTotal(rep.rows.find((r) => r.code === 's_totals')!)).toBeNull() // header
  })

  it('строки-заголовки без значений; глубина отступов', () => {
    const rep = report()
    const header = rep.rows.find((r) => r.code === 's_totals')!
    expect(header.kind).toBe('header')
    expect(header.values).toEqual([])
    expect(rep.rows.find((r) => r.code === 'inc_sale')!.depth).toBe(2)
    expect(rep.rows.find((r) => r.code === 'v_total_in')!.depth).toBe(1)
  })
})

describe('движок формул — PREV, override, циклы', () => {
  it('PREV разворачивает цепочку остатков', () => {
    // добавим calc-строку с PREV поверх фикстуры
    const data: DataSnapshot = buildFixtureSnapshot()
    data.items.push({
      id: 'it-chain', templateId: 'tpl-dds', code: 'chain', parentCode: null, order: 99,
      form: 'cf', kind: 'calc', name: 'Цепочка', formulaDefault: 'PREV(chain) + v_result',
    })
    const rep = buildReport(data)
    expect(rep.error).toBeUndefined()
    const chain = rep.rows.find((r) => r.code === 'chain')!.values
    // -150000, -150000-789000=-939000, -939000-738000=-1677000
    expect(chain).toEqual(maj([-150000, -939000, -1677000]))
  })

  it('override заменяет формулу и помечает строку', () => {
    const data = buildFixtureSnapshot()
    data.overrides.push({ id: 'o1', itemCode: 'v_result', formula: 'v_total_in' })
    const rep = buildReport(data)
    expect(rep.rows.find((r) => r.code === 'v_result')!.values).toEqual(maj([2900000, 2450000, 3950000]))
    expect(rep.rows.find((r) => r.code === 'v_result')!.isOverridden).toBe(true)
  })

  it('цикл через override — понятная ошибка, без падения', () => {
    const data = buildFixtureSnapshot()
    data.overrides.push({ id: 'o1', itemCode: 'v_result', formula: 'inc_total' })
    data.overrides.push({ id: 'o2', itemCode: 'inc_total', formula: 'v_result' })
    const rep = buildReport(data)
    expect(rep.error).toMatch(/Циклическая зависимость/)
  })

  it('TOTAL по всем периодам', () => {
    const data = buildFixtureSnapshot()
    data.items.push({
      id: 'it-t', templateId: 'tpl-dds', code: 'total_in_all', parentCode: null, order: 98,
      form: 'cf', kind: 'calc', name: 'Всего приход', formulaDefault: 'TOTAL(v_total_in)',
    })
    const rep = buildReport(data)
    expect(rep.rows.find((r) => r.code === 'total_in_all')!.values).toEqual(maj([9300000, 9300000, 9300000]))
  })
})
