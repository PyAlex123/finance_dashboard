import { useAppSelector } from '../../store/hooks'
import { selectTotalBalance, selectPlNetProfit } from '../../store/reportSelectors'
import { formatMoney } from '../../domain/money'

export type ModuleId = 'dds' | 'pl' | 'bs'

interface ModuleCard {
  id: ModuleId
  eyebrow: string
  title: string
  desc: string
  soon?: boolean
}

const MODULES: ModuleCard[] = [
  { id: 'dds', eyebrow: 'Модуль 01', title: 'ДДС', desc: 'Движение денежных средств: приход, расход, переброски.' },
  { id: 'pl', eyebrow: 'Модуль 02', title: 'P&L', desc: 'Прибыли и убытки по методу начисления.' },
  { id: 'bs', eyebrow: 'Модуль 03', title: 'Баланс', desc: 'Активы и обязательства на дату.', soon: true },
]

export default function ModuleChooser({
  username, onPick, onLogout, onOpenDesignSystem,
}: {
  username: string
  onPick: (id: ModuleId) => void
  onLogout: () => void
  onOpenDesignSystem: () => void
}) {
  const totalBalance = useAppSelector(selectTotalBalance)
  const netProfit = useAppSelector(selectPlNetProfit)

  const stat: Record<ModuleId, { value: string; label: string }> = {
    dds: { value: formatMoney(totalBalance), label: 'остаток, сум' },
    pl: { value: netProfit === null ? '—' : formatMoney(netProfit), label: 'прибыль, сум' },
    bs: { value: '—', label: 'скоро' },
  }

  return (
    <div className="chooser">
      <header className="chooser__top">
        <div>
          <div className="chooser__hello">Здравствуйте, {username}</div>
          <h1 className="chooser__title">Выберите модуль</h1>
        </div>
        <div className="chooser__who">
          <div className="chooser__avatar">{username.charAt(0).toUpperCase()}</div>
          <span className="chooser__name">{username}</span>
          <button className="btn" onClick={onLogout}>Выйти</button>
        </div>
      </header>

      <div className="chooser__grid">
        {MODULES.map((m) => (
          <button
            key={m.id}
            className={`modcard ${m.soon ? 'modcard--soon' : ''}`}
            disabled={m.soon}
            onClick={() => !m.soon && onPick(m.id)}
          >
            <div className="modcard__head">
              <span className="modcard__eyebrow">{m.eyebrow}</span>
              {m.soon && <span className="modcard__badge">Скоро</span>}
            </div>
            <div className="modcard__title">{m.title}</div>
            <div className="modcard__desc">{m.desc}</div>
            <div className="modcard__stat">
              {stat[m.id].value}
              <span className="modcard__stat-label">{stat[m.id].label}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="chooser__ds">
        <a href="#" onClick={(e) => { e.preventDefault(); onOpenDesignSystem() }}>Дизайн-система →</a>
      </div>
    </div>
  )
}
