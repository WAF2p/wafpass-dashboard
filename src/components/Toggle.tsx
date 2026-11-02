import type { CSSProperties } from 'react'

interface ToggleProps {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  /** Accessible name for the switch when no visible label is bound to it. */
  label?: string
  style?: CSSProperties
}

/** Shared switch used by settings and beta-feature surfaces. */
export default function Toggle({ checked, onChange, disabled, label, style }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="ui-toggle"
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: '40px', height: '22px', borderRadius: '999px', border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        background: checked ? 'var(--waf-brand)' : '#cbd5e1',
        transition: 'background 0.2s', position: 'relative', flexShrink: 0,
        opacity: disabled ? 0.4 : 1,
        padding: 0,
        ...style,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', top: '3px', left: checked ? '21px' : '3px',
          width: '16px', height: '16px', borderRadius: '50%',
          background: '#fff', transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,.25)',
        }}
      />
    </button>
  )
}
