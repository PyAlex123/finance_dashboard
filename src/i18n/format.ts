// Форматирование чисел и дат по локали.
//
// Числа форматируем вручную, а НЕ через Intl.NumberFormat. Две причины:
// 1) группировка у Intl различается между сборками ICU в Node — тесты стали бы
//    плавающими;
// 2) дизайн-система требует тонкого пробела между разрядами и настоящего минуса
//    U+2212 во всех локалях (та же типографика, что в domain/money.ts), а Intl
//    даёт запятые для en-US и обычный дефис.
// Даты, наоборот, безопасно отдаём Intl.DateTimeFormat: их нигде не сравнивают
// посимвольно.

import { BCP47, type Locale } from './types'
import { getLocale } from './locale'
import { t } from './index'

// Ровно те же разделитель и минус, что в domain/money.ts: числа из formatNumber и
// из formatMoney стоят в интерфейсе рядом (дашборд), и разъезжаться им нельзя.
// Прежний toLocaleString('ru-RU') в дашборде давал неразрывный пробел U+00A0 —
// на глаз то же самое, но при смене локали он стал бы запятыми.
const GROUP_SEP = ' '
const MINUS = '−'

/**
 * Целое число с разбивкой по разрядам: 1782500 → «1 782 500».
 * Замена жёстких toLocaleString('ru-RU') в дашборде и списке пользователей.
 */
export function formatNumber(n: number, locale: Locale = getLocale()): string {
  const neg = n < 0
  const digits = Math.abs(Math.trunc(n)).toString()
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEP)
  const frac = formatFraction(Math.abs(n) % 1, locale)
  return `${neg ? MINUS : ''}${grouped}${frac}`
}

function formatFraction(frac: number, locale: Locale): string {
  if (frac === 0) return ''
  const sep = t('money.decimalSep', undefined, locale)
  return sep + frac.toFixed(2).slice(2)
}

/** Дата и время из ISO-строки — для админки и истории версий шаблона. */
export function formatDateTime(iso: string, locale: Locale = getLocale()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(BCP47[locale], {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d)
}
