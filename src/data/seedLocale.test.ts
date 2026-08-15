// Локализация данных-семян: язык фиксируется в момент создания.
//
// Проверяется главное свойство принятого решения — новое рабочее пространство
// рождается на текущем языке, но уже созданные данные никто задним числом не
// переводит. Коды при этом от языка не зависят: на них держатся формулы,
// overrides и drill-down.

import { describe, it, expect, afterEach } from 'vitest'
import { buildFixtureSnapshot, buildEmptySnapshot, defaultAccounts } from './fixtures'
import { buildDdsItems, ddsTemplate } from './ddsTemplate'
import { buildPlItems } from './plTemplate'
import { buildBsItems } from './bsTemplate'
import { setLocaleForTests } from '../i18n/locale'
import { t } from '../i18n'

afterEach(() => setLocaleForTests('ru'))

describe('шаблоны отчётов', () => {
  it.each([
    ['dds', buildDdsItems],
    ['pl', buildPlItems],
    ['bs', buildBsItems],
  ] as const)('«%s»: коды одинаковы во всех языках, названия — нет', (_form, build) => {
    const ru = build('ru')
    const en = build('en')
    expect(en.map((i) => i.code)).toEqual(ru.map((i) => i.code))
    expect(en.map((i) => i.parentCode)).toEqual(ru.map((i) => i.parentCode))
    expect(en.map((i) => i.formulaDefault)).toEqual(ru.map((i) => i.formulaDefault))
    expect(en.map((i) => i.name)).not.toEqual(ru.map((i) => i.name))
  })

  it('английский шаблон ДДС не содержит кириллицы', () => {
    for (const item of buildDdsItems('en')) {
      expect(item.name).not.toMatch(/[А-Яа-яЁё]/)
    }
  })

  it('язык берётся в момент вызова, а не при импорте модуля', () => {
    setLocaleForTests('en')
    const items = buildDdsItems()
    expect(items[0].name).toBe(t('seed.dds.s_totals', undefined, 'en'))
    setLocaleForTests('ru')
    expect(buildDdsItems()[0].name).toBe(t('seed.dds.s_totals', undefined, 'ru'))
  })

  it('имя шаблона переводится', () => {
    expect(ddsTemplate('ru')[0].name).toBe('ДДС')
    expect(ddsTemplate('en')[0].name).toBe('Cash flow')
  })
})

describe('демо-данные и чистый лист', () => {
  it('английская фикстура собирается целиком на английском', () => {
    setLocaleForTests('en')
    const s = buildFixtureSnapshot()
    const texts = [
      ...s.accounts.map((a) => a.name),
      ...s.categories.map((c) => c.name),
      ...s.operations.map((o) => o.description),
      ...s.operations.map((o) => o.note ?? ''),
      ...s.items.map((i) => i.name),
      ...s.projects.map((p) => p.name),
    ]
    const cyrillic = texts.filter((x) => /[А-Яа-яЁё]/.test(x))
    expect(cyrillic).toEqual([])
  })

  it('структура фикстуры от языка не зависит', () => {
    const ru = buildFixtureSnapshot('ru')
    const en = buildFixtureSnapshot('en')
    expect(en.operations.map((o) => o.id)).toEqual(ru.operations.map((o) => o.id))
    expect(en.operationLines.map((l) => l.amount)).toEqual(ru.operationLines.map((l) => l.amount))
    expect(en.accounts.map((a) => a.code)).toEqual(ru.accounts.map((a) => a.code))
    expect(en.categories.map((c) => c.code)).toEqual(ru.categories.map((c) => c.code))
  })

  it('счета по умолчанию переводятся, коды — нет', () => {
    expect(defaultAccounts('ru').map((a) => a.name)).toEqual(['Р/С', 'Наличные', 'Карта'])
    expect(defaultAccounts('en').map((a) => a.name)).toEqual(['Current a/c', 'Cash', 'Card'])
    expect(defaultAccounts('en').map((a) => a.code)).toEqual(defaultAccounts('ru').map((a) => a.code))
  })

  it('чистый лист создаётся на текущем языке', () => {
    setLocaleForTests('en')
    const s = buildEmptySnapshot()
    expect(s.accounts.map((a) => a.name)).toEqual(['Current a/c', 'Cash', 'Card'])
    expect(s.templates[0].name).toBe('Cash flow')
  })

  // Суть решения «локализовать при создании»: язык замерзает в данных.
  it('созданные данные не перепереводятся при смене языка', () => {
    setLocaleForTests('en')
    const snapshot = buildFixtureSnapshot()
    const namesAtCreation = snapshot.accounts.map((a) => a.name)

    setLocaleForTests('ru')
    expect(snapshot.accounts.map((a) => a.name)).toEqual(namesAtCreation)
    expect(snapshot.accounts.map((a) => a.name)).not.toContain('Наличные (сум)')
  })
})
