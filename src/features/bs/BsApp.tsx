import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectData } from '../../store/selectors'
import { clearForm, setCellValue, seedItems } from '../../store/dataSlice'
import { buildBsExample } from '../../data/bsExample'
import BsReport from './BsReport'
import TemplateEditor from '../template/TemplateEditor'
import ProfileBadge from '../session/ProfileBadge'
import ReportSwitcher from '../reports/ReportSwitcher'
import LangSwitch from '../ui/LangSwitch'
import { REMOTE } from '../../data/backend'
import { useT } from '../../i18n/react'
import type { Key } from '../../i18n'
import type { AppProps } from '../../App'

type Tab = 'report' | 'template'

// Ключи, а не подписи: массив вычисляется при импорте модуля — см. src/App.tsx.
const TABS: { id: Tab; labelKey: Key }[] = [
  { id: 'report', labelKey: 'bs.tab.report' },
  { id: 'template', labelKey: 'app.tab.template' },
]

// Рабочая область «Баланс» (по образцу P&L). Снимок на дату; несколько отчётов
// одного типа переключаются сверху (ReportSwitcher).
export default function BsApp({ username, photoUrl, onBack, onLogout }: AppProps = {}) {
  const t = useT()
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
            <button className="btn btn--small app__back" onClick={onBack} title={t('app.back.title')}>{t('app.back')}</button>
          )}
          <div>
            <h1 className="app__title">{t('bs.title')}</h1>
            <p className="app__subtitle">{t('bs.subtitle')}</p>
          </div>
        </div>
        <div className="app__headright">
          <div className="datamenu">
            <button className="btn btn--small" onClick={loadExample}>{t('common.loadExample')}</button>
            {hasBs && (
              <button
                className="btn btn--small"
                onClick={() => { if (confirm(t('bs.clear.confirm'))) dispatch(clearForm('bs')) }}
              >
                {t('bs.clear')}
              </button>
            )}
          </div>
          <LangSwitch />
          {username && <ProfileBadge name={username} photoUrl={photoUrl} />}
          {onLogout && <button className="btn btn--small" onClick={onLogout}>{t('app.logout')}</button>}
        </div>
      </header>

      {REMOTE && (
        <div className="app__reportbar">
          <ReportSwitcher form="bs" defaultName={t('seed.report.defaultName.bs')} />
        </div>
      )}

      <nav className="tabs">
        {TABS.map((tab_) => (
          <button key={tab_.id} className={`tab ${tab === tab_.id ? 'tab--active' : ''}`} onClick={() => setTab(tab_.id)}>
            {t(tab_.labelKey)}
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
