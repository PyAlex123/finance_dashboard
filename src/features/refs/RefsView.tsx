import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectAccounts, selectCategories, selectData } from '../../store/selectors'
import {
  upsertAccount, deleteAccount, renameAccountCode,
  upsertCategory, deleteCategory, renameCategoryCode,
  upsertRate, deleteRate,
} from '../../store/dataSlice'
import { autoCode, isValidCode } from '../../domain/codes'
import { formatMoney, parseMoney } from '../../domain/money'
import type { Account, CategoryDirection, Currency } from '../../domain/types'

const DIR_LABEL: Record<CategoryDirection, string> = { in: 'Доход', out: 'Расход', transfer: 'Переброска' }
const CURRENCIES: Currency[] = ['UZS', 'USD']

/** Поле кода: правится вручную, применяется по потере фокуса/Enter. */
function CodeCell({ code, onRename }: { code: string; onRename: (next: string) => void }) {
  const [draft, setDraft] = useState(code)
  const [err, setErr] = useState('')
  function commit() {
    const next = draft.trim()
    if (next === code) return setErr('')
    if (!isValidCode(next)) { setErr('латиница, цифры, _'); setDraft(code); return }
    setErr('')
    onRename(next)
  }
  return (
    <span className="refs__code">
      <input
        className="mono refs__code-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      />
      {err && <span className="refs__code-err">{err}</span>}
    </span>
  )
}

export default function RefsView() {
  const dispatch = useAppDispatch()
  const accounts = useAppSelector(selectAccounts)
  const categories = useAppSelector(selectCategories)
  const { rates } = useAppSelector(selectData)

  const [accName, setAccName] = useState('')
  const [accCur, setAccCur] = useState<Currency>('UZS')
  const [catName, setCatName] = useState('')
  const [catDir, setCatDir] = useState<CategoryDirection>('in')
  const [rateCur, setRateCur] = useState<Currency>('USD')
  const [rateDate, setRateDate] = useState('')
  const [rateValue, setRateValue] = useState('')

  /** Дубль счёта в другой валюте — те же операции ведутся отдельно, отчёт пересчитает по курсу. */
  function duplicateInCurrency(a: Account, currency: Currency) {
    const name = `${a.name} (${currency})`
    dispatch(upsertAccount({
      code: autoCode(name, accounts.map((x) => x.code)),
      name,
      currency,
      order: accounts.length + 1,
      active: true,
    }))
  }

  return (
    <div className="refs">
      <section className="refs__section">
        <h3>Счета</h3>
        <table className="refs__table">
          <thead><tr><th>Код</th><th>Название</th><th>Валюта</th><th>Активен</th><th>Дубль в валюте</th><th></th></tr></thead>
          <tbody>
            {[...accounts].sort((a, b) => a.order - b.order).map((a) => (
              <tr key={a.id}>
                <td>
                  <CodeCell key={a.code} code={a.code} onRename={(code) => dispatch(renameAccountCode({ id: a.id, code }))} />
                </td>
                <td>
                  <input
                    className="refs__name-input"
                    value={a.name}
                    onChange={(e) => dispatch(upsertAccount({ ...a, name: e.target.value }))}
                  />
                </td>
                <td>{a.currency}</td>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Активен ${a.name}`}
                    checked={a.active}
                    onChange={(e) => dispatch(upsertAccount({ ...a, active: e.target.checked }))}
                  />
                </td>
                <td>
                  <select
                    aria-label={`Дублировать ${a.name}`}
                    value=""
                    onChange={(e) => { if (e.target.value) duplicateInCurrency(a, e.target.value as Currency) }}
                  >
                    <option value="">— выбрать —</option>
                    {CURRENCIES.filter((c) => c !== a.currency).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td><button className="btn btn--small btn--danger" onClick={() => dispatch(deleteAccount(a.id))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="refs__add">
          <input placeholder="название счёта" value={accName} onChange={(e) => setAccName(e.target.value)} />
          <select aria-label="Валюта нового счёта" value={accCur} onChange={(e) => setAccCur(e.target.value as Currency)}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            className="btn btn--primary btn--small"
            disabled={!accName.trim()}
            onClick={() => {
              const name = accName.trim()
              dispatch(upsertAccount({
                code: autoCode(name, accounts.map((a) => a.code)),
                name, currency: accCur, order: accounts.length + 1, active: true,
              }))
              setAccName('')
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
                <td>
                  <CodeCell key={c.code} code={c.code} onRename={(code) => dispatch(renameCategoryCode({ id: c.id, code }))} />
                </td>
                <td>
                  <input
                    className="refs__name-input"
                    value={c.name}
                    onChange={(e) => dispatch(upsertCategory({ ...c, name: e.target.value }))}
                  />
                </td>
                <td>{DIR_LABEL[c.direction]}</td>
                <td><button className="btn btn--small btn--danger" onClick={() => dispatch(deleteCategory(c.id))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="refs__add">
          <input placeholder="название категории" value={catName} onChange={(e) => setCatName(e.target.value)} />
          <select aria-label="Направление новой категории" value={catDir} onChange={(e) => setCatDir(e.target.value as CategoryDirection)}>
            <option value="in">Доход</option><option value="out">Расход</option><option value="transfer">Переброска</option>
          </select>
          <button
            className="btn btn--primary btn--small"
            disabled={!catName.trim()}
            onClick={() => {
              const name = catName.trim()
              dispatch(upsertCategory({
                code: autoCode(name, categories.map((c) => c.code)),
                name, direction: catDir, order: categories.length + 1,
              }))
              setCatName('')
            }}
          >Добавить категорию</button>
        </div>
      </section>

      <section className="refs__section">
        <h3>Курсы валют</h3>
        <p className="refs__hint">Курс — сколько сумов за 1 единицу валюты на дату. Отчёт пересчитывает валютные счета по курсу.</p>
        <table className="refs__table">
          <thead><tr><th>Валюта</th><th>Дата</th><th>Курс</th><th></th></tr></thead>
          <tbody>
            {[...rates].sort((a, b) => (a.date < b.date ? -1 : 1)).map((r) => (
              <tr key={r.id}>
                <td>{r.currency}</td>
                <td>{r.date}</td>
                <td>{formatMoney(r.rate)}</td>
                <td><button className="btn btn--small btn--danger" onClick={() => dispatch(deleteRate(r.id))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="refs__add">
          <select aria-label="Валюта курса" value={rateCur} onChange={(e) => setRateCur(e.target.value as Currency)}>
            {CURRENCIES.filter((c) => c !== 'UZS').map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input aria-label="Дата курса" type="date" value={rateDate} onChange={(e) => setRateDate(e.target.value)} />
          <input placeholder="курс, сум" value={rateValue} onChange={(e) => setRateValue(e.target.value)} />
          <button
            className="btn btn--primary btn--small"
            disabled={!rateDate || !rateValue.trim()}
            onClick={() => {
              try {
                dispatch(upsertRate({ currency: rateCur, date: rateDate, rate: parseMoney(rateValue) }))
                setRateValue('')
              } catch { /* некорректный курс — игнорируем */ }
            }}
          >Добавить курс</button>
        </div>
      </section>
    </div>
  )
}
