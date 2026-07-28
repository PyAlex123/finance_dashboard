import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReportForm } from '../../domain/types'
import { connectReport, getSession } from '../../data/backend'
import {
  createReport, deleteReport, listReports, renameReport, type ReportMeta,
} from '../../data/reports'

// Переключатель отчётов внутри модуля (серверный режим). У пользователя может быть
// несколько отчётов одного типа; тело каждого — свой снимок. Компонент грузит список
// и подключает выбранный (connectReport). Если отчётов ещё нет — создаёт первый, чтобы
// всегда был приёмник автосохранения.
export default function ReportSwitcher({
  form,
  defaultName = 'Новый отчёт',
  onAfterConnect,
}: {
  form: ReportForm
  defaultName?: string
  onAfterConnect?: () => void
}) {
  const [list, setList] = useState<ReportMeta[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Свежая ссылка на колбэк, чтобы эффект инициализации выполнился один раз.
  const cb = useRef({ onAfterConnect })
  cb.current = { onAfterConnect }

  const activate = useCallback(async (id: string | null) => {
    if (id) {
      await connectReport(id)
      cb.current.onAfterConnect?.()
    }
    setActiveId(id)
  }, [])

  const reload = useCallback(async (): Promise<ReportMeta[]> => {
    const items = await listReports(form)
    setList(items)
    return items
  }, [form])

  // Инициализация: загрузить список; подключить первый отчёт, а если их нет и есть
  // активная сессия — создать первый (чтобы данные было куда сохранять).
  useEffect(() => {
    let cancelled = false
    async function init() {
      setBusy(true)
      setError(null)
      try {
        let items = await reload()
        if (cancelled) return
        if (items.length === 0 && getSession()) {
          const meta = await createReport(form, defaultName)
          if (cancelled) return
          items = await reload()
          await activate(meta.id)
        } else {
          await activate(items[0]?.id ?? null)
        }
      } catch (e) {
        if (!cancelled) {
          setError('Не удалось загрузить отчёты')
          console.warn(e)
        }
      } finally {
        if (!cancelled) setBusy(false)
      }
    }
    void init()
    return () => { cancelled = true }
  }, [reload, activate, form, defaultName])

  async function onCreate() {
    const name = window.prompt('Название нового отчёта:', defaultName)?.trim()
    if (!name) return
    setBusy(true)
    try {
      const meta = await createReport(form, name)
      await reload()
      await activate(meta.id)
    } catch (e) {
      setError('Не удалось создать отчёт')
      console.warn(e)
    } finally {
      setBusy(false)
    }
  }

  async function onRename() {
    if (!activeId) return
    const current = list.find((r) => r.id === activeId)?.name ?? ''
    const name = window.prompt('Новое название отчёта:', current)?.trim()
    if (!name || name === current) return
    try {
      await renameReport(activeId, name)
      await reload()
    } catch (e) {
      setError('Не удалось переименовать')
      console.warn(e)
    }
  }

  async function onDelete() {
    if (!activeId) return
    const current = list.find((r) => r.id === activeId)?.name ?? 'отчёт'
    if (!window.confirm(`Удалить отчёт «${current}» вместе с данными?`)) return
    setBusy(true)
    try {
      await deleteReport(activeId)
      const items = await reload()
      await activate(items[0]?.id ?? null)
    } catch (e) {
      setError('Не удалось удалить')
      console.warn(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rswitch">
      <span className="rswitch__label">Отчёт:</span>
      {list.length > 0 && (
        <select
          className="rswitch__select"
          value={activeId ?? ''}
          disabled={busy}
          onChange={(e) => void activate(e.target.value || null)}
        >
          {list.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      )}
      {activeId && (
        <>
          <button className="btn btn--small" title="Переименовать" disabled={busy} onClick={onRename}>✎</button>
          <button className="btn btn--small" title="Удалить" disabled={busy} onClick={onDelete}>🗑</button>
        </>
      )}
      <button className="btn btn--small" disabled={busy} onClick={onCreate}>+ Новый</button>
      {error && <span className="rswitch__error" title={error}>⚠</span>}
    </div>
  )
}
