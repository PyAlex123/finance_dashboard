import { useState } from 'react'
import type { RefObject } from 'react'
import { href, linkHandler } from '../../routes'
import { FinloLockup } from './Logo'
import LangSwitch from '../ui/LangSwitch'
import { useT } from '../../i18n/react'

// Ключи, а не подписи: массив вычисляется при импорте — см. src/App.tsx.
const LINKS = [
  { hash: '#features', labelKey: 'lp.nav.features' },
  { hash: '#how', labelKey: 'lp.nav.how' },
  { hash: '#audience', labelKey: 'lp.nav.audience' },
  { hash: '#learn', labelKey: 'lp.nav.learn' },
] as const

export interface LandingHeaderProps {
  barRef: RefObject<HTMLElement | null>
  /** Вход уже выполнен — вместо «Войти» ведём прямо в кабинет. */
  loggedIn?: boolean
}

// Прилипшая шапка. Класс is-stuck вешает useLandingScroll, меню — обычный
// useState; раскладку (меню/бургер/«Войти») определяют медиазапросы landing.css.
export default function LandingHeader({ barRef, loggedIn }: LandingHeaderProps) {
  const t = useT()
  const [menuOpen, setMenuOpen] = useState(false)
  const enter = loggedIn
    ? { path: '/app', label: t('lp.enter.app') }
    : { path: '/login', label: t('lp.enter.login') }

  return (
    <header className="lp-bar" ref={barRef as RefObject<HTMLElement>}>
      <div className="lp-bar__inner">
        <a className="lp-logo" href="#top">
          <FinloLockup className="lp-logo__svg" />
        </a>

        <nav className="lp-nav">
          {LINKS.map((l) => (
            <a key={l.hash} href={l.hash}>{t(l.labelKey)}</a>
          ))}
        </nav>

        <div className="lp-bar__actions">
          <a
            className="lp-btn lp-btn--quiet lp-bar__login"
            href={href(enter.path)}
            onClick={linkHandler(enter.path)}
          >
            {enter.label}
          </a>
          {/* Переключатель стоит ПЕРЕД кнопками входа: так он не сдвигает две
              главные CTA от правого края. */}
          <LangSwitch className="lp-langswitch" />
          <a className="lp-btn lp-btn--dark" href={href('/login')} onClick={linkHandler('/login')}>
            {t('lp.cta.start')}
          </a>
          <button
            className="lp-burger"
            aria-label={t('lp.menu')}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="lp-burger__lines" aria-hidden="true">
              <span /><span /><span />
            </span>
          </button>
        </div>
      </div>

      <div className={`lp-menu ${menuOpen ? 'is-open' : ''}`}>
        <div className="lp-menu__inner">
          {LINKS.map((l) => (
            <a key={l.hash} href={l.hash} onClick={() => setMenuOpen(false)}>{t(l.labelKey)}</a>
          ))}
          <a
            className="lp-menu__login"
            href={href(enter.path)}
            onClick={linkHandler(enter.path)}
          >
            {enter.label}
          </a>
          {/* Мобильная копия переключателя внутри .lp-menu — прячется с бургером. */}
          <LangSwitch className="lp-langswitch lp-langswitch--menu" />
        </div>
      </div>
    </header>
  )
}
