// Редакторы ячеек журнала для AG Grid (React). Пункт 2 задания: категорию можно
// создать прямо в ячейке, не выходя из ввода операции.

import { forwardRef, useImperativeHandle, useState } from 'react'
import { nanoid } from '@reduxjs/toolkit'
import type { ICellEditorParams } from 'ag-grid-community'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectCategories } from '../../store/selectors'
import { upsertCategory } from '../../store/dataSlice'
import { toMajorNumber, type Money } from '../../domain/money'
import { directionForType } from './rowEdit'
import type { JournalRow } from './journalRows'
import { t } from '../../i18n'

const NEW_CATEGORY = '__new__'

/** Дата: нативный date-picker. */
export const DateCellEditor = forwardRef((props: ICellEditorParams, ref) => {
  const [value, setValue] = useState<string>(typeof props.value === 'string' ? props.value : '')
  useImperativeHandle(ref, () => ({ getValue: () => value }))
  return (
    <input
      className="cell-editor"
      type="date"
      value={value}
      autoFocus
      onChange={(e) => setValue(e.target.value)}
    />
  )
})
DateCellEditor.displayName = 'DateCellEditor'

/** Денежная ячейка: показываем и вводим в мажорных единицах (сумы). */
export const MoneyCellEditor = forwardRef((props: ICellEditorParams, ref) => {
  const initial = typeof props.value === 'bigint' && props.value !== 0n
    ? String(toMajorNumber(props.value as Money))
    : ''
  const [text, setText] = useState(initial)
  useImperativeHandle(ref, () => ({ getValue: () => text }))
  return (
    <input
      className="cell-editor cell-editor--num"
      inputMode="decimal"
      value={text}
      autoFocus
      onChange={(e) => setText(e.target.value)}
    />
  )
})
MoneyCellEditor.displayName = 'MoneyCellEditor'

/**
 * Категория: список по направлению строки + «＋ Новая категория…».
 * Возвращает categoryId (новая категория создаётся синхронно через стор).
 */
export const CategoryCellEditor = forwardRef((props: ICellEditorParams<JournalRow>, ref) => {
  const dispatch = useAppDispatch()
  const categories = useAppSelector(selectCategories)
  const type = props.data?.type ?? 'expense'
  const direction = directionForType(type)
  const options = categories.filter((c) => c.direction === direction)

  const [value, setValue] = useState<string | null>(
    typeof props.value === 'string' ? props.value : null,
  )
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  useImperativeHandle(ref, () => ({ getValue: () => value }))

  function commitNew() {
    const trimmed = name.trim()
    if (!trimmed) return setCreating(false)
    const id = nanoid()
    dispatch(upsertCategory({
      id,
      code: `cat_${id.slice(0, 6)}`,
      name: trimmed,
      direction,
      order: categories.length + 1,
    }))
    setValue(id)
    setCreating(false)
  }

  if (creating) {
    return (
      <div className="cell-editor cell-editor--wide">
        <input
          autoFocus
          value={name}
          placeholder={t('journal.category.placeholder')}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitNew() }}
          onBlur={commitNew}
        />
      </div>
    )
  }

  return (
    <select
      className="cell-editor"
      autoFocus
      value={value ?? ''}
      onChange={(e) => {
        if (e.target.value === NEW_CATEGORY) setCreating(true)
        else setValue(e.target.value || null)
      }}
    >
      <option value="">{t('common.dash')}</option>
      {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      <option value={NEW_CATEGORY}>{t('journal.category.new')}</option>
    </select>
  )
})
CategoryCellEditor.displayName = 'CategoryCellEditor'
