import { describe, it, expect } from 'vitest'
import { buildFixtureSnapshot } from '../data/fixtures'
import { buildAutoCfItems } from './autoCf'
import { buildReport, rowTotal } from './report'
import { buildAggContext, aggValue } from './aggregate'
import type { DataSnapshot } from '../domain/types'

/** Собрать отчёт по авто-статьям (как это делает селектор). */
function autoReport(data: DataSnapshot) {
  const items = [...data.items.filter((i) => i.form !== 'cf'), ...buildAutoCfItems(data)]
  return buildReport({ ...data, items }, { form: 'cf' })
}

describe('автоматический отчёт ДДС', () => {
  it('строит разделы из категорий и счетов', () => {
    const data = buildFixtureSnapshot()
    const items = buildAutoCfItems(data)
    const byCode = new Map(items.map((i) => [i.code, i]))
    // разделы
    expect(byCode.get('auto_s_in')?.kind).toBe('header')
    expect(byCode.get('auto_s_out')?.kind).toBe('header')
    expect(byCode.get('auto_s_bal')?.kind).toBe('header')
    // по строке на доходную/расходную категорию и на счёт
    expect(byCode.has('auto_in_sale')).toBe(true)
    expect(byCode.has('auto_out_rent')).toBe(true)
    expect(byCode.has('auto_bal_cash_uzs')).toBe(true)
    // итоги — формулы
    expect(byCode.get('auto_in_total')?.kind).toBe('calc')
    expect(byCode.get('auto_net')?.formulaDefault).toBe('auto_in_total - auto_out_total')
  })

  it('ИТОГО поступления/списания сходятся с агрегатами журнала', () => {
    const data = buildFixtureSnapshot()
    const rep = autoReport(data)
    const ctx = buildAggContext(data)

    const inRow = rep.rows.find((r) => r.code === 'auto_in_total')!
    const outRow = rep.rows.find((r) => r.code === 'auto_out_total')!

    const totalIn = rep.periods.reduce((s, p) => s + aggValue(ctx, { measure: 'in' }, p), 0n)
    const totalOut = rep.periods.reduce((s, p) => s + aggValue(ctx, { measure: 'out' }, p), 0n)

    // «Без категории» тоже входит в SUM(children) — поэтому суммы точные
    expect(rowTotal(inRow)).toBe(totalIn)
    expect(rowTotal(outRow)).toBe(totalOut)
  })

  it('«Без категории» ловит операции без категории', () => {
    const data = buildFixtureSnapshot()
    // сделаем одну приходную операцию без категории
    const inc = data.operations.find((o) => o.type === 'income')!
    inc.categoryId = null

    const rep = autoReport(data)
    const noneRow = rep.rows.find((r) => r.code === 'auto_in_none')!
    expect(rowTotal(noneRow)! > 0n).toBe(true)
  })
})
