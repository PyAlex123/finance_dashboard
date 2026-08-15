// Русский словарь — эталон. Набор его ключей задаёт тип Dict, поэтому английский
// словарь не соберётся, пока в нём не окажется каждого ключа (см. dict/en/index.ts).
//
// Ключи плоские, с точками: 'app.tab.journal'. Пространства имён — это ФАЙЛЫ,
// а не вложенность объектов: рекурсивные template-literal типы для путей заметно
// замедляют tsc -b и дают нечитаемые сообщения об ошибках.

import { common } from './common'
import { app } from './app'
import { workspace } from './workspace'
import { landing } from './landing'
import { legal } from './legal'
import { months } from './months'
import { engine } from './engine'
import { journal } from './journal'
import { seed } from './seed'

export const ru = {
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

export type Key = keyof typeof ru

/** Ключи-варианты множественного числа: '<основа>.plural.<форма>'. */
type PluralFormKey = Extract<Key, `${string}.plural.${string}`>

/**
 * Форма словаря: те же ключи, значения — обычные строки.
 *
 * Именно Record<Key, string>, а не typeof ru: иначе `as const` в файлах-
 * пространствах потребовал бы от английского словаря дословно русских значений.
 *
 * Формы множественного числа — единственное исключение, они необязательны:
 * их набор у каждого языка свой (у русского one/few/many/other, у английского
 * только one/other), и требовать от английского «два отчёта» бессмысленно.
 * Полноту форм ПО КАЖДОМУ ЯЗЫКУ проверяет src/i18n/parity.test.ts, сверяясь с
 * Intl.PluralRules, — это та проверка, которую типы выразить не могут.
 */
export type Dict = Record<Exclude<Key, PluralFormKey>, string> &
  Partial<Record<PluralFormKey, string>>
