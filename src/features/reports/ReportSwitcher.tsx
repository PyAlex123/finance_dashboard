import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReportForm } from '../../domain/types'
import { connectReport, getSession } from '../../data/backend'
import {
  createReport, deleteReport, listReports, renameReport, type ReportMeta,
} from '../../data/reports'
import { useT } from '../../i18n/react'
import { t as translate } from '../../i18n'

// Переключатель отчётов внутри модуля (серверный режим). У пользователя может быть
// несколько отчётов одного типа; тело каждого — свой снимок. Компонент грузит список
// и подключает выбранный (connectReport). Если отчётов ещё нет — создаёт первый, чтобы
// всегда был приёмник автосохранения.
export default function ReportSwitcher({
  form,
  defaultName,
  onAfterConnect,
}: {
  form: ReportForm
  defaultName?: string
  onAfterConnect?: () => void
}) {
  const t = useT()
  // Имя нового отчёта уходит на сервер обычной строкой, то есть замерзает на
  // языке, активном в момент создания (решение «локализуем при создании»).
  const fallbackName = defaultName ?? translate('rswitch.defaultName')
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
          const meta = await createReport(form, fallbackName)
          if (cancelled) return
          items = await reload()
          await activate(meta.id)
        } else {
          await activate(items[0]?.id ?? null)
        }
      } catch (e) {
        if (!cancelled) {
          setError(t('rswitch.error.load'))
          console.warn(e)
        }
      } finally {
        if (!cancelled) setBusy(false)
      }
    }
    void init()
    return () => { cancelled = true }
  }, [reload, activate, form, fallbackName])

  async function onCreate() {
    const name = window.prompt(t('rswitch.create.prompt'), fallbackName)?.trim()
    if (!name) return
    setBusy(true)
    try {
      const meta = await createReport(form, name)
      await reload()
      await activate(meta.id)
    } catch (e) {
      setError(t('rswitch.error.create'))
      console.warn(e)
    } finally {
      setBusy(false)
    }
  }

  async function onRename() {
    if (!activeId) return
    const current = list.find((r) => r.id === activeId)?.name ?? ''
    const name = window.prompt(t('rswitch.rename.prompt'), current)?.trim()
    if (!name || name === current) return
    try {
      await renameReport(activeId, name)
      await reload()
    } catch (e) {
      setError(t('rswitch.error.rename'))
      console.warn(e)
    }
  }

  async function onDelete() {
    if (!activeId) return
    const current = list.find((r) => r.id === activeId)?.name ?? t('rswitch.delete.fallbackName')
    if (!window.confirm(t('rswitch.delete.confirm', { name: current }))) return
    setBusy(true)
    try {
      await deleteReport(activeId)
      const items = await reload()
      await activate(items[0]?.id ?? null)
    } catch (e) {
      setError(t('rswitch.error.delete'))
      console.warn(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rswitch">
      <span className="rswitch__label">{t('rswitch.label')}</span>
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
          <button className="btn btn--small" title={t('rswitch.rename')} disabled={busy} onClick={onRename}>✎</button>
          <button className="btn btn--small" title={t('rswitch.delete')} disabled={busy} onClick={onDelete}>🗑</button>
        </>
      )}
      <button className="btn btn--small" disabled={busy} onClick={onCreate}>{t('rswitch.new')}</button>
      {error && <span className="rswitch__error" title={error}>⚠</span>}
    </div>
  )
}
