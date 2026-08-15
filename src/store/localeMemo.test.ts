// Сторож границы мемоизации.
//
// Селекторы reselect мемоизированы по ссылкам на входы. Язык не хранится в
// data, поэтому без selectLocale во входах смена языка НЕ пересчитывала бы
// авто-статьи ДДС, контрольные суммы и подписи месяцев — интерфейс остался бы
// частично русским до первой правки данных. Этот тест падал бы на реализации
// без uiSlice, и в этом весь его смысл.

import { describe, it, expect, afterEach } from 'vitest'
import { makeStore } from './index'
import { bindLocaleToStore } from './bindLocale'
import { selectEffectiveCfItems, selectChecks, selectReport } from './reportSelectors'
import { selectJournalRows } from '../features/journal/journalRows'
import { selectDashboard } from '../features/dashboard/dashboardSelectors'
import { setLocaleForTests } from '../i18n/locale'
import { t } from '../i18n'

function storeWithLocale() {
  const store = makeStore()
  const unbind = bindLocaleToStore(store)
  return { store, unbind }
}

afterEach(() => setLocaleForTests('ru'))

describe('смена языка пробивает мемоизацию селекторов', () => {
  it('авто-статьи ДДС переводятся без правки данных', () => {
    const { store, unbind } = storeWithLocale()
    const before = selectEffectiveCfItems(store.getState())
    expect(before.map((i) => i.name)).toContain(t('autocf.section.in', undefined, 'ru'))

    setLocaleForTests('en')
    const after = selectEffectiveCfItems(store.getState())
    unbind()

    expect(after.map((i) => i.name)).toContain(t('autocf.section.in', undefined, 'en'))
    expect(after.map((i) => i.name)).not.toContain(t('autocf.section.in', undefined, 'ru'))
  })

  it('коды статей от языка не зависят — overrides не рвутся', () => {
    const { store, unbind } = storeWithLocale()
    const codesRu = selectEffectiveCfItems(store.getState()).map((i) => i.code)
    setLocaleForTests('en')
    const codesEn = selectEffectiveCfItems(store.getState()).map((i) => i.code)
    unbind()
    expect(codesEn).toEqual(codesRu)
  })

  it('заголовки контрольных сумм переводятся', () => {
    const { store, unbind } = storeWithLocale()
    const before = selectChecks(store.getState()).map((c) => c.title)
    setLocaleForTests('en')
    const after = selectChecks(store.getState()).map((c) => c.title)
    unbind()
    expect(before).toContain(t('checks.balance.title', undefined, 'ru'))
    expect(after).toContain(t('checks.balance.title', undefined, 'en'))
  })

  it('подписи месяцев в дашборде переводятся', () => {
    const { store, unbind } = storeWithLocale()
    const before = selectDashboard(store.getState()).monthLabels
    setLocaleForTests('en')
    const after = selectDashboard(store.getState()).monthLabels
    unbind()
    expect(before[0]).toBe('Январь')
    expect(after[0]).toBe('January')
  })

  it('подписи типов операций в журнале переводятся', () => {
    const { store, unbind } = storeWithLocale()
    const before = selectJournalRows(store.getState()).map((r) => r.typeLabel)
    setLocaleForTests('en')
    const after = selectJournalRows(store.getState()).map((r) => r.typeLabel)
    unbind()
    expect(before).toContain(t('journal.type.income', undefined, 'ru'))
    expect(after).toContain(t('journal.type.income', undefined, 'en'))
  })

  it('числа отчёта от языка не зависят — переводятся только подписи', () => {
    const { store, unbind } = storeWithLocale()
    const before = selectReport(store.getState())
    setLocaleForTests('en')
    const after = selectReport(store.getState())
    unbind()
    expect(after.rows.map((r) => r.values)).toEqual(before.rows.map((r) => r.values))
    expect(after.periods).toEqual(before.periods)
  })

  it('без моста в стор язык в состоянии не меняется (мост обязателен)', () => {
    const store = makeStore() // намеренно без bindLocaleToStore
    const before = store.getState().ui.locale
    setLocaleForTests('en')
    expect(store.getState().ui.locale).toBe(before)
  })
})
