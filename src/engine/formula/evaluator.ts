// Вычислитель AST. Значение — деньги (bigint минорные) или скаляр (рациональное).
// Деньги: ref и функции. Скаляр: числовые литералы. Деньги ± деньги; деньги × скаляр;
// деньги / скаляр; деньги / деньги → скаляр. Всё точно, без float.

import { FormulaError, type Node } from './ast'
import type { Money } from '../../domain/money'
import type { PeriodKey } from '../../domain/types'

type Value =
  | { kind: 'money'; v: Money }
  | { kind: 'scalar'; num: bigint; den: bigint }

export interface EvalCtx {
  periods: PeriodKey[]
  periodIndex: number
  /** Уже вычисленные значения статей по периодам. */
  resolved: Map<string, Money[]>
  /** Код текущей статьи (для SUM(children)). */
  currentCode: string
  /** Код родителя → коды детей. */
  childrenByCode: Map<string, string[]>
}

const money = (v: Money): Value => ({ kind: 'money', v })
const scalar = (num: bigint, den: bigint): Value => {
  if (den < 0n) return { kind: 'scalar', num: -num, den: -den }
  return { kind: 'scalar', num, den }
}

/** Округление деления к ближайшему целому (половина от нуля). den > 0. */
function roundDiv(a: bigint, b: bigint): bigint {
  const neg = a < 0n !== b < 0n
  const aa = a < 0n ? -a : a
  const bb = b < 0n ? -b : b
  const q = aa / bb
  const r = aa % bb
  const rounded = r * 2n >= bb ? q + 1n : q
  return neg ? -rounded : rounded
}

function parseNumber(text: string): Value {
  const [intPart, frac = ''] = text.split('.')
  const den = 10n ** BigInt(frac.length)
  const num = BigInt(intPart + frac)
  return scalar(num, den)
}

function asMoney(val: Value): Money {
  if (val.kind === 'money') return val.v
  // целочисленный скаляр → деньги как минорные единицы (редкий случай)
  if (val.den === 1n) return val.num
  throw new FormulaError('Ожидалась денежная величина, получен дробный скаляр')
}

export function evaluate(node: Node, ctx: EvalCtx): Value {
  switch (node.type) {
    case 'num':
      return parseNumber(node.value)

    case 'ref': {
      const arr = ctx.resolved.get(node.code)
      if (!arr) throw new FormulaError(`Неизвестная ссылка на статью «${node.code}»`)
      return money(arr[ctx.periodIndex] ?? 0n)
    }

    case 'children': {
      // отдельно узел children не вычисляется (только внутри SUM)
      throw new FormulaError('«children» допустимо только как аргумент SUM')
    }

    case 'unary': {
      const v = evaluate(node.operand, ctx)
      if (node.op === '+') return v
      return v.kind === 'money' ? money(-v.v) : scalar(-v.num, v.den)
    }

    case 'binary':
      return evalBinary(node.op, evaluate(node.left, ctx), evaluate(node.right, ctx))

    case 'call':
      return evalCall(node, ctx)
  }
}

function evalBinary(op: '+' | '-' | '*' | '/', a: Value, b: Value): Value {
  if (op === '+' || op === '-') {
    if (a.kind === 'money' && b.kind === 'money') {
      return money(op === '+' ? a.v + b.v : a.v - b.v)
    }
    if (a.kind === 'scalar' && b.kind === 'scalar') {
      const num = op === '+' ? a.num * b.den + b.num * a.den : a.num * b.den - b.num * a.den
      return scalar(num, a.den * b.den)
    }
    throw new FormulaError('Нельзя складывать деньги и скаляр')
  }
  if (op === '*') {
    if (a.kind === 'money' && b.kind === 'scalar') return money(roundDiv(a.v * b.num, b.den))
    if (a.kind === 'scalar' && b.kind === 'money') return money(roundDiv(b.v * a.num, a.den))
    if (a.kind === 'scalar' && b.kind === 'scalar') return scalar(a.num * b.num, a.den * b.den)
    throw new FormulaError('Нельзя перемножать две денежные величины')
  }
  // '/'
  if (a.kind === 'money' && b.kind === 'scalar') {
    if (b.num === 0n) throw new FormulaError('Деление на ноль')
    return money(roundDiv(a.v * b.den, b.num))
  }
  if (a.kind === 'money' && b.kind === 'money') {
    if (b.v === 0n) throw new FormulaError('Деление на ноль')
    return scalar(a.v, b.v) // отношение денег → скаляр
  }
  if (a.kind === 'scalar' && b.kind === 'scalar') {
    if (b.num === 0n) throw new FormulaError('Деление на ноль')
    return scalar(a.num * b.den, a.den * b.num)
  }
  throw new FormulaError('Некорректное деление скаляра на деньги')
}

function evalCall(node: Extract<Node, { type: 'call' }>, ctx: EvalCtx): Value {
  switch (node.name) {
    case 'SUM': {
      // SUM(children) или SUM(a, b, ...)
      if (node.args.length === 1 && node.args[0].type === 'children') {
        let total = 0n
        for (const child of ctx.childrenByCode.get(ctx.currentCode) ?? []) {
          const arr = ctx.resolved.get(child)
          if (arr) total += arr[ctx.periodIndex] ?? 0n
        }
        return money(total)
      }
      let total = 0n
      for (const a of node.args) total += asMoney(evaluate(a, ctx))
      return money(total)
    }

    case 'PREV': {
      const i = ctx.periodIndex - 1
      if (i < 0) return money(0n)
      return money(asMoney(evaluate(node.args[0], { ...ctx, periodIndex: i })))
    }

    case 'FIRST':
      return money(asMoney(evaluate(node.args[0], { ...ctx, periodIndex: 0 })))

    case 'LAST':
      return money(asMoney(evaluate(node.args[0], { ...ctx, periodIndex: ctx.periods.length - 1 })))

    case 'TOTAL': {
      let total = 0n
      for (let i = 0; i < ctx.periods.length; i++) {
        total += asMoney(evaluate(node.args[0], { ...ctx, periodIndex: i }))
      }
      return money(total)
    }

    case 'IFERROR': {
      try {
        return evaluate(node.args[0], ctx)
      } catch {
        return evaluate(node.args[1], ctx)
      }
    }
  }
}

/** Вычислить формулу как деньги для одного периода. */
export function evaluateMoney(node: Node, ctx: EvalCtx): Money {
  return asMoney(evaluate(node, ctx))
}
