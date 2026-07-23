// Экспорт/импорт .xlsx (SheetJS). Человеку — листы «Отчёт» и «Журнал» (суммы в сумах).
// Точный round-trip — через скрытый лист «Данные» с полным JSON-снимком (bigint сохраняются).

import * as XLSX from 'xlsx'
import type { Account, DataSnapshot } from '../domain/types'
import { toMajorNumber } from '../domain/money'
import { buildReport, rowTotal } from '../engine/report'
import { formatPeriod } from '../engine/periods'
import { buildJournalRows, TYPE_LABEL } from '../features/journal/journalRows'
import { exportJson, importJson } from './json'

const SNAPSHOT_SHEET = 'Данные'
const SNAPSHOT_CELL = 'A1'

/** Активные счета в порядке отображения (как колонки журнала). */
function activeAccounts(data: DataSnapshot): Account[] {
  return data.accounts.filter((a) => a.active).sort((a, b) => a.order - b.order)
}

function reportSheet(data: DataSnapshot): XLSX.WorkSheet {
  const report = buildReport(data)
  const header = ['Статья', ...report.periods.map((p) => formatPeriod(p)), 'ИТОГО']
  const rows: (string | number)[][] = [header]
  for (const row of report.rows) {
    if (row.kind === 'header') {
      rows.push([row.name])
      continue
    }
    const indent = '  '.repeat(row.depth)
    const total = rowTotal(row)
    rows.push([
      indent + row.name,
      ...row.values.map((v) => toMajorNumber(v)),
      total === null ? '' : toMajorNumber(total),
    ])
  }
  return XLSX.utils.aoa_to_sheet(rows)
}

function journalSheet(data: DataSnapshot): XLSX.WorkSheet {
  const accounts = activeAccounts(data)
  const journal = buildJournalRows(data.operations, data.operationLines, accounts, data.categories)
  const header = [
    '№', 'Дата', 'Тип', 'Описание', 'Категория',
    ...accounts.map((a) => a.name),
    'Примечание',
  ]
  const rows: (string | number)[][] = [header]
  for (const r of journal) {
    rows.push([
      r.index,
      r.date,
      TYPE_LABEL[r.type],
      r.description,
      r.categoryName,
      ...accounts.map((a) => {
        const v = r[a.id]
        return typeof v === 'bigint' && v !== 0n ? toMajorNumber(v) : ''
      }),
      r.note,
    ])
  }
  return XLSX.utils.aoa_to_sheet(rows)
}

/** Собрать книгу Excel: Отчёт + Журнал + скрытый снимок. */
export function exportWorkbook(data: DataSnapshot): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, reportSheet(data), 'Отчёт')
  XLSX.utils.book_append_sheet(wb, journalSheet(data), 'Журнал')

  const snap = XLSX.utils.aoa_to_sheet([[exportJson(data)]])
  XLSX.utils.book_append_sheet(wb, snap, SNAPSHOT_SHEET)
  // пометить лист-снимок скрытым
  if (wb.Workbook?.Sheets) {
    const idx = wb.SheetNames.indexOf(SNAPSHOT_SHEET)
    if (wb.Workbook.Sheets[idx]) wb.Workbook.Sheets[idx].Hidden = 1
  } else {
    wb.Workbook = { Sheets: wb.SheetNames.map((n) => ({ Hidden: n === SNAPSHOT_SHEET ? 1 : 0 })) }
  }
  return wb
}

export function exportXlsx(data: DataSnapshot): ArrayBuffer {
  return XLSX.write(exportWorkbook(data), { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
}

/** Round-trip импорт: читаем скрытый лист-снимок с JSON. */
export function importXlsx(buf: ArrayBuffer): DataSnapshot {
  const wb = XLSX.read(buf, { type: 'array' })
  const sheet = wb.Sheets[SNAPSHOT_SHEET]
  if (!sheet) {
    throw new Error('Файл без листа «Данные» — экспортируйте его из этого приложения')
  }
  const cell = sheet[SNAPSHOT_CELL] as XLSX.CellObject | undefined
  const json = cell?.v
  if (typeof json !== 'string') {
    throw new Error('Лист «Данные» пуст или повреждён')
  }
  return importJson(json)
}
