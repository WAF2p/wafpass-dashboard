import { useState, useMemo } from 'react'
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts'
import { RunSummary } from '../api'
import { useI18n } from '../i18n'
import SavedViewsControl from '../components/SavedViewsControl'
import RunTrendOverlay from '../components/RunTrendOverlay'
import { useBetaFeatures } from '../beta/BetaFeaturesContext'
import { BETA_RUN_BOOKMARKS } from './userPrefsUtils'
import { scoreColor } from '../severity';
import { scoreBg } from '../severity';
import { Card, DataTable, EmptyState, type Column } from '../ui';
import { PAGE_TITLE } from '../routing'

interface Props {
  runs: RunSummary[]
  onSelect: (id: string) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PROJECT_COLORS = [
  '#0094FF', '#f97316', '#a855f7', '#22c55e', '#eab308', '#ec4899', '#14b8a6',
]
const PILLAR_META: { key: string; label: string; color: string }[] = [
  { key: 'security',       label: 'Security',       color: '#DA2C38' },
  { key: 'cost',           label: 'Cost',           color: '#0094FF' },
  { key: 'operations',     label: 'Operations',     color: '#8b5cf6' },
  { key: 'performance',    label: 'Performance',    color: '#f97316' },
  { key: 'reliability',    label: 'Reliability',    color: '#22c55e' },
  { key: 'sovereign',      label: 'Sovereignty',    color: '#eab308' },
  { key: 'sustainability', label: 'Sustainability', color: '#14b8a6' },
  { key: 'agentic',        label: 'Agentic',        color: '#ec4899' },
]

// Normalize pillar names: database uses "operational", dashboard uses "operations"
function normalizePillarName(pillar: string): string {
  if (pillar === 'operational') return 'operations'
  return pillar
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
function fmtFull(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
const PAGE_SIZE = 50

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ScoreTooltip({ active, payload, label }: any) {
  const { t } = useI18n()
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px',
      padding: '0.75rem 0.875rem', boxShadow: '0 4px 16px rgba(15,23,42,.12)',
      fontSize: '0.78rem', minWidth: '160px',
    }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '0.5rem', fontWeight: 600 }}>{label}</div>
      {payload.map((entry: any) => (
        <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
          <span style={{ color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
          <span style={{ fontWeight: 800, color: scoreColor(entry.value) }}>{entry.value}</span>
          {entry.payload?.branch && (
            <span style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>· {entry.payload.branch}</span>
          )}
        </div>
      ))}
      <div style={{ marginTop: '0.4rem', fontSize: '0.7rem', color: 'var(--muted)' }}>{t('pages.phase3.restB.runsList.clickDotToOpen')}</div>
    </div>
  )
}

function PillarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const v = payload[0]?.value
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px',
      padding: '0.5rem 0.75rem', boxShadow: '0 4px 12px rgba(15,23,42,.1)',
      fontSize: '0.75rem',
    }}>
      <div style={{ color: 'var(--muted)', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ fontWeight: 800, color: scoreColor(v) }}>{v}</div>
    </div>
  )
}

// ── Trend view ────────────────────────────────────────────────────────────────
function TrendView({ runs, onSelect }: Props) {
  const { t } = useI18n()
  const sorted = useMemo(
    () => [...runs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [runs]
  )

  const projects = useMemo(
    () => [...new Set(sorted.map(r => r.project || '(no project)'))],
    [sorted]
  )

  // Per-project series for the main chart
  const projectSeries = useMemo(() =>
    projects.map((proj, i) => ({
      proj,
      color: PROJECT_COLORS[i % PROJECT_COLORS.length],
      data: sorted
        .filter(r => (r.project || '(no project)') === proj)
        .map(r => ({
          date: fmt(r.created_at),
          dateFull: fmtFull(r.created_at),
          score: r.score,
          id: r.id,
          branch: r.branch,
          sha: r.git_sha?.slice(0, 7),
        })),
    })),
    [projects, sorted]
  )

  // Per-pillar series (all runs, combined)
  const pillarSeries = useMemo(() => {
    // Build a normalized pillar_scores map for each run
    const normalizedRunScores = sorted.map(run => {
      const normalized: Record<string, number> = {}
      if (run.pillar_scores) {
        for (const [key, value] of Object.entries(run.pillar_scores)) {
          normalized[normalizePillarName(key)] = value
        }
      }
      return { id: run.id, scores: normalized }
    })
    const scoreMap = new Map(normalizedRunScores.map(r => [r.id, r.scores]))

    return PILLAR_META.map(pm => ({
      ...pm,
      data: sorted
        .filter(r => scoreMap.get(r.id)?.[pm.key] !== undefined)
        .map(r => ({
          date: fmt(r.created_at),
          score: scoreMap.get(r.id)?.[pm.key] ?? null,
          id: r.id,
        })),
    }))
  }, [sorted])

  // Summary stats
  const firstRun = sorted[0]
  const lastRun  = sorted[sorted.length - 1]
  const overallDelta = lastRun.score - firstRun.score
  const dateRange = sorted.length > 1
    ? `${fmt(firstRun.created_at)} – ${fmt(lastRun.created_at)}`
    : fmt(firstRun.created_at)

  // Branch filter
  const branches = useMemo(
    () => [...new Set(sorted.map(r => r.branch).filter(Boolean))].sort(),
    [sorted]
  )
  const [branchFilter, setBranchFilter] = useState('')
  const filteredSeries = useMemo(() =>
    branchFilter
      ? projectSeries.map(ps => ({ ...ps, data: ps.data.filter(d => d.branch === branchFilter) }))
      : projectSeries,
    [projectSeries, branchFilter]
  )

  function handleDotClick(_: any, payload: any) {
    const id = payload?.payload?.id
    if (id) onSelect(id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Summary strip ── */}
      <div className="card" style={{ padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1, color: 'var(--text)' }}>{sorted.length}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginLeft: '0.35rem' }}>{t('pages.phase3.restB.runsList.runs')}</span>
        </div>
        <div style={{ width: '1px', height: '28px', background: 'var(--border)' }} />
        <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{dateRange}</div>
        <div style={{ width: '1px', height: '28px', background: 'var(--border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: scoreColor(firstRun.score), lineHeight: 1 }}>{firstRun.score}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('pages.runs.first')}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
            <svg width="28" height="12" viewBox="0 0 28 12">
              <line x1="0" y1="6" x2="20" y2="6" stroke="var(--skip)" strokeWidth="1.5" />
              <polygon points="20,2 28,6 20,10" fill="var(--skip)" />
            </svg>
            <span style={{
              fontSize: '0.7rem', fontWeight: 700,
              color: overallDelta > 0 ? 'var(--score-high-ink)' : overallDelta < 0 ? 'var(--score-low-ink)' : 'var(--muted)',
            }}>
              {t('pages.phase3.restB.runsList.pointsDelta', { delta: `${overallDelta > 0 ? '+' : ''}${overallDelta}` })}
            </span>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: scoreColor(lastRun.score), lineHeight: 1 }}>{lastRun.score}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('pages.runs.latest')}</div>
          </div>
        </div>
        <div style={{ width: '1px', height: '28px', background: 'var(--border)' }} />
        <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
          {t('pages.runs.projects', { count: projects.length })}
        </div>
        {branches.length > 1 && (
          <>
            <div style={{ width: '1px', height: '28px', background: 'var(--border)' }} />
            <select
              value={branchFilter} onChange={e => setBranchFilter(e.target.value)}
              className="filter-select" style={{ fontSize: '0.75rem' }}
            >
              <option value="">{t('pages.runs.allBranches')}</option>
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </>
        )}
      </div>

      {/* ── Overall score trend ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {t('pages.runs.overallScore')}
          </span>
          <div style={{ display: 'flex', gap: '1.25rem', marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '20px', height: '1.5px', background: 'var(--score-high)', display: 'inline-block', borderTop: '1.5px dashed var(--score-high)' }} /> 80
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '20px', height: '1.5px', background: 'var(--score-mid)', display: 'inline-block', borderTop: '1.5px dashed var(--score-mid)' }} /> 60
            </span>
          </div>
        </div>
        <div style={{ padding: '1rem 0.5rem 0.5rem' }}>
          {sorted.length < 2 ? (
            <EmptyState compact title={t('pages.runs.needTwoScans')} />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date" type="category" allowDuplicatedCategory={false}
                  tick={{ fontSize: 11, fill: 'var(--skip)' }} tickLine={false} axisLine={false}
                  interval="preserveStartEnd" padding={{ left: 16, right: 16 }}
                />
                <YAxis
                  domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--skip)' }}
                  tickLine={false} axisLine={false} width={28}
                />
                <Tooltip content={<ScoreTooltip />} />
                {projects.length > 1 && (
                  <Legend
                    wrapperStyle={{ fontSize: '0.72rem', paddingTop: '0.5rem' }}
                    formatter={(v) => v.length > 24 ? v.slice(0, 23) + '…' : v}
                  />
                )}
                <ReferenceLine y={80} stroke="var(--score-high)" strokeDasharray="4 4" strokeWidth={1} />
                <ReferenceLine y={60} stroke="var(--score-mid)" strokeDasharray="4 4" strokeWidth={1} />
                {filteredSeries.map(({ proj, color, data }) => (
                  data.length > 0 && (
                    <Line
                      key={proj}
                      data={data}
                      dataKey="score"
                      name={proj}
                      stroke={color}
                      strokeWidth={2}
                      type="monotone"
                      dot={{ r: 4, fill: color, strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: color, strokeWidth: 2, stroke: 'var(--surface)', onClick: handleDotClick, style: { cursor: 'pointer' } }}
                      connectNulls
                    />
                  )
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Pillar sparklines ── */}
      {pillarSeries.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('pages.runs.pillarScores')}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1px', background: 'var(--border)' }}>
            {pillarSeries.map(({ key, color, data }) => {
              const latest  = data[data.length - 1]?.score ?? 0
              const first   = data[0]?.score ?? 0
              const delta   = data.length > 1 ? latest - first : null
              return (
                <div key={key} style={{ background: 'var(--surface)', padding: '0.875rem 1rem 0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t(`pages.phase3.restB.runsList.pillar.${key}`)}</span>
                      {delta !== null && (
                        <span style={{
                          marginLeft: '0.4rem', fontSize: '0.7rem', fontWeight: 700,
                          color: delta > 0 ? 'var(--score-high-ink)' : delta < 0 ? 'var(--score-low-ink)' : 'var(--muted)',
                        }}>
                          {delta > 0 ? '↑' : delta < 0 ? '↓' : '—'}{delta !== 0 ? Math.abs(delta) : ''}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: scoreColor(latest), lineHeight: 1 }}>{latest}</span>
                  </div>
                  {data.length < 2 ? (
                    <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{t('pages.runs.singleRun')}</span>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={72}>
                      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                            <stop offset="95%" stopColor={color} stopOpacity={0.03} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" hide />
                        <YAxis domain={[0, 100]} hide />
                        <Tooltip content={<PillarTooltip />} />
                        <Area
                          type="monotone" dataKey="score" name={t(`pages.phase3.restB.runsList.pillar.${key}`)}
                          stroke={color} strokeWidth={1.75}
                          fill={`url(#grad-${key})`}
                          dot={false}
                          activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}

// ── Table components (unchanged) ──────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const color = scoreColor(score)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: '2.75rem', padding: '0.2rem 0.6rem', borderRadius: '999px',
      background: scoreBg(score, 9), color, fontWeight: 700, fontSize: '0.85rem',
    }}>
      {score}
    </span>
  )
}

const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  prod:       { bg: 'color-mix(in srgb, var(--fail) 8%, var(--surface))', text: 'var(--fail-ink)' },
  production: { bg: 'color-mix(in srgb, var(--fail) 8%, var(--surface))', text: 'var(--fail-ink)' },
  staging:    { bg: 'color-mix(in srgb, var(--waf-warn) 8%, var(--surface))', text: 'var(--score-mid-ink)' },
  stage:      { bg: 'color-mix(in srgb, var(--waf-warn) 8%, var(--surface))', text: 'var(--score-mid-ink)' },
  dev:        { bg: 'color-mix(in srgb, var(--pass) 8%, var(--surface))', text: 'var(--pass-ink)' },
  development:{ bg: 'color-mix(in srgb, var(--pass) 8%, var(--surface))', text: 'var(--pass-ink)' },
  test:       { bg: 'color-mix(in srgb, var(--waf-brand) 8%, var(--surface))', text: 'var(--waf-brand-ink)' },
  qa:         { bg: 'color-mix(in srgb, var(--waf-info) 8%, var(--surface))', text: 'var(--waf-info)' },
}

function StageBadge({ stage }: { stage: string }) {
  if (!stage) return <span style={{ color: 'var(--muted)' }}>—</span>
  const colors = STAGE_COLORS[stage.toLowerCase()] ?? { bg: 'var(--bg)', text: 'var(--skip-ink)' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '0.15rem 0.5rem', borderRadius: '999px',
      background: colors.bg, color: colors.text,
      fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap',
    }}>
      {stage}
    </span>
  )
}

function RunsTable({ runs, onSelect }: { runs: RunSummary[]; onSelect: (id: string) => void }) {
  const { t } = useI18n()
  const { prefs, isEnabled, update } = useBetaFeatures()
  const bookmarkEnabled = isEnabled(BETA_RUN_BOOKMARKS)

  const toggleBookmark = (r: RunSummary, event: React.MouseEvent) => {
    event.stopPropagation()
    if (!bookmarkEnabled) return
    const current = prefs.bookmarkedRuns ?? []
    const bookmarked = current.includes(r.id)
    const next = bookmarked ? current.filter(id => id !== r.id) : [...current, r.id].slice(-5)
    update({ bookmarkedRuns: next })
  }

  const columns: Column<RunSummary>[] = [
    {
      key: 'project',
      header: t('pages.runs.colProject'),
      render: r => {
        const bookmarked = (prefs.bookmarkedRuns ?? []).includes(r.id)
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '.45rem' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--waf-brand)' }}>{r.project || '—'}</div>
              {r.git_sha && <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'monospace', marginTop: '0.15rem' }}>{r.git_sha.slice(0, 7)}</div>}
            </div>
            {bookmarkEnabled && (
              <button
                type="button"
                className={`run-bookmark${bookmarked ? ' is-on' : ''}`}
                aria-pressed={bookmarked}
                aria-label={bookmarked ? t('pages.phase3.restB.runsList.removeBookmark') : t('pages.phase3.restB.runsList.bookmarkRun')}
                title={bookmarked ? t('pages.phase3.restB.runsList.removeBookmark') : t('pages.phase3.restB.runsList.bookmarkRun')}
                onClick={event => toggleBookmark(r, event)}
              >
                <svg width="14" height="14" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h12a1 1 0 011 1v16l-7-4-7 4V5a1 1 0 011-1z" />
                </svg>
              </button>
            )}
          </div>
        )
      },
    },
    { key: 'branch', header: t('pages.runs.colBranch'), render: r => <span style={{ color: 'var(--muted)' }}>{r.branch || '—'}</span> },
    { key: 'stage', header: t('pages.runs.colStage'), render: r => <StageBadge stage={r.stage} /> },
    { key: 'score', header: t('pages.runs.colScore'), render: r => <ScoreBadge score={r.score} /> },
    { key: 'framework', header: t('pages.runs.colFramework'), mono: true, render: r => <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>{r.iac_framework}</span> },
    { key: 'triggered_by', header: t('pages.runs.colTriggeredBy'), render: r => <span style={{ color: 'var(--muted)' }}>{r.triggered_by}</span> },
    { key: 'controls', header: t('pages.runs.colControls'), render: r => <span style={{ color: 'var(--muted)' }}>{r.controls_run > 0 ? `${r.controls_run} / ${r.controls_loaded}` : '—'}</span> },
    { key: 'created_at', header: t('pages.runs.colDate'), render: r => <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleString()}</span> },
  ]

  return (
    <DataTable<RunSummary>
      columns={columns}
      rows={runs}
      rowKey={r => r.id}
      onRowClick={r => onSelect(r.id)}
      empty={<EmptyState compact title={t('common.noData')} />}
    />
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RunsListPage({ runs, onSelect }: Props) {
  const { t } = useI18n()
  const { prefs, isEnabled } = useBetaFeatures()
  const [showTrend, setShowTrend] = useState(false)
  const bookmarksEnabled = isEnabled(BETA_RUN_BOOKMARKS)
  const bookmarkedRuns = runs.filter(run => (prefs.bookmarkedRuns ?? []).includes(run.id))
  const canCompare = bookmarksEnabled && bookmarkedRuns.length >= 2
  const trendOverlay = showTrend && canCompare
    ? <RunTrendOverlay runs={bookmarkedRuns} onClose={() => setShowTrend(false)} onSelectRun={onSelect} />
    : null
  const [viewMode, setViewMode] = useState<'all' | 'project' | 'trend'>('all')
  const [stageFilter, setStageFilter] = useState('')
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE)

  if (runs.length === 0) {
    return (
      <Card padding="none">
        <EmptyState
          title={t('pages.runs.noRuns')}
          description={<code>wombat check --push http://localhost:8000/api/v1/runs</code>}
        />
      </Card>
    )
  }

  const stages = useMemo(
    () => [...new Set(runs.map(r => r.stage).filter(Boolean))].sort(),
    [runs]
  )

  // Filter and slice runs for display
  const filteredRuns = useMemo(
    () => stageFilter ? runs.filter(r => r.stage === stageFilter) : runs,
    [runs, stageFilter]
  )

  const displayedRuns = useMemo(
    () => filteredRuns.slice(0, displayLimit),
    [filteredRuns, displayLimit]
  )

  const hasMoreRuns = displayLimit < filteredRuns.length

  const btnBase: React.CSSProperties = {
    padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem',
    fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)',
  }
  const btnActive: React.CSSProperties   = { ...btnBase, background: 'var(--waf-brand)', color: '#fff', borderColor: 'var(--waf-brand)' }
  const btnInactive: React.CSSProperties = { ...btnBase, background: 'var(--surface)', color: 'var(--muted)' }

  const vm = viewMode as string
  const stageSelect = stages.length > 0 ? (
    <>
      <div style={{ width: '1px', height: '18px', background: 'var(--border)' }} />
      <h1 className="ui-sr-only">{PAGE_TITLE['runs']}</h1>
      <select
        value={stageFilter} onChange={e => setStageFilter(e.target.value)}
        className="filter-select" style={{ fontSize: '0.75rem' }}
      >
        <option value="">{t('pages.runs.allStages')}</option>
        {stages.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </>
  ) : null

  const toolbar = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)', gap: '0.4rem' }}>
      {stageSelect}
      <SavedViewsControl
        page="runs"
        currentFilters={{ stageFilter, viewMode }}
        onApply={filters => {
          setStageFilter(typeof filters.stageFilter === 'string' ? filters.stageFilter : '')
          const nextView = filters.viewMode
          if (nextView === 'all' || nextView === 'project' || nextView === 'trend') setViewMode(nextView)
        }}
      />
      {canCompare && (
        <button type="button" className="run-compare" onClick={() => setShowTrend(true)}>
          {t('pages.phase3.restB.runsList.compareBookmarks')} <span>{bookmarkedRuns.length}</span>
        </button>
      )}
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginRight: '0.35rem' }}></span>
      <button style={vm === 'all'     ? btnActive : btnInactive} onClick={() => setViewMode('all')}>{t('pages.runs.viewAll')}</button>
      <button style={vm === 'project' ? btnActive : btnInactive} onClick={() => setViewMode('project')}>{t('pages.runs.viewProject')}</button>
      <button style={vm === 'trend'   ? btnActive : btnInactive} onClick={() => setViewMode('trend')}>{t('pages.runs.viewTrend')}</button>
    </div>
  )

  if (viewMode === 'trend') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', alignItems: 'center' }}>
          {stages.length > 0 && (
            <>
              <select
                value={stageFilter} onChange={e => setStageFilter(e.target.value)}
                className="filter-select" style={{ fontSize: '0.75rem' }}
              >
                <option value="">{t('pages.runs.allStages')}</option>
                {stages.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div style={{ width: '1px', height: '18px', background: 'var(--border)' }} />
            </>
          )}
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginRight: '0.35rem' }}></span>
          <SavedViewsControl
            page="runs"
            currentFilters={{ stageFilter, viewMode }}
            onApply={filters => {
              setStageFilter(typeof filters.stageFilter === 'string' ? filters.stageFilter : '')
              const nextView = filters.viewMode
              if (nextView === 'all' || nextView === 'project' || nextView === 'trend') setViewMode(nextView)
            }}
          />
          <button style={btnInactive} onClick={() => setViewMode('all')}>{t('pages.runs.viewAll')}</button>
          <button style={btnInactive} onClick={() => setViewMode('project')}>{t('pages.runs.viewProject')}</button>
          <button style={btnActive}   onClick={() => setViewMode('trend')}>{t('pages.runs.viewTrend')}</button>
        </div>
        <TrendView runs={displayedRuns} onSelect={onSelect} />
        {trendOverlay}
      </div>
    )
  }

  if (viewMode === 'all') {
    return (
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {toolbar}
        <RunsTable runs={displayedRuns} onSelect={onSelect} />
        {hasMoreRuns && (
          <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => setDisplayLimit(prev => prev + PAGE_SIZE)}
              style={{
                display: 'block', margin: '0 auto',
                padding: '0.5rem 1rem', borderRadius: '8px',
                border: '1px solid var(--border)', background: 'var(--surface)',
                color: 'var(--text)', fontSize: '0.75rem', fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {t('pages.runs.loadMore', { count: Math.min(PAGE_SIZE, filteredRuns.length - displayLimit) })}
            </button>
          </div>
        )}
        {trendOverlay}
      </div>
    )
  }

  // Group by project - use filtered runs for grouping, but only display paginated
  const groupMap = new Map<string, RunSummary[]>()
  for (const r of filteredRuns) {
    const key = r.project || '(no project)'
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key)!.push(r)
  }
  const groups = Array.from(groupMap.entries()).sort(([a], [b]) => {
    if (a === '(no project)') return 1
    if (b === '(no project)') return -1
    return a.localeCompare(b)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {toolbar}
      </div>
      {groups.length === 0 && (
        <Card padding="none">
          <EmptyState compact title={t('common.noData')} />
        </Card>
      )}
      {groups.map(([project, groupRuns]) => {
        // For project view, we only show runs that are within displayLimit of the filtered runs
        const displayedGroupRuns = groupRuns.filter(r => {
          const index = filteredRuns.indexOf(r)
          return index >= 0 && index < displayLimit
        })
        const scores   = displayedGroupRuns.map(r => r.score)
        const avgScore = displayedGroupRuns.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0
        const color    = scoreColor(avgScore)
        const isUnnamed = project === '(no project)'
        return (
          <div key={project} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg)' }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: isUnnamed ? 'var(--muted)' : 'var(--waf-brand)', fontStyle: isUnnamed ? 'italic' : undefined }}>
                {isUnnamed ? t('pages.phase3.restB.runsList.noProject') : project}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                {groupRuns.length} {groupRuns.length !== 1 ? t('pages.phase3.restB.runsList.runMany') : t('pages.phase3.restB.runsList.runOne')}
              </span>
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--muted)' }}>
                {t('pages.runs.avgScore')} <span style={{ fontWeight: 700, color, fontSize: '0.8rem' }}>{avgScore}</span>
              </span>
            </div>
            <RunsTable runs={displayedGroupRuns} onSelect={onSelect} />
          </div>
        )
      })}
      {trendOverlay}
      {hasMoreRuns && (
        <div style={{ textAlign: 'center', padding: '1rem' }}>
          <button
            onClick={() => setDisplayLimit(prev => prev + PAGE_SIZE)}
            style={{
              padding: '0.5rem 1rem', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--text)', fontSize: '0.75rem', fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {t('pages.runs.loadMore', { count: Math.min(PAGE_SIZE, filteredRuns.length - displayLimit) })}
          </button>
        </div>
      )}

    </div>
  )
}
