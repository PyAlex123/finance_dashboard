import { describe, it, expect } from 'vitest'
import { buildEmptySnapshot } from './fixtures'
import { buildReport } from '../engine/report'
import { runChecks, allChecksOk } from '../engine/checks'
import { exportJson, importJson } from './json'

describe('пустой снимок (чистый лист)', () => {
  it('данных нет, но есть счета по умолчанию и пустой шаблон', () => {
    const s = buildEmptySnapshot()
    // счета по умолчанию — чтобы можно было сразу вводить операции
    expect(s.accounts.map((a) => a.code)).toEqual(['settlement', 'cash', 'card'])
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
