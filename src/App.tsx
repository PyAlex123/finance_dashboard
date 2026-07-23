import { useState } from 'react'
import JournalPanel from './features/journal/JournalPanel'
import ReportView from './features/report/ReportView'
import RefsView from './features/refs/RefsView'

type Tab = 'journal' | 'report' | 'refs'

const TABS: { id: Tab; label: string }[] = [
  { id: 'journal', label: 'Журнал' },
  { id: 'report', label: 'Отчёт ДДС' },
  { id: 'refs', label: 'Справочники' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('journal')

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Финансовые отчёты — ДДС</h1>
        <p className="app__subtitle">Учебный проект · январь–март 2025</p>
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
        {tab === 'refs' && <RefsView />}
      </main>
    </div>
  )
}
