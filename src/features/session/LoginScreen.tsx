import { useState } from 'react'

export default function LoginScreen({ onLogin }: { onLogin: (username: string) => void }) {
  const [name, setName] = useState('')
  const trimmed = name.trim()

  function submit() {
    if (trimmed) onLogin(trimmed)
  }

  return (
    <div className="welcome">
      <div className="welcome__blob welcome__blob--a" aria-hidden="true" />
      <div className="welcome__blob welcome__blob--b" aria-hidden="true" />
      <div className="welcome__card">
        <div className="welcome__logo">₮</div>
        <div className="welcome__eyebrow">Язык денег</div>
        <h1 className="welcome__title">Финансовые отчёты</h1>
        <p className="welcome__subtitle">
          Управленческий учёт вместо Excel: ДДС, P&amp;L и Баланс в одном рабочем пространстве.
        </p>
        <form
          className="welcome__form"
          onSubmit={(e) => { e.preventDefault(); submit() }}
        >
          <input
            className="welcome__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Юзернейм"
            autoFocus
            aria-label="Юзернейм"
          />
          <button className="btn btn--primary welcome__btn" type="submit" disabled={!trimmed}>
            Войти
          </button>
        </form>
        <p className="welcome__hint">Локальная запись, данные хранятся в браузере</p>
      </div>
    </div>
  )
}
