import { useEffect, useState } from 'react'
import { listUsers, type AdminUsers as AdminUsersData } from '../../data/admin'

// Экран администратора: сколько зарегистрировано и кто (ник ТГ, имя, даты).
export default function AdminUsers({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<AdminUsersData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    listUsers()
      .then((d) => { if (!cancelled) setData(d) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) })
    return () => { cancelled = true }
  }, [])

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ru') : '—')

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__headleft">
          <button className="btn btn--small app__back" onClick={onBack} title="К выбору модуля">← Модули</button>
          <div>
            <h1 className="app__title">Пользователи</h1>
            <p className="app__subtitle">
              {data ? `Всего зарегистрировано: ${data.count}` : 'Загрузка…'}
            </p>
          </div>
        </div>
      </header>

      <main className="app__content">
        {error && <div className="report__error">Ошибка: {error}</div>}
        {data && data.count === 0 && <p className="empty-state__text">Пока никто не зарегистрирован.</p>}
        {data && data.count > 0 && (
          <table className="report__table">
            <thead>
              <tr>
                <th className="report__name-col">Пользователь</th>
                <th>Ник в Telegram</th>
                <th>Telegram ID</th>
                <th>Регистрация</th>
                <th>Последний вход</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => {
                const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || '—'
                const tgId = u.tgId.replace(/^tg:/, '')
                return (
                  <tr key={u.tgId} className="report__row">
                    <td className="report__name">{name}</td>
                    <td>{u.username ? `@${u.username}` : '—'}</td>
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
