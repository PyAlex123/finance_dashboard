import { describe, it, expect } from 'vitest'
import { extractDeps, buildCalcPlan, CycleError } from './graph'
import { parseFormula } from './parser'
import type { Item } from '../../domain/types'
import { DDS_ITEMS } from '../../data/ddsTemplate'

function calc(code: string, formula: string, parentCode: string | null = null): Item {
  return { id: code, templateId: 't', code, parentCode, order: 0, form: 'cf', kind: 'calc', name: code, formulaDefault: formula }
}
function agg(code: string, parentCode: string | null = null): Item {
  return { id: code, templateId: 't', code, parentCode, order: 0, form: 'cf', kind: 'agg', name: code, aggRule: { measure: 'in' } }
}

describe('extractDeps', () => {
  it('ref — жёсткая зависимость', () => {
    const d = extractDeps(parseFormula('a + b'))
    expect([...d.hard].sort()).toEqual(['a', 'b'])
    expect(d.soft.size).toBe(0)
  })

  it('PREV — мягкая, не в жёстких', () => {
    const d = extractDeps(parseFormula('PREV(bal) + x'))
    expect([...d.hard]).toEqual(['x'])
    expect([...d.soft]).toEqual(['bal'])
  })

  it('SUM(children) — флаг children', () => {
    const d = extractDeps(parseFormula('SUM(children)'))
    expect(d.usesChildren).toBe(true)
    expect(d.hard.size).toBe(0)
  })

  it('TOTAL/FIRST/LAST — жёсткие', () => {
    expect([...extractDeps(parseFormula('TOTAL(inc)')).hard]).toEqual(['inc'])
    expect([...extractDeps(parseFormula('LAST(bal)')).hard]).toEqual(['bal'])
  })
})

describe('buildCalcPlan', () => {
  it('линейный порядок: зависимость раньше зависимого', () => {
    const items = [agg('a'), agg('b'), calc('t', 'a + b'), calc('r', 't - a')]
    const plan = buildCalcPlan(items, [])
    expect(plan.order.indexOf('t')).toBeLessThan(plan.order.indexOf('r'))
  })

  it('SUM(children) зависит от дочерних', () => {
    const items = [agg('c1', 'total'), agg('c2', 'total'), calc('total', 'SUM(children)')]
    const plan = buildCalcPlan(items, [])
    expect(plan.childrenByCode.get('total')).toEqual(['c1', 'c2'])
    expect(plan.order).toContain('total')
  })

  it('PREV на самого себя — НЕ цикл', () => {
    const items = [agg('flow'), calc('bal', 'PREV(bal) + flow')]
    expect(() => buildCalcPlan(items, [])).not.toThrow()
  })

  it('прямой цикл a→b→a — CycleError с путём', () => {
    const items = [calc('a', 'b'), calc('b', 'a')]
    try {
      buildCalcPlan(items, [])
      expect.unreachable('ожидался CycleError')
    } catch (e) {
      expect(e).toBeInstanceOf(CycleError)
      expect((e as CycleError).cycle[0]).toBe((e as CycleError).cycle.at(-1))
    }
  })

  it('самоцикл a→a — CycleError', () => {
    expect(() => buildCalcPlan([calc('a', 'a + 1')], [])).toThrow(CycleError)
  })

  it('override меняет зависимости', () => {
    const items = [agg('x'), agg('y'), calc('r', 'x')]
    const plan = buildCalcPlan(items, [{ itemCode: 'r', formula: 'y' }])
    // теперь r зависит от y (override), формула разобрана без ошибок
    expect(plan.astByCode.get('r')).toEqual({ type: 'ref', code: 'y' })
  })

  it('реальный шаблон ДДС строится без циклов', () => {
    const plan = buildCalcPlan(DDS_ITEMS, [])
    // все calc-статьи в порядке
    for (const code of ['v_result', 'inc_total', 'exp_total', 'bal_total']) {
      expect(plan.order).toContain(code)
    }
    // дети v_result (нет) vs inc_total (есть)
    expect(plan.childrenByCode.get('inc_total')).toEqual(['inc_sale', 'inc_consult', 'inc_other'])
  })
})
