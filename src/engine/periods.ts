// Периоды выводятся из дат операций. Ключ периода — строго YYYY-MM (год обязателен).

import type { IsoDate, PeriodKey, Operation } from '../domain/types'

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

export function isValidPeriod(key: string): key is PeriodKey {
  return PERIOD_RE.test(key)
}

export function isValidDate(date: string): date is IsoDate {
  return DATE_RE.test(date)
}

/** Период (YYYY-MM) даты операции. Бросает, если год/дата некорректны. */
export function periodOf(date: IsoDate): PeriodKey {
  if (!isValidDate(date)) throw new Error(`Некорректная дата операции: "${date}"`)
  return date.slice(0, 7)
}

/** Сравнение периодов (лексикографическое совпадает с хронологическим для YYYY-MM). */
export function comparePeriods(a: PeriodKey, b: PeriodKey): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Все месяцы диапазона включительно. */
export function periodsInRange(start: PeriodKey, end: PeriodKey): PeriodKey[] {
  if (!isValidPeriod(start) || !isValidPeriod(end)) {
    throw new Error(`Некорректный диапазон периодов: ${start}..${end}`)
  }
  const out: PeriodKey[] = []
  let [y, m] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

/** Упорядоченные уникальные периоды из дат журнала. */
export function derivePeriods(operations: Operation[]): PeriodKey[] {
  const set = new Set<PeriodKey>()
  for (const op of operations) set.add(periodOf(op.date))
  return [...set].sort(comparePeriods)
}

const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

/** Человекочитаемая метка периода: "Январь 2025" или короткая "Январь". */
export function formatPeriod(key: PeriodKey, opts: { withYear?: boolean } = {}): string {
  if (!isValidPeriod(key)) return key
  const [y, m] = key.split('-').map(Number)
  const name = MONTHS_RU[m - 1]
  return opts.withYear ? `${name} ${y}` : name
}
