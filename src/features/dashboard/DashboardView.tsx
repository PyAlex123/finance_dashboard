// Дашборд ДДС: KPI + 4 графика. Все числа реальные — из selectDashboard
// (агрегаты журнала). Графики — inline-SVG, палитра forest (провалидирована).

import { useAppSelector } from '../../store/hooks'
import { selectDashboard, type DashboardData } from './dashboardSelectors'
import { formatMoney, type Money } from '../../domain/money'
import { useViewMode } from '../shell/ViewMode'
import { t } from '../../i18n'
import { useT } from '../../i18n/react'
import { formatNumber } from '../../i18n/format'

// Палитра дашборда (провалидирована validate_palette): приход/накопление —
// accent, расход — терракота, счёт — forest. Донат: accent→slate→expense→forest→mint.
const C = {
  accent: '#1fa37f', expense: '#b85c38', slate: '#4a6b84', forest: '#0b3b32',
  mint: '#8fd9c2', grid: '#eef3f1', axis: '#dce6e1', muted: '#68807a',
}
const DONUT = [C.accent, C.slate, C.expense, C.forest, C.mint]

// Своё форматирование, а не toLocaleString: группировка Intl различается между
// сборками ICU в Node (тесты стали бы плавающими), а прежняя замена пробела на
// U+00A0 молча сломалась бы на en-US, где разделителем идут запятые.
const fmtShort = (n: number) => formatNumber(n)

/** Точки спарклайна в viewBox 0 0 88 20 (y инвертирован). */
function spark(vals: number[]): string {
  if (vals.length === 0) return ''
  const max = Math.max(...vals, 1)
  const min = Math.min(...vals, 0)
  const range = max - min || 1
  const w = 88, h = 20, pad = 2
  return vals
    .map((v, i) => {
      const x = vals.length === 1 ? w / 2 : (i / (vals.length - 1)) * w
      const y = h - pad - ((v - min) / range) * (h - 2 * pad)
      return `${x.toFixed(0)},${y.toFixed(0)}`
    })
    .join(' ')
}

export default function DashboardView() {
  useT() // подписка на смену языка для всего экрана
  const d = useAppSelector(selectDashboard)
  const mobile = useViewMode() === 'mobile'

  if (!d.hasData) {
    return (
      <div className="dash">
        <div className="dash__eyebrow">{t('dashboard.eyebrow')}</div>
        <h2 className="dash__title">{t('dashboard.title')}</h2>
        <p className="placeholder">
          {t('dashboard.empty')}
        </p>
      </div>
    )
  }

  const kpis: { label: string; value: Money; sub: string; color: string; series: number[] }[] = [
    { label: t('dashboard.kpi.totalIn'), value: d.kpis.totalIn, sub: t('dashboard.kpi.sub.period'), color: C.accent, series: d.inByPeriod },
    { label: t('dashboard.kpi.totalOut'), value: d.kpis.totalOut, sub: t('dashboard.kpi.sub.period'), color: C.expense, series: d.outByPeriod },
    { label: t('dashboard.kpi.result'), value: d.kpis.result, sub: t('dashboard.kpi.sub.formula'), color: C.forest, series: d.resultByPeriod },
    { label: t('dashboard.kpi.ending'), value: d.kpis.endingBalance, sub: t('dashboard.kpi.sub.allAccounts'), color: C.slate, series: d.balanceByPeriod },
  ]

  return (
    <div className={`dash ${mobile ? 'dash--mobile' : ''}`}>
      <div className="dash__eyebrow">{t('dashboard.eyebrow')}</div>
      <h2 className="dash__title">{t('dashboard.title')}</h2>

      <div className="dash__kpis">
        {kpis.map((k) => (
          <div key={k.label} className="kpi">
            <div className="kpi__label" style={{ color: k.color }}>{k.label}</div>
            <div className="kpi__row">
              <div className="kpi__value" style={{ color: k.color }}>{formatMoney(k.value)}</div>
              <svg className="kpi__spark" viewBox="0 0 88 20" preserveAspectRatio="none" aria-hidden="true">
                <polyline points={spark(k.series)} fill="none" stroke={k.color} strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" opacity=".85" />
              </svg>
            </div>
            <div className="kpi__sub">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="dash__charts">
        <ChartCard title={t('dashboard.chart.inOut')}>
          <InOutBars data={d} />
          <div className="chart__legend">
            <span className="chart__leg"><i style={{ background: C.accent }} />{t('dashboard.legend.in')}</span>
            <span className="chart__leg"><i style={{ background: C.expense }} />{t('dashboard.legend.out')}</span>
          </div>
        </ChartCard>

        <ChartCard title={t('dashboard.chart.byCategory')}>
          <Donut data={d} />
        </ChartCard>

        <ChartCard title={d.mainAccount ? t('dashboard.chart.balanceNamed', { name: d.mainAccount.name }) : t('dashboard.chart.balance')}>
          <BalanceBars data={d} />
        </ChartCard>

        <ChartCard title={t('dashboard.chart.result')}>
          <ResultLine data={d} />
        </ChartCard>
      </div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="chart">
      <div className="chart__title">{title}</div>
      {children}
    </div>
  )
}

// --- Приход vs Расход: сгруппированные столбцы по месяцам ---
function InOutBars({ data }: { data: DashboardData }) {
  const n = data.periods.length
  const W = 360, H = 190, base = 150, top = 20, left = 34, right = 8
  const max = Math.max(...data.inByPeriod, ...data.outByPeriod, 1)
  const band = (W - left - right) / Math.max(n, 1)
  const bw = Math.min(26, band / 3)
  const barH = (v: number) => ((v / max) * (base - top))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart__svg">
      {[base, base - (base - top) / 2].map((y, i) => (
        <line key={i} x1={left} y1={y} x2={W - right} y2={y} stroke={i === 0 ? C.axis : C.grid} />
      ))}
      {data.periods.map((_, i) => {
        const cx = left + band * i + band / 2
        const hi = barH(data.inByPeriod[i])
        const ho = barH(data.outByPeriod[i])
        return (
          <g key={i}>
            <rect className="dash-bar" x={cx - bw - 2} y={base - hi} width={bw} height={hi} rx="3" fill={C.accent}
              style={{ animationDelay: `${i * 0.06}s` }}>
              <title>{t('dashboard.tooltip.in', { period: data.monthLabels[i], value: fmtShort(data.inByPeriod[i]) })}</title>
            </rect>
            <rect className="dash-bar" x={cx + 2} y={base - ho} width={bw} height={ho} rx="3" fill={C.expense}
              style={{ animationDelay: `${i * 0.06 + 0.03}s` }}>
              <title>{t('dashboard.tooltip.out', { period: data.monthLabels[i], value: fmtShort(data.outByPeriod[i]) })}</title>
            </rect>
          </g>
        )
      })}
      <g fill={C.muted} fontSize="11" textAnchor="middle" fontFamily="Manrope, sans-serif">
        {data.periods.map((_, i) => (
          <text key={i} x={left + band * i + band / 2} y={base + 17}>{data.monthLabels[i]}</text>
        ))}
      </g>
    </svg>
  )
}

// --- Донат: расходы по категориям ---
function Donut({ data }: { data: DashboardData }) {
  const R = 46, C0 = 60, sw = 18, circ = 2 * Math.PI * R
  let offset = 0
  const slices = data.expenses.map((e, i) => {
    const len = e.share * circ
    const seg = { color: DONUT[i % DONUT.length], dash: `${len} ${circ - len}`, off: -offset, e }
    offset += len
    return seg
  })
  return (
    <div className="donut">
      <svg viewBox="0 0 120 120" className="donut__svg" aria-hidden="true">
        <g transform="rotate(-90 60 60)">
          <circle cx={C0} cy={C0} r={R} fill="none" stroke={C.grid} strokeWidth={sw} />
          {slices.map((s, i) => (
            <circle key={i} cx={C0} cy={C0} r={R} fill="none" stroke={s.color} strokeWidth={sw}
              strokeDasharray={s.dash} strokeDashoffset={s.off}>
              <title>{s.e.name}: {(s.e.share * 100).toFixed(1)}%</title>
            </circle>
          ))}
        </g>
      </svg>
      <div className="donut__legend">
        {data.expenses.map((e, i) => (
          <span key={e.name} className="donut__item">
            <i style={{ background: DONUT[i % DONUT.length] }} />
            {e.name}
            <b>{Math.round(e.share * 100)}%</b>
          </span>
        ))}
        {data.expenses.length === 0 && <span className="donut__empty">{t('dashboard.noExpenses')}</span>}
      </div>
    </div>
  )
}

// --- Остаток главного счёта по датам (один ряд) ---
function BalanceBars({ data }: { data: DashboardData }) {
  const series = data.mainAccount?.series ?? []
  const n = series.length
  const W = 360, H = 190, base = 150, top = 24, left = 34, right = 8
  const max = Math.max(...series, 1)
  const band = (W - left - right) / Math.max(n, 1)
  const bw = Math.min(42, band * 0.5)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart__svg">
      <line x1={left} y1={base} x2={W - right} y2={base} stroke={C.axis} />
      {series.map((v, i) => {
        const h = (v / max) * (base - top)
        const cx = left + band * i + band / 2
        return (
          <rect key={i} className="dash-bar" x={cx - bw / 2} y={base - h} width={bw} height={Math.max(h, 2)} rx="3"
            fill={C.forest} style={{ animationDelay: `${i * 0.07}s` }}>
            <title>{data.monthLabels[i]}: {fmtShort(Math.round(v))}</title>
          </rect>
        )
      })}
      <g fill={C.muted} fontSize="11" textAnchor="middle" fontFamily="Manrope, sans-serif">
        {series.map((_, i) => (
          <text key={i} x={left + band * i + band / 2} y={base + 17}>{data.monthLabels[i]}</text>
        ))}
      </g>
    </svg>
  )
}

// --- Динамика результата (линия) ---
function ResultLine({ data }: { data: DashboardData }) {
  const series = data.resultByPeriod
  const n = series.length
  const W = 360, H = 190, base = 150, top = 24, left = 34, right = 20
  const max = Math.max(...series, 1)
  const min = Math.min(...series, 0)
  const range = max - min || 1
  const x = (i: number) => (n <= 1 ? (left + W - right) / 2 : left + (i / (n - 1)) * (W - left - right))
  const y = (v: number) => base - ((v - min) / range) * (base - top)
  const pts = series.map((v, i) => `${x(i).toFixed(0)},${y(v).toFixed(0)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart__svg">
      <line x1={left} y1={base} x2={W - right} y2={base} stroke={C.axis} />
      <polyline points={pts} fill="none" stroke={C.accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {series.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="4" fill={C.accent}>
          <title>{data.monthLabels[i]}: {fmtShort(Math.round(v))}</title>
        </circle>
      ))}
      <g fill={C.muted} fontSize="11" textAnchor="middle" fontFamily="Manrope, sans-serif">
        {series.map((_, i) => (
          <text key={i} x={x(i)} y={base + 17}>{data.monthLabels[i]}</text>
        ))}
      </g>
    </svg>
  )
}
