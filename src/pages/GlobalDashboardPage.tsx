import { useEffect, useState, useMemo } from 'react'
import { fetchProjectPassports, ProjectPassport, RunSummary } from '../api'
import { useI18n } from '../i18n'
import { Page, scoreColor } from '../routing'
import { MATURITY_META } from './settingsUtils'

// ── Pillar metadata ───────────────────────────────────────────────────────────
const PILLAR_META: { key: string; label: string; color: string }[] = [
  { key: 'security', label: 'Security', color: '#DA2C38' },
  { key: 'cost', label: 'Cost', color: '#0094FF' },
  { key: 'operations', label: 'Operations', color: '#8b5cf6' },
  { key: 'performance', label: 'Performance', color: '#f97316' },
  { key: 'reliability', label: 'Reliability', color: '#22c55e' },
  { key: 'sovereign', label: 'Sovereignty', color: '#eab308' },
  { key: 'sustainability', label: 'Sustainability', color: '#14b8a6' },
  { key: 'agentic', label: 'Agentic', color: '#ec4899' },
]

// ── Constants ─────────────────────────────────────────────────────────────────

const MATURITY_THRESHOLDS: Record<number, number> = { 1: 0, 2: 40, 3: 60, 4: 75, 5: 90 }

// ── Helper functions ─────────────────────────────────────────────────────────

// Normalize pillar names: database may have "operational", use "operations"
function normalizePillarName(pillar: string): string {
  if (pillar === 'operational') return 'operations'
  return pillar
}

function getMaturityForScore(score: number) {
  return [...MATURITY_META].reverse().find(m => score >= MATURITY_THRESHOLDS[m.level]) ?? MATURITY_META[0]
}

// Get a project index based on current date for rotation
function getRotatedIndex<T>(items: T[], daysOffset: number = 0): number {
  if (items.length === 0) return 0
  // Use date-based hash for consistent rotation (changes daily)
  const date = new Date()
  date.setDate(date.getDate() + daysOffset)
  const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  let hash = 0
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) % 100000
  }
  return hash % items.length
}

function getBestRunForProject(project: string, runs: RunSummary[]): RunSummary | null {
  const pRuns = runs.filter(r => (r.project || '(unnamed)') === project)
  if (pRuns.length === 0) return null
  return pRuns.reduce((latest, r) =>
    new Date(r.created_at) > new Date(latest.created_at) ? r : latest
  )
}

// ── Maturity Timeline Component ─────────────────────────────────────────────────

function MaturityTimeline({ runs, passports }: { runs: RunSummary[]; passports: ProjectPassport[] }) {
  const { t } = useI18n()

  // Calculate stage distribution for all projects
  const stageDistribution = useMemo(() => {
    const dist = [0, 0, 0, 0, 0, 0] // 6 stages
    // Use passports if available, otherwise compute from runs directly
    const projects = passports.length > 0 ? passports : null

    if (projects) {
      projects.forEach(passport => {
        const projectRuns = runs.filter(r => (r.project || '(unnamed)') === passport.project)
        if (projectRuns.length > 0) {
          const bestScore = projectRuns.reduce((m, r) => Math.max(m, r.score), 0)
          const stage = bestScore >= 90 ? 5 : bestScore >= 75 ? 4 : bestScore >= 60 ? 3 : bestScore >= 40 ? 2 : bestScore >= 20 ? 1 : 0
          dist[stage]++
        }
      })
    } else {
      // Fallback: compute from runs directly
      const projectBestScores = new Map<string, number>()
      runs.forEach(run => {
        const project = run.project || '(unnamed)'
        const existing = projectBestScores.get(project)
        if (!existing || run.score > existing) {
          projectBestScores.set(project, run.score)
        }
      })
      projectBestScores.forEach(score => {
        const stage = score >= 90 ? 5 : score >= 75 ? 4 : score >= 60 ? 3 : score >= 40 ? 2 : score >= 20 ? 1 : 0
        dist[stage]++
      })
    }
    return dist
  }, [runs, passports])

  const totalProjects = stageDistribution.reduce((a, b) => a + b, 0)

  // Stage metadata
  const STAGE_META = [
    { icon: '🏗', label: 'Hangar (0-19)', range: '0-19', color: '#ef4444', min: 0, max: 19 },
    { icon: '🔍', label: 'Pre-Flight (20-39)', range: '20-39', color: '#f97316', min: 20, max: 39 },
    { icon: '🚀', label: 'Boarding (40-59)', range: '40-59', color: '#eab308', min: 40, max: 59 },
    { icon: '✈', label: 'Takeoff (60-74)', range: '60-74', color: '#0094FF', min: 60, max: 74 },
    { icon: '🛫', label: 'Cruise (75-89)', range: '75-89', color: '#8b5cf6', min: 75, max: 89 },
    { icon: '🏁', label: 'Landing (90-100)', range: '90-100', color: '#059669', min: 90, max: 100 },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Flight path visualization - larger version */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '1.25rem', position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '1.25rem' }}>
          {t('pages.maturityJourney.hero')}
        </div>

        {/* SVG Flight Path - larger */}
        <svg width="100%" height="280" style={{ overflow: 'visible' }}>
          {/* Background gradient */}
          <defs>
            <linearGradient id="flightGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(0,148,255,0.05)" />
              <stop offset="100%" stopColor="rgba(0,148,255,0.01)" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#flightGradient)" />

          {/* Stage track - longer path for more spread */}
          <path d="M 40 240 Q 160 220 280 200 Q 400 180 520 160 Q 640 140 760 120 Q 880 100 1000 80"
            stroke="rgba(0,148,255,0.15)" strokeWidth="3" fill="none" />

          {/* Stage markers */}
          {STAGE_META.map((stage, idx) => {
            // Position calculation - more spread out
            const x = 40 + idx * 160
            const y = 240 - idx * 30

            const isActive = totalProjects > 0 && stageDistribution[idx] > 0
            const isCompleted = totalProjects > 0 && idx === Math.max(...stageDistribution.map((c, i) => c > 0 ? i : 0))

            return (
              <g key={idx} transform={`translate(${x}, ${y})`}>
                {/* Progress indicator */}
                {isActive && (
                  <circle cx="0" cy="0" r={16} fill={stage.color} opacity="0.3" />
                )}
                {/* Stage dot */}
                <circle cx="0" cy="0" r={isCompleted ? 9 : 8}
                  fill={stage.color}
                  stroke={isActive ? 'rgba(255,255,255,0.6)' : 'rgba(0,148,255,0.3)'}
                  strokeWidth={3} />
                {/* Project count badge */}
                {isActive && (
                  <circle cx="20" cy="-20" r={9} fill={stage.color} />
                )}
                {isActive && (
                  <text x="20" y="-20" textAnchor="middle" dominantBaseline="central"
                    fontSize="10" fontWeight="800" fill="#fff">{stageDistribution[idx]}</text>
                )}
                {/* Icon */}
                <text x="0" y="28" textAnchor="middle" fontSize="12" fontWeight="600" fill="#475569">
                  {stage.icon}
                </text>
                {/* Range */}
                <text x="0" y="42" textAnchor="middle" fontSize="9" fontWeight="500" fill="#64748b">
                  {stage.range}
                </text>
              </g>
            )
          })}
        </svg>

        {/* Legend below the SVG */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem', flexWrap: 'wrap', fontSize: '0.65rem' }}>
          {STAGE_META.map((stage, idx) => (
            <span key={idx} style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              background: 'var(--surface)',
              border: `1px solid ${stage.color}30`,
            }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: stage.color, flexShrink: 0,
              }} />
              <span style={{ color: 'var(--text)', fontSize: '0.65rem', fontWeight: 600 }}>
                {stage.range}
              </span>
              {stageDistribution[idx] > 0 && (
                <span style={{
                  marginLeft: '0.25rem', padding: '0.15rem 0.4rem',
                  borderRadius: '999px', background: `${stage.color}18`, color: stage.color,
                  fontSize: '0.55rem', fontWeight: 700,
                }}>
                  {stageDistribution[idx]}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Top projects by maturity - moved to main component where topProjects is available */}
    </div>
  )
}

// ── Recent Activity List ──────────────────────────────────────────────────────

function RecentActivity({ runs }: { runs: RunSummary[] }) {
  const { t } = useI18n()
  const activities = useMemo(() => {
    const result: { id: string; type: 'scan'; project: string; message: string; timestamp: string; score?: number }[] = []

    // Add recent scans (latest from each project)
    const projectLastScan = new Map<string, RunSummary>()
    runs.forEach(run => {
      const existing = projectLastScan.get(run.project)
      if (!existing || new Date(run.created_at) > new Date(existing.created_at)) {
        projectLastScan.set(run.project, run)
      }
    })

    projectLastScan.forEach((run, project) => {
      result.push({
        id: `scan-${run.id}`,
        type: 'scan',
        project,
        message: t('pages.globaldashboard.scanCompleted', { score: run.score }),
        timestamp: run.created_at,
        score: run.score,
      })
    })

    // Sort by timestamp descending
    return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [runs])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {activities.slice(0, 8).map((activity) => (
        <div key={activity.id} style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.5rem 0.75rem', borderRadius: '8px',
          background: 'var(--surface)', border: '1px solid var(--border)',
        }}>
          {/* Type icon */}
          <div style={{
            width: '32px', height: '32px', borderRadius: '6px',
            background: 'rgba(0,148,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#0094FF',
          }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>{activity.message}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
              <span style={{ fontWeight: 600 }}>{activity.project}</span> ·
              <span style={{ marginLeft: '0.35rem' }}>
                {new Date(activity.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          {/* Score badge if present */}
          {activity.score !== undefined && (
            <div style={{
              padding: '0.15rem 0.5rem', borderRadius: '999px',
              background: activity.score >= 80 ? 'rgba(5,150,105,0.08)' :
                       activity.score >= 60 ? 'rgba(217,119,6,0.08)' : 'rgba(218,44,56,0.08)',
              border: `1px solid ${activity.score >= 80 ? '#16a34a' : activity.score >= 60 ? '#d97706' : '#DA2C38'}40`,
            }}>
              <span style={{
                fontSize: '0.65rem', fontWeight: 700,
                color: activity.score >= 80 ? '#16a34a' :
                       activity.score >= 60 ? '#d97706' : '#DA2C38',
              }}>
                {activity.score}/100
              </span>
            </div>
          )}
        </div>
      ))}
      {activities.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
          <p style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>{t('pages.globaldashboard.noActivity')}</p>
          <p style={{ fontSize: '0.7rem', opacity: 0.7 }}>{t('pages.globaldashboard.runScansHint')}</p>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export interface GlobalDashboardProps {
  runs: RunSummary[]
  navigate: (page: Page) => void
}

export default function GlobalDashboardPage({
  runs, navigate,
}: GlobalDashboardProps) {
  const { t } = useI18n()

  // State - must be at top level, before any returns
  const [passports, setPassports] = useState<ProjectPassport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Effect - must be at top level, before any returns
  useEffect(() => {
    fetchProjectPassports()
      .then(setPassports)
      .catch((e) => {
        console.error('Failed to fetch passports:', e)
        setError('Failed to load passports: ' + (e as Error).message)
      })
      .finally(() => setLoading(false))
  }, [])

  // Calculate metrics - must be at top level, before any returns
  const latestRun = useMemo(() => {
    if (runs.length === 0) return null
    return runs.reduce((latest, run) =>
      new Date(run.created_at) > new Date(latest.created_at) ? run : latest
    )
  }, [runs])

  // Total projects: use passports if available, otherwise count unique projects from runs
  const totalProjects = useMemo(() => {
    if (passports.length > 0) {
      return passports.length
    }
    // Fallback: count unique projects from runs
    const projects = new Set(runs.map(r => r.project || '(unnamed)'))
    return projects.size
  }, [passports, runs])

  const avgScore = useMemo(() => {
    if (runs.length === 0) return 0
    const total = runs.reduce((sum, r) => sum + r.score, 0)
    return Math.round(total / runs.length)
  }, [runs])

  // Maturity distribution: use passports if available, otherwise compute from runs
  const maturityDistribution = useMemo(() => {
    const dist = { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0 }
    if (passports.length > 0) {
      passports.forEach(passport => {
        const projectRuns = runs.filter(r => (r.project || '(unnamed)') === passport.project)
        if (projectRuns.length > 0) {
          const bestScore = projectRuns.reduce((m, r) => Math.max(m, r.score), 0)
          if (bestScore >= 90) dist.L5++
          else if (bestScore >= 75) dist.L4++
          else if (bestScore >= 60) dist.L3++
          else if (bestScore >= 40) dist.L2++
          else dist.L1++
        }
      })
    } else {
      // Fallback: compute from runs directly
      const projectBestScores = new Map<string, number>()
      runs.forEach(run => {
        const project = run.project || '(unnamed)'
        const existing = projectBestScores.get(project)
        if (!existing || run.score > existing) {
          projectBestScores.set(project, run.score)
        }
      })
      projectBestScores.forEach(score => {
        if (score >= 90) dist.L5++
        else if (score >= 75) dist.L4++
        else if (score >= 60) dist.L3++
        else if (score >= 40) dist.L2++
        else dist.L1++
      })
    }
    return dist
  }, [passports, runs])

  // Top projects by score (use passports if available, otherwise use runs directly)
  const topProjects = useMemo(() => {
    let projectScores: { project: string; displayName: string; score: number }[]

    if (passports.length > 0) {
      projectScores = passports.map(p => {
        const pRuns = runs.filter(r => (r.project || '(unnamed)') === p.project)
        const bestScore = pRuns.reduce((m, r) => Math.max(m, r.score), 0)
        return { project: p.project, displayName: p.display_name || p.project, score: bestScore }
      })
    } else {
      // Fallback: compute from runs directly if no passports available
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

    return projectScores.sort((a, b) => b.score - a.score).slice(0, 5)
  }, [passports, runs])

  // Top projects by maturity (excellence standard) - shows L4/L5 projects
  const topExcellenceProjects = useMemo(() => {
    return topProjects.filter(p => p.score >= 75).slice(0, 5)
  }, [topProjects])

  // Early returns - these can happen after all hooks are defined
  if (error) {
    return (
      <div style={{ padding: '2rem', color: '#DA2C38', background: '#fee2e2', borderRadius: '8px' }}>
        <h3 style={{ margin: '0 0 0.5rem' }}>Error Loading Global Dashboard</h3>
        <p style={{ margin: 0 }}>{error}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div className="spinner" />
      </div>
    )
  }

  // Fallback in case something goes wrong
  if (!runs || runs.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
        <p style={{ margin: 0 }}>No run data available. Please run a WAF++ scan first.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ══════════════════════════════════════════════════════════════════
          OPERATIONAL CENTER - Centralized Overview
      ══════════════════════════════════════════════════════════════════ */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '1.5rem',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              background: 'rgba(0,148,255,0.1)',
              border: '1px solid rgba(0,148,255,0.2)',
              borderRadius: 999, padding: '0.25rem 0.75rem', marginBottom: '0.5rem',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0094FF', display: 'inline-block' }} />
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#0094FF', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
                {t('pages.globaldashboard.operationalCenter')}
              </span>
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
              {t('pages.maturityJourney.hero')}
            </h1>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => navigate('passports')} style={{
              padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(0,148,255,0.2)',
              background: 'rgba(0,148,255,0.05)', color: '#0094FF', fontSize: '0.78rem', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
            }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,148,255,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,148,255,0.05)'}>
              {t('common.view')} {t('pages.passportDashboard.badgeDownload')}
            </button>
            <button onClick={() => navigate('runs')} style={{
              padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)', fontSize: '0.78rem', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
            }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}>
              {t('nav.items.runs')}
            </button>
          </div>
        </div>

        {/* Key Metrics Grid - Global Score first */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          {/* Global Score (first position) */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: '12px', padding: '1rem',
            border: '1px solid var(--border)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '0.5rem' }}>
              {t('pages.globaldashboard.globalScore')}
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: scoreColor(latestRun?.score ?? 0) }}>
              {latestRun?.score ?? 0}/100
            </div>
          </div>

          {/* Total Projects */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: '12px', padding: '1rem',
            border: '1px solid var(--border)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '0.5rem' }}>
              {t('pages.globaldashboard.totalProjects')}
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#0094FF' }}>
              {totalProjects}
            </div>
          </div>

          {/* Last Scan */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: '12px', padding: '1rem',
            border: '1px solid var(--border)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '0.5rem' }}>
              {t('pages.globaldashboard.lastScan')}
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text)' }}>
              {latestRun ? new Date(latestRun.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
            </div>
          </div>

          {/* Average Score */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: '12px', padding: '1rem',
            border: '1px solid var(--border)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '0.5rem' }}>
              {t('pages.globaldashboard.avgScore')}
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: scoreColor(avgScore) }}>
              {avgScore}/100
            </div>
          </div>
        </div>

        {/* Maturity Distribution & Top Projects */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Maturity Distribution */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.5rem' }}>
              {t('pages.globaldashboard.maturityDistribution')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {[
                { label: 'L5 - Excellence (90+)', count: maturityDistribution.L5, color: '#059669' },
                { label: 'L4 - Optimized (75-89)', count: maturityDistribution.L4, color: '#8b5cf6' },
                { label: 'L3 - Governed (40-59)', count: maturityDistribution.L3, color: '#0094FF' },
                { label: 'L2 - Operational (20-39)', count: maturityDistribution.L2, color: '#f97316' },
                { label: 'L1 - Foundational (0-19)', count: maturityDistribution.L1, color: '#ef4444' },
              ].map((item) => (
                <div key={item.label} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.4rem 0.6rem', borderRadius: '6px',
                  background: 'var(--surface)', border: `1px solid ${item.color}20`,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                  <div style={{ flex: 1, fontSize: '0.65rem', color: 'var(--text)' }}>
                    {t(`pages.globaldashboard.pillarLevel`, { level: item.label.charAt(1) })}
                  </div>
                  <div style={{
                    fontSize: '0.6rem', fontWeight: 700, color: item.color,
                    padding: '0.1rem 0.3rem', borderRadius: '999px',
                    background: `${item.color}18`,
                    border: `1px solid ${item.color}30`,
                  }}>
                    {item.count}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Projects by Score */}
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.5rem' }}>
              {t('pages.globaldashboard.topProjects')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {topProjects.map((p, i) => {
                const maturity = getMaturityForScore(p.score)
                return (
                  <div key={p.project} style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.4rem 0.6rem', borderRadius: '6px',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                  }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#64748b', width: '1.25rem' }}>
                      #{i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.displayName}
                      </div>
                    </div>
                    <div style={{
                      fontSize: '0.55rem', fontWeight: 700, color: maturity.color,
                      padding: '0.15rem 0.35rem', borderRadius: '999px',
                      background: `${maturity.color}18`,
                      border: `1px solid ${maturity.color}30`,
                    }}>
                      {t('pages.globaldashboard.level')} {maturity.level}
                    </div>
                  </div>
                )
              })}
              {topProjects.length === 0 && (
                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--muted)', fontSize: '0.65rem' }}>
              {t('pages.globaldashboard.noProjects')}
                </div>
              )}
            </div>
          </div>

          {/* Top projects by maturity (Excellence Standard) */}
          {topExcellenceProjects.length > 0 && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '0.5rem' }}>
                {t('pages.maturityJourney.excellenceStandard')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {topExcellenceProjects.map((p, i) => {
                  const maturity = getMaturityForScore(p.score)
                  return (
                    <div key={p.project} style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.6rem 0.875rem', borderRadius: '8px',
                      background: 'var(--surface)', border: '1px solid var(--border)',
                    }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', width: '1.5rem' }}>
                        #{i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>
                          {p.displayName}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
                          {p.score}/100 • {maturity.short}
                        </div>
                      </div>
                      <div style={{
                        padding: '0.2rem 0.5rem', borderRadius: '999px',
                        background: `${maturity.color}18`, color: maturity.color,
                        border: `1px solid ${maturity.color}35`,
                      }}>
                        <span style={{ fontSize: '0.6rem', fontWeight: 700 }}>L{maturity.level}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Pillar Health Summary - scaled down */}
        {latestRun && Object.entries(latestRun.pillar_scores).length > 0 && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.75rem' }}>
              {t('pages.globaldashboard.pillarHealth')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
              {/* Show all 8 pillars from PILLAR_META, using normalized pillar_scores from the run */}
              {(() => {
                // Normalize the run's pillar_scores
                const normalizedScores: Record<string, number> = {}
                if (latestRun.pillar_scores) {
                  for (const [key, value] of Object.entries(latestRun.pillar_scores)) {
                    normalizedScores[normalizePillarName(key)] = value
                  }
                }
                return PILLAR_META.map((p: typeof PILLAR_META[0]) => {
                  const score = normalizedScores[p.key] ?? 0
                  const isExcellent = score >= 80
                  const isFailing = score < 60
                  const color = isExcellent ? '#059669' : isFailing ? '#DA2C38' : '#d97706'
                  return (
                    <div key={p.key} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem',
                      padding: '0.6rem', borderRadius: '6px',
                      background: 'var(--surface)', border: `1px solid ${color}30`,
                    }}>
                      <div style={{ fontSize: '0.55rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                        {p.label}
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: color }}>
                        {score}/100
                      </div>
                      <div style={{
                        fontSize: '0.5rem', fontWeight: 600, padding: '0.1rem 0.3rem', borderRadius: '999px',
                        background: `${color}18`, color: color,
                      }}>
                        {isExcellent ? t('common.health') : isFailing ? t('common.needsAttention') : t('common.improving')}
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
            <div style={{ fontSize: '0.55rem', color: 'var(--muted)', marginTop: '0.5rem', textAlign: 'center' }}>
              {t('pages.globaldashboard.showingXPillars', { count: PILLAR_META.length })}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MATURITY JOURNEY TIMELINE
      ══════════════════════════════════════════════════════════════════ */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '1.5rem',
      }}>
        <div>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.25rem' }}>
            {t('pages.maturityJourney.flightMap')}
          </h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0 }}>
            {t('pages.maturityJourney.flightMapDesc')}
          </p>
        </div>

        {/* Flight Map with Project Showcase */}
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'stretch' }}>
          {/* Left: Flight Timeline */}
          <div style={{ flex: '0 0 50%', minWidth: 0 }}>
            <MaturityTimeline runs={runs} passports={passports} />
          </div>

          {/* Right: Project Showcase Meta Info - 50% width */}
          <div style={{
            flex: 1,
            minWidth: 0,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: 999, padding: '0.25rem 0.75rem', marginBottom: '1rem',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6', display: 'inline-block' }} />
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#8b5cf6', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
                {t('pages.globaldashboard.featuredProject')}
              </span>
            </div>

            {/* Project of the Day badge */}
            {topProjects.length > 0 && (() => {
              const featuredIndex = getRotatedIndex(topProjects)
              const p = topProjects[featuredIndex]
              const bestRun = getBestRunForProject(p.project, runs)
              return bestRun ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 0.75rem', borderRadius: '8px',
                  background: 'rgba(217, 119, 6, 0.08)',
                  border: '1px solid rgba(217, 119, 6, 0.2)',
                  fontSize: '0.65rem',
                }}>
              <span>⭐</span>
              <span style={{ color: '#d97706', fontWeight: 600 }}>
                Project of the Day: {p.displayName}
              </span>
              <span style={{ marginLeft: 'auto', color: 'var(--muted)' }}>
                {new Date().toLocaleDateString(undefined, { weekday: 'long' })}
              </span>
                </div>
              ) : null
            })()}

            {/* Show top performing project */}
            {topProjects.length > 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {(() => {
                  const featuredIndex = getRotatedIndex(topProjects)
                  const p = topProjects[featuredIndex]
                  const bestRun = getBestRunForProject(p.project, runs)
                  const maturity = getMaturityForScore(p.score)

                  return (
                    <div key={p.project} style={{
                      padding: '1rem', borderRadius: '10px',
                      background: 'var(--surface)', border: `1px solid ${maturity.color}20`,
                      display: 'flex', flexDirection: 'column', gap: '0.75rem',
                    }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)' }}>
                          {p.displayName}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
                          {bestRun?.project} · {bestRun?.branch}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div style={{
                          padding: '0.75rem', borderRadius: '8px',
                          background: `${maturity.color}10`, border: `1px solid ${maturity.color}20`,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                        }}>
                          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: maturity.color }}>
                            {p.score}
                          </span>
                          <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--muted)' }}>
                            Score
                          </span>
                        </div>
                        <div style={{
                          padding: '0.75rem', borderRadius: '8px',
                          background: 'rgba(0,148,255,0.10)', border: '1px solid rgba(0,148,255,0.20)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                        }}>
                          <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0094FF' }}>
                            {maturity.level}
                          </span>
                          <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--muted)' }}>
                            Level
                          </span>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.65rem', color: 'var(--muted)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {bestRun && (
                          <span title="Last scan">
                            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginRight: '0.15rem' }}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {new Date(bestRun.created_at).toLocaleDateString()}
                          </span>
                        )}
                        <span title="Projects in this level">
                          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginRight: '0.15rem' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          {maturityDistribution[maturity.short as keyof typeof maturityDistribution] || 0} projects
                        </span>
                      </div>

                      {/* Pillar breakdown */}
                      {bestRun && Object.entries(bestRun.pillar_scores).length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--muted)' }}>
                            Pillar Scores
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {Object.entries(bestRun.pillar_scores).slice(0, 4).map(([pillar, score]) => {
                              const isExcellent = score >= 80
                              const isFailing = score < 60
                              const color = isExcellent ? '#059669' : isFailing ? '#DA2C38' : '#d97706'
                              return (
                                <div key={pillar} style={{
                                  padding: '0.25rem 0.5rem', borderRadius: '999px',
                                  background: `${color}10`, border: `1px solid ${color}20`,
                                }}>
                                  <span style={{ fontSize: '0.55rem', fontWeight: 700, color }}>
                                    {pillar}: {score}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                <p style={{ textAlign: 'center', fontSize: '0.75rem' }}>
                {t('pages.globaldashboard.noFeaturedProjects')}
                </p>
              </div>
            )}

            {/* Recent Star - projects that improved recently */}
            {topProjects.length > 0 && (() => {
              // Pick a different project for "Star of the Week"
              const starIndex = getRotatedIndex(topProjects, -7)
              const starProject = topProjects[starIndex]
              const starRun = getBestRunForProject(starProject.project, runs)
              const starMaturity = getMaturityForScore(starProject.score)

              return (
                <div style={{
                  marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)',
                  fontSize: '0.65rem', color: 'var(--muted)',
                }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                    background: 'rgba(5, 150, 105, 0.1)',
                    border: '1px solid rgba(5, 150, 105, 0.2)',
                    borderRadius: 999, padding: '0.25rem 0.75rem', marginBottom: '1rem',
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#059669', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
                      Star of the Week
                    </span>
                  </div>
                  <div style={{
                    padding: '1rem', borderRadius: '10px',
                    background: 'var(--surface)', border: `1px solid #05966920`,
                  }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)' }}>
                      <span style={{ marginRight: '0.5rem' }}>🚀</span>
                      {starProject.displayName}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                      <div>
                        <span style={{ color: 'var(--muted)', fontSize: '0.65rem' }}>Score:</span>
                        <span style={{ marginLeft: '0.25rem', fontWeight: 700, color: '#059669' }}>{starProject.score}/100</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--muted)', fontSize: '0.65rem' }}>Level:</span>
                        <span style={{ marginLeft: '0.25rem', fontWeight: 700, color: '#059669' }}>L{starMaturity.level}</span>
                      </div>
                      {starRun && (
                        <div>
                          <span style={{ color: 'var(--muted)', fontSize: '0.65rem' }}>Last:</span>
                          <span style={{ marginLeft: '0.25rem', fontWeight: 600 }}>
                            {new Date(starRun.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}

          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          RECENT ACTIVITY FEED
      ══════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.25rem' }}>
            {t('pages.globaldashboard.recentActivity')}
          </h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', margin: 0 }}>
            {t('pages.globaldashboard.latestScans')}
          </p>
        </div>

        <RecentActivity runs={runs} />
      </div>

    </div>
  )
}
