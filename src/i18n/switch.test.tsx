// Переключение языка целиком, через настоящий интерфейс.
//
// Все прочие тесты проверяют слои по отдельности. Здесь — сквозная проверка:
// нажатие на «EN» обязано перевести и статичные подписи, и то, что рождается
// в мемоизированных селекторах (авто-статьи ДДС, заголовки периодов), и
// атрибут lang у документа.

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import App from '../App'
import LangSwitch from '../features/ui/LangSwitch'
import { makeStore } from '../store'
import { bindLocaleToStore } from '../store/bindLocale'
import { applyDocumentLocale } from './documentMeta'
import { setLocaleForTests, subscribeLocale } from './locale'
import { t, LOCALES, OFFERED_LOCALES } from './index'

function renderApp() {
  const store = makeStore()
  const unbind = bindLocaleToStore(store)
  const unmeta = subscribeLocale(applyDocumentLocale)
  const utils = render(
    <Provider store={store}>
      <App />
    </Provider>,
  )
  return { ...utils, store, cleanupHooks: () => { unbind(); unmeta() } }
}

afterEach(() => {
  cleanup()
  setLocaleForTests('ru')
})

describe('переключение языка в кабинете', () => {
  it('вкладки переводятся по нажатию на EN и возвращаются по RU', async () => {
    const user = userEvent.setup()
    const { cleanupHooks } = renderApp()

    expect(screen.getByRole('button', { name: 'Журнал' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'EN' }))
    expect(screen.getByRole('button', { name: 'Journal' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Журнал' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'RU' }))
    expect(screen.getByRole('button', { name: 'Журнал' })).toBeInTheDocument()

    cleanupHooks()
  })

  it('заголовок рабочей области переводится', async () => {
    const user = userEvent.setup()
    const { cleanupHooks } = renderApp()

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t('app.title.cf', undefined, 'ru'))
    await user.click(screen.getByRole('button', { name: 'EN' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t('app.title.cf', undefined, 'en'))

    cleanupHooks()
  })

  // Прямой сторож границы мемоизации: эти строки приходят из reselect, а не из
  // JSX. Без selectLocale во входах селектора тест падает.
  it('авто-статьи отчёта ДДС и подписи месяцев переводятся', async () => {
    const user = userEvent.setup()
    const { cleanupHooks } = renderApp()

    await user.click(screen.getByRole('button', { name: 'Отчёт ДДС' }))
    const reportRu = screen.getByRole('table')
    expect(within(reportRu).getByText(t('autocf.section.in', undefined, 'ru'))).toBeInTheDocument()
    expect(within(reportRu).getByText(/Январь/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'EN' }))
    const reportEn = screen.getByRole('table')
    expect(within(reportEn).getByText(t('autocf.section.in', undefined, 'en'))).toBeInTheDocument()
    expect(within(reportEn).getByText(/January/)).toBeInTheDocument()
    expect(within(reportEn).queryByText(/Январь/)).not.toBeInTheDocument()

    cleanupHooks()
  })

  it('атрибут lang у документа следует за выбором', async () => {
    const user = userEvent.setup()
    const { cleanupHooks } = renderApp()

    await user.click(screen.getByRole('button', { name: 'EN' }))
    expect(document.documentElement.lang).toBe('en')

    await user.click(screen.getByRole('button', { name: 'RU' }))
    expect(document.documentElement.lang).toBe('ru')

    cleanupHooks()
  })
})

describe('сам переключатель', () => {
  it('помечает текущий язык для скринридера', async () => {
    const user = userEvent.setup()
    render(<LangSwitch />)

    expect(screen.getByRole('button', { name: 'RU' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: 'EN' }))
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'RU' })).toHaveAttribute('aria-pressed', 'false')
  })

  // Узбекский пока не предлагается: словарь uz заполнен частично, и показывать
  // человеку наполовину переведённый интерфейс хуже, чем русский целиком.
  // Кнопка вернётся, когда 'uz' впишут в OFFERED_LOCALES (см. i18n/types.ts).
  it('предлагает только готовые языки', () => {
    render(<LangSwitch />)
    const group = screen.getByRole('group')
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['RU', 'EN'])
  })

  it('узбекский по-прежнему поддержан в коде, просто не предложен', () => {
    // Словарь и откат живы — иначе сохранённый выбор uz сломал бы приложение.
    expect(LOCALES).toContain('uz')
    expect(OFFERED_LOCALES).not.toContain('uz')
    setLocaleForTests('uz')
    expect(t('app.tab.journal')).toBe('Jurnal')
  })
})
