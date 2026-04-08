import { useState, useMemo } from 'react'
import { RunDetail, Finding } from '../api'

interface Props { run: RunDetail }

// ── Module path extraction ────────────────────────────────────────────────────
//
// Terraform resource addresses:
//   "aws_s3_bucket.my_bucket"                       → root
//   "module.vpc.aws_vpc.main"                        → module.vpc
//   "module.rds.module.db.aws_db_instance.primary"   → module.rds.module.db
//   "module.eks.aws_eks_cluster.this[0]"             → module.eks
//
// Walk dotted segments, collect consecutive "module.<name>" pairs;
// stop at the first non-"module" token.

function extractModulePath(resource: string): string {
  if (!resource?.trim()) return '(root)'
  const parts = resource.trim().split('.')
  const segs: string[] = []
  let i = 0
  while (i < parts.length - 1 && parts[i] === 'module') {
    segs.push(`module.${parts[i + 1]}`)
    i += 2
  }
  return segs.length > 0 ? segs.join('.') : '(root)'
}

function moduleDisplayName(path: string): string {
  if (path === '(root)') return 'Root'
  // "module.rds.module.db" → "rds / db"
  return path.replace(/module\./g, '').replace(/\./g, ' / ')
}

function moduleDepth(path: string): number {
  if (path === '(root)') return 0
  return (path.match(/module\./g) ?? []).length
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SEV_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 }
const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#DA2C38', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e', INFO: '#94a3b8',
}
const SEV_BG: Record<string, string> = {
  CRITICAL: 'rgba(218,44,56,.12)', HIGH: 'rgba(249,115,22,.12)',
  MEDIUM: 'rgba(234,179,8,.12)', LOW: 'rgba(34,197,94,.12)', INFO: 'rgba(148,163,184,.10)',
}
const STATUS_COLOR: Record<string, string> = {
  PASS: '#059669', FAIL: '#DA2C38', SKIP: '#94a3b8', WAIVED: '#a78bfa',
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

// ── Data model ────────────────────────────────────────────────────────────────

interface ControlSummary {
  id: string
  title: string
  severity: string
  failCount: number   // unique resources failing this control in the module
}

interface ModuleData {
  path: string
  displayName: string
  depth: number
  findings: Finding[]
  pass: number
  fail: number
  skip: number
  score: number       // (pass / (pass + fail)) * 100, or 100 if no fails
  critFail: number
  highFail: number
  medFail: number
  lowFail: number
  uniqueResources: number
  failingResources: number
  topControls: ControlSummary[]   // top 5 by failCount, worst severity first
  pillarScores: { key: string; label: string; color: string; pass: number; fail: number; score: number }[]
  worstSeverity: string           // severity of the worst FAIL finding
  scoreDrag: number               // estimated pts dragged from overall score
}

function buildModules(findings: Finding[], overallScore: number): ModuleData[] {
  const totalFails = findings.filter(f => f.status?.toUpperCase() === 'FAIL').length

  // Group findings by module path
  const grouped = new Map<string, Finding[]>()
  for (const f of findings) {
    const p = extractModulePath(f.resource)
    if (!grouped.has(p)) grouped.set(p, [])
    grouped.get(p)!.push(f)
  }

  return Array.from(grouped.entries()).map(([path, mFindings]) => {
    const pass = mFindings.filter(f => f.status?.toUpperCase() === 'PASS').length
    const fail = mFindings.filter(f => f.status?.toUpperCase() === 'FAIL').length
    const skip = mFindings.filter(f => !['PASS', 'FAIL'].includes(f.status?.toUpperCase())).length
    const score = pass + fail > 0 ? Math.round((pass / (pass + fail)) * 100) : 100

    const failFindings = mFindings.filter(f => f.status?.toUpperCase() === 'FAIL')
    const critFail = failFindings.filter(f => f.severity?.toUpperCase() === 'CRITICAL').length
    const highFail = failFindings.filter(f => f.severity?.toUpperCase() === 'HIGH').length
    const medFail  = failFindings.filter(f => f.severity?.toUpperCase() === 'MEDIUM').length
    const lowFail  = failFindings.filter(f => f.severity?.toUpperCase() === 'LOW').length

    const uniqueResources = new Set(mFindings.map(f => f.resource).filter(Boolean)).size
    const failingResources = new Set(failFindings.map(f => f.resource).filter(Boolean)).size

    // Top controls by fail count
    const ctrlMap = new Map<string, ControlSummary>()
    for (const f of failFindings) {
      if (!f.control_id) continue
      if (!ctrlMap.has(f.control_id)) {
        ctrlMap.set(f.control_id, { id: f.control_id, title: f.check_title ?? f.control_id, severity: f.severity, failCount: 0 })
      }
      ctrlMap.get(f.control_id)!.failCount++
    }
    const topControls = Array.from(ctrlMap.values())
      .sort((a, b) =>
        (SEV_ORDER[a.severity?.toUpperCase()] ?? 9) - (SEV_ORDER[b.severity?.toUpperCase()] ?? 9) ||
        b.failCount - a.failCount
      )
      .slice(0, 5)

    // Pillar scores
    const pillarScores = PILLAR_META.map(p => {
      const pf = mFindings.filter(f => f.pillar?.toLowerCase() === p.key)
      const pPass = pf.filter(f => f.status?.toUpperCase() === 'PASS').length
      const pFail = pf.filter(f => f.status?.toUpperCase() === 'FAIL').length
      const pScore = pPass + pFail > 0 ? Math.round((pPass / (pPass + pFail)) * 100) : -1
      return { ...p, pass: pPass, fail: pFail, score: pScore }
    }).filter(p => p.pass + p.fail > 0)

    // Worst severity in this module's failures
    const worstSeverity = critFail > 0 ? 'CRITICAL' : highFail > 0 ? 'HIGH' : medFail > 0 ? 'MEDIUM' : lowFail > 0 ? 'LOW' : 'PASS'

    // Score drag: proportion of overall failures × remaining score gap
    const scoreDrag = totalFails > 0
      ? Math.round((fail / totalFails) * (100 - overallScore))
      : 0

    return {
      path,
      displayName: moduleDisplayName(path),
      depth: moduleDepth(path),
      findings: mFindings,
      pass, fail, skip, score,
      critFail, highFail, medFail, lowFail,
      uniqueResources, failingResources,
      topControls,
      pillarScores,
      worstSeverity,
      scoreDrag,
    }
  })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SevBadge({ sev, count }: { sev: string; count: number }) {
  if (count === 0) return null
  const s = sev.toUpperCase()
  return (
    <span style={{
      fontSize: '0.62rem', fontWeight: 800, borderRadius: '4px', padding: '0.1rem 0.4rem',
      background: SEV_BG[s] ?? SEV_BG.INFO, color: SEV_COLOR[s] ?? '#94a3b8',
      letterSpacing: '0.04em', flexShrink: 0,
    }}>{count} {s}</span>
  )
}

function ScoreBar({ score, width = '100%' }: { score: number; width?: string }) {
  const color = scoreColor(score)
  return (
    <div style={{ width, height: '6px', borderRadius: '3px', background: 'var(--bg)', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width .3s' }} />
    </div>
  )
}

// ── Module list row ───────────────────────────────────────────────────────────

function ModuleRow({
  mod, selected, onClick,
}: {
  mod: ModuleData; selected: boolean; onClick: () => void
}) {
  const accentColor = mod.fail === 0 ? '#059669' : SEV_COLOR[mod.worstSeverity] ?? '#94a3b8'

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%',
        padding: '0.65rem 1rem', background: selected ? 'rgba(0,148,255,.06)' : 'transparent',
        border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer',
        textAlign: 'left', transition: 'background .1s',
        borderLeft: selected ? '3px solid var(--waf-brand)' : '3px solid transparent',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)' }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
    >
      {/* Severity dot */}
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: accentColor, flexShrink: 0 }} />

      {/* Name + path */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {mod.depth > 0 && (
            <span style={{ fontSize: '0.6rem', color: 'var(--muted)', fontFamily: 'monospace', opacity: 0.6 }}>
              {'└ '.repeat(Math.min(mod.depth, 2))}
            </span>
          )}
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {mod.displayName}
          </span>
        </div>
        <div style={{ marginTop: '0.2rem' }}>
          <ScoreBar score={mod.score} />
        </div>
      </div>

      {/* Score */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '0.88rem', fontWeight: 800, color: scoreColor(mod.score) }}>{mod.score}%</div>
        {mod.scoreDrag > 0 && (
          <div style={{ fontSize: '0.6rem', color: '#DA2C38', fontWeight: 600, whiteSpace: 'nowrap' }}>
            ▼{mod.scoreDrag} pts
          </div>
        )}
      </div>

      {/* Fail count */}
      {mod.fail > 0 && (
        <div style={{ flexShrink: 0, fontSize: '0.72rem', fontWeight: 700, color: '#DA2C38', minWidth: '2rem', textAlign: 'center' }}>
          {mod.fail}✗
        </div>
      )}
    </button>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ mod }: { mod: ModuleData; run: RunDetail }) {
  const [showAll, setShowAll] = useState(false)
  const [statusFilter, setStatusFilter] = useState('FAIL')

  const selectStyle: React.CSSProperties = {
    background: '#fff', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: '6px', padding: '0.3rem 0.5rem', fontSize: '0.75rem', outline: 'none',
  }

  const filtered = mod.findings.filter(f =>
    !statusFilter || f.status?.toUpperCase() === statusFilter
  )
  const shown = showAll ? filtered : filtered.slice(0, 12)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem' }}>

      {/* Score header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
        {/* Score circle */}
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%', flexShrink: 0,
          background: `conic-gradient(${scoreColor(mod.score)} ${mod.score * 3.6}deg, var(--bg) 0deg)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 0 4px #fff, 0 0 0 6px ${scoreColor(mod.score)}30`,
        }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
            <span style={{ fontSize: '1rem', fontWeight: 900, color: scoreColor(mod.score), lineHeight: 1 }}>{mod.score}%</span>
            <span style={{ fontSize: '0.55rem', color: 'var(--muted)', fontWeight: 600 }}>score</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.25rem' }}>
            {mod.displayName}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'monospace', marginBottom: '0.4rem', wordBreak: 'break-all' }}>
            {mod.path}
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <SevBadge sev="CRITICAL" count={mod.critFail} />
            <SevBadge sev="HIGH"     count={mod.highFail} />
            <SevBadge sev="MEDIUM"   count={mod.medFail} />
            <SevBadge sev="LOW"      count={mod.lowFail} />
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
        {[
          { label: 'Resources', value: mod.uniqueResources },
          { label: 'Failing res.', value: mod.failingResources, color: mod.failingResources > 0 ? '#DA2C38' : undefined },
          { label: 'Score drag', value: mod.scoreDrag > 0 ? `▼${mod.scoreDrag}pt` : '—', color: mod.scoreDrag > 0 ? '#DA2C38' : undefined },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ borderRadius: '8px', padding: '0.5rem 0.625rem', background: 'var(--bg)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)' }}>{label}</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: color ?? 'var(--text)', marginTop: '0.1rem' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Pillar breakdown */}
      {mod.pillarScores.length > 0 && (
        <div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)', marginBottom: '0.5rem' }}>Pillar Scores</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {mod.pillarScores.map(p => (
              <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '72px', fontSize: '0.68rem', fontWeight: 600, color: p.color, flexShrink: 0, textAlign: 'right' }}>{p.label}</div>
                <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'var(--bg)', overflow: 'hidden' }}>
                  <div style={{ width: `${p.score}%`, height: '100%', background: p.score < 60 ? '#DA2C38' : p.score < 80 ? '#d97706' : p.color, borderRadius: '3px', transition: 'width .3s' }} />
                </div>
                <div style={{ width: '32px', fontSize: '0.68rem', fontWeight: 700, color: scoreColor(p.score), textAlign: 'right', flexShrink: 0 }}>{p.score}%</div>
                {p.fail > 0 && <div style={{ fontSize: '0.62rem', color: '#DA2C38', flexShrink: 0 }}>{p.fail}✗</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top failing controls */}
      {mod.topControls.length > 0 && (
        <div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)', marginBottom: '0.4rem' }}>
            Top Failing Controls
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {mod.topControls.map(c => {
              const s = (c.severity ?? 'INFO').toUpperCase()
              return (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.5rem', borderRadius: '6px', background: SEV_BG[s] ?? 'var(--bg)', border: `1px solid ${SEV_COLOR[s] ?? '#94a3b8'}25` }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: SEV_COLOR[s] ?? '#94a3b8', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '0.72rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title || c.id}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--muted)', flexShrink: 0 }}>{c.id}</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#DA2C38', flexShrink: 0 }}>{c.failCount}✗</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Findings list */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)' }}>
            Findings ({filtered.length})
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
            <option value="">All</option>
            <option value="FAIL">FAIL</option>
            <option value="PASS">PASS</option>
            <option value="SKIP">SKIP</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          {shown.map((f, i) => {
            const st = (f.status ?? '').toUpperCase()
            const sv = (f.severity ?? 'INFO').toUpperCase()
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.4rem', padding: '0.3rem 0.4rem',
                borderRadius: '6px', background: st === 'FAIL' ? 'rgba(218,44,56,.04)' : 'var(--bg)',
                border: st === 'FAIL' ? '1px solid rgba(218,44,56,.15)' : '1px solid transparent',
              }}>
                <div style={{ width: '3px', height: '100%', minHeight: '16px', borderRadius: '2px', background: STATUS_COLOR[st] ?? '#94a3b8', flexShrink: 0, alignSelf: 'stretch' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.check_title || f.check_id}
                  </div>
                  {f.resource && (
                    <div style={{ fontSize: '0.62rem', color: 'var(--muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.resource}</div>
                  )}
                </div>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, borderRadius: '3px', padding: '0.05rem 0.3rem', background: SEV_BG[sv] ?? SEV_BG.INFO, color: SEV_COLOR[sv] ?? '#94a3b8', flexShrink: 0 }}>{sv[0]}</span>
              </div>
            )
          })}
        </div>

        {filtered.length > 12 && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            style={{ marginTop: '0.5rem', width: '100%', padding: '0.35rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--muted)', fontSize: '0.72rem', cursor: 'pointer' }}
          >
            Show all {filtered.length} findings
          </button>
        )}
        {filtered.length === 0 && (
          <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.78rem' }}>
            No findings match the filter.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type SortKey = 'score' | 'fail' | 'drag' | 'name' | 'resources'

export default function ModuleScorePage({ run }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [search, setSearch] = useState('')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  const modules = useMemo(() => buildModules(run.findings, run.score), [run])

  const sorted = useMemo(() => {
    let list = modules.filter(m =>
      !search || m.path.toLowerCase().includes(search.toLowerCase()) || m.displayName.toLowerCase().includes(search.toLowerCase())
    )
    switch (sortKey) {
      case 'score':     list = [...list].sort((a, b) => a.score - b.score); break
      case 'fail':      list = [...list].sort((a, b) => b.fail - a.fail); break
      case 'drag':      list = [...list].sort((a, b) => b.scoreDrag - a.scoreDrag); break
      case 'name':      list = [...list].sort((a, b) => a.path.localeCompare(b.path)); break
      case 'resources': list = [...list].sort((a, b) => b.uniqueResources - a.uniqueResources); break
    }
    return list
  }, [modules, sortKey, search])

  const selected = useMemo(
    () => sorted.find(m => m.path === selectedPath) ?? sorted[0] ?? null,
    [sorted, selectedPath]
  )

  // Summary stats
  const worstModule = useMemo(() => [...modules].sort((a, b) => a.score - b.score)[0], [modules])
  const totalFails = useMemo(() => modules.reduce((s, m) => s + m.fail, 0), [modules])
  const totalCrit  = useMemo(() => modules.reduce((s, m) => s + m.critFail, 0), [modules])
  const modulesWithFail = modules.filter(m => m.fail > 0).length

  const selectStyle: React.CSSProperties = {
    background: '#fff', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.8rem', outline: 'none',
  }

  if (modules.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
        No findings with resource addresses in this run.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Summary strip ── */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Modules', value: modules.length, sub: `${run.source_paths?.length ?? 0} scanned path${run.source_paths?.length !== 1 ? 's' : ''}` },
          { label: 'Modules with failures', value: modulesWithFail, color: modulesWithFail > 0 ? '#DA2C38' : undefined },
          { label: 'Total failures', value: totalFails, color: totalFails > 0 ? '#DA2C38' : undefined },
          { label: 'Critical fails', value: totalCrit, color: totalCrit > 0 ? '#DA2C38' : undefined },
          { label: 'Worst module', value: worstModule?.displayName ?? '—', sub: worstModule ? `${worstModule.score}%` : undefined, color: worstModule?.fail ? '#DA2C38' : undefined },
        ].map(({ label, value, color, sub }) => (
          <div key={label} style={{
            flex: 1, minWidth: '110px', borderRadius: '10px', padding: '0.75rem 1rem',
            background: color ? `${color}0d` : '#fafbfc',
            border: `1px solid ${color ? `${color}30` : 'var(--border)'}`,
          }}>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: color ?? 'var(--muted)', marginBottom: '0.2rem' }}>{label}</div>
            <div style={{ fontSize: typeof value === 'number' ? '1.5rem' : '0.88rem', fontWeight: 800, color: color ?? 'var(--text)', lineHeight: 1, wordBreak: 'break-word' }}>{value}</div>
            {sub && <div style={{ fontSize: '0.62rem', color: 'var(--muted)', marginTop: '0.15rem' }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Source paths note ── */}
      {run.source_paths?.length > 0 && (
        <div style={{ padding: '0.5rem 0.875rem', borderRadius: '8px', background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <svg width="13" height="13" fill="none" stroke="var(--muted)" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span style={{ fontSize: '0.68rem', color: 'var(--muted)', fontWeight: 600 }}>Scanned paths:</span>
          {run.source_paths.map(p => (
            <code key={p} style={{ fontSize: '0.7rem', background: '#fff', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.1em 0.4em', color: 'var(--text)' }}>{p}</code>
          ))}
        </div>
      )}

      {/* ── Master-detail ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', minHeight: '480px' }}>

        {/* Left: module list */}
        <div style={{ width: '300px', flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          {/* Toolbar */}
          <div style={{ padding: '0.625rem 0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'var(--bg)' }}>
            <input
              placeholder="Filter modules…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...selectStyle, fontSize: '0.78rem', padding: '0.35rem 0.5rem' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.62rem', color: 'var(--muted)', fontWeight: 600, flexShrink: 0 }}>Sort:</span>
              {([
                ['score', 'Score ↑'],
                ['fail', 'Fails ↓'],
                ['drag', 'Drag ↓'],
                ['name', 'A–Z'],
              ] as [SortKey, string][]).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setSortKey(k)}
                  style={{
                    fontSize: '0.62rem', fontWeight: 600, padding: '0.15rem 0.4rem',
                    borderRadius: '4px', border: '1px solid var(--border)',
                    background: sortKey === k ? 'var(--waf-brand)' : '#fff',
                    color: sortKey === k ? '#fff' : 'var(--muted)',
                    cursor: 'pointer', flexShrink: 0,
                  }}
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {sorted.map(m => (
              <ModuleRow
                key={m.path}
                mod={m}
                selected={(selected?.path ?? null) === m.path}
                onClick={() => setSelectedPath(m.path)}
              />
            ))}
            {sorted.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>
                No modules match "{search}"
              </div>
            )}
          </div>

          {/* Footer count */}
          <div style={{ padding: '0.4rem 0.75rem', borderTop: '1px solid var(--border)', fontSize: '0.65rem', color: 'var(--muted)', background: 'var(--bg)' }}>
            {sorted.length} of {modules.length} module{modules.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Right: detail panel */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {selected
            ? <DetailPanel key={selected.path} mod={selected} run={run} />
            : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontSize: '0.85rem' }}>
                Select a module to see details.
              </div>
            )}
        </div>
      </div>
    </div>
  )
}
