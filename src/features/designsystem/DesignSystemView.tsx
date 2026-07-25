// Витрина токенов и компонентов визуала «Язык денег» (перенос секции DESIGN
// SYSTEM эталона). Статичная — показывает палитру, типографику, кнопки, бейджи,
// поля и пустое состояние в едином стиле.

const SWATCHES: { name: string; hex: string }[] = [
  { name: 'forest', hex: '#0B3B32' }, { name: 'moss', hex: '#14584A' }, { name: 'accent', hex: '#1FA37F' },
  { name: 'mint', hex: '#8FD9C2' }, { name: 'paper', hex: '#F4F7F5' }, { name: 'ink', hex: '#0E1F1A' },
  { name: 'muted', hex: '#68807A' }, { name: 'расход', hex: '#B85C38' }, { name: 'переброска', hex: '#4A6B84' },
  { name: 'расхождение', hex: '#C08A2E' },
]

export default function DesignSystemView({ onBack }: { onBack: () => void }) {
  return (
    <div className="ds">
      <div className="ds__top">
        <div>
          <div className="ds__eyebrow">Язык денег · рабочий режим</div>
          <h1 className="ds__title">Дизайн-система</h1>
        </div>
        <button className="btn" onClick={onBack}>← Модули</button>
      </div>

      <div className="ds__wrap">
        <div className="ds__section-label">Токены цвета</div>
        <div className="ds__swatches">
          {SWATCHES.map((s) => (
            <div key={s.name} className="ds__swatch">
              <div className="ds__swatch-color" style={{ background: s.hex }} />
              <div className="ds__swatch-meta">
                <div className="ds__swatch-name">{s.name}</div>
                <div className="ds__swatch-hex">{s.hex}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="ds__section-label">Типографика</div>
        <div className="ds__card ds__type">
          <div className="ds__eyebrow">Eyebrow · Manrope 600 · 11.5px</div>
          <div className="ds__type-h1">Заголовок экрана · Manrope 800</div>
          <div className="ds__type-body">
            Основной текст набирается шрифтом Golos Text с межстрочным 1.6 — для описаний,
            пояснений и подписей внутри рабочих экранов.
          </div>
          <div className="ds__type-nums">
            <span className="ds__num-big">1&nbsp;500&nbsp;000</span>
            <span className="ds__num-neg">(500&nbsp;000)</span>
            <span className="ds__num-note">tabular-nums · неразрывный пробел · скобки для отрицательных</span>
          </div>
        </div>

        <div className="ds__grid2">
          <div className="ds__card">
            <div className="ds__card-title">Кнопки</div>
            <div className="ds__row">
              <button className="btn btn--primary">Основная</button>
              <button className="btn">Вторичная</button>
              <button className="ds__btn-quiet">Тихая</button>
              <button className="btn btn--danger">Опасная</button>
            </div>
          </div>
          <div className="ds__card">
            <div className="ds__card-title">Бейджи типов</div>
            <div className="ds__row">
              <span className="jbadge jbadge--in">● Приход</span>
              <span className="jbadge jbadge--out">● Расход</span>
              <span className="jbadge jbadge--tr">⇄ Переброска</span>
              <span className="ds__badge-cat">Категория</span>
              <span className="ds__badge-warn">Расхождение</span>
            </div>
          </div>
        </div>

        <div className="ds__grid2">
          <div className="ds__card">
            <div className="ds__card-title">Поля ввода</div>
            <input className="ds__input" placeholder="Обычное поле" />
            <div className="ds__amount">
              <input defaultValue="650 000" />
              <span>сум</span>
            </div>
            <div className="ds__hint">Поле суммы · фокус акцентом · tabular-nums</div>
          </div>
          <div className="ds__card">
            <div className="ds__card-title">Пустое состояние</div>
            <div className="ds__empty">
              <div className="ds__empty-icon">＋</div>
              <div className="ds__empty-text">В журнале пока нет операций.</div>
              <div className="ds__row ds__row--center">
                <button className="btn btn--primary btn--small">Добавить первую</button>
                <button className="btn btn--small">Загрузить пример</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
