import { useState, useEffect, useMemo } from 'react'
import { RunSummary, RunDetail, Finding, fetchRun } from '../api'

interface Props {
  runs: RunSummary[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEV_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 }
const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#DA2C38', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e', INFO: '#94a3b8',
}
const SEV_BG: Record<string, string> = {
  CRITICAL: 'rgba(218,44,56,.12)', HIGH: 'rgba(249,115,22,.12)',
  MEDIUM: 'rgba(234,179,8,.12)', LOW: 'rgba(34,197,94,.12)', INFO: 'rgba(148,163,184,.10)',
}

const PILLAR_META: { key: string; label: string; color: string }[] = [
  { key: 'security',       label: 'Security',       color: '#DA2C38' },
  { key: 'cost',           label: 'Cost',            color: '#0094FF' },
  { key: 'operations',     label: 'Operations',      color: '#8b5cf6' },
  { key: 'performance',    label: 'Performance',     color: '#f97316' },
  { key: 'reliability',    label: 'Reliability',     color: '#22c55e' },
  { key: 'sovereign',      label: 'Sovereignty',     color: '#eab308' },
  { key: 'sustainability', label: 'Sustainability',  color: '#14b8a6' },
]

function scoreColor(s: number) {
  return s >= 80 ? '#059669' : s >= 60 ? '#d97706' : '#DA2C38'
}
function deltaColor(d: number) {
  return d > 0 ? '#059669' : d < 0 ? '#DA2C38' : '#94a3b8'
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function runLabel(r: RunSummary) {
  const parts: string[] = []
  if (r.project) parts.push(r.project)
  if (r.branch)  parts.push(r.branch)
  parts.push(fmtDate(r.created_at))
  return parts.join(' · ')
}

// ── Diff computation ──────────────────────────────────────────────────────────

type DiffStatus = 'newly_failed' | 'fixed' | 'still_failing'

interface DiffItem {
  key: string
  control_id: string
  check_title: string
  check_id: string
  pillar: string
  severity: string
  resource: string
  baseFinding?: Finding
  headFinding?: Finding
  status: DiffStatus
}

function diffKey(f: Finding) {
  return `${f.control_id}||${f.check_id}||${f.resource ?? ''}`
}

function computeDiff(base: RunDetail, head: RunDetail): DiffItem[] {
  const baseFails = new Map<string, Finding>()
  for (const f of base.findings) {
    if (f.status?.toUpperCase() === 'FAIL') baseFails.set(diffKey(f), f)
  }
  const headFails = new Map<string, Finding>()
  for (const f of head.findings) {
    if (f.status?.toUpperCase() === 'FAIL') headFails.set(diffKey(f), f)
  }

  const items: DiffItem[] = []

  // Newly failing: in head but not base
  for (const [k, f] of headFails) {
    if (!baseFails.has(k)) {
      items.push({ key: k, control_id: f.control_id, check_title: f.check_title, check_id: f.check_id, pillar: f.pillar, severity: f.severity, resource: f.resource, status: 'newly_failed', headFinding: f })
    }
  }
  // Fixed: in base but not head
  for (const [k, f] of baseFails) {
    if (!headFails.has(k)) {
      items.push({ key: k, control_id: f.control_id, check_title: f.check_title, check_id: f.check_id, pillar: f.pillar, severity: f.severity, resource: f.resource, status: 'fixed', baseFinding: f })
    }
  }
  // Still failing
  for (const [k, f] of headFails) {
    if (baseFails.has(k)) {
      items.push({ key: k, control_id: f.control_id, check_title: f.check_title, check_id: f.check_id, pillar: f.pillar, severity: f.severity, resource: f.resource, status: 'still_failing', baseFinding: baseFails.get(k), headFinding: f })
    }
  }

  return items
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SevBadge({ sev }: { sev: string }) {
  const s = sev?.toUpperCase() ?? 'INFO'
  return (
    <span style={{
      fontSize: '0.62rem', fontWeight: 700, borderRadius: '4px', padding: '0.1rem 0.4rem',
      background: SEV_BG[s] ?? SEV_BG.INFO, color: SEV_COLOR[s] ?? SEV_COLOR.INFO,
      letterSpacing: '0.04em', flexShrink: 0,
    }}>{s}</span>
  )
}

function PillarChip({ pillar }: { pillar: string }) {
  const meta = PILLAR_META.find(p => p.key === pillar?.toLowerCase())
  return (
    <span style={{
      fontSize: '0.62rem', fontWeight: 600, borderRadius: '4px', padding: '0.1rem 0.4rem',
      background: meta ? `${meta.color}18` : 'rgba(148,163,184,.12)',
      color: meta?.color ?? '#94a3b8', flexShrink: 0,
    }}>{meta?.label ?? pillar ?? '—'}</span>
  )
}

function DiffCard({ item }: { item: DiffItem }) {
  const [open, setOpen] = useState(false)
  const finding = item.headFinding ?? item.baseFinding

  const leftAccent = item.status === 'newly_failed' ? '#DA2C38'
    : item.status === 'fixed' ? '#059669'
    : '#d97706'

  return (
    <div
      style={{
        borderRadius: '10px', border: '1px solid var(--border)', background: '#fff',
        overflow: 'hidden', cursor: 'pointer',
        transition: 'box-shadow .15s',
      }}
      onClick={() => setOpen(o => !o)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.65rem 0.875rem' }}>
        {/* Color stripe */}
        <div style={{ width: '3px', borderRadius: '2px', alignSelf: 'stretch', background: leftAccent, flexShrink: 0, minHeight: '24px' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
            <SevBadge sev={item.severity} />
            <PillarChip pillar={item.pillar} />
            <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'monospace' }}>{item.control_id}</span>
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>{item.check_title}</div>
          {item.resource && (
            <div style={{ marginTop: '0.2rem', fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.resource}
            </div>
          )}
        </div>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ flexShrink: 0, opacity: 0.4, marginTop: '2px', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {open && finding && (
        <div style={{ padding: '0 0.875rem 0.75rem 2.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem', background: '#fafbfc' }}>
          {finding.message && (
            <div style={{ marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '0.2rem' }}>Message</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.5 }}>{finding.message}</div>
            </div>
          )}
          {finding.remediation && (
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '0.2rem' }}>Remediation</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.5 }}>{finding.remediation}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DiffSection({ items, status }: { items: DiffItem[]; status: DiffStatus }) {
  const sorted = useMemo(() =>
    [...items].sort((a, b) =>
      (SEV_ORDER[a.severity?.toUpperCase()] ?? 9) - (SEV_ORDER[b.severity?.toUpperCase()] ?? 9)
    ), [items])

  if (sorted.length === 0) {
    const label = status === 'newly_failed' ? 'No new failures' : status === 'fixed' ? 'Nothing fixed' : 'No persistent failures'
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
        {status === 'fixed'
          ? <span style={{ color: '#059669', fontWeight: 600 }}>{label} — clean!</span>
          : label}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {sorted.map(item => <DiffCard key={item.key} item={item} />)}
    </div>
  )
}

// ── Run selector ──────────────────────────────────────────────────────────────

function RunSelector({
  label, value, runs, onChange,
}: {
  label: string; value: string; runs: RunSummary[]; onChange: (id: string) => void
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)', marginBottom: '0.35rem' }}>{label}</div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px',
          border: '1px solid var(--border)', background: '#fff', fontSize: '0.8rem',
          color: 'var(--text)', cursor: 'pointer', appearance: 'auto',
        }}
      >
        {runs.map(r => (
          <option key={r.id} value={r.id}>{runLabel(r)} (score: {r.score})</option>
        ))}
      </select>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'newly_failed' | 'fixed' | 'still_failing'

export default function RunDiffPage({ runs }: Props) {
  const sortedRuns = useMemo(() => [...runs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ), [runs])

  // Smart defaults: two most recent runs of same project if possible, else just the two most recent
  const defaultHead = sortedRuns[0]?.id ?? ''
  const defaultBase = useMemo(() => {
    if (sortedRuns.length < 2) return ''
    const headRun = sortedRuns[0]
    const sameProject = sortedRuns.slice(1).find(r => r.project === headRun?.project)
    return (sameProject ?? sortedRuns[1]).id
  }, [sortedRuns])

  const [baseId, setBaseId] = useState(defaultBase)
  const [headId, setHeadId] = useState(defaultHead)
  const [baseRun, setBaseRun] = useState<RunDetail | null>(null)
  const [headRun, setHeadRun] = useState<RunDetail | null>(null)
  const [loadingBase, setLoadingBase] = useState(false)
  const [loadingHead, setLoadingHead] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('newly_failed')

  // Update defaults when runs change
  useEffect(() => {
    if (!baseId && defaultBase) setBaseId(defaultBase)
    if (!headId && defaultHead) setHeadId(defaultHead)
  }, [defaultBase, defaultHead]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!baseId) return
    setLoadingBase(true)
    setBaseRun(null)
    fetchRun(baseId).then(setBaseRun).catch(() => setBaseRun(null)).finally(() => setLoadingBase(false))
  }, [baseId])

  useEffect(() => {
    if (!headId) return
    setLoadingHead(true)
    setHeadRun(null)
    fetchRun(headId).then(setHeadRun).catch(() => setHeadRun(null)).finally(() => setLoadingHead(false))
  }, [headId])

  if (runs.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
        At least two runs are needed to compare.
      </div>
    )
  }
  if (runs.length === 1) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
        Only one run exists — record another scan to enable comparison.
      </div>
    )
  }

  const diff = useMemo(() => {
    if (!baseRun || !headRun || baseId === headId) return null
    return computeDiff(baseRun, headRun)
  }, [baseRun, headRun, baseId, headId])

  const byStatus = useMemo(() => {
    if (!diff) return { newly_failed: [], fixed: [], still_failing: [] }
    return {
      newly_failed: diff.filter(d => d.status === 'newly_failed'),
      fixed:        diff.filter(d => d.status === 'fixed'),
      still_failing: diff.filter(d => d.status === 'still_failing'),
    }
  }, [diff])

  const baseSummary = sortedRuns.find(r => r.id === baseId)
  const headSummary = sortedRuns.find(r => r.id === headId)
  const scoreDelta = headSummary && baseSummary ? headSummary.score - baseSummary.score : null

  // Pillar deltas
  const pillarDeltas = useMemo(() => {
    if (!baseSummary || !headSummary) return []
    return PILLAR_META.map(p => {
      const base = baseSummary.pillar_scores?.[p.key] ?? null
      const head = headSummary.pillar_scores?.[p.key] ?? null
      const delta = base != null && head != null ? head - base : null
      return { ...p, base, head, delta }
    }).filter(p => p.base != null || p.head != null)
  }, [baseSummary, headSummary])

  const sameRun = baseId === headId

  const TAB_CONFIG: { status: Tab; label: string; color: string; bg: string }[] = [
    { status: 'newly_failed', label: 'Newly Failed', color: '#DA2C38', bg: 'rgba(218,44,56,.10)' },
    { status: 'fixed',        label: 'Fixed',        color: '#059669', bg: 'rgba(5,150,105,.10)' },
    { status: 'still_failing', label: 'Still Failing', color: '#d97706', bg: 'rgba(217,119,6,.10)' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Run selectors ── */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem' }}>
          <RunSelector label="Base (older / PR target)" value={baseId} runs={sortedRuns} onChange={id => { setBaseId(id); setActiveTab('newly_failed') }} />

          {/* Arrow */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '0.35rem', flexShrink: 0 }}>
            <svg width="24" height="24" fill="none" stroke="var(--muted)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>

          <RunSelector label="Head (newer / PR branch)" value={headId} runs={sortedRuns} onChange={id => { setHeadId(id); setActiveTab('newly_failed') }} />
        </div>
        {sameRun && (
          <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(234,179,8,.10)', border: '1px solid rgba(234,179,8,.30)', borderRadius: '8px', fontSize: '0.78rem', color: '#d97706' }}>
            Base and head are the same run — select two different runs to see a diff.
          </div>
        )}
      </div>

      {/* ── Score summary ── */}
      {baseSummary && headSummary && !sameRun && (
        <div className="card" style={{ padding: '1rem 1.25rem' }}>
          {/* Score strip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', marginBottom: pillarDeltas.length > 0 ? '1rem' : 0 }}>
            {/* Base score */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '0.2rem' }}>Base</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: scoreColor(baseSummary.score), lineHeight: 1 }}>{baseSummary.score}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                {baseSummary.project && <>{baseSummary.project} · </>}{baseSummary.branch}
              </div>
            </div>

            {/* Arrow + delta */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '80px' }}>
              {scoreDelta !== null && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  fontSize: '1.25rem', fontWeight: 800, color: deltaColor(scoreDelta),
                }}>
                  {scoreDelta > 0 ? '▲' : scoreDelta < 0 ? '▼' : '→'}
                  {scoreDelta > 0 ? '+' : ''}{scoreDelta} pts
                </div>
              )}
              <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                {scoreDelta !== null && scoreDelta > 0 ? 'Score improved' : scoreDelta !== null && scoreDelta < 0 ? 'Score regressed' : 'No change'}
              </div>
            </div>

            {/* Head score */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '0.2rem' }}>Head</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: scoreColor(headSummary.score), lineHeight: 1 }}>{headSummary.score}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                {headSummary.project && <>{headSummary.project} · </>}{headSummary.branch}
              </div>
            </div>
          </div>

          {/* Pillar deltas grid */}
          {pillarDeltas.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)', marginBottom: '0.6rem' }}>Pillar Scores</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.5rem' }}>
                {pillarDeltas.map(p => (
                  <div key={p.key} style={{
                    borderRadius: '8px', padding: '0.5rem 0.625rem',
                    background: p.delta == null ? '#fafbfc' : p.delta > 0 ? 'rgba(5,150,105,.06)' : p.delta < 0 ? 'rgba(218,44,56,.06)' : '#fafbfc',
                    border: `1px solid ${p.delta == null ? 'var(--border)' : p.delta > 0 ? 'rgba(5,150,105,.25)' : p.delta < 0 ? 'rgba(218,44,56,.25)' : 'var(--border)'}`,
                  }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 600, color: p.color, marginBottom: '0.2rem' }}>{p.label}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: p.head != null ? scoreColor(p.head) : 'var(--muted)' }}>
                        {p.head ?? '—'}
                      </span>
                      {p.delta != null && (
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: deltaColor(p.delta) }}>
                          {p.delta > 0 ? '+' : ''}{p.delta}
                        </span>
                      )}
                    </div>
                    {p.base != null && p.head != null && (
                      <div style={{ fontSize: '0.62rem', color: 'var(--muted)', marginTop: '0.05rem' }}>was {p.base}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Diff results ── */}
      {!sameRun && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Loading overlay */}
          {(loadingBase || loadingHead) && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 0.75rem' }} />
              Loading runs…
            </div>
          )}

          {!loadingBase && !loadingHead && diff && (
            <>
              {/* Tab bar */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                {TAB_CONFIG.map(tab => {
                  const count = byStatus[tab.status].length
                  const active = activeTab === tab.status
                  return (
                    <button
                      key={tab.status}
                      onClick={() => setActiveTab(tab.status)}
                      style={{
                        flex: 1, padding: '0.75rem 0.5rem',
                        background: active ? tab.bg : 'transparent',
                        border: 'none', borderBottom: active ? `2px solid ${tab.color}` : '2px solid transparent',
                        cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
                        transition: 'background .15s',
                      }}
                    >
                      <span style={{
                        fontSize: '1rem', fontWeight: 800,
                        color: active ? tab.color : count > 0 ? 'var(--text)' : 'var(--muted)',
                      }}>{count}</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: active ? tab.color : 'var(--muted)' }}>{tab.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Tab content */}
              <div style={{ padding: '1rem' }}>
                {/* Summary sentence */}
                {activeTab === 'newly_failed' && byStatus.newly_failed.length > 0 && (
                  <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(218,44,56,.07)', border: '1px solid rgba(218,44,56,.20)', fontSize: '0.78rem', color: '#DA2C38', fontWeight: 600 }}>
                    {byStatus.newly_failed.length} check{byStatus.newly_failed.length !== 1 ? 's' : ''} newly failing in the head run — these regressions need attention before merge.
                  </div>
                )}
                {activeTab === 'fixed' && byStatus.fixed.length > 0 && (
                  <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(5,150,105,.07)', border: '1px solid rgba(5,150,105,.20)', fontSize: '0.78rem', color: '#059669', fontWeight: 600 }}>
                    {byStatus.fixed.length} check{byStatus.fixed.length !== 1 ? 's' : ''} resolved since the base run.
                  </div>
                )}
                {activeTab === 'still_failing' && byStatus.still_failing.length > 0 && (
                  <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(217,119,6,.07)', border: '1px solid rgba(217,119,6,.20)', fontSize: '0.78rem', color: '#d97706', fontWeight: 600 }}>
                    {byStatus.still_failing.length} check{byStatus.still_failing.length !== 1 ? 's' : ''} failing in both runs — pre-existing issues, not introduced by this change.
                  </div>
                )}

                <DiffSection items={byStatus[activeTab]} status={activeTab} />
              </div>
            </>
          )}

          {/* No data yet */}
          {!loadingBase && !loadingHead && !diff && !sameRun && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
              Select two runs above to see the diff.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
