import { useState, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Settings {
  // Scan
  defaultIac: string
  failOn: string
  defaultSeverity: string
  activePillars: string[]
  // Intelligence
  secretScanner: boolean
  autoFix: boolean
  blastRadius: boolean
  driftDetection: boolean
  complianceGating: boolean
  riskScoring: boolean
  dependencyGraph: boolean
  // Observability
  carbonTracking: boolean
  evidenceCollection: boolean
  multiCloudNormalization: boolean
  // UX
  pdfAutoOpen: boolean
}

export interface MaturityState {
  level: number
  settings: Settings
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_PILLARS = ['security', 'cost', 'operations', 'reliability', 'performance', 'sovereign', 'sustainability']

// Controls per pillar and severity (derived from ./pass/controls/)
const PILLAR_COUNTS: Record<string, number> = {
  security: 13, cost: 10, operations: 10, reliability: 10,
  performance: 10, sovereign: 10, sustainability: 10,
}
const SEV_COUNTS = { critical: 8, high: 34, medium: 28, low: 3 }
const TOTAL_CONTROLS = 73

function controlsForLevel(level: number): number {
  const sevThresholds: Record<number, string[]> = {
    1: ['critical'],
    2: ['critical', 'high'],
    3: ['critical', 'high', 'medium'],
    4: ['critical', 'high', 'medium', 'low'],
    5: ['critical', 'high', 'medium', 'low'],
  }
  const pillarsForLevel: Record<number, string[]> = {
    1: ['security'],
    2: ['security', 'cost'],
    3: ['security', 'cost', 'operations', 'reliability'],
    4: ALL_PILLARS.filter(p => p !== 'sustainability'),
    5: ALL_PILLARS,
  }
  const sevs = new Set(sevThresholds[level] ?? [])
  // Approximate: total controls × fraction of severities × fraction of pillars
  const sevFraction = Object.entries(SEV_COUNTS)
    .filter(([s]) => sevs.has(s))
    .reduce((n, [, c]) => n + c, 0) / TOTAL_CONTROLS
  const pillarCount = pillarsForLevel[level].reduce((n, p) => n + PILLAR_COUNTS[p], 0)
  return Math.round(pillarCount * sevFraction)
}

const DEFAULT_SETTINGS: Settings = {
  defaultIac: 'terraform',
  failOn: 'fail',
  defaultSeverity: '',
  activePillars: ALL_PILLARS,
  secretScanner: true,
  autoFix: true,
  blastRadius: true,
  driftDetection: false,
  complianceGating: false,
  riskScoring: false,
  dependencyGraph: false,
  carbonTracking: false,
  evidenceCollection: false,
  multiCloudNormalization: false,
  pdfAutoOpen: false,
}

const MATURITY_PRESETS: Record<number, Partial<Settings>> = {
  1: {
    secretScanner: false, autoFix: false, blastRadius: false,
    driftDetection: false, complianceGating: false, riskScoring: false,
    dependencyGraph: false, carbonTracking: false, evidenceCollection: false,
    multiCloudNormalization: false,
    failOn: 'fail', defaultSeverity: 'critical',
    activePillars: ['security'],
  },
  2: {
    secretScanner: true, autoFix: false, blastRadius: true,
    driftDetection: false, complianceGating: false, riskScoring: false,
    dependencyGraph: false, carbonTracking: false, evidenceCollection: false,
    multiCloudNormalization: false,
    failOn: 'fail', defaultSeverity: 'high',
    activePillars: ['security', 'cost'],
  },
  3: {
    secretScanner: true, autoFix: true, blastRadius: true,
    driftDetection: true, complianceGating: true, riskScoring: true,
    dependencyGraph: false, carbonTracking: false, evidenceCollection: false,
    multiCloudNormalization: false,
    failOn: 'fail', defaultSeverity: 'medium',
    activePillars: ['security', 'cost', 'operations', 'reliability'],
  },
  4: {
    secretScanner: true, autoFix: true, blastRadius: true,
    driftDetection: true, complianceGating: true, riskScoring: true,
    dependencyGraph: true, carbonTracking: false, evidenceCollection: true,
    multiCloudNormalization: true,
    failOn: 'skip', defaultSeverity: '',
    activePillars: ALL_PILLARS.filter(p => p !== 'sustainability'),
  },
  5: {
    secretScanner: true, autoFix: true, blastRadius: true,
    driftDetection: true, complianceGating: true, riskScoring: true,
    dependencyGraph: true, carbonTracking: true, evidenceCollection: true,
    multiCloudNormalization: true,
    failOn: 'skip', defaultSeverity: '',
    activePillars: ALL_PILLARS,
  },
}

export const MATURITY_META = [
  {
    level: 1, label: 'L1 · Foundational', short: 'Foundational',
    color: '#d97706', textColor: '#fbbf24', bg: 'rgba(217,119,6,',
    desc: 'Critical-only security checks. No automation.',
    tagline: 'First scan · quick health check · zero noise',
    newAt: 'Critical security controls, minimal configuration',
  },
  {
    level: 2, label: 'L2 · Operational', short: 'Operational',
    color: '#0094FF', textColor: '#60a5fa', bg: 'rgba(0,148,255,',
    desc: 'Security + cost compliance, high+ severity, secret scanning.',
    tagline: 'Regular security ops · cost governance · team awareness',
    newAt: 'Secret scanner, blast radius, cost pillar, high-severity controls',
  },
  {
    level: 3, label: 'L3 · Governed', short: 'Governed',
    color: '#0891b2', textColor: '#22d3ee', bg: 'rgba(8,145,178,',
    desc: 'Multi-pillar, CI gating, auto-fix, risk scoring.',
    tagline: 'Mature engineering · CI/CD enforcement · remediation',
    newAt: 'Auto-fix, compliance gating, risk scoring, ops & reliability pillars',
  },
  {
    level: 4, label: 'L4 · Optimized', short: 'Optimized',
    color: '#7c3aed', textColor: '#c4b5fd', bg: 'rgba(124,58,237,',
    desc: 'All controls, drift detection, dependency graphs, evidence.',
    tagline: 'Platform teams · full control inventory · audit-ready',
    newAt: 'Drift detection, dependency graph, evidence collection, multi-cloud, all non-sustainability pillars',
  },
  {
    level: 5, label: 'L5 · Excellence', short: 'Excellence',
    color: '#059669', textColor: '#34d399', bg: 'rgba(5,150,105,',
    desc: 'All 73 controls · carbon tracking · continuous compliance.',
    tagline: 'Cloud CoE · regulated industries · full intelligence',
    newAt: 'Carbon tracking, sustainability pillar — full multi-cloud intelligence stack',
  },
]

// ─── Persistence ──────────────────────────────────────────────────────────────

export function loadMaturityState(): MaturityState {
  const settings = { ...DEFAULT_SETTINGS }
  const level = 1
  try {
    const s = localStorage.getItem('wafpass_settings')
    if (s) Object.assign(settings, JSON.parse(s))
  } catch {}
  try {
    const m = localStorage.getItem('wafpass_maturity')
    if (m) return { level: parseInt(m) || 1, settings }
  } catch {}
  return { level, settings }
}

export function saveMaturityState(level: number, settings: Settings) {
  try {
    localStorage.setItem('wafpass_settings', JSON.stringify(settings))
    localStorage.setItem('wafpass_maturity', String(level))
  } catch {}
}

export function getMaturityMeta(level: number) {
  return MATURITY_META.find(m => m.level === level) ?? MATURITY_META[0]
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: '40px', height: '22px', borderRadius: '999px', border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        background: checked ? 'var(--waf-brand)' : '#cbd5e1',
        transition: 'background 0.2s', position: 'relative', flexShrink: 0,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: '3px', left: checked ? '21px' : '3px',
        width: '16px', height: '16px', borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
      }} />
    </button>
  )
}

function ProgressBar({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = Math.min(100, Math.round((value / total) * 100))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <div style={{ flex: 1, height: '6px', borderRadius: '999px', background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '999px', transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, color, minWidth: '3.5rem', textAlign: 'right' }}>
        {value} / {total}
      </span>
    </div>
  )
}

const PILLAR_ICONS: Record<string, string> = {
  security: '🔒', cost: '💰', operations: '⚙️', reliability: '🔁',
  performance: '⚡', sovereign: '🏛️', sustainability: '🌱',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  maturityLevel: number
  settings: Settings
  onChange: (level: number, settings: Settings) => void
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage({ maturityLevel, settings, onChange }: Props) {
  const [level, setLevel] = useState(maturityLevel)
  const [s, setS] = useState<Settings>(settings)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setLevel(maturityLevel); setS(settings) }, [maturityLevel, settings])

  function applyMaturity(l: number) {
    setLevel(l)
    setS(prev => ({ ...prev, ...MATURITY_PRESETS[l] }))
  }

  function save() {
    saveMaturityState(level, s)
    onChange(level, s)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const meta = getMaturityMeta(level)
  const controlCount = controlsForLevel(level)

  const selectStyle: React.CSSProperties = {
    background: '#fff', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.82rem', outline: 'none',
    width: '100%',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.72rem', fontWeight: 600,
    color: 'var(--muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em',
  }

  function togglePillar(pillar: string) {
    const current = s.activePillars ?? ALL_PILLARS
    const next = current.includes(pillar)
      ? current.filter(p => p !== pillar)
      : [...current, pillar]
    setS({ ...s, activePillars: next })
  }

  // ── Feature toggle rows ────────────────────────────────────────────────────

  const intelligenceToggles: Array<[keyof Settings, string, string, string]> = [
    ['secretScanner',         'Secret Scanner',           'Detect secrets & credentials embedded in IaC code', 'security'],
    ['blastRadius',           'Blast Radius Analysis',    'Map the propagation radius of critical failures across resources', 'security'],
    ['autoFix',               'Auto-Fix Suggestions',     'Suggest safe automated remediations for common violations', 'operations'],
    ['driftDetection',        'Drift Detection',          'Compare plan against state to surface configuration drift', 'operations'],
    ['complianceGating',      'Compliance Gating',        'Block CI/CD pipeline when controls fail at configured severity', 'governance'],
    ['riskScoring',           'Risk Scoring',             'Compute weighted risk scores per resource based on control failures', 'governance'],
    ['dependencyGraph',       'Dependency Graph',         'Visualise resource dependencies and propagation paths', 'visibility'],
    ['evidenceCollection',    'Evidence Collection',      'Auto-collect compliance evidence artefacts for audit trails', 'governance'],
    ['multiCloudNormalization','Multi-Cloud Normalization','Normalise findings across AWS, Azure, GCP, and other providers', 'visibility'],
    ['carbonTracking',        'Carbon Tracking',          'Estimate CO₂ footprint and surface high-emission resource patterns', 'sustainability'],
    ['pdfAutoOpen',           'Auto-open PDF Report',     'Open generated PDF report in browser immediately after creation', 'ux'],
  ]

  // Group toggles by category for display
  const toggleGroups: Record<string, typeof intelligenceToggles> = {}
  for (const t of intelligenceToggles) {
    const cat = t[3]
    if (!toggleGroups[cat]) toggleGroups[cat] = []
    toggleGroups[cat].push(t)
  }

  const categoryLabels: Record<string, string> = {
    security: 'Security Intelligence',
    operations: 'Operational Automation',
    governance: 'Governance & Compliance',
    visibility: 'Visibility & Insights',
    sustainability: 'Sustainability',
    ux: 'Interface',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>

      {/* ── Maturity Level ─────────────────────────────────────────────────── */}
      <div className="card">
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
          Maturity Level
        </h2>

        {/* 5-level selector grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {MATURITY_META.map(m => {
            const active = level === m.level
            return (
              <button
                key={m.level}
                onClick={() => applyMaturity(m.level)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  gap: '0.5rem', padding: '0.9rem 1rem',
                  borderRadius: '12px', border: `2px solid ${active ? m.color : 'var(--border)'}`,
                  background: active ? `${m.bg}0.08)` : 'var(--bg)',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: `${m.bg}0.18)`, border: `2px solid ${m.color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.72rem', fontWeight: 800, color: m.textColor, flexShrink: 0,
                  }}>
                    L{m.level}
                  </div>
                  {active && (
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: m.textColor, background: `${m.bg}0.15)`, padding: '0.1rem 0.4rem', borderRadius: '999px', border: `1px solid ${m.color}55` }}>
                      Active
                    </span>
                  )}
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: active ? m.textColor : 'var(--text)', lineHeight: 1.2 }}>
                  {m.short}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.45 }}>
                  {m.desc}
                </div>
              </button>
            )
          })}
        </div>

        {/* Impact panel for selected level */}
        <div style={{
          padding: '1rem 1.25rem', borderRadius: '10px',
          background: `${meta.bg}0.06)`, border: `1px solid ${meta.color}44`,
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem',
        }}>
          {/* Left: tagline + control count */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Active at this level
            </div>
            <div style={{ fontSize: '0.8rem', color: meta.textColor, fontWeight: 600, lineHeight: 1.4 }}>
              {meta.tagline}
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '0.35rem' }}>Control coverage</div>
              <ProgressBar value={controlCount} total={TOTAL_CONTROLS} color={meta.color} />
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
              Severity threshold:{' '}
              <span style={{ fontWeight: 700, color: meta.textColor }}>
                {level === 1 ? 'Critical only' : level === 2 ? 'High+' : level === 3 ? 'Medium+' : 'All'}
              </span>
            </div>
          </div>

          {/* Middle: pillars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Pillars covered
            </div>
            {ALL_PILLARS.map(p => {
              const preset = MATURITY_PRESETS[level] as Settings
              const active = (preset.activePillars ?? []).includes(p)
              return (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem' }}>
                  <span style={{ fontSize: '0.8rem' }}>{active ? '✓' : '○'}</span>
                  <span style={{ color: active ? 'var(--text)' : 'var(--muted)', fontWeight: active ? 600 : 400 }}>
                    {PILLAR_ICONS[p]} {p.charAt(0).toUpperCase() + p.slice(1)}
                  </span>
                  {active && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--muted)', marginLeft: 'auto' }}>
                      {PILLAR_COUNTS[p]}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Right: what's new at this level */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {level === 1 ? 'Starting point' : `Added vs L${level - 1}`}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--muted)', lineHeight: 1.55 }}>
              {meta.newAt}
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Intelligence active
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {intelligenceToggles
                .filter(([key]) => (MATURITY_PRESETS[level] as Settings)[key as keyof Settings] === true)
                .map(([key, label]) => (
                  <span key={key} style={{
                    padding: '0.1rem 0.45rem', borderRadius: '999px', fontSize: '0.64rem', fontWeight: 600,
                    background: `${meta.bg}0.15)`, color: meta.textColor,
                    border: `1px solid ${meta.color}44`,
                  }}>{label}</span>
                ))
              }
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-column layout: Scan Config + Pillar Coverage ───────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

        {/* Scan Configuration */}
        <div className="card">
          <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1.1rem' }}>
            Scan Configuration
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Default IaC Framework</label>
              <select value={s.defaultIac} onChange={e => setS({ ...s, defaultIac: e.target.value })} style={selectStyle}>
                <option value="terraform">Terraform</option>
                <option value="cdk">AWS CDK</option>
                <option value="pulumi">Pulumi</option>
                <option value="bicep">Bicep</option>
                <option value="cfn">CloudFormation</option>
              </select>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.25rem' }}>Used when --iac is not specified on CLI</div>
            </div>
            <div>
              <label style={labelStyle}>Fail-On Behaviour</label>
              <select value={s.failOn} onChange={e => setS({ ...s, failOn: e.target.value })} style={selectStyle}>
                <option value="fail">Exit non-zero on FAIL findings</option>
                <option value="skip">Exit non-zero on FAIL + SKIP findings</option>
                <option value="never">Never fail (report only)</option>
              </select>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.25rem' }}>Controls CI/CD exit code — affects pipeline gating</div>
            </div>
            <div>
              <label style={labelStyle}>Minimum Severity</label>
              <select value={s.defaultSeverity} onChange={e => setS({ ...s, defaultSeverity: e.target.value })} style={selectStyle}>
                <option value="">All severities (73 controls)</option>
                <option value="critical">Critical only (~8 controls)</option>
                <option value="high">High+ (~42 controls)</option>
                <option value="medium">Medium+ (~70 controls)</option>
              </select>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.25rem' }}>Only controls at or above this severity are evaluated</div>
            </div>
          </div>
        </div>

        {/* Pillar Coverage */}
        <div className="card">
          <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1.1rem' }}>
            Pillar Coverage
          </h2>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.9rem', lineHeight: 1.55 }}>
            Choose which WAF++ control pillars are evaluated in every scan. Disabling a pillar reduces scan time and noise for teams not yet responsible for that domain.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {ALL_PILLARS.map(p => {
              const active = (s.activePillars ?? ALL_PILLARS).includes(p)
              return (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Toggle checked={active} onChange={() => togglePillar(p)} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.83rem', color: 'var(--text)' }}>
                      {PILLAR_ICONS[p]} {p.charAt(0).toUpperCase() + p.slice(1)}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginLeft: '0.5rem' }}>
                      {PILLAR_COUNTS[p]} controls
                    </span>
                  </div>
                  {!active && (
                    <span style={{ fontSize: '0.65rem', color: '#dc2626', fontWeight: 600 }}>off</span>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--muted)', padding: '0.45rem 0.6rem', background: 'var(--bg)', borderRadius: '6px', border: '1px solid var(--border)' }}>
            Active:{' '}
            <strong style={{ color: 'var(--text)' }}>
              {(s.activePillars ?? ALL_PILLARS).reduce((n, p) => n + (PILLAR_COUNTS[p] ?? 0), 0)}
            </strong>
            {' '}/ {TOTAL_CONTROLS} controls across{' '}
            <strong style={{ color: 'var(--text)' }}>{(s.activePillars ?? ALL_PILLARS).length}</strong>
            {' '}/ {ALL_PILLARS.length} pillars
          </div>
        </div>
      </div>

      {/* ── Intelligence & Feature Toggles ─────────────────────────────────── */}
      <div className="card">
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
          Intelligence & Features
        </h2>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '1.1rem', lineHeight: 1.55 }}>
          Fine-tune the intelligence capabilities beyond the maturity preset. Enabling a feature here overrides the preset without changing your maturity level.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 2rem' }}>
          {Object.entries(categoryLabels).map(([cat, catLabel]) => {
            const rows = toggleGroups[cat]
            if (!rows?.length) return null
            return (
              <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem', paddingBottom: '0.35rem', borderBottom: '1px solid var(--border)' }}>
                  {catLabel}
                </div>
                {rows.map(([key, label, desc]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text)' }}>{label}</div>
                      <div style={{ fontSize: '0.71rem', color: 'var(--muted)', lineHeight: 1.45, marginTop: '0.1rem' }}>{desc}</div>
                    </div>
                    <Toggle
                      checked={s[key as keyof Settings] as boolean}
                      onChange={v => setS({ ...s, [key]: v })}
                    />
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Save ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1rem' }}>
        <button
          onClick={save}
          style={{
            background: 'var(--waf-brand)', color: '#fff', border: 'none', borderRadius: '8px',
            padding: '0.6rem 1.75rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
          }}
        >
          Save Settings
        </button>
        <button
          onClick={() => applyMaturity(level)}
          style={{
            background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '0.6rem 1.25rem', fontSize: '0.82rem', fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Reset to L{level} preset
        </button>
        {saved && <span style={{ fontSize: '0.8rem', color: '#22c55e', fontWeight: 600 }}>Saved!</span>}
      </div>

    </div>
  )
}
