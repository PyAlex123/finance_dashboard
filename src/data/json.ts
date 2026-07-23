// Экспорт/импорт всего слепка данных в JSON. Деньги — bigint, поэтому кодируем
// их тегированным объектом {"$bigint": "..."} и восстанавливаем при импорте.

import type { DataSnapshot } from '../domain/types'

const SCHEMA_VERSION = 1

interface Envelope {
  app: 'fin-reports'
  version: number
  exportedAt: string
  data: DataSnapshot
}

function replacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? { $bigint: value.toString() } : value
}

function reviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && '$bigint' in value) {
    return BigInt((value as { $bigint: string }).$bigint)
  }
  return value
}

export function exportJson(data: DataSnapshot): string {
  const env: Envelope = {
    app: 'fin-reports',
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  }
  return JSON.stringify(env, replacer, 2)
}

export function importJson(text: string): DataSnapshot {
  const parsed = JSON.parse(text, reviver) as Partial<Envelope> & Partial<DataSnapshot>
  const data = (parsed as Envelope).data ?? (parsed as DataSnapshot)
  if (!data || !Array.isArray(data.operations) || !Array.isArray(data.accounts)) {
    throw new Error('Не похоже на файл финансовых отчётов')
  }
  return normalizeSnapshot(data)
}

/** Гарантировать наличие полей, добавленных в новых версиях (совместимость старых файлов). */
export function normalizeSnapshot(data: DataSnapshot): DataSnapshot {
  return {
    ...data,
    overrides: data.overrides ?? [],
    templateVersions: data.templateVersions ?? [],
    projects: data.projects ?? [],
    scenarios: data.scenarios ?? [],
  }
}
