// Выбор хранилища для рабочей области. Определяется переменной окружения Vite
// VITE_API_URL: задана — серверный режим (общий бэкенд), пусто — локальный IndexedDB.
//
// В серверном режиме у пользователя может быть НЕСКОЛЬКО отчётов одного типа. Тело
// каждого отчёта — отдельный снимок под ключом reports.id (owner:form:<rand>). Поэтому
// вход (connectTelegram/connectBackend) больше не подключает снимок сразу — он лишь
// запоминает сессию (владелец + токен), а конкретный отчёт подключает connectReport
// (его зовёт переключатель отчётов ReportSwitcher).

import { store } from '../store'
import { connectWorkspace, disconnectWorkspace, flushPendingSave } from './persistence'
import { createApiRepo } from './apiRepo'
import { createIdbRepo } from './idbRepo'
import { createResilientRepo } from './resilientRepo'

export const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined)?.trim() ?? ''
export const REMOTE: boolean = API_URL.length > 0

/** Текущая серверная сессия: владелец (пространство) и токен (для tg:*). */
export interface Session {
  owner: string
  token?: string
}
let session: Session | null = null

/** Активная сессия (для сервиса отчётов и UI). null — не в серверном режиме/не вошли. */
export function getSession(): Session | null {
  return session
}

/**
 * Вход (LAN/локальное имя): запомнить сессию. Снимок подключается позже — по выбору
 * отчёта (connectReport). Токен не нужен (пространства не-tg открыты).
 */
export async function connectBackend(username: string): Promise<void> {
  if (!REMOTE) return
  session = { owner: username }
}

export interface TelegramSession {
  name: string
  workspace: string
  photoUrl?: string
  username?: string
  isAdmin?: boolean
}

/**
 * Вход через Telegram Web App: обменять initData на JWT и запомнить сессию
 * (tg:<id> + токен). Возвращает профиль (имя/фото/ник) для показа сверху, либо null,
 * если не серверный режим, нет initData или сервер отклонил.
 */
export async function connectTelegram(initData: string): Promise<TelegramSession | null> {
  if (!REMOTE || !initData) return null
  try {
    const res = await fetch(`${API_URL.replace(/\/+$/, '')}/api/auth/telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    })
    if (!res.ok) return null
    const { token, workspace, name, photoUrl, username, isAdmin } = (await res.json()) as {
      token: string; workspace: string; name: string
      photoUrl?: string | null; username?: string | null; isAdmin?: boolean
    }
    session = { owner: workspace, token }
    return {
      name, workspace, isAdmin: !!isAdmin,
      photoUrl: photoUrl ?? undefined, username: username ?? undefined,
    }
  } catch {
    return null
  }
}

/**
 * Подключить конкретный отчёт (его снимок) как активное хранилище. Устойчиво:
 * API + локальное зеркало IndexedDB на этот ключ. Перед сменой флашим отложенное
 * сохранение текущего отчёта, чтобы не потерять последние правки.
 */
export async function connectReport(reportId: string): Promise<void> {
  if (!REMOTE || !session) return
  await flushPendingSave()
  const api = createApiRepo(API_URL, reportId, session.token)
  const mirror = createIdbRepo(`snapshot:${reportId}`)
  await connectWorkspace(store, createResilientRepo(api, mirror))
}

/** Выход: в серверном режиме прекратить сохранять и забыть сессию. */
export function disconnectBackend(): void {
  session = null
  if (!REMOTE) return
  disconnectWorkspace()
}
