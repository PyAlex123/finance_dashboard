import { BRAND, BRAND_TAGLINE } from '../../brand'
import { href, linkHandler } from '../../routes'

export default function LandingFooter({ loggedIn }: { loggedIn?: boolean }) {
  const enter = loggedIn ? { path: '/app', label: 'Открыть кабинет' } : { path: '/login', label: 'Войти' }

  return (
    <footer className="lp-footer">
      <div className="lp-footer__inner">
        <div className="lp-footer__brand">
          <div className="lp-footer__logo">
            <span className="lp-footer__mark" aria-hidden="true">
              <span className="lp-footer__tick" />
            </span>
            <span className="lp-footer__name">{BRAND}</span>
          </div>
          <p className="lp-footer__desc">{BRAND_TAGLINE}</p>
        </div>

        <div className="lp-footer__col">
          <p className="lp-footer__col-title">Продукт</p>
          <a href="#features">Возможности</a>
          <a href="#how">Как работает</a>
          <a href={href(enter.path)} onClick={linkHandler(enter.path)}>{enter.label}</a>
        </div>

        <div className="lp-footer__col">
          <p className="lp-footer__col-title">Обучение</p>
          <a href="#learn">Прибыль и деньги</a>
          <a href="#learn">Что такое ДДС</a>
          <a href="#learn">Как читать баланс</a>
        </div>

        <div className="lp-footer__col">
          <p className="lp-footer__col-title">Правовое</p>
          <a href={href('/privacy')} onClick={linkHandler('/privacy')}>Политика конфиденциальности</a>
          <a href={href('/terms')} onClick={linkHandler('/terms')}>Условия использования</a>
          <a href="mailto:hello@example.uz">Контакты</a>
        </div>
      </div>
      <div className="lp-footer__bottom">© 2026 {BRAND}. Сделано в Узбекистане.</div>
    </footer>
  )
}
