import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

/** Class helper for controls that must stay an <a> (downloads, external links). */
export function buttonClass(variant: Variant = 'secondary', size: Size = 'md'): string {
  return `ui-btn ui-btn-${variant} ui-btn-${size}`
}

export default function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={`${buttonClass(variant, size)} ${className}`.trim()} {...rest}>
      {icon && <span className="ui-btn-icon" aria-hidden="true">{icon}</span>}
      {children}
    </button>
  )
}
