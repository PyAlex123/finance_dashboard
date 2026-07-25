import { useMemo, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectAccounts } from '../../store/selectors'
import { deleteOperation, upsertAccount } from '../../store/dataSlice'
import JournalGrid from './JournalGrid'
import BalancesStrip from './BalancesStrip'
import OperationForm from './OperationForm'
import { selectJournalRows, TYPE_LABEL } from './journalRows'
import { formatDateLabel } from './rowEdit'
import { formatMoney } from '../../domain/money'
import { autoCode } from '../../domain/codes'
import { useViewMode } from '../shell/ViewMode'
import type { Money } from '../../domain/money'
import type { Currency, OperationType } from '../../domain/types'

type Filter = OperationType | 'all'

const TYPE_FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'income', label: 'Приход' },
  { key: 'expense', label: 'Расход' },
  { key: 'transfer', label: 'Переброска' },
]

export default function JournalPanel() {
  const dispatch = useAppDispatch()
  const accounts = useAppSelector(selectAccounts)
  const rows = useAppSelector(selectJournalRows)
  const mobile = useViewMode() === 'mobile'
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingAccount, setAddingAccount] = useState(false)
  const [accName, setAccName] = useState('')
  const [accCur, setAccCur] = useState<Currency>('UZS')
  const [typeFilter, setTypeFilter] = useState<Filter>('all')

  const shownRows = useMemo(
    () => (typeFilter === 'all' ? rows : rows.filter((r) => r.type === typeFilter)),
    [rows, typeFilter],
  )

  function addAccount() {
    const name = accName.trim()
    if (!name) return
    dispatch(upsertAccount({
      code: autoCode(name, accounts.map((a) => a.code)),
      name,
      currency: accCur,
      order: accounts.length + 1,
      active: true,
    }))
    setAccName('')
    setAddingAccount(false)
  }

  return (
    <div className="panel">
      <BalancesStrip />

      <div className="actionbar">
        <button className="btn btn--primary" onClick={() => { setEditingId(null); setFormOpen(true) }}>
          <span className="actionbar__plus" aria-hidden="true">＋</span>Сегодня
        </button>

        <div className="actionbar__right">
          {addingAccount ? (
            <span className="toolbar__inline">
              <input
                autoFocus
                placeholder="Название счёта"
                value={accName}
                onChange={(e) => setAccName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addAccount() }}
              />
              <select value={accCur} onChange={(e) => setAccCur(e.target.value as Currency)}>
                <option value="UZS">UZS</option>
                <option value="USD">USD</option>
              </select>
              <button className="btn btn--small btn--primary" onClick={addAccount}>Добавить</button>
              <button className="btn btn--small" onClick={() => setAddingAccount(false)}>Отмена</button>
            </span>
          ) : (
            <button className="btn" onClick={() => setAddingAccount(true)}>+ Счёт</button>
          )}

          <div className="typefilter">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.key}
                className={`typefilter__btn typefilter__btn--${f.key} ${typeFilter === f.key ? 'typefilter__btn--active' : ''}`}
                onClick={() => setTypeFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <span className="actionbar__count">{shownRows.length} оп.</span>
        </div>
      </div>

      {mobile ? (
        <MobileList
          rows={shownRows}
          onEdit={(id) => { setEditingId(id); setFormOpen(true) }}
          onDelete={(id) => { if (confirm('Удалить операцию?')) dispatch(deleteOperation(id)) }}
        />
      ) : (
        <>
          <div className="panel__grid">
            <JournalGrid
              typeFilter={typeFilter}
              onEdit={(id) => { setEditingId(id); setFormOpen(true) }}
              onDelete={(id) => { if (confirm('Удалить операцию?')) dispatch(deleteOperation(id)) }}
            />
          </div>
          <span className="panel__hint">
            ✎ — изменить запись · ✕ — удалить · двойной клик по ячейке — быстрая правка
          </span>
        </>
      )}

      {formOpen && (
        <OperationForm
          operationId={editingId ?? undefined}
          onClose={() => { setFormOpen(false); setEditingId(null) }}
        />
      )}
    </div>
  )
}

/** Мобильный вид журнала: карточки вместо широкой таблицы. */
function MobileList({
  rows, onEdit, onDelete,
}: {
  rows: ReturnType<typeof selectJournalRows>
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const accounts = useAppSelector(selectAccounts)
  if (rows.length === 0) {
    return <div className="jcards__empty">Журнал пуст — нажмите «Сегодня», чтобы добавить запись</div>
  }
  return (
    <div className="jcards">
      {rows.map((r) => {
        // сумма операции = сумма положительных проводок (или модуль по счетам)
        let amount = 0n
        for (const a of accounts) {
          const v = r[a.id]
          if (typeof v === 'bigint' && v > 0n) amount += v as Money
        }
        const cls = r.type === 'income' ? 'jbadge--in' : r.type === 'expense' ? 'jbadge--out' : 'jbadge--tr'
        return (
          <div key={r.id} className={`jcard jcard--${r.type}`}>
            <div className="jcard__top">
              <span className={`jbadge ${cls}`}>{TYPE_LABEL[r.type]}</span>
              <div className="jcard__actions">
                <button className="btn btn--small" onClick={() => onEdit(r.id)}>✎</button>
                <button className="btn btn--small btn--danger" onClick={() => onDelete(r.id)}>✕</button>
              </div>
            </div>
            <div className="jcard__desc">{r.description || '—'}</div>
            <div className="jcard__foot">
              <span>{formatDateLabel(r.date)}{r.categoryName ? ` · ${r.categoryName}` : ''}</span>
              <span className="jcard__amount">{formatMoney(amount)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
