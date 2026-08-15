import { useAppSelector } from '../../store/hooks'
import { selectChecks } from '../../store/reportSelectors'
import { formatMoney } from '../../domain/money'
import { useT } from '../../i18n/react'

export default function ChecksPanel() {
  const t = useT()
  const checks = useAppSelector(selectChecks)
  const allOk = checks.every((c) => c.ok)

  return (
    <aside className="checks">
      <div className={`checks__head ${allOk ? 'checks__head--ok' : 'checks__head--bad'}`}>
        {allOk ? t('checks.allOk') : t('checks.hasIssues')}
      </div>
      <ul className="checks__list">
        {checks.map((c) => (
          <li key={c.id} className={`check check--${c.ok ? 'ok' : c.severity}`}>
            <div className="check__title">
              <span className="check__mark">{c.ok ? '✓' : c.severity === 'error' ? '✗' : '⚠'}</span>
              {c.title}
            </div>
            {!c.ok && (
              <ul className="check__issues">
                {c.issues.map((iss, i) => (
                  <li key={i} className="check__issue">
                    {iss.label}
                    {iss.discrepancy !== undefined && (
                      <span className="check__diff"> — {formatMoney(iss.discrepancy, { sign: true })}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </aside>
  )
}
