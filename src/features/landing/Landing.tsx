import { useRef } from 'react'
import LandingHeader from './LandingHeader'
import LandingFooter from './LandingFooter'
import HeroPreview from './HeroPreview'
import { useLandingMotion, useLandingScroll } from './useLandingMotion'
import { href, linkHandler } from '../../routes'
import { useT } from '../../i18n/react'
import type { Key } from '../../i18n'
import './landing.css'

// Лендинг — перенос land/Landing.dc.html: восемь секций в том же порядке,
// тексты и визуал 1:1. Всё, что было инлайновыми style, живёт в landing.css.

// Только идентификаторы: подписи берутся из словаря в рендере. Массив готовых
// строк вычислялся бы при импорте модуля и навсегда застыл бы на языке первого
// рендера (см. пояснение в src/App.tsx).
const PAIN_ICONS = ['₽̸', '⁘', '≠', '?']
const PAINS = [1, 2, 3, 4] as const
const FEATURES = [1, 2, 3, 4, 5, 6] as const
const CALM = [1, 2, 3] as const
const LEARN = [1, 2, 3] as const
const OWNER_POINTS = [1, 2, 3, 4] as const
const KEEPER_POINTS = [1, 2, 3, 4] as const

export default function Landing({ loggedIn }: { loggedIn?: boolean }) {
  const t = useT()
  const rootRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLElement>(null)
  const blob1 = useRef<HTMLDivElement>(null)
  const blob2 = useRef<HTMLDivElement>(null)

  useLandingMotion(rootRef)
  useLandingScroll(barRef, [blob1, blob2])

  return (
    <div className="lp" ref={rootRef}>
      <LandingHeader barRef={barRef} loggedIn={loggedIn} />

      {/* --- Hero --- */}
      <section className="lp-hero" id="top">
        <div className="lp-blob lp-blob--1" ref={blob1} aria-hidden="true" />
        <div className="lp-blob lp-blob--2" ref={blob2} aria-hidden="true" />

        <div className="lp-hero__inner">
          <div className="lp-hero__text">
            <p className="lp-eyebrow lp-anim lp-anim--hero" data-hero="1">{t('lp.hero.eyebrow')}</p>
            <h1 className="lp-h1 lp-anim lp-anim--hero" data-hero="2">
              {t('lp.hero.h1')}
            </h1>
            <p className="lp-hero__lead lp-anim lp-anim--hero" data-hero="3">
              {t('lp.hero.lead')}
            </p>
            <div className="lp-hero__cta lp-anim lp-anim--hero" data-hero="4">
              <a className="lp-btn lp-btn--primary" href={href('/login')} onClick={linkHandler('/login')}>
                {t('lp.cta.start')}
              </a>
              <a className="lp-btn lp-btn--ghost" href="#how">
                {t('lp.hero.how')} <span aria-hidden="true">→</span>
              </a>
            </div>
            <p className="lp-hero__note lp-anim lp-anim--hero" data-hero="5">
              {t('lp.hero.note')}
            </p>
          </div>

          <div className="lp-hero__preview lp-anim lp-anim--hero lp-anim--hero-late" data-hero="6">
            <HeroPreview />
          </div>
        </div>
      </section>

      {/* --- Проблема --- */}
      <section className="lp-section lp-section--white">
        <div className="lp-wrap">
          <div className="lp-head lp-anim" data-reveal="1">
            <p className="lp-eyebrow">{t('lp.pain.eyebrow')}</p>
            <h2 className="lp-h2 lp-h2--gap">{t('lp.pain.h2')}</h2>
            <p className="lp-lead">
              {t('lp.pain.lead')}
            </p>
          </div>
          <div className="lp-grid">
            {PAINS.map((n, i) => (
              <div key={n} className="lp-card lp-card--paper lp-anim" data-reveal={i + 1}>
                <span className="lp-card__icon" aria-hidden="true">{PAIN_ICONS[i]}</span>
                <h3 className="lp-card__title">{t(`lp.pain.${n}.title` as Key)}</h3>
                <p className="lp-card__text">{t(`lp.pain.${n}.text` as Key)}</p>
              </div>
            ))}
          </div>
          <p className="lp-punch lp-anim" data-reveal="1">
            {t('lp.pain.punch')}
          </p>
        </div>
      </section>

      {/* --- Как это работает --- */}
      <section className="lp-section" id="how">
        <div className="lp-wrap">
          <div className="lp-head lp-head--narrow lp-anim" data-reveal="1">
            <p className="lp-eyebrow">{t('lp.how.eyebrow')}</p>
            <h2 className="lp-h2">{t('lp.how.h2')}</h2>
          </div>
          <div className="lp-grid lp-grid--how">
            <div className="lp-card lp-card--white lp-card--step lp-anim" data-reveal="1">
              <span className="lp-step__num">01</span>
              <h3 className="lp-step__title">{t('lp.how.1.title')}</h3>
              <p className="lp-step__text">
                {t('lp.how.1.text')}
              </p>
              <div className="lp-step__mini">
                <div className="lp-mini-row"><span>{t('lp.how.1.type')}</span><span>{t('lp.how.1.typeValue')}</span></div>
                <div className="lp-mini-row"><span>{t('lp.how.1.account')}</span><span>{t('lp.how.1.accountValue')}</span></div>
                <div className="lp-mini-row lp-mini-row--in"><span>{t('lp.how.1.amount')}</span><span>+ 1 500 000</span></div>
              </div>
            </div>

            <div className="lp-card lp-card--white lp-card--step lp-anim" data-reveal="2">
              <span className="lp-step__num">02</span>
              <h3 className="lp-step__title">{t('lp.how.2.title')}</h3>
              <p className="lp-step__text">
                {t('lp.how.2.text')}
              </p>
              <div className="lp-step__mini lp-step__mini--dots">
                <div className="lp-mini-check"><i aria-hidden="true" />{t('lp.how.2.cf')}</div>
                <div className="lp-mini-check"><i aria-hidden="true" />{t('lp.how.2.pl')}</div>
                <div className="lp-mini-check lp-mini-check--ok"><i aria-hidden="true" />{t('lp.how.2.bs')}</div>
              </div>
            </div>

            <div className="lp-card lp-card--white lp-card--step lp-anim" data-reveal="3">
              <span className="lp-step__num">03</span>
              <h3 className="lp-step__title">{t('lp.how.3.title')}</h3>
              <p className="lp-step__text">
                {t('lp.how.3.text')}
              </p>
              <div className="lp-step__mini">
                <div className="lp-mini-row"><span>{t('lp.how.3.cf')}</span><span>5 262 500</span></div>
                <div className="lp-mini-row"><span>{t('lp.how.3.profit')}</span><span>1 782 500</span></div>
                <div className="lp-mini-row lp-mini-row--ok"><span>{t('lp.how.3.bs')}</span><span>{t('lp.how.3.bsValue')}</span></div>
              </div>
            </div>
          </div>
          <p className="lp-quote lp-anim" data-reveal="1">
            {t('lp.how.quote')}
          </p>
        </div>
      </section>

      {/* --- Для кого --- */}
      <section className="lp-section lp-section--white" id="audience">
        <div className="lp-wrap">
          <div className="lp-head lp-anim" data-reveal="1">
            <p className="lp-eyebrow">{t('lp.audience.eyebrow')}</p>
            <h2 className="lp-h2">{t('lp.audience.h2')}</h2>
          </div>
          <div className="lp-audience">
            <div className="lp-audience__main lp-anim" data-reveal="1">
              <p className="lp-eyebrow">{t('lp.audience.owner.eyebrow')}</p>
              <h3 className="lp-audience__title">{t('lp.audience.owner.title')}</h3>
              <ul className="lp-list">
                {OWNER_POINTS.map((n) => (
                  <li key={n}><span className="lp-list__tick" aria-hidden="true">✓</span>{t(`lp.audience.owner.${n}` as Key)}</li>
                ))}
              </ul>
            </div>
            <div className="lp-audience__side lp-anim" data-reveal="2">
              <p className="lp-eyebrow">{t('lp.audience.keeper.eyebrow')}</p>
              <h3 className="lp-audience__subtitle">{t('lp.audience.keeper.title')}</h3>
              <ul className="lp-list lp-list--side">
                {KEEPER_POINTS.map((n) => (
                  <li key={n}><span className="lp-list__tick" aria-hidden="true">✓</span>{t(`lp.audience.keeper.${n}` as Key)}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="lp-after lp-anim" data-reveal="1">
            {t('lp.audience.after')}
          </p>
        </div>
      </section>

      {/* --- Возможности --- */}
      <section className="lp-section" id="features">
        <div className="lp-wrap">
          <div className="lp-head lp-head--narrow lp-anim" data-reveal="1">
            <p className="lp-eyebrow">{t('lp.features.eyebrow')}</p>
            <h2 className="lp-h2">{t('lp.features.h2')}</h2>
          </div>
          <div className="lp-grid lp-grid--features">
            {FEATURES.map((n, i) => (
              <div key={n} className="lp-card lp-card--white lp-anim" data-reveal={i + 1}>
                <h3 className="lp-card__title lp-card__title--feature">{t(`lp.features.${n}.title` as Key)}</h3>
                <p className="lp-card__text">{t(`lp.features.${n}.text` as Key)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Спокойствие --- */}
      <section className="lp-section lp-section--white">
        <div className="lp-wrap">
          <div className="lp-head lp-head--narrow lp-anim" data-reveal="1">
            <p className="lp-eyebrow">{t('lp.calm.eyebrow')}</p>
            <h2 className="lp-h2">{t('lp.calm.h2')}</h2>
          </div>
          <div className="lp-grid lp-grid--calm">
            {CALM.map((n, i) => (
              <div key={n} className="lp-card lp-card--paper lp-card--calm lp-anim" data-reveal={i + 1}>
                <h3 className="lp-card__title lp-card__title--calm">{t(`lp.calm.${n}.title` as Key)}</h3>
                <p className="lp-card__text lp-card__text--wide">{t(`lp.calm.${n}.text` as Key)}</p>
              </div>
            ))}
          </div>
          {/* Сетка отзывов из макета скрыта до первых пользователей (sc-if showTestimonials). */}
        </div>
      </section>

      {/* --- Обучение --- */}
      <section className="lp-section lp-section--learn" id="learn">
        <div className="lp-wrap">
          <div className="lp-head lp-head--learn lp-anim" data-reveal="1">
            <p className="lp-eyebrow">{t('lp.learn.eyebrow')}</p>
            <h2 className="lp-h2 lp-h2--gap">{t('lp.learn.h2')}</h2>
            <p className="lp-lead">
              {t('lp.learn.lead')}
            </p>
          </div>
          <div className="lp-grid lp-grid--learn">
            {LEARN.map((n, i) => (
              <a key={n} className="lp-card lp-card--white lp-card--learn lp-anim"
                 href="#learn" data-reveal={i + 1}>
                <h3 className="lp-card__title lp-card__title--learn">{t(`lp.learn.${n}.title` as Key)}</h3>
                <p className="lp-card__text">{t(`lp.learn.${n}.text` as Key)}</p>
                <span className="lp-card__more">{t('lp.learn.more')}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* --- Финальный CTA --- */}
      <section className="lp-cta">
        <div className="lp-cta__box lp-anim" data-reveal="1">
          <h2 className="lp-cta__title">{t('lp.final.h2')}</h2>
          <p className="lp-cta__text">{t('lp.final.text')}</p>
          <a className="lp-btn lp-btn--light" href={href('/login')} onClick={linkHandler('/login')}>
            {t('lp.cta.start')}
          </a>
        </div>
      </section>

      <LandingFooter loggedIn={loggedIn} />
    </div>
  )
}
