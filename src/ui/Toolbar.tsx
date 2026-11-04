import type { ReactNode } from 'react'

export interface ToolbarProps {
  /** Filters, tabs or leading actions. */
  left?: ReactNode
  /** Primary actions, kept at the trailing edge. */
  right?: ReactNode
  /** Accessible name for the action bar. */
  ariaLabel?: string
  className?: string
}

/**
 * Horizontal action/filter bar with left and right slots. Both slots wrap
 * independently, so controls stack cleanly on narrow screens.
 */
export default function Toolbar({
  left,
  right,
  ariaLabel,
  className = '',
}: ToolbarProps) {
  return (
    <div
      className={`ui-toolbar ${className}`.trim()}
      role="toolbar"
      aria-label={ariaLabel}
    >
      <div className="ui-toolbar-left">{left}</div>
      <div className="ui-toolbar-right">{right}</div>
    </div>
  )
}
