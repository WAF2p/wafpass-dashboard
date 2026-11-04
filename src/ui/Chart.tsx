import type { ReactNode } from 'react'

/**
 * Shared chart palette and theme objects. Values point at design tokens so
 * charts follow the light/dark themes; pages should not hard-code hex colours.
 */
export const CHART_COLORS = [
  'var(--waf-brand-ink)',
  'var(--score-high)',
  'var(--score-mid)',
  'var(--score-low)',
  'var(--waf-info)',
  'var(--waived)',
  'var(--skip)',
] as const

/** Spread onto XAxis or YAxis. */
export const CHART_AXIS = {
  stroke: 'var(--muted)',
  tickLine: false,
  axisLine: false,
  tick: { fill: 'var(--muted)', fontSize: 11 },
} as const

/** Spread onto CartesianGrid. */
export const CHART_GRID = {
  stroke: 'var(--border)',
  strokeDasharray: '3 3',
  vertical: false,
} as const

/** Pass as Tooltip `contentStyle` (or spread into a custom tooltip's box). */
export const CHART_TOOLTIP = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-control)',
  boxShadow: 'var(--shadow-sm)',
  color: 'var(--text)',
  fontSize: 12,
  lineHeight: 1.4,
  padding: '0.5rem 0.65rem',
} as const

export interface ChartFrameProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Chart controls (range selector, legend toggle, export). */
  actions?: ReactNode
  className?: string
  children: ReactNode
}

/**
 * Panel wrapper for a chart: title/subtitle/actions header plus a body that
 * holds the ResponsiveContainer. The theme constants above fill the chart.
 */
export default function ChartFrame({
  title,
  subtitle,
  actions,
  className = '',
  children,
}: ChartFrameProps) {
  return (
    <section className={`chart-frame ${className}`.trim()}>
      <header className="chart-frame-head">
        <div className="chart-frame-heading">
          <h2 className="chart-frame-title">{title}</h2>
          {subtitle != null && subtitle !== false && subtitle !== '' && (
            <p className="chart-frame-subtitle">{subtitle}</p>
          )}
        </div>
        {actions != null && <div className="chart-frame-actions">{actions}</div>}
      </header>
      <div className="chart-frame-body">{children}</div>
    </section>
  )
}
