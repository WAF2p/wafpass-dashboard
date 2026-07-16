import { useState, useMemo } from 'react'
import { RunDetail, Finding } from '../api'
import { useI18n } from '../i18n'

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
  { key: 'agentic',        label: 'Agentic',        color: '#ec4899' },
]

// Normalize pillar names: database uses "operational", dashboard uses "operations"
function normalizePillarName(pillar: string): string {
  if (pillar === 'operational') return 'operations'
  return pillar
}

function scoreColor(s: number) {
  return s >= 80 ? '#059669' : s >= 60 ? '#d97706' : '#DA2C38'
}

function scoreBg(s: number) {
  return s >= 80 ? 'rgba(5,150,105,.12)' : s >= 60 ? 'rgba(217,119,6,.12)' : 'rgba(218,44,56,.12)'
}

// ── Data model ────────────────────────────────────────────────────────────────

interface ControlSummary {
  id: string
  title: string
  severity: string
  failCount: number
}

interface ModuleData {
  path: string
  displayName: string
  depth: number
  findings: Finding[]
  pass: number
  fail: number
  skip: number
  score: number
  critFail: number
  highFail: number
  medFail: number
  lowFail: number
  uniqueResources: number
  failingResources: number
  topControls: ControlSummary[]
  pillarScores: { key: string; label: string; color: string; pass: number; fail: number; score: number }[]
  worstSeverity: string
  scoreDrag: number
}

function buildModules(findings: Finding[], overallScore: number): ModuleData[] {
  const totalFails = findings.filter(f => f.status?.toUpperCase() === 'FAIL').length

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

    const normalizedFindings = mFindings.map(f => ({
      ...f,
      pillar: f.pillar ? normalizePillarName(f.pillar) : undefined
    }))

    const pillarScores = PILLAR_META.map(p => {
      const pf = normalizedFindings.filter(f => f.pillar?.toLowerCase() === p.key)
      const pPass = pf.filter(f => f.status?.toUpperCase() === 'PASS').length
      const pFail = pf.filter(f => f.status?.toUpperCase() === 'FAIL').length
      const pScore = pPass + pFail > 0 ? Math.round((pPass / (pPass + pFail)) * 100) : -1
      return { ...p, pass: pPass, fail: pFail, score: pScore }
    })

    const worstSeverity = critFail > 0 ? 'CRITICAL' : highFail > 0 ? 'HIGH' : medFail > 0 ? 'MEDIUM' : lowFail > 0 ? 'LOW' : 'PASS'

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

function SevBadge({ sev, count, showLabel = true }: { sev: string; count: number; showLabel?: boolean }) {
  if (count === 0) return null
  const s = sev.toUpperCase()
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
      fontSize: '0.62rem', fontWeight: 800, borderRadius: '6px', padding: '0.15rem 0.45rem',
      background: SEV_BG[s] ?? SEV_BG.INFO, color: SEV_COLOR[s] ?? '#94a3b8',
      letterSpacing: '0.03em', flexShrink: 0,
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: SEV_COLOR[s] ?? '#94a3b8' }} />
      {showLabel && <span>{s}</span>}
      <span>{count}</span>
    </span>
  )
}

function ScoreRing({ score, size = 72, thickness = 7 }: { score: number; size?: number; thickness?: number }) {
  const color = scoreColor(score)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--border)" strokeWidth={thickness}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={thickness}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column',
      }}>
        <span style={{ fontSize: size > 60 ? '1rem' : '0.75rem', fontWeight: 900, color, lineHeight: 1 }}>{score}%</span>
      </div>
    </div>
  )
}

function MiniBar({ value, total, color, height = 6 }: { value: number; total: number; color: string; height?: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div style={{ height, borderRadius: height / 2, background: 'var(--bg)', overflow: 'hidden', width: '100%' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: height / 2, transition: 'width .3s' }} />
    </div>
  )
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.25rem', lineHeight: 1.5 }}>
          {subtitle}
        </div>
      )}
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
  const leftPad = 1 + mod.depth * 0.55

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.7rem', width: '100%',
        padding: `0.7rem 1rem 0.7rem ${leftPad}rem`,
        background: selected ? 'rgba(0,148,255,.07)' : 'transparent',
        border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer',
        textAlign: 'left', transition: 'background .12s',
        borderLeft: selected ? '3px solid var(--waf-brand)' : '3px solid transparent',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)' }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
    >
      {/* Depth connector + severity dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
        {mod.depth > 0 && (
          <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontFamily: 'monospace', opacity: 0.5 }}>
            {'└'}
          </span>
        )}
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: accentColor }} />
      </div>

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {mod.displayName}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
          <div style={{ flex: 1, minWidth: '40px' }}>
            <MiniBar value={mod.pass} total={mod.pass + mod.fail} color={mod.fail === 0 ? '#059669' : '#DA2C38'} />
          </div>
          <span style={{ fontSize: '0.62rem', color: 'var(--muted)', flexShrink: 0 }}>
            {mod.pass + mod.fail} checks
          </span>
        </div>
      </div>

      {/* Score badge */}
      <div style={{
        flexShrink: 0, textAlign: 'center', minWidth: '2.6rem',
        padding: '0.25rem 0.45rem', borderRadius: '6px',
        background: scoreBg(mod.score), color: scoreColor(mod.score),
        fontSize: '0.78rem', fontWeight: 800,
      }}>
        {mod.score}%
      </div>

      {/* Fail count */}
      {mod.fail > 0 && (
        <div style={{ flexShrink: 0, fontSize: '0.72rem', fontWeight: 700, color: '#DA2C38', minWidth: '2.2rem', textAlign: 'right' }}>
          {mod.fail}✗
        </div>
      )}
    </button>
  )
}

// ── Detail panel ───────────────────────────────────────────────────────────────

function DetailPanel({ mod }: { mod: ModuleData }) {
  const { t } = useI18n()
  const [showAll, setShowAll] = useState(false)
  const [statusFilter, setStatusFilter] = useState('FAIL')

  const selectStyle: React.CSSProperties = {
    background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.78rem', outline: 'none',
  }

  const filtered = mod.findings.filter(f => !statusFilter || f.status?.toUpperCase() === statusFilter)
  const shown = showAll ? filtered : filtered.slice(0, 14)

  const totalChecks = mod.pass + mod.fail + mod.skip
  const severityRows = [
    { key: 'CRITICAL', count: mod.critFail, color: SEV_COLOR.CRITICAL },
    { key: 'HIGH',     count: mod.highFail, color: SEV_COLOR.HIGH },
    { key: 'MEDIUM',   count: mod.medFail,  color: SEV_COLOR.MEDIUM },
    { key: 'LOW',      count: mod.lowFail,  color: SEV_COLOR.LOW },
  ]
  const statusRows = [
    { key: 'PASS', count: mod.pass, color: STATUS_COLOR.PASS, label: t('pages.moduleScore.passes') },
    { key: 'FAIL', count: mod.fail, color: STATUS_COLOR.FAIL, label: t('pages.moduleScore.failures') },
    { key: 'SKIP', count: mod.skip, color: STATUS_COLOR.SKIP, label: t('pages.moduleScore.skipped') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.25rem 1.5rem' }}>

      {/* Header with score ring */}
      <div style={{
        display: 'flex', gap: '1.25rem', alignItems: 'center',
        padding: '1rem 1.25rem', borderRadius: '12px', background: 'var(--bg)', border: '1px solid var(--border)',
      }}>
        <ScoreRing score={mod.score} size={84} thickness={8} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.2rem' }}>
            {mod.displayName}
          </div>
          <div style={{
            fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'monospace',
            wordBreak: 'break-all', marginBottom: '0.5rem',
          }}>
            {mod.path}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <SevBadge sev="CRITICAL" count={mod.critFail} />
            <SevBadge sev="HIGH"     count={mod.highFail} />
            <SevBadge sev="MEDIUM"   count={mod.medFail} />
            <SevBadge sev="LOW"      count={mod.lowFail} />
          </div>
        </div>
      </div>

      {/* Stats + distribution row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem' }}>

        {/* Stats */}
        <div className="card" style={{ padding: '1rem' }}>
          <SectionTitle title={t('pages.moduleScore.moduleDetails')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {[
              { label: t('pages.moduleScore.resources'), value: mod.uniqueResources },
              { label: t('pages.moduleScore.failingRes'), value: mod.failingResources, color: mod.failingResources > 0 ? '#DA2C38' : undefined },
              { label: t('pages.moduleScore.scoreDrag'), value: mod.scoreDrag > 0 ? `▼${mod.scoreDrag}pt` : '—', color: mod.scoreDrag > 0 ? '#DA2C38' : undefined },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{label}</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: color ?? 'var(--text)' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status breakdown */}
        <div className="card" style={{ padding: '1rem' }}>
          <SectionTitle title={t('pages.moduleScore.statusBreakdown')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {statusRows.map(({ key, count, color, label }) => (
              <div key={key} style={{ display: 'grid', gridTemplateColumns: '3.4rem 1fr 2rem', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {label}
                </span>
                <MiniBar value={count} total={totalChecks} color={color} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color, textAlign: 'right' }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Severity distribution */}
        <div className="card" style={{ padding: '1rem' }}>
          <SectionTitle title={t('pages.moduleScore.severityDistribution')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {severityRows.map(({ key, count, color }) => (
              <div key={key} style={{ display: 'grid', gridTemplateColumns: '3.4rem 1fr 2rem', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {key[0] + key.slice(1).toLowerCase()}
                </span>
                <MiniBar value={count} total={mod.fail || 1} color={color} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color, textAlign: 'right' }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pillar scores */}
      {mod.pillarScores.length > 0 && (
        <div>
          <SectionTitle title={t('pages.moduleScore.pillarScores')} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.75rem' }}>
            {mod.pillarScores.map(p => {
              const hasData = p.score >= 0
              return (
                <div key={p.key} style={{
                  padding: '0.85rem 1rem', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', gap: '0.4rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: p.color }}>{p.label}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: hasData ? scoreColor(p.score) : 'var(--muted)' }}>
                      {hasData ? `${p.score}%` : '—'}
                    </span>
                  </div>
                  {hasData && <MiniBar value={p.pass} total={p.pass + p.fail} color={p.score >= 80 ? p.color : '#DA2C38'} height={5} />}
                  <div style={{ fontSize: '0.62rem', color: 'var(--muted)' }}>
                    {p.pass} {t('pages.moduleScore.passes')} · {p.fail} {t('pages.moduleScore.failures')}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top failing controls */}
      <div>
        <SectionTitle title={t('pages.moduleScore.topIssues')} />
        {mod.topControls.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.6rem' }}>
            {mod.topControls.map(c => {
              const s = (c.severity ?? 'INFO').toUpperCase()
              return (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  padding: '0.55rem 0.75rem', borderRadius: '8px',
                  background: SEV_BG[s] ?? 'var(--bg)', border: `1px solid ${SEV_COLOR[s] ?? '#94a3b8'}30`,
                }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: SEV_COLOR[s] ?? '#94a3b8', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.title || c.id}
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--muted)' }}>{c.id}</div>
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#DA2C38', flexShrink: 0 }}>{c.failCount}✗</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{
            padding: '1rem', borderRadius: '8px', background: 'var(--bg)', border: '1px solid var(--border)',
            color: 'var(--muted)', fontSize: '0.78rem', textAlign: 'center',
          }}>
            {t('pages.moduleScore.noTopIssues')}
          </div>
        )}
      </div>

      {/* Findings list */}
      <div className="card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
          <SectionTitle title={t('pages.moduleScore.findings', { count: String(filtered.length) })} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
            <option value="">{t('common.all')}</option>
            <option value="FAIL">{t('status.fail')}</option>
            <option value="PASS">{t('status.pass')}</option>
            <option value="SKIP">{t('status.skip')}</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {shown.map((f, i) => {
            const st = (f.status ?? '').toUpperCase()
            const sv = (f.severity ?? 'INFO').toUpperCase()
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.45rem 0.6rem', borderRadius: '8px',
                background: st === 'FAIL' ? 'rgba(218,44,56,.04)' : 'var(--bg)',
                border: `1px solid ${st === 'FAIL' ? 'rgba(218,44,56,.15)' : 'var(--border)'}`,
              }}>
                <div style={{
                  width: '3px', alignSelf: 'stretch', minHeight: '18px', borderRadius: '2px',
                  background: STATUS_COLOR[st] ?? '#94a3b8', flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {f.check_title || f.check_id}
                  </div>
                  {f.resource && (
                    <div style={{
                      fontSize: '0.64rem', color: 'var(--muted)', fontFamily: 'monospace',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {f.resource}
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: '0.6rem', fontWeight: 700, borderRadius: '4px', padding: '0.1rem 0.35rem',
                  background: SEV_BG[sv] ?? SEV_BG.INFO, color: SEV_COLOR[sv] ?? '#94a3b8', flexShrink: 0,
                }}>
                  {sv}
                </span>
              </div>
            )
          })}
        </div>

        {filtered.length > 14 && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            style={{
              marginTop: '0.6rem', width: '100%', padding: '0.45rem', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--muted)',
              fontSize: '0.74rem', cursor: 'pointer', fontWeight: 600,
            }}
          >
            {t('pages.moduleScore.showAll', { count: String(filtered.length) })}
          </button>
        )}
        {filtered.length === 0 && (
          <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.78rem' }}>
            {t('pages.moduleScore.noMatchFilter')}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type SortKey = 'score' | 'fail' | 'drag' | 'name' | 'resources'

export default function ModuleScorePage({ run }: Props) {
  const { t } = useI18n()
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
    background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.8rem', outline: 'none',
  }

  if (modules.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
        {t('pages.moduleScore.noFindings')}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.35rem' }}>
            {t('pages.moduleScore.pageTitle')}
          </h1>
          <div style={{ fontSize: '0.82rem', color: 'var(--muted)', maxWidth: '520px', lineHeight: 1.5 }}>
            {t('pages.moduleScore.pageSubtitle')}
          </div>
        </div>
        {run.source_paths && run.source_paths.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--muted)', fontWeight: 600 }}>{t('pages.moduleScore.scannedPaths')}</span>
            {run.source_paths.map(p => (
              <code key={p} style={{
                fontSize: '0.7rem', background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '4px', padding: '0.15em 0.45em', color: 'var(--text)',
              }}>{p}</code>
            ))}
          </div>
        )}
      </div>

      {/* ── Summary cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '0.875rem' }}>
        {[
          {
            label: t('pages.moduleScore.modulesLabel'),
            value: modules.length,
            sub: `${run.source_paths?.length ?? 0} scanned path${run.source_paths?.length !== 1 ? 's' : ''}`,
            color: 'var(--waf-brand)',
          },
          {
            label: t('pages.moduleScore.modulesWithFailures'),
            value: modulesWithFail,
            color: modulesWithFail > 0 ? '#DA2C38' : '#059669',
          },
          {
            label: t('pages.moduleScore.totalFailures'),
            value: totalFails,
            color: totalFails > 0 ? '#DA2C38' : '#059669',
          },
          {
            label: t('pages.moduleScore.criticalFails'),
            value: totalCrit,
            color: totalCrit > 0 ? '#DA2C38' : '#059669',
          },
          {
            label: t('pages.moduleScore.worstModule'),
            value: worstModule?.displayName ?? '—',
            sub: worstModule ? `${worstModule.score}% · ${worstModule.fail} failures` : undefined,
            color: worstModule?.fail ? '#DA2C38' : '#059669',
          },
        ].map(({ label, value, color, sub }) => (
          <div key={label} style={{
            borderRadius: '12px', padding: '1rem 1.1rem',
            background: color ? `${color}0d` : 'var(--bg)',
            border: `1px solid ${color ? `${color}30` : 'var(--border)'}`,
            display: 'flex', flexDirection: 'column', gap: '0.2rem',
          }}>
            <div style={{
              fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
              color: color ?? 'var(--muted)',
            }}>
              {label}
            </div>
            <div style={{
              fontSize: typeof value === 'number' ? '1.6rem' : '0.88rem',
              fontWeight: 800, color: color ?? 'var(--text)', lineHeight: 1.15,
              wordBreak: 'break-word',
            }}>
              {value}
            </div>
            {sub && <div style={{ fontSize: '0.62rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Master-detail ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', minHeight: '560px' }}>

        {/* Left: module directory */}
        <div style={{ width: '380px', flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
          {/* Toolbar */}
          <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.55rem', background: 'var(--bg)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('pages.moduleScore.moduleDirectory')}
            </div>
            <input
              placeholder={t('pages.moduleScore.filterPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ ...selectStyle, fontSize: '0.78rem', padding: '0.4rem 0.6rem' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
              {([
                ['score', t('pages.moduleScore.sortScoreAsc')],
                ['fail',  t('pages.moduleScore.sortFailDesc')],
                ['drag',  t('pages.moduleScore.sortDragDesc')],
                ['name',  t('pages.moduleScore.sortAz')],
              ] as [SortKey, string][]).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setSortKey(k)}
                  style={{
                    fontSize: '0.62rem', fontWeight: 700, padding: '0.2rem 0.45rem',
                    borderRadius: '6px', border: '1px solid var(--border)',
                    background: sortKey === k ? 'var(--waf-brand)' : 'var(--surface)',
                    color: sortKey === k ? '#fff' : 'var(--muted)',
                    cursor: 'pointer', flexShrink: 0,
                    transition: 'all .12s',
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
                {t('pages.moduleScore.noMatch', { search })}
              </div>
            )}
          </div>

          {/* Footer count */}
          <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid var(--border)', fontSize: '0.68rem', color: 'var(--muted)', background: 'var(--bg)' }}>
            {t('pages.moduleScore.modulesOf', { count: String(sorted.length), total: String(modules.length) })}
          </div>
        </div>

        {/* Right: detail panel */}
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
          {selected
            ? <DetailPanel key={selected.path} mod={selected} />
            : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)', fontSize: '0.85rem', padding: '2rem', textAlign: 'center' }}>
                {t('pages.moduleScore.selectFromList')}
              </div>
            )}
        </div>

      </div>
    </div>
  )
}
