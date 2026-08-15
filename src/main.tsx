import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import './index.css'
import { store } from './store'
import { bindLocaleToStore } from './store/bindLocale'
import { subscribeLocale } from './i18n/locale'
import { applyDocumentLocale } from './i18n/documentMeta'
import { initPersistence } from './data/persistence'
import { createIdbRepo } from './data/idbRepo'
import { REMOTE } from './data/backend'
import { ToastProvider } from './features/ui/Toast'
import Shell from './Shell.tsx'

// Язык уже определён (i18n/locale.ts делает это в теле модуля, до создания фикстур).
// Здесь только подписки: смена языка → действие в сторе и обновление мета-тегов.
bindLocaleToStore(store)
subscribeLocale(applyDocumentLocale)
applyDocumentLocale()

// Локальный режим — грузим IndexedDB сразу. Серверный режим — данные подключаются
// после входа (Shell → connectBackend), пространство зависит от имени пользователя.
if (!REMOTE) void initPersistence(store, createIdbRepo())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </Provider>
  </StrictMode>,
)
