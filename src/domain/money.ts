// Деньги — целые минорные единицы (тийины) в BigInt. Никаких float. Никогда.
// 1 сум = 100 тийин. Хранение — bigint минорных единиц; ввод/вывод — в сумах.

export type Money = bigint

export const MINOR_PER_MAJOR = 100n

/** Сумы (мажорные) → минорные единицы. Принимает число, строку или bigint. */
export function fromMajor(major: number | string | bigint): Money {
  if (typeof major === 'bigint') return major * MINOR_PER_MAJOR
  if (typeof major === 'number') {
    if (!Number.isFinite(major)) throw new Error(`Некорректная сумма: ${major}`)
    // округление до целых тийинов без накопления float-погрешности
    return BigInt(Math.round(major * 100))
  }
  return parseMoney(major)
}

/** Разбор строки суммы из UI: "1 200 000", "1200000,50", "-85 000". */
export function parseMoney(input: string): Money {
  const s = input.trim().replace(/\s/g, '').replace(',', '.')
  if (s === '' || s === '-' || s === '—') return 0n
  const neg = s.startsWith('-')
  const body = neg ? s.slice(1) : s
  const [intPart, fracRaw = ''] = body.split('.')
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(fracRaw)) {
    throw new Error(`Некорректная сумма: "${input}"`)
  }
  const frac = (fracRaw + '00').slice(0, 2)
  const minor = BigInt(intPart || '0') * MINOR_PER_MAJOR + BigInt(frac || '0')
  return neg ? -minor : minor
}

/** Минорные единицы → число сумов (для процентов/графиков, НЕ для хранения). */
export function toMajorNumber(m: Money): number {
  return Number(m) / Number(MINOR_PER_MAJOR)
}

/**
 * Форматирование СТРОКИ ввода суммы «на лету»: целую часть группируем пробелом по
 * 3 разряда — «650000» → «650 000». Дробную часть (после «,» или «.») сохраняем,
 * лишние символы отбрасываем. Результат по-прежнему разбирается parseMoney (он
 * игнорирует пробелы), так что сохранение не ломается. Пустой ввод → "".
 */
export function groupThousands(raw: string): string {
  const cleaned = raw.replace(/[^\d.,-]/g, '')
  const neg = cleaned.startsWith('-')
  const body = neg ? cleaned.slice(1) : cleaned
  const sepMatch = body.match(/[.,]/)
  const sep = sepMatch ? sepMatch[0] : ''
  const [intRaw = '', fracRaw = ''] = sep ? body.split(sep) : [body, '']
  const intDigits = intRaw.replace(/\D/g, '')
  const fracDigits = fracRaw.replace(/\D/g, '').slice(0, 2)
  const intGrouped = intDigits.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const out = sep ? `${intGrouped || '0'}${sep}${fracDigits}` : intGrouped
  return (neg ? '-' : '') + out
}

/** Форматирование в сумы с разделителями разрядов. */
export function formatMoney(
  m: Money,
  opts: { sign?: boolean; suffix?: string } = {},
): string {
  const neg = m < 0n
  const abs = neg ? -m : m
  const intPart = abs / MINOR_PER_MAJOR
  const frac = abs % MINOR_PER_MAJOR
  const intStr = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const fracStr = frac === 0n ? '' : ',' + frac.toString().padStart(2, '0')
  const sign = neg ? '−' : opts.sign ? '+' : ''
  const suffix = opts.suffix ? ' ' + opts.suffix : ''
  return `${sign}${intStr}${fracStr}${suffix}`
}

export const zero: Money = 0n
export const add = (a: Money, b: Money): Money => a + b
export const sub = (a: Money, b: Money): Money => a - b
export const neg = (a: Money): Money => -a
export const sum = (xs: Money[]): Money => xs.reduce((acc, x) => acc + x, 0n)

/**
 * Перевод суммы из валюты счёта в базовую валюту по курсу.
 * amountMinor — сумма в минорных единицах исходной валюты;
 * rateMinorBasePerMajor — сколько минорных единиц базовой валюты за 1 мажорную исходную.
 * Результат округляется к ближайшей минорной единице.
 */
export function convertToBase(amountMinor: Money, rateMinorBasePerMajor: Money): Money {
  const num = amountMinor * rateMinorBasePerMajor
  const q = num / MINOR_PER_MAJOR
  const r = num % MINOR_PER_MAJOR
  // округление половин вверх по модулю
  const half = MINOR_PER_MAJOR / 2n
  if (r >= half) return q + 1n
  if (r <= -half) return q - 1n
  return q
}

/** Частный случай: USD → UZS (сохранено для совместимости). */
export function convertUsdToUzs(usdMinor: Money, rateMinorUzsPerUsd: Money): Money {
  return convertToBase(usdMinor, rateMinorUzsPerUsd)
}
