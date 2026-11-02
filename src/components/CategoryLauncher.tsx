import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { NavSection } from '../navigation/navModel'
import type { Page } from '../routing'
import { useI18n } from '../i18n'
import { MAX_PINNED_PAGES } from '../pages/userPrefsUtils'
import NineDotIcon from './NineDotIcon'

interface CategoryLauncherProps {
  sections: NavSection[]
  page: Page
  navigate: (page: Page) => void
  onClose: () => void
  onManageBeta?: () => void
  pinsEnabled?: boolean
  pinnedPages?: Page[]
  onTogglePin?: (page: Page) => void
}

/**
 * Full-category overlay opened by the 9-dot launcher.
 *
 * Rendered in a portal so the header's backdrop-filter never becomes its
 * containing block or clips it. Focus is trapped while open and restored to
 * the trigger on close.
 */
export default function CategoryLauncher({ sections, page, navigate, onClose, onManageBeta, pinsEnabled, pinnedPages = [], onTogglePin }: CategoryLauncherProps) {
  const { t } = useI18n()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const focusables = () => Array.from(
      panel?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    )

    closeRef.current?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const list = focusables()
      if (list.length === 0) return
      const first = list[0]
      const last = list[list.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      previous?.focus?.()
    }
  }, [])

  const choose = (target: Page) => {
    navigate(target)
    onCloseRef.current()
  }

  const pinLimitReached = pinsEnabled && pinnedPages.length >= MAX_PINNED_PAGES

  return createPortal(
    <div
      className="cat-launcher-overlay"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className="cat-launcher-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cat-launcher-title"
        aria-describedby="cat-launcher-desc"
      >
        <div className="cat-launcher-head">
          <div className="cat-launcher-heading">
            <span className="cat-launcher-mark"><NineDotIcon size={20} /></span>
            <div>
              <h2 id="cat-launcher-title">{t('nav.launcher.title')}</h2>
              <p id="cat-launcher-desc">{t('nav.launcher.subtitle')}</p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="cat-launcher-close"
            aria-label={t('nav.launcher.close')}
            onClick={onClose}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {pinLimitReached && (
          <p className="cat-launcher-limit" role="status">
            {t('nav.launcher.pinLimit', { max: String(MAX_PINNED_PAGES) })}
          </p>
        )}

        <div className="cat-launcher-grid">
          {sections.map(section => (
            <section className="cat-launcher-section" key={section.id}>
              <div className="cat-launcher-section-head">
                <span className="cat-launcher-dot" style={{ background: section.color }} aria-hidden="true" />
                <h3>{section.label}</h3>
              </div>
              <p className="cat-launcher-section-desc">{section.description}</p>
              <div className="cat-launcher-links">
                {section.items.map(item => {
                  const active = item.page === page
                  const pinned = pinnedPages.includes(item.page)
                  return (
                    <div className="cat-launcher-row" key={item.page}>
                      <button
                        type="button"
                        className={`cat-launcher-link${active ? ' is-active' : ''}`}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => choose(item.page)}
                      >
                        <svg width="16" height="16" fill="none" stroke={section.color} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                        </svg>
                        <span>{item.label}</span>
                        {item.badge?.label && (
                          <span className={`cat-launcher-badge${item.badge.variant === 'fail' ? ' is-fail' : ''}`}>
                            {item.badge.label}
                          </span>
                        )}
                        {item.count != null && item.count > 0 && (
                          <span className="cat-launcher-count">{item.count}</span>
                        )}
                      </button>
                      {pinsEnabled && onTogglePin && (
                        <button
                          type="button"
                          className={`cat-launcher-pin${pinned ? ' is-pinned' : ''}`}
                          aria-pressed={pinned}
                          disabled={!pinned && pinLimitReached}
                          aria-label={pinned ? t('nav.launcher.unpin', { page: item.label }) : t('nav.launcher.pin', { page: item.label })}
                          title={
                            pinned
                              ? t('nav.launcher.unpin', { page: item.label })
                              : pinLimitReached
                                ? t('nav.launcher.pinLimit', { max: String(MAX_PINNED_PAGES) })
                                : t('nav.launcher.pin', { page: item.label })
                          }
                          onClick={() => onTogglePin(item.page)}
                        >
                          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6zM12 14v7" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="cat-launcher-foot">
          <span>{t('nav.launcher.betaNote')}</span>
          {onManageBeta && (
            <button type="button" className="cat-launcher-manage" onClick={() => { onManageBeta(); onCloseRef.current() }}>
              {t('nav.launcher.manage')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
