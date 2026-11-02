import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { RunSummary } from '../api'
import { useI18n } from '../i18n'
import { useTheme } from '../theme'
import type { NavSection } from '../navigation/navModel'
import type { FilterState, Page } from '../routing'

type PaletteItem =
  | { kind: 'page'; id: string; label: string; hint: string; icon: string; page: Page }
  | { kind: 'control'; id: string; label: string; hint: string; icon: string; controlId: string }
  | { kind: 'run'; id: string; label: string; hint: string; icon: string; runId: string }
  | { kind: 'action'; id: string; label: string; hint: string; icon: string; action: 'theme' | 'settings' | 'beta' }

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  sections: NavSection[]
  controls: { id: string; title: string }[]
  runs: RunSummary[]
  onNavigate: (page: Page, filters?: FilterState) => void
  onSelectRun: (id: string) => void
  canManageSettings?: boolean
}

const CONTROL_ICON = 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'
const RUN_ICON = 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
const ACTION_ICON = 'M13 10V3L4 14h7v7l9-11h-7z'

export default function CommandPalette({
  open, onClose, sections, controls, runs, onNavigate, onSelectRun, canManageSettings = true,
}: CommandPaletteProps) {
  const { t } = useI18n()
  const { toggleTheme } = useTheme()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    const previous = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20)

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      previous?.focus?.()
    }
  }, [open])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = (label: string, hint: string) => !q || label.toLowerCase().includes(q) || hint.toLowerCase().includes(q)
    const rank = (label: string) => (q && label.toLowerCase().startsWith(q) ? 0 : 1)

    const pages = sections
      .flatMap(section => section.items.map(item => ({
        kind: 'page' as const,
        id: `page-${item.page}`,
        label: item.label,
        hint: section.label,
        icon: item.icon,
        page: item.page,
      })))
      .filter(item => matches(item.label, item.hint))
      .sort((a, b) => rank(a.label) - rank(b.label) || a.label.localeCompare(b.label))
      .slice(0, q ? 8 : 6)

    const controlItems = controls
      .map(control => ({
        kind: 'control' as const,
        id: `control-${control.id}`,
        label: control.title || control.id,
        hint: control.id,
        icon: CONTROL_ICON,
        controlId: control.id,
      }))
      .filter(item => matches(item.label, item.hint))
      .sort((a, b) => rank(a.label) - rank(b.label) || a.hint.localeCompare(b.hint))
      .slice(0, q ? 8 : 5)

    const runItems = runs
      .map(run => ({
        kind: 'run' as const,
        id: `run-${run.id}`,
        label: run.project || t('nav.palette.noProject'),
        hint: `${run.branch || t('nav.palette.noBranch')} · ${t('nav.palette.score', { score: run.score })}`,
        icon: RUN_ICON,
        runId: run.id,
      }))
      .filter(item => matches(item.label, item.hint))
      .slice(0, q ? 8 : 5)

    const actionCandidates: PaletteItem[] = [
      ...(canManageSettings ? [
        { kind: 'action' as const, id: 'action-settings', label: t('nav.palette.openSettings'), hint: t('nav.palette.action'), icon: ACTION_ICON, action: 'settings' as const },
        { kind: 'action' as const, id: 'action-beta', label: t('nav.palette.openBeta'), hint: t('nav.palette.action'), icon: ACTION_ICON, action: 'beta' as const },
      ] : []),
      { kind: 'action' as const, id: 'action-theme', label: t('nav.palette.toggleTheme'), hint: t('nav.palette.action'), icon: ACTION_ICON, action: 'theme' as const },
    ]
    const actions = actionCandidates.filter(item => matches(item.label, item.hint))

    return [
      { key: 'page', label: t('nav.palette.pages'), items: pages },
      { key: 'control', label: t('nav.palette.controls'), items: controlItems },
      { key: 'run', label: t('nav.palette.runs'), items: runItems },
      { key: 'action', label: t('nav.palette.actions'), items: actions },
    ].filter(group => group.items.length > 0) as { key: string; label: string; items: PaletteItem[] }[]
  }, [query, sections, controls, runs, t, canManageSettings])

  const flat = useMemo(() => groups.flatMap(group => group.items), [groups])
  const activeIndex = Math.min(active, Math.max(0, flat.length - 1))

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!open) return null

  const choose = (item: PaletteItem) => {
    onCloseRef.current()
    if (item.kind === 'page') onNavigate(item.page)
    else if (item.kind === 'control') {
      window.dispatchEvent(new CustomEvent('wombat:catalogue-search', { detail: item.controlId }))
      onNavigate('catalogue', { search: item.controlId })
    }
    else if (item.kind === 'run') onSelectRun(item.runId)
    else if (item.action === 'settings') onNavigate('settings')
    else if (item.action === 'beta') onNavigate('betafeatures')
    else if (item.action === 'theme') toggleTheme()
  }

  let index = -1

  return createPortal(
    <div className="cmd-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="cmd-panel" role="dialog" aria-modal="true" aria-label={t('nav.palette.title')}>
        <div className="cmd-input-row">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" className="cmd-search-icon">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            className="cmd-input"
            value={query}
            onChange={event => { setQuery(event.target.value); setActive(0) }}
            placeholder={t('nav.palette.placeholder')}
            aria-label={t('nav.palette.placeholder')}
            aria-controls="cmd-results"
            aria-activedescendant={flat.length > 0 ? `cmd-item-${activeIndex}` : undefined}
            role="combobox"
            aria-expanded="true"
            onKeyDown={event => {
              if (event.key === 'ArrowDown') { event.preventDefault(); setActive(Math.min(flat.length - 1, activeIndex + 1)) }
              else if (event.key === 'ArrowUp') { event.preventDefault(); setActive(Math.max(0, activeIndex - 1)) }
              else if (event.key === 'Enter' && flat[activeIndex]) { event.preventDefault(); choose(flat[activeIndex]) }
            }}
          />
          <kbd className="cmd-kbd">esc</kbd>
        </div>

        <div className="cmd-list" id="cmd-results" ref={listRef} role="listbox">
          {groups.map(group => (
            <div className="cmd-group" key={group.key}>
              <div className="cmd-group-label">{group.label}</div>
              {group.items.map(item => {
                index += 1
                const itemIndex = index
                return (
                  <button
                    type="button"
                    key={item.id}
                    id={`cmd-item-${itemIndex}`}
                    data-index={itemIndex}
                    role="option"
                    aria-selected={itemIndex === activeIndex}
                    className={`cmd-item${itemIndex === activeIndex ? ' is-active' : ''}`}
                    onMouseEnter={() => setActive(itemIndex)}
                    onClick={() => choose(item)}
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" className="cmd-item-icon">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                    <span className="cmd-item-label">{item.label}</span>
                    <span className="cmd-item-hint">{item.hint}</span>
                  </button>
                )
              })}
            </div>
          ))}
          {flat.length === 0 && <div className="cmd-empty">{t('nav.palette.empty')}</div>}
        </div>

        <div className="cmd-foot">
          <span><kbd className="cmd-kbd">↑</kbd><kbd className="cmd-kbd">↓</kbd> {t('nav.palette.hintNavigate')}</span>
          <span><kbd className="cmd-kbd">↵</kbd> {t('nav.palette.hintSelect')}</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
