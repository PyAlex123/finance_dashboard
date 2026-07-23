export type ModuleId = 'dds' | 'pl' | 'bs'

interface ModuleCard {
  id: ModuleId
  title: string
  desc: string
  icon: string
  soon?: boolean
}

const MODULES: ModuleCard[] = [
  { id: 'dds', title: 'ДДС', desc: 'Движение денежных средств', icon: '💵' },
  { id: 'pl', title: 'P&L', desc: 'Прибыли и убытки', icon: '📈', soon: true },
  { id: 'bs', title: 'Баланс', desc: 'Активы и пассивы', icon: '⚖️', soon: true },
]

export default function ModuleChooser({
  username, onPick, onLogout,
}: {
  username: string
  onPick: (id: ModuleId) => void
  onLogout: () => void
}) {
  return (
    <div className="chooser">
      <header className="chooser__top">
        <div>
          <div className="chooser__hello">Здравствуйте, {username}</div>
          <h1 className="chooser__title">Выберите отчёт</h1>
        </div>
        <button className="btn" onClick={onLogout}>Выйти</button>
      </header>

      <div className="chooser__grid">
        {MODULES.map((m) => (
          <button
            key={m.id}
            className={`modcard ${m.soon ? 'modcard--soon' : ''}`}
            disabled={m.soon}
            onClick={() => !m.soon && onPick(m.id)}
          >
            {m.soon && <span className="modcard__badge">Скоро</span>}
            <span className="modcard__icon">{m.icon}</span>
            <span className="modcard__title">{m.title}</span>
            <span className="modcard__desc">{m.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
