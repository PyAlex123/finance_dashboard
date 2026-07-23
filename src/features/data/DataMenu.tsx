import { useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectData } from '../../store/selectors'
import { hydrate } from '../../store/dataSlice'
import { exportJson, importJson } from '../../data/json'
import { buildFixtureSnapshot } from '../../data/fixtures'

export default function DataMenu() {
  const dispatch = useAppDispatch()
  const data = useAppSelector(selectData)
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

  function doExport() {
    const blob = new Blob([exportJson(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dds-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function doImport(file: File) {
    try {
      const snapshot = importJson(await file.text())
      dispatch(hydrate(snapshot))
      setMsg('Импортировано ✓')
    } catch (e) {
      setMsg('Ошибка импорта: ' + (e instanceof Error ? e.message : String(e)))
    }
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div className="datamenu">
      <button className="btn btn--small" onClick={doExport}>Экспорт JSON</button>
      <button className="btn btn--small" onClick={() => fileRef.current?.click()}>Импорт JSON</button>
      <button
        className="btn btn--small"
        onClick={() => {
          if (confirm('Сбросить к учебным данным? Текущие изменения будут потеряны.')) {
            dispatch(hydrate(buildFixtureSnapshot()))
          }
        }}
      >
        Сброс к учебным
      </button>
      {msg && <span className="datamenu__msg">{msg}</span>}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) doImport(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
