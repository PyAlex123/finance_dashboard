// Фирменный логотип finlo — разметка один в один из logos/*.svg (геометрия бублика:
// координаты, толщины и dasharray — часть знака, менять нельзя). Между вариантами
// различаются только цвета: `ink` — для светлого фона, `paper` — для тёмного.
//
// SVG именно инлайновый, а не <img src>: в локапе слово набрано <text> шрифтом
// Manrope, а шрифты страницы применяются только к SVG внутри DOM — во внешней
// картинке начертание уехало бы на системное.

export type LogoTone = 'ink' | 'paper'

interface LogoProps {
  tone?: LogoTone
  className?: string
}

/** Цвета бублика-«о»: внешнее кольцо, крупный сектор, акцентный сектор. */
function donutColors(tone: LogoTone) {
  return tone === 'paper'
    ? { ring: '#14584A', major: '#F4F7F5', accent: '#1FA37F', word: '#F4F7F5' }
    : { ring: '#8FD9C2', major: '#0B3B32', accent: '#1FA37F', word: '#0B3B32' }
}

/** Логотип целиком: «Finl» + бублик вместо «o» (logos/finlo-logo[-dark].svg). */
export function FinloLockup({ tone = 'ink', className }: LogoProps) {
  const c = donutColors(tone)
  return (
    <svg
      className={className}
      viewBox="0 0 122 62"
      role="img"
      aria-label="finlo"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>finlo</title>
      <text
        x="0" y="48"
        fontFamily="Manrope, system-ui, sans-serif"
        fontSize="46" fontWeight="500" letterSpacing="-1.5"
        fill={c.word}
      >
        Finl
      </text>
      <circle cx="99" cy="31" r="17" fill="none" stroke={c.ring} strokeWidth="9" />
      <circle
        cx="99" cy="31" r="17" fill="none" stroke={c.major} strokeWidth="9"
        strokeDasharray="42.72 64.09" transform="rotate(-90 99 31)"
      />
      <circle
        cx="99" cy="31" r="17" fill="none" stroke={c.accent} strokeWidth="9"
        strokeDasharray="32.04 74.77" strokeDashoffset="-42.72" transform="rotate(-90 99 31)"
      />
    </svg>
  )
}

/** Только знак — бублик-«о» (logos/finlo-mark-o[-dark].svg). */
export function FinloMark({ tone = 'ink', className }: LogoProps) {
  const c = donutColors(tone)
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      role="img"
      aria-label="finlo"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>finlo</title>
      <circle cx="50" cy="50" r="32" fill="none" stroke={c.ring} strokeWidth="17" />
      <circle
        cx="50" cy="50" r="32" fill="none" stroke={c.major} strokeWidth="17"
        strokeDasharray="80.42 120.64" transform="rotate(-90 50 50)"
      />
      <circle
        cx="50" cy="50" r="32" fill="none" stroke={c.accent} strokeWidth="17"
        strokeDasharray="60.32 140.74" strokeDashoffset="-80.42" transform="rotate(-90 50 50)"
      />
    </svg>
  )
}
