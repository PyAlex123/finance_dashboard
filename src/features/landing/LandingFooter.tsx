import { BRAND } from '../../brand'
import { href, linkHandler } from '../../routes'
import { FinloLockup } from './Logo'
import { useT } from '../../i18n/react'

export default function LandingFooter({ loggedIn }: { loggedIn?: boolean }) {
  const t = useT()
  const enter = loggedIn
    ? { path: '/app', label: t('lp.enter.app') }
    : { path: '/login', label: t('lp.enter.login') }

  return (
    <footer className="lp-footer">
      <div className="lp-footer__inner">
        <div className="lp-footer__brand">
          <div className="lp-footer__logo">
            <FinloLockup tone="paper" className="lp-footer__svg" />
          </div>
          <p className="lp-footer__desc">{t('brand.tagline')}</p>
        </div>

        <div className="lp-footer__col">
          <p className="lp-footer__col-title">{t('lp.footer.product')}</p>
          <a href="#features">{t('lp.nav.features')}</a>
          <a href="#how">{t('lp.nav.how')}</a>
          <a href={href(enter.path)} onClick={linkHandler(enter.path)}>{enter.label}</a>
        </div>

        <div className="lp-footer__col">
          <p className="lp-footer__col-title">{t('lp.footer.learn')}</p>
          <a href="#learn">{t('lp.footer.learn.1')}</a>
          <a href="#learn">{t('lp.footer.learn.2')}</a>
          <a href="#learn">{t('lp.footer.learn.3')}</a>
        </div>

        <div className="lp-footer__col">
          <p className="lp-footer__col-title">{t('lp.footer.legal')}</p>
          <a href={href('/privacy')} onClick={linkHandler('/privacy')}>{t('lp.footer.privacy')}</a>
          <a href={href('/terms')} onClick={linkHandler('/terms')}>{t('lp.footer.terms')}</a>
          <a href="mailto:hello@example.uz">{t('lp.footer.contacts')}</a>
        </div>
      </div>
      <div className="lp-footer__bottom">{t('lp.footer.bottom', { brand: BRAND })}</div>
    </footer>
  )
}
