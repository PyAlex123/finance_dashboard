// AST языка формул. Ссылки — по коду статьи (не по координатам).

export type FunctionName = 'SUM' | 'PREV' | 'FIRST' | 'LAST' | 'TOTAL' | 'IFERROR'

export const FUNCTIONS: readonly FunctionName[] = ['SUM', 'PREV', 'FIRST', 'LAST', 'TOTAL', 'IFERROR']

export type Node =
  | { type: 'num'; value: string }
  | { type: 'ref'; code: string }
  | { type: 'children' }
  | { type: 'unary'; op: '+' | '-'; operand: Node }
  | { type: 'binary'; op: '+' | '-' | '*' | '/'; left: Node; right: Node }
  | { type: 'call'; name: FunctionName; args: Node[] }

export class FormulaError extends Error {
  constructor(message: string, public position?: number) {
    super(message)
    this.name = 'FormulaError'
  }
}
