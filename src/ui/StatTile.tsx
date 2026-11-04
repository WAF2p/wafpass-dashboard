import type { ReactNode } from 'react'

export type StatTone = 'neutral' | 'pass' | 'warn' | 'fail' | 'info'

export interface StatTileProps {
  label: ReactNode
  value: ReactNode
  /** Secondary line below the value. */
  hint?: ReactNode
  /** Semantic colour for the value and icon; defaults to neutral. */
  tone?: StatTone
  /** Optional leading icon; hidden from assistive technology. */
  icon?: ReactNode
  className?: string
}

/**
 * KPI tile: label, tabular value, optional hint and a semantic tone. Sits in
 * any grid without forcing a width, so tiles can share a row and wrap together.
 */
export default function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
  className = '',
}: StatTileProps) {
  return (
    <div className={`ui-stat ui-stat-${tone} ${className}`.trim()}>
      <div className="ui-stat-head">
        {icon != null && <span className="ui-stat-icon" aria-hidden="true">{icon}</span>}
        <span className="ui-stat-label">{label}</span>
      </div>
      <div className="ui-stat-value">{value}</div>
      {hint != null && hint !== false && hint !== '' && (
        <p className="ui-stat-hint">{hint}</p>
      )}
    </div>
  )
}
