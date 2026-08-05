import { useState } from 'react'
import type { RefObject } from 'react'
import { BRAND } from '../../brand'
import { href, linkHandler } from '../../routes'

const LINKS = [
  { hash: '#features', label: 'Возможности' },
  { hash: '#how', label: 'Как работает' },
  { hash: '#audience', label: 'Для кого' },
  { hash: '#learn', label: 'Обучение' },
]

export interface LandingHeaderProps {
  barRef: RefObject<HTMLElement | null>
  /** Вход уже выполнен — вместо «Войти» ведём прямо в кабинет. */
  loggedIn?: boolean
}

// Прилипшая шапка. Класс is-stuck вешает useLandingScroll, меню — обычный
// useState; раскладку (меню/бургер/«Войти») определяют медиазапросы landing.css.
export default function LandingHeader({ barRef, loggedIn }: LandingHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const enter = loggedIn ? { path: '/app', label: 'Открыть кабинет' } : { path: '/login', label: 'Войти' }

  return (
    <header className="lp-bar" ref={barRef as RefObject<HTMLElement>}>
      <div className="lp-bar__inner">
        <a className="lp-logo" href="#top">
          <span className="lp-logo__mark" aria-hidden="true">
            <span className="lp-logo__tick" />
          </span>
          <span className="lp-logo__name">{BRAND}</span>
        </a>

        <nav className="lp-nav">
          {LINKS.map((l) => (
            <a key={l.hash} href={l.hash}>{l.label}</a>
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
          <a className="lp-btn lp-btn--dark" href={href('/login')} onClick={linkHandler('/login')}>
            Начать бесплатно
          </a>
          <button
            className="lp-burger"
            aria-label="Меню"
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
            <a key={l.hash} href={l.hash} onClick={() => setMenuOpen(false)}>{l.label}</a>
          ))}
          <a
            className="lp-menu__login"
            href={href(enter.path)}
            onClick={linkHandler(enter.path)}
          >
            {enter.label}
          </a>
        </div>
      </div>
    </header>
  )
}
