// Метаданные документа под текущий язык: <html lang>, заголовок вкладки и мета-теги.
//
// Оговорка: переключение языка происходит на клиенте, отдельных адресов вида /en/
// нет (сознательное решение — роутер не трогаем). Значит краулеры и боты превью
// ссылок всегда видят русский index.html. Если понадобится органика на английском,
// минимальное лечение — пререндер отдельного /en/index.html.

import { t } from './index'
import { getLocale } from './locale'

function meta(selector: string, value: string): void {
  const el = document.head.querySelector<HTMLMetaElement>(selector)
  if (el) el.content = value
}

export function applyDocumentLocale(): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = getLocale()
  document.title = t('meta.title')
  meta('meta[name="description"]', t('meta.description'))
  meta('meta[property="og:title"]', t('meta.ogTitle'))
  meta('meta[property="og:description"]', t('meta.ogDescription'))
}
