import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts'
import { fetchProjectPassports, ProjectPassport, RunSummary } from '../api'
import { useI18n } from '../i18n'
import { Page, scoreColor } from '../routing'
import { MATURITY_META } from './settingsUtils'
import flightMapBg from '/flight-map-bg.png'

// ── Pillar metadata ───────────────────────────────────────────────────────────
const PILLAR_META: { key: string; label: string; color: string; icon: () => JSX.Element }[] = [
  { key: 'security', label: 'Security', color: '#DA2C38', icon: ShieldIcon },
  { key: 'cost', label: 'Cost', color: '#0094FF', icon: CostIcon },
  { key: 'operations', label: 'Operations', color: '#8b5cf6', icon: OpsIcon },
  { key: 'performance', label: 'Performance', color: '#f97316', icon: PerfIcon },
  { key: 'reliability', label: 'Reliability', color: '#22c55e', icon: RelIcon },
  { key: 'sovereign', label: 'Sovereignty', color: '#eab308', icon: SovIcon },
  { key: 'sustainability', label: 'Sustainability', color: '#14b8a6', icon: SusIcon },
  { key: 'agentic', label: 'Agentic', color: '#ec4899', icon: AgenticIcon },
]

// ── Flight stage metadata ─────────────────────────────────────────────────────
const STAGE_META: { label: string; range: string; description: string; color: string; min: number; max: number; icon: () => JSX.Element }[] = [
  { label: 'Hangar', range: '0-19', description: 'Preparation', color: '#ef4444', min: 0, max: 19, icon: HangarIcon },
  { label: 'Pre-Flight', range: '20-39', description: 'Safety & checks', color: '#f97316', min: 20, max: 39, icon: PreflightIcon },
  { label: 'Boarding', range: '40-59', description: 'Passengers boarding', color: '#eab308', min: 40, max: 59, icon: BoardingIcon },
  { label: 'Takeoff', range: '60-74', description: 'Rotation & takeoff', color: '#0094FF', min: 60, max: 74, icon: TakeoffIcon },
  { label: 'Cruise', range: '75-89', description: 'In-flight cruising', color: '#8b5cf6', min: 75, max: 89, icon: CruiseIcon },
  { label: 'Landing', range: '90-100', description: 'Descent & landing', color: '#059669', min: 90, max: 100, icon: LandingIcon },
]

const MATURITY_THRESHOLDS: Record<number, number> = { 1: 0, 2: 40, 3: 60, 4: 75, 5: 90 }

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizePillarName(pillar: string): string {
  if (pillar === 'operational') return 'operations'
  return pillar
}

function getMaturityForScore(score: number) {
  return [...MATURITY_META].reverse().find(m => score >= MATURITY_THRESHOLDS[m.level]) ?? MATURITY_META[0]
}

function getBestRunForProject(project: string, runs: RunSummary[]): RunSummary | null {
  const pRuns = runs.filter(r => (r.project || '(unnamed)') === project)
  if (pRuns.length === 0) return null
  return pRuns.reduce((latest, r) => (new Date(r.created_at) > new Date(latest.created_at) ? r : latest))
}

function getRotatedIndex<T>(items: T[], daysOffset = 0): number {
  if (items.length === 0) return 0
  const date = new Date()
  date.setDate(date.getDate() + daysOffset)
  const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  let hash = 0
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) % 100000
  }
  return hash % items.length
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })
}

function formatDateTime(iso: string | undefined): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Icons (inline SVG, no external dependencies) ────────────────────────────────
function IconWrapper({ children, size = 16 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

function ScanIcon() { return <IconWrapper><path d="M13 10V3L4 14h7v7l9-11h-7z" /></IconWrapper> }
function PassportIcon() { return <IconWrapper><path d="M4 4h16v16H4z" /><path d="M9 9h6v6H9z" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3" /></IconWrapper> }
function RunHistoryIcon() { return <IconWrapper><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></IconWrapper> }
function TrendUpIcon() { return <IconWrapper><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><path d="M17 6h6v6" /></IconWrapper> }
function ProjectsIcon() { return <IconWrapper><path d="M3 21h18" /><path d="M5 21V7l8-4 8 4v14" /></IconWrapper> }
function CalendarIcon() { return <IconWrapper><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></IconWrapper> }
function ScoreIcon() { return <IconWrapper><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></IconWrapper> }
function ShieldIcon() { return <IconWrapper><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></IconWrapper> }
function CostIcon() { return <IconWrapper><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></IconWrapper> }
function OpsIcon() { return <IconWrapper><path d="M12 2a10 10 0 1 0 10 10H12V2z" /><path d="M21 12a9 9 0 0 0-9-9" /></IconWrapper> }
function PerfIcon() { return <IconWrapper><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></IconWrapper> }
function RelIcon() { return <IconWrapper><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" /><path d="M12 6v6l4 2" /></IconWrapper> }
function SovIcon() { return <IconWrapper><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></IconWrapper> }
function SusIcon() { return <IconWrapper><path d="M12 22c4.97 0 9-4.03 9-9-4.5 0-9-4.5-9-9-4.5 4.5-9 9-9 9 0 4.97 4.03 9 9 9z" /></IconWrapper> }
function AgenticIcon() { return <IconWrapper><path d="M12 2a4 4 0 0 1 4 4c0 2.5-2 4-4 7-2-3-4-4.5-4-7a4 4 0 0 1 4-4z" /><circle cx="12" cy="15" r="3" /></IconWrapper> }
function HangarIcon() { return <IconWrapper><path d="M3 21h18M4 21V10l8-6 8 6v11" /></IconWrapper> }
function PreflightIcon() { return <IconWrapper><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></IconWrapper> }
function BoardingIcon() { return <IconWrapper><path d="M2 20h20" /><path d="M6 20V8l6-4 6 4v12" /></IconWrapper> }
function TakeoffIcon() { return <IconWrapper><path d="M2 12h20" /><path d="m6 12 6-6 6 6" /></IconWrapper> }
function CruiseIcon() { return <IconWrapper><path d="M2 12h20" /><path d="m14 12-4-4M14 12l-4 4" /></IconWrapper> }
function LandingIcon() { return <IconWrapper><path d="M2 20h20" /><path d="m6 20 6-8 6 8" /></IconWrapper> }
function StarIcon() { return <IconWrapper><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></IconWrapper> }
function TrophyIcon() { return <IconWrapper><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2z" /></IconWrapper> }
function ActivityIcon() { return <IconWrapper><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></IconWrapper> }
function EmptyStateIcon() { return <IconWrapper size={48}><path d="M12 2a10 10 0 1 0 10 10H12V2z" /><path d="M12 12 2.1 9.8" /></IconWrapper> }
function ErrorIcon() { return <IconWrapper size={48}><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" /></IconWrapper> }


// ── Score ring component ──────────────────────────────────────────────────────
function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
  const color = scoreColor(score)
  const pct = Math.min(100, Math.max(0, score))
  return (
    <div
      className="score-ring-wrap"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `conic-gradient(${color} ${pct}%, var(--track) ${pct}%)`,
        padding: 10,
        boxShadow: `0 12px 40px ${color}25`,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: '2.75rem', fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600, letterSpacing: '0.05em' }}>OF 100</span>
      </div>
    </div>
  )
}

// ── KPI tile ──────────────────────────────────────────────────────────────────
function KpiTile({
  label,
  value,
  subtext,
  icon,
  color = 'var(--waf-brand)',
  onClick,
}: {
  label: string
  value: string | number
  subtext?: string
  icon: React.ReactNode
  color?: string
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="gd-tile"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '18px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {label}
        </span>
        <div style={{ color, opacity: 0.85 }}>{icon}</div>
      </div>
      <div>
        <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
        {subtext && <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.25rem' }}>{subtext}</div>}
      </div>
    </div>
  )
}

// ── Section card ───────────────────────────────────────────────────────────────
function SectionCard({
  title,
  subtitle,
  children,
  className = '',
  style = {},
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={`gd-card ${className}`}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '20px',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        ...style,
      }}
    >
      <div>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.2rem' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

// ── Maturity distribution chart ───────────────────────────────────────────────
function MaturityChart({ data }: { data: { label: string; count: number; color: string }[] }) {
  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 40, bottom: 8 }}>
          <XAxis type="number" hide domain={[0, 'auto']} />
          <YAxis
            dataKey="label"
            type="category"
            width={36}
            tick={{ fontSize: 12, fill: 'var(--muted)', fontWeight: 700 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--row-hover)' }}
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              boxShadow: 'var(--shadow-md)',
              fontSize: '0.78rem',
            }}
            itemStyle={{ color: 'var(--text)' }}
            formatter={(value: number) => [`${value} projects`, 'Count']}
          />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={20}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Pillar radar chart ──────────────────────────────────────────────────────────
function PillarRadar({ data }: { data: { pillar: string; score: number; color: string }[] }) {
  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="68%" data={data}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis
            dataKey="pillar"
            tick={{ fontSize: 10, fill: 'var(--muted)', fontWeight: 600 }}
          />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name="Pillar Score"
            dataKey="score"
            stroke="var(--waf-brand)"
            strokeWidth={2}
            fill="var(--waf-brand)"
            fillOpacity={0.25}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              boxShadow: 'var(--shadow-md)',
              fontSize: '0.78rem',
            }}
            itemStyle={{ color: 'var(--text)' }}
            formatter={(value: number, name: string, props?: { payload?: { pillar?: string } }) => [value, props?.payload?.pillar ?? name]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Flight timeline ─────────────────────────────────────────────────────────────
function FlightTimeline({ runs, passports }: { runs: RunSummary[]; passports: ProjectPassport[] }) {
  const stageDistribution = useMemo(() => {
    const dist = [0, 0, 0, 0, 0, 0]
    const projects = passports.length > 0 ? passports : null
    const bestScores = new Map<string, number>()

    if (projects) {
      projects.forEach(passport => {
        const projectRuns = runs.filter(r => (r.project || '(unnamed)') === passport.project)
        if (projectRuns.length > 0) {
          const bestScore = projectRuns.reduce((m, r) => Math.max(m, r.score), 0)
          bestScores.set(passport.project, bestScore)
        }
      })
    } else {
      runs.forEach(run => {
        const project = run.project || '(unnamed)'
        const existing = bestScores.get(project)
        if (!existing || run.score > existing) bestScores.set(project, run.score)
      })
    }

    bestScores.forEach(score => {
      const stage = score >= 90 ? 5 : score >= 75 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : score >= 20 ? 1 : 0
      dist[stage]++
    })
    return dist
  }, [runs, passports])

  const totalProjects = stageDistribution.reduce((a, b) => a + b, 0)

  const stagePositions = [
    { x: 120, y: 202 },
    { x: 265, y: 184 },
    { x: 400, y: 158 },
    { x: 520, y: 124 },
    { x: 650, y: 86 },
    { x: 870, y: 184 },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="gd-flight-wrap gd-flight-wrap--real" style={{ backgroundImage: `url(${flightMapBg})` }}>
        <svg width="100%" height="100%" viewBox="0 0 1000 260" preserveAspectRatio="xMidYMid slice" style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id="gdSkyFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.18" />
              <stop offset="50%" stopColor="#fff" stopOpacity="0" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.06" />
            </linearGradient>
            <radialGradient id="gdMarkerHalo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0094FF" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#0094FF" stopOpacity="0" />
            </radialGradient>
            <filter id="gdMarkerDrop" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0f172a" floodOpacity="0.22" />
            </filter>
            <filter id="gdLabelShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#fff" floodOpacity="0.9" />
            </filter>
          </defs>

          {/* Light top/bottom fade to keep markers readable */}
          <rect x="0" y="0" width="1000" height="260" fill="url(#gdSkyFade)" />

          {/* Flight arc path - solid for active/reached, dashed beyond */}
          <path
            d="M 120 202 C 220 202 300 190 400 158 C 470 136 500 124 520 124 C 565 124 610 100 650 86"
            fill="none"
            stroke="#0094FF"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.85"
          />
          <path
            d="M 650 86 C 710 66 780 86 870 184"
            fill="none"
            stroke="#0094FF"
            strokeWidth="2"
            strokeDasharray="6 5"
            strokeLinecap="round"
            opacity="0.6"
          />

          {/* Stage markers with labels */}
          {STAGE_META.map((stage, idx) => {
            const pos = stagePositions[idx]
            const count = stageDistribution[idx]
            const active = totalProjects > 0 && count > 0
            const iconSize = 16
            return (
              <g key={idx} transform={`translate(${pos.x}, ${pos.y})`} filter="url(#gdMarkerDrop)">
                {/* Label above */}
                <text
                  x="0"
                  y={-28}
                  textAnchor="middle"
                  fontSize="8"
                  fontWeight="800"
                  fill="#1e3a8a"
                  letterSpacing="0.06em"
                  filter="url(#gdLabelShadow)"
                >
                  {stage.label.toUpperCase()}
                </text>
                {/* Range label */}
                <text
                  x="0"
                  y={-18}
                  textAnchor="middle"
                  fontSize="7"
                  fontWeight="700"
                  fill={active ? '#0094FF' : '#64748b'}
                  filter="url(#gdLabelShadow)"
                >
                  {stage.range}
                </text>
                {/* Outer halo */}
                <circle r="20" fill="url(#gdMarkerHalo)" opacity={active ? 0.9 : 0.35} />
                {/* Marker circle */}
                <circle r="16" fill={active ? '#0094FF' : '#fff'} stroke="#0094FF" strokeWidth="1.5" />
                {/* Icon */}
                <g transform={`translate(-${iconSize / 2}, -${iconSize / 2})`} style={{ color: active ? '#fff' : '#1e3a8a' }}>
                  <stage.icon />
                </g>
                {/* Count badge */}
                {active && (
                  <g transform="translate(12, -12)">
                    <circle r="9" fill="#0094FF" stroke="#fff" strokeWidth="1.5" />
                    <text x="0" y="1" textAnchor="middle" dominantBaseline="middle" fontSize="8" fontWeight="800" fill="#fff">
                      {count}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <div className="gd-flight-stages">
        {STAGE_META.map((stage, idx) => {
          const count = stageDistribution[idx]
          const active = totalProjects > 0 && count > 0
          return (
            <div
              key={idx}
              className="gd-flight-stage"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.85rem',
                padding: '0.85rem 1rem',
                borderRadius: '14px',
                background: '#fff',
                border: `1px solid ${active ? '#0094FF' : '#e2e8f0'}`,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: active ? 'rgba(0,148,255,0.12)' : '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: active ? '#0094FF' : '#1e3a8a',
                  flexShrink: 0,
                }}
              >
                <stage.icon />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stage.label}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>{stage.description}</div>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.35rem', fontWeight: 600 }}>{stage.range} min</div>
              </div>
              {active && (
                <div
                  style={{
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    color: '#0094FF',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    background: 'rgba(0,148,255,0.10)',
                  }}
                >
                  {count}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Recent activity feed ──────────────────────────────────────────────────────
function RecentActivity({ runs }: { runs: RunSummary[] }) {
  const { t } = useI18n()
  const activities = useMemo(() => {
    const projectLastScan = new Map<string, RunSummary>()
    runs.forEach(run => {
      const existing = projectLastScan.get(run.project)
      if (!existing || new Date(run.created_at) > new Date(existing.created_at)) {
        projectLastScan.set(run.project, run)
      }
    })
    return Array.from(projectLastScan.entries())
      .map(([project, run]) => ({
        id: `scan-${run.id}`,
        project,
        message: t('pages.globaldashboard.scanCompleted', { score: run.score }),
        timestamp: run.created_at,
        score: run.score,
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [runs, t])

  if (activities.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--muted)' }}>
        <div style={{ opacity: 0.5, marginBottom: '0.75rem' }}><ActivityIcon /></div>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>{t('pages.globaldashboard.noActivity')}</div>
        <div style={{ fontSize: '0.72rem', opacity: 0.7 }}>{t('pages.globaldashboard.runScansHint')}</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {activities.slice(0, 8).map(activity => (
        <div
          key={activity.id}
          className="gd-activity-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.85rem',
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            transition: 'transform 0.15s ease, background 0.15s ease',
          }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: 'rgba(0,148,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--waf-brand)',
              flexShrink: 0,
            }}
          >
            <ScanIcon />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activity.project}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{formatDateTime(activity.timestamp)}</div>
          </div>
          <div
            style={{
              padding: '0.2rem 0.55rem',
              borderRadius: '999px',
              background: `${scoreColor(activity.score)}18`,
              border: `1px solid ${scoreColor(activity.score)}40`,
              color: scoreColor(activity.score),
              fontSize: '0.7rem',
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {activity.score}/100
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────────
export interface GlobalDashboardProps {
  runs: RunSummary[]
  navigate: (page: Page) => void
}

export default function GlobalDashboardPage({ runs, navigate }: GlobalDashboardProps) {
  const { t } = useI18n()
  const [passports, setPassports] = useState<ProjectPassport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    fetchProjectPassports()
      .then(setPassports)
      .catch(e => {
        console.error('Failed to fetch passports:', e)
        setError('Failed to load passports: ' + (e as Error).message)
      })
      .finally(() => setLoading(false))
  }, [])

  const latestRun = useMemo(() => {
    if (runs.length === 0) return null
    return runs.reduce((latest, run) => (new Date(run.created_at) > new Date(latest.created_at) ? run : latest))
  }, [runs])

  const totalProjects = useMemo(() => {
    if (passports.length > 0) return passports.length
    return new Set(runs.map(r => r.project || '(unnamed)')).size
  }, [passports, runs])

  const avgScore = useMemo(() => {
    if (runs.length === 0) return 0
    return Math.round(runs.reduce((sum, r) => sum + r.score, 0) / runs.length)
  }, [runs])

  const maturityDistribution = useMemo(() => {
    const dist = { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 }
    const bestScores = new Map<string, number>()
    if (passports.length > 0) {
      passports.forEach(passport => {
        const projectRuns = runs.filter(r => (r.project || '(unnamed)') === passport.project)
        if (projectRuns.length > 0) {
          const bestScore = projectRuns.reduce((m, r) => Math.max(m, r.score), 0)
          bestScores.set(passport.project, bestScore)
        }
      })
    } else {
      runs.forEach(run => {
        const project = run.project || '(unnamed)'
        const existing = bestScores.get(project)
        if (!existing || run.score > existing) bestScores.set(project, run.score)
      })
    }
    bestScores.forEach(score => {
      if (score >= 90) dist.L5++
      else if (score >= 75) dist.L4++
      else if (score >= 60) dist.L3++
      else if (score >= 40) dist.L2++
      else dist.L1++
    })
    return dist
  }, [passports, runs])

  const topProjects = useMemo(() => {
    let projectScores: { project: string; displayName: string; score: number }[]
    if (passports.length > 0) {
      projectScores = passports.map(p => {
        const pRuns = runs.filter(r => (r.project || '(unnamed)') === p.project)
        const bestScore = pRuns.reduce((m, r) => Math.max(m, r.score), 0)
        return { project: p.project, displayName: p.display_name || p.project, score: bestScore }
      })
    } else {
      const runScores = new Map<string, { project: string; displayName: string; score: number }>()
      runs.forEach(run => {
        const project = run.project || '(unnamed)'
        const existing = runScores.get(project)
        if (!existing || run.score > existing.score) {
          runScores.set(project, { project, displayName: project, score: run.score })
        }
      })
      projectScores = Array.from(runScores.values())
    }
    return projectScores.sort((a, b) => b.score - a.score).slice(0, 6)
  }, [passports, runs])

  const topExcellenceProjects = useMemo(() => topProjects.filter(p => p.score >= 75).slice(0, 5), [topProjects])

  const pillarRadarData = useMemo(() => {
    if (!latestRun?.pillar_scores) return []
    const normalized: Record<string, number> = {}
    Object.entries(latestRun.pillar_scores).forEach(([k, v]) => {
      normalized[normalizePillarName(k)] = v
    })
    return PILLAR_META.map(p => ({
      pillar: p.label,
      score: normalized[p.key] ?? 0,
      color: p.color,
      fullMark: 100,
    }))
  }, [latestRun])

  const maturityChartData = useMemo(
    () => [
      { label: 'L5', count: maturityDistribution.L5, color: '#059669' },
      { label: 'L4', count: maturityDistribution.L4, color: '#8b5cf6' },
      { label: 'L3', count: maturityDistribution.L3, color: '#0094FF' },
      { label: 'L2', count: maturityDistribution.L2, color: '#f97316' },
      { label: 'L1', count: maturityDistribution.L1, color: '#ef4444' },
    ],
    [maturityDistribution]
  )

  const featuredProject = useMemo(() => {
    if (topProjects.length === 0) return null
    const idx = getRotatedIndex(topProjects)
    return topProjects[idx]
  }, [topProjects])

  const starProject = useMemo(() => {
    if (topProjects.length === 0) return null
    const idx = getRotatedIndex(topProjects, -7)
    return topProjects[idx]
  }, [topProjects])

  const globalScore = latestRun?.score ?? avgScore ?? 0

  if (error) {
    return (
      <div className="gd-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{ textAlign: 'center', maxWidth: 420, padding: '2rem', borderRadius: '20px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div style={{ color: 'var(--waf-danger)', marginBottom: '1rem' }}><ErrorIcon /></div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.5rem' }}>Error Loading Global Dashboard</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{error}</div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="gd-skeleton-grid">
        <style>{skeletonCss}</style>
        <div className="gd-skeleton hero" />
        <div className="gd-skeleton" />
        <div className="gd-skeleton" />
        <div className="gd-skeleton" />
        <div className="gd-skeleton" />
        <div className="gd-skeleton wide" />
        <div className="gd-skeleton wide" />
      </div>
    )
  }

  if (!runs || runs.length === 0) {
    return (
      <div className="gd-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <div style={{ textAlign: 'center', maxWidth: 460, padding: '2.5rem', borderRadius: '24px', background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ color: 'var(--waf-brand)', marginBottom: '1rem' }}><EmptyStateIcon /></div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.5rem' }}>No run data available</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1.5rem' }}>Run a WAF++ scan first to populate your operational center.</div>
          <button
            onClick={() => navigate('runscan')}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--waf-brand)',
              color: '#fff',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,148,255,0.35)',
            }}
          >
            Run First Scan
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`gd-root ${mounted ? 'gd-mounted' : ''}`}>
      <style>{globalDashboardCss}</style>

      {/* Hero */}
      <div className="gd-hero">
        <div className="gd-hero-glass">
          <div className="gd-hero-content">
            <div className="gd-hero-badge">
              <span className="gd-pulse-dot" />
              <span>{t('pages.globaldashboard.operationalCenter')}</span>
            </div>
            <h1 className="gd-hero-title">{t('pages.maturityJourney.hero')}</h1>
            <p className="gd-hero-subtitle">{t('pages.globaldashboard.latestScans')}</p>
            <div className="gd-hero-actions">
              <button className="gd-btn-primary" onClick={() => navigate('passports')}>
                <PassportIcon /> {t('common.view')} {t('pages.passportDashboard.badgeDownload')}
              </button>
              <button className="gd-btn-secondary" onClick={() => navigate('runs')}>
                <RunHistoryIcon /> {t('nav.items.runs')}
              </button>
            </div>
          </div>
          <div className="gd-hero-score">
            <ScoreRing score={globalScore} size={160} />
            <div className="gd-hero-score-label">
              <span style={{ color: scoreColor(globalScore), fontWeight: 800 }}>{getMaturityForScore(globalScore).label}</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI bento */}
      <div className="gd-kpi-grid">
        <KpiTile
          label={t('pages.globaldashboard.totalProjects')}
          value={totalProjects}
          subtext={passports.length > 0 ? 'From passports' : 'From scan runs'}
          icon={<ProjectsIcon />}
          color="#0094FF"
          onClick={() => navigate('passports')}
        />
        <KpiTile
          label={t('pages.globaldashboard.avgScore')}
          value={`${avgScore}/100`}
          subtext="Across all runs"
          icon={<ScoreIcon />}
          color={scoreColor(avgScore)}
        />
        <KpiTile
          label={t('pages.globaldashboard.lastScan')}
          value={formatDate(latestRun?.created_at)}
          subtext={latestRun ? `${latestRun.project} · ${latestRun.branch}` : '-'}
          icon={<CalendarIcon />}
          color="#8b5cf6"
        />
        <KpiTile
          label={t('pages.globaldashboard.globalScore')}
          value={`${globalScore}/100`}
          subtext={getMaturityForScore(globalScore).short}
          icon={<TrendUpIcon />}
          color={scoreColor(globalScore)}
        />
      </div>

      {/* Main bento grid */}
      <div className="gd-bento">
        <div className="gd-col-2">
          <SectionCard title={t('pages.maturityJourney.flightMap')} subtitle={t('pages.maturityJourney.flightMapDesc')}>
            <FlightTimeline runs={runs} passports={passports} />
          </SectionCard>
        </div>

        <div className="gd-col-1">
          <SectionCard title={t('pages.globaldashboard.maturityDistribution')} subtitle="Projects by maturity level">
            <MaturityChart data={maturityChartData} />
          </SectionCard>
        </div>

        <div className="gd-col-1">
          <SectionCard title={t('pages.globaldashboard.topProjects')} subtitle="Highest maturity scores">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {topProjects.map((p, i) => {
                const maturity = getMaturityForScore(p.score)
                return (
                  <div
                    key={p.project}
                    className="gd-project-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      padding: '0.65rem 0.8rem',
                      borderRadius: '12px',
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      transition: 'transform 0.15s ease',
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--muted)', width: '1.4rem', flexShrink: 0 }}>#{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.displayName}
                      </div>
                      <div style={{ height: '4px', borderRadius: '999px', background: 'var(--track)', marginTop: '0.3rem', overflow: 'hidden' }}>
                        <div style={{ width: `${p.score}%`, height: '100%', borderRadius: '999px', background: maturity.color, transition: 'width 0.8s ease' }} />
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        color: maturity.color,
                        padding: '0.15rem 0.4rem',
                        borderRadius: '999px',
                        background: `${maturity.color}18`,
                        border: `1px solid ${maturity.color}35`,
                        flexShrink: 0,
                      }}
                    >
                      L{maturity.level}
                    </div>
                  </div>
                )
              })}
              {topProjects.length === 0 && (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--muted)', fontSize: '0.75rem' }}>
                  {t('pages.globaldashboard.noProjects')}
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        <div className="gd-col-1">
          <SectionCard title={t('pages.globaldashboard.pillarHealth')} subtitle={t('pages.globaldashboard.showingXPillars', { count: PILLAR_META.length })}>
            {pillarRadarData.length > 0 ? (
              <PillarRadar data={pillarRadarData} />
            ) : (
              <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.78rem' }}>
                No pillar data available
              </div>
            )}
          </SectionCard>
        </div>

        <div className="gd-col-1">
          <SectionCard title={t('pages.globaldashboard.recentActivity')} subtitle={t('pages.globaldashboard.latestScans')}>
            <RecentActivity runs={runs} />
          </SectionCard>
        </div>

        {featuredProject && (
          <div className="gd-col-2">
            <SectionCard title={t('pages.globaldashboard.featuredProject')} subtitle={`${t('pages.globaldashboard.topPerformingProject')} ${featuredProject.displayName}`}>
              <div className="gd-featured">
                <div className="gd-featured-main">
                  <div className="gd-featured-head">
                    <div className="gd-featured-icon"><StarIcon /></div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{featuredProject.displayName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        {getBestRunForProject(featuredProject.project, runs)?.branch}
                      </div>
                    </div>
                  </div>
                  <div className="gd-featured-stats">
                    <div className="gd-featured-stat" style={{ borderColor: scoreColor(featuredProject.score) }}>
                      <div style={{ fontSize: '1.7rem', fontWeight: 800, color: scoreColor(featuredProject.score) }}>{featuredProject.score}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontWeight: 600 }}>{t('pages.globaldashboard.score')}</div>
                    </div>
                    <div className="gd-featured-stat" style={{ borderColor: getMaturityForScore(featuredProject.score).color }}>
                      <div style={{ fontSize: '1.7rem', fontWeight: 800, color: getMaturityForScore(featuredProject.score).color }}>
                        {getMaturityForScore(featuredProject.score).level}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontWeight: 600 }}>{t('pages.globaldashboard.level')}</div>
                    </div>
                    <div className="gd-featured-stat" style={{ borderColor: 'var(--waf-brand)' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--waf-brand)' }}>
                        {formatDate(getBestRunForProject(featuredProject.project, runs)?.created_at)}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontWeight: 600 }}>{t('pages.globaldashboard.lastScan')}</div>
                    </div>
                  </div>
                </div>
                <div className="gd-featured-pillars">
                  {(() => {
                    const run = getBestRunForProject(featuredProject.project, runs)
                    if (!run?.pillar_scores) return null
                    const normalized: Record<string, number> = {}
                    Object.entries(run.pillar_scores).forEach(([k, v]) => {
                      normalized[normalizePillarName(k)] = v
                    })
                    return PILLAR_META.map(p => {
                      const score = normalized[p.key] ?? 0
                      return (
                        <div key={p.key} className="gd-pillar-mini">
                          <div style={{ color: p.color }}><p.icon /></div>
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text)' }}>{score}</div>
                          <div style={{ fontSize: '0.58rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{p.label}</div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {starProject && (
          <div className="gd-col-2">
            <SectionCard title="Star of the Week" subtitle="Consistently high performer">
              <div className="gd-star">
                <div className="gd-star-icon"><TrophyIcon /></div>
                <div className="gd-star-main">
                  <div className="gd-star-name">{starProject.displayName}</div>
                  <div className="gd-star-meta">
                    Last scan: {formatDate(getBestRunForProject(starProject.project, runs)?.created_at)} · {getMaturityForScore(starProject.score).label}
                  </div>
                </div>
                <div className="gd-star-stats">
                  <div className="gd-star-stat">
                    <div className="gd-star-value">{starProject.score}</div>
                    <div className="gd-star-label">Score</div>
                  </div>
                  <div className="gd-star-stat">
                    <div className="gd-star-value">L{getMaturityForScore(starProject.score).level}</div>
                    <div className="gd-star-label">Level</div>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        )}
      </div>

      {/* Excellence standard row */}
      {topExcellenceProjects.length > 0 && (
        <SectionCard title={t('pages.maturityJourney.excellenceStandard')} subtitle={`${topExcellenceProjects.length} project${topExcellenceProjects.length > 1 ? 's' : ''} at L4/L5`}>
          <div className="gd-excellence-row">
            {topExcellenceProjects.map((p, i) => {
              const maturity = getMaturityForScore(p.score)
              return (
                <div
                  key={p.project}
                  className="gd-excellence-card"
                  style={{
                    padding: '1rem 1.25rem',
                    borderRadius: '16px',
                    background: 'var(--bg)',
                    border: `1px solid ${maturity.color}25`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.85rem',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--muted)' }}>#{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.displayName}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{p.score}/100 · {maturity.short}</div>
                  </div>
                  <div
                    style={{
                      padding: '0.25rem 0.65rem',
                      borderRadius: '999px',
                      background: `${maturity.color}18`,
                      border: `1px solid ${maturity.color}35`,
                      color: maturity.color,
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    L{maturity.level}
                  </div>
                </div>
              )
            })}
          </div>
        </SectionCard>
      )}
    </div>
  )
}

// ── Scoped styles ───────────────────────────────────────────────────────────────
const globalDashboardCss = `
.gd-root {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  padding-bottom: 2rem;
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.gd-root.gd-mounted {
  opacity: 1;
  transform: translateY(0);
}

.gd-hero {
  width: 100%;
}
.gd-hero-glass {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 1.5rem 1.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
  flex-wrap: wrap;
}
.gd-hero-glass::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -10%;
  width: 50%;
  height: 200%;
  background: radial-gradient(circle, rgba(0,148,255,0.08) 0%, transparent 70%);
  pointer-events: none;
}
.gd-hero-content {
  flex: 1;
  min-width: 0;
  position: relative;
  z-index: 1;
}
.gd-hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(0,148,255,0.10);
  border: 1px solid rgba(0,148,255,0.20);
  border-radius: 999px;
  padding: 0.35rem 0.9rem;
  font-size: 0.68rem;
  font-weight: 800;
  color: var(--waf-brand);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin-bottom: 0.9rem;
}
.gd-pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--waf-brand);
  box-shadow: 0 0 0 0 rgba(0,148,255,0.5);
  animation: gdPulse 2s infinite;
}
@keyframes gdPulse {
  0% { box-shadow: 0 0 0 0 rgba(0,148,255,0.5); }
  70% { box-shadow: 0 0 0 8px rgba(0,148,255,0); }
  100% { box-shadow: 0 0 0 0 rgba(0,148,255,0); }
}
.gd-hero-title {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--text);
  margin: 0 0 0.4rem;
  line-height: 1.15;
}
.gd-hero-subtitle {
  font-size: 0.85rem;
  color: var(--muted);
  margin: 0 0 1.25rem;
}
.gd-hero-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.gd-btn-primary, .gd-btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.1rem;
  border-radius: 10px;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
  border: none;
}
.gd-btn-primary {
  background: var(--waf-brand);
  color: #fff;
  box-shadow: 0 4px 16px rgba(0,148,255,0.32);
}
.gd-btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(0,148,255,0.40);
}
.gd-btn-primary:active {
  transform: scale(0.98);
}
.gd-btn-secondary {
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
}
.gd-btn-secondary:hover {
  background: var(--row-hover);
  transform: translateY(-1px);
}
.gd-btn-secondary:active {
  transform: scale(0.98);
}
.gd-hero-score {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  position: relative;
  z-index: 1;
}
.gd-hero-score-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.gd-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}
.gd-kpi-grid .gd-tile {
  min-height: 100px;
  justify-content: space-between;
}
.gd-tile:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-md);
  border-color: rgba(0,148,255,0.25);
}
.gd-tile:active {
  transform: scale(0.99);
}

.gd-bento {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  align-items: stretch;
}
.gd-bento > * {
  display: flex;
  min-width: 0;
}
.gd-bento > * > .gd-card {
  width: 100%;
  flex: 1;
}
.gd-col-1 { grid-column: span 1; }
.gd-col-2 { grid-column: span 2; }

.gd-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.gd-card:hover {
  box-shadow: var(--shadow-md);
}

.gd-project-row:hover,
.gd-activity-row:hover,
.gd-excellence-card:hover {
  transform: translateX(3px);
  background: var(--row-hover) !important;
}

.gd-featured {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 1.25rem;
}
.gd-featured-main {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
}
.gd-featured-head {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
}
.gd-featured-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(0,148,255,0.10);
  border: 1px solid rgba(0,148,255,0.20);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--waf-brand);
  flex-shrink: 0;
}
.gd-featured-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.6rem;
}
.gd-featured-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  padding: 0.6rem 0.4rem;
  border-radius: 12px;
  background: var(--bg);
  border-top: 3px solid;
  min-width: 0;
  text-align: center;
}
.gd-featured-pillars {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}
.gd-pillar-mini {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.55rem;
  border-radius: 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  min-width: 0;
}

.gd-excellence-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.75rem;
}

.gd-star {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(5,150,105,0.08) 0%, rgba(5,150,105,0.02) 100%);
  border: 1px solid rgba(5,150,105,0.18);
}
.gd-star-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(5,150,105,0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #059669;
  flex-shrink: 0;
}
.gd-star-main {
  flex: 1;
  min-width: 0;
}
.gd-star-name {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gd-star-meta {
  font-size: 0.72rem;
  color: var(--muted);
}
.gd-star-stats {
  display: flex;
  gap: 1.25rem;
  flex-shrink: 0;
}
.gd-star-stat {
  text-align: center;
}
.gd-star-value {
  font-size: 1.35rem;
  font-weight: 800;
  color: #059669;
  line-height: 1;
}
.gd-star-label {
  font-size: 0.62rem;
  color: var(--muted);
  text-transform: uppercase;
  margin-top: 0.15rem;
}

.gd-flight-wrap {
  position: relative;
  border-radius: 16px;
  background: var(--bg);
  border: 1px solid var(--border);
  overflow: hidden;
  aspect-ratio: 1000 / 260;
}
.gd-flight-wrap svg {
  display: block;
}
.gd-flight-wrap--real {
  border-radius: 20px;
  box-shadow: inset 0 0 60px rgba(0,0,0,0.04), 0 10px 40px rgba(0,0,0,0.08);
  background-image: url('/flight-map-bg.png');
  background-size: cover;
  background-position: center 55%;
  background-repeat: no-repeat;
}

.gd-flight-stages {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.75rem;
}

.gd-flight-stage:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.08);
}

@media (max-width: 1100px) {
  .gd-flight-stages { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .gd-flight-stages { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

.gd-fade-in {
  animation: gdFadeIn 0.5s ease forwards;
}
@keyframes gdFadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.score-ring-wrap {
  animation: gdRingReveal 1s ease forwards;
}
@keyframes gdRingReveal {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

@media (max-width: 1100px) {
  .gd-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .gd-bento { grid-template-columns: 1fr; }
  .gd-col-1, .gd-col-2 { grid-column: span 1; }
  .gd-featured { grid-template-columns: 1fr; }
  .gd-featured-pillars { grid-template-columns: repeat(4, 1fr); }
}

@media (max-width: 768px) {
  .gd-hero-glass {
    flex-direction: column;
    align-items: flex-start;
    padding: 1.5rem;
  }
  .gd-hero-score {
    align-self: center;
  }
  .gd-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .gd-featured-pillars { grid-template-columns: repeat(2, 1fr); }
  .gd-star {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }
  .gd-star-stats { align-self: stretch; justify-content: space-between; }
}

@media (max-width: 480px) {
  .gd-kpi-grid { grid-template-columns: 1fr; }
  .gd-bento { grid-template-columns: 1fr; }
  .gd-col-1, .gd-col-2 { grid-column: span 1; }
  .gd-featured-stats { grid-template-columns: 1fr; }
  .gd-featured-pillars { grid-template-columns: repeat(2, 1fr); }
}
`

const skeletonCss = `
.gd-skeleton-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  animation: gdFadeIn 0.3s ease;
}
.gd-skeleton {
  background: linear-gradient(90deg, var(--bg) 25%, var(--surface) 50%, var(--bg) 75%);
  background-size: 200% 100%;
  border-radius: 18px;
  height: 120px;
  animation: gdSkeleton 1.4s infinite;
}
.gd-skeleton.hero {
  grid-column: span 4;
  height: 220px;
}
.gd-skeleton.wide {
  grid-column: span 2;
  height: 300px;
}
@keyframes gdSkeleton {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@media (max-width: 768px) {
  .gd-skeleton-grid { grid-template-columns: repeat(2, 1fr); }
  .gd-skeleton.hero { grid-column: span 2; }
  .gd-skeleton.wide { grid-column: span 2; }
}
`
