// Сервис реестра отчётов (серверный режим). У пользователя может быть несколько
// отчётов одного типа; тело каждого — обычный снимок под ключом ReportMeta.id.
// Доступ к чужим tg:*-владельцам закрыт JWT на бэкенде (тот же гвард, что и снимки).

import { API_URL, getSession } from './backend'
import type { ReportForm } from '../domain/types'
import { t } from '../i18n'

export interface ReportMeta {
  id: string
  owner: string
  form: ReportForm
  name: string
  updatedAt: string | null
}

function base(): string {
  return API_URL.replace(/\/+$/, '')
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getSession()?.token
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra }
}

/** Список отчётов текущего пользователя по типу (или все, если form не задан). */
export async function listReports(form?: ReportForm): Promise<ReportMeta[]> {
  const owner = getSession()?.owner
  if (!owner) return []
  const q = new URLSearchParams({ owner })
  if (form) q.set('form', form)
  const res = await fetch(`${base()}/api/reports?${q.toString()}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(t('net.error.reportList', { status: res.status }))
  return (await res.json()) as ReportMeta[]
}

/** Создать новый отчёт (пустой). Возвращает мету с сгенерированным id. */
export async function createReport(form: ReportForm, name: string): Promise<ReportMeta> {
  const owner = getSession()?.owner
  if (!owner) throw new Error(t('net.error.noSession'))
  const res = await fetch(`${base()}/api/reports`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ owner, form, name }),
  })
  if (!res.ok) throw new Error(t('net.error.reportCreate', { status: res.status }))
  return (await res.json()) as ReportMeta
}

/** Переименовать отчёт. */
export async function renameReport(id: string, name: string): Promise<ReportMeta> {
  const res = await fetch(`${base()}/api/reports/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(t('net.error.reportRename', { status: res.status }))
  return (await res.json()) as ReportMeta
}

/** Удалить отчёт вместе с его данными (снимком). */
export async function deleteReport(id: string): Promise<void> {
  const res = await fetch(`${base()}/api/reports/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(t('net.error.reportDelete', { status: res.status }))
}
