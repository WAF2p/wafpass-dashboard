import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import type { Page } from '../routing'
import { BETA_SAVED_VIEWS, type SavedView } from '../pages/userPrefsUtils'
import { useBetaFeatures } from '../beta/BetaFeaturesContext'

interface SavedViewsControlProps {
  page: Page
  currentFilters: Record<string, unknown>
  onApply: (filters: Record<string, unknown>) => void
}

/** Named filter presets for the page currently being viewed. */
export default function SavedViewsControl({ page, currentFilters, onApply }: SavedViewsControlProps) {
  const { t } = useI18n()
  const { prefs, isEnabled, update } = useBetaFeatures()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!isEnabled(BETA_SAVED_VIEWS)) return null

  const views = (prefs.savedViews ?? []).filter(view => view.page === page)

  function save() {
    const trimmed = name.trim()
    if (!trimmed) return
    const view: SavedView = {
      id: `view-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmed,
      page,
      filters: currentFilters,
      createdAt: new Date().toISOString(),
    }
    update({ savedViews: [view, ...(prefs.savedViews ?? [])] })
    setName('')
  }

  function remove(id: string) {
    update({ savedViews: (prefs.savedViews ?? []).filter(view => view.id !== id) })
  }

  return (
    <div className="saved-views" ref={rootRef}>
      <button
        type="button"
        className="saved-views-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h12a1 1 0 011 1v16l-7-4-7 4V5a1 1 0 011-1z" />
        </svg>
        {t('nav.views.trigger')}
        {views.length > 0 && <span className="saved-views-count">{views.length}</span>}
      </button>

      {open && (
        <div className="saved-views-pop" role="dialog" aria-label={t('nav.views.title')}>
          <div className="saved-views-title">{t('nav.views.title')}</div>

          <div className="saved-views-save">
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); save() } }}
              placeholder={t('nav.views.savePlaceholder')}
              aria-label={t('nav.views.savePlaceholder')}
            />
            <button type="button" onClick={save} disabled={!name.trim()}>{t('nav.views.save')}</button>
          </div>

          {views.length === 0 ? (
            <div className="saved-views-empty">{t('nav.views.empty')}</div>
          ) : (
            <ul className="saved-views-list">
              {views.map(view => (
                <li key={view.id}>
                  <button type="button" className="saved-views-apply" onClick={() => { onApply(view.filters); setOpen(false) }}>
                    <span>{view.name}</span>
                    <span className="saved-views-apply-label">{t('nav.views.apply')}</span>
                  </button>
                  <button
                    type="button"
                    className="saved-views-delete"
                    aria-label={t('nav.views.delete')}
                    title={t('nav.views.delete')}
                    onClick={() => remove(view.id)}
                  >
                    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M9 7V5h6v2m-8 0l1 13h8l1-13M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
