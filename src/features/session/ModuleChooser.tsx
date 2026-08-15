import { useEffect, useState } from 'react'
import { useAppSelector } from '../../store/hooks'
import { selectTotalBalance, selectPlNetProfit } from '../../store/reportSelectors'
import { formatMoney } from '../../domain/money'
import { REMOTE } from '../../data/backend'
import { listReports } from '../../data/reports'
import ProfileBadge from './ProfileBadge'
import LangSwitch from '../ui/LangSwitch'
import { FinloMark } from '../landing/Logo'
import { moneySuffix } from '../../domain/money'
import { useT } from '../../i18n/react'
import type { ReportForm } from '../../domain/types'

export type ModuleId = 'dds' | 'pl' | 'bs'

// Модуль → тип отчёта (форма). P&L пока скрыт (заглушка «Скоро»).
const MODULE_FORM: Record<ModuleId, ReportForm> = { dds: 'cf', pl: 'pl', bs: 'bs' }

// Только идентификаторы: подписи берутся из словаря в рендере, иначе массив
// застыл бы на языке, активном при импорте модуля.
const MODULES: { id: ModuleId; soon?: boolean }[] = [
  { id: 'dds' },
  { id: 'pl', soon: true },
  { id: 'bs', soon: true },
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
  const t = useT()
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
      // Число отчётов согласуется по форме множественного числа: русскому нужны
      // «1 отчёт / 2 отчёта / 5 отчётов», английскому — one/other.
      dds: {
        value: counts.dds === undefined ? '—' : String(counts.dds),
        label: t.p('chooser.stat.reports', counts.dds ?? 0),
      },
      pl: { value: '—', label: t('chooser.stat.soon') },
      bs: { value: '—', label: t('chooser.stat.soon') },
    }
    : {
      dds: { value: formatMoney(totalBalance), label: t('chooser.stat.balance', { currency: moneySuffix() }) },
      pl: { value: netProfit === null ? '—' : formatMoney(netProfit), label: t('chooser.stat.soon') },
      bs: { value: '—', label: t('chooser.stat.soon') },
    }

  return (
    <div className="chooser">
      <header className="chooser__top">
        <div className="chooser__brand">
          <FinloMark className="chooser__logo" />
          <div>
            <div className="chooser__hello">{t('chooser.hello', { name: username })}</div>
            <h1 className="chooser__title">{t('chooser.title')}</h1>
          </div>
        </div>
        <div className="chooser__who">
          <LangSwitch />
          <ProfileBadge name={username} photoUrl={photoUrl} />
          {isAdmin && onOpenAdmin && (
            <button className="btn" onClick={onOpenAdmin}>{t('chooser.admin')}</button>
          )}
          {onLogout && <button className="btn" onClick={onLogout}>{t('app.logout')}</button>}
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
              <span className="modcard__eyebrow">{t(`chooser.module.${m.id}.eyebrow`)}</span>
              {m.soon && <span className="modcard__badge">{t('chooser.soon')}</span>}
            </div>
            <div className="modcard__title">{t(`chooser.module.${m.id}.title`)}</div>
            <div className="modcard__desc">{t(`chooser.module.${m.id}.desc`)}</div>
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
