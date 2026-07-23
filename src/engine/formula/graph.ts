// Граф зависимостей статей по кодам. Топологическая сортировка + детект циклов.
// PREV(code) — «мягкая» ссылка на предыдущий период: НЕ создаёт ребро в графе,
// поэтому цепочки остатков (bal = PREV(bal) + ...) не считаются циклом.
// ref / FIRST / LAST / TOTAL / SUM(children) — «жёсткие»: код должен быть посчитан раньше.

import { FormulaError, type Node } from './ast'
import type { Item } from '../../domain/types'
import { parseFormula } from './parser'

export interface Deps {
  /** Коды, которые должны быть вычислены до этой статьи. */
  hard: Set<string>
  /** Ссылки на предыдущий период (не влияют на порядок). */
  soft: Set<string>
  /** Формула использует SUM(children) и т.п. — зависит от дочерних статей. */
  usesChildren: boolean
}

export class CycleError extends FormulaError {
  constructor(public cycle: string[]) {
    super(`Циклическая зависимость статей: ${cycle.join(' → ')}`)
    this.name = 'CycleError'
  }
}

/** Извлечь зависимости из AST. soft=true — внутри PREV(...). */
export function extractDeps(node: Node): Deps {
  const hard = new Set<string>()
  const soft = new Set<string>()
  let usesChildren = false

  const walk = (n: Node, inPrev: boolean): void => {
    switch (n.type) {
      case 'num':
        return
      case 'ref':
        ;(inPrev ? soft : hard).add(n.code)
        return
      case 'children':
        usesChildren = true
        return
      case 'unary':
        walk(n.operand, inPrev)
        return
      case 'binary':
        walk(n.left, inPrev)
        walk(n.right, inPrev)
        return
      case 'call':
        if (n.name === 'PREV') {
          for (const a of n.args) walk(a, true)
        } else {
          for (const a of n.args) walk(a, inPrev)
        }
        return
    }
  }

  walk(node, false)
  return { hard, soft, usesChildren }
}

/** Карта: код родителя → коды дочерних статей (для SUM(children)). */
export function childrenByParent(items: Item[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const it of items) {
    if (it.parentCode) {
      const arr = map.get(it.parentCode) ?? []
      arr.push(it.code)
      map.set(it.parentCode, arr)
    }
  }
  return map
}

/** Действующая формула статьи: override поверх шаблонной. */
export function resolveFormula(
  item: Item,
  overrideByCode: Map<string, string>,
): string | null {
  const ov = overrideByCode.get(item.code)
  if (ov !== undefined) return ov
  return item.formulaDefault ?? null
}

export interface CalcPlan {
  /** Порядок вычисления кодов calc-статей (топологический). */
  order: string[]
  astByCode: Map<string, Node>
  childrenByCode: Map<string, string[]>
}

/**
 * Построить план вычисления: разобрать формулы calc-статей, вывести жёсткие
 * зависимости (включая дочерние коды для SUM(children)), топологически отсортировать.
 * Бросает CycleError при цикле, FormulaError при синтаксической ошибке формулы.
 */
export function buildCalcPlan(items: Item[], overrides: { itemCode: string; formula: string }[]): CalcPlan {
  const overrideByCode = new Map(overrides.map((o) => [o.itemCode, o.formula]))
  const childrenByCode = childrenByParent(items)
  const astByCode = new Map<string, Node>()
  const hardDeps = new Map<string, Set<string>>()

  for (const it of items) {
    if (it.kind !== 'calc') continue
    const formula = resolveFormula(it, overrideByCode)
    if (!formula) throw new FormulaError(`У calc-статьи «${it.code}» нет формулы`)
    let ast: Node
    try {
      ast = parseFormula(formula)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      throw new FormulaError(`Ошибка в формуле статьи «${it.code}»: ${msg}`)
    }
    astByCode.set(it.code, ast)
    const deps = extractDeps(ast)
    const all = new Set(deps.hard)
    if (deps.usesChildren) {
      for (const c of childrenByCode.get(it.code) ?? []) all.add(c)
    }
    hardDeps.set(it.code, all)
  }

  const order = topoSort(hardDeps)
  return { order, astByCode, childrenByCode }
}

/**
 * Топологическая сортировка только по calc-узлам (ключи hardDeps).
 * Зависимости на не-calc статьи (agg/input) — листья, в порядок не входят.
 * DFS с тремя цветами; при обнаружении серого узла — цикл.
 */
function topoSort(hardDeps: Map<string, Set<string>>): string[] {
  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map<string, number>()
  for (const k of hardDeps.keys()) color.set(k, WHITE)
  const order: string[] = []
  const stack: string[] = []

  const visit = (code: string): void => {
    color.set(code, GRAY)
    stack.push(code)
    for (const dep of hardDeps.get(code) ?? []) {
      if (!hardDeps.has(dep)) continue // зависимость на agg/input — лист
      const c = color.get(dep)
      if (c === GRAY) {
        const from = stack.indexOf(dep)
        throw new CycleError([...stack.slice(from), dep])
      }
      if (c === WHITE) visit(dep)
    }
    stack.pop()
    color.set(code, BLACK)
    order.push(code)
  }

  for (const code of hardDeps.keys()) {
    if (color.get(code) === WHITE) visit(code)
  }
  return order
}
