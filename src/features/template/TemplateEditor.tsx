import { useState } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { selectItems, selectCategories, selectActiveAccounts } from '../../store/selectors'
import { selectReport, selectPlReport } from '../../store/reportSelectors'
import {
  upsertItem, deleteItem, moveItem,
  saveTemplateVersion, restoreTemplateVersion, deleteTemplateVersion,
} from '../../store/dataSlice'
import { parseFormula } from '../../engine/formula/parser'
import type { Account, AggRule, Category, Item, ItemKind, ReportForm, TemplateVersion } from '../../domain/types'
import type { RootState } from '../../store'

const selectVersions = (s: RootState): TemplateVersion[] => s.data.templateVersions

const KIND_LABEL: Record<ItemKind, string> = {
  header: 'Заголовок', input: 'Ввод', agg: 'Агрегат', calc: 'Формула',
}
const MEASURES: { value: AggRule['measure']; label: string }[] = [
  { value: 'in', label: 'Приход' },
  { value: 'out', label: 'Расход' },
  { value: 'net', label: 'Сальдо' },
  { value: 'balance', label: 'Остаток' },
]

function genCode(): string {
  return 'it_' + Math.random().toString(36).slice(2, 8)
}

function depthOf(code: string, parentByCode: Map<string, string | null>): number {
  let d = 0, cur = parentByCode.get(code) ?? null
  const seen = new Set<string>()
  while (cur && !seen.has(cur)) { seen.add(cur); d++; cur = parentByCode.get(cur) ?? null }
  return d
}

export default function TemplateEditor({ form = 'cf' }: { form?: ReportForm }) {
  const dispatch = useAppDispatch()
  const allItems = useAppSelector(selectItems)
  const categories = useAppSelector(selectCategories)
  const accounts = useAppSelector(selectActiveAccounts)
  const cfReport = useAppSelector(selectReport)
  const plReport = useAppSelector(selectPlReport)
  const versions = useAppSelector(selectVersions)
  const [versionName, setVersionName] = useState('')

  const items = allItems.filter((i) => i.form === form)
  const report = form === 'pl' ? plReport : cfReport
  const parentByCode = new Map(items.map((i) => [i.code, i.parentCode]))
  const sorted = [...items].sort((a, b) => a.order - b.order)
  const maxOrder = items.reduce((m, i) => Math.max(m, i.order), 0)

  function patch(item: Item, over: Partial<Item>) {
    dispatch(upsertItem({ ...item, ...over }))
  }

  function changeKind(item: Item, kind: ItemKind) {
    const next: Item = { ...item, kind }
    if (kind === 'agg') { next.aggRule = item.aggRule ?? { measure: 'in' }; next.formulaDefault = undefined }
    else if (kind === 'calc') { next.formulaDefault = item.formulaDefault ?? 'SUM(children)'; next.aggRule = undefined }
    else { next.aggRule = undefined; next.formulaDefault = undefined }
    dispatch(upsertItem(next))
  }

  function addItem(parentCode: string | null) {
    const base = {
      templateId: items[0]?.templateId ?? (form === 'pl' ? 'tpl-pl' : 'tpl-dds'),
      code: genCode(),
      parentCode,
      order: maxOrder + 1,
      form,
      name: 'Новая статья',
    }
    // для форм без журнала (P&L) новая статья — ручной ввод; для ДДС — агрегат
    dispatch(upsertItem(
      form === 'pl'
        ? { ...base, kind: 'input' as const }
        : { ...base, kind: 'agg' as const, aggRule: { measure: 'in' } },
    ))
  }

  return (
    <div className="tpl">
      <div className="tpl__pane">
        <div className="tpl__header">
          <div>
            <div className="tpl__eyebrow">Структура отчёта</div>
            <h2 className="tpl__title">Редактор шаблона {form === 'pl' ? 'P&L' : 'ДДС'}</h2>
          </div>
          <button className="btn btn--primary btn--small" onClick={() => addItem(null)}>
            + Статья верхнего уровня
          </button>
        </div>
        {report.error && <div className="tpl__error">⚠ {report.error}</div>}
        <div className="tpl__main">

        <table className="tpl__table">
          <thead>
            <tr>
              <th>Статья</th><th>Вид</th><th>Правило / формула</th><th>Родитель</th><th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => {
              const depth = depthOf(item.code, parentByCode)
              return (
                <tr key={item.id} className={`tpl__row tpl__row--${item.kind}`}>
                  <td style={{ paddingLeft: 8 + depth * 16 }}>
                    <span className="tpl__grip" title="Порядок и вложенность">⋮⋮</span>
                    <input className="tpl__name" value={item.name}
                      onChange={(e) => patch(item, { name: e.target.value })} />
                    <span className="tpl__code">{item.code}</span>
                  </td>
                  <td>
                    <select value={item.kind} onChange={(e) => changeKind(item, e.target.value as ItemKind)}>
                      {(Object.keys(KIND_LABEL) as ItemKind[]).map((k) => (
                        <option key={k} value={k}>{KIND_LABEL[k]}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <RuleEditor item={item} categories={categories} accounts={accounts} onPatch={patch} />
                  </td>
                  <td>
                    <select value={item.parentCode ?? ''}
                      onChange={(e) => patch(item, { parentCode: e.target.value || null })}>
                      <option value="">— нет —</option>
                      {items.filter((i) => i.code !== item.code).map((i) => (
                        <option key={i.code} value={i.code}>{i.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="tpl__actions">
                    <button className="btn btn--small" title="Вверх" onClick={() => dispatch(moveItem({ code: item.code, dir: 'up' }))}>↑</button>
                    <button className="btn btn--small" title="Вниз" onClick={() => dispatch(moveItem({ code: item.code, dir: 'down' }))}>↓</button>
                    <button className="btn btn--small" title="Добавить дочернюю" onClick={() => addItem(item.code)}>+</button>
                    <button className="btn btn--small btn--danger" title="Удалить" onClick={() => dispatch(deleteItem(item.code))}>✕</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      <aside className="tpl__versions">
        <h3>Версии шаблона</h3>
        <div className="tpl__save">
          <input placeholder="имя версии" value={versionName} onChange={(e) => setVersionName(e.target.value)} />
          <button className="btn btn--primary btn--small" disabled={!versionName.trim()}
            onClick={() => { dispatch(saveTemplateVersion(versionName.trim())); setVersionName('') }}>
            Сохранить снимок
          </button>
        </div>
        <ul className="tpl__vlist">
          {[...versions].reverse().map((v) => (
            <li key={v.id} className="tpl__vitem">
              <div>
                <div className="tpl__vname">{v.name}</div>
                <div className="tpl__vdate">{new Date(v.createdAt).toLocaleString('ru')} · {v.items.length} статей</div>
              </div>
              <div className="tpl__vactions">
                <button className="btn btn--small" onClick={() => dispatch(restoreTemplateVersion(v.id))}>Восстановить</button>
                <button className="btn btn--small btn--danger" onClick={() => dispatch(deleteTemplateVersion(v.id))}>✕</button>
              </div>
            </li>
          ))}
          {versions.length === 0 && <li className="tpl__empty">Снимков пока нет</li>}
        </ul>
      </aside>
    </div>
  )
}

function RuleEditor({
  item, categories, accounts, onPatch,
}: {
  item: Item
  categories: Category[]
  accounts: Account[]
  onPatch: (item: Item, over: Partial<Item>) => void
}) {
  if (item.kind === 'agg') {
    const rule = item.aggRule ?? { measure: 'in' as const }
    const setRule = (over: Partial<AggRule>) => onPatch(item, { aggRule: { ...rule, ...over } })
    return (
      <div className="tpl__rule">
        <select value={rule.measure} onChange={(e) => setRule({ measure: e.target.value as AggRule['measure'] })}>
          {MEASURES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        {rule.measure === 'balance' ? (
          <select value={rule.accountCode ?? ''} onChange={(e) => setRule({ accountCode: e.target.value || undefined })}>
            <option value="">все счета</option>
            {accounts.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
          </select>
        ) : (
          <select value={rule.categoryCode ?? ''} onChange={(e) => setRule({ categoryCode: e.target.value || undefined })}>
            <option value="">все категории</option>
            {categories.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        )}
      </div>
    )
  }
  if (item.kind === 'calc') {
    const formula = item.formulaDefault ?? ''
    let err = ''
    try { if (formula.trim()) parseFormula(formula) } catch (e) { err = e instanceof Error ? e.message : String(e) }
    return (
      <div className="tpl__rule tpl__rule--calc">
        <input className={`tpl__formula ${err ? 'tpl__formula--err' : ''}`} value={formula}
          spellCheck={false} onChange={(e) => onPatch(item, { formulaDefault: e.target.value })} />
        {err && <span className="tpl__formula-err">{err}</span>}
      </div>
    )
  }
  return <span className="tpl__muted">{item.kind === 'header' ? '—' : 'ручной ввод'}</span>
}
