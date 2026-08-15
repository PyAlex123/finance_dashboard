import { useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectData } from '../../store/selectors'
import { clearForm, setCellValue, seedItems } from '../../store/dataSlice'
import { buildPlExample } from '../../data/plExample'
import PlReport from './PlReport'
import TemplateEditor from '../template/TemplateEditor'
import ImportWizard from '../import/ImportWizard'
import LangSwitch from '../ui/LangSwitch'
import { useT } from '../../i18n/react'
import type { Key } from '../../i18n'
import type { AppProps } from '../../App'

type Tab = 'report' | 'template'

// Ключи, а не подписи: массив вычисляется при импорте модуля — см. src/App.tsx.
const TABS: { id: Tab; labelKey: Key }[] = [
  { id: 'report', labelKey: 'pl.tab.report' },
  { id: 'template', labelKey: 'app.tab.template' },
]

export default function PlApp({ username, onBack, onLogout }: AppProps = {}) {
  const t = useT()
  const dispatch = useAppDispatch()
  const data = useAppSelector(selectData)
  const [tab, setTab] = useState<Tab>('report')
  const fileRef = useRef<HTMLInputElement>(null)
  const [wizardBuf, setWizardBuf] = useState<ArrayBuffer | null>(null)
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
            <button className="btn btn--small app__back" onClick={onBack} title={t('app.back.title')}>{t('app.back')}</button>
          )}
          <div>
            <h1 className="app__title">{t('app.title.pl')}</h1>
            <p className="app__subtitle">{t('pl.subtitle')}</p>
          </div>
        </div>
        <div className="app__headright">
          <div className="datamenu">
            <button className="btn btn--small" onClick={() => fileRef.current?.click()}>{t('pl.import')}</button>
            <button className="btn btn--small" onClick={loadExample}>{t('common.loadExample')}</button>
            {hasPl && (
              <button
                className="btn btn--small"
                onClick={() => { if (confirm(t('pl.clear.confirm'))) dispatch(clearForm('pl')) }}
              >
                {t('pl.clear')}
              </button>
            )}
          </div>
          <LangSwitch />
          {username && <span className="app__user">👤 {username}</span>}
          {onLogout && <button className="btn btn--small" onClick={onLogout}>{t('app.logout')}</button>}
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((tab_) => (
          <button key={tab_.id} className={`tab ${tab === tab_.id ? 'tab--active' : ''}`} onClick={() => setTab(tab_.id)}>
            {t(tab_.labelKey)}
          </button>
        ))}
      </nav>

      <main className="app__content">
        {tab === 'report' && <PlReport />}
        {tab === 'template' && <TemplateEditor form="pl" />}
      </main>

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (f) setWizardBuf(await f.arrayBuffer())
          e.target.value = ''
        }}
      />
      {wizardBuf && <ImportWizard buf={wizardBuf} onClose={() => setWizardBuf(null)} />}
    </div>
  )
}
