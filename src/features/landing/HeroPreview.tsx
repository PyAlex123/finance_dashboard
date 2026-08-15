import { useT } from '../../i18n/react'
import { moneySuffix } from '../../domain/money'
// Превью продукта из hero: отчёт ДДС со сходящимся балансом. Числа —
// демонстрационные (как в макете); «Остаток на конец» и «Прибыль за месяц»
// досчитываются от нуля при появлении (data-count, см. useLandingMotion).
export default function HeroPreview() {
  const t = useT()
  return (
    <>
      <div className="lp-preview">
        <div className="lp-preview__head">
          <div>
            <p className="lp-preview__title">{t('lp.preview.title')}</p>
            <p className="lp-preview__sub">{t('lp.preview.sub')}</p>
          </div>
          <span className="lp-preview__badge">
            <span className="lp-preview__dot" aria-hidden="true" />
            {t('lp.preview.badge')}
          </span>
        </div>
        <div className="lp-preview__body">
          <table className="lp-preview__table">
            <thead>
              <tr>
                <th>{t('lp.preview.col.item')}</th>
                <th>{t('lp.preview.col.amount')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t('lp.preview.opening')}</td>
                <td>3 480 000</td>
              </tr>
              <tr>
                <td>{t('lp.preview.sales')}</td>
                <td className="lp-preview__in">+ 9 140 000</td>
              </tr>
              <tr>
                <td>{t('lp.preview.purchase')}</td>
                <td>− 5 210 000</td>
              </tr>
              <tr>
                <td>{t('lp.preview.rentSalary')}</td>
                <td>− 2 147 500</td>
              </tr>
              <tr className="lp-preview__total">
                <td>{t('lp.preview.closing')}</td>
                <td data-count="5262500">5 262 500</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="lp-preview__float">
        <p className="lp-preview__float-label">{t('lp.preview.profitLabel')}</p>
        {/* Число и суффикс валюты — РАЗНЫЕ узлы, и это принципиально: анимация
            счётчика пишет прямо в textContent своего элемента, затирая структуру
            текстовых узлов React. Пока они жили в одном <p>, элемент после
            анимации переставал следовать за сменой языка и навсегда показывал
            суффикс того языка, на котором страница открылась. */}
        <p className="lp-preview__float-value">
          <span data-count="1782500">1 782 500</span> {moneySuffix()}
        </p>
      </div>
    </>
  )
}
