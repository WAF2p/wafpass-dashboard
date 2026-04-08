import { useEffect, useMemo, useState } from 'react'
import { fetchRun, Finding, PlanChange, RunDetail, RunSummary } from '../api'

interface Props {
  run: RunDetail
  runs: RunSummary[]
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ComplianceDriftItem {
  control_id: string
  check_id: string
  check_title: string
  pillar: string
  severity: string
  resource: string
  message: string
  remediation: string
}

type DriftDirection = 'regressed' | 'recovered'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
const sevOrder = (s: string) => SEV_ORDER[s?.toLowerCase()] ?? 9

const SEV_COLOR: Record<string, string> = {
  critical: '#dc2626', high: '#d97706', medium: '#2563eb', low: '#059669', info: '#94a3b8',
}
const sevColor = (s: string) => SEV_COLOR[s?.toLowerCase()] ?? '#94a3b8'

const ACTION_META: Record<string, { label: string; color: string; bg: string; glyph: string }> = {
  update:  { label: 'Changed',  color: '#d97706', bg: 'rgba(217,119,6,.10)',   glyph: '~' },
  replace: { label: 'Replaced', color: '#7c3aed', bg: 'rgba(124,58,237,.10)', glyph: '⟳' },
  delete:  { label: 'Destroyed',color: '#dc2626', bg: 'rgba(220,38,38,.10)',   glyph: '−' },
  create:  { label: 'Created',  color: '#16a34a', bg: 'rgba(22,163,74,.08)',   glyph: '+' },
  'no-op': { label: 'No-op',    color: '#94a3b8', bg: 'transparent',           glyph: '·' },
}
const actionMeta = (a: string) => ACTION_META[a] ?? ACTION_META['no-op']

// Attributes that are security-relevant — flag their changes as high-risk
const SECURITY_ATTRS = new Set([
  'policy', 'assume_role_policy', 'inline_policy', 'permission_boundary',
  'ingress', 'egress', 'cidr_blocks', 'ipv6_cidr_blocks',
  'public_access_block_configuration', 'block_public_acls', 'block_public_policy',
  'restrict_public_buckets', 'ignore_public_acls',
  'encryption_configuration', 'server_side_encryption_configuration',
  'versioning', 'logging', 'kms_key_id', 'kms_key_arn', 'kms_master_key_id',
  'deletion_window_in_days', 'enable_key_rotation',
  'acl', 'bucket_policy', 'security_groups', 'source_security_group_id',
])

function securityAttrsChanged(change: PlanChange): string[] {
  const before = (change.before ?? {}) as Record<string, unknown>
  const after  = (change.after  ?? {}) as Record<string, unknown>
  const result: string[] = []
  for (const attr of SECURITY_ATTRS) {
    const b = JSON.stringify(before[attr] ?? null)
    const a = JSON.stringify(after[attr]  ?? null)
    if (b !== a) result.push(attr)
  }
  return result
}

function findingKey(f: Finding) {
  return `${f.control_id}||${f.check_id}||${f.resource}`
}

function computeComplianceDrift(base: RunDetail, head: RunDetail): {
  regressed: ComplianceDriftItem[]
  recovered: ComplianceDriftItem[]
} {
  const baseFails = new Map<string, Finding>()
  const headFails = new Map<string, Finding>()

  for (const f of base.findings) {
    if (f.status?.toUpperCase() === 'FAIL') baseFails.set(findingKey(f), f)
  }
  for (const f of head.findings) {
    if (f.status?.toUpperCase() === 'FAIL') headFails.set(findingKey(f), f)
  }

  const toDriftItem = (f: Finding): ComplianceDriftItem => ({
    control_id: f.control_id, check_id: f.check_id, check_title: f.check_title,
    pillar: f.pillar, severity: f.severity, resource: f.resource,
    message: f.message, remediation: f.remediation,
  })

  const regressed: ComplianceDriftItem[] = []
  for (const [k, f] of headFails) {
    if (!baseFails.has(k)) regressed.push(toDriftItem(f))
  }
  const recovered: ComplianceDriftItem[] = []
  for (const [k, f] of baseFails) {
    if (!headFails.has(k)) recovered.push(toDriftItem(f))
  }

  regressed.sort((a, b) => sevOrder(a.severity) - sevOrder(b.severity))
  recovered.sort((a, b) => sevOrder(a.severity) - sevOrder(b.severity))
  return { regressed, recovered }
}

// ─── Score Trend Sparkline ────────────────────────────────────────────────────

function ScoreTrend({ projectRuns, currentId }: { projectRuns: RunSummary[]; currentId: string }) {
  const sorted = [...projectRuns].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  ).slice(-12)

  if (sorted.length < 2) {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
        Need at least 2 runs to show trend
      </div>
    )
  }

  const W = 340, H = 80, PAD = 8
  const scores = sorted.map(r => r.score)
  const min = Math.max(0, Math.min(...scores) - 5)
  const max = Math.min(100, Math.max(...scores) + 5)
  const px = (i: number) => PAD + (i / (sorted.length - 1)) * (W - PAD * 2)
  const py = (s: number) => H - PAD - ((s - min) / (max - min || 1)) * (H - PAD * 2)

  const points = sorted.map((r, i) => `${px(i)},${py(r.score)}`).join(' ')
  const fillPoints = `${px(0)},${H} ` + points + ` ${px(sorted.length - 1)},${H}`

  return (
    <svg width={W} height={H} style={{ overflow: 'visible', display: 'block', margin: '0 auto' }}>
      {/* Fill */}
      <polygon points={fillPoints} fill="rgba(37,99,235,.10)" />
      {/* Line */}
      <polyline points={points} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" />
      {/* Dots */}
      {sorted.map((r, i) => {
        const isCurrent = r.id === currentId
        const c = r.score >= 80 ? '#059669' : r.score >= 60 ? '#d97706' : '#dc2626'
        return (
          <g key={r.id}>
            <circle cx={px(i)} cy={py(r.score)} r={isCurrent ? 5 : 3}
              fill={isCurrent ? c : 'var(--card-bg)'} stroke={c} strokeWidth={isCurrent ? 2 : 1.5} />
            {isCurrent && (
              <text x={px(i)} y={py(r.score) - 8} textAnchor="middle"
                fontSize={9} fill={c} fontWeight={700}>{r.score}</text>
            )}
          </g>
        )
      })}
      {/* Axis labels */}
      <text x={PAD} y={H} fontSize={8} fill="var(--text-muted)">{sorted[0].score}</text>
      <text x={W - PAD} y={H} fontSize={8} fill="var(--text-muted)" textAnchor="end">
        {sorted[sorted.length - 1].score}
      </text>
    </svg>
  )
}

// ─── Compliance Drift Card ────────────────────────────────────────────────────

function DriftCard({ item, direction }: { item: ComplianceDriftItem; direction: DriftDirection }) {
  const [open, setOpen] = useState(false)
  const color = direction === 'regressed' ? sevColor(item.severity) : '#059669'
  const bg    = direction === 'regressed'
    ? `rgba(${item.severity?.toLowerCase() === 'critical' ? '220,38,38' : item.severity?.toLowerCase() === 'high' ? '217,119,6' : '37,99,235'},.06)`
    : 'rgba(5,150,105,.06)'

  return (
    <div style={{
      border: `1px solid ${color}33`, borderRadius: 8, marginBottom: 8,
      background: bg, overflow: 'hidden',
    }}>
      <div
        style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10 }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{
          fontSize: 10, fontWeight: 700, color, background: `${color}22`,
          border: `1px solid ${color}44`, borderRadius: 4, padding: '2px 6px',
          textTransform: 'uppercase', flexShrink: 0, marginTop: 1,
        }}>
          {item.severity}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
            {item.check_title || item.control_id}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {item.resource}
          </div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ padding: '0 14px 12px', borderTop: `1px solid ${color}22` }}>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {item.message}
          </div>
          {item.remediation && (
            <div style={{
              marginTop: 8, padding: '8px 10px',
              background: 'var(--bg-secondary)', borderRadius: 6,
              fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5,
            }}>
              <strong style={{ color: 'var(--text-secondary)' }}>Remediation:</strong> {item.remediation}
            </div>
          )}
          <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 4, padding: '2px 6px' }}>
              {item.pillar}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 4, padding: '2px 6px', fontFamily: 'monospace' }}>
              {item.check_id}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── State Drift Card ─────────────────────────────────────────────────────────

function StateDriftCard({ change, failingResources }: { change: PlanChange; failingResources: Set<string> }) {
  const [open, setOpen] = useState(false)
  const meta = actionMeta(change.action)
  const secAttrs = securityAttrsChanged(change)
  const isNonCompliant = failingResources.has(change.address)

  return (
    <div style={{
      border: `1px solid ${meta.color}44`, borderRadius: 8, marginBottom: 8,
      background: meta.bg, overflow: 'hidden',
    }}>
      <div
        style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10 }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{
          fontSize: 13, fontWeight: 700, color: meta.color,
          background: `${meta.color}22`, border: `1px solid ${meta.color}44`,
          borderRadius: 4, padding: '2px 8px', flexShrink: 0,
        }}>
          {meta.glyph} {meta.label}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-primary)', marginBottom: 2 }}>
            {change.address}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{change.type}</span>
            {secAttrs.length > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#dc2626',
                background: 'rgba(220,38,38,.10)', border: '1px solid rgba(220,38,38,.3)',
                borderRadius: 4, padding: '1px 6px',
              }}>
                security attrs changed: {secAttrs.join(', ')}
              </span>
            )}
            {isNonCompliant && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: '#7c3aed',
                background: 'rgba(124,58,237,.10)', border: '1px solid rgba(124,58,237,.3)',
                borderRadius: 4, padding: '1px 6px',
              }}>
                non-compliant
              </span>
            )}
          </div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && change.before && change.after && (
        <div style={{ padding: '0 14px 12px', borderTop: `1px solid ${meta.color}22` }}>
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {['before', 'after'].map(side => {
              const attrs = side === 'before' ? change.before! : change.after!
              const changedKeys = Object.keys(attrs).filter(k => {
                const b = JSON.stringify((change.before ?? {})[k] ?? null)
                const a = JSON.stringify((change.after  ?? {})[k] ?? null)
                return b !== a
              }).slice(0, 8)
              return (
                <div key={side}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                    {side}
                  </div>
                  {changedKeys.length === 0 ? (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</div>
                  ) : changedKeys.map(k => (
                    <div key={k} style={{
                      fontSize: 11, fontFamily: 'monospace', marginBottom: 3,
                      padding: '3px 6px', borderRadius: 4,
                      background: secAttrs.includes(k)
                        ? 'rgba(220,38,38,.08)'
                        : 'var(--bg-secondary)',
                      color: secAttrs.includes(k) ? '#dc2626' : 'var(--text-secondary)',
                    }}>
                      <strong>{k}:</strong>{' '}
                      {String(attrs[k]).length > 60
                        ? String(JSON.stringify(attrs[k])).slice(0, 60) + '…'
                        : JSON.stringify(attrs[k])}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DriftDetectionPage({ run, runs }: Props) {
  const [prevRun, setPrevRun]       = useState<RunDetail | null>(null)
  const [prevLoading, setPrevLoading] = useState(false)
  const [tab, setTab]               = useState<'regressed' | 'recovered' | 'state'>('regressed')
  const [pillarFilter, setPillarFilter] = useState('')
  const [sevFilter, setSevFilter]   = useState('')
  const [actionFilter, setActionFilter] = useState<'all' | 'update' | 'replace' | 'delete' | 'create'>('all')

  // Runs for same project, sorted newest-first
  const projectRuns = useMemo(() =>
    runs
      .filter(r => r.project === run.project)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [runs, run.project]
  )

  // Previous run = first run that is older than current
  const prevRunSummary = useMemo(() => {
    const curTime = new Date(run.created_at).getTime()
    return projectRuns.find(r => r.id !== run.id && new Date(r.created_at).getTime() < curTime) ?? null
  }, [projectRuns, run])

  useEffect(() => {
    if (!prevRunSummary) { setPrevRun(null); return }
    setPrevLoading(true)
    fetchRun(prevRunSummary.id)
      .then(setPrevRun)
      .catch(() => setPrevRun(null))
      .finally(() => setPrevLoading(false))
  }, [prevRunSummary])

  // Compliance drift
  const { regressed, recovered } = useMemo(() => {
    if (!prevRun) return { regressed: [], recovered: [] }
    return computeComplianceDrift(prevRun, run)
  }, [prevRun, run])

  // State drift (plan_changes)
  const stateDrift = useMemo(() => {
    if (!run.plan_changes) return []
    return run.plan_changes.changes.filter(c => c.action !== 'no-op' && c.action !== 'create' || actionFilter === 'all' || c.action === actionFilter)
  }, [run.plan_changes, actionFilter])

  const filteredStateDrift = useMemo(() => {
    let items = run.plan_changes?.changes.filter(c => c.action !== 'no-op') ?? []
    if (actionFilter !== 'all') items = items.filter(c => c.action === actionFilter)
    return items
  }, [run.plan_changes, actionFilter])

  // Failing resources set (for cross-referencing with state drift)
  const failingResources = useMemo(() =>
    new Set(run.findings.filter(f => f.status?.toUpperCase() === 'FAIL').map(f => f.resource).filter(Boolean)),
    [run.findings]
  )

  // Filtered compliance items
  const filteredRegressed = useMemo(() => regressed.filter(i =>
    (!pillarFilter || i.pillar === pillarFilter) &&
    (!sevFilter || i.severity?.toLowerCase() === sevFilter)
  ), [regressed, pillarFilter, sevFilter])

  const filteredRecovered = useMemo(() => recovered.filter(i =>
    (!pillarFilter || i.pillar === pillarFilter) &&
    (!sevFilter || i.severity?.toLowerCase() === sevFilter)
  ), [recovered, pillarFilter, sevFilter])

  // Pillar options
  const pillars = useMemo(() =>
    [...new Set([...regressed, ...recovered].map(i => i.pillar).filter(Boolean))].sort(),
    [regressed, recovered]
  )

  // Score delta
  const scoreDelta = prevRun ? run.score - prevRun.score : null

  // Security-sensitive state changes count
  const secStateChanges = useMemo(() =>
    filteredStateDrift.filter(c => securityAttrsChanged(c).length > 0).length,
    [filteredStateDrift]
  )

  // Non-compliant state changes (resource is also failing a WAF++ check)
  const nonCompliantDrift = useMemo(() =>
    filteredStateDrift.filter(c => failingResources.has(c.address)).length,
    [filteredStateDrift, failingResources]
  )

  const hasDrift = regressed.length > 0 || filteredStateDrift.length > 0

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>

      {/* ── Header banner ───────────────────────────────────────────────── */}
      <div style={{
        borderRadius: 12, padding: '20px 24px', marginBottom: 24,
        background: hasDrift
          ? 'linear-gradient(135deg, rgba(220,38,38,.08) 0%, rgba(217,119,6,.05) 100%)'
          : 'linear-gradient(135deg, rgba(5,150,105,.08) 0%, rgba(16,185,129,.05) 100%)',
        border: `1px solid ${hasDrift ? 'rgba(220,38,38,.2)' : 'rgba(5,150,105,.2)'}`,
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 32 }}>{hasDrift ? '⚠️' : '✅'}</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            {hasDrift
              ? `Configuration drift detected in ${run.project}`
              : `No drift detected — ${run.project} is stable`}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {prevRun
              ? `Compared against run from ${new Date(prevRun.created_at).toLocaleString()} · branch ${prevRun.branch}`
              : 'No previous run found for this project — showing current state only'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {scoreDelta !== null && (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 24, fontWeight: 800,
                color: scoreDelta > 0 ? '#059669' : scoreDelta < 0 ? '#dc2626' : 'var(--text-muted)',
              }}>
                {scoreDelta > 0 ? '+' : ''}{scoreDelta}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>score Δ</div>
            </div>
          )}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: regressed.length > 0 ? '#dc2626' : '#059669' }}>
              {regressed.length}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>regressions</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: recovered.length > 0 ? '#059669' : 'var(--text-muted)' }}>
              {recovered.length}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>recovered</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: filteredStateDrift.length > 0 ? '#d97706' : 'var(--text-muted)' }}>
              {filteredStateDrift.length}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>state changes</div>
          </div>
          {secStateChanges > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626' }}>{secStateChanges}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>security attrs</div>
            </div>
          )}
          {nonCompliantDrift > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#7c3aed' }}>{nonCompliantDrift}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>drift + non-compliant</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Two-column layout ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

        {/* Left — tabs */}
        <div>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--card-border)' }}>
            {([
              ['regressed', `Regressions (${regressed.length})`, '#dc2626'],
              ['recovered', `Recovered (${recovered.length})`, '#059669'],
              ['state',     `State Drift (${filteredStateDrift.length})`, '#d97706'],
            ] as [string, string, string][]).map(([key, label, color]) => (
              <button key={key} onClick={() => setTab(key as typeof tab)} style={{
                padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: 'none', borderBottom: tab === key ? `2px solid ${color}` : '2px solid transparent',
                color: tab === key ? color : 'var(--text-muted)',
                marginBottom: -1,
              }}>
                {label}
              </button>
            ))}
          </div>

          {/* Compliance drift filters */}
          {(tab === 'regressed' || tab === 'recovered') && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <select value={pillarFilter} onChange={e => setPillarFilter(e.target.value)}
                style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 12 }}>
                <option value="">All pillars</option>
                {pillars.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={sevFilter} onChange={e => setSevFilter(e.target.value)}
                style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 12 }}>
                <option value="">All severities</option>
                {['critical', 'high', 'medium', 'low', 'info'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {(pillarFilter || sevFilter) && (
                <button onClick={() => { setPillarFilter(''); setSevFilter('') }}
                  style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
                  Clear
                </button>
              )}
            </div>
          )}

          {/* State drift filter */}
          {tab === 'state' && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {(['all', 'update', 'replace', 'delete', 'create'] as const).map(a => (
                <button key={a} onClick={() => setActionFilter(a)} style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                  border: `1px solid ${actionFilter === a ? (ACTION_META[a]?.color ?? '#94a3b8') : 'var(--card-border)'}`,
                  background: actionFilter === a ? `${ACTION_META[a]?.color ?? '#94a3b8'}18` : 'none',
                  color: actionFilter === a ? (ACTION_META[a]?.color ?? 'var(--text-primary)') : 'var(--text-muted)',
                  fontWeight: actionFilter === a ? 700 : 400,
                }}>
                  {a === 'all' ? 'All' : (ACTION_META[a]?.label ?? a)}
                </button>
              ))}
            </div>
          )}

          {/* Loading state */}
          {prevLoading && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 14 }}>
              Loading previous run…
            </div>
          )}

          {/* No previous run */}
          {!prevLoading && !prevRun && (tab === 'regressed' || tab === 'recovered') && (
            <div style={{
              textAlign: 'center', padding: '40px 20px',
              border: '1px dashed var(--card-border)', borderRadius: 10,
              color: 'var(--text-muted)', fontSize: 14,
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
              <strong>No previous run found for project "{run.project}"</strong>
              <div style={{ marginTop: 6, fontSize: 12 }}>
                Compliance drift requires at least two runs for the same project.
                Run WAF++ again after making changes to see what regressed or recovered.
              </div>
            </div>
          )}

          {/* Regressions tab */}
          {!prevLoading && tab === 'regressed' && prevRun && (
            filteredRegressed.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '32px', border: '1px dashed var(--card-border)',
                borderRadius: 10, color: '#059669', fontSize: 14,
              }}>
                ✅ No regressions — nothing that was passing is now failing
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                  {filteredRegressed.length} control{filteredRegressed.length !== 1 ? 's' : ''} that passed in the previous run are now failing — these represent active compliance regression.
                </div>
                {filteredRegressed.map((item, i) => (
                  <DriftCard key={i} item={item} direction="regressed" />
                ))}
              </>
            )
          )}

          {/* Recovered tab */}
          {!prevLoading && tab === 'recovered' && prevRun && (
            filteredRecovered.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '32px', border: '1px dashed var(--card-border)',
                borderRadius: 10, color: 'var(--text-muted)', fontSize: 14,
              }}>
                No controls recovered since last run
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                  {filteredRecovered.length} control{filteredRecovered.length !== 1 ? 's' : ''} that were failing in the previous run are now passing — good progress.
                </div>
                {filteredRecovered.map((item, i) => (
                  <DriftCard key={i} item={item} direction="recovered" />
                ))}
              </>
            )
          )}

          {/* State drift tab */}
          {tab === 'state' && (
            !run.plan_changes ? (
              <div style={{
                textAlign: 'center', padding: '40px 20px',
                border: '1px dashed var(--card-border)', borderRadius: 10,
                color: 'var(--text-muted)', fontSize: 14,
              }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                <strong>No Terraform plan attached to this run</strong>
                <div style={{ marginTop: 6, fontSize: 12 }}>
                  Pass <code style={{ background: 'var(--bg-secondary)', padding: '1px 4px', borderRadius: 3 }}>--plan-file plan.json</code> to WAF++ to capture state drift from your Terraform plan.
                </div>
              </div>
            ) : filteredStateDrift.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '32px', border: '1px dashed var(--card-border)',
                borderRadius: 10, color: '#059669', fontSize: 14,
              }}>
                ✅ No actionable state changes in the attached plan
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                  {filteredStateDrift.length} resource{filteredStateDrift.length !== 1 ? 's' : ''} with
                  infrastructure state changes — <strong style={{ color: '#dc2626' }}>{secStateChanges}</strong> involve security-sensitive attributes
                  {nonCompliantDrift > 0 && <>, <strong style={{ color: '#7c3aed' }}>{nonCompliantDrift}</strong> are also non-compliant</>}.
                </div>
                {filteredStateDrift.map((c, i) => (
                  <StateDriftCard key={i} change={c} failingResources={failingResources} />
                ))}
              </>
            )
          )}
        </div>

        {/* Right — score trend + pillar delta */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Score trend */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
              Score trend · {run.project}
            </div>
            <ScoreTrend projectRuns={projectRuns} currentId={run.id} />
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
              <span>oldest</span>
              <span>{projectRuns.length} run{projectRuns.length !== 1 ? 's' : ''}</span>
              <span>latest</span>
            </div>
          </div>

          {/* Pillar delta */}
          {prevRun && (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '16px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
                Pillar score delta
              </div>
              {Object.entries(run.pillar_scores).map(([pillar, score]) => {
                const prev = prevRun.pillar_scores[pillar] ?? score
                const delta = score - prev
                return (
                  <div key={pillar} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pillar}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: delta > 0 ? '#059669' : delta < 0 ? '#dc2626' : 'var(--text-muted)',
                        }}>
                          {delta > 0 ? '+' : ''}{delta !== 0 ? delta.toFixed(0) : '—'}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', width: 28, textAlign: 'right' }}>
                          {score.toFixed(0)}
                        </span>
                      </div>
                    </div>
                    <div style={{ height: 4, background: 'var(--bg-secondary)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${score}%`,
                        background: score >= 80 ? '#059669' : score >= 60 ? '#d97706' : '#dc2626',
                        borderRadius: 2, transition: 'width .3s',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* State drift summary chip strip */}
          {run.plan_changes && (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '16px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
                Plan summary
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(Object.entries(run.plan_changes.summary) as [string, number][])
                  .filter(([, v]) => v > 0)
                  .map(([key, val]) => {
                    const meta = actionMeta(key === 'add' ? 'create' : key === 'change' ? 'update' : key === 'destroy' ? 'delete' : key)
                    return (
                      <div key={key} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 12px', borderRadius: 6,
                        background: meta.bg, border: `1px solid ${meta.color}33`,
                      }}>
                        <span style={{ fontWeight: 700, color: meta.color, fontSize: 15 }}>{meta.glyph}</span>
                        <span style={{ fontWeight: 700, color: meta.color, fontSize: 14 }}>{val}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{key}</span>
                      </div>
                    )
                  })}
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                Terraform {run.plan_changes.terraform_version} · scanned {new Date(run.plan_changes.scanned_at).toLocaleString()}
              </div>
            </div>
          )}

          {/* Previous run info */}
          {prevRun && (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: '16px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
                Baseline run
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                <div><strong>Branch:</strong> {prevRun.branch}</div>
                <div><strong>Score:</strong> {prevRun.score}</div>
                <div><strong>SHA:</strong> <span style={{ fontFamily: 'monospace' }}>{prevRun.git_sha?.slice(0, 8)}</span></div>
                <div><strong>By:</strong> {prevRun.triggered_by}</div>
                <div><strong>Date:</strong> {new Date(prevRun.created_at).toLocaleString()}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {stateDrift.length === 0 && (
        <></>
      )}
    </div>
  )
}
