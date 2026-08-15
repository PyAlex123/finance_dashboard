import { useMemo, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectAccounts } from '../../store/selectors'
import { deleteOperation, upsertAccount } from '../../store/dataSlice'
import JournalGrid from './JournalGrid'
import BalancesStrip from './BalancesStrip'
import OperationForm from './OperationForm'
import { selectJournalRows } from './journalRows'
import { formatMoney } from '../../domain/money'
import { autoCode } from '../../domain/codes'
import { useViewMode } from '../shell/ViewMode'
import { useT } from '../../i18n/react'
import type { Key } from '../../i18n'
import type { Money } from '../../domain/money'
import type { Currency, OperationType } from '../../domain/types'

type Filter = OperationType | 'all'

// Ключи, а не подписи: массив вычисляется при импорте модуля — см. src/App.tsx.
const TYPE_FILTERS: { key: Filter; labelKey: Key }[] = [
  { key: 'all', labelKey: 'journal.filter.all' },
  { key: 'income', labelKey: 'journal.filter.income' },
  { key: 'expense', labelKey: 'journal.filter.expense' },
  { key: 'transfer', labelKey: 'journal.filter.transfer' },
]

export default function JournalPanel() {
  const t = useT()
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
          <span className="actionbar__plus" aria-hidden="true">＋</span>{t('journal.today')}
        </button>

        <div className="actionbar__right">
          {addingAccount ? (
            <span className="toolbar__inline">
              <input
                autoFocus
                placeholder={t('journal.accountName')}
                value={accName}
                onChange={(e) => setAccName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addAccount() }}
              />
              <select value={accCur} onChange={(e) => setAccCur(e.target.value as Currency)}>
                <option value="UZS">UZS</option>
                <option value="USD">USD</option>
              </select>
              <button className="btn btn--small btn--primary" onClick={addAccount}>{t('common.add')}</button>
              <button className="btn btn--small" onClick={() => setAddingAccount(false)}>{t('common.cancel')}</button>
            </span>
          ) : (
            <button className="btn" onClick={() => setAddingAccount(true)}>{t('journal.addAccount')}</button>
          )}

          <div className="typefilter">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.key}
                className={`typefilter__btn typefilter__btn--${f.key} ${typeFilter === f.key ? 'typefilter__btn--active' : ''}`}
                onClick={() => setTypeFilter(f.key)}
              >
                {t(f.labelKey)}
              </button>
            ))}
          </div>

          <span className="actionbar__count">{t('journal.count', { count: shownRows.length })}</span>
        </div>
      </div>

      {mobile ? (
        <MobileList
          rows={shownRows}
          onEdit={(id) => { setEditingId(id); setFormOpen(true) }}
          onDelete={(id) => { if (confirm(t('journal.delete.confirm'))) dispatch(deleteOperation(id)) }}
        />
      ) : (
        <>
          <div className="panel__grid">
            <JournalGrid
              typeFilter={typeFilter}
              onEdit={(id) => { setEditingId(id); setFormOpen(true) }}
              onDelete={(id) => { if (confirm(t('journal.delete.confirm'))) dispatch(deleteOperation(id)) }}
            />
          </div>
          <span className="panel__hint">
            {t('journal.hint')}
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

// Метка типа для мобильных карточек (● / ⇄ + слово, как в эталоне).
// Функция, а не константа: подпись зависит от языка.
const mobileType = (t: ReturnType<typeof useT>): Record<OperationType, string> => ({
  income: t('journal.mobile.income'),
  expense: t('journal.mobile.expense'),
  transfer: t('journal.mobile.transfer'),
})
const shortDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`

/** Мобильный вид журнала: карточки вместо широкой таблицы (как в эталоне). */
function MobileList({
  rows, onEdit, onDelete,
}: {
  rows: ReturnType<typeof selectJournalRows>
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const t = useT()
  const accounts = useAppSelector(selectAccounts)
  const typeLabel = mobileType(t)
  if (rows.length === 0) {
    return <div className="jcards__empty">{t('journal.empty')}</div>
  }
  return (
    <div className="jcards">
      {rows.map((r) => {
        // сумма операции: приход/расход — сальдо (знаковое), переброска — перемещённое
        let net = 0n
        let moved = 0n
        const accNames: string[] = []
        for (const a of accounts) {
          const v = r[a.id]
          if (typeof v === 'bigint' && v !== 0n) {
            net += v as Money
            if (v > 0n) moved += v as Money
            accNames.push(a.name)
          }
        }
        const value = r.type === 'transfer' ? moved : net
        const neg = value < 0n
        const amountText = neg ? `(${formatMoney(-value)})` : formatMoney(value)
        const badgeCls = r.type === 'income' ? 'jbadge--in' : r.type === 'expense' ? 'jbadge--out' : 'jbadge--tr'
        const amountCls = r.type === 'income' ? 'jcard__amount--in' : r.type === 'expense' ? 'jcard__amount--out' : 'jcard__amount--tr'
        const accLabel = accNames.join(r.type === 'transfer' ? ' → ' : ', ')
        return (
          <div
            key={r.id}
            className={`jcard jcard--${r.type}`}
            onClick={() => onEdit(r.id)}
            title={t('journal.card.edit')}
          >
            <div className="jcard__top">
              <span className={`jbadge ${badgeCls}`}>{typeLabel[r.type]}</span>
              <span className={`jcard__amount ${amountCls}`}>{amountText}</span>
            </div>
            <div className="jcard__desc">{r.description || t('common.dash')}</div>
            <div className="jcard__foot">
              <span className="jcard__meta">{shortDate(r.date)}{accLabel ? ` · ${accLabel}` : ''}</span>
              <span className="jcard__footright">
                {r.categoryName && <span className="jbadge jbadge--cat">{r.categoryName}</span>}
                <button
                  className="jcard__del"
                  onClick={(e) => { e.stopPropagation(); onDelete(r.id) }}
                  title={t('journal.card.delete')}
                >
                  ✕
                </button>
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
