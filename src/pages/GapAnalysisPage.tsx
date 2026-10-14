/**
 * Regulatory Gap Analysis
 *
 * Same SOC visual base as the Security Operations Center / Compliance page,
 * but focused on detailed compliance gap remediation and requirement coverage.
 */
import { useEffect, useMemo, useState } from 'react'
import { ControlMeta, Finding, RunDetail } from '../api'
import { FRAMEWORKS } from '../controls-data'
import { useControlsCatalogue } from '../useControlsCatalogue'
import { useI18n } from '../i18n'
import type { Page } from '../routing'
import {
  CircularScore, SectionCard, SegmentedTabs, KpiTile, SocStyles,
  CheckIcon, DownloadIcon, ArrowRightIcon, TargetIcon, MapIcon,
  statusColor,
} from './shared/SocComponents'

// Group FRAMEWORKS by country, preserving declaration order
const FRAMEWORK_GROUPS: { country: string; flag: string; frameworks: typeof FRAMEWORKS }[] = []
const _seenCountries = new Map<string, typeof FRAMEWORK_GROUPS[0]>()
for (const f of FRAMEWORKS) {
  if (!_seenCountries.has(f.country)) {
    const g = { country: f.country, flag: f.flag, frameworks: [] }
    _seenCountries.set(f.country, g)
    FRAMEWORK_GROUPS.push(g)
  }
  _seenCountries.get(f.country)!.frameworks.push(f)
}

interface Props { run: RunDetail; navigate?: (page: Page) => void; frameworkId?: string }

// ─── Types ────────────────────────────────────────────────────────────────────

type ControlStatus = 'PASS' | 'FAIL' | 'PARTIAL' | 'WAIVED' | 'UNKNOWN'

interface GapItem {
  ctrl: ControlMeta
  status: ControlStatus
  requirements: string[]        // requirement IDs in the selected framework
  failFindings: Finding[]
  failResources: string[]       // unique resources with FAIL
  failChecks: string[]          // unique check_ids with FAIL
  passChecks: string[]          // unique check_ids with PASS
  effort: number                // failResources.length — how many resource remediations needed
  value: number                 // requirements.length — how many req IDs get unlocked
  costPerReq: number            // effort / value — lower = better ROI
  hasWaiver: boolean
  waiverOwner?: string
  hasRisk: boolean
  riskApprover?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
const SEV_COLOR: Record<string, string> = {
  critical: '#dc2626', high: '#d97706', medium: '#2563eb', low: '#059669', info: '#94a3b8',
}

const STATUS_META: Record<ControlStatus, { label: string; color: string; bg: string }> = {
  PASS:    { label: 'Passing',  color: '#059669', bg: 'rgba(5,150,105,.08)'   },
  FAIL:    { label: 'Failing',  color: '#dc2626', bg: 'rgba(220,38,38,.08)'   },
  PARTIAL: { label: 'Partial',  color: '#d97706', bg: 'rgba(217,119,6,.08)'   },
  WAIVED:  { label: 'Waived',   color: '#7c3aed', bg: 'rgba(124,58,237,.08)'  },
  UNKNOWN: { label: 'No data',  color: '#94a3b8', bg: 'rgba(148,163,184,.08)' },
}

function loadWaivers(): Record<string, { owner?: string }> {
  try { return JSON.parse(localStorage.getItem('wafpass_waivers') ?? '{}') } catch { return {} }
}
function loadRisks(): Record<string, { approver?: string }> {
  try { return JSON.parse(localStorage.getItem('wafpass_risk_acceptances') ?? '{}') } catch { return {} }
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  Object.assign(document.createElement('a'), { href: url, download: filename }).click()
  URL.revokeObjectURL(url)
}

// ─── Build gap items for a given framework ────────────────────────────────────

function buildGapItems(
  framework: string,
  controls: ControlMeta[],
  findings: Finding[],
): GapItem[] {
  const waivers = loadWaivers()
  const risks   = loadRisks()

  return controls
    .map(ctrl => {
      // Framework requirements this control covers
      const mapping = ctrl.regulatory_mapping?.find(m => m.framework === framework)
      if (!mapping || !mapping.controls.length) return null

      const requirements = mapping.controls

      // Findings for this control
      const ctrlFindings = findings.filter(f => f.control_id === ctrl.id)
      const failFindings = ctrlFindings.filter(f => f.status?.toUpperCase() === 'FAIL')
      const passFindings = ctrlFindings.filter(f => f.status?.toUpperCase() === 'PASS')
      const waivedFindings = ctrlFindings.filter(f => f.status?.toUpperCase() === 'WAIVED')

      const failResources = [...new Set(failFindings.map(f => f.resource).filter(Boolean))]
      const failChecks    = [...new Set(failFindings.map(f => f.check_id).filter(Boolean))]
      const passChecks    = [...new Set(passFindings.map(f => f.check_id).filter(Boolean))]

      let status: ControlStatus
      if (!ctrlFindings.length) {
        status = 'UNKNOWN'
      } else if (failFindings.length === 0 && waivedFindings.length > 0) {
        status = 'WAIVED'
      } else if (failFindings.length === 0) {
        status = 'PASS'
      } else if (passFindings.length > 0 || waivedFindings.length > 0) {
        status = 'PARTIAL'
      } else {
        status = 'FAIL'
      }

      const effort   = Math.max(failResources.length, failFindings.length > 0 ? 1 : 0)
      const value    = requirements.length
      const costPerReq = effort / Math.max(value, 1)

      const waiver = waivers[ctrl.id]
      const risk   = risks[ctrl.id]

      const item: GapItem = {
        ctrl, status, requirements,
        failFindings, failResources, failChecks, passChecks,
        effort, value, costPerReq,
        hasWaiver: !!waiver, waiverOwner: waiver?.owner,
        hasRisk: !!risk, riskApprover: risk?.approver,
      }
      return item
    })
    .filter((x): x is GapItem => x !== null)
}

// ─── Framework logo (uses generated badge from controls-data) ───────────────────

function FrameworkLogo({ src, alt }: { src?: string; alt: string }) {
  if (!src) return null
  return (
    <img
      src={src}
      alt={alt}
      className="gap-hero__logo"
      onError={e => { e.currentTarget.style.display = 'none' }}
    />
  )
}

// ─── Roadmap item ─────────────────────────────────────────────────────────────

function RoadmapItem({ item, rank, cumulativeReqs, totalReqs }: {
  item: GapItem; rank: number; cumulativeReqs: number; totalReqs: number
}) {
  const [open, setOpen] = useState(false)
  const { t } = useI18n()
  const { ctrl, status } = item
  const sm = STATUS_META[status]
  const sevColor = SEV_COLOR[ctrl.severity?.toLowerCase()] ?? '#94a3b8'
  const isActionable = status === 'FAIL' || status === 'PARTIAL'

  const topFinding = item.failFindings.sort((a, b) =>
    (SEV_ORDER[a.severity?.toLowerCase()] ?? 9) - (SEV_ORDER[b.severity?.toLowerCase()] ?? 9)
  )[0]

  return (
    <div className={`gap-item ${isActionable ? 'gap-item--actionable' : ''}`} style={{ '--item-color': sm.color } as React.CSSProperties}>
      <div className="gap-item__header" onClick={() => setOpen(o => !o)}>
        {isActionable ? (
          <div className="gap-item__rank" style={{ background: sm.color }}>{rank}</div>
        ) : (
          <div className="gap-item__rank gap-item__rank--muted" style={{ borderColor: sm.color, color: sm.color }}>
            {status === 'PASS' ? '✓' : status === 'WAIVED' ? '~' : '?'}
          </div>
        )}

        <div className="gap-item__main">
          <div className="gap-item__title-row">
            <span className="gap-item__id">{ctrl.id}</span>
            <span className="gap-item__title">{ctrl.title}</span>
          </div>
          <div className="gap-item__badges">
            <span className="gap-item__badge gap-item__badge--status" style={{ color: sm.color, background: sm.bg, borderColor: `${sm.color}33` }}>{sm.label}</span>
            <span className="gap-item__badge gap-item__badge--severity" style={{ color: sevColor, background: `${sevColor}18`, borderColor: `${sevColor}33` }}>{ctrl.severity}</span>
            <span className="gap-item__badge gap-item__badge--pillar">{ctrl.pillar}</span>
            {item.requirements.map(req => (
              <span key={req} className="gap-item__badge gap-item__badge--req" style={{ color: isActionable ? sm.color : '#059669', background: isActionable ? `${sm.color}10` : 'rgba(5,150,105,.08)', borderColor: isActionable ? `${sm.color}22` : 'rgba(5,150,105,.15)' }}>{req}</span>
            ))}
            {item.hasWaiver && <span className="gap-item__badge gap-item__badge--waiver">{t('pages.gapanalysis.waivedLabel', { owner: item.waiverOwner ?? '' })}</span>}
            {item.hasRisk && <span className="gap-item__badge gap-item__badge--risk">{t('pages.gapanalysis.riskAcceptedLabel', { approver: item.riskApprover ?? '' })}</span>}
          </div>
        </div>

        <div className="gap-item__metrics">
          {isActionable && (
            <>
              <div className="gap-item__effort" style={{ color: sm.color }}>{t('pages.gapanalysis.resourcesToFix', { count: item.effort })}</div>
              <div className="gap-item__value">{t('pages.gapanalysis.unlocksReqs', { count: item.value })}</div>
              <div className="gap-item__after">{t('pages.gapanalysis.afterFix', { cumulative: cumulativeReqs, total: totalReqs })}</div>
            </>
          )}
          <div className="gap-item__chevron">{open ? '▲' : '▼'}</div>
        </div>
      </div>

      {open && (
        <div className="gap-item__body">
          <div className="gap-item__desc">{ctrl.description}</div>

          {topFinding && (
            <div className="gap-item__failing">
              <div className="gap-item__failing-title">{t('pages.gapanalysis.failingCheck')} {topFinding.check_title || topFinding.check_id}</div>
              <div className="gap-item__failing-msg">{topFinding.message}</div>
              {topFinding.remediation && (
                <div className="gap-item__failing-fix">
                  <strong>{t('pages.gapanalysis.fixLabel')} </strong>{topFinding.remediation}
                </div>
              )}
            </div>
          )}

          {(item.failChecks.length > 0 || item.passChecks.length > 0) && (
            <div className="gap-item__checks">
              {item.failChecks.length > 0 && (
                <div>
                  <div className="gap-item__checks-title gap-item__checks-title--fail">{t('pages.gapanalysis.failingChecks', { count: item.failChecks.length })}</div>
                  {item.failChecks.slice(0, 5).map(c => <div key={c} className="gap-item__check">✗ {c}</div>)}
                  {item.failChecks.length > 5 && <div className="gap-item__check gap-item__check--more">{t('pages.gapanalysis.moreItems', { count: item.failChecks.length - 5 })}</div>}
                </div>
              )}
              {item.passChecks.length > 0 && (
                <div>
                  <div className="gap-item__checks-title gap-item__checks-title--pass">{t('pages.gapanalysis.passingChecks', { count: item.passChecks.length })}</div>
                  {item.passChecks.slice(0, 3).map(c => <div key={c} className="gap-item__check">✓ {c}</div>)}
                </div>
              )}
            </div>
          )}

          {item.failResources.length > 0 && (
            <div className="gap-item__resources">
              <div className="gap-item__resources-title">{t('pages.gapanalysis.affectedResources', { count: item.failResources.length })}</div>
              <div className="gap-item__resources-list">
                {item.failResources.slice(0, 6).map(r => <span key={r} className="gap-item__resource">{r}</span>)}
                {item.failResources.length > 6 && <span className="gap-item__resource gap-item__resource--more">{t('pages.gapanalysis.moreItems', { count: item.failResources.length - 6 })}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Requirements map ─────────────────────────────────────────────────────────

function RequirementsMap({ items, framework }: { items: GapItem[]; framework: string }) {
  const { t } = useI18n()
  const reqMap = new Map<string, { items: GapItem[]; met: boolean }>()

  for (const item of items) {
    for (const req of item.requirements) {
      if (!reqMap.has(req)) reqMap.set(req, { items: [], met: false })
      const entry = reqMap.get(req)!
      entry.items.push(item)
      if (item.status === 'PASS' || item.status === 'WAIVED') entry.met = true
    }
  }

  const reqs = [...reqMap.entries()].sort((a, b) => {
    if (a[1].met !== b[1].met) return a[1].met ? 1 : -1
    return a[0].localeCompare(b[0])
  })

  const metCount = reqs.filter(([, v]) => v.met).length

  return (
    <div>
      <div className="gap-reqs__summary">
        {t('pages.gapanalysis.reqsMapped', { total: reqs.length, framework })} · <strong style={{ color: '#059669' }}>{t('pages.gapanalysis.reqsMet', { count: metCount })}</strong> · <strong style={{ color: '#dc2626' }}>{t('pages.gapanalysis.reqsGaps', { count: reqs.length - metCount })}</strong>
      </div>
      <div className="gap-reqs__grid">
        {reqs.map(([req, { items: ri, met }]) => (
          <div key={req} className={`gap-req ${met ? 'gap-req--met' : 'gap-req--gap'}`}>
            <div className="gap-req__header">
              <span className="gap-req__state">{met ? '✓' : '✗'}</span>
              <span className="gap-req__id">{req}</span>
            </div>
            <div className="gap-req__controls">
              {ri.map(item => {
                const sm = STATUS_META[item.status]
                return (
                  <span key={item.ctrl.id} className="gap-req__control" style={{ color: sm.color, background: `${sm.color}15`, borderColor: `${sm.color}33` }}>
                    {item.ctrl.id}
                  </span>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function gapToCSV(items: GapItem[], framework: string): string {
  const header = 'framework,requirement_id,control_id,control_title,status,severity,pillar,effort_resources,value_requirements,cost_per_req,has_waiver,has_risk'
  const rows: string[] = []
  for (const item of items) {
    for (const req of item.requirements) {
      rows.push([
        framework, req, item.ctrl.id,
        `"${item.ctrl.title.replace(/"/g, '""')}"`,
        item.status, item.ctrl.severity, item.ctrl.pillar,
        item.effort, item.value, item.costPerReq.toFixed(2),
        item.hasWaiver ? 'yes' : 'no',
        item.hasRisk   ? 'yes' : 'no',
      ].join(','))
    }
  }
  return [header, ...rows].join('\n')
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GapAnalysisPage({ run, navigate, frameworkId }: Props) {
  const { t } = useI18n()
  const DEFAULT_FRAMEWORK = 'ISO 27001:2022'
  const initialFramework = FRAMEWORKS.find(f => f.id === frameworkId)?.id ?? DEFAULT_FRAMEWORK
  const [framework, setFramework] = useState(initialFramework)
  const [selectedCountry, setSelectedCountry] = useState(
    () => FRAMEWORKS.find(f => f.id === initialFramework)?.country ?? FRAMEWORK_GROUPS[0].country
  )
  const [tab, setTab]             = useState<'roadmap' | 'requirements'>('roadmap')
  const [sortMode, setSortMode]   = useState<'efficiency' | 'severity' | 'value'>('efficiency')
  const [showPassing, setShowPassing] = useState(false)

  // If the caller deep-links a framework, sync to it on mount / prop change
  useEffect(() => {
    if (!frameworkId) return
    const match = FRAMEWORKS.find(f => f.id === frameworkId)
    if (match) {
      setFramework(match.id)
      setSelectedCountry(match.country)
    }
  }, [frameworkId])

  const catalogue = useControlsCatalogue()

  // Prefer run.controls_meta (live), fall back to server catalogue / static
  const controls: ControlMeta[] = useMemo(() =>
    run.controls_meta.length > 0 ? run.controls_meta : catalogue as unknown as ControlMeta[],
    [run.controls_meta, catalogue]
  )

  const allItems = useMemo(
    () => buildGapItems(framework, controls, run.findings),
    [framework, controls, run.findings]
  )

  // Coverage stats
  const stats = useMemo(() => {
    const totalReqs = new Set(allItems.flatMap(i => i.requirements)).size
    const metReqs   = new Set(allItems.filter(i => i.status === 'PASS' || i.status === 'WAIVED').flatMap(i => i.requirements)).size
    const gapItems  = allItems.filter(i => i.status === 'FAIL' || i.status === 'PARTIAL')
    const passItems = allItems.filter(i => i.status === 'PASS')
    const waivedItems = allItems.filter(i => i.status === 'WAIVED')
    const unknownItems = allItems.filter(i => i.status === 'UNKNOWN')
    const coveragePct  = totalReqs > 0 ? Math.round((metReqs / totalReqs) * 100) : 0
    const potentialReqs = new Set([
      ...allItems.filter(i => i.status === 'PASS' || i.status === 'WAIVED').flatMap(i => i.requirements),
      ...gapItems.flatMap(i => i.requirements),
    ]).size
    const potentialPct = totalReqs > 0 ? Math.round((potentialReqs / totalReqs) * 100) : 0
    const totalResourcesToFix = gapItems.reduce((sum, i) => sum + i.effort, 0)
    const criticalFailCount = run.findings.filter(f =>
      f.status?.toUpperCase() === 'FAIL' && f.severity?.toLowerCase() === 'critical' &&
      gapItems.some(g => g.ctrl.id === f.control_id)
    ).length
    const highFailCount = run.findings.filter(f =>
      f.status?.toUpperCase() === 'FAIL' && f.severity?.toLowerCase() === 'high' &&
      gapItems.some(g => g.ctrl.id === f.control_id)
    ).length
    return { totalReqs, metReqs, coveragePct, potentialPct, gapItems, passItems, waivedItems, unknownItems, totalResourcesToFix, criticalFailCount, highFailCount }
  }, [allItems, run.findings])

  // Roadmap: failing + partial items sorted by chosen mode
  const roadmapItems = useMemo(() => {
    const actionable = stats.gapItems.slice()
    if (sortMode === 'efficiency') {
      actionable.sort((a, b) => a.costPerReq - b.costPerReq || (SEV_ORDER[a.ctrl.severity?.toLowerCase()] ?? 9) - (SEV_ORDER[b.ctrl.severity?.toLowerCase()] ?? 9))
    } else if (sortMode === 'severity') {
      actionable.sort((a, b) => (SEV_ORDER[a.ctrl.severity?.toLowerCase()] ?? 9) - (SEV_ORDER[b.ctrl.severity?.toLowerCase()] ?? 9) || a.effort - b.effort)
    } else {
      actionable.sort((a, b) => b.value - a.value || a.effort - b.effort)
    }
    return actionable
  }, [stats.gapItems, sortMode])

  // Running cumulative requirement count (for "N/total after fix" display)
  const cumulativeReqs = useMemo(() => {
    const alreadyMet = new Set(
      allItems.filter(i => i.status === 'PASS' || i.status === 'WAIVED').flatMap(i => i.requirements)
    )
    const running: number[] = []
    const seen = new Set(alreadyMet)
    for (const item of roadmapItems) {
      for (const r of item.requirements) seen.add(r)
      running.push(seen.size)
    }
    return running
  }, [roadmapItems, allItems])

  const fw = FRAMEWORKS.find(f => f.id === framework)
  const coverageColor = stats.coveragePct >= 80 ? statusColor('good') : stats.coveragePct >= 60 ? statusColor('warn') : statusColor('bad')
  const potentialColor = statusColor('info')

  return (
    <div className="gap-root">
      <SocStyles />
      <style>{gapAnalysisCss}</style>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="gap-hero">
        <div className="gap-hero__main">
          <div className="gap-hero__badge"><TargetIcon /> GAP ANALYSIS</div>
          <h1 className="gap-hero__title">{t('pages.gapanalysis.heroTitle')}</h1>
          <p className="gap-hero__subtitle">{t('pages.gapanalysis.heroSubtitle')}</p>
        </div>
        {navigate && (
          <button className="gap-hero__back" onClick={() => navigate('compliance')}>
            <ArrowRightIcon style={{ transform: 'rotate(180deg)' }} /> {t('pages.gapanalysis.backToSoc')}
          </button>
        )}
      </div>

      {/* ── Framework selector ───────────────────────────────────────────── */}
      <SectionCard title={t('pages.gapanalysis.frameworkSelectorTitle')} subtitle={t('pages.gapanalysis.frameworkSelectorSubtitle')}>
        <div className="gap-selector">
          <div className="gap-selector__section">
            <div className="gap-selector__label">1 · {t('pages.gapanalysis.jurisdictionLabel')}</div>
            <div className="gap-selector__chips">
              {FRAMEWORK_GROUPS.map(group => {
                const active = selectedCountry === group.country
                return (
                  <button
                    key={group.country}
                    className={`scc-country-chip ${active ? 'scc-country-chip--active' : ''}`}
                    onClick={() => {
                      setSelectedCountry(group.country)
                      setFramework(group.frameworks[0].id)
                    }}
                  >
                    <span className="scc-country-chip__flag">{group.flag}</span>
                    <span>{group.country}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="gap-selector__divider" />
          <div className="gap-selector__section">
            <div className="gap-selector__label">2 · {t('pages.gapanalysis.regulationLabel')}</div>
            <div className="gap-selector__chips">
              {(FRAMEWORK_GROUPS.find(g => g.country === selectedCountry)?.frameworks ?? []).map(f => {
                const active = framework === f.id
                return (
                  <button
                    key={f.id}
                    className={`scc-country-chip ${active ? 'scc-country-chip--active' : ''}`}
                    onClick={() => setFramework(f.id)}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Coverage summary ─────────────────────────────────────────────── */}
      <div className="gap-summary" style={{ '--fw-color': coverageColor } as React.CSSProperties}>
        <div className="gap-summary__card">
          <FrameworkLogo src={fw?.logo} alt={fw?.label ?? framework} />
          <div className="gap-summary__meta">
            <div className="gap-summary__flag">{fw?.flag}</div>
            <div>
              <div className="gap-summary__name">{fw?.label}</div>
              <div className="gap-summary__desc">{fw?.desc}</div>
              <span className="gap-summary__country">{fw?.country}</span>
            </div>
          </div>
        </div>
        <div className="gap-summary__score">
          <CircularScore value={stats.coveragePct} size={150} stroke={10} color={coverageColor} />
          <div className="gap-summary__score-label">
            <span className="gap-summary__score-value" style={{ color: coverageColor }}>{stats.coveragePct}%</span>
            <span className="gap-summary__score-unit">{t('pages.gapanalysis.currentCoverage')}</span>
          </div>
        </div>
        <div className="gap-summary__score gap-summary__score--potential">
          <CircularScore value={stats.potentialPct} size={120} stroke={9} color={potentialColor} />
          <div className="gap-summary__score-label">
            <span className="gap-summary__score-value" style={{ color: potentialColor }}>{stats.potentialPct}%</span>
            <span className="gap-summary__score-unit">{t('pages.gapanalysis.afterGapsFixed')}</span>
          </div>
        </div>
        <button
          className="gap-summary__export"
          onClick={() => downloadCSV(gapToCSV(allItems, framework), `gap-analysis-${framework.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().slice(0,10)}.csv`)}
        >
          <DownloadIcon /> {t('pages.gapanalysis.exportCsv')}
        </button>
      </div>

      {/* ── KPI tiles ────────────────────────────────────────────────────── */}
      <div className="scc-kpi-grid">
        <KpiTile label={t('pages.gapanalysis.requirementsMet')} value={`${stats.metReqs}/${stats.totalReqs}`} color={coverageColor} />
        <KpiTile label={t('pages.gapanalysis.gapsCount', { count: stats.totalReqs - stats.metReqs })} value={stats.totalReqs - stats.metReqs} color={statusColor('bad')} />
        <KpiTile label={t('pages.gapanalysis.controlsToFix')} value={stats.gapItems.length} color={statusColor('bad')} />
        <KpiTile label={t('pages.gapanalysis.passing')} value={stats.passItems.length} color={statusColor('good')} />
        <KpiTile label={t('pages.gapanalysis.waived')} value={stats.waivedItems.length} color={statusColor('info')} />
        <KpiTile label={t('pages.gapanalysis.noData')} value={stats.unknownItems.length} color={statusColor('muted')} />
        <KpiTile label={t('pages.gapanalysis.resourcesToFixTotal')} value={stats.totalResourcesToFix} color={statusColor('warn')} />
        <KpiTile label={t('pages.gapanalysis.criticalFindings')} value={stats.criticalFailCount} color={statusColor('bad')} />
        <KpiTile label={t('pages.gapanalysis.highFindings')} value={stats.highFailCount} color={statusColor('warn')} />
      </div>

      {allItems.length === 0 ? (
        <SectionCard title={t('pages.gapanalysis.noControlsMapped', { framework })}>
          <div className="gap-empty">
            <div className="gap-empty__icon">🗺</div>
            <div>{t('pages.gapanalysis.noControlsMappedDesc', { framework })}</div>
          </div>
        </SectionCard>
      ) : (
        <>
          {/* ── Tabs ─────────────────────────────────────────────────────── */}
          <SegmentedTabs
            options={[
              { key: 'roadmap', label: t('pages.gapanalysis.tabRoadmap'), icon: TargetIcon },
              { key: 'requirements', label: t('pages.gapanalysis.tabRequirements'), icon: MapIcon },
            ]}
            value={tab}
            onChange={setTab}
          />

          {/* ── Roadmap tab ──────────────────────────────────────────────── */}
          {tab === 'roadmap' && (
            <SectionCard title={t('pages.gapanalysis.tabRoadmap')} subtitle={t('pages.gapanalysis.shortestPathDetail')}>
              <div className="gap-toolbar">
                <div className="gap-sort">
                  <span className="gap-toolbar__label">{t('pages.gapanalysis.sortByLabel')}</span>
                  {([
                    ['efficiency', t('pages.gapanalysis.sortEfficiency')],
                    ['severity',   t('pages.gapanalysis.sortSeverity')],
                    ['value',      t('pages.gapanalysis.sortValue')],
                  ] as ['efficiency' | 'severity' | 'value', string][]).map(([key, label]) => (
                    <button
                      key={key}
                      className={`gap-sort__btn ${sortMode === key ? 'gap-sort__btn--active' : ''}`}
                      onClick={() => setSortMode(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="gap-passing-toggle">
                  <input type="checkbox" checked={showPassing} onChange={e => setShowPassing(e.target.checked)} />
                  {t('pages.gapanalysis.showPassingControls')}
                </label>
              </div>

              {roadmapItems.length === 0 ? (
                <div className="gap-all-passing">
                  <CheckIcon /> {t('pages.gapanalysis.allPassingGap', { framework: fw?.label ?? framework })}
                </div>
              ) : (
                <>
                  {roadmapItems.length > 0 && (
                    <div className="gap-intro">
                      {t('pages.gapanalysis.shortestPathIntro', { framework: fw?.label ?? framework, count: roadmapItems.length })}
                    </div>
                  )}
                  {roadmapItems.map((item, i) => (
                    <RoadmapItem
                      key={item.ctrl.id} item={item} rank={i + 1}
                      cumulativeReqs={cumulativeReqs[i] ?? stats.metReqs}
                      totalReqs={stats.totalReqs}
                    />
                  ))}
                </>
              )}

              {showPassing && stats.passItems.length > 0 && (
                <div className="gap-passing">
                  <div className="gap-passing__title">{t('pages.gapanalysis.passingControlsHeader', { count: stats.passItems.length })}</div>
                  {[...stats.passItems, ...stats.waivedItems, ...stats.unknownItems].map(item => (
                    <RoadmapItem key={item.ctrl.id} item={item} rank={0} cumulativeReqs={stats.metReqs} totalReqs={stats.totalReqs} />
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {/* ── Requirements map tab ─────────────────────────────────────── */}
          {tab === 'requirements' && (
            <SectionCard title={t('pages.gapanalysis.tabRequirements')} subtitle={t('pages.gapanalysis.requirementsMapSubtitle')}>
              <RequirementsMap items={allItems} framework={framework} />
            </SectionCard>
          )}
        </>
      )}
    </div>
  )
}

const gapAnalysisCss = `
.gap-root {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-bottom: 2rem;
  animation: gapFadeIn 0.4s ease forwards;
}
@keyframes gapFadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.gap-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  background:
    radial-gradient(circle at 20% 50%, color-mix(in srgb, var(--waf-brand) 10%, transparent) 0%, transparent 40%),
    radial-gradient(circle at 80% 20%, color-mix(in srgb, var(--waf-brand) 6%, transparent) 0%, transparent 35%),
    linear-gradient(135deg, var(--surface) 0%, var(--bg) 100%);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 1.5rem 1.75rem;
  position: relative;
  flex-wrap: wrap;
}
.gap-hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.7rem;
  border-radius: 6px;
  background: color-mix(in srgb, var(--waf-brand) 12%, transparent);
  color: var(--waf-brand);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  width: fit-content;
  margin-bottom: 0.75rem;
}
.gap-hero__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--text);
  line-height: 1.2;
}
.gap-hero__subtitle {
  margin: 0.45rem 0 0;
  font-size: 0.85rem;
  color: var(--muted);
  max-width: 520px;
}
.gap-hero__back {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: color-mix(in srgb, var(--waf-brand) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--waf-brand) 25%, transparent);
  color: var(--waf-brand);
  border-radius: 6px;
  padding: 0.45rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease;
}
.gap-hero__back:hover {
  background: color-mix(in srgb, var(--waf-brand) 18%, transparent);
}

.gap-selector {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.gap-selector__section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.gap-selector__label {
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.gap-selector__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.gap-selector__divider {
  height: 1px;
  background: var(--border);
}

.gap-summary {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: 1.5rem;
  align-items: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 1rem 1.25rem;
  flex-wrap: wrap;
  box-shadow: var(--shadow-sm);
}
.gap-summary__card {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;
}
.gap-hero__logo {
  width: 60px;
  height: 60px;
  border-radius: 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 6px;
  object-fit: contain;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}
.gap-summary__flag {
  font-size: 2rem;
  line-height: 1;
}
.gap-summary__name {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text);
}
.gap-summary__desc {
  font-size: 0.78rem;
  color: var(--muted);
  margin-top: 0.25rem;
  max-width: 420px;
}
.gap-summary__country {
  display: inline-block;
  margin-top: 0.4rem;
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fw-color);
  background: color-mix(in srgb, var(--fw-color) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--fw-color) 25%, transparent);
  border-radius: 4px;
  padding: 0.15rem 0.4rem;
}
.gap-summary__score {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}
.gap-summary__score-label {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.gap-summary__score-value {
  font-size: 1.35rem;
  font-weight: 800;
  line-height: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.gap-summary__score-unit {
  font-size: 0.6rem;
  color: var(--muted);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.gap-summary__export {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.9rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--pass);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}
.gap-summary__export:hover {
  background: color-mix(in srgb, var(--pass) 10%, transparent);
  border-color: color-mix(in srgb, var(--pass) 30%, transparent);
}

.gap-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.gap-toolbar__label {
  font-size: 0.72rem;
  color: var(--muted);
  font-weight: 700;
}
.gap-sort {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.gap-sort__btn {
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  transition: all 0.15s ease;
}
.gap-sort__btn:hover {
  color: var(--text);
  background: color-mix(in srgb, var(--waf-brand) 6%, transparent);
}
.gap-sort__btn--active {
  border-color: var(--waf-brand);
  background: color-mix(in srgb, var(--waf-brand) 10%, transparent);
  color: var(--waf-brand);
}
.gap-passing-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: var(--muted);
  cursor: pointer;
}

.gap-intro {
  padding: 0.75rem 1rem;
  margin-bottom: 0.75rem;
  border-radius: 8px;
  background: color-mix(in srgb, var(--waf-brand) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--waf-brand) 15%, transparent);
  font-size: 0.78rem;
  color: var(--text);
  line-height: 1.5;
}
.gap-all-passing {
  text-align: center;
  padding: 2rem;
  border: 1px dashed rgba(5,150,105,.3);
  border-radius: 10px;
  color: var(--pass);
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.gap-item {
  border: 1px solid var(--border);
  border-radius: 12px;
  margin-bottom: 0.75rem;
  overflow: hidden;
  background: var(--surface);
  transition: background 0.2s ease;
}
.gap-item--actionable {
  border-left: 3px solid var(--item-color);
}
.gap-item__header {
  padding: 0.9rem 1rem;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  cursor: pointer;
}
.gap-item__rank {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}
.gap-item__rank--muted {
  background: transparent;
  border: 1px solid;
  font-size: 0.85rem;
}
.gap-item__main {
  flex: 1;
  min-width: 0;
}
.gap-item__title-row {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.gap-item__id {
  font-size: 0.72rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 700;
  color: var(--waf-brand);
}
.gap-item__title {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text);
}
.gap-item__badges {
  display: flex;
  gap: 0.35rem;
  margin-top: 0.4rem;
  flex-wrap: wrap;
  align-items: center;
}
.gap-item__badge {
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-radius: 4px;
  padding: 0.15rem 0.4rem;
  border: 1px solid;
}
.gap-item__badge--pillar {
  color: var(--muted);
  background: var(--bg);
  border-color: var(--border);
}
.gap-item__badge--waiver {
  color: #7c3aed;
  background: rgba(124,58,237,.08);
  border-color: rgba(124,58,237,.2);
}
.gap-item__badge--risk {
  color: #d97706;
  background: rgba(217,119,6,.08);
  border-color: rgba(217,119,6,.2);
}
.gap-item__metrics {
  flex-shrink: 0;
  text-align: right;
  font-size: 0.72rem;
}
.gap-item__effort {
  font-weight: 700;
}
.gap-item__value {
  color: var(--pass);
  font-weight: 600;
}
.gap-item__after {
  color: var(--muted);
  font-size: 0.62rem;
  margin-top: 0.15rem;
}
.gap-item__chevron {
  color: var(--muted);
  margin-top: 0.3rem;
}
.gap-item__body {
  padding: 0 1rem 1rem 3.2rem;
  border-top: 1px solid var(--border);
}
.gap-item__desc {
  font-size: 0.78rem;
  color: var(--muted);
  line-height: 1.5;
  margin-top: 0.75rem;
}
.gap-item__failing {
  margin-top: 0.75rem;
  padding: 0.75rem 0.9rem;
  background: rgba(220,38,38,.04);
  border: 1px solid rgba(220,38,38,.15);
  border-radius: 8px;
}
.gap-item__failing-title {
  font-size: 0.72rem;
  font-weight: 700;
  color: #dc2626;
  margin-bottom: 0.25rem;
}
.gap-item__failing-msg {
  font-size: 0.72rem;
  color: var(--muted);
  line-height: 1.5;
}
.gap-item__failing-fix {
  margin-top: 0.5rem;
  font-size: 0.72rem;
  color: var(--muted);
  line-height: 1.5;
}
.gap-item__checks {
  margin-top: 0.75rem;
  display: flex;
  gap: 2rem;
  font-size: 0.72rem;
}
.gap-item__checks-title {
  font-weight: 700;
  margin-bottom: 0.3rem;
}
.gap-item__checks-title--fail { color: #dc2626; }
.gap-item__checks-title--pass { color: #059669; }
.gap-item__check {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--muted);
  font-size: 0.65rem;
}
.gap-item__check--more {
  color: var(--muted);
  font-style: italic;
}
.gap-item__resources {
  margin-top: 0.75rem;
}
.gap-item__resources-title {
  font-size: 0.62rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.3rem;
}
.gap-item__resources-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.gap-item__resource {
  font-size: 0.65rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--muted);
  background: var(--bg);
  border-radius: 4px;
  padding: 0.1rem 0.35rem;
}

.gap-passing {
  margin-top: 1.25rem;
}
.gap-passing__title {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

.gap-reqs__summary {
  margin-bottom: 1rem;
  font-size: 0.8rem;
  color: var(--muted);
}
.gap-reqs__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.75rem;
}
.gap-req {
  padding: 0.85rem 1rem;
  border-radius: 10px;
  border: 1px solid;
}
.gap-req--met {
  background: rgba(5,150,105,.04);
  border-color: rgba(5,150,105,.25);
}
.gap-req--gap {
  background: rgba(220,38,38,.04);
  border-color: rgba(220,38,38,.25);
}
.gap-req__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.gap-req__state {
  font-size: 1.1rem;
  line-height: 1;
}
.gap-req__id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 700;
  font-size: 0.82rem;
}
.gap-req--met .gap-req__id { color: #059669; }
.gap-req--gap .gap-req__id { color: #dc2626; }
.gap-req__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.gap-req__control {
  font-size: 0.62rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  border: 1px solid;
  font-weight: 600;
}

.gap-empty {
  text-align: center;
  padding: 2.5rem;
  color: var(--muted);
  font-size: 0.85rem;
}
.gap-empty__icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

/* Smaller, denser KPI tiles so the 9-tile grid fits in two compact rows. */
.gap-root .scc-kpi-grid {
  gap: 0.5rem;
}
.gap-root .scc-kpi {
  padding: 0.55rem 0.7rem;
  gap: 0.15rem;
  border-radius: 10px;
}
.gap-root .scc-kpi__value {
  font-size: 1.05rem;
}
.gap-root .scc-kpi__label {
  font-size: 0.52rem;
}
.gap-root .scc-kpi:hover {
  transform: none;
}

/* Light-theme softness: reduce the neon / high-contrast glow on the Gap page. */
[data-theme="light"] .gap-hero {
  background: linear-gradient(135deg, color-mix(in srgb, var(--waf-brand) 3%, var(--surface)) 0%, var(--bg) 100%);
}
[data-theme="light"] .gap-hero__badge {
  background: color-mix(in srgb, var(--waf-brand) 8%, transparent);
}
[data-theme="light"] .gap-hero__back {
  background: color-mix(in srgb, var(--waf-brand) 6%, transparent);
  border-color: color-mix(in srgb, var(--waf-brand) 15%, transparent);
}
[data-theme="light"] .gap-summary__country {
  background: color-mix(in srgb, var(--fw-color) 6%, transparent);
  border-color: color-mix(in srgb, var(--fw-color) 12%, transparent);
}
[data-theme="light"] .gap-summary__export:hover {
  background: color-mix(in srgb, var(--pass) 6%, transparent);
}
[data-theme="light"] .gap-intro {
  background: color-mix(in srgb, var(--waf-brand) 3%, transparent);
  border-color: color-mix(in srgb, var(--waf-brand) 8%, transparent);
}
[data-theme="light"] .gap-all-passing {
  border-color: rgba(5,150,105,.18);
  background: rgba(5,150,105,.03);
}
[data-theme="light"] .gap-sort__btn--active {
  background: color-mix(in srgb, var(--waf-brand) 6%, transparent);
}
[data-theme="light"] .gap-root .scc-tab--active {
  background: color-mix(in srgb, var(--waf-brand) 8%, transparent);
}
[data-theme="light"] .gap-item--actionable {
  border-left-color: color-mix(in srgb, var(--item-color) 55%, transparent);
}
[data-theme="light"] .gap-req--met {
  background: rgba(5,150,105,.03);
  border-color: rgba(5,150,105,.18);
}
[data-theme="light"] .gap-req--gap {
  background: rgba(220,38,38,.03);
  border-color: rgba(220,38,38,.18);
}

@media (max-width: 800px) {
  .gap-summary {
    grid-template-columns: 1fr;
  }
  .gap-summary__score,
  .gap-summary__export {
    align-self: flex-start;
  }
  .gap-hero__back {
    width: 100%;
    justify-content: center;
  }
}
`
