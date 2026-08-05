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

/** Ответ любого из эндпоинтов входа (Web App, бот, Google) — форма одна. */
interface SessionResponse {
  token: string
  workspace: string
  name: string
  photoUrl?: string | null
  username?: string | null
  isAdmin?: boolean
}

/** Запомнить выданную сервером сессию и вернуть профиль для UI. */
function rememberSession(body: SessionResponse): TelegramSession {
  session = { owner: body.workspace, token: body.token }
  return {
    name: body.name,
    workspace: body.workspace,
    isAdmin: !!body.isAdmin,
    photoUrl: body.photoUrl ?? undefined,
    username: body.username ?? undefined,
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

/** Заявка на вход через бота: ссылку открываем, по nonce опрашиваем сервер. */
export interface TelegramLink {
  nonce: string
  url: string
  code: string
  expiresIn: number
}

/** Создать заявку на вход с компьютера (сервер вернёт ссылку t.me/<bot>?start=…). */
export async function startTelegramLink(): Promise<TelegramLink | null> {
  if (!REMOTE) return null
  try {
    const res = await fetch(`${API_URL.replace(/\/+$/, '')}/api/auth/tg-link/start`, {
      method: 'POST',
    })
    if (!res.ok) return null
    return (await res.json()) as TelegramLink
  } catch {
    return null
  }
}

/**
 * Опрос заявки. `pending` — пользователь ещё не подтвердил, `expired` — заявка
 * протухла (или уже использована), сессия — вход состоялся.
 */
export async function pollTelegramLink(
  nonce: string,
): Promise<TelegramSession | 'pending' | 'expired'> {
  if (!REMOTE) return 'expired'
  try {
    const res = await fetch(`${API_URL.replace(/\/+$/, '')}/api/auth/tg-link/${nonce}`)
    if (res.status === 404) return 'expired'
    if (!res.ok) return 'pending' // временная ошибка сервера — просто ждём дальше
    const body = (await res.json()) as { status?: string } & Record<string, unknown>
    if (body.status !== 'ok') return 'pending'
    return rememberSession(body as unknown as SessionResponse)
  } catch {
    return 'pending' // сеть моргнула — продолжаем опрашивать
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
  if (!REMOTE) return
  disconnectWorkspace()
}
