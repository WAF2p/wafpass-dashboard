import { useMemo, useState } from 'react'
import { RunDetail, ControlMeta } from '../api'
import { FRAMEWORKS } from '../controls-data'
import { useControlsCatalogue } from '../useControlsCatalogue'
import type { Settings } from './settingsUtils'
import { useI18n } from '../i18n'
import { useTheme } from '../theme'

// All 8 pillars including agentic
const PILLAR_META: { key: string; label: string; color: string; icon: () => JSX.Element }[] = [
  { key: 'security',       label: 'Security',       color: '#ff4d4d', icon: ShieldIcon },
  { key: 'cost',           label: 'Cost',           color: '#f97316', icon: CostIcon },
  { key: 'operations',     label: 'Operations',     color: '#a78bfa', icon: OpsIcon },
  { key: 'performance',    label: 'Performance',    color: '#facc15', icon: PerfIcon },
  { key: 'reliability',    label: 'Reliability',    color: '#22d3ee', icon: RelIcon },
  { key: 'sovereign',      label: 'Sovereignty',    color: '#2dd4bf', icon: SovIcon },
  { key: 'sustainability', label: 'Sustainability', color: '#4ade80', icon: SusIcon },
  { key: 'agentic',        label: 'Agentic',        color: '#f472b6', icon: AgenticIcon },
]

function normalizePillarName(p: string): string {
  if (p === 'operational') return 'operations'
  return p
}

interface Props { run: RunDetail; settings?: Settings }

function scoreColor(s: number, isDark = true) {
  if (isDark) return s >= 80 ? '#00ff9d' : s >= 60 ? '#fbbf24' : '#ff2a6d'
  return s >= 80 ? '#059669' : s >= 60 ? '#b45309' : '#dc2626'
}

function scoreGlow(s: number, isDark = true) {
  if (!isDark) return s >= 80 ? 'rgba(5,150,105,0.35)' : s >= 60 ? 'rgba(180,83,9,0.35)' : 'rgba(220,38,38,0.45)'
  return s >= 80 ? 'rgba(0,255,157,0.35)' : s >= 60 ? 'rgba(251,191,36,0.35)' : 'rgba(255,42,109,0.45)'
}

function statusColor(role: 'good' | 'warn' | 'bad' | 'info' | 'text' | 'muted', isDark = true) {
  const dark: Record<typeof role, string> = {
    good: '#00ff9d', warn: '#fbbf24', bad: '#ff2a6d', info: '#38bdf8',
    text: 'var(--text)', muted: 'var(--muted)',
  }
  const light: Record<typeof role, string> = {
    good: '#059669', warn: '#b45309', bad: '#dc2626', info: '#0284c7',
    text: 'var(--text)', muted: 'var(--muted)',
  }
  return isDark ? dark[role] : light[role]
}

// ─── Icons (inline SVG, no external deps) ─────────────────────────────────────

function IconWrapper({ children, size = 16 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

function ShieldIcon() { return <IconWrapper><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></IconWrapper> }
function CostIcon() { return <IconWrapper><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></IconWrapper> }
function OpsIcon() { return <IconWrapper><path d="M12 2a10 10 0 1 0 10 10H12V2z" /><path d="M21 12a9 9 0 0 0-9-9" /></IconWrapper> }
function PerfIcon() { return <IconWrapper><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></IconWrapper> }
function RelIcon() { return <IconWrapper><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="M12 6v6l4 2" /></IconWrapper> }
function SovIcon() { return <IconWrapper><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></IconWrapper> }
function SusIcon() { return <IconWrapper><path d="M12 22c4.97 0 9-4.03 9-9-4.5 0-9-4.5-9-9-4.5 4.5-9 9-9 9 0 4.97 4.03 9 9 9z" /></IconWrapper> }
function AgenticIcon() { return <IconWrapper><path d="M12 2a4 4 0 0 1 4 4c0 2.5-2 4-4 7-2-3-4-4.5-4-7a4 4 0 0 1 4-4z" /><circle cx="12" cy="15" r="3" /></IconWrapper> }
function SearchIcon() { return <IconWrapper><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></IconWrapper> }
function CheckIcon() { return <IconWrapper size={14}><polyline points="20 6 9 17 4 12" /></IconWrapper> }
function XIcon() { return <IconWrapper size={14}><path d="M18 6 6 18M6 6l12 12" /></IconWrapper> }
function MinusIcon() { return <IconWrapper size={14}><path d="M5 12h14" /></IconWrapper> }
function GlobeIcon() { return <IconWrapper><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></IconWrapper> }
function LockIcon() { return <IconWrapper><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></IconWrapper> }
function GridIcon() { return <IconWrapper><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></IconWrapper> }
function SignalIcon() { return <IconWrapper><path d="M2 20h.01" /><path d="M7 20v-4" /><path d="M12 20v-8" /><path d="M17 20V8" /><path d="M22 4v16" /></IconWrapper> }

// ─── Shared visual components ─────────────────────────────────────────────────

function CircularScore({ value, size = 96, stroke = 8, color, track = 'rgba(148,163,184,0.15)' }: { value: number; size?: number; stroke?: number; color: string; track?: string }) {
  const pct = Math.min(100, Math.max(0, value))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div className="scc-ring" style={{ width: size, height: size, filter: `drop-shadow(0 0 8px ${scoreGlow(value)})` }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={`sccGrad-${value}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#sccGrad-${value})`}
          strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div className="scc-ring__inner">
        <span className="scc-ring__value" style={{ color }}>{value}</span>
        <span className="scc-ring__unit">/100</span>
      </div>
    </div>
  )
}

function SegmentedTabs<T extends string>({ options, value, onChange }: { options: { key: T; label: string; icon?: () => JSX.Element }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="scc-tabs">
      {options.map(opt => {
        const active = value === opt.key
        const Icon = opt.icon
        return (
          <button
            key={opt.key}
            className={`scc-tab ${active ? 'scc-tab--active' : ''}`}
            onClick={() => onChange(opt.key)}
          >
            {Icon && <span className="scc-tab__icon"><Icon /></span>}
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function SectionCard({ title, subtitle, children, className = '', style = {} }: { title: string; subtitle?: string; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`scc-card ${className}`} style={style}>
      <div className="scc-card__header">
        <div className="scc-card__title">{title}</div>
        {subtitle && <div className="scc-card__subtitle">{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

function StatusBar({ score, passRate, isDark = true }: { score: number; passRate: number; isDark?: boolean }) {
  const armed = score >= 80
  const warning = score >= 60 && score < 80
  return (
    <div className="scc-statusbar" data-scc-theme={isDark ? 'dark' : 'light'}>
      <div className="scc-statusbar__line" />
      <div className={`scc-statusbar__badge ${armed ? 'scc-statusbar__badge--armed' : warning ? 'scc-statusbar__badge--warn' : 'scc-statusbar__badge--alert'}`}>
        <span className="scc-statusbar__pulse" />
        <span>{armed ? 'SYSTEM SECURE' : warning ? 'CONDITION YELLOW' : 'ALERT — ACTION REQUIRED'}</span>
      </div>
      <div className="scc-statusbar__readouts">
        <div className="scc-statusbar__readout">
          <span className="scc-statusbar__label">POSTURE</span>
          <span className="scc-statusbar__value" style={{ color: scoreColor(score, isDark) }}>{score}%</span>
        </div>
        <div className="scc-statusbar__readout">
          <span className="scc-statusbar__label">PASS RATE</span>
          <span className="scc-statusbar__value" style={{ color: scoreColor(passRate, isDark) }}>{passRate}%</span>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers reused inside render ─────────────────────────────────────────────

type SortKey = 'country' | 'name' | 'coverage_desc' | 'coverage_asc'

export default function CompliancePage({ run, settings }: Props) {
  const { t } = useI18n()
  const { themeName } = useTheme()
  const isDark = themeName === 'dark'
  const [tab, setTab] = useState<'pillars' | 'frameworks'>('pillars')
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
  const sevColor: Record<string, string> = {
    CRITICAL: isDark ? '#ff2a6d' : '#dc2626',
    HIGH: isDark ? '#fbbf24' : '#b45309',
    MEDIUM: isDark ? '#38bdf8' : '#0284c7',
    LOW: isDark ? '#00ff9d' : '#059669',
  }
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
    PASS: '#22c55e',
    FAIL: '#DA2C38',
    SKIP: isDark ? 'var(--muted)' : 'var(--muted)',
    UNKNOWN: isDark ? 'var(--muted)' : 'var(--muted)',
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
    <div className="scc-root" data-scc-theme={isDark ? 'dark' : 'light'}>
      <style>{securityCommandCenterCss}</style>

      {/* Hero — command center header */}
      <div className="scc-hero">
        <div className="scc-hero__scanlines" />
        <div className="scc-hero__content">
          <div className="scc-hero__badge">
            <SignalIcon /> SECURITY COMMAND CENTER
          </div>
          <h1 className="scc-hero__title">{t('compliance.pillarTab')} &amp; {t('compliance.frameworkTab')}</h1>
          <p className="scc-hero__subtitle">
            Live posture monitoring across {findings.length} checks and {FRAMEWORKS.length} regulatory frameworks.
          </p>
        </div>
        <div className="scc-hero__score">
          <CircularScore value={overallScore} size={150} stroke={10} color={scoreColor(overallScore, isDark)} track={isDark ? 'rgba(148,163,184,0.15)' : 'rgba(15,23,42,0.08)'} />
          <div className="scc-hero__score-label">
            <span className="scc-hero__score-value" style={{ color: scoreColor(overallScore, isDark) }}>{overallScore}</span>
            <span className="scc-hero__score-unit">SECURITY POSTURE</span>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <StatusBar score={overallScore} passRate={overallPassRate} isDark={isDark} />

      {/* KPI tiles */}
      <div className="scc-kpi-grid" data-scc-theme={isDark ? 'dark' : 'light'}>
        <div className="scc-kpi scc-kpi--pass">
          <div className="scc-kpi__label">PASSING CHECKS</div>
          <div className="scc-kpi__value" style={{ color: statusColor('good', isDark) }}>{overallPassRate}%</div>
        </div>
        <div className="scc-kpi scc-kpi--fail">
          <div className="scc-kpi__label">FAILED CHECKS</div>
          <div className="scc-kpi__value" style={{ color: overallFailCount > 0 ? statusColor('bad', isDark) : statusColor('muted', isDark) }}>{overallFailCount}</div>
        </div>
        <div className="scc-kpi scc-kpi--crit">
          <div className="scc-kpi__label">CRITICAL FINDINGS</div>
          <div className="scc-kpi__value" style={{ color: overallCritCount > 0 ? statusColor('bad', isDark) : statusColor('muted', isDark) }}>{overallCritCount}</div>
        </div>
        <div className="scc-kpi scc-kpi--frameworks">
          <div className="scc-kpi__label">FRAMEWORKS TRACKED</div>
          <div className="scc-kpi__value" style={{ color: statusColor('info', isDark) }}>{FRAMEWORKS.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <SegmentedTabs
        options={[
          { key: 'pillars',    label: t('compliance.pillarTab'),    icon: GridIcon },
          { key: 'frameworks', label: t('compliance.frameworkTab'), icon: GlobeIcon },
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* ── Pillar tab ──────────────────────────────────────────────────────── */}
      {tab === 'pillars' && (
        <div className="scc-pillar-view">
          {pillars.length === 0 ? (
            <SectionCard title={t('compliance.pillarTab')}>
              <div className="scc-empty">{t('compliance.noPillarData')}</div>
            </SectionCard>
          ) : (
            <>
              <div className="scc-pillar-grid" data-scc-theme={isDark ? 'dark' : 'light'}>
                {pillarStats.map(s => (
                  <div key={s.key} className="scc-pillar-card" style={{ '--pillar-color': s.color } as React.CSSProperties}>
                    <div className="scc-pillar-card__top">
                      <div className="scc-pillar-card__icon" style={{ color: s.color }}>
                        <s.icon />
                      </div>
                      <div className="scc-pillar-card__ring">
                        <CircularScore value={s.score} size={84} stroke={7} color={scoreColor(s.score, isDark)} track={isDark ? 'rgba(148,163,184,0.15)' : 'rgba(15,23,42,0.08)'} />
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
                      <span style={{ width: `${s.passRate}%`, background: scoreColor(s.passRate, isDark) }} />
                    </div>
                  </div>
                ))}
              </div>

              <SectionCard title={t('compliance.failingFindings')} subtitle="Severity heatmap across pillars">
                <div className="scc-heatmap" data-scc-theme={isDark ? 'dark' : 'light'}>
                  {pillarStats.map(s => (
                    <div key={s.key} className="scc-heatmap__row">
                      <div className="scc-heatmap__pillar">
                        <span className="scc-heatmap__dot" style={{ background: s.color, boxShadow: `0 0 10px ${s.color}` }} />
                        <span style={{ textTransform: 'capitalize' }}>{s.pillar}</span>
                      </div>
                      <div className="scc-heatmap__passrate">
                        <span className="scc-heatmap__bar-bg">
                          <span className="scc-heatmap__bar-fg" style={{ width: `${s.passRate}%`, background: scoreColor(s.passRate, isDark), boxShadow: `0 0 8px ${scoreGlow(s.passRate, isDark)}` }} />
                        </span>
                        <span className="scc-heatmap__pct" style={{ color: scoreColor(s.passRate, isDark) }}>{s.passRate}%</span>
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
                              style={{ '--sev-color': sevColor[sev] } as React.CSSProperties}
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
          <div className="scc-filter-bar" data-scc-theme={isDark ? 'dark' : 'light'}>
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
              <div className="scc-empty">{t('compliance.noMatch')}</div>
            </SectionCard>
          ) : (
            <div className="scc-framework-grid" data-scc-theme={isDark ? 'dark' : 'light'}>
              {frameworkStats.sorted.map(({ fw, mappedControls, passCount, failCount, passRate }) => {
                const active = passRate !== null
                const color = active ? scoreColor(passRate, isDark) : (isDark ? 'var(--muted)' : 'var(--muted)')
                const mapped = mappedControls.length
                return (
                  <div key={fw.id} className="scc-framework-card" style={{ '--fw-color': color } as React.CSSProperties}>
                    <div className="scc-framework-card__header">
                      <div className="scc-framework-card__flag">{fw.flag}</div>
                      <div className="scc-framework-card__meta">
                        <div className="scc-framework-card__title">{fw.label}</div>
                        <div className="scc-framework-card__desc">{fw.desc}</div>
                        <span className="scc-framework-card__country">{fw.country}</span>
                      </div>
                      {active ? (
                        <div className="scc-framework-card__ring">
                          <CircularScore value={passRate} size={72} stroke={6} color={color} track={isDark ? 'rgba(148,163,184,0.15)' : 'rgba(15,23,42,0.08)'} />
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
                            <span style={{ width: `${passRate}%`, background: color, boxShadow: `0 0 10px ${scoreGlow(passRate, isDark)}` }} />
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
.scc-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  background:
    radial-gradient(circle at 20% 50%, rgba(0,148,255,0.12) 0%, transparent 40%),
    radial-gradient(circle at 80% 20%, rgba(255,42,109,0.08) 0%, transparent 35%),
    linear-gradient(135deg, var(--surface) 0%, var(--bg) 100%);
  border: 1px solid rgba(56,189,248,0.25);
  border-radius: 20px;
  padding: 1.5rem 1.75rem;
  box-shadow: 0 0 40px rgba(0,148,255,0.10), inset 0 1px 0 rgba(255,255,255,0.06);
  flex-wrap: wrap;
  position: relative;
  overflow: hidden;
}
.scc-hero__scanlines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 3px,
    rgba(0,0,0,0.12) 4px
  );
  pointer-events: none;
  opacity: 0.35;
}
.scc-hero__content {
  flex: 1;
  min-width: 0;
  position: relative;
  z-index: 1;
}
.scc-hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255,42,109,0.15);
  border: 1px solid rgba(255,42,109,0.35);
  border-radius: 4px;
  padding: 0.35rem 0.75rem;
  font-size: 0.65rem;
  font-weight: 800;
  color: #ff2a6d;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 0.85rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  box-shadow: 0 0 12px rgba(255,42,109,0.20);
}
.scc-hero__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text);
  line-height: 1.15;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.scc-hero__subtitle {
  margin: 0.45rem 0 0;
  font-size: 0.82rem;
  color: var(--muted);
  max-width: 520px;
}
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
  font-size: 0.62rem;
  color: var(--muted);
  font-weight: 700;
  letter-spacing: 0.08em;
}
[data-scc-theme="light"] .scc-hero {
  background:
    radial-gradient(circle at 20% 50%, rgba(0,148,255,0.08) 0%, transparent 40%),
    radial-gradient(circle at 80% 20%, rgba(220,38,38,0.05) 0%, transparent 35%),
    linear-gradient(135deg, rgba(241,245,249,0.95) 0%, rgba(255,255,255,0.98) 100%);
  border: 1px solid rgba(0,148,255,0.22);
  box-shadow: 0 0 40px rgba(0,148,255,0.08), inset 0 1px 0 rgba(255,255,255,0.6);
}
[data-scc-theme="light"] .scc-hero__badge {
  background: rgba(220,38,38,0.08);
  border: 1px solid rgba(220,38,38,0.25);
  color: #dc2626;
  box-shadow: 0 0 12px rgba(220,38,38,0.12);
}
[data-scc-theme="light"] .scc-hero__title {
  color: var(--text);
}
[data-scc-theme="light"] .scc-hero__subtitle {
  color: var(--muted);
}
[data-scc-theme="light"] .scc-hero__score-unit {
  color: var(--muted);
}

/* Score ring */
.scc-ring {
  position: relative;
}
.scc-ring__inner {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.scc-ring__value {
  font-size: 1.4rem;
  font-weight: 800;
  line-height: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.scc-ring__unit {
  font-size: 0.55rem;
  color: var(--muted);
  font-weight: 700;
  letter-spacing: 0.06em;
}
[data-scc-theme="light"] .scc-ring__unit {
  color: var(--muted);
}

/* Status bar */
.scc-statusbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  background: var(--bg);
  border: 1px solid rgba(56,189,248,0.18);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  flex-wrap: wrap;
  backdrop-filter: blur(8px);
}
.scc-statusbar__line {
  flex: 1;
  height: 2px;
  background: linear-gradient(90deg, rgba(56,189,248,0.6), transparent);
  min-width: 60px;
}
.scc-statusbar__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.75rem;
  border-radius: 4px;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.scc-statusbar__badge--armed {
  background: rgba(0,255,157,0.12);
  border: 1px solid rgba(0,255,157,0.35);
  color: #00ff9d;
}
.scc-statusbar__badge--warn {
  background: rgba(251,191,36,0.12);
  border: 1px solid rgba(251,191,36,0.35);
  color: #fbbf24;
}
.scc-statusbar__badge--alert {
  background: rgba(255,42,109,0.15);
  border: 1px solid rgba(255,42,109,0.4);
  color: #ff2a6d;
  animation: sccPulseAlert 1.8s infinite;
}
@keyframes sccPulseAlert {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,42,109,0.35); }
  50% { box-shadow: 0 0 12px 3px rgba(255,42,109,0.15); }
}
.scc-statusbar__pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 8px currentColor;
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
  font-size: 0.58rem;
  color: var(--muted);
  font-weight: 700;
  letter-spacing: 0.1em;
}
.scc-statusbar__value {
  font-size: 0.95rem;
  font-weight: 800;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
[data-scc-theme="light"] .scc-statusbar {
  background: rgba(255,255,255,0.7);
  border: 1px solid rgba(0,148,255,0.18);
}
[data-scc-theme="light"] .scc-statusbar__badge--armed {
  background: rgba(34,197,94,0.1);
  border: 1px solid rgba(34,197,94,0.3);
  color: #059669;
}
[data-scc-theme="light"] .scc-statusbar__badge--warn {
  background: rgba(234,179,8,0.1);
  border: 1px solid rgba(234,179,8,0.3);
  color: #b45309;
}
[data-scc-theme="light"] .scc-statusbar__badge--alert {
  background: rgba(220,38,38,0.1);
  border: 1px solid rgba(220,38,38,0.3);
  color: #dc2626;
}
[data-scc-theme="light"] .scc-statusbar__label {
  color: var(--muted);
}

/* KPI grid */
.scc-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}
.scc-kpi {
  background: var(--surface);
  border: 1px solid rgba(56,189,248,0.15);
  border-radius: 14px;
  padding: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  position: relative;
  overflow: hidden;
  transition: transform 0.2s ease, border-color 0.2s ease;
}
.scc-kpi:hover {
  transform: translateY(-2px);
  border-color: rgba(56,189,248,0.35);
}
.scc-kpi::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
}
.scc-kpi--pass::before { background: #00ff9d; box-shadow: 0 0 12px #00ff9d; }
.scc-kpi--fail::before { background: #ff2a6d; box-shadow: 0 0 12px #ff2a6d; }
.scc-kpi--crit::before { background: #ff2a6d; box-shadow: 0 0 12px #ff2a6d; }
.scc-kpi--frameworks::before { background: #38bdf8; box-shadow: 0 0 12px #38bdf8; }
.scc-kpi__label {
  font-size: 0.6rem;
  color: var(--muted);
  font-weight: 700;
  letter-spacing: 0.1em;
}
.scc-kpi__value {
  font-size: 1.7rem;
  font-weight: 800;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  line-height: 1;
}
[data-scc-theme="light"] .scc-kpi {
  background: rgba(255,255,255,0.85);
  border: 1px solid rgba(0,148,255,0.18);
  box-shadow: 0 2px 12px rgba(15,23,42,0.06);
}
[data-scc-theme="light"] .scc-kpi:hover {
  border-color: rgba(0,148,255,0.35);
}
[data-scc-theme="light"] .scc-kpi--pass::before { background: #059669; box-shadow: 0 0 12px rgba(5,150,105,0.45); }
[data-scc-theme="light"] .scc-kpi--fail::before { background: #dc2626; box-shadow: 0 0 12px rgba(220,38,38,0.45); }
[data-scc-theme="light"] .scc-kpi--crit::before { background: #dc2626; box-shadow: 0 0 12px rgba(220,38,38,0.45); }
[data-scc-theme="light"] .scc-kpi--frameworks::before { background: #0284c7; box-shadow: 0 0 12px rgba(2,132,199,0.45); }
[data-scc-theme="light"] .scc-kpi__label {
  color: var(--muted);
}

/* Tabs */
.scc-tabs {
  display: inline-flex;
  background: var(--surface-el);
  border: 1px solid rgba(56,189,248,0.18);
  border-radius: 10px;
  padding: 0.3rem;
  gap: 0.25rem;
  align-self: flex-start;
  backdrop-filter: blur(8px);
}
.scc-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1.1rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}
.scc-tab:hover {
  color: var(--text);
  background: rgba(56,189,248,0.08);
}
.scc-tab--active {
  background: rgba(56,189,248,0.18);
  color: #38bdf8;
  box-shadow: 0 0 16px rgba(56,189,248,0.20);
}
.scc-tab--active:hover {
  background: rgba(56,189,248,0.22);
  color: #38bdf8;
}
.scc-tab__icon {
  opacity: 0.85;
}
[data-scc-theme="light"] .scc-tabs {
  background: rgba(241,245,249,0.85);
  border: 1px solid rgba(0,148,255,0.18);
}
[data-scc-theme="light"] .scc-tab {
  color: var(--muted);
}
[data-scc-theme="light"] .scc-tab:hover {
  color: var(--text);
  background: rgba(0,148,255,0.08);
}
[data-scc-theme="light"] .scc-tab--active {
  background: rgba(0,148,255,0.15);
  color: #0284c7;
  box-shadow: 0 0 16px rgba(0,148,255,0.15);
}
[data-scc-theme="light"] .scc-tab--active:hover {
  background: rgba(0,148,255,0.2);
  color: #0284c7;
}

/* Cards */
.scc-card {
  background: var(--surface);
  border: 1px solid rgba(56,189,248,0.12);
  border-radius: 16px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 24px rgba(0,0,0,0.25);
}
.scc-card__header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.scc-card__title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.scc-card__subtitle {
  font-size: 0.72rem;
  color: var(--muted);
}

.scc-empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--muted);
  font-size: 0.85rem;
}
[data-scc-theme="light"] .scc-card {
  background: rgba(255,255,255,0.85);
  border: 1px solid rgba(0,148,255,0.18);
  box-shadow: 0 2px 12px rgba(15,23,42,0.06);
}
[data-scc-theme="light"] .scc-card__title {
  color: var(--text);
}
[data-scc-theme="light"] .scc-card__subtitle {
  color: var(--muted);
}
[data-scc-theme="light"] .scc-empty {
  color: var(--muted);
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
  border: 1px solid rgba(56,189,248,0.12);
  border-top: 2px solid var(--pillar-color);
  border-radius: 14px;
  padding: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  backdrop-filter: blur(6px);
}
[data-scc-theme="light"] .scc-pillar-card {
  background: rgba(255,255,255,0.85);
  border: 1px solid rgba(0,148,255,0.18);
  box-shadow: 0 2px 12px rgba(15,23,42,0.06);
}
.scc-pillar-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 0 24px rgba(56,189,248,0.08);
  border-color: var(--pillar-color);
}
[data-scc-theme="light"] .scc-pillar-card:hover {
  box-shadow: 0 8px 24px rgba(15,23,42,0.12), 0 0 16px rgba(0,148,255,0.10);
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
  border: 1px solid rgba(148,163,184,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 12px var(--pillar-color, transparent);
}
[data-scc-theme="light"] .scc-pillar-card__icon {
  background: rgba(241,245,249,0.8);
  border: 1px solid rgba(15,23,42,0.1);
}
.scc-pillar-card__name {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text);
  text-transform: capitalize;
  letter-spacing: 0.02em;
}
[data-scc-theme="light"] .scc-pillar-card__name {
  color: var(--text);
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
  font-size: 0.62rem;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.scc-pill--pass { background: rgba(0,255,157,0.12); color: #00ff9d; border: 1px solid rgba(0,255,157,0.25); }
.scc-pill--fail { background: rgba(255,42,109,0.12); color: #ff2a6d; border: 1px solid rgba(255,42,109,0.25); }
.scc-pill--waived { background: rgba(167,139,250,0.12); color: #a78bfa; border: 1px solid rgba(167,139,250,0.25); }
.scc-pill--total { background: var(--bg); color: var(--muted); border: 1px solid rgba(148,163,184,0.15); margin-left: auto; }
[data-scc-theme="light"] .scc-pill--pass { background: rgba(34,197,94,0.12); color: #059669; border: 1px solid rgba(34,197,94,0.3); }
[data-scc-theme="light"] .scc-pill--fail { background: rgba(220,38,38,0.1); color: #dc2626; border: 1px solid rgba(220,38,38,0.25); }
[data-scc-theme="light"] .scc-pill--waived { background: rgba(139,92,246,0.1); color: #7c3aed; border: 1px solid rgba(139,92,246,0.25); }
[data-scc-theme="light"] .scc-pill--total { background: rgba(241,245,249,0.8); color: var(--muted); border: 1px solid rgba(15,23,42,0.1); }
.scc-pillar-card__bar {
  height: 4px;
  background: rgba(148,163,184,0.12);
  border-radius: 999px;
  overflow: hidden;
}
[data-scc-theme="light"] .scc-pillar-card__bar {
  background: rgba(15,23,42,0.08);
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
  border: 1px solid rgba(56,189,248,0.08);
  transition: background 0.15s ease, border-color 0.15s ease;
}
[data-scc-theme="light"] .scc-heatmap__row {
  background: rgba(241,245,249,0.6);
  border: 1px solid rgba(0,148,255,0.1);
}
.scc-heatmap__row:hover {
  background: rgba(56,189,248,0.05);
  border-color: rgba(56,189,248,0.2);
}
[data-scc-theme="light"] .scc-heatmap__row:hover {
  background: rgba(0,148,255,0.05);
  border-color: rgba(0,148,255,0.22);
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
[data-scc-theme="light"] .scc-heatmap__pillar {
  color: var(--text);
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
  background: rgba(148,163,184,0.12);
  border-radius: 999px;
  overflow: hidden;
}
[data-scc-theme="light"] .scc-heatmap__bar-bg {
  background: rgba(15,23,42,0.08);
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
  border: 1px solid rgba(148,163,184,0.12);
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
[data-scc-theme="light"] .scc-sev-chip {
  background: rgba(241,245,249,0.8);
  border: 1px solid rgba(15,23,42,0.08);
  color: var(--muted);
}
.scc-sev-chip--active {
  background: color-mix(in srgb, var(--sev-color) 14%, transparent);
  border-color: color-mix(in srgb, var(--sev-color) 45%, transparent);
  color: var(--sev-color);
  box-shadow: 0 0 10px color-mix(in srgb, var(--sev-color) 25%, transparent);
}
[data-scc-theme="light"] .scc-sev-chip--active {
  background: color-mix(in srgb, var(--sev-color) 10%, transparent);
  border-color: color-mix(in srgb, var(--sev-color) 40%, transparent);
  box-shadow: 0 0 8px color-mix(in srgb, var(--sev-color) 15%, transparent);
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
[data-scc-theme="light"] .scc-heatmap__total {
  color: var(--muted);
}

/* Frameworks tab */
.scc-framework-view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.scc-filter-bar {
  background: var(--surface);
  border: 1px solid rgba(56,189,248,0.12);
  border-radius: 16px;
  padding: 1rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  backdrop-filter: blur(8px);
}
[data-scc-theme="light"] .scc-filter-bar {
  background: rgba(255,255,255,0.85);
  border: 1px solid rgba(0,148,255,0.18);
  box-shadow: 0 2px 12px rgba(15,23,42,0.06);
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
  border: 1px solid rgba(56,189,248,0.18);
  background: var(--bg);
  color: #38bdf8;
  min-width: 0;
}
[data-scc-theme="light"] .scc-search {
  background: rgba(241,245,249,0.8);
  border: 1px solid rgba(0,148,255,0.18);
  color: #0284c7;
}
[data-scc-theme="light"] .scc-search input {
  color: var(--text);
}
[data-scc-theme="light"] .scc-search input::placeholder {
  color: var(--muted);
}
.scc-search input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 0.82rem;
  outline: none;
  min-width: 0;
}
.scc-search input::placeholder {
  color: var(--muted);
}
.scc-select {
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  border: 1px solid rgba(56,189,248,0.18);
  background: var(--bg);
  color: var(--text);
  font-size: 0.82rem;
  cursor: pointer;
  outline: none;
}
[data-scc-theme="light"] .scc-select {
  background: rgba(241,245,249,0.8);
  border: 1px solid rgba(0,148,255,0.18);
  color: var(--text);
}
.scc-filter-actions {
  display: flex;
  gap: 0.4rem;
}
.scc-btn-ghost {
  padding: 0.45rem 0.75rem;
  border-radius: 8px;
  border: 1px solid rgba(56,189,248,0.18);
  background: var(--bg);
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}
[data-scc-theme="light"] .scc-btn-ghost {
  background: rgba(241,245,249,0.8);
  border: 1px solid rgba(0,148,255,0.18);
  color: var(--muted);
}
[data-scc-theme="light"] .scc-btn-ghost:hover {
  color: var(--text);
  border-color: rgba(0,148,255,0.4);
  background: rgba(0,148,255,0.08);
}
.scc-btn-ghost:hover {
  color: var(--text);
  border-color: rgba(56,189,248,0.4);
  background: rgba(56,189,248,0.08);
}
.scc-country-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.scc-country-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  border: 1px solid rgba(56,189,248,0.12);
  background: var(--bg);
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
[data-scc-theme="light"] .scc-country-chip {
  background: rgba(241,245,249,0.8);
  border: 1px solid rgba(0,148,255,0.15);
  color: var(--muted);
}
.scc-country-chip:hover {
  border-color: rgba(56,189,248,0.3);
  color: var(--text);
}
[data-scc-theme="light"] .scc-country-chip:hover {
  border-color: rgba(0,148,255,0.3);
  color: var(--text);
}
.scc-country-chip--active {
  border-color: rgba(56,189,248,0.45);
  background: rgba(56,189,248,0.12);
  color: #38bdf8;
  box-shadow: 0 0 12px rgba(56,189,248,0.12);
}
[data-scc-theme="light"] .scc-country-chip--active {
  border-color: rgba(0,148,255,0.45);
  background: rgba(0,148,255,0.12);
  color: #0284c7;
  box-shadow: 0 0 12px rgba(0,148,255,0.12);
}
.scc-country-chip__flag {
  font-size: 1rem;
  line-height: 1;
}
.scc-country-chip__check {
  display: inline-flex;
  color: #38bdf8;
}

.scc-framework-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}
.scc-framework-card {
  background: var(--surface);
  border: 1px solid rgba(56,189,248,0.12);
  border-left: 3px solid var(--fw-color);
  border-radius: 14px;
  padding: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
  backdrop-filter: blur(6px);
}
[data-scc-theme="light"] .scc-framework-card {
  background: rgba(255,255,255,0.85);
  border: 1px solid rgba(0,148,255,0.18);
  box-shadow: 0 2px 12px rgba(15,23,42,0.06);
}
.scc-framework-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.35), 0 0 24px color-mix(in srgb, var(--fw-color) 12%, transparent);
  border-color: var(--fw-color);
}
[data-scc-theme="light"] .scc-framework-card:hover {
  box-shadow: 0 8px 24px rgba(15,23,42,0.12), 0 0 16px color-mix(in srgb, var(--fw-color) 10%, transparent);
}
.scc-framework-card__header {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
}
.scc-framework-card__flag {
  font-size: 1.6rem;
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
[data-scc-theme="light"] .scc-framework-card__title {
  color: var(--text);
}
.scc-framework-card__desc {
  font-size: 0.7rem;
  color: var(--muted);
}
[data-scc-theme="light"] .scc-framework-card__desc {
  color: var(--muted);
}
.scc-framework-card__country {
  display: inline-flex;
  align-self: flex-start;
  padding: 0.12rem 0.45rem;
  border-radius: 4px;
  background: var(--bg);
  border: 1px solid rgba(148,163,184,0.12);
  color: var(--muted);
  font-size: 0.58rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-top: 0.25rem;
}
[data-scc-theme="light"] .scc-framework-card__country {
  background: rgba(241,245,249,0.8);
  border: 1px solid rgba(15,23,42,0.1);
  color: var(--muted);
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
  font-size: 0.58rem;
  font-weight: 700;
}
.scc-framework-card__progress {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.scc-framework-card__progress-bar {
  height: 5px;
  background: rgba(148,163,184,0.12);
  border-radius: 999px;
  overflow: hidden;
}
[data-scc-theme="light"] .scc-framework-card__progress-bar {
  background: rgba(15,23,42,0.08);
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
  font-size: 0.65rem;
}
.scc-fw-stat {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.scc-fw-stat--pass { color: #00ff9d; }
.scc-fw-stat--fail { color: #ff2a6d; }
.scc-fw-stat--total { color: var(--muted); margin-left: auto; }
[data-scc-theme="light"] .scc-fw-stat--pass { color: #059669; }
[data-scc-theme="light"] .scc-fw-stat--fail { color: #dc2626; }
[data-scc-theme="light"] .scc-fw-stat--total { color: var(--muted); }
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
  font-size: 0.68rem;
  min-width: 0;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.scc-control-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 0 12px color-mix(in srgb, var(--ctrl-color) 20%, transparent);
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
  font-size: 0.58rem;
  color: var(--muted);
}
.scc-control-chip__status {
  font-size: 0.55rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.scc-control-chip--more {
  align-self: center;
  background: var(--bg);
  border-color: rgba(148,163,184,0.12);
  color: var(--muted);
  font-weight: 700;
}
[data-scc-theme="light"] .scc-control-chip {
  background: rgba(241,245,249,0.85);
}
[data-scc-theme="light"] .scc-control-chip__id {
  color: var(--text);
}
[data-scc-theme="light"] .scc-control-chip__mapping {
  color: var(--muted);
}
[data-scc-theme="light"] .scc-control-chip--more {
  background: rgba(241,245,249,0.8);
  border-color: rgba(15,23,42,0.1);
  color: var(--muted);
}
.scc-framework-card__hint {
  font-size: 0.72rem;
  color: var(--muted);
  font-style: italic;
  padding: 0.5rem;
  background: var(--bg);
  border-radius: 8px;
}
[data-scc-theme="light"] .scc-framework-card__unmapped {
  color: var(--muted);
}
[data-scc-theme="light"] .scc-framework-card__hint {
  color: var(--muted);
  background: rgba(241,245,249,0.8);
}

@media (max-width: 900px) {
  .scc-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .scc-heatmap__row {
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .scc-heatmap__sevs { grid-column: 1 / -1; }
  .scc-heatmap__total { display: none; }
}

@media (max-width: 640px) {
  .scc-hero { flex-direction: column; align-items: flex-start; }
  .scc-hero__score { align-self: center; }
  .scc-statusbar { flex-direction: column; align-items: flex-start; }
  .scc-statusbar__readouts { width: 100%; justify-content: space-between; }
  .scc-tabs { align-self: stretch; }
  .scc-tab { flex: 1; justify-content: center; }
  .scc-pillar-grid { grid-template-columns: 1fr; }
  .scc-framework-grid { grid-template-columns: 1fr; }
  .scc-filter-bar__top > * { flex: 1 1 100%; }
}
`
