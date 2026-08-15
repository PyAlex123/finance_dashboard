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
import { t } from '../../i18n'
import { useT } from '../../i18n/react'

// Функция, а не константа: подписи направлений зависят от языка.
const dirLabels = (): Record<CategoryDirection, string> => ({
  in: t('refs.dir.in'), out: t('refs.dir.out'), transfer: t('refs.dir.transfer'),
})
const CURRENCIES: Currency[] = ['UZS', 'USD']

/** Поле кода: правится вручную, применяется по потере фокуса/Enter. */
function CodeCell({ code, onRename }: { code: string; onRename: (next: string) => void }) {
  const [draft, setDraft] = useState(code)
  const [err, setErr] = useState('')
  function commit() {
    const next = draft.trim()
    if (next === code) return setErr('')
    if (!isValidCode(next)) { setErr(t('refs.code.invalid')); setDraft(code); return }
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
  useT() // подписка на смену языка для всего экрана
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
        <h3>{t('refs.accounts')}</h3>
        <table className="refs__table">
          <thead><tr><th>{t('common.code')}</th><th>{t('common.name')}</th><th>{t('common.currency')}</th><th>{t('refs.col.active')}</th><th>{t('refs.col.duplicate')}</th><th></th></tr></thead>
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
                    aria-label={t('refs.account.active', { name: a.name })}
                    checked={a.active}
                    onChange={(e) => dispatch(upsertAccount({ ...a, active: e.target.checked }))}
                  />
                </td>
                <td>
                  {CURRENCIES.filter((c) => c !== a.currency).map((c) => (
                    <button
                      key={c}
                      className="btn btn--small"
                      title={t('refs.account.duplicate', { currency: c })}
                      onClick={() => duplicateInCurrency(a, c)}
                    >
                      + {c}
                    </button>
                  ))}
                </td>
                <td><button className="btn btn--small btn--danger" onClick={() => dispatch(deleteAccount(a.id))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="refs__add">
          <input placeholder={t('refs.account.placeholder')} value={accName} onChange={(e) => setAccName(e.target.value)} />
          <select aria-label={t('refs.account.currency')} value={accCur} onChange={(e) => setAccCur(e.target.value as Currency)}>
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
          >{t('refs.account.add')}</button>
        </div>
      </section>

      <section className="refs__section">
        <h3>{t('refs.categories')}</h3>
        <table className="refs__table">
          <thead><tr><th>{t('common.code')}</th><th>{t('common.name')}</th><th>{t('refs.col.direction')}</th><th></th></tr></thead>
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
                <td>{dirLabels()[c.direction]}</td>
                <td><button className="btn btn--small btn--danger" onClick={() => dispatch(deleteCategory(c.id))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="refs__add">
          <input placeholder={t('refs.category.placeholder')} value={catName} onChange={(e) => setCatName(e.target.value)} />
          <select aria-label={t('refs.category.direction')} value={catDir} onChange={(e) => setCatDir(e.target.value as CategoryDirection)}>
            <option value="in">{t('refs.dir.in')}</option><option value="out">{t('refs.dir.out')}</option><option value="transfer">{t('refs.dir.transfer')}</option>
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
          >{t('refs.category.add')}</button>
        </div>
      </section>

      <section className="refs__section">
        <h3>{t('refs.rates')}</h3>
        <p className="refs__hint">{t('refs.rates.hint')}</p>
        <table className="refs__table">
          <thead><tr><th>{t('common.currency')}</th><th>{t('common.date')}</th><th>{t('refs.col.rate')}</th><th></th></tr></thead>
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
          <select aria-label={t('refs.rate.currency')} value={rateCur} onChange={(e) => setRateCur(e.target.value as Currency)}>
            {CURRENCIES.filter((c) => c !== 'UZS').map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input aria-label={t('refs.rate.date')} type="date" value={rateDate} onChange={(e) => setRateDate(e.target.value)} />
          <input placeholder={t('refs.rate.placeholder')} value={rateValue} onChange={(e) => setRateValue(e.target.value)} />
          <button
            className="btn btn--primary btn--small"
            disabled={!rateDate || !rateValue.trim()}
            onClick={() => {
              try {
                dispatch(upsertRate({ currency: rateCur, date: rateDate, rate: parseMoney(rateValue) }))
                setRateValue('')
              } catch { /* некорректный курс — игнорируем */ }
            }}
          >{t('refs.rate.add')}</button>
        </div>
      </section>
    </div>
  )
}
