import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  closeLabel?: string
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Accessible dialog: role=dialog, aria-modal, labelled by its heading,
 * focus entry + trap, Escape to close, scroll lock, focus restored on close.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeLabel = 'Close',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const focusables = (): HTMLElement[] => {
      const panel = panelRef.current
      if (!panel) return []
      return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        node => node.offsetParent !== null,
      )
    }

    const raf = requestAnimationFrame(() => (focusables()[0] ?? panelRef.current)?.focus())

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="ui-modal-backdrop"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`ui-modal ui-modal-${size}`}
      >
        <header className="ui-modal-head">
          <h2 id={titleId} className="ui-modal-title">{title}</h2>
          <button type="button" className="ui-modal-close" onClick={onClose} aria-label={closeLabel}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="ui-modal-body">{children}</div>
        {footer != null && <footer className="ui-modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
