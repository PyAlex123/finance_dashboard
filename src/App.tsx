import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from './store/hooks'
import { selectAccounts } from './store/selectors'
import { ensureDefaultAccounts } from './store/dataSlice'
import JournalPanel from './features/journal/JournalPanel'
import ReportView from './features/report/ReportView'
import RefsView from './features/refs/RefsView'
import TemplateEditor from './features/template/TemplateEditor'
import DataMenu from './features/data/DataMenu'

type Tab = 'journal' | 'report' | 'template' | 'refs'

const TABS: { id: Tab; label: string }[] = [
  { id: 'journal', label: 'Журнал' },
  { id: 'report', label: 'Отчёт ДДС' },
  { id: 'template', label: 'Шаблон' },
  { id: 'refs', label: 'Справочники' },
]

export interface AppProps {
  username?: string
  onBack?: () => void
  onLogout?: () => void
}

// Рабочая область ДДС (вкладки). Оборачивается Shell (вход/выбор модуля).
export default function App({ username, onBack, onLogout }: AppProps = {}) {
  const [tab, setTab] = useState<Tab>('journal')
  const dispatch = useAppDispatch()
  const accounts = useAppSelector(selectAccounts)

  // ДДС всегда открывается со счетами по умолчанию (Р/С, Наличные, Карта),
  // даже если сохранённый ранее снимок был без счетов.
  useEffect(() => {
    if (accounts.length === 0) dispatch(ensureDefaultAccounts())
  }, [accounts.length, dispatch])

  return (
    <div className="app">
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
          <DataMenu />
          {username && <span className="app__user">👤 {username}</span>}
          {onLogout && <button className="btn btn--small" onClick={onLogout}>Выйти</button>}
        </div>
      </header>

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

      <main className="app__content">
        {tab === 'journal' && <JournalPanel />}
        {tab === 'report' && <ReportView />}
        {tab === 'template' && <TemplateEditor />}
        {tab === 'refs' && <RefsView />}
      </main>
    </div>
  )
}
