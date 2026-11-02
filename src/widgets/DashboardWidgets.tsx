import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { RunDetail, RunSummary } from '../api'
import { PILLARS, pillarScore } from '../pillars'
import { MATURITY_META, type Settings } from '../pages/settingsUtils'
import type { Page } from '../routing'
import { widgetMeta, type DashboardWidget, type WidgetType } from './types'

export interface WidgetContext {
  run: RunDetail | null
  runs: RunSummary[]
  waiverCount: number
  riskCount: number
  maturityLevel: number
  settings: Settings
  onSelectRun: (id: string) => void
  navigate: (page: Page) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const
const SEV_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#ea580c',
  MEDIUM: '#d97706',
  LOW: '#64748b',
}

const INTELLIGENCE_KEYS = [
  'secretScanner', 'autoFix', 'blastRadius', 'driftDetection', 'complianceGating',
  'riskScoring', 'dependencyGraph', 'carbonTracking', 'evidenceCollection', 'multiCloudNormalization',
] as const

function fmtShortDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function scoreColor(score: number): string {
  return score >= 80 ? 'var(--score-high)' : score >= 60 ? 'var(--score-mid)' : 'var(--score-low)'
}

function Empty({ label }: { label: string }) {
  return <div className="wdg-empty">{label}</div>
}

function Stat({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return (
    <div className="wdg-stat">
      <strong style={color ? { color } : undefined}>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function BarRow({ label, value, max, color, suffix }: { label: string; value: number; max: number; color: string; suffix?: string }) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return (
    <div className="wdg-bar-row">
      <span className="wdg-bar-label" title={label}>{label}</span>
      <span className="wdg-bar-track"><span className="wdg-bar-fill" style={{ width: `${width}%`, background: color }} /></span>
      <span className="wdg-bar-value">{value}{suffix}</span>
    </div>
  )
}

// ── Posture ──────────────────────────────────────────────────────────────────

function ScoreGauge({ ctx }: { ctx: WidgetContext }) {
  const { run, runs, t } = ctx
  if (!run) return <Empty label={t('pages.myDashboard.states.noRun')} />

  const score = Math.max(0, Math.min(100, Math.round(run.score)))
  const history = [...runs].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  const index = history.findIndex(candidate => candidate.id === run.id)
  const previous = index >= 0 ? history[index + 1] : history.find(candidate => Date.parse(candidate.created_at) < Date.parse(run.created_at))
  const delta = previous ? score - Math.round(previous.score) : null
  const color = scoreColor(score)
  const radius = 42
  const circumference = 2 * Math.PI * radius

  return (
    <div className="wdg-gauge">
      <div className="wdg-gauge-graphic">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--track)" strokeWidth="9" />
          <circle
            cx="50" cy="50" r={radius} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={circumference * (1 - score / 100)}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <div className="wdg-gauge-value" style={{ color }}>{score}<span>/100</span></div>
      </div>
      <div className="wdg-gauge-meta">
        <span>{score >= 80 ? t('pages.myDashboard.states.strong') : score >= 60 ? t('pages.myDashboard.states.focused') : t('pages.myDashboard.states.highRisk')}</span>
        {delta !== null && (
          <span className={delta >= 0 ? 'is-up' : 'is-down'}>
            {delta >= 0 ? '+' : ''}{delta} {t('pages.myDashboard.states.previous')}
          </span>
        )}
      </div>
    </div>
  )
}

function SeverityBreakdown({ ctx }: { ctx: WidgetContext }) {
  const { run, t } = ctx
  if (!run) return <Empty label={t('pages.myDashboard.states.noRun')} />

  const counts = SEVERITIES.map(severity => ({
    severity,
    count: run.findings.filter(finding => finding.status?.toUpperCase() === 'FAIL' && (finding.severity?.toUpperCase() ?? 'LOW') === severity).length,
  }))
  const total = counts.reduce((sum, entry) => sum + entry.count, 0)
  if (total === 0) return <Empty label={t('pages.myDashboard.states.noFailures')} />

  return (
    <div className="wdg-severity">
      <div className="wdg-stack" role="img" aria-label={t('pages.myDashboard.widgets.severityBreakdown.title')}>
        {counts.map(entry => entry.count > 0 && (
          <span key={entry.severity} style={{ flexGrow: entry.count, background: SEV_COLOR[entry.severity] }} title={`${entry.severity}: ${entry.count}`} />
        ))}
      </div>
      <div className="wdg-legend">
        {counts.map(entry => (
          <div className="wdg-legend-row" key={entry.severity}>
            <span className="wdg-dot" style={{ background: SEV_COLOR[entry.severity] }} />
            <span>{entry.severity}</span>
            <strong>{entry.count}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function PillarHealth({ ctx }: { ctx: WidgetContext }) {
  const { run, t } = ctx
  if (!run) return <Empty label={t('pages.myDashboard.states.noRun')} />

  const rows = PILLARS.flatMap(pillar => {
    const score = pillarScore(run.pillar_scores, pillar.key)
    return score === null || score === undefined ? [] : [{ ...pillar, score }]
  })

  if (rows.length === 0) return <Empty label={t('pages.myDashboard.states.noPillars')} />

  return (
    <div className="wdg-bars">
      {rows.map(pillar => (
        <BarRow key={pillar.key} label={pillar.label} value={Math.round(pillar.score)} max={100} color={pillar.color} />
      ))}
    </div>
  )
}

function TopControls({ ctx }: { ctx: WidgetContext }) {
  const { run, t } = ctx
  if (!run) return <Empty label={t('pages.myDashboard.states.noRun')} />

  const map = new Map<string, { title: string; count: number; severity: string }>()
  for (const finding of run.findings) {
    if (finding.status?.toUpperCase() !== 'FAIL') continue
    const key = finding.control_id || finding.check_id
    const severity = finding.severity?.toUpperCase() ?? 'LOW'
    const entry = map.get(key) ?? { title: finding.check_title || key, count: 0, severity }
    entry.count += 1
    if ((SEV_ORDER[severity] ?? 9) < (SEV_ORDER[entry.severity] ?? 9)) entry.severity = severity
    map.set(key, entry)
  }

  const rows = [...map.entries()]
    .sort((a, b) => (SEV_ORDER[a[1].severity] ?? 9) - (SEV_ORDER[b[1].severity] ?? 9) || b[1].count - a[1].count)
    .slice(0, 5)

  if (rows.length === 0) return <Empty label={t('pages.myDashboard.states.noFailures')} />

  return (
    <ul className="wdg-list">
      {rows.map(([id, entry]) => (
        <li key={id}>
          <span className="wdg-dot" style={{ background: SEV_COLOR[entry.severity] ?? SEV_COLOR.LOW }} />
          <span className="wdg-list-text" title={`${entry.title} · ${id}`}>{entry.title}</span>
          <span className="wdg-chip">{entry.count}</span>
        </li>
      ))}
    </ul>
  )
}

// ── Trends & runs ────────────────────────────────────────────────────────────

function ScoreTrend({ ctx }: { ctx: WidgetContext }) {
  const { runs, t } = ctx
  const points = [...runs]
    .filter(candidate => typeof candidate.score === 'number')
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    .slice(-12)
    .map(candidate => ({ label: fmtShortDate(candidate.created_at), score: Math.round(candidate.score) }))

  if (points.length < 2) return <Empty label={t('pages.myDashboard.states.noTrend')} />

  return (
    <div className="wdg-chart">
      <ResponsiveContainer width="100%" height={170}>
        <LineChart data={points} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={36} />
          <Tooltip
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text)' }}
            labelStyle={{ color: 'var(--muted)' }}
          />
          <Line type="monotone" dataKey="score" stroke="var(--waf-brand)" strokeWidth={2.2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function RecentRuns({ ctx }: { ctx: WidgetContext }) {
  const { runs, t, onSelectRun } = ctx
  const rows = [...runs].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 5)
  if (rows.length === 0) return <Empty label={t('pages.myDashboard.states.noRuns')} />

  return (
    <ul className="wdg-list wdg-run-list">
      {rows.map(candidate => (
        <li key={candidate.id}>
          <button type="button" className="wdg-run" onClick={() => onSelectRun(candidate.id)}>
            <span className="wdg-run-main">
              <strong>{candidate.project || t('pages.myDashboard.states.unnamed')}</strong>
              <span>{candidate.branch || '—'} · {fmtShortDate(candidate.created_at)}</span>
            </span>
            <span className="wdg-score" style={{ color: scoreColor(candidate.score) }}>{Math.round(candidate.score)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function PlanChanges({ ctx }: { ctx: WidgetContext }) {
  const { run, t } = ctx
  if (!run) return <Empty label={t('pages.myDashboard.states.noRun')} />
  const plan = run.plan_changes?.summary
  if (!plan) return <Empty label={t('pages.myDashboard.states.noPlan')} />

  return (
    <div className="wdg-stats">
      <Stat value={plan.add ?? 0} label={t('pages.myDashboard.states.add')} color="var(--score-high)" />
      <Stat value={plan.change ?? 0} label={t('pages.myDashboard.states.change')} color="var(--waf-warn)" />
      <Stat value={plan.destroy ?? 0} label={t('pages.myDashboard.states.destroy')} color="var(--fail)" />
      <Stat value={plan.replace ?? 0} label={t('pages.myDashboard.states.replace')} color="var(--waived)" />
    </div>
  )
}

// ── Governance ───────────────────────────────────────────────────────────────

function ControlCoverage({ ctx }: { ctx: WidgetContext }) {
  const { run, t } = ctx
  if (!run) return <Empty label={t('pages.myDashboard.states.noRun')} />

  let pass = 0
  let fail = 0
  let skip = 0
  for (const finding of run.findings) {
    const status = finding.status?.toUpperCase()
    if (status === 'PASS') pass += 1
    else if (status === 'FAIL') fail += 1
    else if (status === 'SKIP') skip += 1
  }
  const evaluated = pass + fail
  const total = evaluated + skip
  if (total === 0) return <Empty label={t('pages.myDashboard.states.noData')} />

  return (
    <div className="wdg-coverage">
      <div className="wdg-stack">
        {pass > 0 && <span style={{ flexGrow: pass, background: 'var(--pass)' }} title={`PASS: ${pass}`} />}
        {fail > 0 && <span style={{ flexGrow: fail, background: 'var(--fail)' }} title={`FAIL: ${fail}`} />}
        {skip > 0 && <span style={{ flexGrow: skip, background: 'var(--skip)' }} title={`SKIP: ${skip}`} />}
      </div>
      <div className="wdg-stats wdg-stats-3">
        <Stat value={pass} label={t('pages.myDashboard.states.pass')} color="var(--pass)" />
        <Stat value={fail} label={t('pages.myDashboard.states.fail')} color="var(--fail)" />
        <Stat value={skip} label={t('pages.myDashboard.states.skip')} color="var(--skip)" />
      </div>
      <p className="wdg-note">
        {run.controls_loaded > 0
          ? t('pages.myDashboard.states.coverageNote', { evaluated, loaded: run.controls_loaded })
          : t('pages.myDashboard.states.noData')}
      </p>
    </div>
  )
}

function SecretsRisk({ ctx }: { ctx: WidgetContext }) {
  const { run, t } = ctx
  if (!run) return <Empty label={t('pages.myDashboard.states.noRun')} />

  const secrets = run.secret_findings.filter(finding => !finding.suppressed).length
  const resources = new Set(run.findings.filter(finding => finding.status?.toUpperCase() === 'FAIL').map(finding => finding.resource).filter(Boolean)).size
  if (secrets === 0 && resources === 0) return <Empty label={t('pages.myDashboard.states.noSecrets')} />

  return (
    <div className="wdg-stats">
      <Stat value={secrets} label={t('pages.myDashboard.states.secrets')} color={secrets > 0 ? 'var(--fail)' : undefined} />
      <Stat value={resources} label={t('pages.myDashboard.states.resources')} color={resources > 0 ? 'var(--waf-warn)' : undefined} />
    </div>
  )
}

function MaturitySnapshot({ ctx }: { ctx: WidgetContext }) {
  const { maturityLevel, settings, waiverCount, riskCount, t } = ctx
  const maturity = MATURITY_META.find(entry => entry.level === maturityLevel) ?? MATURITY_META[0]
  const features = INTELLIGENCE_KEYS.filter(key => settings[key]).length
  const pillars = settings.activePillars?.length ?? 0

  return (
    <div className="wdg-maturity">
      <div className="wdg-maturity-head">
        <span className="wdg-maturity-badge" style={{ background: maturity.color }}>L{maturity.level}</span>
        <div>
          <strong>{maturity.short}</strong>
          <span>{maturity.desc}</span>
        </div>
      </div>
      <div className="wdg-stats wdg-stats-2">
        <Stat value={pillars} label={t('pages.myDashboard.states.activePillars')} />
        <Stat value={features} label={t('pages.myDashboard.states.intelligence')} />
      </div>
      <p className="wdg-note">{t('pages.myDashboard.states.governanceNote', { waivers: waiverCount, risks: riskCount })}</p>
    </div>
  )
}

// ── Insights ─────────────────────────────────────────────────────────────────

function ComplianceReadiness({ ctx }: { ctx: WidgetContext }) {
  const { run, t } = ctx
  if (!run) return <Empty label={t('pages.myDashboard.states.noRun')} />

  const failedControls = new Set(
    run.findings.filter(finding => finding.status?.toUpperCase() === 'FAIL').map(finding => finding.control_id),
  )
  const frameworks = new Map<string, { total: number; failed: number }>()
  for (const control of run.controls_meta) {
    for (const mapping of control.regulatory_mapping ?? []) {
      const entry = frameworks.get(mapping.framework) ?? { total: 0, failed: 0 }
      entry.total += 1
      if (failedControls.has(control.id)) entry.failed += 1
      frameworks.set(mapping.framework, entry)
    }
  }

  const rows = [...frameworks.entries()]
    .map(([framework, entry]) => ({
      framework,
      total: entry.total,
      failed: entry.failed,
      rate: entry.total > 0 ? Math.round(((entry.total - entry.failed) / entry.total) * 100) : 0,
    }))
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 5)

  if (rows.length === 0) return <Empty label={t('pages.myDashboard.states.noFrameworks')} />

  return (
    <div className="wdg-bars">
      {rows.map(row => (
        <BarRow
          key={row.framework}
          label={row.framework}
          value={row.rate}
          max={100}
          color={row.rate >= 80 ? 'var(--score-high)' : row.rate >= 60 ? 'var(--score-mid)' : 'var(--score-low)'}
          suffix="%"
        />
      ))}
    </div>
  )
}

function Regions({ ctx }: { ctx: WidgetContext }) {
  const { run, t } = ctx
  if (!run) return <Empty label={t('pages.myDashboard.states.noRun')} />
  const regions = run.detected_regions ?? []
  if (regions.length === 0) return <Empty label={t('pages.myDashboard.states.noRegions')} />

  const byProvider = new Map<string, Set<string>>()
  for (const [region, provider] of regions) {
    const key = provider || 'unknown'
    const set = byProvider.get(key) ?? new Set<string>()
    set.add(region)
    byProvider.set(key, set)
  }

  return (
    <div className="wdg-regions">
      {[...byProvider.entries()].map(([provider, set]) => (
        <div className="wdg-region-group" key={provider}>
          <span className="wdg-region-provider">{provider}</span>
          <div className="wdg-chips">
            {[...set].slice(0, 6).map(region => <span className="wdg-chip" key={region}>{region}</span>)}
            {set.size > 6 && <span className="wdg-chip">+{set.size - 6}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

function RiskHotspots({ ctx }: { ctx: WidgetContext }) {
  const { run, t } = ctx
  if (!run) return <Empty label={t('pages.myDashboard.states.noRun')} />

  const map = new Map<string, { count: number; severity: string }>()
  for (const finding of run.findings) {
    if (finding.status?.toUpperCase() !== 'FAIL' || !finding.resource) continue
    const severity = finding.severity?.toUpperCase() ?? 'LOW'
    const entry = map.get(finding.resource) ?? { count: 0, severity }
    entry.count += 1
    if ((SEV_ORDER[severity] ?? 9) < (SEV_ORDER[entry.severity] ?? 9)) entry.severity = severity
    map.set(finding.resource, entry)
  }

  const rows = [...map.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5)
  if (rows.length === 0) return <Empty label={t('pages.myDashboard.states.noResources')} />

  return (
    <ul className="wdg-list">
      {rows.map(([resource, entry]) => (
        <li key={resource}>
          <span className="wdg-dot" style={{ background: SEV_COLOR[entry.severity] ?? SEV_COLOR.LOW }} />
          <span className="wdg-list-text" title={resource}>{resource}</span>
          <span className="wdg-chip">{entry.count}</span>
        </li>
      ))}
    </ul>
  )
}

// ── Content ──────────────────────────────────────────────────────────────────

function IframeWidget({ ctx, widget }: { ctx: WidgetContext; widget: DashboardWidget }) {
  const { t } = ctx
  const url = widget.config?.url
  if (!url) return <Empty label={t('pages.myDashboard.states.iframeEmpty')} />
  return (
    <div className="wdg-iframe-wrap">
      <iframe
        className="wdg-iframe"
        src={url}
        title={widget.config?.title || t('pages.myDashboard.widgets.iframe.title')}
        sandbox="allow-scripts allow-forms allow-popups allow-presentation"
        referrerPolicy="no-referrer"
        loading="lazy"
      />
    </div>
  )
}

function TextWidget({ ctx, widget }: { ctx: WidgetContext; widget: DashboardWidget }) {
  const { t } = ctx
  const text = widget.config?.text?.trim()
  if (!text) return <Empty label={t('pages.myDashboard.states.textEmpty')} />
  return <div className="wdg-text">{text}</div>
}

function LogoWidget({ ctx, widget }: { ctx: WidgetContext; widget: DashboardWidget }) {
  const { t } = ctx
  const src = widget.config?.src
  if (!src) return <Empty label={t('pages.myDashboard.states.logoEmpty')} />
  return (
    <div className="wdg-logo">
      <img src={src} alt={widget.config?.alt || t('pages.myDashboard.widgets.logo.title')} />
    </div>
  )
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

const BODIES: Record<WidgetType, (props: { ctx: WidgetContext; widget: DashboardWidget }) => JSX.Element> = {
  'score-gauge': ScoreGauge,
  'severity-breakdown': SeverityBreakdown,
  'pillar-health': PillarHealth,
  'top-controls': TopControls,
  'score-trend': ScoreTrend,
  'recent-runs': RecentRuns,
  'plan-changes': PlanChanges,
  'control-coverage': ControlCoverage,
  'secrets-risk': SecretsRisk,
  maturity: MaturitySnapshot,
  'compliance-readiness': ComplianceReadiness,
  regions: Regions,
  'risk-hotspots': RiskHotspots,
  iframe: IframeWidget,
  text: TextWidget,
  logo: LogoWidget,
}

export default function DashboardWidgetBody({ widget, ctx }: { widget: DashboardWidget; ctx: WidgetContext }) {
  const meta = widgetMeta(widget.type)
  const Body = BODIES[widget.type]
  return (
    <div className={`wdg-body wdg-type-${meta.type}`}>
      <Body ctx={ctx} widget={widget} />
    </div>
  )
}
