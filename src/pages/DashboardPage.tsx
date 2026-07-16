import { useEffect, useMemo, useState } from 'react'
import {
  Bar, BarChart, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { RunDetail } from '../api'
import { useI18n } from '../i18n'

interface Props {
  run: RunDetail
  onNav?: (page: string) => void
  waiverCount?: number
  riskCount?: number
  runCount?: number
}

// ── Palette ────────────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: '#DC2626',
  HIGH: '#F97316',
  MEDIUM: '#F59E0B',
  LOW: '#10B981',
}

const PILLAR_META: { key: string; label: string; color: string; slug: string }[] = [
  { key: 'security', label: 'Security', color: '#DC2626', slug: 'SEC' },
  { key: 'cost', label: 'Cost', color: '#0094FF', slug: 'CST' },
  { key: 'operations', label: 'Operations', color: '#8B5CF6', slug: 'OPS' },
  { key: 'performance', label: 'Performance', color: '#F97316', slug: 'PRF' },
  { key: 'reliability', label: 'Reliability', color: '#10B981', slug: 'REL' },
  { key: 'sovereign', label: 'Sovereignty', color: '#F59E0B', slug: 'SOV' },
  { key: 'sustainability', label: 'Sustainability', color: '#14B8A6', slug: 'SUS' },
  { key: 'agentic', label: 'Agentic', color: '#EC4899', slug: 'AGT' },
]

const PILLAR_COLOR: Record<string, string> = Object.fromEntries(
  PILLAR_META.map(p => [p.key, p.color])
)

const PROVIDER_COLOR: Record<string, string> = {
  aws: '#FF9900', azure: '#0078D4', gcp: '#34A853',
  oci: '#F80000', alicloud: '#FF6A00', yandex: '#FCDB03',
}

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const
const HEAT_STEPS = ['#fff1f2', '#fecdd3', '#f43f5e', '#be123c']

function normalizePillarName(p: string): string {
  if (p === 'operational') return 'operations'
  return p
}

function scoreColor(s: number) {
  return s >= 80 ? '#059669' : s >= 60 ? '#D97706' : '#DC2626'
}

function scoreLabel(s: number, t: (key: string) => string) {
  return s >= 80 ? t('pages.dashboard.goodPosture') : s >= 60 ? t('pages.dashboard.needsAttention') : t('pages.dashboard.highRisk')
}

function hex(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`
}

function dateFmt(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return iso }
}

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconWrapper({ children, size = 18 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

const I = {
  shield:  <IconWrapper><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></IconWrapper>,
  list:    <IconWrapper><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></IconWrapper>,
  bolt:    <IconWrapper><path d="M13 10V3L4 14h7v7l9-11h-7z" /></IconWrapper>,
  check:   <IconWrapper><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></IconWrapper>,
  globe:   <IconWrapper><path d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 004 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" /></IconWrapper>,
  warning: <IconWrapper><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></IconWrapper>,
  fire:    <IconWrapper><path d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></IconWrapper>,
  key:     <IconWrapper><path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></IconWrapper>,
  dollar:  <IconWrapper><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></IconWrapper>,
  history: <IconWrapper><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></IconWrapper>,
  diff:    <IconWrapper><path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></IconWrapper>,
  log:     <IconWrapper><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></IconWrapper>,
  play:    <IconWrapper><path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></IconWrapper>,
  code:    <IconWrapper><path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></IconWrapper>,
  waiver:  <IconWrapper><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></IconWrapper>,
  risk:    <IconWrapper><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></IconWrapper>,
  drift:   <IconWrapper><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></IconWrapper>,
  sprint:  <IconWrapper><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></IconWrapper>,
  module:  <IconWrapper><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></IconWrapper>,
  blast:   <IconWrapper><circle cx="12" cy="12" r="3" strokeWidth={2} /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></IconWrapper>,
  dep:     <IconWrapper><path d="M4 6h16M4 12h16M4 18h7" /></IconWrapper>,
  exploit: <IconWrapper><path d="M13 10V3L4 14h7v7l9-11h-7z" /></IconWrapper>,
  gap:     <IconWrapper><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></IconWrapper>,
  evidence:<IconWrapper><path d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V8.586a1 1 0 00-.293-.707l-4.586-4.586A1 1 0 0014.414 3H8zm6 0v4h4M10 12h4m-4 4h2" /></IconWrapper>,
  skip:    <IconWrapper><path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></IconWrapper>,
  branch:  <IconWrapper size={12}><path d="M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zm-12 0a3 3 0 100 6 3 3 0 000-6zm0 0h12" /></IconWrapper>,
  arrow:   <IconWrapper size={14}><path d="M5 12h14M12 5l7 7-7 7" /></IconWrapper>,
  x:       <IconWrapper size={16}><path d="M18 6L6 18M6 6l12 12" /></IconWrapper>,
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ScoreGauge({ score, label, size = 160 }: { score: number; label: string; size?: number }) {
  const color = scoreColor(score)
  const radius = (size - 28) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const animValue = useCountUp(score, 900)

  return (
    <div className="x-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="x-gauge-svg">
        <defs>
          <linearGradient id={`gaugeGrad-${score}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={hex(color, 0.55)} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--track)" strokeWidth="14" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#gaugeGrad-${score})`}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="x-gauge-inner">
        <span className="x-gauge-score" style={{ color }}>{animValue}</span>
        <span className="x-gauge-over">/100</span>
        <span className="x-gauge-label" style={{ color }}>{label}</span>
      </div>
    </div>
  )
}

function SectionTitle({ children, icon, action }: { children: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="x-section-head">
      <div className="x-section-title">
        {icon && <span className="x-section-icon">{icon}</span>}
        {children}
      </div>
      {action && <div className="x-section-action">{action}</div>}
    </div>
  )
}

function SeverityBadge({ sev }: { sev: string }) {
  const u = sev.toUpperCase()
  const c = SEVERITY_COLOR[u] ?? '#94a3b8'
  return <span className="x-sev" style={{ background: hex(c, 0.12), color: c }}>{u}</span>
}

function ActionButton({ children, variant = 'primary', onClick, icon }: {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  onClick?: () => void
  icon?: React.ReactNode
}) {
  return (
    <button type="button" className={`x-btn x-btn--${variant}`} onClick={onClick}>
      {icon && <span className="x-btn-icon">{icon}</span>}
      {children}
    </button>
  )
}

function NavTile({ icon, title, desc, value, accent, alert, onClick }: {
  icon: React.ReactNode
  title: string
  desc?: string
  value?: string | number
  accent?: string
  alert?: boolean
  onClick?: () => void
}) {
  const showVal = value !== undefined && value !== 0 && value !== '0'
  return (
    <button type="button" className={`x-navtile ${onClick ? 'x-navtile--click' : ''}`} onClick={onClick}>
      <div className="x-navtile-icon" style={{ background: accent ? hex(accent, 0.1) : 'var(--bg)', color: accent || 'var(--waf-brand)' }}>
        {icon}
      </div>
      <div className="x-navtile-body">
        <div className="x-navtile-top">
          <span className="x-navtile-title">{title}</span>
          {alert && <span className="x-navtile-alert" />}
          {showVal && <span className="x-navtile-value" style={{ color: accent }}>{value}</span>}
        </div>
        {desc && <div className="x-navtile-desc">{desc}</div>}
      </div>
      {onClick && <span className="x-navtile-arrow">{I.arrow}</span>}
    </button>
  )
}

function StatPill({ label, value, sub, color }: {
  label: string
  value: string | number
  sub: string
  color?: string
}) {
  const c = color || 'var(--text)'
  return (
    <div className="x-statpill" style={{ borderColor: hex(c, 0.15), background: hex(c, 0.04) }}>
      <div className="x-statpill-value" style={{ color: c }}>{value}</div>
      <div className="x-statpill-label">{label}</div>
      <div className="x-statpill-sub">{sub}</div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DashboardPage({ run, onNav, waiverCount = 0, riskCount = 0, runCount = 0 }: Props) {
  const { t } = useI18n()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const findings = run.findings

  const controlIds = useMemo(() => Array.from(new Set(findings.map(f => f.control_id).filter(Boolean))), [findings])
  const controlStats = useMemo(() => {
    let pass = 0, fail = 0, skip = 0, waived = 0
    for (const cid of controlIds) {
      const statuses = findings.filter(f => f.control_id === cid).map(f => f.status?.toUpperCase())
      if (statuses.some(s => s === 'WAIVED')) { waived++; continue }
      if (statuses.some(s => s === 'FAIL')) { fail++; continue }
      if (statuses.every(s => s === 'PASS')) { pass++; continue }
      skip++
    }
    return { pass, fail, skip, waived }
  }, [findings, controlIds])

  const totalChecks = findings.length
  const passChecks = findings.filter(f => f.status?.toUpperCase() === 'PASS').length
  const passRate = totalChecks > 0 ? Math.round((passChecks / totalChecks) * 100) : 0
  const resources = new Set(findings.map(f => f.resource).filter(Boolean)).size
  const failResources = new Set(findings.filter(f => f.status?.toUpperCase() === 'FAIL').map(f => f.resource).filter(Boolean)).size

  const allFails = findings.filter(f => f.status?.toUpperCase() === 'FAIL')
  const critFails = allFails.filter(f => f.severity?.toUpperCase() === 'CRITICAL')
  const highFails = allFails.filter(f => f.severity?.toUpperCase() === 'HIGH')
  const critHighFails = allFails.filter(f => ['CRITICAL', 'HIGH'].includes(f.severity?.toUpperCase())).slice(0, 5)

  const severityCounts = SEVERITIES
    .map(s => ({ name: s, value: allFails.filter(f => f.severity?.toUpperCase() === s).length }))
    .filter(d => d.value > 0)

  const pillarData = PILLAR_META.map(({ key, label }) => ({
    key,
    pillar: label,
    score: (run.pillar_scores?.[key] ?? 0) as number,
  }))

  const detectedRegions = run.detected_regions ?? []
  const providerCounts = detectedRegions.reduce<Record<string, number>>((acc, [, prov]) => {
    if (prov) acc[prov] = (acc[prov] ?? 0) + 1
    return acc
  }, {})
  const providerNames = Object.keys(providerCounts)

  const secretFindings = run.secret_findings ?? []
  const secretUnsuppressed = secretFindings.filter(s => !s.suppressed).length
  const secretCritical = secretFindings.filter(s => s.severity === 'critical').length

  const planChanges = run.plan_changes
  const changeDelta = planChanges
    ? planChanges.summary.add + planChanges.summary.change + planChanges.summary.destroy + planChanges.summary.replace
    : 0

  const fwMap = new Map<string, { pass: number; total: number }>()
  for (const ctrl of run.controls_meta) {
    const ctrlFindings = findings.filter(f => f.control_id === ctrl.id)
    if (!ctrlFindings.length) continue
    const ctrlPasses = ctrlFindings.every(f => f.status?.toUpperCase() === 'PASS')
    for (const rm of ctrl.regulatory_mapping) {
      const e = fwMap.get(rm.framework) ?? { pass: 0, total: 0 }
      e.total++
      if (ctrlPasses) e.pass++
      fwMap.set(rm.framework, e)
    }
  }
  const regulatoryAll = Array.from(fwMap.entries())
    .map(([fw, { pass, total }]) => ({ fw, pass, total, pct: total > 0 ? Math.round((pass / total) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct)
  const regulatoryTop = regulatoryAll.slice(0, 6)
  const avgCompliance = regulatoryAll.length > 0
    ? Math.round(regulatoryAll.reduce((s, r) => s + r.pct, 0) / regulatoryAll.length)
    : 0

  const pillarHealth = pillarData.map(({ key, pillar, score }) => {
    const np = normalizePillarName(key)
    const pf = findings.filter(f => normalizePillarName(f.pillar ?? '') === np)
    const fails = pf.filter(f => f.status?.toUpperCase() === 'FAIL').length
    return { key, pillar, score, fails, total: pf.length }
  }).sort((a, b) => a.score - b.score)

  const heatmapAll = PILLAR_META.flatMap(({ key: pillar }) => {
    const np = normalizePillarName(pillar)
    return SEVERITIES.map(s => ({
      pillar: np,
      severity: s,
      count: allFails.filter(f => normalizePillarName(f.pillar ?? '') === np && f.severity?.toUpperCase() === s).length,
    }))
  })
  const heatMax = heatmapAll.reduce((m, c) => Math.max(m, c.count), 1)

  const SWEIGHT: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
  const quickWins = [...allFails]
    .sort((a, b) => (SWEIGHT[b.severity?.toUpperCase() ?? ''] ?? 0) - (SWEIGHT[a.severity?.toUpperCase() ?? ''] ?? 0))
    .slice(0, 6)

  return (
    <div className={`x-root ${mounted ? 'x-root--mounted' : ''}`}>
      <style>{dashboardCss}</style>

      {/* ── Masthead / hero ─────────────────────────────────────────────── */}
      <header className="x-masthead">
        <div className="x-masthead-glow" />
        <div className="x-masthead-inner">
          <div className="x-masthead-left">
            <div className="x-badge">{I.shield} {t('pages.dashboard.infrastructureScan')}</div>
            <h1 className="x-title">{run.project || t('pages.dashboard.infrastructureScan')}</h1>
            <div className="x-meta">
              {run.branch && <span className="x-chip x-chip--brand">{I.branch} {run.branch}</span>}
              {run.iac_framework && <span className="x-chip">{run.iac_framework}</span>}
              {run.created_at && <span className="x-chip x-chip--muted">{dateFmt(run.created_at)}</span>}
              {run.controls_loaded > 0 && <span className="x-chip x-chip--muted">{t('pages.dashboard.controlsLoaded', { count: run.controls_loaded })}</span>}
            </div>
            <div className="x-actions">
              {onNav && <ActionButton variant="primary" icon={I.list} onClick={() => onNav('findings')}>{t('pages.dashboard.viewFindings')}</ActionButton>}
              {onNav && <ActionButton variant="secondary" icon={I.play} onClick={() => onNav('runscan')}>{t('pages.dashboard.newScan')}</ActionButton>}
            </div>
          </div>

          <div className="x-masthead-right">
            <ScoreGauge score={run.score} label={scoreLabel(run.score, t)} />
          </div>
        </div>

        <div className="x-statbar">
          <StatPill label={t('pages.dashboard.failedControls')} value={controlStats.fail} sub={`${controlIds.length} controls`} color="#DC2626" />
          <StatPill label={t('pages.dashboard.critHigh')} value={critFails.length + highFails.length} sub={`${critFails.length} critical · ${highFails.length} high`} color="#F97316" />
          <StatPill label={t('pages.dashboard.resourcesAtRisk')} value={failResources} sub={`${resources} scanned`} color="#D97706" />
          <StatPill label={t('pages.dashboard.activeWaivers')} value={waiverCount} sub={`${riskCount} risks`} color="#8B5CF6" />
          <StatPill label={t('pages.dashboard.avgCompliance')} value={`${avgCompliance}%`} sub={`${regulatoryAll.length} frameworks`} color="#10B981" />
        </div>
      </header>

      {/* ── Critical attention strip ─────────────────────────────────────── */}
      {critHighFails.length > 0 && (
        <section className="x-attention">
          <div className="x-attention-left">
            <div className="x-attention-icon">{I.warning}</div>
            <div>
              <div className="x-attention-title">{t('pages.dashboard.requiresAttention')}</div>
              <div className="x-attention-sub">{t('pages.dashboard.critHighDesc')}</div>
            </div>
          </div>
          <div className="x-attention-right">
            {onNav && <ActionButton variant="primary" icon={I.bolt} onClick={() => onNav('autofix')}>{t('pages.dashboard.autoFix')}<span className="x-alpha">α</span></ActionButton>}
            {onNav && <ActionButton variant="secondary" onClick={() => onNav('findings')}>{t('pages.dashboard.allFindings')}</ActionButton>}
          </div>
          <div className="x-attention-list">
            {critHighFails.map((f, i) => (
              <button type="button" key={i} className="x-attention-row" onClick={() => onNav?.('autofix')}>
                <SeverityBadge sev={f.severity?.toUpperCase() ?? ''} />
                <span className="x-attention-code">{f.control_id}</span>
                <span className="x-attention-text">{f.check_title}</span>
                {f.pillar && (
                  <span className="x-pill" style={{ background: hex(PILLAR_COLOR[f.pillar] ?? '#888', 0.12), color: PILLAR_COLOR[f.pillar] ?? '#888' }}>
                    {f.pillar}
                  </span>
                )}
                <span className="x-attention-link">Fix →</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── Navigation command center ────────────────────────────────────── */}
      <section className="x-card x-card--nav">
        <SectionTitle icon={I.globe}>{t('pages.dashboard.navigateDashboard')}</SectionTitle>
        <div className="x-nav-grid">
          <div className="x-nav-col">
            <div className="x-nav-label">{t('pages.dashboard.navAnalysis')}</div>
            <NavTile icon={I.list} title="Findings" value={allFails.length > 0 ? allFails.length : undefined} desc={`${passRate}% pass · ${totalChecks} checks`} accent="#DC2626" alert={allFails.length > 0} onClick={() => onNav?.('findings')} />
            <NavTile icon={I.check} title="Compliance" value={`${avgCompliance}%`} desc={`${regulatoryAll.length} frameworks`} accent="#0094FF" onClick={() => onNav?.('compliance')} />
            <NavTile icon={I.gap} title="Gap Analysis" value={allFails.length > 0 ? t('pages.dashboard.gapsLabel', { count: new Set(allFails.map(f => f.control_id)).size }) : undefined} desc="Effort ranked" accent="#8B5CF6" onClick={() => onNav?.('gapanalysis')} />
            <NavTile icon={I.exploit} title="Exploit Paths" desc="Attack chains" accent="#DC2626" onClick={() => onNav?.('exploitpath')} />
            <NavTile icon={I.blast} title="Blast Radius" value={failResources > 0 ? failResources : undefined} desc="Impact map" accent="#F97316" onClick={() => onNav?.('blastradius')} />
            <NavTile icon={I.dep} title="Dep. Graph" desc="Topology" accent="#0D9488" onClick={() => onNav?.('depgraph')} />
          </div>

          <div className="x-nav-col">
            <div className="x-nav-label">{t('pages.dashboard.navInfrastructure')}</div>
            <NavTile icon={I.shield} title="Controls Catalogue" value={run.controls_loaded || run.controls_meta?.length || 0} desc={`${pillarHealth.length} pillars`} accent="#0094FF" onClick={() => onNav?.('catalogue')} />
            <NavTile icon={I.globe} title="Deployed Regions" value={detectedRegions.length > 0 ? `${detectedRegions.length}` : undefined} desc={detectedRegions.length > 0 ? providerNames.map(p => p.toUpperCase()).join(', ') : 'Cloud footprint'} accent="#0EA5E9" onClick={() => onNav?.('regions')} />
            <NavTile icon={I.key} title="Secret Scanner" value={secretUnsuppressed > 0 ? secretUnsuppressed : undefined} desc={`${secretCritical} critical secrets`} accent="#DC2626" alert={secretCritical > 0} onClick={() => onNav?.('secrets')} />
            <NavTile icon={I.module} title="Module Scores" desc="Per-module breakdown" accent="#8B5CF6" onClick={() => onNav?.('modules')} />
            <NavTile icon={I.dollar} title="Cost Impact" desc="Cost control estimates" accent="#10B981" onClick={() => onNav?.('cost')} />
            <NavTile icon={I.drift} title="Changes & Drift" value={changeDelta > 0 ? changeDelta : undefined} desc="Plan deltas" accent="#F97316" onClick={() => onNav?.('changes')} />
          </div>

          <div className="x-nav-col">
            <div className="x-nav-label">{t('pages.dashboard.navRiskGovernance')}</div>
            <NavTile icon={I.waiver} title="Waivers" value={waiverCount > 0 ? waiverCount : undefined} desc="Active waivers" accent="#8B5CF6" onClick={() => onNav?.('waivers')} />
            <NavTile icon={I.risk} title="Risk Acceptance" value={riskCount > 0 ? riskCount : undefined} desc="Approver trail" accent="#F97316" onClick={() => onNav?.('risk')} />
            <NavTile icon={I.sprint} title="Remediation Sprint" desc="Fix queue" accent="#10B981" onClick={() => onNav?.('remediation')} />
            <NavTile icon={I.skip} title="Skipped Controls" value={controlStats.skip > 0 ? controlStats.skip : undefined} desc="Coverage gaps" accent="#64748B" onClick={() => onNav?.('skipped')} />
          </div>

          <div className="x-nav-col">
            <div className="x-nav-label">{t('pages.dashboard.navHistoryAudit')}</div>
            <NavTile icon={I.history} title="Run History" value={runCount > 0 ? `${runCount}` : undefined} desc="Score trends" accent="#0094FF" onClick={() => onNav?.('runs')} />
            <NavTile icon={I.diff} title="Run Comparison" desc="Side-by-side diff" accent="#8B5CF6" onClick={() => onNav?.('diff')} />
            <NavTile icon={I.log} title="Audit Log" desc="Action record" accent="#64748B" onClick={() => onNav?.('audit')} />
            <NavTile icon={I.evidence} title="Evidence Package" desc="Export bundle" accent="#0094FF" onClick={() => onNav?.('evidence')} />
            <NavTile icon={I.play} title="Run Scan" desc="Browser scan" accent="#10B981" onClick={() => onNav?.('runscan')} />
            <NavTile icon={I.code} title="Sandbox" desc="Terraform live" accent="#0094FF" onClick={() => onNav?.('sandbox')} />
          </div>
        </div>
      </section>

      {/* ── Bento body ───────────────────────────────────────────────────── */}
      <div className="x-bento">
        {/* Pillar health */}
        <section className="x-card x-card--pillars">
          <SectionTitle icon={I.shield}>{t('pages.dashboard.pillarHealth')}</SectionTitle>
          <div className="x-pillar-list">
            {pillarHealth.map(({ key, pillar, score, fails, total }) => {
              const c = PILLAR_COLOR[key] ?? '#888'
              const sc = scoreColor(score)
              const pct = total > 0 ? Math.round(((total - fails) / total) * 100) : 100
              return (
                <button type="button" key={pillar} className="x-pillar-row" onClick={() => onNav?.('findings')}>
                  <div className="x-pillar-slug" style={{ background: hex(c, 0.12), color: c }}>{PILLAR_META.find(p => p.key === key)?.slug}</div>
                  <div className="x-pillar-info">
                    <div className="x-pillar-name">{pillar}</div>
                    <div className="x-pillar-bar">
                      <div className="x-pillar-fill" style={{ width: `${pct}%`, background: sc }} />
                    </div>
                  </div>
                  <div className="x-pillar-score" style={{ color: sc }}>{score}</div>
                  <div className="x-pillar-status" style={{ color: fails > 0 ? '#DC2626' : '#059669' }}>
                    {fails > 0 ? t('pages.dashboard.failing', { count: fails }) : t('pages.dashboard.allPassing')}
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Severity donut + pillar chart */}
        {(severityCounts.length > 0 || pillarData.length > 0) && (
          <section className="x-card x-card--charts">
            <SectionTitle icon={I.warning}>Findings &amp; Pillar Scores</SectionTitle>
            <div className="x-chart-grid">
              {severityCounts.length > 0 && (
                <div className="x-donut">
                  <div className="x-donut-chart">
                    <div className="x-donut-inner">
                      <span className="x-donut-total">{allFails.length}</span>
                      <span className="x-donut-label">Failures</span>
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={severityCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={54} paddingAngle={3}>
                          {severityCounts.map(d => <Cell key={d.name} fill={SEVERITY_COLOR[d.name]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '0.78rem' }} itemStyle={{ color: 'var(--text)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="x-donut-legend">
                    {severityCounts.map(d => (
                      <div key={d.name} className="x-legend-item">
                        <span className="x-legend-dot" style={{ background: SEVERITY_COLOR[d.name] }} />
                        <span className="x-legend-name">{d.name}</span>
                        <span className="x-legend-val" style={{ color: SEVERITY_COLOR[d.name] }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pillarData.length > 0 && (
                <div className="x-barchart">
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={pillarData} layout="vertical" margin={{ left: 0, right: 24, top: 8, bottom: 8 }} barCategoryGap="20%">
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="pillar" width={80} tick={{ fontSize: 11, fill: 'var(--text)', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: 'var(--row-hover)' }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '0.78rem' }} itemStyle={{ color: 'var(--text)' }} />
                      <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={18} minPointSize={4}>
                        {pillarData.map(d => <Cell key={d.pillar} fill={scoreColor(d.score)} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Regulatory readiness */}
        {regulatoryTop.length > 0 && (
          <section className="x-card x-card--compliance">
            <SectionTitle
              icon={I.check}
              action={onNav && <ActionButton variant="ghost" onClick={() => onNav('compliance')}>{t('pages.dashboard.fullMatrix')} →</ActionButton>}
            >
              {t('pages.dashboard.regulatoryReadiness')}
              {regulatoryAll.length > 6 && <span className="x-section-count">top 6 of {regulatoryAll.length}</span>}
            </SectionTitle>
            <div className="x-compliance-list">
              {regulatoryTop.map(({ fw, pass, total, pct }) => {
                const color = pct >= 80 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#DC2626'
                const textColor = pct >= 80 ? '#059669' : pct >= 60 ? '#D97706' : '#DC2626'
                return (
                  <div key={fw} className="x-compliance-row">
                    <span className="x-compliance-name" title={fw}>{fw}</span>
                    <div className="x-compliance-track">
                      <div className="x-compliance-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="x-compliance-pct" style={{ color: textColor }}>{pct}%</span>
                    <span className="x-compliance-pass">{pass}/{total}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Debt heatmap */}
        {allFails.length > 0 && (
          <section className="x-card x-card--heatmap">
            <SectionTitle
              icon={<span style={{ color: '#DC2626' }}>{I.fire}</span>}
              action={
                <div className="x-heat-legend">
                  <span>Low</span>
                  {HEAT_STEPS.map(c => <div key={c} className="x-heat-swatch" style={{ background: c }} />)}
                  <span>High</span>
                </div>
              }
            >
              {t('pages.dashboard.debtHeatmap')}
            </SectionTitle>
            <div className="x-heat-scroll">
              <table className="x-heat-table">
                <thead>
                  <tr>
                    <th>{t('pages.dashboard.pillarHeader')}</th>
                    {SEVERITIES.map(s => <th key={s} style={{ color: SEVERITY_COLOR[s] }}>{s}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {PILLAR_META.map(({ key: pillar, label }) => (
                    <tr key={pillar}>
                      <td className="x-heat-pillar">{label}</td>
                      {SEVERITIES.map(s => {
                        const count = heatmapAll.find(c => c.pillar === pillar && c.severity === s)?.count ?? 0
                        const step = count === 0 ? -1 : Math.min(3, Math.floor((count / heatMax) * 4))
                        return (
                          <td key={s}>
                            <div className={`x-heat-cell ${count > 0 ? 'x-heat-cell--active' : ''}`} style={count > 0 ? { background: HEAT_STEPS[step], color: step >= 2 ? '#fff' : '#991b1b' } : undefined}>
                              {count === 0 ? '—' : count}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Quick wins */}
        {quickWins.length > 0 && (
          <section className="x-card x-card--wins">
            <SectionTitle
              icon={<span style={{ color: '#10B981' }}>{I.bolt}</span>}
              action={onNav && <ActionButton variant="primary" icon={I.bolt} onClick={() => onNav('autofix')}>{t('pages.dashboard.autoFix')}<span className="x-alpha">α</span></ActionButton>}
            >
              {t('pages.dashboard.quickWins')}
            </SectionTitle>
            <div className="x-win-list">
              {quickWins.map((f, i) => {
                const sev = f.severity?.toUpperCase() ?? ''
                const sevColor = SEVERITY_COLOR[sev] ?? '#94a3b8'
                const pColor = PILLAR_COLOR[f.pillar ?? ''] ?? '#888'
                return (
                  <button type="button" key={i} className="x-win-row" onClick={() => onNav?.('autofix')}>
                    <span className="x-win-idx">{i + 1}</span>
                    <SeverityBadge sev={sev} />
                    <span className="x-win-code">{f.control_id}</span>
                    <span className="x-win-title">{f.check_title || f.check_id}</span>
                    {f.pillar && <span className="x-pill" style={{ background: hex(pColor, 0.12), color: pColor }}>{f.pillar}</span>}
                    <span className="x-win-link" style={{ color: sevColor }}>Fix →</span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* Cloud footprint */}
        {detectedRegions.length > 0 && (
          <section className="x-card x-card--cloud">
            <SectionTitle
              icon={<span style={{ color: 'var(--waf-brand)' }}>{I.globe}</span>}
              action={onNav && <ActionButton variant="ghost" onClick={() => onNav('regions')}>{t('pages.dashboard.fullMap')} →</ActionButton>}
            >
              {t('pages.dashboard.cloudFootprint')}
            </SectionTitle>
            <div className="x-cloud">
              <div className="x-cloud-metric">
                <span className="x-cloud-number">{detectedRegions.length}</span>
                <span className="x-cloud-unit">{t('pages.dashboard.regionsSuffix')}</span>
              </div>
              <div className="x-cloud-providers">
                {Object.entries(providerCounts).map(([prov, cnt]) => (
                  <div key={prov} className="x-cloud-provider">
                    <span className="x-cloud-dot" style={{ background: PROVIDER_COLOR[prov] ?? '#888' }} />
                    <span className="x-cloud-name">{prov}</span>
                    <span className="x-cloud-cnt">{cnt} region{cnt > 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* ── Bottom check KPIs ───────────────────────────────────────────── */}
      {totalChecks > 0 && (
        <section className="x-checkbar">
          {[
            { label: t('pages.dashboard.checksRun'), value: totalChecks, sub: 'individual checks', color: 'var(--text)' },
            { label: t('pages.dashboard.checkPassRate'), value: `${passRate}%`, sub: `${passChecks}/${totalChecks} passed`, color: passRate >= 80 ? '#10B981' : passRate >= 60 ? '#D97706' : '#DC2626' },
            { label: t('pages.dashboard.resourcesScanned'), value: resources, sub: 'unique resources', color: 'var(--waf-brand)' },
            { label: t('pages.dashboard.resourcesFailing'), value: failResources, sub: 'with ≥1 failure', color: failResources > 0 ? '#DC2626' : '#10B981' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="x-checkcard" style={{ borderColor: hex(color, 0.18) }}>
              <div className="x-checkcard-value" style={{ color }}>{value}</div>
              <div className="x-checkcard-label">{label}</div>
              <div className="x-checkcard-sub">{sub}</div>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const dashboardCss = `
.x-root {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-bottom: 2.5rem;
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.6s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
}
.x-root--mounted {
  opacity: 1;
  transform: translateY(0);
}

/* Buttons */
.x-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.55rem 1rem;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  border: none;
  line-height: 1.3;
  white-space: nowrap;
}
.x-btn:active { transform: scale(0.97); }
.x-btn-icon { display: flex; flex-shrink: 0; }

.x-btn--primary {
  background: var(--waf-brand);
  color: #fff;
  box-shadow: 0 6px 20px rgba(0,148,255,0.35);
}
.x-btn--primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 28px rgba(0,148,255,0.45);
}

.x-btn--secondary {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}
.x-btn--secondary:hover { background: var(--bg); transform: translateY(-2px); }

.x-btn--ghost {
  background: transparent;
  color: var(--waf-brand);
  padding: 0.35rem 0.65rem;
}
.x-btn--ghost:hover { background: rgba(0,148,255,0.08); }

.x-alpha {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(249,115,22,0.15);
  color: #C2410C;
  font-size: 0.58rem;
  font-weight: 800;
  padding: 0.08rem 0.32rem;
  border-radius: 4px;
  margin-left: 0.2rem;
}

/* Cards */
.x-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.25s ease, transform 0.25s ease;
}
.x-card:hover { box-shadow: var(--shadow-md); }

.x-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
  flex-wrap: wrap;
  min-width: 0;
}
.x-section-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 1rem;
  font-weight: 800;
  color: var(--text);
  flex: 1;
  min-width: 0;
}
.x-section-icon { color: var(--waf-brand); display: flex; flex-shrink: 0; }
.x-section-count {
  font-size: 0.72rem;
  color: var(--muted);
  font-weight: 600;
  margin-left: 0.5rem;
}
.x-section-action { flex-shrink: 0; }

/* Masthead */
.x-masthead {
  position: relative;
  background: linear-gradient(135deg, var(--surface) 0%, rgba(0,148,255,0.04) 100%);
  border: 1px solid var(--border);
  border-radius: 28px;
  padding: 2rem;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}
.x-masthead-glow {
  position: absolute;
  top: -40%;
  right: -15%;
  width: 55%;
  height: 180%;
  background: radial-gradient(circle at 70% 30%, rgba(0,148,255,0.12), transparent 60%);
  pointer-events: none;
}
.x-masthead-inner {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2rem;
  align-items: center;
  min-width: 0;
}
.x-masthead-left { min-width: 0; }
.x-masthead-right {
  flex-shrink: 0;
  min-width: 0;
}

.x-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  background: rgba(0,148,255,0.10);
  color: var(--waf-brand);
  font-size: 0.68rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.9rem;
  width: max-content;
  max-width: 100%;
}
.x-title {
  font-size: 2.1rem;
  font-weight: 800;
  color: var(--text);
  line-height: 1.15;
  margin: 0 0 0.75rem;
  word-break: break-word;
}
.x-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}
.x-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  background: var(--bg);
  color: var(--text);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
  border: 1px solid transparent;
}
.x-chip--brand {
  background: rgba(0,148,255,0.10);
  color: var(--waf-brand);
  border-color: rgba(0,148,255,0.15);
}
.x-chip--muted {
  background: transparent;
  color: var(--muted);
  border-color: var(--border);
}
.x-actions {
  display: flex;
  gap: 0.65rem;
  flex-wrap: wrap;
}

/* Gauge */
.x-gauge {
  position: relative;
  flex-shrink: 0;
  filter: drop-shadow(0 12px 30px rgba(0,148,255,0.12));
}
.x-gauge-svg { position: absolute; inset: 0; }
.x-gauge-inner {
  position: absolute;
  inset: 20px;
  border-radius: 50%;
  background: var(--surface);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 2px 12px rgba(15,23,42,0.06);
}
.x-gauge-score { font-size: 2.1rem; font-weight: 800; line-height: 1; }
.x-gauge-over { font-size: 0.65rem; color: var(--muted); font-weight: 700; }
.x-gauge-label {
  font-size: 0.6rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-top: 0.25rem;
  max-width: 70%;
  text-align: center;
  line-height: 1.1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Statbar */
.x-statbar {
  position: relative;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
}
.x-statpill {
  border-radius: 18px;
  border: 1px solid;
  padding: 1rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  min-width: 0;
}
.x-statpill:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
.x-statpill-value { font-size: 1.6rem; font-weight: 800; line-height: 1; }
.x-statpill-label {
  font-size: 0.64rem;
  font-weight: 800;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-top: 0.4rem;
  line-height: 1.2;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.x-statpill-sub {
  font-size: 0.65rem;
  color: var(--muted);
  margin-top: 0.15rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Attention strip */
.x-attention {
  background: linear-gradient(180deg, rgba(220,38,38,0.06) 0%, var(--surface) 60%);
  border: 1px solid rgba(220,38,38,0.18);
  border-radius: 24px;
  padding: 1.25rem 1.5rem;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 1rem;
  align-items: flex-start;
}
.x-attention-left {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
}
.x-attention-icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 14px;
  background: rgba(220,38,38,0.12);
  color: #DC2626;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.x-attention-title { font-size: 1rem; font-weight: 800; color: var(--text); }
.x-attention-sub { font-size: 0.75rem; color: var(--muted); }
.x-attention-right {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.x-attention-list {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.x-attention-row {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0.9rem;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid rgba(220,38,38,0.10);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
  text-align: left;
  width: 100%;
  font: inherit;
  color: inherit;
  min-width: 0;
}
.x-attention-row:hover { border-color: rgba(220,38,38,0.30); background: rgba(220,38,38,0.02); }
.x-attention-code {
  font-family: ui-monospace, monospace;
  font-size: 0.72rem;
  color: var(--muted);
  flex-shrink: 0;
}
.x-attention-text {
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--text);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.x-attention-link {
  font-size: 0.72rem;
  color: var(--waf-brand);
  font-weight: 700;
  flex-shrink: 0;
}

/* Shared badge styles */
.x-sev {
  padding: 0.14rem 0.55rem;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 800;
  flex-shrink: 0;
  white-space: nowrap;
}
.x-pill {
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: capitalize;
  flex-shrink: 0;
  white-space: nowrap;
}

/* Navigation */
.x-card--nav { padding: 1.5rem; }
.x-nav-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1.25rem;
}
.x-nav-col { display: flex; flex-direction: column; gap: 0.55rem; min-width: 0; }
.x-nav-label {
  font-size: 0.68rem;
  font-weight: 800;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin-bottom: 0.35rem;
  padding-left: 0.2rem;
}
.x-navtile {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.8rem 0.9rem;
  border-radius: 16px;
  background: var(--bg);
  border: 1px solid var(--border);
  text-align: left;
  font: inherit;
  color: inherit;
  width: 100%;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease, background 0.18s ease;
  min-width: 0;
}
.x-navtile--click { cursor: pointer; }
.x-navtile--click:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  background: var(--surface);
  border-color: var(--waf-brand);
}
.x-navtile--click:active { transform: scale(0.99); }
.x-navtile-icon {
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.x-navtile-body { min-width: 0; flex: 1; overflow: hidden; }
.x-navtile-top {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.15rem;
  min-width: 0;
}
.x-navtile-title {
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--text);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.x-navtile-alert {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #DC2626;
  flex-shrink: 0;
}
.x-navtile-value {
  font-size: 0.78rem;
  font-weight: 800;
  flex-shrink: 0;
}
.x-navtile-desc {
  font-size: 0.7rem;
  color: var(--muted);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.x-navtile-arrow {
  color: var(--muted);
  opacity: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
  flex-shrink: 0;
}
.x-navtile--click:hover .x-navtile-arrow { opacity: 1; transform: translateX(2px); }

/* Bento layout */
.x-bento {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: minmax(160px, auto);
  gap: 1.25rem;
  align-items: start;
}
.x-bento > * { min-width: 0; min-height: 0; }
.x-card--pillars { grid-column: span 1; }
.x-card--charts { grid-column: span 2; }
.x-card--compliance { grid-column: span 2; }
.x-card--heatmap { grid-column: span 1; }
.x-card--wins { grid-column: span 2; }
.x-card--cloud { grid-column: span 1; }

/* Pillar list */
.x-pillar-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.x-pillar-row {
  display: grid;
  grid-template-columns: 2.5rem 1fr auto auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.75rem 0.85rem;
  border-radius: 16px;
  background: var(--bg);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
  text-align: left;
  font: inherit;
  color: inherit;
  min-width: 0;
}
.x-pillar-row:hover { transform: translateX(4px); box-shadow: var(--shadow-sm); }
.x-pillar-slug {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.68rem;
  font-weight: 800;
  flex-shrink: 0;
}
.x-pillar-info { min-width: 0; overflow: hidden; }
.x-pillar-name { font-size: 0.84rem; font-weight: 700; color: var(--text); margin-bottom: 0.35rem; }
.x-pillar-bar { height: 5px; border-radius: 999px; background: var(--track); overflow: hidden; }
.x-pillar-fill { height: 100%; border-radius: 999px; transition: width 0.5s ease; }
.x-pillar-score { font-size: 1.25rem; font-weight: 800; line-height: 1; padding: 0 0.25rem; }
.x-pillar-status { font-size: 0.68rem; font-weight: 600; text-align: right; }

/* Charts */
.x-chart-grid {
  display: grid;
  grid-template-columns: minmax(160px, 0.35fr) 1fr;
  gap: 1.5rem;
  align-items: start;
  min-height: 320px;
  min-width: 0;
}
.x-donut {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-width: 0;
  padding-top: 0.5rem;
}
.x-donut-chart {
  position: relative;
  width: 180px;
  height: 180px;
  flex-shrink: 0;
}
.x-donut-inner {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.x-donut-total { font-size: 1.8rem; font-weight: 800; color: var(--text); line-height: 1; }
.x-donut-label { font-size: 0.65rem; color: var(--muted); font-weight: 700; }
.x-donut-legend {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  min-width: 0;
  width: 100%;
  max-width: 160px;
}
.x-legend-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.72rem; min-width: 0; }
.x-legend-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
.x-legend-name { color: var(--muted); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.x-legend-val { font-weight: 800; flex-shrink: 0; }

.x-barchart { min-width: 0; height: 320px; }

/* Compliance */
.x-compliance-list {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}
.x-compliance-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 0.65rem;
  align-items: center;
  min-width: 0;
}
.x-compliance-name {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.x-compliance-track {
  height: 6px;
  border-radius: 999px;
  background: var(--track);
  overflow: hidden;
  grid-column: 1 / -1;
}
.x-compliance-fill { height: 100%; border-radius: 999px; transition: width 0.5s ease; }
.x-compliance-pct { font-size: 0.78rem; font-weight: 800; width: 2.4rem; text-align: right; }
.x-compliance-pass { font-size: 0.68rem; color: var(--muted); width: 3rem; text-align: right; }

/* Heatmap */
.x-heat-scroll { overflow-x: auto; }
.x-heat-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 0.35rem;
  font-size: 0.85rem;
}
.x-heat-table th {
  padding: 0.25rem 0.75rem;
  text-align: center;
  color: var(--muted);
  font-weight: 800;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.x-heat-table th:first-child { text-align: left; }
.x-heat-table td { padding: 0.25rem 0.75rem; text-align: center; }
.x-heat-pillar {
  font-weight: 700;
  color: var(--text);
  text-align: left;
  text-transform: capitalize;
}
.x-heat-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.4rem;
  height: 2rem;
  border-radius: 8px;
  font-weight: 800;
  font-size: 0.78rem;
  transition: transform 0.12s ease;
}
.x-heat-cell--active:hover { transform: scale(1.12); }
.x-heat-legend {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.65rem;
  color: var(--muted);
}
.x-heat-swatch { width: 0.85rem; height: 0.85rem; border-radius: 3px; }

/* Quick wins */
.x-win-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.x-win-row {
  display: grid;
  grid-template-columns: 1.6rem auto auto 1fr auto auto;
  gap: 0.55rem;
  align-items: center;
  padding: 0.7rem 0.85rem;
  border-radius: 14px;
  background: var(--bg);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: border-color 0.18s ease, transform 0.18s ease;
  text-align: left;
  font: inherit;
  color: inherit;
  min-width: 0;
}
.x-win-row:hover { border-color: var(--waf-brand); transform: translateX(4px); }
.x-win-idx {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 8px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.x-win-code {
  font-family: ui-monospace, monospace;
  font-size: 0.7rem;
  color: var(--muted);
  flex-shrink: 0;
}
.x-win-title {
  font-size: 0.83rem;
  font-weight: 600;
  color: var(--text);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.x-win-link { font-size: 0.72rem; font-weight: 700; flex-shrink: 0; }

/* Cloud */
.x-cloud {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.x-cloud-metric {
  display: inline-flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 1rem 1.25rem;
  border-radius: 18px;
  background: rgba(0,148,255,0.08);
  border: 1px solid rgba(0,148,255,0.15);
  width: max-content;
  max-width: 100%;
}
.x-cloud-number { font-size: 2.2rem; font-weight: 800; color: var(--waf-brand); line-height: 1; }
.x-cloud-unit { font-size: 0.85rem; color: var(--muted); font-weight: 600; }
.x-cloud-providers { display: flex; flex-wrap: wrap; gap: 0.55rem; }
.x-cloud-provider {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.8rem;
  border-radius: 999px;
  background: var(--bg);
  border: 1px solid var(--border);
  font-size: 0.75rem;
}
.x-cloud-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.x-cloud-name { font-weight: 800; color: var(--text); text-transform: uppercase; }
.x-cloud-cnt { color: var(--muted); }

/* Bottom check cards */
.x-checkbar {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}
.x-checkcard {
  background: var(--surface);
  border: 1px solid;
  border-radius: 20px;
  padding: 1.15rem 1.25rem;
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.x-checkcard:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
.x-checkcard-value { font-size: 1.85rem; font-weight: 800; line-height: 1; }
.x-checkcard-label { font-size: 0.72rem; font-weight: 700; color: var(--muted); margin-top: 0.3rem; }
.x-checkcard-sub { font-size: 0.68rem; color: var(--muted); margin-top: 0.15rem; }

/* Responsive */
@media (max-width: 1200px) {
  .x-bento { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .x-card--pillars { grid-column: span 1; grid-row: span 1; }
  .x-card--charts { grid-column: span 1; }
  .x-card--compliance { grid-column: span 1; }
  .x-card--heatmap { grid-column: span 1; grid-row: span 1; }
  .x-card--wins { grid-column: span 1; }
  .x-card--cloud { grid-column: span 1; }
  .x-chart-grid { grid-template-columns: 1fr; }
  .x-donut-legend { position: static; transform: none; flex-direction: row; flex-wrap: wrap; justify-content: center; margin-top: 0.5rem; }
}
@media (max-width: 960px) {
  .x-masthead-inner { grid-template-columns: 1fr; text-align: center; }
  .x-masthead-right { justify-content: center; }
  .x-badge { margin-left: auto; margin-right: auto; }
  .x-meta { justify-content: center; }
  .x-actions { justify-content: center; }
  .x-statbar { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .x-nav-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .x-attention { grid-template-columns: 1fr; }
  .x-attention-right { justify-content: flex-start; }
}
@media (max-width: 680px) {
  .x-masthead { padding: 1.25rem; }
  .x-title { font-size: 1.6rem; }
  .x-statbar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .x-nav-grid { grid-template-columns: 1fr; }
  .x-bento { grid-template-columns: 1fr; }
  .x-pillar-row { grid-template-columns: 2.2rem 1fr auto; }
  .x-pillar-status { display: none; }
  .x-compliance-row { grid-template-columns: 1fr auto; gap: 0.5rem 0.75rem; }
  .x-compliance-track { grid-column: 1 / -1; }
  .x-win-row { grid-template-columns: 1.5rem 1fr auto; gap: 0.45rem; }
  .x-win-code { display: none; }
  .x-win-title { grid-column: span 1; }
  .x-checkbar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .x-attention-right { flex-direction: column; width: 100%; }
  .x-attention-right .x-btn { width: 100%; }
}
@media (max-width: 420px) {
  .x-statbar { grid-template-columns: 1fr; }
  .x-checkbar { grid-template-columns: 1fr; }
}
`
