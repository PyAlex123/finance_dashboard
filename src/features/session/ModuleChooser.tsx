import { useEffect, useState } from 'react'
import { useAppSelector } from '../../store/hooks'
import { selectTotalBalance, selectPlNetProfit } from '../../store/reportSelectors'
import { formatMoney } from '../../domain/money'
import { REMOTE } from '../../data/backend'
import { listReports } from '../../data/reports'
import ProfileBadge from './ProfileBadge'
import { FinloMark } from '../landing/Logo'
import type { ReportForm } from '../../domain/types'

export type ModuleId = 'dds' | 'pl' | 'bs'

// Модуль → тип отчёта (форма). P&L пока скрыт (заглушка «Скоро»).
const MODULE_FORM: Record<ModuleId, ReportForm> = { dds: 'cf', pl: 'pl', bs: 'bs' }

interface ModuleCard {
  id: ModuleId
  eyebrow: string
  title: string
  desc: string
  soon?: boolean
}

const MODULES: ModuleCard[] = [
  { id: 'dds', eyebrow: 'Модуль 01', title: 'ДДС', desc: 'Движение денежных средств: приход, расход, переброски.' },
  { id: 'pl', eyebrow: 'Модуль 02', title: 'P&L', desc: 'Прибыли и убытки по методу начисления.', soon: true },
  { id: 'bs', eyebrow: 'Модуль 03', title: 'Баланс', desc: 'Активы и обязательства на дату.', soon: true },
]

export default function ModuleChooser({
  username, photoUrl, isAdmin, onOpenAdmin, onPick, onLogout,
}: {
  username: string
  photoUrl?: string
  isAdmin?: boolean
  onOpenAdmin?: () => void
  onPick: (id: ModuleId) => void
  onLogout?: () => void
}) {
  const totalBalance = useAppSelector(selectTotalBalance)
  const netProfit = useAppSelector(selectPlNetProfit)

  // Серверный режим: снимок на этом экране не подключён — показываем количество
  // отчётов каждого типа. Локальный режим — единый снимок, показываем его сводку.
  // Активен только ДДС; для него в серверном режиме показываем число отчётов.
  const [counts, setCounts] = useState<Partial<Record<ModuleId, number>>>({})
  useEffect(() => {
    if (!REMOTE) return
    let cancelled = false
    async function load() {
      try {
        const items = await listReports(MODULE_FORM.dds)
        if (!cancelled) setCounts((c) => ({ ...c, dds: items.length }))
      } catch { /* сеть недоступна — оставим прочерк */ }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const stat: Record<ModuleId, { value: string; label: string }> = REMOTE
    ? {
      dds: { value: counts.dds === undefined ? '—' : String(counts.dds), label: 'отчётов' },
      pl: { value: '—', label: 'скоро' },
      bs: { value: '—', label: 'скоро' },
    }
    : {
      dds: { value: formatMoney(totalBalance), label: 'остаток, сум' },
      pl: { value: netProfit === null ? '—' : formatMoney(netProfit), label: 'скоро' },
      bs: { value: '—', label: 'скоро' },
    }

  return (
    <div className="chooser">
      <header className="chooser__top">
        <div className="chooser__brand">
          <FinloMark className="chooser__logo" />
          <div>
            <div className="chooser__hello">Здравствуйте, {username}</div>
            <h1 className="chooser__title">Выберите модуль</h1>
          </div>
        </div>
        <div className="chooser__who">
          <ProfileBadge name={username} photoUrl={photoUrl} />
          {isAdmin && onOpenAdmin && (
            <button className="btn" onClick={onOpenAdmin}>👥 Пользователи</button>
          )}
          {onLogout && <button className="btn" onClick={onLogout}>Выйти</button>}
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
    </div>
  )
}
