import { useEffect, useState } from 'react'
import { useAppDispatch } from './store/hooks'
import { ensureDefaultAccounts } from './store/dataSlice'
import JournalPanel from './features/journal/JournalPanel'
import ReportView from './features/report/ReportView'
import DashboardView from './features/dashboard/DashboardView'
import RefsView from './features/refs/RefsView'
import TemplateEditor from './features/template/TemplateEditor'
import DataMenu from './features/data/DataMenu'
import ProfileBadge from './features/session/ProfileBadge'
import ReportSwitcher from './features/reports/ReportSwitcher'
import { REMOTE, getSession } from './data/backend'
import { useConnectivity } from './data/connectivity'

type Tab = 'journal' | 'report' | 'dashboard' | 'template' | 'refs'

const TABS: { id: Tab; label: string }[] = [
  { id: 'journal', label: 'Журнал' },
  { id: 'report', label: 'Отчёт ДДС' },
  { id: 'dashboard', label: 'Дашборд' },
  { id: 'template', label: 'Шаблон' },
  { id: 'refs', label: 'Справочники' },
]

export interface AppProps {
  username?: string
  photoUrl?: string
  onBack?: () => void
  onLogout?: () => void
}

// Рабочая область ДДС (вкладки). Оборачивается Shell (вход/выбор модуля).
export default function App({ username, photoUrl, onBack, onLogout }: AppProps = {}) {
  const [tab, setTab] = useState<Tab>('journal')
  const [dataMenuOpen, setDataMenuOpen] = useState(false)
  const dispatch = useAppDispatch()
  const online = useConnectivity() === 'online'

  // Недостающие счета по умолчанию (Р/С, Наличные, Карта). В серверном режиме сеем
  // ПОСЛЕ подключения отчёта (onAfterConnect) — иначе правка на монтировании могла бы
  // уйти автосейвом в предыдущий (ещё активный) отчёт. Без сессии (локальный режим/
  // тесты) отчётов нет — сеем сразу при монтировании.
  useEffect(() => {
    if (!getSession()) dispatch(ensureDefaultAccounts())
  }, [dispatch])

  return (
    <div className="app">
      <div className="topbar">
        <header className="app__header">
          <div className="app__headleft">
            {onBack && (
              <button className="btn btn--small app__back" onClick={onBack} title="К выбору отчёта">
                ← Модули
              </button>
            )}
            <div>
              <h1 className="app__title">ДДС — движение денежных средств</h1>
              <p className="app__subtitle">Рабочая область</p>
            </div>
          </div>
          <div className="app__headright">
            {REMOTE && !online && (
              <span className="offline-pill" title="Сервер недоступен — данные сохраняются локально">
                ● офлайн
              </span>
            )}
            <DataMenu
              open={dataMenuOpen}
              onToggle={() => setDataMenuOpen((v) => !v)}
              onClose={() => setDataMenuOpen(false)}
            />
            {username && <ProfileBadge name={username} photoUrl={photoUrl} />}
            {onLogout && <button className="btn btn--small" onClick={onLogout}>Выйти</button>}
          </div>
        </header>

        {REMOTE && (
          <div className="app__reportbar">
            <ReportSwitcher
              form="cf"
              defaultName="Отчёт ДДС"
              onAfterConnect={() => dispatch(ensureDefaultAccounts())}
            />
          </div>
        )}

        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? 'tab--active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <main className="app__content">
        {tab === 'journal' && <JournalPanel />}
        {tab === 'report' && <ReportView />}
        {tab === 'dashboard' && <DashboardView />}
        {tab === 'template' && <TemplateEditor />}
        {tab === 'refs' && <RefsView />}
      </main>
    </div>
  )
}
