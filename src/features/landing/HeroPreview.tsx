// Превью продукта из hero: отчёт ДДС со сходящимся балансом. Числа —
// демонстрационные (как в макете); «Остаток на конец» и «Прибыль за месяц»
// досчитываются от нуля при появлении (data-count, см. useLandingMotion).
export default function HeroPreview() {
  return (
    <>
      <div className="lp-preview">
        <div className="lp-preview__head">
          <div>
            <p className="lp-preview__title">Движение денежных средств</p>
            <p className="lp-preview__sub">Июль 2026 · все счета</p>
          </div>
          <span className="lp-preview__badge">
            <span className="lp-preview__dot" aria-hidden="true" />
            Баланс сошёлся
          </span>
        </div>
        <div className="lp-preview__body">
          <table className="lp-preview__table">
            <thead>
              <tr>
                <th>Статья</th>
                <th>Сум</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Остаток на начало</td>
                <td>3 480 000</td>
              </tr>
              <tr>
                <td>Поступления от продаж</td>
                <td className="lp-preview__in">+ 9 140 000</td>
              </tr>
              <tr>
                <td>Закуп товара</td>
                <td>− 5 210 000</td>
              </tr>
              <tr>
                <td>Аренда и зарплаты</td>
                <td>− 2 147 500</td>
              </tr>
              <tr className="lp-preview__total">
                <td>Остаток на конец</td>
                <td data-count="5262500">5 262 500</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="lp-preview__float">
        <p className="lp-preview__float-label">Прибыль за месяц</p>
        <p className="lp-preview__float-value" data-count="1782500">1 782 500 сум</p>
      </div>
    </>
  )
}
