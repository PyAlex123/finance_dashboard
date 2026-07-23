import { useMemo, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectActiveAccounts, selectCategories } from '../../store/selectors'
import { addOperation, type OperationInput } from '../../store/dataSlice'
import { parseMoney } from '../../domain/money'
import type { OperationType } from '../../domain/types'

const TYPE_OPTIONS: { value: OperationType; label: string; dir: string }[] = [
  { value: 'income', label: '🟢 Приход', dir: 'in' },
  { value: 'expense', label: '🔴 Расход', dir: 'out' },
  { value: 'transfer', label: '🔵 Переброска', dir: 'transfer' },
]

export default function OperationForm({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch()
  const accounts = useAppSelector(selectActiveAccounts)
  const categories = useAppSelector(selectCategories)

  const [type, setType] = useState<OperationType>('income')
  const [date, setDate] = useState('2025-03-31')
  const [description, setDescription] = useState('')
  const [note, setNote] = useState('')
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  const dir = TYPE_OPTIONS.find((t) => t.value === type)!.dir
  const cats = useMemo(() => categories.filter((c) => c.direction === dir), [categories, dir])
  const [categoryId, setCategoryId] = useState(cats[0]?.id ?? '')

  // при смене типа пересобрать список категорий
  const catsForType = categories.filter((c) => c.direction === dir)
  const effectiveCategoryId =
    catsForType.some((c) => c.id === categoryId) ? categoryId : catsForType[0]?.id ?? null

  function submit() {
    setError('')
    let minor: bigint
    try {
      minor = parseMoney(amount)
    } catch {
      setError('Некорректная сумма')
      return
    }
    if (minor <= 0n) return setError('Сумма должна быть больше нуля')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Некорректная дата')
    if (!accountId) return setError('Выберите счёт')

    let input: OperationInput
    if (type === 'transfer') {
      if (!toAccountId || toAccountId === accountId) return setError('Счета переброски должны различаться')
      input = {
        operation: { date, type, description: description || 'Переброска', categoryId: effectiveCategoryId, note },
        lines: [
          { accountId, amount: -minor, currency: 'UZS' },
          { accountId: toAccountId, amount: minor, currency: 'UZS' },
        ],
      }
    } else {
      const signed = type === 'expense' ? -minor : minor
      input = {
        operation: { date, type, description, categoryId: effectiveCategoryId, note },
        lines: [{ accountId, amount: signed, currency: 'UZS' }],
      }
    }
    dispatch(addOperation(input))
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal__title">Новая операция</h3>

        {accounts.length === 0 && (
          <div className="modal__error">
            Сначала добавьте хотя бы один счёт во вкладке «Справочники».
          </div>
        )}

        <div className="form-grid">
          <label className="field">
            <span>Тип</span>
            <select value={type} onChange={(e) => setType(e.target.value as OperationType)}>
              {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Дата</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field field--wide">
            <span>Описание</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Оплата курса…" />
          </label>

          {type !== 'transfer' && (
            <label className="field">
              <span>Категория</span>
              <select value={effectiveCategoryId ?? ''} onChange={(e) => setCategoryId(e.target.value)}>
                {catsForType.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}

          <label className="field">
            <span>{type === 'transfer' ? 'Со счёта' : 'Счёт'}</span>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>

          {type === 'transfer' && (
            <label className="field">
              <span>На счёт</span>
              <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
          )}

          <label className="field">
            <span>Сумма (сум)</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="650000" />
          </label>
          <label className="field field--wide">
            <span>Примечание</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>

        {error && <div className="modal__error">{error}</div>}

        <div className="modal__actions">
          <button className="btn btn--primary" onClick={submit} disabled={accounts.length === 0}>Добавить</button>
          <button className="btn" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  )
}
