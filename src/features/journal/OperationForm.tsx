import { useEffect, useState } from 'react'
import { nanoid } from '@reduxjs/toolkit'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectActiveAccounts, selectCategories, selectData } from '../../store/selectors'
import {
  addOperation, updateOperation, upsertCategory, type OperationInput,
} from '../../store/dataSlice'
import { parseMoney, toMajorNumber, groupThousands } from '../../domain/money'
import { autoCode } from '../../domain/codes'
import { directionForType, todayIso } from './rowEdit'
import { useToast } from '../ui/Toast'
import type { OperationType } from '../../domain/types'
import { t, type Key } from '../../i18n'
import { useT } from '../../i18n/react'
import { moneySuffix } from '../../domain/money'

// Сегментный контрол типа — семантические цвета из эталона.
// Ключи, а не подписи: массив вычисляется при импорте — см. src/App.tsx.
const TYPE_SEGMENTS: { value: OperationType; labelKey: Key }[] = [
  { value: 'income', labelKey: 'opform.type.income' },
  { value: 'expense', labelKey: 'opform.type.expense' },
  { value: 'transfer', labelKey: 'opform.type.transfer' },
]

const SEG_CLASS: Record<OperationType, string> = {
  income: 'segtype__btn--in',
  expense: 'segtype__btn--out',
  transfer: 'segtype__btn--tr',
}

export default function OperationForm({
  onClose, operationId,
}: {
  onClose: () => void
  /** Если задан — форма редактирует существующую операцию. */
  operationId?: string
}) {
  useT() // подписка на смену языка для всей формы
  const dispatch = useAppDispatch()
  const toast = useToast()
  const accounts = useAppSelector(selectActiveAccounts)
  const categories = useAppSelector(selectCategories)
  const data = useAppSelector(selectData)

  // разбор существующей операции для режима правки
  const editing = operationId ? data.operations.find((o) => o.id === operationId) ?? null : null
  const editLines = editing ? data.operationLines.filter((l) => l.operationId === editing.id) : []
  const fromLine = editing?.type === 'transfer'
    ? editLines.find((l) => l.amount < 0n)
    : editLines[0]
  const toLine = editing?.type === 'transfer' ? editLines.find((l) => l.amount > 0n) : undefined
  const initialAmount = fromLine
    ? groupThousands(String(Math.abs(toMajorNumber(fromLine.amount))))
    : ''

  const [type, setType] = useState<OperationType>(editing?.type ?? 'income')
  const [date, setDate] = useState(editing?.date ?? todayIso())
  const [description, setDescription] = useState(editing?.description ?? '')
  const [note, setNote] = useState(editing?.note ?? '')
  const [accountId, setAccountId] = useState(fromLine?.accountId ?? accounts[0]?.id ?? '')
  const [toAccountId, setToAccountId] = useState(toLine?.accountId ?? accounts[1]?.id ?? '')
  const [amount, setAmount] = useState(initialAmount)
  const [error, setError] = useState('')
  const [categoryId, setCategoryId] = useState<string>(editing?.categoryId ?? '')
  const [newCategory, setNewCategory] = useState<string | null>(null)

  const direction = directionForType(type)
  const catsForType = categories.filter((c) => c.direction === direction)
  const effectiveCategoryId =
    catsForType.some((c) => c.id === categoryId) ? categoryId : catsForType[0]?.id ?? null

  const account = accounts.find((a) => a.id === accountId)
  const currency = account?.currency ?? 'UZS'

  /** Создать категорию не выходя из формы. */
  function saveNewCategory() {
    const name = (newCategory ?? '').trim()
    if (!name) return setNewCategory(null)
    const id = nanoid()
    dispatch(upsertCategory({
      id,
      code: autoCode(name, categories.map((c) => c.code)),
      name,
      direction,
      order: categories.length + 1,
    }))
    setCategoryId(id)
    setNewCategory(null)
  }

  /** Собрать вход операции из полей формы (или строку ошибки). */
  function buildInput(): OperationInput | string {
    let minor: bigint
    try {
      minor = parseMoney(amount)
    } catch {
      return t('opform.error.amount')
    }
    if (minor <= 0n) return t('opform.error.amountPositive')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return t('opform.error.date')
    if (!accountId) return t('opform.error.account')

    if (type === 'transfer') {
      if (!toAccountId || toAccountId === accountId) return t('opform.error.sameAccounts')
      const toCurrency = accounts.find((a) => a.id === toAccountId)?.currency ?? 'UZS'
      return {
        operation: { date, type, description: description || t('opform.defaultTransferDesc'), categoryId: effectiveCategoryId, note },
        lines: [
          { accountId, amount: -minor, currency },
          { accountId: toAccountId, amount: minor, currency: toCurrency },
        ],
      }
    }
    const signed = type === 'expense' ? -minor : minor
    return {
      operation: { date, type, description, categoryId: effectiveCategoryId, note },
      lines: [{ accountId, amount: signed, currency }],
    }
  }

  function submit() {
    setError('')
    const input = buildInput()
    if (typeof input === 'string') return setError(input)
    if (editing) {
      dispatch(updateOperation({
        operation: { ...input.operation, id: editing.id },
        lines: input.lines.map((l, i) => ({ ...l, id: `${editing.id}-l${i + 1}`, operationId: editing.id })),
      }))
      toast(t('opform.saved'))
    } else {
      dispatch(addOperation(input))
      toast(t('opform.added'))
    }
    onClose()
  }

  /** Добавить и оставить форму открытой для следующей записи. */
  function submitMore() {
    setError('')
    const input = buildInput()
    if (typeof input === 'string') return setError(input)
    dispatch(addOperation(input))
    toast(t('opform.addedNext'))
    setAmount('')
    setDescription('')
    setNote('')
  }

  // Esc — закрыть, Ctrl/Cmd+Enter — сохранить.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3 className="modal__title">{editing ? t('opform.title.edit') : t('opform.title.new')}</h3>
          <button className="modal__close" onClick={onClose} title={t('common.close')}>✕</button>
        </div>

        {accounts.length === 0 && (
          <div className="modal__error">
            {t('opform.noAccounts')}
          </div>
        )}

        <div className="segtype">
          {TYPE_SEGMENTS.map((seg) => (
            <button
              key={seg.value}
              className={`segtype__btn ${type === seg.value ? `segtype__btn--active ${SEG_CLASS[seg.value]}` : ''}`}
              onClick={() => setType(seg.value)}
            >
              {t(seg.labelKey)}
            </button>
          ))}
        </div>

        <div className="form-grid">
          <label className="field field--wide">
            <span>{t('opform.description')}</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('opform.description.placeholder')} />
          </label>
          <label className="field">
            <span>{t('common.date')}</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          <label className="field">
            <span>{t('opform.amount')}</span>
            <div className="mamount">
              <input value={amount} onChange={(e) => setAmount(groupThousands(e.target.value))} inputMode="decimal" placeholder="650 000" />
              <span className="mamount__cur">{currency === 'UZS' ? moneySuffix() : currency}</span>
            </div>
          </label>

          {type !== 'transfer' && (
            <div className="field field--wide">
              <span>{t('opform.category')}</span>
              {newCategory === null ? (
                <div className="field__row">
                  <select
                    aria-label={t('opform.category')}
                    value={effectiveCategoryId ?? ''}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    {catsForType.length === 0 && <option value="">{t('opform.category.none')}</option>}
                    {catsForType.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button type="button" className="btn btn--cat" onClick={() => setNewCategory('')}>
                    {t('opform.category.new')}
                  </button>
                </div>
              ) : (
                <div className="field__row">
                  <input
                    autoFocus
                    placeholder={t('journal.category.placeholder')}
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveNewCategory() }}
                  />
                  <button type="button" className="btn btn--small btn--primary" onClick={saveNewCategory}>
                    {t('common.save')}
                  </button>
                  <button type="button" className="btn btn--small" onClick={() => setNewCategory(null)}>
                    {t('common.cancel')}
                  </button>
                </div>
              )}
            </div>
          )}

          <label className="field field--wide">
            <span>{type === 'transfer' ? t('opform.account.from') : t('opform.account')}</span>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.currency === 'UZS' ? a.name : `${a.name} · ${a.currency}`}
                </option>
              ))}
            </select>
          </label>

          {type === 'transfer' && (
            <label className="field field--wide">
              <span>{t('opform.account.to')}</span>
              <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.currency === 'UZS' ? a.name : `${a.name} · ${a.currency}`}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="field field--wide">
            <span>{t('opform.note')}</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('opform.note.placeholder')} />
          </label>
        </div>

        {error && <div className="modal__error">{error}</div>}

        <div className="modal__foot">
          <div className="modal__actions">
            <button className="btn btn--primary" onClick={submit} disabled={accounts.length === 0}>
              {editing ? t('common.save') : t('opform.submit.add')}
            </button>
            {!editing && (
              <button className="btn" onClick={submitMore} disabled={accounts.length === 0}>
                {t('opform.addAndNext')}
              </button>
            )}
          </div>
          <span className="modal__hint">{t('opform.hint')}</span>
        </div>
      </div>
    </div>
  )
}
