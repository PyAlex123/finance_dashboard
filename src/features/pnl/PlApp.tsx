import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectData } from '../../store/selectors'
import { clearForm, setCellValue, seedItems } from '../../store/dataSlice'
import { buildPlExample } from '../../data/plExample'
import PlReport from './PlReport'
import TemplateEditor from '../template/TemplateEditor'
import type { AppProps } from '../../App'

type Tab = 'report' | 'template'

const TABS: { id: Tab; label: string }[] = [
  { id: 'report', label: 'Отчёт P&L' },
  { id: 'template', label: 'Шаблон' },
]

export default function PlApp({ username, onBack, onLogout }: AppProps = {}) {
  const dispatch = useAppDispatch()
  const data = useAppSelector(selectData)
  const [tab, setTab] = useState<Tab>('report')
  const hasPl = data.items.some((i) => i.form === 'pl')

  function loadExample() {
    dispatch(clearForm('pl'))
    const ex = buildPlExample()
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
            <h1 className="app__title">P&L — прибыли и убытки</h1>
            <p className="app__subtitle">Отчёт по начислению</p>
          </div>
        </div>
        <div className="app__headright">
          <div className="datamenu">
            <button className="btn btn--small" onClick={loadExample}>Загрузить пример</button>
            {hasPl && (
              <button
                className="btn btn--small"
                onClick={() => { if (confirm('Очистить P&L до чистого листа?')) dispatch(clearForm('pl')) }}
              >
                Очистить P&L
              </button>
            )}
          </div>
          {username && <span className="app__user">👤 {username}</span>}
          {onLogout && <button className="btn btn--small" onClick={onLogout}>Выйти</button>}
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'tab--active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="app__content">
        {tab === 'report' && <PlReport />}
        {tab === 'template' && <TemplateEditor form="pl" />}
      </main>
    </div>
  )
}
