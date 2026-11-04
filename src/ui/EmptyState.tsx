import type { ReactNode } from 'react'

export interface EmptyStateProps {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  compact?: boolean
  className?: string
}

export default function EmptyState({
  title,
  description,
  action,
  icon,
  compact = false,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`ui-empty ${compact ? 'ui-empty-compact' : ''} ${className}`.trim()}>
      {icon != null && <div className="ui-empty-icon" aria-hidden="true">{icon}</div>}
      <p className="ui-empty-title">{title}</p>
      {description != null && <p className="ui-empty-desc">{description}</p>}
      {action != null && <div className="ui-empty-action">{action}</div>}
    </div>
  )
}
