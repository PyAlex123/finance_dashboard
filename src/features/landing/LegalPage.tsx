import { BRAND } from '../../brand'
import { href, linkHandler } from '../../routes'
import { useT } from '../../i18n/react'
import type { Key } from '../../i18n'
import './landing.css'

// Юридические страницы (перенос land/Privacy.dc.html и land/Terms.dc.html).
// Это заготовки структуры: финальные формулировки — к юристу. Публикация
// обязательна до запуска входа через Google (требование верификации OAuth).

// Только номера пунктов: тексты берутся из словаря в рендере. Массив готовых
// строк застыл бы на языке, активном при импорте модуля (см. src/App.tsx).
const CLAUSES = [1, 2, 3, 4, 5, 6, 7, 8] as const

export default function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const t = useT()
  const privacy = kind === 'privacy'
  const section = privacy ? 'privacy' : 'terms'

  return (
    <div className="lp-legal">
      <div className="lp-legal__wrap">
        <a className="lp-legal__back" href={href('/')} onClick={linkHandler('/')}>
          <span aria-hidden="true">←</span> {t('legal.home')}
        </a>
        <p className="lp-eyebrow">{t('legal.eyebrow')}</p>
        <h1 className="lp-legal__title">
          {privacy ? t('legal.privacy.title') : t('legal.terms.title')}
        </h1>
        <p className="lp-legal__note">{t('legal.note')}</p>

        {privacy && (
          <div className="lp-legal__callout">
            {t('legal.callout')}
          </div>
        )}

        <div className="lp-legal__card">
          {CLAUSES.map((n) => (
            <section key={n}>
              <h2 className="lp-legal__h2">{t(`legal.${section}.${n}.title` as Key)}</h2>
              <p className="lp-legal__p">{t(`legal.${section}.${n}.text` as Key, { brand: BRAND })}</p>
            </section>
          ))}
        </div>
        <p className="lp-legal__updated">{t('legal.updated')}</p>
      </div>
    </div>
  )
}
