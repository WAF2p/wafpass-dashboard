import { useEffect, useMemo, useRef, useState } from 'react'
import type { RunDetail, RunSummary } from '../api'
import { useAuth } from '../AuthContext'
import { useBetaFeatures } from '../beta/BetaFeaturesContext'
import { useI18n } from '../i18n'
import { buildHash, parseHash, type Page } from '../routing'
import type { Settings } from './settingsUtils'
import { BETA_MY_DASHBOARD, type UserPreferences } from './userPrefsUtils'
import DashboardWidgetBody, { type WidgetContext } from '../widgets/DashboardWidgets'
import { decodeDashboard, buildShareUrl } from '../widgets/share'
import {
  cloneDashboardWidgets,
  INITIAL_DASHBOARD_WIDGETS,
  isConfigurable,
  makeWidgetId,
  sanitizeConfig,
  widgetMeta,
  WIDGET_META,
  WIDGET_SIZES,
  type DashboardWidget,
  type WidgetConfig,
  type WidgetSize,
  type WidgetType,
} from '../widgets/types'
import { safeImageUrl } from '../safeUrl'

interface Props {
  run: RunDetail | null
  runs: RunSummary[]
  waiverCount: number
  riskCount: number
  maturityLevel: number
  settings: Settings
  prefs: UserPreferences
  onChange: (prefs: UserPreferences) => void
  navigate: (page: Page) => void
  onSelectRun: (id: string) => void
}

const GROUPS = ['posture', 'trends', 'governance', 'insights', 'content'] as const
const GROUP_LABEL_KEY: Record<(typeof GROUPS)[number], string> = {
  posture: 'pages.myDashboard.groupPosture',
  trends: 'pages.myDashboard.groupTrends',
  governance: 'pages.myDashboard.groupGovernance',
  insights: 'pages.myDashboard.groupInsights',
  content: 'pages.myDashboard.groupContent',
}

const SIZE_LABEL_KEY: Record<WidgetSize, string> = {
  small: 'pages.myDashboard.sizeSmall',
  medium: 'pages.myDashboard.sizeMedium',
  large: 'pages.myDashboard.sizeLarge',
}

const ICON = {
  plus: 'M12 5v14M5 12h14',
  edit: 'M12 20h9 M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z',
  check: 'M5 13l4 4L19 7',
  share: 'M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8 M16 6l-4-4-4 4 M12 2v13',
  close: 'M6 6l12 12M18 6L6 18',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  reset: 'M3 12a9 9 0 109-9 9 9 0 00-6.36 2.64L3 8 M3 3v5h5',
  grip: 'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',
  pencil: 'M12 20h9 M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4z',
}

function Icon({ path, size = 15 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  )
}

/**
 * Focus management for the dashboard dialogs: move focus in on open, keep
 * Tab inside while open, close on Escape, and restore the trigger on close.
 */
function useModalFocus(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const focusables = () => Array.from(
      panel?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    )

    const first = focusables()[0]
    ;(first ?? panel)?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const list = focusables()
      if (list.length === 0) return
      const firstEl = list[0]
      const lastEl = list[list.length - 1]
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault()
        lastEl.focus()
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault()
        firstEl.focus()
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
  }, [open])

  return panelRef
}

export default function MyDashboardPage({
  run, runs, waiverCount, riskCount, maturityLevel, settings, prefs, onChange, navigate, onSelectRun,
}: Props) {
  const { t } = useI18n()
  const { isEnabled } = useBetaFeatures()
  const { role, isHoldingAdmin, isHoldingViewer, isGroupAdmin, isGroupViewer } = useAuth()
  const enabled = isEnabled(BETA_MY_DASHBOARD)
  const roleLabel = t(`pages.myDashboard.roles.${role ?? 'unknown'}`)
  const scopeLabel = isHoldingAdmin || isHoldingViewer || isGroupAdmin || isGroupViewer
    ? t(`pages.myDashboard.holdingRoles.${isHoldingAdmin ? 'holding_admin' : isHoldingViewer ? 'holding_viewer' : isGroupAdmin ? 'group_admin' : 'group_viewer'}`)
    : t('pages.myDashboard.scopeMandate')

  const [editing, setEditing] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState<'idle' | 'copied' | 'error'>('idle')
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [configId, setConfigId] = useState<string | null>(null)
  const [draft, setDraft] = useState<WidgetConfig>({})
  const [configError, setConfigError] = useState('')
  const [shared] = useState(() => {
    const raw = parseHash().filters.share
    return raw ? decodeDashboard(raw) : null
  })
  const [showShared, setShowShared] = useState(shared !== null)

  const widgets = prefs.dashboardWidgets ?? INITIAL_DASHBOARD_WIDGETS
  const displayName = prefs.dashboardName?.trim() || t('pages.myDashboard.defaultName')
  const configWidget = configId ? widgets.find(widget => widget.id === configId) ?? null : null
  const configOpen = configWidget !== null

  const closeConfig = () => {
    setConfigId(null)
    setDraft({})
    setConfigError('')
  }

  const addModalRef = useModalFocus(addOpen, () => setAddOpen(false))
  const configModalRef = useModalFocus(configOpen, closeConfig)
  const shareModalRef = useModalFocus(shareOpen, () => setShareOpen(false))

  // Stable identity so memoised widget bodies skip work while the editor,
  // drag state or config draft changes.
  const widgetCtx = useMemo<WidgetContext>(() => ({
    run, runs, waiverCount, riskCount, maturityLevel, settings, onSelectRun, navigate, t,
  }), [run, runs, waiverCount, riskCount, maturityLevel, settings, onSelectRun, navigate, t])

  if (!enabled) {
    return (
      <div className="wdg-page">
        <div className="wdg-disabled">
          <h1>{t('pages.myDashboard.betaOffTitle')}</h1>
          <p>{t('pages.myDashboard.betaOffDesc')}</p>
          <button type="button" className="wdg-btn wdg-btn-primary" onClick={() => navigate('betafeatures')}>
            {t('pages.myDashboard.betaOffAction')}
          </button>
        </div>
      </div>
    )
  }

  const save = (next: DashboardWidget[]) => onChange({ ...prefs, dashboardWidgets: next })

  const openConfig = (widget: DashboardWidget) => {
    setDraft({ ...(widget.config ?? {}) })
    setConfigError('')
    setConfigId(widget.id)
  }

  const addWidget = (type: WidgetType) => {
    if (widgets.some(widget => widget.type === type)) return
    const meta = widgetMeta(type)
    const id = makeWidgetId()
    save([...widgets, { id, type, size: meta.defaultSize }])
    if (isConfigurable(type)) {
      setAddOpen(false)
      setDraft({})
      setConfigError('')
      setConfigId(id)
    }
  }

  const saveConfig = () => {
    const target = widgets.find(widget => widget.id === configId)
    if (!target) return
    if (target.type === 'iframe' && !draft.url?.trim()) {
      setConfigError(t('pages.myDashboard.config.urlRequired'))
      return
    }
    if (target.type === 'logo' && !draft.src?.trim()) {
      setConfigError(t('pages.myDashboard.config.logoRequired'))
      return
    }
    const config = sanitizeConfig(target.type, draft, true)
    if (isConfigurable(target.type) && (target.type !== 'text') && !config) {
      setConfigError(target.type === 'iframe' ? t('pages.myDashboard.config.urlInvalid') : t('pages.myDashboard.config.logoInvalid'))
      return
    }
    save(widgets.map(widget => widget.id === target.id ? { ...widget, config } : widget))
    closeConfig()
  }

  const onLogoFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setConfigError(t('pages.myDashboard.config.logoFileType'))
      return
    }
    if (file.size > 180_000) {
      setConfigError(t('pages.myDashboard.config.logoTooLarge'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setDraft(previous => ({ ...previous, src: reader.result as string }))
      setConfigError('')
    }
    reader.onerror = () => setConfigError(t('pages.myDashboard.config.logoReadError'))
    reader.readAsDataURL(file)
  }

  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null)
      setDragOverId(null)
      return
    }
    const from = widgets.findIndex(widget => widget.id === dragId)
    const to = widgets.findIndex(widget => widget.id === targetId)
    if (from < 0 || to < 0) return
    const next = [...widgets]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    save(next)
    setDragId(null)
    setDragOverId(null)
  }

  const removeWidget = (id: string) => save(widgets.filter(widget => widget.id !== id))

  const moveWidget = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= widgets.length) return
    const next = [...widgets]
    ;[next[index], next[target]] = [next[target], next[index]]
    save(next)
  }

  const resizeWidget = (id: string, size: WidgetSize) => {
    save(widgets.map(widget => widget.id === id ? { ...widget, size } : widget))
  }

  const resetDashboard = () => {
    if (!window.confirm(t('pages.myDashboard.resetConfirm'))) return
    onChange({ ...prefs, dashboardWidgets: cloneDashboardWidgets(INITIAL_DASHBOARD_WIDGETS) })
  }

  const clearShareParam = () => {
    const { runId } = parseHash()
    window.history.replaceState(null, '', buildHash('mydashboard', runId, {}))
  }

  const importShared = () => {
    if (!shared) return
    onChange({ ...prefs, dashboardName: shared.name || prefs.dashboardName, dashboardWidgets: shared.widgets })
    setShowShared(false)
    clearShareParam()
  }

  const dismissShared = () => {
    setShowShared(false)
    clearShareParam()
  }

  const openShare = () => {
    setShareUrl(buildShareUrl(displayName, widgets))
    setCopied('idle')
    setShareOpen(true)
  }

  const copyShareUrl = () => {
    if (!navigator.clipboard?.writeText) {
      setCopied('error')
      return
    }
    navigator.clipboard.writeText(shareUrl)
      .then(() => setCopied('copied'))
      .catch(() => setCopied('error'))
  }

  const usedTypes = new Set(widgets.map(widget => widget.type))

  return (
    <div className="wdg-page">
      {showShared && shared && (
        <div className="wdg-share-banner" role="status">
          <div>
            <strong>{t('pages.myDashboard.sharedLayout', { name: shared.name || t('pages.myDashboard.defaultName'), count: shared.widgets.length })}</strong>
            <span>{t('pages.myDashboard.sharedHint')}</span>
          </div>
          <div className="wdg-banner-actions">
            <button type="button" className="wdg-btn wdg-btn-primary" onClick={importShared}>{t('pages.myDashboard.importLayout')}</button>
            <button type="button" className="wdg-btn" onClick={dismissShared}>{t('pages.myDashboard.dismiss')}</button>
          </div>
        </div>
      )}

      <div className="wdg-rbac" role="note">
        <span className="wdg-rbac-icon" aria-hidden="true">
          <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4" />
          </svg>
        </span>
        <div className="wdg-rbac-text">
          <strong>{t('pages.myDashboard.rbacTitle')}</strong>
          <span>{t('pages.myDashboard.rbacDesc', { role: roleLabel, scope: scopeLabel })}</span>
        </div>
        <span className="wdg-rbac-chip">{roleLabel} · {scopeLabel}</span>
      </div>

      <div className="wdg-page-head">
        <div>
          <h1>{displayName}</h1>
          <p>{t('pages.myDashboard.subtitle')}</p>
        </div>
        <div className="wdg-page-actions">
          {editing && (
            <input
              className="wdg-name-input"
              value={prefs.dashboardName ?? ''}
              placeholder={t('pages.myDashboard.defaultName')}
              aria-label={t('pages.myDashboard.rename')}
              onChange={event => onChange({ ...prefs, dashboardName: event.target.value })}
            />
          )}
          <button type="button" className="wdg-btn" onClick={openShare}>
            <Icon path={ICON.share} /> {t('pages.myDashboard.share')}
          </button>
          <button type="button" className={`wdg-btn${editing ? ' wdg-btn-primary' : ''}`} onClick={() => setEditing(value => !value)}>
            <Icon path={editing ? ICON.check : ICON.edit} /> {editing ? t('pages.myDashboard.done') : t('pages.myDashboard.edit')}
          </button>
        </div>
      </div>

      {editing && (
        <div className="wdg-toolbar">
          <button type="button" className="wdg-btn" onClick={() => setAddOpen(true)}>
            <Icon path={ICON.plus} /> {t('pages.myDashboard.addWidget')}
          </button>
          <button type="button" className="wdg-btn" onClick={resetDashboard}>
            <Icon path={ICON.reset} /> {t('pages.myDashboard.reset')}
          </button>
          <span className="wdg-toolbar-hint">{t('pages.myDashboard.editHint')}</span>
        </div>
      )}

      {!run && <div className="wdg-run-note">{t('pages.myDashboard.noRun')}</div>}

      {widgets.length === 0 ? (
        <div className="wdg-empty-board">
          <p>{t('pages.myDashboard.empty')}</p>
          <button type="button" className="wdg-btn wdg-btn-primary" onClick={() => { setEditing(true); setAddOpen(true) }}>
            <Icon path={ICON.plus} /> {t('pages.myDashboard.addWidget')}
          </button>
        </div>
      ) : (
        <div className="wdg-grid">
          {widgets.map((widget, index) => {
            const meta = widgetMeta(widget.type)
            return (
              <section
                className={`wdg-card wdg-size-${widget.size}${editing ? ' is-editing' : ''}${dragId === widget.id ? ' is-dragging' : ''}${dragOverId === widget.id ? ' is-drop-target' : ''}`}
                key={widget.id}
                draggable={editing}
                onDragStart={event => {
                  if (!editing) return
                  setDragId(widget.id)
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', widget.id)
                }}
                onDragOver={event => {
                  if (!editing || !dragId) return
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  if (dragOverId !== widget.id) setDragOverId(widget.id)
                }}
                onDragLeave={() => { if (dragOverId === widget.id) setDragOverId(null) }}
                onDrop={event => {
                  if (!editing) return
                  event.preventDefault()
                  dropOn(widget.id)
                }}
                onDragEnd={() => { setDragId(null); setDragOverId(null) }}
              >
                <header className="wdg-head">
                  <div className="wdg-title">
                    {editing && (
                      <span className="wdg-grip" title={t('pages.myDashboard.dragHint')} aria-hidden="true">
                        <Icon path={ICON.grip} size={14} />
                      </span>
                    )}
                    <span className="wdg-icon"><Icon path={meta.icon} size={16} /></span>
                    <h2>{t(meta.titleKey)}</h2>
                  </div>
                  {editing && (
                    <div className="wdg-widget-actions">
                      {isConfigurable(widget.type) && (
                        <button type="button" onClick={() => openConfig(widget)} aria-label={t('pages.myDashboard.editContent')} title={t('pages.myDashboard.editContent')}>
                          <Icon path={ICON.pencil} size={13} />
                        </button>
                      )}
                      <button type="button" onClick={() => moveWidget(index, -1)} disabled={index === 0} aria-label={t('pages.myDashboard.moveLeft')} title={t('pages.myDashboard.moveLeft')}>
                        <Icon path={ICON.left} size={13} />
                      </button>
                      <button type="button" onClick={() => moveWidget(index, 1)} disabled={index === widgets.length - 1} aria-label={t('pages.myDashboard.moveRight')} title={t('pages.myDashboard.moveRight')}>
                        <Icon path={ICON.right} size={13} />
                      </button>
                      <select
                        value={widget.size}
                        aria-label={t('pages.myDashboard.size')}
                        title={t('pages.myDashboard.size')}
                        onChange={event => resizeWidget(widget.id, event.target.value as WidgetSize)}
                      >
                        {WIDGET_SIZES.map(size => <option key={size} value={size}>{t(SIZE_LABEL_KEY[size])}</option>)}
                      </select>
                      <button type="button" className="is-danger" onClick={() => removeWidget(widget.id)} aria-label={t('pages.myDashboard.remove')} title={t('pages.myDashboard.remove')}>
                        <Icon path={ICON.close} size={13} />
                      </button>
                    </div>
                  )}
                </header>
                <DashboardWidgetBody
                  widget={widget}
                  ctx={widgetCtx}
                />
              </section>
            )
          })}
        </div>
      )}

      {addOpen && (
        <div className="wdg-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setAddOpen(false) }}>
          <div ref={addModalRef} className="wdg-modal" role="dialog" aria-modal="true" aria-labelledby="wdg-add-title" tabIndex={-1}>
            <div className="wdg-modal-head">
              <div>
                <h2 id="wdg-add-title">{t('pages.myDashboard.addTitle')}</h2>
                <p>{t('pages.myDashboard.addHint')}</p>
              </div>
              <button type="button" className="wdg-icon-btn" onClick={() => setAddOpen(false)} aria-label={t('pages.myDashboard.close')}>
                <Icon path={ICON.close} size={16} />
              </button>
            </div>
            <div className="wdg-add-list">
              {GROUPS.map(group => {
                const entries = WIDGET_META.filter(meta => meta.group === group)
                if (entries.length === 0) return null
                return (
                  <div className="wdg-add-group" key={group}>
                    <h3>{t(GROUP_LABEL_KEY[group])}</h3>
                    {entries.map(meta => {
                      const added = usedTypes.has(meta.type)
                      return (
                        <div className="wdg-add-row" key={meta.type}>
                          <span className="wdg-icon"><Icon path={meta.icon} size={16} /></span>
                          <div className="wdg-add-text">
                            <strong>{t(meta.titleKey)}</strong>
                            <span>{t(meta.descriptionKey)}</span>
                          </div>
                          <button
                            type="button"
                            className="wdg-btn"
                            disabled={added}
                            onClick={() => addWidget(meta.type)}
                          >
                            {added ? t('pages.myDashboard.added') : t('pages.myDashboard.add')}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {configOpen && configWidget && (
        <div className="wdg-overlay" onMouseDown={event => { if (event.target === event.currentTarget) closeConfig() }}>
          <div ref={configModalRef} className="wdg-modal" role="dialog" aria-modal="true" aria-labelledby="wdg-config-title" tabIndex={-1}>
            <div className="wdg-modal-head">
              <div>
                <h2 id="wdg-config-title">{t('pages.myDashboard.config.title', { widget: t(widgetMeta(configWidget.type).titleKey) })}</h2>
                <p>{t('pages.myDashboard.config.hint')}</p>
              </div>
              <button type="button" className="wdg-icon-btn" onClick={closeConfig} aria-label={t('pages.myDashboard.close')}>
                <Icon path={ICON.close} size={16} />
              </button>
            </div>
            <div className="wdg-config-body">
              {configWidget.type === 'text' && (
                <label className="wdg-field">
                  <span>{t('pages.myDashboard.config.textLabel')}</span>
                  <textarea
                    rows={8}
                    maxLength={2000}
                    value={draft.text ?? ''}
                    placeholder={t('pages.myDashboard.config.textPlaceholder')}
                    onChange={event => setDraft(previous => ({ ...previous, text: event.target.value }))}
                  />
                </label>
              )}
              {configWidget.type === 'iframe' && (
                <>
                  <label className="wdg-field">
                    <span>{t('pages.myDashboard.config.urlLabel')}</span>
                    <input
                      type="url"
                      value={draft.url ?? ''}
                      placeholder="https://example.com/embed"
                      onChange={event => setDraft(previous => ({ ...previous, url: event.target.value }))}
                    />
                  </label>
                  <label className="wdg-field">
                    <span>{t('pages.myDashboard.config.frameTitleLabel')}</span>
                    <input
                      type="text"
                      maxLength={100}
                      value={draft.title ?? ''}
                      placeholder={t('pages.myDashboard.config.frameTitlePlaceholder')}
                      onChange={event => setDraft(previous => ({ ...previous, title: event.target.value }))}
                    />
                  </label>
                  <p className="wdg-note">{t('pages.myDashboard.config.iframeHint')}</p>
                </>
              )}
              {configWidget.type === 'logo' && (
                <>
                  <label className="wdg-field">
                    <span>{t('pages.myDashboard.config.logoUrlLabel')}</span>
                    <input
                      type="url"
                      value={draft.src && !draft.src.startsWith('data:') ? draft.src : ''}
                      placeholder="https://example.com/logo.svg"
                      onChange={event => setDraft(previous => ({ ...previous, src: event.target.value }))}
                    />
                  </label>
                  <label className="wdg-field">
                    <span>{t('pages.myDashboard.config.logoUpload')}</span>
                    <input type="file" accept="image/*" onChange={event => onLogoFile(event.target.files?.[0])} />
                  </label>
                  <label className="wdg-field">
                    <span>{t('pages.myDashboard.config.logoAltLabel')}</span>
                    <input
                      type="text"
                      maxLength={100}
                      value={draft.alt ?? ''}
                      placeholder={t('pages.myDashboard.config.logoAltPlaceholder')}
                      onChange={event => setDraft(previous => ({ ...previous, alt: event.target.value }))}
                    />
                  </label>
                  {safeImageUrl(draft.src, { allowSvgData: true }) && <div className="wdg-logo-preview"><img src={safeImageUrl(draft.src, { allowSvgData: true }) ?? undefined} alt="" /></div>}
                  <p className="wdg-note">{t('pages.myDashboard.config.logoShareNote')}</p>
                </>
              )}
              {configError && <p className="wdg-note is-error">{configError}</p>}
            </div>
            <div className="wdg-modal-actions">
              <button type="button" className="wdg-btn" onClick={closeConfig}>{t('pages.myDashboard.config.cancel')}</button>
              <button type="button" className="wdg-btn wdg-btn-primary" onClick={saveConfig}>{t('pages.myDashboard.config.save')}</button>
            </div>
          </div>
        </div>
      )}

      {shareOpen && (
        <div className="wdg-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setShareOpen(false) }}>
          <div ref={shareModalRef} className="wdg-modal wdg-modal-share" role="dialog" aria-modal="true" aria-labelledby="wdg-share-title" tabIndex={-1}>
            <div className="wdg-modal-head">
              <div>
                <h2 id="wdg-share-title">{t('pages.myDashboard.shareTitle')}</h2>
                <p>{t('pages.myDashboard.shareHint')}</p>
              </div>
              <button type="button" className="wdg-icon-btn" onClick={() => setShareOpen(false)} aria-label={t('pages.myDashboard.close')}>
                <Icon path={ICON.close} size={16} />
              </button>
            </div>
            <div className="wdg-share-row">
              <input readOnly value={shareUrl} onFocus={event => event.currentTarget.select()} aria-label={t('pages.myDashboard.shareTitle')} />
              <button type="button" className="wdg-btn wdg-btn-primary" onClick={copyShareUrl}>
                {copied === 'copied' ? t('pages.myDashboard.copied') : t('pages.myDashboard.copy')}
              </button>
            </div>
            {copied === 'error' && <p className="wdg-note is-error">{t('pages.myDashboard.copyError')}</p>}
            <p className="wdg-note">{t('pages.myDashboard.shareDataNote')}</p>
            <p className="wdg-note">{t('pages.myDashboard.shareRbacNote')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
