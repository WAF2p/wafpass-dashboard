import { useMemo, useState } from 'react'
import { RunDetail, ControlMeta } from '../api'
import { FRAMEWORKS } from '../controls-data'
import { useControlsCatalogue } from '../useControlsCatalogue'
import type { Settings } from './settingsUtils'
import { useI18n } from '../i18n'
import { useBetaFeatures } from '../beta/BetaFeaturesContext'
import { BETA_PERSONA_HOME } from './userPrefsUtils'
import { getPersonaPreset } from './personaHome'
import FrameworkDetailPage from './FrameworkDetailPage'
import {
  CircularScore, SectionCard, SegmentedTabs, SocStyles,
  CheckIcon, XIcon, MinusIcon, GlobeIcon, SearchIcon, GridIcon, ListIcon, LockIcon, SignalIcon,
  ShieldIcon, CostIcon, OpsIcon, PerfIcon, RelIcon, SovIcon, SusIcon, AgenticIcon, ArrowRightIcon,
  scoreColor, scoreGlow, statusColor,
} from './shared/SocComponents'
import { EmptyState, PageHeader } from '../ui'
import type { Page } from '../routing'
import { severityColor } from '../severity'

// All 8 pillars including agentic
const PILLAR_META: { key: string; label: string; color: string; icon: () => JSX.Element }[] = [
  { key: 'security',       label: 'Security',       color: 'var(--fail)', icon: ShieldIcon },
  { key: 'cost',           label: 'Cost',           color: 'var(--waf-brand)', icon: CostIcon },
  { key: 'operations',     label: 'Operations',     color: 'var(--waived)', icon: OpsIcon },
  { key: 'performance',    label: 'Performance',    color: 'var(--waf-warn)', icon: PerfIcon },
  { key: 'reliability',    label: 'Reliability',    color: 'var(--pass)', icon: RelIcon },
  { key: 'sovereign',      label: 'Sovereignty',    color: 'var(--score-high)', icon: SovIcon },
  { key: 'sustainability', label: 'Sustainability', color: 'var(--pass)', icon: SusIcon },
  { key: 'agentic',        label: 'Agentic',        color: 'var(--waived)', icon: AgenticIcon },
]

function normalizePillarName(p: string): string {
  if (p === 'operational') return 'operations'
  return p
}

interface Props { run: RunDetail; settings?: Settings; navigate?: (page: Page, filters?: { framework?: string }) => void }

function StatusBar({ score, passRate }: { score: number; passRate: number }) {
  const armed = score >= 80
  const warning = score >= 60 && score < 80
  return (
    <div className="scc-statusbar">
      <div className="scc-statusbar__line" />
      <div className={`scc-statusbar__badge ${armed ? 'scc-statusbar__badge--armed' : warning ? 'scc-statusbar__badge--warn' : 'scc-statusbar__badge--alert'}`}>
        <span className="scc-statusbar__pulse" />
        <span>{armed ? 'SYSTEM SECURE' : warning ? 'CONDITION YELLOW' : 'ALERT — ACTION REQUIRED'}</span>
      </div>
      <div className="scc-statusbar__readouts">
        <div className="scc-statusbar__readout">
          <span className="scc-statusbar__label">POSTURE</span>
          <span className="scc-statusbar__value" style={{ color: scoreColor(score) }}>{score}%</span>
        </div>
        <div className="scc-statusbar__readout">
          <span className="scc-statusbar__label">PASS RATE</span>
          <span className="scc-statusbar__value" style={{ color: scoreColor(passRate) }}>{passRate}%</span>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers reused inside render ─────────────────────────────────────────────

type SortKey = 'country' | 'name' | 'coverage_desc' | 'coverage_asc'

export default function CompliancePage({ run, settings, navigate }: Props) {
  const { t } = useI18n()
  const { prefs, isEnabled } = useBetaFeatures()
  const persona = isEnabled(BETA_PERSONA_HOME) ? getPersonaPreset(prefs.personaHome) : null
  const kpiOrder = persona?.id === 'ciso' ? persona.kpiOrder : null
  const orderOf = (id: string) => (kpiOrder ? Math.max(0, kpiOrder.indexOf(id)) : 0)
  const isHidden = (id: string) => !!kpiOrder && !kpiOrder.includes(id)
  const [tab, setTab] = useState<'pillars' | 'frameworks' | 'framework-detail'>('pillars')
  const [detailFrameworkId, setDetailFrameworkId] = useState<string | null>(null)
  const catalogue = useControlsCatalogue()

  // Framework filter state
  const allCountries = useMemo(() =>
    [...new Map(FRAMEWORKS.map(f => [f.country, { country: f.country, flag: f.flag }])).values()],
    []
  )
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(() => {
    const activeRegions = settings?.regulatoryRegions
    if (activeRegions && activeRegions.length > 0) {
      return new Set(FRAMEWORKS.filter(f => activeRegions.includes(f.region)).map(f => f.country))
    }
    return new Set(allCountries.map(c => c.country))
  })
  const [fwSearch, setFwSearch]   = useState('')
  const [sortKey, setSortKey]     = useState<SortKey>('country')
  const findings = run.findings
  const pillars = PILLAR_META.map(p => normalizePillarName(p.key))

  const controlsCatalogue: ControlMeta[] = useMemo(() =>
    run.controls_meta.length > 0 ? run.controls_meta : catalogue as unknown as ControlMeta[],
    [run.controls_meta, catalogue]
  )

  // ── Pillar tab stats ────────────────────────────────────────────────────
  const pillarStats = PILLAR_META.map(pm => {
    const normalizedPillar = normalizePillarName(pm.key)
    const pf = findings.filter(f => normalizePillarName(f.pillar ?? '') === normalizedPillar)
    const total  = pf.length
    const pass   = pf.filter(f => f.status?.toUpperCase() === 'PASS').length
    const fail   = pf.filter(f => f.status?.toUpperCase() === 'FAIL').length
    const waived = pf.filter(f => f.status?.toUpperCase() === 'WAIVED').length
    const passRate = total > 0 ? Math.round((pass / total) * 100) : 0
    const rawScore = run.pillar_scores?.[normalizedPillar] ?? run.pillar_scores?.[pm.key]
    const score  = rawScore ?? passRate
    return { key: pm.key, pillar: normalizedPillar, total, pass, fail, waived, passRate, score, color: pm.color, icon: pm.icon }
  })

  const overallScore = useMemo(() => {
    if (pillarStats.length === 0) return 0
    return Math.round(pillarStats.reduce((sum, s) => sum + s.score, 0) / pillarStats.length)
  }, [pillarStats])

  const overallPassRate = useMemo(() => {
    const total = findings.length
    const pass = findings.filter(f => f.status?.toUpperCase() === 'PASS').length
    return total > 0 ? Math.round((pass / total) * 100) : 0
  }, [findings])

  const overallFailCount = useMemo(() => findings.filter(f => f.status?.toUpperCase() === 'FAIL').length, [findings])
  const overallCritCount = useMemo(() => findings.filter(f => f.status?.toUpperCase() === 'FAIL' && f.severity?.toUpperCase() === 'CRITICAL').length, [findings])

  const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
  const sevLabel: Record<string, string> = { CRITICAL: 'CRIT', HIGH: 'HIGH', MEDIUM: 'MED', LOW: 'LOW' }

  // ── Frameworks tab stats ─────────────────────────────────────────────────
  function controlRunStatus(ctrlId: string): 'PASS' | 'FAIL' | 'SKIP' | 'UNKNOWN' {
    const related = findings.filter(f => f.control_id === ctrlId)
    if (!related.length) return 'UNKNOWN'
    if (related.some(f => f.status?.toUpperCase() === 'FAIL')) return 'FAIL'
    if (related.every(f => f.status?.toUpperCase() === 'PASS')) return 'PASS'
    return 'SKIP'
  }

  const STATUS_COLOR: Record<string, string> = {
    PASS: 'var(--pass-ink)',
    FAIL: 'var(--fail-ink)',
    SKIP: 'var(--muted)',
    UNKNOWN: 'var(--muted)',
  }
  const STATUS_ICON: Record<string, () => JSX.Element> = {
    PASS: CheckIcon, FAIL: XIcon, SKIP: MinusIcon, UNKNOWN: MinusIcon,
  }

  const frameworkStats = useMemo(() => {
    const withStats = FRAMEWORKS.map(fw => {
      const mappedControls = controlsCatalogue.filter(c =>
        c.regulatory_mapping.some(m => m.framework === fw.id)
      )
      const statuses   = mappedControls.map(c => controlRunStatus(c.id))
      const passCount  = statuses.filter(s => s === 'PASS').length
      const failCount  = statuses.filter(s => s === 'FAIL').length
      const knownCount = statuses.filter(s => s !== 'UNKNOWN').length
      const passRate   = knownCount > 0 ? Math.round((passCount / knownCount) * 100) : null
      return { fw, mappedControls, passCount, failCount, passRate }
    })

    const filtered = withStats.filter(({ fw }) =>
      selectedCountries.has(fw.country) &&
      (fwSearch === '' ||
        fw.label.toLowerCase().includes(fwSearch.toLowerCase()) ||
        fw.desc.toLowerCase().includes(fwSearch.toLowerCase()) ||
        fw.country.toLowerCase().includes(fwSearch.toLowerCase()))
    )

    const sorted = [...filtered].sort((a, b) => {
      if (sortKey === 'country') {
        const rc = a.fw.country.localeCompare(b.fw.country)
        return rc !== 0 ? rc : a.fw.label.localeCompare(b.fw.label)
      }
      if (sortKey === 'name') return a.fw.label.localeCompare(b.fw.label)
      const ar = a.passRate ?? -1, br = b.passRate ?? -1
      return sortKey === 'coverage_desc' ? br - ar : ar - br
    })

    return { sorted, total: withStats.length, filteredCount: filtered.length }
  }, [controlsCatalogue, selectedCountries, fwSearch, sortKey])

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="scc-root">
      <SocStyles />
      <style>{securityCommandCenterCss}</style>

      {/* Hero — command center header */}
      <PageHeader
        eyebrow={<><SignalIcon /> SECURITY COMMAND CENTER</>}
        title={<>{t('compliance.pillarTab')} &amp; {t('compliance.frameworkTab')}</>}
        description={<>Live posture monitoring across {findings.length} checks and {FRAMEWORKS.length} regulatory frameworks.</>}
        actions={
          <div className="scc-hero__score">
            <CircularScore value={overallScore} size={150} stroke={10} color={scoreColor(overallScore)} />
            <div className="scc-hero__score-label">
              <span className="scc-hero__score-value" style={{ color: scoreColor(overallScore) }}>{overallScore}</span>
              <span className="scc-hero__score-unit">SECURITY POSTURE</span>
            </div>
          </div>
        }
      />

      {/* Status bar */}
      <StatusBar score={overallScore} passRate={overallPassRate} />

      {/* KPI tiles */}
      <div className="scc-kpi-grid">
        <div className="scc-kpi scc-kpi--pass" style={{ order: orderOf('passing'), display: isHidden('passing') ? 'none' : undefined }}>
          <div className="scc-kpi__label">PASSING CHECKS</div>
          <div className="scc-kpi__value" style={{ color: statusColor('good') }}>{overallPassRate}%</div>
        </div>
        <div className="scc-kpi scc-kpi--fail" style={{ order: orderOf('failed'), display: isHidden('failed') ? 'none' : undefined }}>
          <div className="scc-kpi__label">FAILED CHECKS</div>
          <div className="scc-kpi__value" style={{ color: overallFailCount > 0 ? statusColor('bad') : statusColor('muted') }}>{overallFailCount}</div>
        </div>
        <div className="scc-kpi scc-kpi--crit" style={{ order: orderOf('critical'), display: isHidden('critical') ? 'none' : undefined }}>
          <div className="scc-kpi__label">CRITICAL FINDINGS</div>
          <div className="scc-kpi__value" style={{ color: overallCritCount > 0 ? statusColor('bad') : statusColor('muted') }}>{overallCritCount}</div>
        </div>
        <div className="scc-kpi scc-kpi--frameworks" style={{ order: orderOf('frameworks'), display: isHidden('frameworks') ? 'none' : undefined }}>
          <div className="scc-kpi__label">FRAMEWORKS TRACKED</div>
          <div className="scc-kpi__value" style={{ color: statusColor('info') }}>{FRAMEWORKS.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <SegmentedTabs
        options={[
          { key: 'pillars',          label: t('compliance.pillarTab'),          icon: GridIcon },
          { key: 'frameworks',       label: t('compliance.frameworkTab'),       icon: GlobeIcon },
          { key: 'framework-detail', label: t('compliance.frameworkDetailTab'), icon: ListIcon, disabled: tab !== 'framework-detail' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* ── Pillar tab ──────────────────────────────────────────────────────── */}
      {tab === 'pillars' && (
        <div className="scc-pillar-view">
          {pillars.length === 0 ? (
            <SectionCard title={t('compliance.pillarTab')}>
              <EmptyState title={t('compliance.noPillarData')} />
            </SectionCard>
          ) : (
            <>
              <div className="scc-pillar-grid">
                {pillarStats.map(s => (
                  <div key={s.key} className="scc-pillar-card" style={{ '--pillar-color': s.color } as React.CSSProperties}>
                    <div className="scc-pillar-card__top">
                      <div className="scc-pillar-card__icon" style={{ color: s.color }}>
                        <s.icon />
                      </div>
                      <div className="scc-pillar-card__ring">
                        <CircularScore value={s.score} size={84} stroke={7} color={scoreColor(s.score)} />
                      </div>
                    </div>
                    <div className="scc-pillar-card__name">{s.pillar}</div>
                    <div className="scc-pillar-card__counts">
                      <span className="scc-pill scc-pill--pass"><CheckIcon /> {s.pass}</span>
                      {s.fail > 0 && <span className="scc-pill scc-pill--fail"><XIcon /> {s.fail}</span>}
                      {s.waived > 0 && <span className="scc-pill scc-pill--waived"><MinusIcon /> {s.waived}</span>}
                      <span className="scc-pill scc-pill--total">{s.total} total</span>
                    </div>
                    <div className="scc-pillar-card__bar">
                      <span style={{ width: `${s.passRate}%`, background: scoreColor(s.passRate) }} />
                    </div>
                  </div>
                ))}
              </div>

              <SectionCard title={t('compliance.failingFindings')} subtitle="Severity heatmap across pillars">
                <div className="scc-heatmap">
                  {pillarStats.map(s => (
                    <div key={s.key} className="scc-heatmap__row">
                      <div className="scc-heatmap__pillar">
                        <span className="scc-heatmap__dot" style={{ background: s.color }} />
                        <span style={{ textTransform: 'capitalize' }}>{s.pillar}</span>
                      </div>
                      <div className="scc-heatmap__passrate">
                        <span className="scc-heatmap__bar-bg">
                          <span className="scc-heatmap__bar-fg" style={{ width: `${s.passRate}%`, background: scoreColor(s.passRate), boxShadow: `0 0 8px ${scoreGlow(s.passRate)}` }} />
                        </span>
                        <span className="scc-heatmap__pct" style={{ color: scoreColor(s.passRate) }}>{s.passRate}%</span>
                      </div>
                      <div className="scc-heatmap__sevs">
                        {severities.map(sev => {
                          const count = findings.filter(f =>
                            normalizePillarName(f.pillar ?? '') === s.pillar &&
                            f.severity?.toUpperCase() === sev &&
                            f.status?.toUpperCase() === 'FAIL'
                          ).length
                          return (
                            <div
                              key={sev}
                              className={`scc-sev-chip ${count > 0 ? 'scc-sev-chip--active' : ''}`}
                              style={{ '--sev-color': severityColor(sev) } as React.CSSProperties}
                            >
                              <span className="scc-sev-chip__label">{sevLabel[sev]}</span>
                              <span className="scc-sev-chip__count">{count > 0 ? count : '—'}</span>
                            </div>
                          )
                        })}
                      </div>
                      <div className="scc-heatmap__total">{s.total}</div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </>
          )}
        </div>
      )}

      {/* ── Frameworks tab ──────────────────────────────────────────────────── */}
      {tab === 'frameworks' && (
        <div className="scc-framework-view">
          {/* Filter bar */}
          <div className="scc-filter-bar">
            <div className="scc-filter-bar__top">
              <div className="scc-search">
                <SearchIcon />
                <input
                  type="text"
                  placeholder={t('compliance.searchPlaceholder')}
                  value={fwSearch}
                  onChange={e => setFwSearch(e.target.value)}
                />
              </div>
              <select
                className="scc-select"
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
              >
                <option value="country">{t('compliance.sortCountry')}</option>
                <option value="name">{t('compliance.sortName')}</option>
                <option value="coverage_desc">{t('compliance.sortCoverageDesc')}</option>
                <option value="coverage_asc">{t('compliance.sortCoverageAsc')}</option>
              </select>
              <div className="scc-filter-actions">
                <button className="scc-btn-ghost" onClick={() => setSelectedCountries(new Set(allCountries.map(c => c.country)))}>{t('common.all')}</button>
                <button className="scc-btn-ghost" onClick={() => setSelectedCountries(new Set())}>{t('common.none')}</button>
              </div>
            </div>
            <div className="scc-country-chips">
              {allCountries.map(({ country, flag }) => {
                const active = selectedCountries.has(country)
                return (
                  <button
                    key={country}
                    className={`scc-country-chip ${active ? 'scc-country-chip--active' : ''}`}
                    onClick={() => {
                      const next = new Set(selectedCountries)
                      if (next.has(country)) next.delete(country); else next.add(country)
                      setSelectedCountries(next)
                    }}
                  >
                    <span className="scc-country-chip__flag">{flag}</span>
                    <span>{country}</span>
                    {active && <span className="scc-country-chip__check"><CheckIcon /></span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Framework grid */}
          {frameworkStats.sorted.length === 0 ? (
            <SectionCard title={t('compliance.frameworkTab')}>
              <EmptyState title={t('compliance.noMatch')} />
            </SectionCard>
          ) : (
            <div className="scc-framework-grid">
              {frameworkStats.sorted.map(({ fw, mappedControls, passCount, failCount, passRate }) => {
                const active = passRate !== null
                const color = active ? scoreColor(passRate) : 'var(--muted)'
                const mapped = mappedControls.length
                return (
                  <div
                    key={fw.id}
                    className={`scc-framework-card ${mapped > 0 ? 'scc-framework-card--clickable' : ''}`}
                    style={{ '--fw-color': color } as React.CSSProperties}
                    onClick={mapped > 0 ? () => { setDetailFrameworkId(fw.id); setTab('framework-detail') } : undefined}
                    role={mapped > 0 ? 'button' : undefined}
                    tabIndex={mapped > 0 ? 0 : undefined}
                    aria-label={mapped > 0 ? `${fw.label} details` : undefined}
                    onKeyDown={mapped > 0 ? e => { if (e.key === 'Enter' || e.key === ' ') { setDetailFrameworkId(fw.id); setTab('framework-detail') } } : undefined}
                  >
                    <div className="scc-framework-card__header">
                      <div className="scc-framework-card__flag">{fw.flag}</div>
                      <div className="scc-framework-card__meta">
                        <div className="scc-framework-card__title">{fw.label}</div>
                        <div className="scc-framework-card__desc">{fw.desc}</div>
                        <span className="scc-framework-card__country">{fw.country}</span>
                      </div>
                      {active ? (
                        <div className="scc-framework-card__ring">
                          <CircularScore value={passRate} size={72} stroke={6} color={color} />
                        </div>
                      ) : (
                        <div className="scc-framework-card__unmapped">
                          <LockIcon />
                          <span>{t('compliance.notMappedBadge')}</span>
                        </div>
                      )}
                    </div>

                    {active && (
                      <>
                        <div className="scc-framework-card__progress">
                          <div className="scc-framework-card__progress-bar">
                            <span style={{ width: `${passRate}%`, background: color, boxShadow: `0 0 10px ${scoreGlow(passRate)}` }} />
                          </div>
                          <div className="scc-framework-card__progress-labels">
                            <span className="scc-fw-stat scc-fw-stat--pass"><CheckIcon /> {passCount} {t('compliance.passLabel')}</span>
                            {failCount > 0 && <span className="scc-fw-stat scc-fw-stat--fail"><XIcon /> {failCount} {t('compliance.failLabel')}</span>}
                            <span className="scc-fw-stat scc-fw-stat--total">{mapped} {t('compliance.controlsMapped')}</span>
                          </div>
                        </div>

                        {mapped > 0 && (
                          <div className="scc-framework-card__controls">
                            {mappedControls.slice(0, 8).map(ctrl => {
                              const st = controlRunStatus(ctrl.id)
                              const sc = STATUS_COLOR[st]
                              const Icon = STATUS_ICON[st]
                              const mapping = ctrl.regulatory_mapping.find(m => m.framework === fw.id)
                              return (
                                <div key={ctrl.id} className="scc-control-chip" style={{ '--ctrl-color': sc } as React.CSSProperties}>
                                  <span className="scc-control-chip__id"><Icon /> {ctrl.id}</span>
                                  {mapping && (
                                    <span className="scc-control-chip__mapping">{mapping.controls.join(', ')}</span>
                                  )}
                                  <span className="scc-control-chip__status" style={{ color: sc }}>{st}</span>
                                </div>
                              )
                            })}
                            {mapped > 8 && (
                              <div className="scc-control-chip scc-control-chip--more">
                                +{mapped - 8} {t('common.more')}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {active && mapped > 0 && navigate && (
                      <button
                        className="scc-framework-card__gaps"
                        onClick={e => { e.stopPropagation(); navigate('gapanalysis', { framework: fw.id }) }}
                        aria-label={`${fw.label} gap analysis`}
                      >
                        {t('compliance.openGapAnalysis')} <ArrowRightIcon />
                      </button>
                    )}

                    {!active && mapped === 0 && (
                      <div className="scc-framework-card__hint">{t('compliance.noMappingDesc')}</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Framework detail tab (in-page drill-down) ─────────────────────────── */}
      {tab === 'framework-detail' && (
        <div className="scc-framework-view">
          <FrameworkDetailPage
            run={run}
            navigate={page => { if (page === 'compliance') setTab('frameworks') }}
            frameworkId={detailFrameworkId ?? undefined}
          />
        </div>
      )}
    </div>
  )
}

// ─── Scoped styles ───────────────────────────────────────────────────────────

const securityCommandCenterCss = `
.scc-root {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-bottom: 2rem;
  animation: sccFadeIn 0.5s ease forwards;
}
@keyframes sccFadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Hero */
.scc-hero__score {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 1rem;
  position: relative;
  z-index: 1;
}
.scc-hero__score-label {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.scc-hero__score-value {
  font-size: 2rem;
  font-weight: 800;
  line-height: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.scc-hero__score-unit {
  font-size: 0.7rem;
  color: var(--muted);
  font-weight: 700;
  letter-spacing: 0.08em;
}

/* Status bar */
.scc-statusbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: var(--bg);
  border: 1px solid color-mix(in srgb, var(--waf-brand) 16%, transparent);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  flex-wrap: wrap;
}
.scc-statusbar__line {
  flex: 1;
  height: 2px;
  background: color-mix(in srgb, var(--waf-brand) 25%, transparent);
  min-width: 60px;
}
.scc-statusbar__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.75rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.scc-statusbar__badge--armed {
  background: color-mix(in srgb, var(--pass) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--pass) 30%, transparent);
  color: var(--pass-ink);
}
.scc-statusbar__badge--warn {
  background: color-mix(in srgb, var(--score-mid) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--score-mid) 30%, transparent);
  color: var(--score-mid-ink);
}
.scc-statusbar__badge--alert {
  background: color-mix(in srgb, var(--fail) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--fail) 35%, transparent);
  color: var(--fail-ink);
}
.scc-statusbar__pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: sccBlink 1.2s infinite;
}
@keyframes sccBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
.scc-statusbar__readouts {
  display: flex;
  gap: 1.25rem;
}
.scc-statusbar__readout {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.1rem;
}
.scc-statusbar__label {
  font-size: 0.7rem;
  color: var(--muted);
  font-weight: 700;
  letter-spacing: 0.1em;
}
.scc-statusbar__value {
  font-size: 0.95rem;
  font-weight: 800;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* Pillar tab */
.scc-pillar-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.scc-pillar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}
.scc-pillar-card {
  background: var(--surface);
  border: 1px solid color-mix(in srgb, var(--pillar-color) 30%, var(--border));
  border-radius: 12px;
  padding: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: border-color 0.2s ease;
}
.scc-pillar-card:hover {
  border-color: var(--pillar-color);
}
.scc-pillar-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.scc-pillar-card__icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--bg);
  border: 1px solid color-mix(in srgb, var(--muted) 18%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
}
.scc-pillar-card__name {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text);
  text-transform: capitalize;
  letter-spacing: 0.02em;
}
.scc-pillar-card__counts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.scc-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.22rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.scc-pill--pass { background: color-mix(in srgb, var(--pass) 12%, transparent); color: var(--pass-ink); border: 1px solid color-mix(in srgb, var(--pass) 22%, transparent); }
.scc-pill--fail { background: color-mix(in srgb, var(--fail) 12%, transparent); color: var(--fail-ink); border: 1px solid color-mix(in srgb, var(--fail) 22%, transparent); }
.scc-pill--waived { background: color-mix(in srgb, var(--waived) 12%, transparent); color: var(--waived); border: 1px solid color-mix(in srgb, var(--waived) 22%, transparent); }
.scc-pill--total { background: var(--bg); color: var(--muted); border: 1px solid color-mix(in srgb, var(--muted) 12%, transparent); margin-left: auto; }
.scc-pillar-card__bar {
  height: 4px;
  background: var(--track);
  border-radius: 999px;
  overflow: hidden;
}
.scc-pillar-card__bar span {
  display: block;
  height: 100%;
  border-radius: 999px;
  transition: width 0.6s ease;
}

/* Heatmap */
.scc-heatmap {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}
.scc-heatmap__row {
  display: grid;
  grid-template-columns: 150px 1fr 2fr 56px;
  align-items: center;
  gap: 1rem;
  padding: 0.7rem 0.9rem;
  border-radius: 10px;
  background: var(--bg);
  border: 1px solid color-mix(in srgb, var(--waf-brand) 8%, transparent);
  transition: background 0.15s ease, border-color 0.15s ease;
}
.scc-heatmap__row:hover {
  background: color-mix(in srgb, var(--waf-brand) 5%, transparent);
  border-color: color-mix(in srgb, var(--waf-brand) 18%, transparent);
}
.scc-heatmap__pillar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text);
  text-transform: capitalize;
}
.scc-heatmap__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.scc-heatmap__passrate {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.75rem;
}
.scc-heatmap__bar-bg {
  flex: 1;
  height: 5px;
  background: var(--track);
  border-radius: 999px;
  overflow: hidden;
}
.scc-heatmap__bar-fg {
  height: 100%;
  border-radius: 999px;
  transition: width 0.5s ease;
}
.scc-heatmap__pct {
  font-weight: 800;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  min-width: 2.5rem;
  text-align: right;
}
.scc-heatmap__sevs {
  display: flex;
  gap: 0.35rem;
}
.scc-sev-chip {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.45rem;
  border-radius: 4px;
  background: var(--bg);
  border: 1px solid color-mix(in srgb, var(--muted) 12%, transparent);
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.scc-sev-chip--active {
  background: color-mix(in srgb, var(--sev-color) 14%, transparent);
  border-color: color-mix(in srgb, var(--sev-color) 45%, transparent);
  color: var(--sev-color);
}
.scc-sev-chip__label {
  opacity: 0.8;
}
.scc-heatmap__total {
  text-align: center;
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* Frameworks tab */
.scc-framework-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.scc-filter-bar {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 1rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
.scc-filter-bar__top {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}
.scc-search {
  flex: 1 1 220px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.8rem;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--waf-brand) 15%, transparent);
  background: var(--bg);
  color: var(--waf-brand-ink);
  min-width: 0;
}
.scc-search input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 0.85rem;
  outline: none;
  min-width: 0;
}
.scc-search input::placeholder {
  color: var(--muted);
}
.scc-filter-actions {
  display: flex;
  gap: 0.4rem;
}

.scc-framework-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}
.scc-framework-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  transition: border-color 0.2s ease;
}
.scc-framework-card:hover {
  border-color: var(--fw-color);
}
.scc-framework-card--clickable {
  cursor: pointer;
  outline: none;
}
.scc-framework-card--clickable:focus-visible {
  outline: 2px solid var(--waf-brand);
  outline-offset: 2px;
  border-color: var(--waf-brand);
}
.scc-framework-card__header {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
}
.scc-framework-card__flag {
  font-size: 1.5rem;
  line-height: 1;
  flex-shrink: 0;
}
.scc-framework-card__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.scc-framework-card__title {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text);
}
.scc-framework-card__desc {
  font-size: 0.7rem;
  color: var(--muted);
}
.scc-framework-card__country {
  display: inline-flex;
  align-self: flex-start;
  padding: 0.12rem 0.45rem;
  border-radius: 4px;
  background: var(--bg);
  border: 1px solid color-mix(in srgb, var(--muted) 12%, transparent);
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-top: 0.25rem;
}
.scc-framework-card__ring {
  flex-shrink: 0;
}
.scc-framework-card__unmapped {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 700;
}
.scc-framework-card__progress {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.scc-framework-card__progress-bar {
  height: 5px;
  background: var(--track);
  border-radius: 999px;
  overflow: hidden;
}
.scc-framework-card__progress-bar span {
  display: block;
  height: 100%;
  border-radius: 999px;
  transition: width 0.5s ease;
}
.scc-framework-card__progress-labels {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  font-size: 0.7rem;
}
.scc-fw-stat {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.scc-fw-stat--pass { color: var(--pass-ink); }
.scc-fw-stat--fail { color: var(--fail-ink); }
.scc-fw-stat--total { color: var(--muted); margin-left: auto; }
.scc-framework-card__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.scc-control-chip {
  display: flex;
  flex-direction: column;
  gap: 0.08rem;
  padding: 0.35rem 0.55rem;
  border-radius: 6px;
  background: var(--bg);
  border: 1px solid color-mix(in srgb, var(--ctrl-color) 30%, transparent);
  font-size: 0.7rem;
  min-width: 0;
}
.scc-control-chip__id {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-weight: 700;
  color: var(--text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.scc-control-chip__mapping {
  font-size: 0.7rem;
  color: var(--muted);
}
.scc-control-chip__status {
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.scc-control-chip--more {
  align-self: center;
  background: var(--bg);
  border-color: color-mix(in srgb, var(--muted) 12%, transparent);
  color: var(--muted);
  font-weight: 700;
}
.scc-framework-card__hint {
  font-size: 0.72rem;
  color: var(--muted);
  font-style: italic;
  padding: 0.5rem;
  background: var(--bg);
  border-radius: 8px;
}

@media (max-width: 900px) {
  .scc-heatmap__row {
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .scc-heatmap__sevs { grid-column: 1 / -1; }
  .scc-heatmap__total { display: none; }
}

@media (max-width: 640px) {
  .scc-hero__score { align-self: center; }
  .scc-statusbar { flex-direction: column; align-items: flex-start; }
  .scc-statusbar__readouts { width: 100%; justify-content: space-between; }
  .scc-pillar-grid { grid-template-columns: 1fr; }
  .scc-framework-grid { grid-template-columns: 1fr; }
  .scc-filter-bar__top > * { flex: 1 1 100%; }
}
`
