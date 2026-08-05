import { useRef } from 'react'
import LandingHeader from './LandingHeader'
import LandingFooter from './LandingFooter'
import HeroPreview from './HeroPreview'
import { useLandingMotion, useLandingScroll } from './useLandingMotion'
import { href, linkHandler } from '../../routes'
import './landing.css'

// Лендинг — перенос land/Landing.dc.html: восемь секций в том же порядке,
// тексты и визуал 1:1. Всё, что было инлайновыми style, живёт в landing.css.

const PAINS = [
  { icon: '₽̸', title: '«Прибыль есть, а денег нет»',
    text: 'На бумаге бизнес в плюсе, а на счету пусто — и непонятно, куда всё ушло.' },
  { icon: '⁘', title: 'Деньги размазаны везде',
    text: 'Наличные, карта, расчётный счёт, доллары — всё в разных местах и в голове. Общей картины нет.' },
  { icon: '≠', title: 'Excel, который врёт',
    text: 'Одна добавленная строка — и формулы поехали. А вы даже не заметили, что отчёт уже неверный.' },
  { icon: '?', title: 'Бухгалтер — единственный, кто в курсе',
    text: 'Хотите понять свои же финансы — приходится ждать и спрашивать. Свой бизнес, а данные не ваши.' },
]

const FEATURES = [
  { title: 'Три отчёта в одном месте',
    text: 'Движение денег, прибыль и убытки, баланс — связаны между собой и всегда согласованы.' },
  { title: 'Автоматическая сходимость',
    text: 'Программа сама проверяет, что остатки, приходы и расходы бьются. Ошибка не спрячется.' },
  { title: 'Сум и доллары вместе',
    text: 'Учёт в нескольких валютах с курсом на дату. Никакого пересчёта в уме.' },
  { title: 'Видно, откуда цифра',
    text: 'Нажмите на сумму в отчёте — раскроются операции, из которых она сложилась.' },
  { title: 'Импорт и экспорт Excel',
    text: 'Начните со своих данных и выгрузите отчёт файлом, когда он нужен коллеге или банку.' },
  { title: 'Несколько счетов',
    text: 'Наличные, карты, расчётный счёт — всё вместе, с общим остатком и переброской между ними.' },
]

const CALM = [
  { title: 'Данные под вашим контролем',
    text: 'Ваши финансы принадлежат вам. Никакой рекламы, никакой продажи данных на сторону.' },
  { title: 'Цифры, которым можно верить',
    text: 'Каждый отчёт проверяется на сходимость. Вы принимаете решения на верных данных, а не на «примерно».' },
  { title: 'Начать проще, чем кажется',
    text: 'Не нужно быть финансистом. Загрузите пример, посмотрите, как всё устроено, — и заносите своё.' },
]

const LEARN = [
  { title: 'Почему прибыль ≠ деньги на счету?',
    text: 'Можно быть в прибыли и без денег. Разбираемся, почему так и как это увидеть заранее.' },
  { title: 'Что такое ДДС и зачем он вам',
    text: 'Движение денежных средств — самый честный отчёт о том, что реально происходит с деньгами.' },
  { title: 'Как читать баланс за 5 минут',
    text: 'Баланс — не страшная бухгалтерская таблица, а снимок вашего бизнеса. Показываем, как его читать.' },
]

const OWNER_POINTS = [
  'Понимаете, где деньги, без звонка бухгалтеру',
  'Видите реальную прибыль, а не цифру «на бумаге»',
  'Замечаете дыры и утечки, пока они не выросли',
  'Разбираетесь в финансах по ходу — простым языком',
]

const KEEPER_POINTS = [
  'Отчёты собираются сами — без пересчёта формул',
  'Сходимость проверяется автоматически',
  'Экспорт в Excel, когда нужен файл',
  'Несколько счетов и валют в одном месте',
]

export default function Landing({ loggedIn }: { loggedIn?: boolean }) {
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
            <p className="lp-eyebrow lp-anim lp-anim--hero" data-hero="1">Управленческий учёт для бизнеса</p>
            <h1 className="lp-h1 lp-anim lp-anim--hero" data-hero="2">
              Все ваши деньги — в одной картине, которая всегда сходится
            </h1>
            <p className="lp-hero__lead lp-anim lp-anim--hero" data-hero="3">
              ДДС, прибыль и баланс вашего бизнеса — без бухгалтера и без таблиц, которые ломаются.
              Заносите операции, остальное считается само.
            </p>
            <div className="lp-hero__cta lp-anim lp-anim--hero" data-hero="4">
              <a className="lp-btn lp-btn--primary" href={href('/login')} onClick={linkHandler('/login')}>
                Начать бесплатно
              </a>
              <a className="lp-btn lp-btn--ghost" href="#how">
                Посмотреть, как это работает <span aria-hidden="true">→</span>
              </a>
            </div>
            <p className="lp-hero__note lp-anim lp-anim--hero" data-hero="5">
              Регистрация за минуту. Ничего платить не нужно.
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
            <p className="lp-eyebrow">Знакомо?</p>
            <h2 className="lp-h2 lp-h2--gap">Деньги вроде есть, а где они — непонятно</h2>
            <p className="lp-lead">
              Если хоть раз ловили себя на этих мыслях — вы не одни. Так живёт большинство малых бизнесов.
            </p>
          </div>
          <div className="lp-grid">
            {PAINS.map((p, i) => (
              <div key={p.title} className="lp-card lp-card--paper lp-anim" data-reveal={i + 1}>
                <span className="lp-card__icon" aria-hidden="true">{p.icon}</span>
                <h3 className="lp-card__title">{p.title}</h3>
                <p className="lp-card__text">{p.text}</p>
              </div>
            ))}
          </div>
          <p className="lp-punch lp-anim" data-reveal="1">
            Порядок в деньгах не требует финансового образования. Требует правильного инструмента.
          </p>
        </div>
      </section>

      {/* --- Как это работает --- */}
      <section className="lp-section" id="how">
        <div className="lp-wrap">
          <div className="lp-head lp-head--narrow lp-anim" data-reveal="1">
            <p className="lp-eyebrow">Как это работает</p>
            <h2 className="lp-h2">Три шага до полной картины</h2>
          </div>
          <div className="lp-grid lp-grid--how">
            <div className="lp-card lp-card--white lp-card--step lp-anim" data-reveal="1">
              <span className="lp-step__num">01</span>
              <h3 className="lp-step__title">Заносите операции</h3>
              <p className="lp-step__text">
                Приход, расход, переброска между счетами. Простая форма — как заметка в телефоне.
                Учёт нескольких счетов и валют из коробки.
              </p>
              <div className="lp-step__mini">
                <div className="lp-mini-row"><span>Тип</span><span>Приход</span></div>
                <div className="lp-mini-row"><span>Счёт</span><span>Карта · UZS</span></div>
                <div className="lp-mini-row lp-mini-row--in"><span>Сумма</span><span>+ 1 500 000</span></div>
              </div>
            </div>

            <div className="lp-card lp-card--white lp-card--step lp-anim" data-reveal="2">
              <span className="lp-step__num">02</span>
              <h3 className="lp-step__title">Всё считается само</h3>
              <p className="lp-step__text">
                Никаких формул. Программа сама собирает движение денег, прибыль и баланс —
                и сразу проверяет, что всё сходится.
              </p>
              <div className="lp-step__mini lp-step__mini--dots">
                <div className="lp-mini-check"><i aria-hidden="true" />ДДС пересчитан</div>
                <div className="lp-mini-check"><i aria-hidden="true" />ПиУ пересчитан</div>
                <div className="lp-mini-check lp-mini-check--ok"><i aria-hidden="true" />Баланс сошёлся</div>
              </div>
            </div>

            <div className="lp-card lp-card--white lp-card--step lp-anim" data-reveal="3">
              <span className="lp-step__num">03</span>
              <h3 className="lp-step__title">Видите, где ваши деньги</h3>
              <p className="lp-step__text">
                Три отчёта в одном месте. Нажмите на любую цифру — увидите, из чего она сложилась.
                Ничего не спрятано.
              </p>
              <div className="lp-step__mini">
                <div className="lp-mini-row"><span>ДДС</span><span>5 262 500</span></div>
                <div className="lp-mini-row"><span>Прибыль</span><span>1 782 500</span></div>
                <div className="lp-mini-row lp-mini-row--ok"><span>Баланс</span><span>сошёлся</span></div>
              </div>
            </div>
          </div>
          <p className="lp-quote lp-anim" data-reveal="1">
            Каждый отчёт проверяется на сходимость автоматически. Если что-то не бьётся —
            программа покажет, где именно, а не оставит вас с неверными цифрами.
          </p>
        </div>
      </section>

      {/* --- Для кого --- */}
      <section className="lp-section lp-section--white" id="audience">
        <div className="lp-wrap">
          <div className="lp-head lp-anim" data-reveal="1">
            <p className="lp-eyebrow">Для кого</p>
            <h2 className="lp-h2">Ваш бизнес — под контролем, у бухгалтера — порядок</h2>
          </div>
          <div className="lp-audience">
            <div className="lp-audience__main lp-anim" data-reveal="1">
              <p className="lp-eyebrow">Вы — владелец бизнеса</p>
              <h3 className="lp-audience__title">Наконец видите свои деньги сами</h3>
              <ul className="lp-list">
                {OWNER_POINTS.map((p) => (
                  <li key={p}><span className="lp-list__tick" aria-hidden="true">✓</span>{p}</li>
                ))}
              </ul>
            </div>
            <div className="lp-audience__side lp-anim" data-reveal="2">
              <p className="lp-eyebrow">Вы ведёте учёт</p>
              <h3 className="lp-audience__subtitle">Конец ручной сверке</h3>
              <ul className="lp-list lp-list--side">
                {KEEPER_POINTS.map((p) => (
                  <li key={p}><span className="lp-list__tick" aria-hidden="true">✓</span>{p}</li>
                ))}
              </ul>
            </div>
          </div>
          <p className="lp-after lp-anim" data-reveal="1">
            Один инструмент — и собственник, и бухгалтер смотрят на одни и те же цифры. Без разночтений.
          </p>
        </div>
      </section>

      {/* --- Возможности --- */}
      <section className="lp-section" id="features">
        <div className="lp-wrap">
          <div className="lp-head lp-head--narrow lp-anim" data-reveal="1">
            <p className="lp-eyebrow">Возможности</p>
            <h2 className="lp-h2">Всё, чего не хватало в таблице</h2>
          </div>
          <div className="lp-grid lp-grid--features">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="lp-card lp-card--white lp-anim" data-reveal={i + 1}>
                <h3 className="lp-card__title lp-card__title--feature">{f.title}</h3>
                <p className="lp-card__text">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Спокойствие --- */}
      <section className="lp-section lp-section--white">
        <div className="lp-wrap">
          <div className="lp-head lp-head--narrow lp-anim" data-reveal="1">
            <p className="lp-eyebrow">Спокойствие</p>
            <h2 className="lp-h2">Ваши цифры остаются вашими</h2>
          </div>
          <div className="lp-grid lp-grid--calm">
            {CALM.map((c, i) => (
              <div key={c.title} className="lp-card lp-card--paper lp-card--calm lp-anim" data-reveal={i + 1}>
                <h3 className="lp-card__title lp-card__title--calm">{c.title}</h3>
                <p className="lp-card__text lp-card__text--wide">{c.text}</p>
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
            <p className="lp-eyebrow">Разберётесь по ходу</p>
            <h2 className="lp-h2 lp-h2--gap">Заодно научитесь финансовому мышлению</h2>
            <p className="lp-lead">
              Пока пользуетесь — начинаете понимать, как на самом деле устроены деньги в бизнесе.
              Коротко и без занудства.
            </p>
          </div>
          <div className="lp-grid lp-grid--learn">
            {LEARN.map((l, i) => (
              <a key={l.title} className="lp-card lp-card--white lp-card--learn lp-anim"
                 href="#learn" data-reveal={i + 1}>
                <h3 className="lp-card__title lp-card__title--learn">{l.title}</h3>
                <p className="lp-card__text">{l.text}</p>
                <span className="lp-card__more">читать →</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* --- Финальный CTA --- */}
      <section className="lp-cta">
        <div className="lp-cta__box lp-anim" data-reveal="1">
          <h2 className="lp-cta__title">Наведите порядок в деньгах уже сегодня</h2>
          <p className="lp-cta__text">Регистрация за минуту. Первый отчёт вы соберёте сегодня же.</p>
          <a className="lp-btn lp-btn--light" href={href('/login')} onClick={linkHandler('/login')}>
            Начать бесплатно
          </a>
        </div>
      </section>

      <LandingFooter loggedIn={loggedIn} />
    </div>
  )
}
