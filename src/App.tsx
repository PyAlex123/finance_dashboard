import { useEffect, useState } from 'react'
import type { Key } from './i18n'
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
import LangSwitch from './features/ui/LangSwitch'
import { useT } from './i18n/react'
import { REMOTE, getSession } from './data/backend'
import { useConnectivity } from './data/connectivity'

type Tab = 'journal' | 'report' | 'dashboard' | 'template' | 'refs'

// Список ключей, а не подписей: массив вычисляется при импорте модуля, и
// готовые строки в нём навсегда застыли бы на языке первого рендера.
const TABS: { id: Tab; labelKey: Key }[] = [
  { id: 'journal', labelKey: 'app.tab.journal' },
  { id: 'report', labelKey: 'app.tab.report' },
  { id: 'dashboard', labelKey: 'app.tab.dashboard' },
  { id: 'template', labelKey: 'app.tab.template' },
  { id: 'refs', labelKey: 'app.tab.refs' },
]

export interface AppProps {
  username?: string
  photoUrl?: string
  onBack?: () => void
  onLogout?: () => void
}

// Рабочая область ДДС (вкладки). Оборачивается Shell (вход/выбор модуля).
export default function App({ username, photoUrl, onBack, onLogout }: AppProps = {}) {
  const t = useT()
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
              <button className="btn btn--small app__back" onClick={onBack} title={t('app.back.title')}>
                {t('app.back')}
              </button>
            )}
            <div>
              <h1 className="app__title">{t('app.title.cf')}</h1>
              <p className="app__subtitle">{t('app.subtitle')}</p>
            </div>
          </div>
          <div className="app__headright">
            {REMOTE && !online && (
              <span className="offline-pill" title={t('app.offline.title')}>
                {t('app.offline')}
              </span>
            )}
            <DataMenu
              open={dataMenuOpen}
              onToggle={() => setDataMenuOpen((v) => !v)}
              onClose={() => setDataMenuOpen(false)}
            />
            <LangSwitch />
            {username && <ProfileBadge name={username} photoUrl={photoUrl} />}
            {onLogout && <button className="btn btn--small" onClick={onLogout}>{t('app.logout')}</button>}
          </div>
        </header>

        {REMOTE && (
          <div className="app__reportbar">
            <ReportSwitcher
              form="cf"
              defaultName={t('seed.report.defaultName.cf')}
              onAfterConnect={() => dispatch(ensureDefaultAccounts())}
            />
          </div>
        )}

        <nav className="tabs">
          {TABS.map((tab_) => (
            <button
              key={tab_.id}
              className={`tab ${tab === tab_.id ? 'tab--active' : ''}`}
              onClick={() => setTab(tab_.id)}
            >
              {t(tab_.labelKey)}
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
