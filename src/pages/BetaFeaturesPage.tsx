import { useMemo, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import { PageHeader } from '../ui'
import type { Page } from '../routing'
import { PAGE_TITLE } from '../routing'
import NineDotIcon from '../components/NineDotIcon'
import Toggle from '../components/Toggle'
import {
  BETA_BRIEFING_MODE,
  BETA_CATEGORY_LAUNCHER,
  BETA_COMMAND_PALETTE,
  BETA_FINDINGS_TRIAGE,
  BETA_MY_DASHBOARD,
  BETA_PERSONA_HOME,
  BETA_PINNED_PAGES,
  BETA_RUN_BOOKMARKS,
  BETA_SAVED_VIEWS,
  BETA_WIDGET_WALL,
  isBetaFeatureEnabled,
  type BetaFeatureId,
  type PersonaHomeId,
  type UserPreferences,
} from './userPrefsUtils'
import { PERSONA_KPI_LABELS, PERSONA_PRESETS } from './personaHome'

interface Props {
  prefs: UserPreferences
  onChange: (prefs: UserPreferences) => void
  onOpenSettings: () => void
  onNavigate: (page: Page) => void
  hasRun: boolean
  onStartBriefing: () => void
  onStartWidgetWall: () => void
}

type Group = 'workspace' | 'analysis' | 'presentation'

interface ModuleDef {
  id: BetaFeatureId
  group: Group
  title: string
  description: string
  icon: ReactNode
}

const CHECK = 'M5 13l4 4L19 7'
const ICONS = {
  palette: 'M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z',
  views: 'M6 4h12a1 1 0 011 1v16l-7-4-7 4V5a1 1 0 011-1z',
  pin: 'M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6zM12 14v7',
  persona: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  triage: 'M13 10V3L4 14h7v7l9-11h-7z',
  bookmark: 'M6 4h12a1 1 0 011 1v16l-7-4-7 4V5a1 1 0 011-1z',
  briefing: 'M2 3h20v14H2zM8 21h8M12 17v4',
  wall: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  dashboard: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
}

function ModuleIcon({ path }: { path: string }) {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  )
}

function Benefits({ items }: { items: string[] }) {
  return (
    <ul className="beta-benefits">
      {items.map(benefit => (
        <li key={benefit}>
          <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d={CHECK} />
          </svg>
          <span>{benefit}</span>
        </li>
      ))}
    </ul>
  )
}

export default function BetaFeaturesPage({
  prefs, onChange, onOpenSettings, onNavigate, hasRun, onStartBriefing, onStartWidgetWall,
}: Props) {
  const { t } = useI18n()
  const enabled = (id: BetaFeatureId) => isBetaFeatureEnabled(prefs, id)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<BetaFeatureId>(() =>
    (Object.values(BETA_FEATURES_CONST) as BetaFeatureId[]).find(id => isBetaFeatureEnabled(prefs, id))
      ?? BETA_CATEGORY_LAUNCHER,
  )

  function setFeature(id: BetaFeatureId, value: boolean) {
    const next = new Set(prefs.betaFeatures ?? [])
    if (value) next.add(id)
    else next.delete(id)
    onChange({ ...prefs, betaFeatures: [...next] })
  }

  function selectPersona(id: PersonaHomeId | '') {
    const next = new Set(prefs.betaFeatures ?? [])
    if (id) next.add(BETA_PERSONA_HOME)
    onChange({
      ...prefs,
      betaFeatures: [...next],
      personaHome: id,
      ...(id ? { defaultPage: PERSONA_PRESETS[id].page } : {}),
    })
  }

  function unpin(page: Page) {
    onChange({ ...prefs, pinnedPages: (prefs.pinnedPages ?? []).filter(pinned => pinned !== page) })
  }

  const modules: ModuleDef[] = useMemo(() => [
    { id: BETA_CATEGORY_LAUNCHER, group: 'workspace', icon: <NineDotIcon size={18} />, title: t('pages.betaFeatures.categoryLauncherTitle'), description: t('pages.betaFeatures.categoryLauncherDesc') },
    { id: BETA_COMMAND_PALETTE, group: 'workspace', icon: <ModuleIcon path={ICONS.palette} />, title: t('pages.betaFeatures.commandPaletteTitle'), description: t('pages.betaFeatures.commandPaletteDesc') },
    { id: BETA_PINNED_PAGES, group: 'workspace', icon: <ModuleIcon path={ICONS.pin} />, title: t('pages.betaFeatures.pinnedPagesTitle'), description: t('pages.betaFeatures.pinnedPagesDesc') },
    { id: BETA_PERSONA_HOME, group: 'workspace', icon: <ModuleIcon path={ICONS.persona} />, title: t('pages.betaFeatures.personaHomeTitle'), description: t('pages.betaFeatures.personaHomeDesc') },
    { id: BETA_SAVED_VIEWS, group: 'analysis', icon: <ModuleIcon path={ICONS.views} />, title: t('pages.betaFeatures.savedViewsTitle'), description: t('pages.betaFeatures.savedViewsDesc') },
    { id: BETA_FINDINGS_TRIAGE, group: 'analysis', icon: <ModuleIcon path={ICONS.triage} />, title: t('pages.betaFeatures.findingsTriageTitle'), description: t('pages.betaFeatures.findingsTriageDesc') },
    { id: BETA_RUN_BOOKMARKS, group: 'analysis', icon: <ModuleIcon path={ICONS.bookmark} />, title: t('pages.betaFeatures.runBookmarksTitle'), description: t('pages.betaFeatures.runBookmarksDesc') },
    { id: BETA_BRIEFING_MODE, group: 'presentation', icon: <ModuleIcon path={ICONS.briefing} />, title: t('pages.betaFeatures.briefingModeTitle'), description: t('pages.betaFeatures.briefingModeDesc') },
    { id: BETA_WIDGET_WALL, group: 'presentation', icon: <ModuleIcon path={ICONS.wall} />, title: t('pages.betaFeatures.widgetWallTitle'), description: t('pages.betaFeatures.widgetWallDesc') },
    { id: BETA_MY_DASHBOARD, group: 'workspace', icon: <ModuleIcon path={ICONS.dashboard} />, title: t('pages.betaFeatures.myDashboardTitle'), description: t('pages.betaFeatures.myDashboardDesc') },
  ], [t])

  const groups: { id: Group; label: string; modules: ModuleDef[] }[] = [
    { id: 'workspace', label: t('pages.betaFeatures.groupWorkspace'), modules: modules.filter(module => module.group === 'workspace') },
    { id: 'analysis', label: t('pages.betaFeatures.groupAnalysis'), modules: modules.filter(module => module.group === 'analysis') },
    { id: 'presentation', label: t('pages.betaFeatures.groupPresentation'), modules: modules.filter(module => module.group === 'presentation') },
  ]
  const normalizedQuery = query.trim().toLowerCase()
  const filteredGroups = groups
    .map(group => ({
      ...group,
      modules: group.modules.filter(module =>
        !normalizedQuery || module.title.toLowerCase().includes(normalizedQuery) || module.description.toLowerCase().includes(normalizedQuery),
      ),
    }))
    .filter(group => group.modules.length > 0)

  const selectedModule = modules.find(module => module.id === selectedId) ?? null
  const selectedPersona = prefs.personaHome ? PERSONA_PRESETS[prefs.personaHome] : null
  const pinnedPages = prefs.pinnedPages ?? []
  const personaCopy: Record<PersonaHomeId, { title: string; description: string }> = {
    ciso: { title: t('pages.betaFeatures.personaCiso'), description: t('pages.betaFeatures.personaCisoDesc') },
    architect: { title: t('pages.betaFeatures.personaArchitect'), description: t('pages.betaFeatures.personaArchitectDesc') },
    engineer: { title: t('pages.betaFeatures.personaEngineer'), description: t('pages.betaFeatures.personaEngineerDesc') },
  }

  function renderBody(id: BetaFeatureId) {
    if (id === BETA_CATEGORY_LAUNCHER) {
      return (
        <>
          <Benefits items={[t('pages.betaFeatures.benefitNav'), t('pages.betaFeatures.benefitOverlay'), t('pages.betaFeatures.benefitReversible')]} />
          <div className="beta-module-actions">
            <button type="button" className="beta-secondary" onClick={() => window.dispatchEvent(new CustomEvent('wombat:open-category-launcher'))}>
              <NineDotIcon size={15} /> {t('pages.betaFeatures.preview')}
            </button>
            <span className="beta-hint">{t('pages.betaFeatures.changesInstant')}</span>
          </div>
        </>
      )
    }
    if (id === BETA_COMMAND_PALETTE) {
      return (
        <>
          <Benefits items={[t('pages.betaFeatures.commandPaletteBenefit1'), t('pages.betaFeatures.commandPaletteBenefit2'), t('pages.betaFeatures.commandPaletteBenefit3')]} />
          <div className="beta-module-actions">
            <button type="button" className="beta-secondary" onClick={() => window.dispatchEvent(new CustomEvent('wombat:open-command-palette'))}>
              <kbd className="beta-kbd">⌘K</kbd> {t('pages.betaFeatures.tryIt')}
            </button>
          </div>
        </>
      )
    }
    if (id === BETA_SAVED_VIEWS) {
      return (
        <>
          <Benefits items={[t('pages.betaFeatures.savedViewsBenefit1'), t('pages.betaFeatures.savedViewsBenefit2'), t('pages.betaFeatures.savedViewsBenefit3')]} />
          <div className="beta-hint">{t('pages.betaFeatures.savedViewsHint')}</div>
        </>
      )
    }
    if (id === BETA_PINNED_PAGES) {
      return (
        <>
          {pinnedPages.length === 0 ? (
            <div className="beta-hint">{t('pages.betaFeatures.pinnedPagesHint')}</div>
          ) : (
            <div className="beta-pin-list">
              {pinnedPages.map(page => (
                <span className="beta-pin-chip" key={page}>
                  {PAGE_TITLE[page]}
                  <button type="button" onClick={() => unpin(page)} aria-label={`${t('pages.betaFeatures.unpin')} ${PAGE_TITLE[page]}`} title={t('pages.betaFeatures.unpin')}>
                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="beta-hint">{t('pages.betaFeatures.pinnedPagesHint')}</div>
        </>
      )
    }
    if (id === BETA_PERSONA_HOME) {
      return (
        <>
          <div className="beta-presets">
            {(Object.keys(PERSONA_PRESETS) as PersonaHomeId[]).map(personaId => {
              const selected = prefs.personaHome === personaId
              return (
                <button type="button" key={personaId} className={`beta-preset${selected ? ' is-selected' : ''}`} aria-pressed={selected} onClick={() => selectPersona(personaId)}>
                  <span className="beta-preset-title">{personaCopy[personaId].title}</span>
                  <span className="beta-preset-desc">{personaCopy[personaId].description}</span>
                </button>
              )
            })}
            <button type="button" className={`beta-preset${prefs.personaHome === '' ? ' is-selected' : ''}`} aria-pressed={prefs.personaHome === ''} onClick={() => selectPersona('')}>
              <span className="beta-preset-title">{t('pages.betaFeatures.personaDefault')}</span>
              <span className="beta-preset-desc">{t('pages.betaFeatures.personaDefaultDesc')}</span>
            </button>
          </div>
          {selectedPersona && (
            <div className="beta-persona-meta">
              <div className="beta-meta-row"><span>{t('pages.betaFeatures.personaHomeLanding')}</span><strong>{PAGE_TITLE[selectedPersona.page]}</strong></div>
              <div className="beta-meta-row">
                <span>{t('pages.betaFeatures.personaHomeKpis')}</span>
                <span className="beta-kpi-chips">{selectedPersona.kpiOrder.map(kpi => <span className="beta-kpi-chip" key={kpi}>{PERSONA_KPI_LABELS[kpi] ?? kpi}</span>)}</span>
              </div>
              <button type="button" className="beta-secondary" onClick={() => onNavigate(selectedPersona.page)}>{t('pages.betaFeatures.personaOpen')}</button>
            </div>
          )}
          {!enabled(BETA_PERSONA_HOME) && <div className="beta-hint">{t('pages.betaFeatures.personaOffHint')}</div>}
        </>
      )
    }
    if (id === BETA_FINDINGS_TRIAGE) {
      return (
        <>
          <Benefits items={[t('pages.betaFeatures.findingsTriageBenefit1'), t('pages.betaFeatures.findingsTriageBenefit2'), t('pages.betaFeatures.findingsTriageBenefit3')]} />
          <div className="beta-module-actions">
            <button type="button" className="beta-secondary" onClick={() => onNavigate('findings')}>{t('pages.betaFeatures.triageOpenFindings')}</button>
            <span className="beta-hint">Then choose <strong>Triage</strong> in the Findings filter bar.</span>
          </div>
        </>
      )
    }
    if (id === BETA_RUN_BOOKMARKS) {
      return (
        <>
          <Benefits items={[t('pages.betaFeatures.runBookmarksBenefit1'), t('pages.betaFeatures.runBookmarksBenefit2'), t('pages.betaFeatures.runBookmarksBenefit3')]} />
          <div className="beta-module-actions">
            <button type="button" className="beta-secondary" onClick={() => onNavigate('runs')}>{t('pages.betaFeatures.runBookmarksOpenRuns')}</button>
            <span className="beta-hint">{t('pages.betaFeatures.runBookmarksCount', { count: (prefs.bookmarkedRuns ?? []).length })}</span>
          </div>
        </>
      )
    }
    if (id === BETA_BRIEFING_MODE) {
      return (
        <>
          <Benefits items={[t('pages.betaFeatures.briefingModeBenefit1'), t('pages.betaFeatures.briefingModeBenefit2'), t('pages.betaFeatures.briefingModeBenefit3')]} />
          <div className="beta-module-actions">
            <button type="button" className="beta-secondary" disabled={!hasRun} onClick={onStartBriefing}>{t('pages.betaFeatures.briefingStart')}</button>
            {!hasRun && <span className="beta-hint">{t('pages.betaFeatures.briefingNoRun')}</span>}
          </div>
        </>
      )
    }
    if (id === BETA_MY_DASHBOARD) {
      return (
        <>
          <Benefits items={[
            t('pages.betaFeatures.myDashboardBenefit1'),
            t('pages.betaFeatures.myDashboardBenefit2'),
            t('pages.betaFeatures.myDashboardBenefit3'),
          ]} />
          <div className="beta-module-actions">
            <button type="button" className="beta-secondary" disabled={!enabled(BETA_MY_DASHBOARD)} onClick={() => onNavigate('mydashboard')}>
              {t('pages.betaFeatures.myDashboardOpen')}
            </button>
            <span className="beta-hint">
              {enabled(BETA_MY_DASHBOARD) ? t('pages.betaFeatures.changesInstant') : t('pages.betaFeatures.myDashboardOffHint')}
            </span>
          </div>
        </>
      )
    }
    if (id === BETA_WIDGET_WALL) {
      return (
        <>
          <Benefits items={[t('pages.betaFeatures.widgetWallBenefit1'), t('pages.betaFeatures.widgetWallBenefit2'), t('pages.betaFeatures.widgetWallBenefit3')]} />
          <div className="beta-module-actions">
            <button type="button" className="beta-secondary" disabled={!hasRun} onClick={onStartWidgetWall}>{t('pages.betaFeatures.wallOpen')}</button>
            {!hasRun && <span className="beta-hint">{t('pages.betaFeatures.wallNoRun')}</span>}
          </div>
        </>
      )
    }
    return null
  }

  return (
    <div className="beta-page">
      <style>{'.beta-page-header.ui-page-header { margin-bottom: 0; }'}</style>
      <PageHeader
        className="beta-page-header"
        title={<>{t('pages.betaFeatures.pageTitle')}{' '}<span className="beta-pill">{t('pages.betaFeatures.experimental')}</span></>}
        description={t('pages.betaFeatures.pageSubtitle')}
        actions={
          <button type="button" className="beta-secondary" onClick={onOpenSettings} aria-label={t('pages.betaFeatures.backToSettings')}>
            <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('pages.betaFeatures.backToSettings')}
          </button>
        }
      />

      <div className="beta-notice" role="note">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <p>{t('pages.betaFeatures.experimentalNotice')}</p>
      </div>

      <div className="beta-browser">
        <aside className="beta-rail">
          <input
            className="beta-search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={t('pages.betaFeatures.searchPlaceholder')}
            aria-label={t('pages.betaFeatures.searchPlaceholder')}
          />
          <div className="beta-rail-list">
            {filteredGroups.map(group => (
              <div className="beta-rail-group" key={group.id}>
                <div className="beta-rail-label">{group.label}</div>
                {group.modules.map(module => {
                  const on = enabled(module.id)
                  return (
                    <button
                      type="button"
                      key={module.id}
                      className={`beta-rail-item${module.id === selectedId ? ' is-selected' : ''}`}
                      aria-current={module.id === selectedId ? 'true' : undefined}
                      onClick={() => setSelectedId(module.id)}
                    >
                      <span className="beta-rail-icon">{module.icon}</span>
                      <span className="beta-rail-text">{module.title}</span>
                      <span className={`beta-rail-status${on ? ' is-on' : ''}`}>{on ? t('pages.betaFeatures.enabled') : t('pages.betaFeatures.disabled')}</span>
                    </button>
                  )
                })}
              </div>
            ))}
            {filteredGroups.length === 0 && <div className="beta-hint">{t('pages.betaFeatures.noModules')}</div>}
          </div>
          <button type="button" className="beta-disable-all" onClick={() => onChange({ ...prefs, betaFeatures: [] })}>
            {t('pages.betaFeatures.disableAll')}
          </button>
        </aside>

        <section className="card beta-detail">
          {selectedModule ? (
            <>
              <div className="beta-module-head">
                <div className="beta-module-intro">
                  <span className="beta-module-icon">{selectedModule.icon}</span>
                  <div>
                    <div className="beta-module-title-row">
                      <h2>{selectedModule.title}</h2>
                      <span className="beta-pill">{t('pages.betaFeatures.betaPill')}</span>
                    </div>
                    <p>{selectedModule.description}</p>
                  </div>
                </div>
                <div className="beta-module-switch">
                  <span className={`beta-state${enabled(selectedModule.id) ? ' is-on' : ''}`}>
                    {enabled(selectedModule.id) ? t('pages.betaFeatures.enabled') : t('pages.betaFeatures.disabled')}
                  </span>
                  <Toggle
                    checked={enabled(selectedModule.id)}
                    onChange={value => setFeature(selectedModule.id, value)}
                    label={`${selectedModule.title} — ${enabled(selectedModule.id) ? t('pages.betaFeatures.enabled') : t('pages.betaFeatures.disabled')}`}
                  />
                </div>
              </div>
              <div className="beta-detail-body">{renderBody(selectedModule.id)}</div>
            </>
          ) : (
            <div className="beta-hint">{t('pages.betaFeatures.noModules')}</div>
          )}
        </section>
      </div>

      <p className="beta-footnote">{t('pages.betaFeatures.moreComing')}</p>
    </div>
  )
}

// Local tuple of ids used only to choose the initial rail selection.
const BETA_FEATURES_CONST = [
  BETA_CATEGORY_LAUNCHER,
  BETA_COMMAND_PALETTE,
  BETA_PINNED_PAGES,
  BETA_PERSONA_HOME,
  BETA_SAVED_VIEWS,
  BETA_FINDINGS_TRIAGE,
  BETA_RUN_BOOKMARKS,
  BETA_BRIEFING_MODE,
  BETA_WIDGET_WALL,
] as const
