import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import './index.css'
import { store } from './store'
import { initPersistence } from './data/persistence'
import { createIdbRepo } from './data/idbRepo'
import { REMOTE } from './data/backend'
import Shell from './Shell.tsx'

// Локальный режим — грузим IndexedDB сразу. Серверный режим — данные подключаются
// после входа (Shell → connectBackend), пространство зависит от имени пользователя.
if (!REMOTE) void initPersistence(store, createIdbRepo())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <Shell />
    </Provider>
  </StrictMode>,
)
