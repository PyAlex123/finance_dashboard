// Витрина токенов и компонентов визуала «Язык денег». Пока минимальная —
// полное наполнение (цвета/типографика/кнопки/бейджи/поля/пустое состояние)
// добавляется на этапе UI-10.

export default function DesignSystemView({ onBack }: { onBack: () => void }) {
  return (
    <div className="ds">
      <header className="ds__top">
        <div>
          <div className="ds__eyebrow">Язык денег · рабочий режим</div>
          <h1 className="ds__title">Дизайн-система</h1>
        </div>
        <button className="btn" onClick={onBack}>← Модули</button>
      </header>
      <p className="placeholder">Витрина токенов и компонентов появится здесь.</p>
    </div>
  )
}
