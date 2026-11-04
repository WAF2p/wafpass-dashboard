import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  className?: string
}

/**
 * The single page heading pattern. Every routed page renders exactly one
 * <h1> through this component so document structure stays consistent.
 */
export default function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={`ui-page-header ${className}`.trim()}>
      <div className="ui-page-header-text">
        {eyebrow != null && <div className="ui-page-header-eyebrow">{eyebrow}</div>}
        <h1 className="ui-page-header-title">{title}</h1>
        {description != null && <p className="ui-page-header-desc">{description}</p>}
      </div>
      {actions != null && <div className="ui-page-header-actions">{actions}</div>}
    </header>
  )
}
