// Английский словарь. Аннотация `: Dict` намеренно исчерпывающая — за полноту
// перевода отвечает компилятор, а не ревьюер: пропущенный ключ роняет `tsc -b`.
// Лишние ключи проверка типов пропускает (spread не участвует в excess property
// check) — их ловит src/i18n/parity.test.ts.

import type { Dict } from '../ru'
import { common } from './common'
import { app } from './app'
import { workspace } from './workspace'
import { landing } from './landing'
import { legal } from './legal'
import { months } from './months'
import { engine } from './engine'
import { journal } from './journal'
import { seed } from './seed'

export const en: Dict = {
  ...common,
  ...app,
  ...workspace,
  ...landing,
  ...legal,
  ...months,
  ...engine,
  ...journal,
  ...seed,
}
