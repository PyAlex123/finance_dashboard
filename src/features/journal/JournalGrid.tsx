import { useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ValueFormatterParams, ValueSetterParams } from 'ag-grid-community'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectActiveAccounts, selectCategories } from '../../store/selectors'
import { updateOperation } from '../../store/dataSlice'
import { selectJournalRows, TYPE_LABEL, type JournalRow } from './journalRows'
import { buildOperationUpdate, formatDateLabel, todayIso, type RowPatch, type RowSnapshot } from './rowEdit'
import { formatMoney, parseMoney, type Money } from '../../domain/money'
import { CategoryCellEditor, DateCellEditor, MoneyCellEditor } from './cellEditors'
import type { Account, OperationType } from '../../domain/types'

const ROW_TINT: Record<string, string> = {
  income: 'rgba(34,197,94,0.08)',
  expense: 'rgba(239,68,68,0.08)',
  transfer: 'rgba(59,130,246,0.10)',
}

const TYPE_BY_LABEL = new Map<string, OperationType>(
  (Object.keys(TYPE_LABEL) as OperationType[]).map((t) => [TYPE_LABEL[t], t]),
)

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

export default function JournalGrid({ onSelect }: { onSelect?: (id: string | null) => void }) {
  const dispatch = useAppDispatch()
  const accounts = useAppSelector(selectActiveAccounts)
  const categories = useAppSelector(selectCategories)
  const rows = useAppSelector(selectJournalRows)

  const columnDefs = useMemo<ColDef<JournalRow>[]>(() => {
    // общий обработчик правки: пересобрать операцию и записать в стор
    const edit = (row: JournalRow, patch: RowPatch): boolean => {
      dispatch(updateOperation(buildOperationUpdate(toSnapshot(row, accounts), patch, accounts, categories)))
      return false // данные придут из стора, локальную мутацию не делаем
    }
    const nameById = new Map(categories.map((c) => [c.id, c.name]))

    const base: ColDef<JournalRow>[] = [
      { field: 'index', headerName: '№', width: 60, pinned: 'left', editable: false },
      {
        field: 'date', headerName: 'Дата', width: 130, pinned: 'left',
        cellEditor: DateCellEditor,
        // сегодняшняя дата показывается словом «Сегодня» прямо в ячейке
        valueFormatter: (p) => formatDateLabel(String(p.value ?? '')),
        cellClass: (p) => (String(p.value ?? '') === todayIso() ? 'journal__today' : ''),
        valueSetter: (p: ValueSetterParams<JournalRow>) =>
          edit(p.data, { date: String(p.newValue ?? '').trim() || p.data.date }),
      },
      {
        field: 'typeLabel', headerName: 'Тип', width: 150, pinned: 'left',
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: Object.values(TYPE_LABEL) },
        valueSetter: (p: ValueSetterParams<JournalRow>) => {
          const type = TYPE_BY_LABEL.get(String(p.newValue))
          return type ? edit(p.data, { type }) : false
        },
      },
      {
        field: 'description', headerName: 'Описание', width: 260, pinned: 'left',
        valueSetter: (p: ValueSetterParams<JournalRow>) =>
          edit(p.data, { description: String(p.newValue ?? '') }),
      },
      {
        field: 'categoryId', headerName: 'Категория', width: 180,
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
        return { color: v < 0n ? '#dc2626' : '#16a34a', textAlign: 'right' }
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

    return [
      ...base,
      ...accCols,
      {
        field: 'note', headerName: 'Примечание', width: 200,
        valueSetter: (p: ValueSetterParams<JournalRow>) =>
          edit(p.data, { note: String(p.newValue ?? '') }),
      },
    ]
  }, [accounts, categories, dispatch])

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
        rowSelection="single"
        onSelectionChanged={(e) => onSelect?.(e.api.getSelectedRows()[0]?.id ?? null)}
        overlayNoRowsTemplate="Журнал пуст — нажмите «Сегодня», чтобы добавить запись"
        stopEditingWhenCellsLoseFocus
      />
    </div>
  )
}
