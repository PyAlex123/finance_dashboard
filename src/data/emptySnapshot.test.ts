import { describe, it, expect } from 'vitest'
import { buildEmptySnapshot } from './fixtures'
import { buildReport } from '../engine/report'
import { runChecks, allChecksOk } from '../engine/checks'
import { exportJson, importJson } from './json'

describe('пустой снимок (чистый лист)', () => {
  it('все сущности пусты, есть один пустой шаблон', () => {
    const s = buildEmptySnapshot()
    expect(s.accounts).toHaveLength(0)
    expect(s.categories).toHaveLength(0)
    expect(s.operations).toHaveLength(0)
    expect(s.items).toHaveLength(0)
    expect(s.templates).toHaveLength(1)
    expect(s.templateVersions).toHaveLength(0)
  })

  it('отчёт строится без ошибок и без строк/периодов', () => {
    const rep = buildReport(buildEmptySnapshot())
    expect(rep.error).toBeUndefined()
    expect(rep.rows).toHaveLength(0)
    expect(rep.periods).toHaveLength(0)
  })

  it('контрольные суммы на пустом сходятся', () => {
    expect(allChecksOk(runChecks(buildEmptySnapshot()))).toBe(true)
  })

  it('пустой снимок переживает JSON round-trip', () => {
    const s = buildEmptySnapshot()
    expect(importJson(exportJson(s))).toEqual(s)
  })
})
