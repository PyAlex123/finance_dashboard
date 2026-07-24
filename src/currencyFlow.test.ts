// Сценарий пользователя: карта в сумах + «кнопочка» создать такую же карту в долларах.
// Долларовая карта — отдельная колонка журнала, суммы вводятся в USD,
// курс подтягивается из справочника, а итоговый отчёт считается в одной валюте — в сумах.

import { describe, it, expect } from 'vitest'
import { makeStore } from './store'
import { hydrate, addOperation, upsertAccount, upsertRate, upsertCategory, seedItems } from './store/dataSlice'
import { buildEmptySnapshot } from './data/fixtures'
import { generateDdsTemplate } from './data/importExcel'
import { buildReport } from './engine/report'
import { runChecks } from './engine/checks'
import { autoCode } from './domain/codes'
import { fromMajor } from './domain/money'

describe('карта в сумах + карта в долларах → отчёт в сумах', () => {
  it('полный сценарий', () => {
    const store = makeStore()
    store.dispatch(hydrate(buildEmptySnapshot()))

    // 1) есть карта в сумах (счёт по умолчанию)
    const cardUzs = store.getState().data.accounts.find((a) => a.name === 'Карта')!
    expect(cardUzs.currency).toBe('UZS')

    // 2) «кнопочка» — создаём такую же карту в долларах (отдельный счёт-колонка)
    const dupName = `${cardUzs.name} (USD)`
    store.dispatch(upsertAccount({
      code: autoCode(dupName, store.getState().data.accounts.map((a) => a.code)),
      name: dupName, currency: 'USD', order: 4, active: true,
    }))
    const cardUsd = store.getState().data.accounts.find((a) => a.name === 'Карта (USD)')!
    expect(cardUsd.currency).toBe('USD')

    // 3) курс подтягивается из справочника
    store.dispatch(upsertRate({ currency: 'USD', date: '2025-05-01', rate: fromMajor(12500) }))

    // категория дохода + дерево статей отчёта
    store.dispatch(upsertCategory({ code: 'sale', name: 'Продажи', direction: 'in', order: 1 }))
    const cats = store.getState().data.categories
    store.dispatch(seedItems({ items: generateDdsTemplate(store.getState().data.accounts, cats) }))
    const saleId = cats[0].id

    // 4) операции: 1 000 000 сум на сумовую карту и $100 на долларовую
    store.dispatch(addOperation({
      operation: { date: '2025-05-10', type: 'income', description: 'В сумах', categoryId: saleId },
      lines: [{ accountId: cardUzs.id, amount: fromMajor(1000000), currency: 'UZS' }],
    }))
    store.dispatch(addOperation({
      operation: { date: '2025-05-11', type: 'income', description: 'В долларах', categoryId: saleId },
      lines: [{ accountId: cardUsd.id, amount: fromMajor(100), currency: 'USD' }],
    }))

    // 5) отчёт — в одной валюте (сумы): 1 000 000 + 100 × 12 500 = 2 250 000
    const rep = buildReport(store.getState().data, { form: 'cf' })
    const row = (code: string) => rep.rows.find((r) => r.code === code)!.values[0]
    expect(row('v_total_in')).toBe(fromMajor(2250000))

    // остатки: сумовая карта как есть, долларовая — пересчитана в сумы
    expect(row(`bal_${cardUzs.code}`)).toBe(fromMajor(1000000))
    expect(row(`bal_${cardUsd.code}`)).toBe(fromMajor(1250000))
    expect(row('bal_total')).toBe(fromMajor(2250000))

    // 6) все контрольные суммы сходятся, включая «курсы заданы»
    const checks = runChecks(store.getState().data)
    expect(checks.find((c) => c.id === 'rates-available')!.ok).toBe(true)
    expect(checks.every((c) => c.ok)).toBe(true)
  })
})
