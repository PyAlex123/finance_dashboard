import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectAccounts, selectCategories } from '../../store/selectors'
import {
  upsertAccount, deleteAccount, upsertCategory, deleteCategory,
} from '../../store/dataSlice'
import type { CategoryDirection, Currency } from '../../domain/types'

const DIR_LABEL: Record<CategoryDirection, string> = { in: 'Доход', out: 'Расход', transfer: 'Переброска' }

export default function RefsView() {
  const dispatch = useAppDispatch()
  const accounts = useAppSelector(selectAccounts)
  const categories = useAppSelector(selectCategories)

  const [accCode, setAccCode] = useState('')
  const [accName, setAccName] = useState('')
  const [accCur, setAccCur] = useState<Currency>('UZS')

  const [catCode, setCatCode] = useState('')
  const [catName, setCatName] = useState('')
  const [catDir, setCatDir] = useState<CategoryDirection>('in')

  return (
    <div className="refs">
      <section className="refs__section">
        <h3>Счета</h3>
        <table className="refs__table">
          <thead><tr><th>Код</th><th>Название</th><th>Валюта</th><th>Активен</th><th></th></tr></thead>
          <tbody>
            {[...accounts].sort((a, b) => a.order - b.order).map((a) => (
              <tr key={a.id}>
                <td className="mono">{a.code}</td>
                <td>{a.name}</td>
                <td>{a.currency}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={a.active}
                    onChange={(e) => dispatch(upsertAccount({ ...a, active: e.target.checked }))}
                  />
                </td>
                <td><button className="btn btn--small btn--danger" onClick={() => dispatch(deleteAccount(a.id))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="refs__add">
          <input placeholder="код" className="mono" value={accCode} onChange={(e) => setAccCode(e.target.value)} />
          <input placeholder="название" value={accName} onChange={(e) => setAccName(e.target.value)} />
          <select value={accCur} onChange={(e) => setAccCur(e.target.value as Currency)}>
            <option value="UZS">UZS</option><option value="USD">USD</option>
          </select>
          <button
            className="btn btn--primary btn--small"
            disabled={!accCode || !accName}
            onClick={() => {
              dispatch(upsertAccount({ code: accCode, name: accName, currency: accCur, order: accounts.length + 1, active: true }))
              setAccCode(''); setAccName('')
            }}
          >Добавить счёт</button>
        </div>
      </section>

      <section className="refs__section">
        <h3>Категории</h3>
        <table className="refs__table">
          <thead><tr><th>Код</th><th>Название</th><th>Направление</th><th></th></tr></thead>
          <tbody>
            {[...categories].sort((a, b) => a.order - b.order).map((c) => (
              <tr key={c.id}>
                <td className="mono">{c.code}</td>
                <td>{c.name}</td>
                <td>{DIR_LABEL[c.direction]}</td>
                <td><button className="btn btn--small btn--danger" onClick={() => dispatch(deleteCategory(c.id))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="refs__add">
          <input placeholder="код" className="mono" value={catCode} onChange={(e) => setCatCode(e.target.value)} />
          <input placeholder="название" value={catName} onChange={(e) => setCatName(e.target.value)} />
          <select value={catDir} onChange={(e) => setCatDir(e.target.value as CategoryDirection)}>
            <option value="in">Доход</option><option value="out">Расход</option><option value="transfer">Переброска</option>
          </select>
          <button
            className="btn btn--primary btn--small"
            disabled={!catCode || !catName}
            onClick={() => {
              dispatch(upsertCategory({ code: catCode, name: catName, direction: catDir, order: categories.length + 1 }))
              setCatCode(''); setCatName('')
            }}
          >Добавить категорию</button>
        </div>
      </section>
    </div>
  )
}
