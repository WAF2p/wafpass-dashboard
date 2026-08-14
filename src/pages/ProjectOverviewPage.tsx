import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import { fetchProjectAchievements, getApiBase, ProjectAchievement, RunSummary } from '../api'
import { useI18n } from '../i18n'
import { MATURITY_META } from './settingsUtils'

interface Props {
  runs: RunSummary[]
  onSelect: (id: string) => void
  onBack?: () => void
  role?: string
  initialProject?: string
}

// ── Maturity badge thresholds (score-based, independent of settings level) ────
const MATURITY_THRESHOLDS: Record<number, number> = { 1: 0, 2: 40, 3: 60, 4: 75, 5: 90 }

// ── Achievements ──────────────────────────────────────────────────────────────

type AchievementCategory = 'coverage' | 'quality' | 'consistency' | 'depth'

interface Achievement {
  id: string
  title: string
  description: string
  category: AchievementCategory
  iconPath: string
  check: (runs: RunSummary[]) => boolean
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_scan',
    title: 'First Scan',
    description: 'Complete your first WAF++ scan',
    category: 'coverage',
    iconPath: 'M13 10V3L4 14h7v7l9-11h-7z',
    check: rs => rs.length >= 1,
  },
  {
    id: 'score_60',
    title: 'Above Average',
    description: 'Achieve a score of 60 or higher',
    category: 'quality',
    iconPath: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    check: rs => rs.some(r => r.score >= 60),
  },
  {
    id: 'score_80',
    title: 'High Performer',
    description: 'Achieve a score of 80 or higher',
    category: 'quality',
    iconPath: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
    check: rs => rs.some(r => r.score >= 80),
  },
  {
    id: 'score_90',
    title: 'Security Champion',
    description: 'Achieve a score of 90 or higher',
    category: 'quality',
    iconPath: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    check: rs => rs.some(r => r.score >= 90),
  },
  {
    id: 'five_scans',
    title: 'Regular Cadence',
    description: 'Complete 5 or more scans',
    category: 'consistency',
    iconPath: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
    check: rs => rs.length >= 5,
  },
  {
    id: 'ten_scans',
    title: 'Consistent Reviewer',
    description: 'Complete 10 or more scans',
    category: 'consistency',
    iconPath: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
    check: rs => rs.length >= 10,
  },
  {
    id: 'improving',
    title: 'On the Up',
    description: '3 consecutive score improvements',
    category: 'consistency',
    iconPath: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
    check: rs => {
      if (rs.length < 3) return false
      const sorted = [...rs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      for (let i = sorted.length - 1; i >= 2; i--) {
        if (sorted[i].score > sorted[i - 1].score && sorted[i - 1].score > sorted[i - 2].score) return true
      }
      return false
    },
  },
  {
    id: 'multi_branch',
    title: 'Branch Coverage',
    description: 'Scans across 3 or more branches',
    category: 'coverage',
    iconPath: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    check: rs => new Set(rs.map(r => r.branch).filter(Boolean)).size >= 3,
  },
  {
    id: 'multi_stage',
    title: 'Pipeline Pro',
    description: 'Scans across 3 or more pipeline stages',
    category: 'depth',
    iconPath: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
    check: rs => new Set(rs.map(r => r.stage).filter(Boolean)).size >= 3,
  },
]

const CATEGORY_COLOR: Record<AchievementCategory, string> = {
  coverage:    '#0094FF',
  quality:     '#22c55e',
  consistency: '#f97316',
  depth:       '#8b5cf6',
}
const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  coverage: 'Coverage', quality: 'Quality', consistency: 'Consistency', depth: 'Depth',
}

// ── Pillar metadata ───────────────────────────────────────────────────────────

const PILLAR_META = [
  { key: 'security',       label: 'Security',       color: '#DA2C38' },
  { key: 'cost',           label: 'Cost',           color: '#0094FF' },
  { key: 'operations',     label: 'Operations',     color: '#8b5cf6' },
  { key: 'performance',    label: 'Performance',    color: '#f97316' },
  { key: 'reliability',    label: 'Reliability',    color: '#22c55e' },
  { key: 'sovereign',      label: 'Sovereignty',    color: '#eab308' },
  { key: 'sustainability', label: 'Sustainability', color: '#14b8a6' },
  { key: 'agentic',        label: 'Agentic',        color: '#ec4899' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

// Normalize pillar names: database uses "operational", dashboard uses "operations"
function normalizePillarName(pillar: string): string {
  if (pillar === 'operational') return 'operations'
  return pillar
}

function scoreColor(s: number) { return s >= 80 ? '#059669' : s >= 60 ? '#d97706' : '#DA2C38' }
function fmt(iso: string) { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }
function fmtFull(iso: string) { return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }

// ── Medal badge (maturity) ────────────────────────────────────────────────────
// A proper hanging medal: bail ring + sunburst ring + layered circles + ornamental details.

function MedalBadge({
  levelNum, color, textColor, bg, earned,
}: {
  levelNum: number; color: string; textColor: string; bg: string; earned: boolean
}) {
  const cx = 50, cy = 70

  // 24-ray sunburst: 48 points alternating outer/inner radius
  const sunburst = Array.from({ length: 48 }, (_, i) => {
    const angle = (i * 7.5 - 90) * Math.PI / 180
    const r = i % 2 === 0 ? 46 : 40
    return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`
  }).join(' ')

  // 6 decorative dots at cardinal & intercardinal positions on r=35
  const dots = [0, 60, 120, 180, 240, 300].map(deg => {
    const a = (deg - 90) * Math.PI / 180
    return { x: cx + 35 * Math.cos(a), y: cy + 35 * Math.sin(a) }
  })

  // Small diamond at top of inner ring (ornamental tip)
  const diaY = cy - 29
  const diamond = `${cx},${diaY - 4} ${cx + 3},${diaY} ${cx},${diaY + 4} ${cx - 3},${diaY}`

  const fc = earned ? color : '#2d3d54'
  const a = (v: number) => earned ? `${bg}${v})` : `rgba(15,25,42,${v})`

  // Checkmark path (bottom-right of main ring, at r=38 and 315°)
  const checkX = +(cx + 27).toFixed(1)
  const checkY = +(cy + 27).toFixed(1)

  return (
    <div style={{
      opacity: earned ? 1 : 0.28,
      filter: earned ? 'none' : 'grayscale(1) brightness(0.7)',
      transition: 'opacity 0.35s, filter 0.35s',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem',
    }}>
      <svg viewBox="0 0 100 122" width="100" height="122" overflow="visible">
        {/* ── Bail (top attachment) ── */}
        {/* outer ring loop */}
        <circle cx={cx} cy="8" r="7"
          fill="none" stroke={fc} strokeWidth="2.2" />
        {/* inner hole */}
        <circle cx={cx} cy="8" r="3.5"
          fill={a(0.4)} />
        {/* vertical strap connecting bail to medal */}
        <rect x="44.5" y="13" width="11" height="18" rx="4"
          fill={a(0.35)} stroke={fc} strokeWidth="1.6" />

        {/* ── Outer ambient glow (earned only) ── */}
        {earned && (
          <circle cx={cx} cy={cy} r="51"
            fill={`${bg}0.06)`} />
        )}

        {/* ── Sunburst ring ── */}
        <polygon points={sunburst}
          fill={a(0.20)}
          stroke={fc} strokeWidth="0.8"
        />

        {/* ── Main medal ring ── */}
        <circle cx={cx} cy={cy} r="38"
          fill={a(0.24)}
          stroke={fc} strokeWidth="2.8"
        />

        {/* ── Decorative corner dots on ring ── */}
        {dots.map((d, i) => (
          <circle key={i}
            cx={+d.x.toFixed(1)} cy={+d.y.toFixed(1)} r="3.2"
            fill={earned ? color : '#334155'}
            opacity={earned ? 0.75 : 0.4}
          />
        ))}

        {/* ── Inner content circle ── */}
        <circle cx={cx} cy={cy} r="29"
          fill={a(0.18)}
          stroke={fc} strokeWidth="1.3" strokeOpacity="0.55"
        />

        {/* ── Ornamental diamond tip at top of inner ring ── */}
        <polygon points={diamond}
          fill={earned ? color : '#2d3d54'}
          opacity={earned ? 0.65 : 0.35}
        />

        {/* ── Horizontal rule lines ── */}
        <line x1={cx - 17} y1={cy - 12} x2={cx + 17} y2={cy - 12}
          stroke={fc} strokeWidth="1.1" strokeOpacity="0.5" />
        <line x1={cx - 17} y1={cy + 18} x2={cx + 17} y2={cy + 18}
          stroke={fc} strokeWidth="1.1" strokeOpacity="0.5" />

        {/* ── Level number ── */}
        <text x={cx} y={cy + 4}
          textAnchor="middle" dominantBaseline="central"
          fill={earned ? textColor : '#475569'}
          fontSize="24" fontWeight="900"
          fontFamily="system-ui,-apple-system,sans-serif"
        >
          L{levelNum}
        </text>

        {/* ── Earned checkmark (bottom-right of main ring) ── */}
        {earned && (
          <g transform={`translate(${checkX},${checkY})`}>
            <circle r="10" fill={color} stroke="var(--surface)" strokeWidth="2.5" />
            <path d="M -5 0.5 L -1.5 4 L 5.5 -4"
              fill="none" stroke="#fff" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round"
            />
          </g>
        )}

        {/* ── Locked padlock (bottom-right of main ring) ── */}
        {!earned && (
          <g transform={`translate(${checkX},${checkY})`}>
            <circle r="9.5" fill="rgba(12,22,40,0.85)" stroke="#2d3d54" strokeWidth="1.8" />
            <rect x="-4.5" y="-1.5" width="9" height="7" rx="1.5" fill="#334155" />
            <path d="M -3 -1.5 L -3 -5 Q -3 -8 0 -8 Q 3 -8 3 -5 L 3 -1.5"
              fill="none" stroke="#334155" strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        )}
      </svg>
    </div>
  )
}

// ── Circle achievement badge ──────────────────────────────────────────────────

function CircleBadge({ title, description, category, iconPath, earned }: {
  title: string; description: string; category: AchievementCategory; iconPath: string; earned: boolean
}) {
  const color = CATEGORY_COLOR[category]
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem',
      padding: '0.875rem 0.5rem 0.75rem', borderRadius: '12px', textAlign: 'center',
      background: earned ? `${color}08` : 'var(--bg)',
      border: `1px solid ${earned ? `${color}28` : 'var(--border)'}`,
      opacity: earned ? 1 : 0.36,
      filter: earned ? 'none' : 'grayscale(1)',
      transition: 'opacity 0.3s, filter 0.3s',
    }}>
      <div style={{ position: 'relative' }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '50%',
          background: earned ? `${color}16` : 'rgba(30,41,59,0.5)',
          border: `2px solid ${earned ? color : '#334155'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: earned ? `0 0 0 4px ${color}14` : 'none',
        }}>
          <svg width="22" height="22" fill="none" stroke={earned ? color : '#475569'} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={iconPath} />
          </svg>
        </div>
        {earned && (
          <div style={{
            position: 'absolute', bottom: '-3px', right: '-3px',
            width: '17px', height: '17px', borderRadius: '50%',
            background: color, border: '2px solid var(--surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="8" height="8" fill="none" stroke="#fff" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
      <span style={{
        fontSize: '0.58rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '999px',
        background: earned ? `${color}15` : 'rgba(255,255,255,0.04)',
        color: earned ? color : '#475569',
        textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {CATEGORY_LABEL[category]}
      </span>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: earned ? 'var(--text)' : '#475569', lineHeight: 1.2 }}>{title}</div>
      <div style={{ fontSize: '0.62rem', color: 'var(--muted)', lineHeight: 1.45, maxWidth: '120px' }}>{description}</div>
    </div>
  )
}

// ── Section header with Preview pill ─────────────────────────────────────────

function SectionHeader({ title, sub, count, total }: { title: string; sub: string; count?: number; total?: number }) {
  return (
    <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.15rem' }}>{sub}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {count !== undefined && total !== undefined && (
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
            <strong style={{ color: 'var(--text)' }}>{count}</strong>/{total} earned
          </span>
        )}
        <span style={{
          fontSize: '0.6rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '999px',
          background: 'rgba(0,148,255,0.08)', color: '#60a5fa',
          border: '1px solid rgba(0,148,255,0.2)',
          textTransform: 'uppercase', letterSpacing: '0.07em',
        }}>Preview</span>
      </div>
    </div>
  )
}

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '1rem 1.25rem', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem', fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProjectOverviewPage({ runs, onSelect, onBack, initialProject }: Props) {
  const { t } = useI18n()
  const activeProject = initialProject ?? Array.from(new Set(runs.map(r => r.project || '(unnamed)')))[0] ?? null

  const projectRuns = useMemo(() => {
    if (!activeProject) return []
    return [...runs.filter(r => (r.project || '(unnamed)') === activeProject)]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }, [runs, activeProject])

  const latestRun = projectRuns[projectRuns.length - 1] ?? null
  const prevRun   = projectRuns[projectRuns.length - 2] ?? null
  const scoreDelta = latestRun && prevRun ? latestRun.score - prevRun.score : null
  const bestScore  = projectRuns.reduce((best, r) => Math.max(best, r.score), 0)

  const trendData = useMemo(
    () => projectRuns.map(r => ({ date: fmt(r.created_at), score: r.score, branch: r.branch, id: r.id })),
    [projectRuns],
  )

  const pillarData = useMemo(() => {
    if (!latestRun) return []
    // Get all pillar scores from the run, normalizing key names
    const normalizedScores: Record<string, number> = {}
    if (latestRun.pillar_scores) {
      for (const [key, value] of Object.entries(latestRun.pillar_scores)) {
        normalizedScores[normalizePillarName(key)] = value
      }
    }
    return PILLAR_META.map(p => ({
      pillar: p.label,
      score: normalizedScores[p.key] ?? 0,
      color: p.color,
    }))
  }, [latestRun])

  // Maturity badges: earned = bestScore >= that level's threshold
  const maturityBadges = useMemo(
    () => MATURITY_META.map(m => ({ ...m, earned: bestScore >= MATURITY_THRESHOLDS[m.level] })),
    [bestScore],
  )
  const earnedMaturityCount = maturityBadges.filter(b => b.earned).length

  // Current level = highest earned level
  const currentMeta = [...MATURITY_META].reverse().find(m => bestScore >= MATURITY_THRESHOLDS[m.level]) ?? MATURITY_META[0]
  const nextMeta    = MATURITY_META.find(m => m.level === currentMeta.level + 1)

  // Progress bar
  const currentThreshold = MATURITY_THRESHOLDS[currentMeta.level]
  const nextThreshold    = nextMeta ? MATURITY_THRESHOLDS[nextMeta.level] : currentThreshold
  const progressPct = nextMeta
    ? Math.min(100, Math.round((bestScore - currentThreshold) / (nextThreshold - currentThreshold) * 100))
    : 100
  const ptsNeeded = nextMeta ? Math.max(0, nextThreshold - bestScore) : 0

  // Achievement badges
  const achievementBadges = useMemo(
    () => ACHIEVEMENTS.map(a => ({ ...a, earned: a.check(projectRuns) })),
    [projectRuns],
  )
  const earnedAchievementCount = achievementBadges.filter(b => b.earned).length

  const branchCount = new Set(projectRuns.map(r => r.branch).filter(Boolean)).size

  // Server-side verified achievements
  const [verifiedAchievements, setVerifiedAchievements] = useState<ProjectAchievement[]>([])
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  useEffect(() => {
    if (!activeProject) return
    fetchProjectAchievements(activeProject).then(setVerifiedAchievements).catch(() => {})
  }, [activeProject])

  function copyVerifyUrl(token: string) {
    const base = getApiBase() || window.location.origin
    navigator.clipboard.writeText(`${base}/api/v1/public/achievements/${token}`).then(() => {
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(null), 2000)
    }).catch(() => {})
  }

  if (runs.length === 0) {
    return (
      <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: '4rem', fontSize: '0.85rem' }}>
        {t('pages.projectOverview.noScans')}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Header: back button + project name ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {onBack && (
          <button
            onClick={onBack}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
              cursor: 'pointer', border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--muted)',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,148,255,0.4)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
            }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('pages.projectOverview.backBtn')}
          </button>
        )}
        {activeProject && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', minWidth: 0 }}>
            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeProject}
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--muted)', flexShrink: 0 }}>{t('pages.projectOverview.title')}</span>
          </div>
        )}
      </div>

      {activeProject && latestRun ? (
        <>
          {/* ── KPI cards ────────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
            <StatCard label={t('pages.projectOverview.latestScore')}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: scoreColor(latestRun.score) }}>{latestRun.score}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>/100</span>
                {scoreDelta !== null && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, marginLeft: '0.2rem', color: scoreDelta >= 0 ? '#22c55e' : '#f87171' }}>
                    {scoreDelta >= 0 ? '+' : ''}{scoreDelta}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.15rem' }}>{fmtFull(latestRun.created_at)}</div>
            </StatCard>

            <StatCard label={t('pages.projectOverview.totalScans')}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text)' }}>{projectRuns.length}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                {t('pages.projectOverview.branches', { count: String(branchCount), es: branchCount !== 1 ? 'es' : '' })}
              </div>
            </StatCard>

            <div style={{
              background: `${currentMeta.bg}0.08)`, borderRadius: '12px',
              padding: '1rem 1.25rem', border: `1px solid ${currentMeta.color}44`,
            }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem', fontWeight: 600 }}>{t('pages.projectOverview.bestScoreLevel')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                  background: `${currentMeta.bg}0.18)`, border: `2px solid ${currentMeta.color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.72rem', fontWeight: 800, color: currentMeta.textColor,
                }}>L{currentMeta.level}</div>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: currentMeta.textColor }}>{currentMeta.short}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{t('pages.projectOverview.bestScore', { score: String(bestScore) })}/100</div>
                </div>
              </div>
            </div>

            <StatCard label={t('pages.projectOverview.badgesEarned')}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)' }}>
                {earnedMaturityCount + earnedAchievementCount}
                <span style={{ fontSize: '0.95rem', color: 'var(--muted)', fontWeight: 400 }}>/{MATURITY_META.length + ACHIEVEMENTS.length}</span>
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                {t('pages.projectOverview.maturityCount', { count: String(earnedMaturityCount) })} · {t('pages.projectOverview.achievementsCount', { count: String(earnedAchievementCount) })}
              </div>
            </StatCard>
          </div>

          {/* ── Progress to next maturity level ──────────────────────────────── */}
          {nextMeta ? (
            <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '1.1rem 1.5rem', border: `1px solid ${currentMeta.color}33`, position: 'relative', overflow: 'hidden' }}>
              {/* subtle background gradient */}
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: `linear-gradient(90deg, ${currentMeta.bg}0.04) 0%, transparent 60%)`,
              }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', position: 'relative' }}>
                {/* Left: current level */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    background: `${currentMeta.bg}0.2)`, border: `2px solid ${currentMeta.color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.68rem', fontWeight: 800, color: currentMeta.textColor,
                  }}>L{currentMeta.level}</div>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: currentMeta.textColor }}>{currentMeta.short}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{t('pages.projectOverview.bestScore', { score: String(bestScore) })}</div>
                  </div>
                </div>

                {/* Center: pts needed */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)' }}>{ptsNeeded}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{t('pages.projectOverview.pointsToNext')}</div>
                </div>

                {/* Right: next level */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: nextMeta.textColor, textAlign: 'right' }}>{nextMeta.short}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--muted)', textAlign: 'right' }}>{t('pages.projectOverview.requiresScore', { score: String(nextThreshold) })}</div>
                  </div>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    background: `${nextMeta.bg}0.12)`, border: `2px solid ${nextMeta.color}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.68rem', fontWeight: 800, color: `${nextMeta.textColor}88`,
                    opacity: 0.65,
                  }}>L{nextMeta.level}</div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: '11px', background: 'var(--bg)', borderRadius: '999px', overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  height: '100%', width: `${progressPct}%`,
                  background: `linear-gradient(90deg, ${currentMeta.color}, ${nextMeta.color})`,
                  borderRadius: '999px',
                  transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
                  position: 'relative',
                }}>
                  {/* Shine stripe */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '45%',
                    background: 'rgba(255,255,255,0.22)', borderRadius: '999px 999px 0 0',
                    pointerEvents: 'none',
                  }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.65rem', color: 'var(--muted)', position: 'relative' }}>
                <span>{currentMeta.short} · score {currentThreshold}</span>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{progressPct}%</span>
                <span>{nextMeta.short} · score {nextThreshold}</span>
              </div>
            </div>
          ) : (
            <div style={{
              background: `${currentMeta.bg}0.08)`, borderRadius: '12px',
              padding: '1rem 1.5rem', border: `1px solid ${currentMeta.color}44`,
              display: 'flex', alignItems: 'center', gap: '0.75rem',
            }}>
              <svg width="18" height="18" fill="none" stroke={currentMeta.color} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: currentMeta.textColor }}>{t('pages.projectOverview.maxMaturity')}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{t('pages.projectOverview.allBadgesEarned', { count: String(MATURITY_META.length) })}</div>
              </div>
            </div>
          )}

          {/* ── Charts row ───────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '1.25rem', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>{t('pages.projectOverview.scoreTrend')}</div>
              {trendData.length > 1 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trendData} onClick={d => { if (d?.activePayload?.[0]?.payload?.id) onSelect(d.activePayload[0].payload.id) }} style={{ cursor: 'pointer' }}>
                    <defs>
                      <linearGradient id="projScoreGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#0094FF" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#0094FF" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--muted)' }} width={28} />
                    <Tooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.6rem 0.875rem', fontSize: '0.75rem' }}>
                          <div style={{ color: 'var(--muted)', marginBottom: '0.2rem' }}>{d.date}{d.branch ? ` · ${d.branch}` : ''}</div>
                          <div style={{ fontWeight: 800, color: scoreColor(d.score), fontSize: '1rem' }}>{d.score}/100</div>
                          <div style={{ color: 'var(--muted)', fontSize: '0.65rem', marginTop: '0.2rem' }}>{t('pages.projectOverview.clickToOpen')}</div>
                        </div>
                      )
                    }} />
                    <ReferenceLine y={80} stroke="#059669" strokeDasharray="4 4" strokeOpacity={0.5} />
                    <ReferenceLine y={60} stroke="#d97706" strokeDasharray="4 4" strokeOpacity={0.5} />
                    <Area type="monotone" dataKey="score" stroke="#0094FF" strokeWidth={2} fill="url(#projScoreGrad)"
                      dot={{ r: 4, fill: '#0094FF', cursor: 'pointer' }} activeDot={{ r: 6, cursor: 'pointer' }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.78rem' }}>
                  {t('pages.projectOverview.needMoreRuns')}
                </div>
              )}
            </div>

            <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '1.25rem', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem' }}>{t('pages.projectOverview.latestPillarScores')}</div>
              {pillarData.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  {pillarData.map(p => (
                    <div key={p.pillar} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '96px', fontSize: '0.7rem', color: 'var(--muted)', textAlign: 'right', flexShrink: 0 }}>{p.pillar}</div>
                      <div style={{ flex: 1, height: '7px', background: 'var(--bg)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${p.score}%`, background: p.color, borderRadius: '999px', transition: 'width 0.5s ease' }} />
                      </div>
                      <div style={{ width: '30px', fontSize: '0.72rem', fontWeight: 700, color: p.color, textAlign: 'right', flexShrink: 0 }}>{p.score}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.78rem' }}>
                  {t('pages.projectOverview.noPillarData')}
                </div>
              )}
            </div>
          </div>

          {/* ── Maturity Medal Badges ─────────────────────────────────────────── */}
          <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <SectionHeader
              title={t('pages.projectOverview.maturityLevelBadges')}
              sub={t('pages.projectOverview.maturityLevelBadgesSub')}
              count={earnedMaturityCount}
              total={MATURITY_META.length}
            />
            <div style={{ padding: '1.75rem 1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem' }}>
                {maturityBadges.map(m => (
                  <div key={m.level} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <MedalBadge
                      levelNum={m.level}
                      color={m.color}
                      textColor={m.textColor}
                      bg={m.bg}
                      earned={m.earned}
                    />
                    <div style={{ textAlign: 'center', maxWidth: '130px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: m.earned ? 'var(--text)' : '#475569' }}>{m.label}</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--muted)', marginTop: '0.2rem', lineHeight: 1.45 }}>{m.desc}</div>
                      <div style={{
                        marginTop: '0.35rem', fontSize: '0.6rem', fontWeight: 700,
                        color: m.earned ? m.textColor : '#2d3d54',
                      }}>
                        {m.earned ? t('pages.projectOverview.scoreReached', { score: String(MATURITY_THRESHOLDS[m.level]) }) : t('pages.projectOverview.requiresScore', { score: String(MATURITY_THRESHOLDS[m.level]) })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Achievement Badges ────────────────────────────────────────────── */}
          <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <SectionHeader
              title={t('pages.projectOverview.achievementBadges')}
              sub={t('pages.projectOverview.achievementBadgesSub')}
              count={earnedAchievementCount}
              total={ACHIEVEMENTS.length}
            />
            <div style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {(Object.entries(CATEGORY_LABEL) as [AchievementCategory, string][]).map(([cat, label]) => (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', color: 'var(--muted)' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: CATEGORY_COLOR[cat], flexShrink: 0 }} />
                    {label}
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.625rem' }}>
                {achievementBadges.map(a => (
                  <CircleBadge key={a.id} title={a.title} description={a.description} category={a.category} iconPath={a.iconPath} earned={a.earned} />
                ))}
              </div>
            </div>
          </div>

          {/* ── Verified Achievements (server-side) ──────────────────────────── */}
          {verifiedAchievements.length > 0 && (
            <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>{t('pages.projectOverview.verifiedAchievements')}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.15rem' }}>{t('pages.projectOverview.verifiedAchievementsSub')}</div>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                  {t('pages.projectOverview.milestonesRecorded', { count: String(verifiedAchievements.length), s: verifiedAchievements.length !== 1 ? 's' : '' })}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {verifiedAchievements.map((a, i) => {
                  const tierColors: Record<number, string> = { 1: '#d97706', 2: '#0094FF', 3: '#0891b2', 4: '#7c3aed', 5: '#059669' }
                  const color = tierColors[a.tier_level] ?? '#0094FF'
                  const isCopied = copiedToken === a.verification_token
                  const verifyUrl = `${getApiBase() || window.location.origin}/api/v1/public/achievements/${a.verification_token}`
                  return (
                    <div key={a.id} style={{
                      display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.875rem 1.25rem',
                      borderBottom: i < verifiedAchievements.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                        background: `${color}18`, border: `2px solid ${color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.72rem', fontWeight: 900, color,
                      }}>L{a.tier_level}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>{a.tier_label}</span>
                          <span style={{
                            fontSize: '0.6rem', fontWeight: 700, padding: '0.15rem 0.45rem', borderRadius: '999px',
                            background: `${color}14`, color, border: `1px solid ${color}30`,
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                          }}>Score {a.score}</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
                          {new Date(a.achieved_at).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        <a
                          href={verifyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.3rem',
                            padding: '0.3rem 0.65rem', borderRadius: '7px', fontSize: '0.72rem', fontWeight: 600,
                            background: `${color}12`, color, border: `1px solid ${color}30`,
                            textDecoration: 'none', cursor: 'pointer',
                          }}
                        >
                          <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          {t('pages.projectOverview.verify')}
                        </a>
                        <button
                          onClick={() => copyVerifyUrl(a.verification_token)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.3rem',
                            padding: '0.3rem 0.65rem', borderRadius: '7px', fontSize: '0.72rem', fontWeight: 600,
                            background: isCopied ? 'rgba(34,197,94,0.12)' : 'var(--bg)',
                            color: isCopied ? '#15803d' : 'var(--muted)',
                            border: `1px solid ${isCopied ? 'rgba(34,197,94,0.4)' : 'var(--border)'}`,
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}
                        >
                          <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {isCopied
                              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            }
                          </svg>
                          {isCopied ? t('pages.projectOverview.copied') : t('pages.projectOverview.copyLink')}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Recent scans table ────────────────────────────────────────────── */}
          <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>
              {t('pages.projectOverview.recentScans', { project: activeProject })}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  {[t('pages.projectOverview.colScore'), t('pages.projectOverview.colBranch'), t('pages.projectOverview.colStage'), t('pages.projectOverview.colTriggeredBy'), t('pages.projectOverview.colDate'), ''].map(h => (
                    <th key={h} style={{ padding: '0.55rem 1rem', textAlign: 'left', fontSize: '0.62rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...projectRuns].reverse().slice(0, 10).map((r, i, arr) => (
                  <tr key={r.id} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '0.65rem 1rem', fontWeight: 800, color: scoreColor(r.score) }}>{r.score}</td>
                    <td style={{ padding: '0.65rem 1rem', color: 'var(--muted)' }}>{r.branch || '—'}</td>
                    <td style={{ padding: '0.65rem 1rem', color: 'var(--muted)' }}>{r.stage || '—'}</td>
                    <td style={{ padding: '0.65rem 1rem', color: 'var(--muted)' }}>{r.triggered_by || '—'}</td>
                    <td style={{ padding: '0.65rem 1rem', color: 'var(--muted)' }}>{fmtFull(r.created_at)}</td>
                    <td style={{ padding: '0.65rem 1rem' }}>
                      <button onClick={() => onSelect(r.id)} style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'none', color: 'var(--waf-brand)', cursor: 'pointer', fontWeight: 600 }}>
                        {t('pages.projectOverview.open')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: '4rem', fontSize: '0.85rem' }}>
          {t('pages.projectOverview.noRuns')}
        </div>
      )}

    </div>
  )
}
