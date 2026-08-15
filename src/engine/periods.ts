// Периоды выводятся из дат операций. Ключ периода — строго YYYY-MM (год обязателен).

import type { IsoDate, PeriodKey, Operation } from '../domain/types'
import { t, type Key, type Locale } from '../i18n'

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
  if (!isValidDate(date)) throw new Error(t('error.period.date', { date }))
  return date.slice(0, 7)
}

/** Сравнение периодов (лексикографическое совпадает с хронологическим для YYYY-MM). */
export function comparePeriods(a: PeriodKey, b: PeriodKey): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Все месяцы диапазона включительно. */
export function periodsInRange(start: PeriodKey, end: PeriodKey): PeriodKey[] {
  if (!isValidPeriod(start) || !isValidPeriod(end)) {
    throw new Error(t('error.period.range', { start, end }))
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

/**
 * Человекочитаемая метка периода: «Январь 2025» или короткая «Январь».
 *
 * Самое горячее место i18n: зовётся из заголовков отчёта, дашборда, выгрузки
 * Excel и подписей контрольных сумм. Локаль — необязательный параметр, по
 * умолчанию текущая; явно её передают только селекторы reselect, чтобы язык
 * попал в ключ мемоизации (см. store/uiSlice.ts).
 */
export function formatPeriod(
  key: PeriodKey,
  opts: { withYear?: boolean; locale?: Locale } = {},
): string {
  if (!isValidPeriod(key)) return key
  const [y, m] = key.split('-').map(Number)
  const name = t(`month.${m}` as Key, undefined, opts.locale)
  return opts.withYear ? `${name} ${y}` : name
}

// Основы названий месяцев → номер месяца. ЭТО ЛОГИКА РАЗБОРА, А НЕ ПОДПИСИ:
// строки сравниваются с содержимым чужих Excel-файлов, поэтому словарём они не
// управляются и по локали не переключаются — разбирать нужно все языки сразу,
// в любой локали интерфейса.
//
// Порядок значим: длинная основа обязана стоять раньше короткого префикса,
// иначе «июль» съест «ию» от «июнь». Добавлять новые языки можно только
// дописыванием, не заменой: русские файлы должны разбираться вечно.
const MONTH_STEMS: [string, number][] = [
  ['январ', 1], ['янв', 1], ['january', 1], ['jan', 1], ['yanvar', 1], ['yan', 1],
  ['феврал', 2], ['фев', 2], ['february', 2], ['feb', 2], ['fevral', 2], ['fev', 2],
  ['март', 3], ['мар', 3], ['march', 3], ['mar', 3],
  ['апрел', 4], ['апр', 4], ['april', 4], ['apr', 4], ['aprel', 4],
  ['май', 5], ['мая', 5], ['may', 5],
  ['июнь', 6], ['июня', 6], ['июн', 6], ['june', 6], ['jun', 6], ['iyun', 6],
  ['июль', 7], ['июля', 7], ['июл', 7], ['july', 7], ['jul', 7], ['iyul', 7],
  ['август', 8], ['авг', 8], ['august', 8], ['aug', 8], ['avgust', 8], ['avg', 8],
  ['сентябр', 9], ['сент', 9], ['сен', 9], ['september', 9], ['sep', 9], ['sentabr', 9],
  ['октябр', 10], ['окт', 10], ['october', 10], ['oct', 10], ['oktabr', 10], ['okt', 10],
  ['ноябр', 11], ['ноя', 11], ['november', 11], ['nov', 11], ['noyabr', 11],
  ['декабр', 12], ['дек', 12], ['december', 12], ['dec', 12], ['dekabr', 12], ['dek', 12],
]

/**
 * Разбор метки-периода из чужого Excel в ключ YYYY-MM.
 * Понимает: "2025-01", "01.2025", "01/2025", "2025-01-31", "31.01.2025",
 * "Январь", "янв", "Январь 2025", англ. месяцы. Год берётся из метки,
 * иначе — defaultYear. Возвращает null, если период не распознан.
 */
export function parsePeriodLabel(label: string, defaultYear: number): PeriodKey | null {
  const raw = String(label).trim()
  if (raw === '') return null

  const mk = (y: number, m: number): PeriodKey | null =>
    m >= 1 && m <= 12 ? `${y}-${String(m).padStart(2, '0')}` : null

  // YYYY-MM или YYYY-MM-DD
  let m = raw.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/)
  if (m) return mk(Number(m[1]), Number(m[2]))

  // DD.MM.YYYY или DD/MM/YYYY (день отбрасываем)
  m = raw.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (m) return mk(Number(m[3]), Number(m[2]))

  // MM.YYYY или MM/YYYY
  m = raw.match(/^(\d{1,2})[./](\d{4})$/)
  if (m) return mk(Number(m[2]), Number(m[1]))

  // Название месяца (+ возможный год в строке)
  const lower = raw.toLowerCase()
  const stem = MONTH_STEMS.find(([s]) => lower.includes(s))
  if (stem) {
    const yearMatch = raw.match(/\b(19|20)\d{2}\b/)
    const year = yearMatch ? Number(yearMatch[0]) : defaultYear
    return mk(year, stem[1])
  }

  return null
}
