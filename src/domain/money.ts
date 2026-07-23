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
 * Перевод суммы в USD (минорные USD-центы) в UZS по курсу.
 * rateMinorUzsPerUsd — сколько минорных UZS за 1 мажорный USD.
 * Результат округляется к ближайшему тийину.
 */
export function convertUsdToUzs(usdMinor: Money, rateMinorUzsPerUsd: Money): Money {
  // usdMinor / 100 (USD) * rateMinorUzsPerUsd = минорные UZS
  const num = usdMinor * rateMinorUzsPerUsd
  const q = num / MINOR_PER_MAJOR
  const r = num % MINOR_PER_MAJOR
  // округление половин вверх по модулю
  const half = MINOR_PER_MAJOR / 2n
  if (r >= half) return q + 1n
  if (r <= -half) return q - 1n
  return q
}
