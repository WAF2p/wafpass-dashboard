import { useRef, type KeyboardEvent, type ReactNode } from 'react'

export interface TabItem {
  id: string
  label: ReactNode
  /** Optional count shown as a trailing pill. */
  count?: number | string
}

export interface TabsProps {
  tabs: TabItem[]
  /** Id of the selected tab. */
  value: string
  onChange: (id: string) => void
  /** Accessible name for the segmented group. */
  ariaLabel?: string
  className?: string
}

/**
 * Controlled segmented tabs. Reuses the shared `.ui-tabs` / `.ui-tab` styles;
 * roving tabindex + arrow/Home/End keys move focus between segments.
 */
export default function Tabs({
  tabs,
  value,
  onChange,
  ariaLabel = 'Tabs',
  className = '',
}: TabsProps) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const hasActive = tabs.some(tab => tab.id === value)

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index
    if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    else return

    event.preventDefault()
    buttons.current[next]?.focus()
  }

  return (
    <div className={`ui-tabs ${className}`.trim()} role="group" aria-label={ariaLabel}>
      {tabs.map((tab, index) => {
        const active = tab.id === value
        return (
          <button
            key={tab.id}
            ref={element => { buttons.current[index] = element }}
            type="button"
            className="ui-tab"
            aria-pressed={active}
            tabIndex={active || (!hasActive && index === 0) ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={event => handleKeyDown(event, index)}
          >
            {tab.label}
            {tab.count != null && <span className="ui-tab-count">{tab.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
