import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectAccounts } from '../../store/selectors'
import { deleteOperation, upsertAccount } from '../../store/dataSlice'
import JournalGrid from './JournalGrid'
import OperationForm from './OperationForm'
import { autoCode } from '../../domain/codes'
import type { Currency } from '../../domain/types'

export default function JournalPanel() {
  const dispatch = useAppDispatch()
  const accounts = useAppSelector(selectAccounts)
  const [selected, setSelected] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [addingAccount, setAddingAccount] = useState(false)
  const [accName, setAccName] = useState('')
  const [accCur, setAccCur] = useState<Currency>('UZS')

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
      <div className="toolbar">
        <button className="btn btn--primary" onClick={() => setFormOpen(true)}>Сегодня</button>
        <button
          className="btn btn--danger"
          disabled={!selected}
          onClick={() => { if (selected) { dispatch(deleteOperation(selected)); setSelected(null) } }}
        >
          Удалить выбранную
        </button>

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
              <option value="EUR">EUR</option>
            </select>
            <button className="btn btn--small btn--primary" onClick={addAccount}>Добавить</button>
            <button className="btn btn--small" onClick={() => setAddingAccount(false)}>Отмена</button>
          </span>
        ) : (
          <button className="btn" onClick={() => setAddingAccount(true)}>+ Счёт</button>
        )}

        <span className="toolbar__hint">Двойной клик по ячейке — правка · клик по строке — выбор</span>
      </div>
      <div className="panel__grid">
        <JournalGrid onSelect={setSelected} />
      </div>
      {formOpen && <OperationForm onClose={() => setFormOpen(false)} />}
    </div>
  )
}
