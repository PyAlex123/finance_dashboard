// Узбекский словарь (латиница). Тип Partial<Dict> намеренно: словарь наполняется
// постепенно, и недостающий ключ не должен ронять сборку — он молча берётся из
// русского эталона (см. фолбэк в src/i18n/index.ts). Полнота отслеживается
// метрикой покрытия в src/i18n/parity.test.ts.

import type { Dict } from '../ru'
import { common } from './common'
import { app } from './app'
import { months } from './months'
import { journal } from './journal'

export const uz: Partial<Dict> = {
  ...common,
  ...app,
  ...months,
  ...journal,
}
