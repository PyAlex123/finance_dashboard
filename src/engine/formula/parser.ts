// Рекурсивный спуск. Грамматика:
//   expr    := term (('+' | '-') term)*
//   term    := factor (('*' | '/') factor)*
//   factor  := ('+' | '-')? primary
//   primary := number | call | ref | 'children' | '(' expr ')'
//   call    := FUNC '(' (expr (',' expr)*)? ')'

import { tokenize, type Token } from './lexer'
import { FUNCTIONS, FormulaError, type FunctionName, type Node } from './ast'

const FUNC_SET = new Set<string>(FUNCTIONS)

class Parser {
  private pos = 0
  constructor(private tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.pos]
  }
  private next(): Token {
    return this.tokens[this.pos++]
  }
  private expect(type: Token['type']): Token {
    const t = this.peek()
    if (t.type !== type) {
      throw new FormulaError(`Ожидался «${type}», получено «${t.value || t.type}»`, t.pos)
    }
    return this.next()
  }

  parse(): Node {
    const node = this.expr()
    if (this.peek().type !== 'eof') {
      const t = this.peek()
      throw new FormulaError(`Лишний ввод после выражения: «${t.value}»`, t.pos)
    }
    return node
  }

  private expr(): Node {
    let left = this.term()
    while (this.peek().type === 'plus' || this.peek().type === 'minus') {
      const op = this.next().type === 'plus' ? '+' : '-'
      const right = this.term()
      left = { type: 'binary', op, left, right }
    }
    return left
  }

  private term(): Node {
    let left = this.factor()
    while (this.peek().type === 'star' || this.peek().type === 'slash') {
      const op = this.next().type === 'star' ? '*' : '/'
      const right = this.factor()
      left = { type: 'binary', op, left, right }
    }
    return left
  }

  private factor(): Node {
    const t = this.peek()
    if (t.type === 'plus' || t.type === 'minus') {
      this.next()
      const operand = this.factor()
      return { type: 'unary', op: t.type === 'plus' ? '+' : '-', operand }
    }
    return this.primary()
  }

  private primary(): Node {
    const t = this.peek()
    switch (t.type) {
      case 'number':
        this.next()
        return { type: 'num', value: t.value }
      case 'lparen': {
        this.next()
        const inner = this.expr()
        this.expect('rparen')
        return inner
      }
      case 'ident': {
        this.next()
        // функция?
        if (this.peek().type === 'lparen') {
          if (!FUNC_SET.has(t.value)) {
            throw new FormulaError(`Неизвестная функция «${t.value}»`, t.pos)
          }
          return this.callArgs(t.value as FunctionName, t.pos)
        }
        if (t.value === 'children') return { type: 'children' }
        // ссылка по коду статьи
        return { type: 'ref', code: t.value }
      }
      default:
        throw new FormulaError(`Неожиданный токен «${t.value || t.type}»`, t.pos)
    }
  }

  private callArgs(name: FunctionName, pos: number): Node {
    this.expect('lparen')
    const args: Node[] = []
    if (this.peek().type !== 'rparen') {
      args.push(this.expr())
      while (this.peek().type === 'comma') {
        this.next()
        args.push(this.expr())
      }
    }
    this.expect('rparen')
    validateArity(name, args, pos)
    return { type: 'call', name, args }
  }
}

function validateArity(name: FunctionName, args: Node[], pos: number): void {
  const arity: Record<FunctionName, number | [number, number]> = {
    SUM: [1, 64],
    PREV: 1,
    FIRST: 1,
    LAST: 1,
    TOTAL: 1,
    IFERROR: 2,
  }
  const spec = arity[name]
  const ok = Array.isArray(spec)
    ? args.length >= spec[0] && args.length <= spec[1]
    : args.length === spec
  if (!ok) {
    const want = Array.isArray(spec) ? `${spec[0]}–${spec[1]}` : String(spec)
    throw new FormulaError(`Функция ${name} ожидает ${want} аргумент(ов), получено ${args.length}`, pos)
  }
}

/** Разобрать формулу в AST. Бросает FormulaError с позицией. */
export function parseFormula(input: string): Node {
  return new Parser(tokenize(input)).parse()
}
