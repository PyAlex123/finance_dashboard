// Храповик перевода.
//
// Падает на любом кириллическом литерале в коде, кроме файлов из ALLOWLIST.
// Каждая фаза удаляет оттуда свои файлы — и список превращается в объективный
// признак завершённости фазы. Без него у фаз «перевести экраны кабинета» нет
// сигнала готовности: обычные тесты проходят и с наполовину переведённым экраном.
//
// Комментарии не считаются: русский — рабочий язык документации этого проекта.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(__dirname, '..')
const CYRILLIC = /[Ѐ-ӿ]/

/**
 * Файлы, где кириллица остаётся законно.
 *
 * ПОСТОЯННЫЕ (никогда не удаляются) — это данные и логика разбора, а не подписи:
 *   engine/periods.ts       основы названий месяцев для разбора чужих Excel
 *   data/importExcel.ts     регулярки по содержимому загружаемых файлов
 *   data/xlsx.ts            имя листа «Данные» — контракт формата
 *   domain/codes.ts         таблица транслитерации
 *   каталог i18n/dict/ru    сам русский словарь
 *   файлы *.test.ts и .tsx  тесты намеренно проверяют русские подписи
 *   designsystem            мёртвый код: ни одного импортёра
 *   data/persistence.ts     console.warn для разработчика, а не текст интерфейса
 *
 * ВРЕМЕННЫЕ — ждут своей фазы. Список пустеет к фазе 8.
 */
const ALLOWLIST_PERMANENT = [
  'engine/periods.ts',
  'data/importExcel.ts',
  'data/xlsx.ts',
  'domain/codes.ts',
  'features/designsystem/DesignSystemView.tsx',
  'data/persistence.ts',
]

// Пуст: перевод доведён до конца. Если появится новый экран, который нельзя
// перевести сразу, — впишите его сюда и вычеркните, когда переведёте.
const ALLOWLIST_PENDING: string[] = []

const ALLOWLIST = new Set([...ALLOWLIST_PERMANENT, ...ALLOWLIST_PENDING])

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full))
      continue
    }
    if (!/\.tsx?$/.test(entry.name)) continue
    if (/\.test\.tsx?$/.test(entry.name)) continue
    const rel = relative(SRC, full).replace(/\\/g, '/')
    if (rel.startsWith('i18n/dict/ru/')) continue
    if (rel.startsWith('test/')) continue
    out.push(full)
  }
  return out
}

/**
 * Убрать комментарии, сохранив строковые литералы и разбивку по строкам.
 *
 * Регулярками это не делается: `//` встречается внутри строк ('https://…'), а
 * апострофы — внутри комментариев. Поэтому маленький сканер с состоянием.
 * Содержимое комментариев заменяется пробелами, чтобы номера строк не поехали.
 */
function stripComments(code: string): string {
  let out = ''
  let i = 0
  type State = 'code' | 'line' | 'block' | 'single' | 'double' | 'template'
  let state: State = 'code'

  while (i < code.length) {
    const c = code[i]
    const next = code[i + 1]

    if (state === 'code') {
      if (c === '/' && next === '/') { state = 'line'; out += '  '; i += 2; continue }
      if (c === '/' && next === '*') { state = 'block'; out += '  '; i += 2; continue }
      if (c === "'") state = 'single'
      else if (c === '"') state = 'double'
      else if (c === '`') state = 'template'
      out += c
      i++
      continue
    }

    if (state === 'line') {
      if (c === '\n') { state = 'code'; out += c } else out += ' '
      i++
      continue
    }

    if (state === 'block') {
      if (c === '*' && next === '/') { state = 'code'; out += '  '; i += 2; continue }
      out += c === '\n' ? c : ' '
      i++
      continue
    }

    // внутри строкового литерала: \\ экранирует следующий символ
    if (c === '\\') { out += code.slice(i, i + 2); i += 2; continue }
    if ((state === 'single' && c === "'") ||
        (state === 'double' && c === '"') ||
        (state === 'template' && c === '`')) {
      state = 'code'
    }
    out += c
    i++
  }
  return out
}

describe('храповик перевода', () => {
  const files = sourceFiles(SRC)

  it('находит исходники (проверка самого обхода)', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('вне списка ожидания не осталось русского текста', () => {
    const offenders: string[] = []
    for (const file of files) {
      const rel = relative(SRC, file).replace(/\\/g, '/')
      if (ALLOWLIST.has(rel)) continue
      const code = stripComments(readFileSync(file, 'utf8'))
      const lines = code.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (CYRILLIC.test(lines[i])) offenders.push(`${rel}:${i + 1}  ${lines[i].trim()}`)
      }
    }
    expect(offenders).toEqual([])
  })

  // Обратная сторона храповика: файл, уже переведённый, но забытый в списке,
  // ослабляет проверку молча. Заставляем чистить список.
  it('в списке ожидания нет уже переведённых файлов', () => {
    const stale: string[] = []
    for (const rel of ALLOWLIST_PENDING) {
      const file = join(SRC, rel)
      let code: string
      try {
        code = stripComments(readFileSync(file, 'utf8'))
      } catch {
        stale.push(`${rel} — файла нет, запись устарела`)
        continue
      }
      if (!CYRILLIC.test(code)) stale.push(`${rel} — переведён, удалите из ALLOWLIST_PENDING`)
    }
    expect(stale).toEqual([])
  })
})
