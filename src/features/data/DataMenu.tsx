import { useRef, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectData } from '../../store/selectors'
import { hydrate } from '../../store/dataSlice'
import { exportJson, importJson } from '../../data/json'
import { exportXlsx, importXlsx } from '../../data/xlsx'
import { buildFixtureSnapshot, buildEmptySnapshot } from '../../data/fixtures'
import ImportWizard from '../import/ImportWizard'
import { useToast } from '../ui/Toast'

export default function DataMenu({
  open, onToggle, onClose,
}: {
  open: boolean
  onToggle: () => void
  onClose: () => void
}) {
  const dispatch = useAppDispatch()
  const data = useAppSelector(selectData)
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')
  const [wizardBuf, setWizardBuf] = useState<ArrayBuffer | null>(null)

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
    toast('Экспорт JSON — готово')
  }
  function doExportXlsx() {
    download(
      exportXlsx(data),
      `dds-${stamp()}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    toast('Экспорт Excel — готово')
  }

  async function doImport(file: File) {
    try {
      if (file.name.toLowerCase().endsWith('.xlsx')) {
        const buf = await file.arrayBuffer()
        try {
          // свой файл (со скрытым листом «Данные») — грузим напрямую
          dispatch(hydrate(importXlsx(buf)))
          setMsg('Импортировано ✓')
        } catch {
          // произвольный Excel — открываем мастер сопоставления
          setWizardBuf(buf)
        }
      } else {
        dispatch(hydrate(importJson(await file.text())))
        setMsg('Импортировано ✓')
      }
    } catch (e) {
      setMsg('Ошибка импорта: ' + (e instanceof Error ? e.message : String(e)))
    }
    setTimeout(() => setMsg(''), 3000)
  }

  const actions: { label: string; onClick: () => void }[] = [
    { label: 'Экспорт Excel', onClick: doExportXlsx },
    { label: 'Экспорт JSON', onClick: doExportJson },
    { label: 'Импорт (JSON / Excel)', onClick: () => fileRef.current?.click() },
    {
      label: 'Загрузить пример',
      onClick: () => {
        if (confirm('Загрузить учебный пример (янв–март)? Текущие данные будут заменены.')) {
          dispatch(hydrate(buildFixtureSnapshot()))
          toast('Учебный пример загружен')
        }
      },
    },
    {
      label: 'Чистый лист',
      onClick: () => {
        if (confirm('Очистить всё до чистого листа? Текущие данные будут удалены.')) {
          dispatch(hydrate(buildEmptySnapshot()))
          toast('Чистый лист готов')
        }
      },
    },
  ]

  return (
    <div className="datamenu">
      <button className="btn datamenu__trigger" onClick={onToggle}>
        <span className="datamenu__dots">⋯</span>Данные
      </button>
      {open && (
        <div className="datamenu__panel">
          {actions.map((a) => (
            <button
              key={a.label}
              className="datamenu__item"
              onClick={() => { onClose(); a.onClick() }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
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
      {wizardBuf && <ImportWizard buf={wizardBuf} onClose={() => setWizardBuf(null)} />}
    </div>
  )
}
