import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  /** Visible label, associated with the input automatically. */
  label: ReactNode
  /** Helper text rendered below the field. */
  hint?: ReactNode
  /** Error text; switches the field to its invalid styling. */
  error?: ReactNode
  /** Override the generated id (also used to wire the label and descriptions). */
  id?: string
  /** Class for the wrapper; `className` still lands on the <input>. */
  containerClassName?: string
}

function hasContent(value: ReactNode): boolean {
  return value != null && value !== false && value !== ''
}

/**
 * Labelled text input: generated id, hint and error wiring, required marker.
 * Input attributes (type, value, onChange, placeholder, …) pass straight through.
 */
export default function Input({
  label,
  hint,
  error,
  id,
  required = false,
  className = '',
  containerClassName = '',
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...rest
}: InputProps) {
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
      <input
        id={fieldId}
        className={`ui-input ${className}`.trim()}
        required={required}
        aria-invalid={showError ? true : ariaInvalid}
        aria-describedby={describedBy}
        {...rest}
      />
      {showHint && <p className="ui-hint" id={hintId}>{hint}</p>}
      {showError && <p className="ui-error" id={errorId}>{error}</p>}
    </div>
  )
}
