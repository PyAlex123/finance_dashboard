// Выбор хранилища для рабочей области. Определяется переменной окружения Vite
// VITE_API_URL: задана — серверный режим (общий бэкенд), пусто — локальный IndexedDB.
//
// В серверном режиме у пользователя может быть НЕСКОЛЬКО отчётов одного типа. Тело
// каждого отчёта — отдельный снимок под ключом reports.id (owner:form:<rand>). Поэтому
// вход (connectTelegram/connectBackend) больше не подключает снимок сразу — он лишь
// запоминает сессию (владелец + токен), а конкретный отчёт подключает connectReport
// (его зовёт переключатель отчётов ReportSwitcher).

import { store } from '../store'
import { clearSession, loadSession, saveSession } from '../features/session/authSession'
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

/** Ответ любого из эндпоинтов входа (Web App, бот, Google) — форма одна. */
interface SessionResponse {
  token: string
  workspace: string
  name: string
  photoUrl?: string | null
  username?: string | null
  isAdmin?: boolean
}

/**
 * Запомнить выданную сервером сессию и вернуть профиль для UI. Кладём её и в
 * localStorage — иначе перезагрузка страницы выкидывала бы на экран входа.
 */
function rememberSession(body: SessionResponse): TelegramSession {
  session = { owner: body.workspace, token: body.token }
  const profile: TelegramSession = {
    name: body.name,
    workspace: body.workspace,
    isAdmin: !!body.isAdmin,
    photoUrl: body.photoUrl ?? undefined,
    username: body.username ?? undefined,
  }
  saveSession({ token: body.token, ...profile })
  return profile
}

/** Профиль по Bearer. null — токен не принят сервером. */
async function fetchMe(token: string): Promise<TelegramSession | null> {
  const res = await fetch(`${API_URL.replace(/\/+$/, '')}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const body = (await res.json()) as Omit<SessionResponse, 'token'>
  return rememberSession({ ...body, token })
}

/**
 * Вход по токену, приехавшему из бота (ссылка consume вернула его во фрагменте).
 * Профиль спрашиваем у сервера — заодно это проверка, что токен настоящий.
 */
export async function connectWithToken(token: string): Promise<TelegramSession | null> {
  if (!REMOTE || !token) return null
  try {
    return await fetchMe(token)
  } catch {
    return null
  }
}

/**
 * Поднять сохранённую сессию при загрузке страницы. Токен заодно проверяется на
 * сервере (/auth/me): протух или сменился секрет — чистим хранилище и просим войти.
 */
export async function restoreSession(): Promise<TelegramSession | null> {
  const stored = loadSession()
  if (!REMOTE || !stored) return null
  session = { owner: stored.workspace, token: stored.token }
  try {
    const res = await fetch(`${API_URL.replace(/\/+$/, '')}/api/auth/me`, {
      headers: { Authorization: `Bearer ${stored.token}` },
    })
    if (res.status === 401 || res.status === 403) {
      disconnectBackend()
      return null
    }
    if (!res.ok) {
      // Сервер недоступен — доверяем сохранённому профилю, данные всё равно
      // подхватятся из локального зеркала (resilientRepo).
      return { ...stored, isAdmin: !!stored.isAdmin }
    }
    const body = (await res.json()) as Omit<SessionResponse, 'token'>
    return rememberSession({ ...body, token: stored.token })
  } catch {
    return { ...stored, isAdmin: !!stored.isAdmin }
  }
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
    return rememberSession((await res.json()) as SessionResponse)
  } catch {
    return null
  }
}

/** Вход через Google: ID-токен от кнопки Google проверяет сервер. */
export async function connectGoogle(credential: string): Promise<TelegramSession | null> {
  if (!REMOTE) return null
  try {
    const res = await fetch(`${API_URL.replace(/\/+$/, '')}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    })
    if (!res.ok) return null
    return rememberSession((await res.json()) as SessionResponse)
  } catch {
    return null
  }
}

/** Публичная конфигурация входа с сервера (что настроено — то и показываем). */
export interface PublicConfig {
  telegramBot: string
  googleClientId: string
  googleEnabled: boolean
}

export async function fetchPublicConfig(): Promise<PublicConfig | null> {
  if (!REMOTE) return null
  try {
    const res = await fetch(`${API_URL.replace(/\/+$/, '')}/api/config`)
    if (!res.ok) return null
    return (await res.json()) as PublicConfig
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
  clearSession()
  if (!REMOTE) return
  disconnectWorkspace()
}
