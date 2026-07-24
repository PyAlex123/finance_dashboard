// Автогенерация кодов справочников из названия (задание 4).
// Код используется в правилах агрегатов (aggRule.accountCode / categoryCode),
// поэтому он должен быть коротким, латиницей и уникальным.

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
}

/** «Расчётный счёт» → raschetnyy_schet. Всегда непустая строка. */
export function slugify(name: string): string {
  const lower = String(name).trim().toLowerCase()
  let out = ''
  for (const ch of lower) {
    if (ch in TRANSLIT) out += TRANSLIT[ch]
    else if (/[a-z0-9]/.test(ch)) out += ch
    else out += '_'
  }
  out = out.replace(/_+/g, '_').replace(/^_+|_+$/g, '')
  return out || 'item'
}

/** Уникальный код: при конфликте добавляется _2, _3, … */
export function uniqueCode(base: string, existing: Iterable<string>): string {
  const taken = new Set(existing)
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(`${base}_${i}`)) i++
  return `${base}_${i}`
}

/** Код из названия с гарантией уникальности среди существующих. */
export function autoCode(name: string, existing: Iterable<string>): string {
  return uniqueCode(slugify(name), existing)
}

/** Допустимый код: латиница/цифры/подчёркивание, не пустой. */
export function isValidCode(code: string): boolean {
  return /^[a-z0-9_]+$/i.test(code)
}
