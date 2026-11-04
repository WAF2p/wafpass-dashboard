import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Dialog behaviour for custom overlays: focus entry, Tab trap, Escape to
 * close, background scroll lock and focus restore. Pair with
 * role="dialog" aria-modal="true" on the panel.
 */
export function useDialog(onClose: () => void, panelRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const focusables = (): HTMLElement[] => {
      const panel = panelRef.current
      if (!panel) return []
      return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(node => node.offsetParent !== null)
    }

    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel) return
      // Never steal focus from a control the user (or a test) already focused.
      if (panel.contains(document.activeElement)) return
      ;(focusables()[0] ?? panel).focus()
    })

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
  }, [onClose, panelRef])
}
