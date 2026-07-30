// Админ-API: список зарегистрированных пользователей. Доступ — только админам
// (сервер проверяет JWT против ADMIN_TG_IDS), поэтому шлём токен сессии.

import { API_URL, getSession } from './backend'

export interface AdminUser {
  tgId: string
  username: string | null
  firstName: string | null
  lastName: string | null
  photoUrl: string | null
  createdAt: string | null
  lastSeen: string | null
}

export interface AdminUsers {
  count: number
  users: AdminUser[]
}

export async function listUsers(): Promise<AdminUsers> {
  const token = getSession()?.token
  const res = await fetch(`${API_URL.replace(/\/+$/, '')}/api/admin/users`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error(`Сервер вернул ${res.status}`)
  return (await res.json()) as AdminUsers
}
