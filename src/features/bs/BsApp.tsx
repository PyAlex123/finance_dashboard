import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectData } from '../../store/selectors'
import { clearForm, setCellValue, seedItems } from '../../store/dataSlice'
import { buildBsExample } from '../../data/bsExample'
import BsReport from './BsReport'
import TemplateEditor from '../template/TemplateEditor'
import ProfileBadge from '../session/ProfileBadge'
import ReportSwitcher from '../reports/ReportSwitcher'
import { REMOTE } from '../../data/backend'
import type { AppProps } from '../../App'

type Tab = 'report' | 'template'

const TABS: { id: Tab; label: string }[] = [
  { id: 'report', label: 'Баланс' },
  { id: 'template', label: 'Шаблон' },
]

// Рабочая область «Баланс» (по образцу P&L). Снимок на дату; несколько отчётов
// одного типа переключаются сверху (ReportSwitcher).
export default function BsApp({ username, photoUrl, onBack, onLogout }: AppProps = {}) {
  const dispatch = useAppDispatch()
  const data = useAppSelector(selectData)
  const [tab, setTab] = useState<Tab>('report')
  const hasBs = data.items.some((i) => i.form === 'bs')

  function loadExample() {
    dispatch(clearForm('bs'))
    const ex = buildBsExample()
    dispatch(seedItems({ items: ex.items, periods: ex.periods }))
    for (const cv of ex.cellValues) dispatch(setCellValue(cv))
  }

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__headleft">
          {onBack && (
            <button className="btn btn--small app__back" onClick={onBack} title="К выбору отчёта">← Модули</button>
          )}
          <div>
            <h1 className="app__title">Баланс — активы и обязательства</h1>
            <p className="app__subtitle">Снимок на дату</p>
          </div>
        </div>
        <div className="app__headright">
          <div className="datamenu">
            <button className="btn btn--small" onClick={loadExample}>Загрузить пример</button>
            {hasBs && (
              <button
                className="btn btn--small"
                onClick={() => { if (confirm('Очистить баланс до чистого листа?')) dispatch(clearForm('bs')) }}
              >
                Очистить баланс
              </button>
            )}
          </div>
          {username && <ProfileBadge name={username} photoUrl={photoUrl} />}
          {onLogout && <button className="btn btn--small" onClick={onLogout}>Выйти</button>}
        </div>
      </header>

      {REMOTE && (
        <div className="app__reportbar">
          <ReportSwitcher form="bs" defaultName="Баланс" />
        </div>
      )}

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'tab--active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="app__content">
        {tab === 'report' && <BsReport />}
        {tab === 'template' && <TemplateEditor form="bs" />}
      </main>
    </div>
  )
}
