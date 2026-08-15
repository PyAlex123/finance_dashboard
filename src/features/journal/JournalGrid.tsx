import { useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ValueFormatterParams, ValueSetterParams } from 'ag-grid-community'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectActiveAccounts, selectCategories } from '../../store/selectors'
import { updateOperation } from '../../store/dataSlice'
import { selectJournalRows, typeLabels, typeFromLabel, type JournalRow } from './journalRows'
import { buildOperationUpdate, formatDateLabel, todayIso, type RowPatch, type RowSnapshot } from './rowEdit'
import { formatMoney, parseMoney, type Money } from '../../domain/money'
import { CategoryCellEditor, DateCellEditor, MoneyCellEditor } from './cellEditors'
import { useLocale, useT } from '../../i18n/react'
import type { Account, OperationType } from '../../domain/types'

// Переброски тонируем слейт-синим (как в эталоне); приход/расход — белые строки,
// цвет несёт бейдж типа и знак суммы.
const ROW_TINT: Record<string, string> = {
  income: 'transparent',
  expense: 'transparent',
  transfer: 'rgba(74,107,132,0.10)',
}

function moneyFormatter(p: ValueFormatterParams<JournalRow, Money>) {
  const v = p.value
  if (v == null || v === 0n) return ''
  return formatMoney(v)
}

/** Снимок строки для пересборки операции. */
function toSnapshot(row: JournalRow, accounts: Account[]): RowSnapshot {
  const amounts: Record<string, Money> = {}
  for (const a of accounts) {
    const v = row[a.id]
    if (typeof v === 'bigint') amounts[a.id] = v
  }
  return {
    id: row.id,
    date: row.date,
    type: row.type,
    description: row.description,
    categoryId: row.categoryId,
    note: row.note,
    amounts,
  }
}

export default function JournalGrid({
  onEdit, onDelete, typeFilter = 'all',
}: {
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  typeFilter?: OperationType | 'all'
}) {
  const t = useT()
  // Локаль в зависимостях useMemo ниже: колонки ag-grid пересобираются при смене
  // языка, иначе заголовки и список значений в редакторе «Тип» остались бы
  // прежними до следующей правки данных.
  const locale = useLocale()
  const dispatch = useAppDispatch()
  const accounts = useAppSelector(selectActiveAccounts)
  const categories = useAppSelector(selectCategories)
  const allRows = useAppSelector(selectJournalRows)
  const rows = useMemo(
    () => (typeFilter === 'all' ? allRows : allRows.filter((r) => r.type === typeFilter)),
    [allRows, typeFilter],
  )

  const columnDefs = useMemo<ColDef<JournalRow>[]>(() => {
    // общий обработчик правки: пересобрать операцию и записать в стор
    const edit = (row: JournalRow, patch: RowPatch): boolean => {
      dispatch(updateOperation(buildOperationUpdate(toSnapshot(row, accounts), patch, accounts, categories)))
      return false // данные придут из стора, локальную мутацию не делаем
    }
    const nameById = new Map(categories.map((c) => [c.id, c.name]))

    const base: ColDef<JournalRow>[] = [
      { field: 'index', headerName: t('journal.col.index'), width: 60, pinned: 'left', editable: false },
      {
        field: 'date', headerName: t('journal.col.date'), width: 130, pinned: 'left',
        cellEditor: DateCellEditor,
        // сегодняшняя дата показывается словом «Сегодня» прямо в ячейке
        valueFormatter: (p) => formatDateLabel(String(p.value ?? '')),
        cellClass: (p) => (String(p.value ?? '') === todayIso() ? 'journal__today' : ''),
        valueSetter: (p: ValueSetterParams<JournalRow>) =>
          edit(p.data, { date: String(p.newValue ?? '').trim() || p.data.date }),
      },
      {
        field: 'typeLabel', headerName: t('journal.col.type'), width: 150, pinned: 'left',
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: Object.values(typeLabels(locale)) },
        valueSetter: (p: ValueSetterParams<JournalRow>) => {
          const type = typeFromLabel(String(p.newValue))
          return type ? edit(p.data, { type }) : false
        },
      },
      {
        field: 'description', headerName: t('journal.col.description'), width: 260, pinned: 'left',
        valueSetter: (p: ValueSetterParams<JournalRow>) =>
          edit(p.data, { description: String(p.newValue ?? '') }),
      },
      {
        field: 'categoryId', headerName: t('journal.col.category'), width: 180,
        cellEditor: CategoryCellEditor,
        valueFormatter: (p) => (p.value ? nameById.get(String(p.value)) ?? '' : ''),
        valueSetter: (p: ValueSetterParams<JournalRow>) =>
          edit(p.data, { categoryId: p.newValue ? String(p.newValue) : null }),
      },
    ]

    const accCols: ColDef<JournalRow>[] = accounts.map((a) => ({
      field: a.id,
      headerName: a.currency === 'UZS' ? a.name : `${a.name} (${a.currency})`,
      width: 150,
      type: 'numericColumn',
      cellEditor: MoneyCellEditor,
      valueFormatter: moneyFormatter,
      cellStyle: (p) => {
        const v = p.value as Money | undefined
        if (v == null || v === 0n) return null
        return { color: v < 0n ? '#b85c38' : '#1fa37f', textAlign: 'right', fontWeight: 600 }
      },
      valueSetter: (p: ValueSetterParams<JournalRow>) => {
        const text = String(p.newValue ?? '').trim()
        let amount: Money
        try {
          amount = text === '' ? 0n : parseMoney(text)
        } catch {
          return false // некорректный ввод — не меняем
        }
        return edit(p.data, { amounts: { [a.id]: amount } })
      },
    }))

    const actions: ColDef<JournalRow> = {
      headerName: '',
      width: 92,
      pinned: 'right',
      editable: false,
      sortable: false,
      resizable: false,
      cellRenderer: (p: { data?: JournalRow }) =>
        p.data ? (
          <span className="journal__actions">
            <button
              className="btn btn--small"
              title={t('journal.row.edit')}
              onClick={() => onEdit?.(p.data!.id)}
            >
              ✎
            </button>
            <button
              className="btn btn--small btn--danger"
              title={t('journal.row.delete')}
              onClick={() => onDelete?.(p.data!.id)}
            >
              ✕
            </button>
          </span>
        ) : null,
    }

    return [
      ...base,
      ...accCols,
      {
        field: 'note', headerName: t('journal.col.note'), width: 200,
        valueSetter: (p: ValueSetterParams<JournalRow>) =>
          edit(p.data, { note: String(p.newValue ?? '') }),
      },
      actions,
    ]
  }, [accounts, categories, dispatch, onEdit, onDelete, t, locale])

  return (
    <div className="ag-theme-quartz" style={{ height: '100%', width: '100%' }}>
      <AgGridReact<JournalRow>
        rowData={rows}
        columnDefs={columnDefs}
        getRowId={(p) => p.data.id}
        getRowStyle={(p) =>
          p.data ? { background: ROW_TINT[p.data.type] ?? undefined } : undefined
        }
        defaultColDef={{ resizable: true, sortable: true, editable: true }}
        overlayNoRowsTemplate={t('journal.empty')}
        stopEditingWhenCellsLoseFocus
      />
    </div>
  )
}
