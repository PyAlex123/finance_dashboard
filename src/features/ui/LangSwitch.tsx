// Переключатель языка. Кнопки, а не <select>: три варианта помещаются в строку,
// это тише вписывается в оформление лендинга и даёт тестам устойчивый
// getByRole('button', { name: 'EN' }).
//
// Отдельный компонент, а НЕ выпадающее меню в ProfileBadge: бейдж рисуется по
// условию {username && …}, то есть в локальном режиме и почти во всех тестах
// его нет — переключатель оказался бы недоступен ровно там, где его нужно
// нажимать.

import { OFFERED_LOCALES, LOCALE_LABEL, setLocale } from '../../i18n'
import { useLocale, useT } from '../../i18n/react'

export default function LangSwitch({ className = '' }: { className?: string }) {
  const current = useLocale()
  const t = useT()

  return (
    <div
      className={`langswitch ${className}`.trim()}
      role="group"
      aria-label={t('lang.switchLabel')}
    >
      {OFFERED_LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          className={`langswitch__btn ${locale === current ? 'is-active' : ''}`}
          aria-pressed={locale === current}
          onClick={() => setLocale(locale)}
        >
          {LOCALE_LABEL[locale]}
        </button>
      ))}
    </div>
  )
}
