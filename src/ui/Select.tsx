import { useId, type ReactNode, type SelectHTMLAttributes } from 'react'

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  /** Visible label, associated with the select automatically. */
  label: ReactNode
  /** Helper text rendered below the field. */
  hint?: ReactNode
  /** Error text; switches the field to its invalid styling. */
  error?: ReactNode
  /** Override the generated id (also used to wire the label and descriptions). */
  id?: string
  /** Class for the wrapper; `className` still lands on the <select>. */
  containerClassName?: string
  /** Option elements. */
  children: ReactNode
}

function hasContent(value: ReactNode): boolean {
  return value != null && value !== false && value !== ''
}

/**
 * Labelled native select. Uses the app-wide themed select appearance from
 * src/index.css, so the chevron and popup colours stay consistent in both themes.
 */
export default function Select({
  label,
  hint,
  error,
  id,
  required = false,
  className = '',
  containerClassName = '',
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  children,
  ...rest
}: SelectProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const hintId = `${fieldId}-hint`
  const errorId = `${fieldId}-error`
  const showHint = hasContent(hint)
  const showError = hasContent(error)
  const invalid = showError || (ariaInvalid != null && ariaInvalid !== false && ariaInvalid !== 'false')

  const describedBy = [
    showHint ? hintId : null,
    showError ? errorId : null,
    ariaDescribedBy ?? null,
  ]
    .filter(Boolean)
    .join(' ') || undefined

  return (
    <div className={`ui-field${invalid ? ' ui-field-invalid' : ''} ${containerClassName}`.trim()}>
      <label className="ui-label" htmlFor={fieldId}>
        {label}
        {required && <span className="ui-field-required" aria-hidden="true">*</span>}
      </label>
      <select
        id={fieldId}
        className={`ui-select ${className}`.trim()}
        required={required}
        aria-invalid={showError ? true : ariaInvalid}
        aria-describedby={describedBy}
        {...rest}
      >
        {children}
      </select>
      {showHint && <p className="ui-hint" id={hintId}>{hint}</p>}
      {showError && <p className="ui-error" id={errorId}>{error}</p>}
    </div>
  )
}
