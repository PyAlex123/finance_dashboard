import { describe, it, expect } from 'vitest'
import { parseFormula } from './parser'
import { FormulaError, type Node } from './ast'

describe('parser формул', () => {
  it('ссылка по коду', () => {
    expect(parseFormula('v_total_in')).toEqual<Node>({ type: 'ref', code: 'v_total_in' })
  })

  it('приоритет * над +', () => {
    expect(parseFormula('a + b * c')).toEqual<Node>({
      type: 'binary',
      op: '+',
      left: { type: 'ref', code: 'a' },
      right: {
        type: 'binary',
        op: '*',
        left: { type: 'ref', code: 'b' },
        right: { type: 'ref', code: 'c' },
      },
    })
  })

  it('левая ассоциативность вычитания', () => {
    expect(parseFormula('a - b - c')).toEqual<Node>({
      type: 'binary',
      op: '-',
      left: { type: 'binary', op: '-', left: { type: 'ref', code: 'a' }, right: { type: 'ref', code: 'b' } },
      right: { type: 'ref', code: 'c' },
    })
  })

  it('скобки меняют приоритет', () => {
    const ast = parseFormula('(a + b) * c')
    expect(ast).toMatchObject({ type: 'binary', op: '*' })
  })

  it('унарный минус', () => {
    expect(parseFormula('-a')).toEqual<Node>({
      type: 'unary',
      op: '-',
      operand: { type: 'ref', code: 'a' },
    })
  })

  it('SUM(children)', () => {
    expect(parseFormula('SUM(children)')).toEqual<Node>({
      type: 'call',
      name: 'SUM',
      args: [{ type: 'children' }],
    })
  })

  it('PREV/FIRST/LAST/TOTAL по коду', () => {
    expect(parseFormula('PREV(bal_total)')).toMatchObject({ type: 'call', name: 'PREV' })
    expect(parseFormula('TOTAL(inc_sale)')).toMatchObject({ type: 'call', name: 'TOTAL' })
  })

  it('IFERROR(expr, fallback)', () => {
    const ast = parseFormula('IFERROR(a / b, 0)')
    expect(ast).toMatchObject({ type: 'call', name: 'IFERROR' })
    if (ast.type === 'call') expect(ast.args).toHaveLength(2)
  })

  it('вложенные вызовы и арифметика', () => {
    const ast = parseFormula('PREV(bal_total) + SUM(children)')
    expect(ast).toMatchObject({ type: 'binary', op: '+' })
  })

  it('число с дробной частью', () => {
    expect(parseFormula('0.04')).toEqual<Node>({ type: 'num', value: '0.04' })
  })

  it('ошибка: незакрытая скобка', () => {
    expect(() => parseFormula('(a + b')).toThrow(FormulaError)
  })

  it('ошибка: неизвестная функция', () => {
    expect(() => parseFormula('FOO(a)')).toThrow(/Неизвестная функция/)
  })

  it('ошибка: неверная арность IFERROR', () => {
    expect(() => parseFormula('IFERROR(a)')).toThrow(/ожидает/)
  })

  it('ошибка: лишний ввод', () => {
    expect(() => parseFormula('a b')).toThrow(FormulaError)
  })

  it('ошибка: пустая формула', () => {
    expect(() => parseFormula('')).toThrow(FormulaError)
  })
})
