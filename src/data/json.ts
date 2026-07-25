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

/** Кодирует bigint-суммы в тегированный объект — для JSON.stringify (файл и сеть). */
export function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? { $bigint: value.toString() } : value
}

/** Восстанавливает bigint-суммы из тегированного объекта — для JSON.parse. */
export function bigintReviver(_key: string, value: unknown): unknown {
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
  return JSON.stringify(env, bigintReplacer, 2)
}

export function importJson(text: string): DataSnapshot {
  const parsed = JSON.parse(text, bigintReviver) as Partial<Envelope> & Partial<DataSnapshot>
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
    cellValues: data.cellValues ?? [],
    plPeriods: data.plPeriods ?? [],
    projects: data.projects ?? [],
    scenarios: data.scenarios ?? [],
  }
}
