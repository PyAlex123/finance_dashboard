import { FormulaError } from './ast'

export type TokenType =
  | 'number'
  | 'ident'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'plus'
  | 'minus'
  | 'star'
  | 'slash'
  | 'eof'

export interface Token {
  type: TokenType
  value: string
  pos: number
}

const SINGLE: Record<string, TokenType> = {
  '(': 'lparen',
  ')': 'rparen',
  ',': 'comma',
  '+': 'plus',
  '-': 'minus',
  '*': 'star',
  '/': 'slash',
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const n = input.length
  while (i < n) {
    const ch = input[i]
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++
      continue
    }
    if (ch in SINGLE) {
      tokens.push({ type: SINGLE[ch], value: ch, pos: i })
      i++
      continue
    }
    if (ch >= '0' && ch <= '9') {
      let j = i + 1
      let seenDot = false
      while (j < n && ((input[j] >= '0' && input[j] <= '9') || (input[j] === '.' && !seenDot))) {
        if (input[j] === '.') seenDot = true
        j++
      }
      tokens.push({ type: 'number', value: input.slice(i, j), pos: i })
      i = j
      continue
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1
      while (j < n && /[A-Za-z0-9_]/.test(input[j])) j++
      tokens.push({ type: 'ident', value: input.slice(i, j), pos: i })
      i = j
      continue
    }
    throw new FormulaError(`Неожиданный символ «${ch}»`, i)
  }
  tokens.push({ type: 'eof', value: '', pos: n })
  return tokens
}
