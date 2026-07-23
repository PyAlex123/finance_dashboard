import { useMemo } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ValueFormatterParams } from 'ag-grid-community'
import { useAppSelector } from '../../store/hooks'
import { selectActiveAccounts } from '../../store/selectors'
import { selectJournalRows, type JournalRow } from './journalRows'
import { formatMoney, type Money } from '../../domain/money'

const ROW_TINT: Record<string, string> = {
  income: 'rgba(34,197,94,0.08)',
  expense: 'rgba(239,68,68,0.08)',
  transfer: 'rgba(59,130,246,0.10)',
}

function moneyFormatter(p: ValueFormatterParams<JournalRow, Money>) {
  const v = p.value
  if (v == null || v === 0n) return ''
  return formatMoney(v)
}

export default function JournalGrid({ onSelect }: { onSelect?: (id: string | null) => void }) {
  const accounts = useAppSelector(selectActiveAccounts)
  const rows = useAppSelector(selectJournalRows)

  const columnDefs = useMemo<ColDef<JournalRow>[]>(() => {
    const base: ColDef<JournalRow>[] = [
      { field: 'index', headerName: '№', width: 60, pinned: 'left' },
      { field: 'date', headerName: 'Дата', width: 110, pinned: 'left' },
      { field: 'typeLabel', headerName: 'Тип', width: 140, pinned: 'left' },
      { field: 'description', headerName: 'Описание', width: 260, pinned: 'left' },
      { field: 'categoryName', headerName: 'Категория', width: 160 },
    ]
    const accCols: ColDef<JournalRow>[] = accounts.map((a) => ({
      field: a.id,
      headerName: a.name,
      width: 150,
      type: 'numericColumn',
      valueFormatter: moneyFormatter,
      cellStyle: (p) => {
        const v = p.value as Money | undefined
        if (v == null || v === 0n) return null
        return { color: v < 0n ? '#dc2626' : '#16a34a', textAlign: 'right' }
      },
    }))
    return [...base, ...accCols, { field: 'note', headerName: 'Примечание', width: 200 }]
  }, [accounts])

  return (
    <div className="ag-theme-quartz" style={{ height: '100%', width: '100%' }}>
      <AgGridReact<JournalRow>
        rowData={rows}
        columnDefs={columnDefs}
        getRowId={(p) => p.data.id}
        getRowStyle={(p) =>
          p.data ? { background: ROW_TINT[p.data.type] ?? undefined } : undefined
        }
        defaultColDef={{ resizable: true, sortable: true }}
        rowSelection="single"
        onSelectionChanged={(e) => onSelect?.(e.api.getSelectedRows()[0]?.id ?? null)}
        overlayNoRowsTemplate="Журнал пуст — нажмите «+ Операция», чтобы добавить запись"
        suppressCellFocus
      />
    </div>
  )
}
