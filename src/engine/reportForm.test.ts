import { describe, it, expect } from 'vitest'
import { buildReport } from './report'
import { buildEmptySnapshot, buildFixtureSnapshot } from '../data/fixtures'
import { fromMajor } from '../domain/money'
import type { DataSnapshot, Item } from '../domain/types'

function plItem(code: string, kind: Item['kind'], over: Partial<Item> = {}): Item {
  return { id: code, templateId: 'tpl-pl', code, parentCode: null, order: 0, form: 'pl', kind, name: code, ...over }
}

function plData(): DataSnapshot {
  const s = buildEmptySnapshot()
  s.items = [
    plItem('rev1', 'input', { parentCode: 'rev_total', order: 1 }),
    plItem('rev2', 'input', { parentCode: 'rev_total', order: 2 }),
    plItem('rev_total', 'calc', { order: 3, formulaDefault: 'SUM(children)' }),
    plItem('net', 'calc', { order: 4, formulaDefault: 'rev_total * 0.9' }),
  ]
  s.plPeriods = ['2025-01', '2025-02']
  s.cellValues = [
    { itemCode: 'rev1', period: '2025-01', amount: fromMajor(1000000) },
    { itemCode: 'rev2', period: '2025-01', amount: fromMajor(500000) },
    { itemCode: 'rev1', period: '2025-02', amount: fromMajor(2000000) },
  ]
  return s
}

describe('форм-ориентированный отчёт (pl)', () => {
  it('input-статьи читаются из cellValues, calc считается', () => {
    const rep = buildReport(plData(), { form: 'pl' })
    expect(rep.error).toBeUndefined()
    expect(rep.periods).toEqual(['2025-01', '2025-02'])
    const val = (code: string) => rep.rows.find((r) => r.code === code)!.values
    expect(val('rev1')).toEqual([fromMajor(1000000), fromMajor(2000000)])
    expect(val('rev2')).toEqual([fromMajor(500000), fromMajor(0)]) // нет ячейки → 0
    expect(val('rev_total')).toEqual([fromMajor(1500000), fromMajor(2000000)])
    expect(val('net')).toEqual([fromMajor(1350000), fromMajor(1800000)]) // ×0.9
  })

  it('периоды pl берутся из plPeriods ∪ ячеек', () => {
    const s = plData()
    s.plPeriods = ['2025-03'] // явная колонка без данных
    const rep = buildReport(s, { form: 'pl' })
    expect(rep.periods).toEqual(['2025-01', '2025-02', '2025-03'])
  })

  it('пустой P&L — отчёт без ошибок и без строк', () => {
    const rep = buildReport(buildEmptySnapshot(), { form: 'pl' })
    expect(rep.error).toBeUndefined()
    expect(rep.rows).toHaveLength(0)
    expect(rep.periods).toHaveLength(0)
  })

  it('ДДС (cf) не затронут: pl-статьи не попадают в отчёт ДДС', () => {
    const s = buildFixtureSnapshot()
    s.items.push(plItem('rev1', 'input'))
    const rep = buildReport(s, { form: 'cf' })
    expect(rep.rows.find((r) => r.code === 'rev1')).toBeUndefined()
    expect(rep.rows.find((r) => r.code === 'v_total_in')!.values).toEqual(
      [2900000, 2450000, 3950000].map((n) => fromMajor(n)),
    )
  })
})
