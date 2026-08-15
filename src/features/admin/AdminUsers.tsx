import { useEffect, useState } from 'react'
import { listUsers, type AdminUsers as AdminUsersData } from '../../data/admin'
import { formatDateTime } from '../../i18n/format'
import { useT } from '../../i18n/react'

// Экран администратора: сколько зарегистрировано и кто (ник ТГ, имя, даты).
export default function AdminUsers({ onBack }: { onBack: () => void }) {
  const t = useT()
  const [data, setData] = useState<AdminUsersData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    listUsers()
      .then((d) => { if (!cancelled) setData(d) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) })
    return () => { cancelled = true }
  }, [])

  const fmt = (iso: string | null) => (iso ? formatDateTime(iso) : t('common.dash'))

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__headleft">
          <button className="btn btn--small app__back" onClick={onBack} title={t('admin.back.title')}>{t('app.back')}</button>
          <div>
            <h1 className="app__title">{t('admin.title')}</h1>
            <p className="app__subtitle">
              {data ? t('admin.total', { count: data.count }) : t('admin.loading')}
            </p>
          </div>
        </div>
      </header>

      <main className="app__content">
        {error && <div className="report__error">{t('admin.error', { message: error })}</div>}
        {data && data.count === 0 && <p className="empty-state__text">{t('admin.empty')}</p>}
        {data && data.count > 0 && (
          <table className="report__table">
            <thead>
              <tr>
                <th className="report__name-col">{t('admin.col.user')}</th>
                <th>{t('admin.col.telegram')}</th>
                <th>Telegram ID</th>
                <th>{t('admin.col.registered')}</th>
                <th>{t('admin.col.lastSeen')}</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => {
                const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || t('common.dash')
                const tgId = u.tgId.replace(/^tg:/, '')
                return (
                  <tr key={u.tgId} className="report__row">
                    <td className="report__name">{name}</td>
                    <td>{u.username ? `@${u.username}` : t('common.dash')}</td>
                    <td>{tgId}</td>
                    <td>{fmt(u.createdAt)}</td>
                    <td>{fmt(u.lastSeen)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </main>
    </div>
  )
}
