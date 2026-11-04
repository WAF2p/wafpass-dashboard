import type { CSSProperties, ReactNode } from 'react'

export interface CardProps {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  /** 'none' removes padding so tables and media can run edge to edge. */
  padding?: 'none' | 'sm' | 'md' | 'lg'
  className?: string
  style?: CSSProperties
  children: ReactNode
}

export default function Card({
  title,
  subtitle,
  actions,
  padding = 'md',
  className = '',
  style,
  children,
}: CardProps) {
  const hasHead = title != null || subtitle != null || actions != null
  return (
    <section className={`card ui-card ui-card-pad-${padding} ${className}`.trim()} style={style}>
      {hasHead && (
        <header className="ui-card-head">
          <div className="ui-card-head-text">
            {title != null && <h2 className="ui-card-title">{title}</h2>}
            {subtitle != null && <p className="ui-card-subtitle">{subtitle}</p>}
          </div>
          {actions != null && <div className="ui-card-actions">{actions}</div>}
        </header>
      )}
      <div className="ui-card-body">{children}</div>
    </section>
  )
}
