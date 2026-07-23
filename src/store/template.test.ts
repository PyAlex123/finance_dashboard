import { describe, it, expect } from 'vitest'
import { makeStore } from './index'
import {
  upsertItem, deleteItem, moveItem,
  saveTemplateVersion, restoreTemplateVersion, deleteTemplateVersion,
} from './dataSlice'
import { buildReport } from '../engine/report'
import type { Item } from '../domain/types'

function newItem(code: string, over: Partial<Item> = {}): Omit<Item, 'id'> {
  return { templateId: 'tpl-dds', code, parentCode: null, order: 200, form: 'cf', kind: 'header', name: code, ...over }
}

describe('редьюсеры дерева статей', () => {
  it('upsertItem добавляет и обновляет статью', () => {
    const store = makeStore()
    store.dispatch(upsertItem(newItem('extra', { name: 'Доп' })))
    const added = store.getState().data.items.find((i) => i.code === 'extra')!
    expect(added.id).toBeTruthy()
    store.dispatch(upsertItem({ ...added, name: 'Доп 2' }))
    expect(store.getState().data.items.find((i) => i.code === 'extra')!.name).toBe('Доп 2')
    expect(store.getState().data.items.filter((i) => i.code === 'extra')).toHaveLength(1)
  })

  it('deleteItem переподвешивает детей на родителя удаляемого', () => {
    const store = makeStore()
    // inc_sale/consult/other имеют parentCode = inc_total; удалим inc_total
    store.dispatch(deleteItem('inc_total'))
    const items = store.getState().data.items
    expect(items.find((i) => i.code === 'inc_total')).toBeUndefined()
    // дети теперь висят на родителе inc_total (s_income)
    for (const c of ['inc_sale', 'inc_consult', 'inc_other']) {
      expect(items.find((i) => i.code === c)!.parentCode).toBe('s_income')
    }
  })

  it('moveItem меняет порядок соседей', () => {
    const store = makeStore()
    const order = () => store.getState().data.items
      .filter((i) => i.parentCode === 'exp_total')
      .sort((a, b) => a.order - b.order)
      .map((i) => i.code)
    const before = order()
    store.dispatch(moveItem({ code: before[1], dir: 'up' }))
    const after = order()
    expect(after[0]).toBe(before[1])
    expect(after[1]).toBe(before[0])
  })

  it('правка статьи отражается в отчёте', () => {
    const store = makeStore()
    const sale = store.getState().data.items.find((i) => i.code === 'inc_sale')!
    store.dispatch(upsertItem({ ...sale, name: 'Продажи (переименовано)' }))
    const rep = buildReport(store.getState().data)
    expect(rep.rows.find((r) => r.code === 'inc_sale')!.name).toBe('Продажи (переименовано)')
  })
})

describe('версии шаблона (снимки)', () => {
  it('сохранение, восстановление и удаление версии', () => {
    const store = makeStore()
    store.dispatch(saveTemplateVersion('База'))
    const vid = store.getState().data.templateVersions[0].id

    // изменим дерево
    store.dispatch(deleteItem('inc_other'))
    expect(store.getState().data.items.find((i) => i.code === 'inc_other')).toBeUndefined()

    // восстановление возвращает прежнее дерево и поднимает версию шаблона
    const vbefore = store.getState().data.templates[0].version
    store.dispatch(restoreTemplateVersion(vid))
    expect(store.getState().data.items.find((i) => i.code === 'inc_other')).toBeDefined()
    expect(store.getState().data.templates[0].version).toBe(vbefore + 1)

    store.dispatch(deleteTemplateVersion(vid))
    expect(store.getState().data.templateVersions).toHaveLength(0)
  })
})
