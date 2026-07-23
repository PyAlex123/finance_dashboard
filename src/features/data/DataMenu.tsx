import { useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectData } from '../../store/selectors'
import { hydrate } from '../../store/dataSlice'
import { exportJson, importJson } from '../../data/json'
import { exportXlsx, importXlsx } from '../../data/xlsx'
import { buildFixtureSnapshot, buildEmptySnapshot } from '../../data/fixtures'

export default function DataMenu() {
  const dispatch = useAppDispatch()
  const data = useAppSelector(selectData)
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

  function download(bytes: BlobPart, name: string, mime: string) {
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  const stamp = () => new Date().toISOString().slice(0, 10)

  function doExportJson() {
    download(exportJson(data), `dds-${stamp()}.json`, 'application/json')
  }
  function doExportXlsx() {
    download(
      exportXlsx(data),
      `dds-${stamp()}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
  }

  async function doImport(file: File) {
    try {
      const snapshot = file.name.toLowerCase().endsWith('.xlsx')
        ? importXlsx(await file.arrayBuffer())
        : importJson(await file.text())
      dispatch(hydrate(snapshot))
      setMsg('Импортировано ✓')
    } catch (e) {
      setMsg('Ошибка импорта: ' + (e instanceof Error ? e.message : String(e)))
    }
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div className="datamenu">
      <button className="btn btn--small" onClick={doExportXlsx}>Экспорт Excel</button>
      <button className="btn btn--small" onClick={doExportJson}>Экспорт JSON</button>
      <button className="btn btn--small" onClick={() => fileRef.current?.click()}>Импорт файла</button>
      <button
        className="btn btn--small"
        onClick={() => {
          if (confirm('Загрузить учебный пример (янв–март)? Текущие данные будут заменены.')) {
            dispatch(hydrate(buildFixtureSnapshot()))
          }
        }}
      >
        Загрузить пример
      </button>
      <button
        className="btn btn--small"
        onClick={() => {
          if (confirm('Очистить всё до чистого листа? Текущие данные будут удалены.')) {
            dispatch(hydrate(buildEmptySnapshot()))
          }
        }}
      >
        Чистый лист
      </button>
      {msg && <span className="datamenu__msg">{msg}</span>}
      <input
        ref={fileRef}
        type="file"
        accept=".json,.xlsx,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
