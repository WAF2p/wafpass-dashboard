import { useState } from 'react'
import {
  Bar, BarChart, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Finding, RunDetail } from '../api'

interface Props {
  run: RunDetail
  onNav?: (page: string) => void
}

// ── Auto-fix helpers ────────────────────────────────────────────────────────

type FixKind = 'auto' | 'manual'

interface FixEntry {
  checkId: string
  controlId: string
  resource: string
  reason?: string   // only for manual
  kind: FixKind
}

const MANUAL_PATTERNS: { test: (id: string) => boolean; reason: string }[] = [
  { test: id => /s3.encryption|rds.encryption/i.test(id),    reason: 'requires adding an encryption block (structural change)' },
  { test: id => /no.open.sg|security.group/i.test(id),       reason: 'negation rule — safe replacement cannot be inferred automatically' },
  { test: id => /scp|organizations/i.test(id),               reason: 'requires creating a separate resource block' },
]

function classifyFinding(f: Finding): FixKind {
  const id = f.check_id ?? ''
  if (MANUAL_PATTERNS.some(p => p.test(id))) return 'manual'
  return 'auto'
}

function manualReason(checkId: string): string {
  return MANUAL_PATTERNS.find(p => p.test(checkId))?.reason ?? 'no auto-fix recipe available for this check'
}

// ── CopyBlock ───────────────────────────────────────────────────────────────

function CopyBlock({ code, lang = '' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ position: 'relative', marginTop: '0.25rem' }}>
      <pre style={{
        background: '#0f172a', color: '#e2e8f0', borderRadius: '8px',
        padding: '0.75rem 3rem 0.75rem 0.875rem', fontSize: '0.78rem',
        overflowX: 'auto', lineHeight: 1.7, margin: 0, whiteSpace: 'pre',
      }}>
        {lang && (
          <span style={{ position: 'absolute', top: '0.4rem', left: '0.7rem', fontSize: '0.58rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {lang}
          </span>
        )}
        {code}
      </pre>
      <button
        onClick={() => navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })}
        style={{
          position: 'absolute', top: '0.4rem', right: '0.4rem',
          background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)',
          borderRadius: '5px', color: copied ? '#22c55e' : '#94a3b8',
          fontSize: '0.65rem', padding: '0.15rem 0.45rem', cursor: 'pointer',
        }}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}

// ── AutoFix Modal ───────────────────────────────────────────────────────────

interface AutoFixModalProps {
  run: RunDetail
  findings: Finding[]       // failing findings to scope (all FAILs, or filtered set)
  scopeLabel: string        // e.g. "all failing controls" or "WAF-SEC-010"
  onClose: () => void
}

function AutoFixModal({ run, findings, scopeLabel, onClose }: AutoFixModalProps) {
  const iacPath = run.path || run.source_paths?.[0] || '/path/to/terraform'
  const iac     = run.iac_framework && run.iac_framework !== 'terraform' ? run.iac_framework : null

  // Classify
  const entries: FixEntry[] = findings.map(f => ({
    checkId:   f.check_id,
    controlId: f.control_id,
    resource:  f.resource,
    kind:      classifyFinding(f),
    reason:    classifyFinding(f) === 'manual' ? manualReason(f.check_id) : undefined,
  }))

  const autoEntries   = entries.filter(e => e.kind === 'auto')
  const manualEntries = entries.filter(e => e.kind === 'manual')

  // Unique control IDs for scoped command
  const ctrlIds = Array.from(new Set(autoEntries.map(e => e.controlId).filter(Boolean)))

  // Build commands
  const iacFlag   = iac ? ` \\\n  --iac ${iac}` : ''
  const ctrlsFlag = ctrlIds.length > 0 && ctrlIds.length < findings.length
    ? ` \\\n  --controls "${ctrlIds.join(',')}"` : ''

  const dryRunCmd = `wafpass fix${iacFlag} \\\n  ${iacPath}`
  const applyCmd  = `wafpass fix${iacFlag}${ctrlsFlag} \\\n  --apply \\\n  ${iacPath}`
  const scopedDryRun = ctrlIds.length > 0
    ? `wafpass fix${iacFlag}${ctrlsFlag} \\\n  ${iacPath}`
    : null

  // Group manual by reason for display
  const manualByReason = manualEntries.reduce<Record<string, FixEntry[]>>((acc, e) => {
    const key = e.reason ?? 'no recipe'
    ;(acc[key] ??= []).push(e)
    return acc
  }, {})

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 99 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '720px', maxWidth: '94vw', maxHeight: '88vh',
        background: '#fff', borderRadius: '14px',
        boxShadow: '0 24px 64px rgba(15,23,42,.2)',
        display: 'flex', flexDirection: 'column', zIndex: 100, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.25rem 1rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg style={{ width: '1.1rem', height: '1.1rem', color: 'var(--waf-brand)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>Auto-Fix CLI Commands</span>
                <span style={{ background: 'rgba(234,88,12,.12)', color: '#c2410c', fontSize: '0.55rem', fontWeight: 800, padding: '0.1rem 0.35rem', borderRadius: '3px', lineHeight: 1.2 }}>α</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.3rem' }}>
                Scope: <strong style={{ color: 'var(--text)' }}>{scopeLabel}</strong>
                {' · '}
                <span style={{ color: '#16a34a', fontWeight: 600 }}>{autoEntries.length} auto-fixable</span>
                {manualEntries.length > 0 && <span style={{ color: 'var(--muted)' }}> · {manualEntries.length} need manual review</span>}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.1rem', flexShrink: 0, padding: '0.2rem' }}>✕</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Explanation banner */}
          <div style={{ background: 'rgba(0,148,255,.06)', border: '1px solid rgba(0,148,255,.2)', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.6 }}>
            Run the commands below in your terminal where the IaC source lives. The dry-run shows a coloured diff without touching any files. Add <code style={{ color: 'var(--waf-brand)' }}>--apply</code> to write the patches to disk — a <code style={{ color: 'var(--waf-brand)' }}>.tf.bak</code> backup is created automatically.
          </div>

          {/* Dry-run preview */}
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
              1 · Preview changes (dry-run, no files modified)
            </div>
            <CopyBlock code={dryRunCmd} lang="sh" />
          </div>

          {/* Scoped dry-run (if auto-fixable subset) */}
          {scopedDryRun && scopedDryRun !== dryRunCmd && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
                2 · Preview only auto-fixable controls
              </div>
              <CopyBlock code={scopedDryRun} lang="sh" />
            </div>
          )}

          {/* Apply */}
          {autoEntries.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
                {scopedDryRun && scopedDryRun !== dryRunCmd ? '3' : '2'} · Apply patches to disk
              </div>
              <CopyBlock code={applyCmd} lang="sh" />
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.4rem' }}>
                A <code style={{ color: 'var(--text)' }}>.tf.bak</code> backup is created next to each modified file. Remove with <code style={{ color: 'var(--text)' }}>find . -name "*.tf.bak" -delete</code> once satisfied.
              </div>
            </div>
          )}

          {/* Auto-fixable list */}
          {autoEntries.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                Auto-fixable ({autoEntries.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {autoEntries.map((e, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.6rem', borderRadius: '7px', background: 'rgba(22,163,74,.05)', border: '1px solid rgba(22,163,74,.15)' }}>
                    <svg style={{ width: '0.85rem', height: '0.85rem', color: '#22c55e', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--muted)', flexShrink: 0 }}>{e.controlId}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.resource}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manual-fix list */}
          {manualEntries.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
                Needs manual review ({manualEntries.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(manualByReason).map(([reason, items]) => (
                  <div key={reason}>
                    <div style={{ fontSize: '0.75rem', color: '#b45309', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <svg style={{ width: '0.8rem', height: '0.8rem', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {reason}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingLeft: '1rem' }}>
                      {items.map((e, i) => (
                        <div key={i} style={{ display: 'flex', gap: '0.6rem', fontSize: '0.72rem' }}>
                          <span style={{ fontFamily: 'monospace', color: 'var(--muted)', flexShrink: 0 }}>{e.controlId}</span>
                          <span style={{ fontFamily: 'monospace', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.resource}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nothing fixable */}
          {autoEntries.length === 0 && manualEntries.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
              No failing findings in the current scope.
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '0.45rem 1.1rem', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </>
  )
}

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: '#DA2C38',
  HIGH:     '#f97316',
  MEDIUM:   '#eab308',
  LOW:      '#22c55e',
}

const PROVIDER_COLOR: Record<string, string> = {
  aws: '#f97316', azure: '#2b7fff', gcp: '#22c55e',
  oci: '#c74634', alicloud: '#ff6a00', yandex: '#fcdb03',
}

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

function scoreColor(s: number) {
  return s >= 80 ? '#059669' : s >= 60 ? '#d97706' : '#DA2C38'
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`
}

/** Circular SVG donut score */
function ScoreDonut({ score }: { score: number }) {
  const R = 54, C = 2 * Math.PI * R
  const arc = (score / 100) * C
  const color = scoreColor(score)
  const label = score >= 80 ? 'Good posture' : score >= 60 ? 'Needs attention' : 'High risk'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--border)" strokeWidth="12" />
        <circle
          cx="70" cy="70" r={R} fill="none"
          stroke={color} strokeWidth="12"
          strokeDasharray={`${arc} ${C}`}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x="70" y="66" textAnchor="middle" fill={color} fontSize="28" fontWeight="800">{score}</text>
        <text x="70" y="83" textAnchor="middle" fill="#94a3b8" fontSize="12">/100</text>
      </svg>
      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{label}</div>
    </div>
  )
}

/** Single stat card with icon */
function StatCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string; color?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
      {icon && (
        <div style={{ width: '2rem', height: '2rem', borderRadius: '8px', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '0.1rem' }}>
          {icon}
        </div>
      )}
      <div>
        <div style={{ fontSize: '1.625rem', fontWeight: 800, color: color ?? 'var(--text)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', marginTop: '0.2rem' }}>{label}</div>
        {sub && <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{sub}</div>}
      </div>
    </div>
  )
}

/** Horizontal progress bar row */
function ProgressRow({ label, pass, total }: { label: string; pass: number; total: number }) {
  const pct = total > 0 ? Math.round((pass / total) * 100) : 0
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#facc15' : '#ef4444'
  const textColor = pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626'
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text)', textTransform: 'capitalize' }}>
          {label.replace(/_/g, ' ')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{pass}/{total}</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, width: '2.5rem', textAlign: 'right', color: textColor }}>{pct}%</span>
        </div>
      </div>
      <div style={{ height: '7px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: '999px', background: color, width: `${pct}%`, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

export default function DashboardPage({ run, onNav }: Props) {
  const findings = run.findings

  // — Auto-fix modal state —
  const [autoFix, setAutoFix] = useState<{ findings: Finding[]; scopeLabel: string } | null>(null)

  // — Control-level aggregation —
  const controlIds = Array.from(new Set(findings.map(f => f.control_id).filter(Boolean)))
  let ctrlPass = 0, ctrlFail = 0, ctrlSkip = 0, ctrlWaived = 0
  for (const cid of controlIds) {
    const cf = findings.filter(f => f.control_id === cid)
    const statuses = cf.map(f => f.status?.toUpperCase())
    if (statuses.some(s => s === 'WAIVED')) { ctrlWaived++; continue }
    if (statuses.some(s => s === 'FAIL'))   { ctrlFail++;   continue }
    if (statuses.every(s => s === 'PASS'))  { ctrlPass++;   continue }
    ctrlSkip++
  }

  // — Check-level stats —
  const total       = findings.length
  const pass        = findings.filter(f => f.status?.toUpperCase() === 'PASS').length
  const passRate    = total > 0 ? Math.round((pass / total) * 100) : 0
  const resources   = new Set(findings.map(f => f.resource).filter(Boolean)).size
  const failResources = new Set(
    findings.filter(f => f.status?.toUpperCase() === 'FAIL').map(f => f.resource).filter(Boolean)
  ).size

  // — Severity breakdown (failing findings) —
  const severityCounts = SEVERITIES.map(s => ({
    name: s,
    value: findings.filter(f =>
      f.status?.toUpperCase() === 'FAIL' && f.severity?.toUpperCase() === s
    ).length,
  })).filter(d => d.value > 0)

  // — Pillar bar chart —
  const pillarData = Object.entries(run.pillar_scores).map(([p, s]) => ({ pillar: p, score: s }))

  // — Critical & high failures —
  const critHighFails = findings
    .filter(f => f.status?.toUpperCase() === 'FAIL' && ['CRITICAL', 'HIGH'].includes(f.severity?.toUpperCase()))
    .slice(0, 6)

  // — Heatmap —
  const pillars = Array.from(new Set(
    findings.map(f => f.pillar).filter((p): p is string => Boolean(p))
  )).sort()
  type HeatCell = { pillar: string; severity: string; count: number }
  const heatmap: HeatCell[] = []
  for (const p of pillars) {
    for (const s of SEVERITIES) {
      heatmap.push({
        pillar: p, severity: s,
        count: findings.filter(f =>
          f.pillar === p && f.severity?.toUpperCase() === s && f.status?.toUpperCase() === 'FAIL'
        ).length,
      })
    }
  }
  const heatMax = heatmap.reduce((m, c) => Math.max(m, c.count), 1)

  // — Pass rate by category —
  const ctrlCatMap = new Map<string, string>()
  for (const c of run.controls_meta) ctrlCatMap.set(c.id, c.category)
  const catMap = new Map<string, { pass: number; total: number }>()
  for (const f of findings) {
    const cat = ctrlCatMap.get(f.control_id) ?? f.pillar ?? 'other'
    if (!cat) continue
    const e = catMap.get(cat) ?? { pass: 0, total: 0 }
    e.total++
    if (f.status?.toUpperCase() === 'PASS') e.pass++
    catMap.set(cat, e)
  }
  const categoryBreakdown = Array.from(catMap.entries())
    .map(([cat, { pass, total }]) => ({ cat, pass, total }))
    .sort((a, b) => (a.pass / a.total) - (b.pass / b.total))

  // — Regulatory readiness —
  const fwMap = new Map<string, { pass: number; total: number }>()
  for (const ctrl of run.controls_meta) {
    const ctrlFindings = findings.filter(f => f.control_id === ctrl.id)
    if (!ctrlFindings.length) continue
    const ctrlPasses = ctrlFindings.every(f => f.status?.toUpperCase() === 'PASS')
    for (const rm of ctrl.regulatory_mapping) {
      const e = fwMap.get(rm.framework) ?? { pass: 0, total: 0 }
      e.total++
      if (ctrlPasses) e.pass++
      fwMap.set(rm.framework, e)
    }
  }
  const regulatoryReadiness = Array.from(fwMap.entries())
    .map(([framework, { pass, total }]) => ({ framework, pass, total }))
    .sort((a, b) => (a.pass / a.total) - (b.pass / b.total))

  // — Cloud footprint —
  const detectedRegions = run.detected_regions ?? []
  const providerCounts = detectedRegions.reduce<Record<string, number>>((acc, [, prov]) => {
    if (prov) acc[prov] = (acc[prov] ?? 0) + 1
    return acc
  }, {})

  // — All failing findings (used by auto-fix) —
  const allFails = findings.filter(f => f.status?.toUpperCase() === 'FAIL')

  // — Quick wins —
  const SWEIGHT: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
  const quickWins = allFails
    .sort((a, b) =>
      (SWEIGHT[a.severity?.toUpperCase() ?? ''] ?? 0) >
      (SWEIGHT[b.severity?.toUpperCase() ?? ''] ?? 0) ? -1 : 1
    )
    .slice(0, 6)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* ── Row 1: control-level KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(5,150,105,.06)', borderColor: 'rgba(5,150,105,.2)' }}>
          <div style={{ fontSize: '1.875rem', fontWeight: 800, color: '#059669' }}>{ctrlPass}</div>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginTop: '0.2rem' }}>Passed Controls</div>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(218,44,56,.06)', borderColor: 'rgba(218,44,56,.2)' }}>
          <div style={{ fontSize: '1.875rem', fontWeight: 800, color: '#DA2C38' }}>{ctrlFail}</div>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginTop: '0.2rem' }}>Failed Controls</div>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(91,100,116,.05)', borderColor: 'rgba(91,100,116,.15)' }}>
          <div style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--muted)' }}>{ctrlSkip}</div>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginTop: '0.2rem' }}>Skipped Controls</div>
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(124,58,237,.06)', borderColor: 'rgba(124,58,237,.18)' }}>
          <div style={{ fontSize: '1.875rem', fontWeight: 800, color: '#7c3aed' }}>{ctrlWaived}</div>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginTop: '0.2rem' }}>Waived Controls</div>
        </div>
      </div>

      {/* ── Row 2: Score donut + Pillar bar ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>WAF++ Score</div>
          <ScoreDonut score={run.score} />
        </div>

        {pillarData.length > 0 && (
          <div className="card">
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
              Score by Pillar
            </h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pillarData} layout="vertical" margin={{ left: 0, right: 16 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                <YAxis type="category" dataKey="pillar" width={90} tick={{ fontSize: 11, fill: 'var(--text)' }} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.8rem' }} />
                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                  {pillarData.map(d => <Cell key={d.pillar} fill={scoreColor(d.score)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Cloud Footprint ── */}
      {detectedRegions.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <svg style={{ width: '1rem', height: '1rem', color: 'var(--waf-brand)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 004 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
              </svg>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>Cloud Footprint</span>
            </div>
            {onNav && (
              <button onClick={() => onNav('regions')} style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--waf-brand)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                View full map →
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.5rem 1rem', borderRadius: '10px', background: 'rgba(0,148,255,.07)', border: '1px solid rgba(0,148,255,.18)' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--waf-brand)' }}>{detectedRegions.length}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem' }}>Regions</span>
            </div>
            {Object.entries(providerCounts).map(([prov, cnt]) => (
              <div key={prov} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: PROVIDER_COLOR[prov] ?? '#888', flexShrink: 0 }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase' }}>{prov}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{cnt} region{cnt > 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Row 3: Severity pie + Critical/High failures ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {severityCounts.length > 0 && (
          <div className="card">
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
              Failed Controls by Severity
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={severityCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {severityCounts.map(d => <Cell key={d.name} fill={SEVERITY_COLOR[d.name] ?? '#94a3b8'} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.8rem' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {critHighFails.length > 0 && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
              <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1, margin: 0 }}>
                Critical &amp; High Failures
              </h2>
              <button
                onClick={() => setAutoFix({ findings: critHighFails, scopeLabel: 'critical & high failures' })}
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.6rem', borderRadius: '6px', border: '1px solid rgba(0,148,255,.3)', background: 'rgba(0,148,255,.07)', color: 'var(--waf-brand)', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
              >
                <svg style={{ width: '0.7rem', height: '0.7rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Auto-Fix
                <span style={{ background: 'rgba(234,88,12,.12)', color: '#c2410c', fontSize: '0.48rem', fontWeight: 800, padding: '0.05rem 0.28rem', borderRadius: '3px' }}>α</span>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {critHighFails.map((f, i) => {
                const sev = f.severity?.toUpperCase()
                const sevColor = SEVERITY_COLOR[sev] ?? '#94a3b8'
                return (
                  <div key={i}
                    onClick={() => setAutoFix({ findings: findings.filter(x => x.control_id === f.control_id && x.status?.toUpperCase() === 'FAIL'), scopeLabel: f.control_id })}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.6rem 0.75rem', borderRadius: '8px', background: 'rgba(218,44,56,.05)', border: '1px solid rgba(218,44,56,.12)', cursor: 'pointer' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(218,44,56,.35)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(218,44,56,.12)' }}
                  >
                    <span style={{ flexShrink: 0, padding: '0.1rem 0.4rem', borderRadius: '999px', background: hexToRgba(sevColor, 0.15), color: sevColor, fontSize: '0.62rem', fontWeight: 700, marginTop: '0.1rem' }}>
                      {sev}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--muted)' }}>{f.control_id}</div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.check_title}</div>
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--waf-brand)', fontWeight: 600, flexShrink: 0, marginTop: '0.15rem' }}>Fix →</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Row 4: Check-level KPIs ── */}
      {total > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          <StatCard label="Checks Run" value={total} sub="individual automated checks"
            icon={<svg style={{ width: '1rem', height: '1rem', color: '#94a3b8' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
          />
          <StatCard label="Check Pass Rate" value={`${passRate}%`} sub={`${pass} of ${total} passed`}
            color={passRate >= 80 ? '#16a34a' : passRate >= 60 ? '#d97706' : '#dc2626'}
            icon={<svg style={{ width: '1rem', height: '1rem', color: passRate >= 80 ? '#4ade80' : passRate >= 60 ? '#fbbf24' : '#f87171' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <StatCard label="Resources Scanned" value={resources} sub="unique resources"
            color="var(--waf-brand)"
            icon={<svg style={{ width: '1rem', height: '1rem', color: 'var(--waf-brand)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
          />
          <StatCard label="Resources Failing" value={failResources} sub="resources with ≥1 failure"
            color={failResources > 0 ? '#dc2626' : '#16a34a'}
            icon={<svg style={{ width: '1rem', height: '1rem', color: failResources > 0 ? '#f87171' : '#4ade80' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
          />
        </div>
      )}

      {/* ── Row 5: Category breakdown + Regulatory readiness ── */}
      {(categoryBreakdown.length > 0 || regulatoryReadiness.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {categoryBreakdown.length > 0 && (
            <div className="card">
              <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
                Pass Rate by Category
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {categoryBreakdown.map(({ cat, pass, total }) => (
                  <ProgressRow key={cat} label={cat} pass={pass} total={total} />
                ))}
              </div>
            </div>
          )}

          {regulatoryReadiness.length > 0 && (
            <div className="card">
              <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
                Regulatory Readiness
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {regulatoryReadiness.map(({ framework, pass, total }) => (
                  <ProgressRow key={framework} label={framework} pass={pass} total={total} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Architectural Debt Heatmap ── */}
      {pillars.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.5rem', background: 'rgba(239,68,68,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg style={{ width: '1rem', height: '1rem', color: '#dc2626' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>Architectural Debt Heatmap</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Failing controls by pillar × severity</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.65rem', color: '#94a3b8' }}>
              <span>Low</span>
              {['#fee2e2', '#fca5a5', '#f87171', '#dc2626'].map(c => (
                <div key={c} style={{ width: '0.75rem', height: '0.75rem', borderRadius: '3px', background: c }} />
              ))}
              <span>High</span>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: '0.8rem', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ padding: '0.4rem 0.75rem', textAlign: 'left', color: 'var(--muted)', fontWeight: 600 }}>Pillar</th>
                  {SEVERITIES.map(s => (
                    <th key={s} style={{ padding: '0.4rem 0.75rem', textAlign: 'center', color: SEVERITY_COLOR[s], fontWeight: 700, fontSize: '0.7rem' }}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pillars.map(p => (
                  <tr key={p} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{p}</td>
                    {SEVERITIES.map(s => {
                      const cell = heatmap.find(c => c.pillar === p && c.severity === s)
                      const count = cell?.count ?? 0
                      const intensity = count === 0 ? 0 : 0.15 + (count / heatMax) * 0.75
                      const col = SEVERITY_COLOR[s] ?? '#94a3b8'
                      return (
                        <td key={s} style={{ padding: '0.35rem 0.75rem', textAlign: 'center' }}>
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            minWidth: '2.25rem', height: '2rem', borderRadius: '6px',
                            background: count === 0 ? 'transparent' : hexToRgba(col, intensity),
                            color: count === 0 ? '#cbd5e1' : col,
                            fontWeight: count > 0 ? 700 : 400,
                            transition: 'transform 0.1s',
                            cursor: count > 0 ? 'default' : undefined,
                          }}
                          onMouseEnter={e => { if (count > 0) (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = '' }}
                          title={count > 0 ? `${p} / ${s}: ${count} failing` : undefined}
                          >
                            {count === 0 ? '—' : count}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Quick Wins ── */}
      {quickWins.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.5rem', background: 'rgba(34,197,94,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg style={{ width: '1rem', height: '1rem', color: '#16a34a' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>Quick Wins</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Medium &amp; low severity failures — lower effort to remediate</div>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginRight: '0.25rem' }}>{quickWins.length} finding{quickWins.length !== 1 ? 's' : ''}</span>
            <button
              onClick={() => setAutoFix({ findings: allFails, scopeLabel: 'all failing controls' })}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.7rem', borderRadius: '7px', border: '1px solid rgba(0,148,255,.3)', background: 'rgba(0,148,255,.07)', color: 'var(--waf-brand)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
            >
              <svg style={{ width: '0.8rem', height: '0.8rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Auto-Fix
              <span style={{ background: 'rgba(234,88,12,.12)', color: '#c2410c', fontSize: '0.5rem', fontWeight: 800, padding: '0.05rem 0.3rem', borderRadius: '3px', lineHeight: 1.3 }}>α</span>
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.6rem' }}>
            {quickWins.map((f, i) => {
              const sev = f.severity?.toUpperCase() ?? ''
              const sevColor = SEVERITY_COLOR[sev] ?? '#94a3b8'
              return (
                <div key={i} style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--waf-brand)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                  onClick={() => setAutoFix({ findings: findings.filter(x => x.control_id === f.control_id && x.status?.toUpperCase() === 'FAIL'), scopeLabel: f.control_id })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'var(--muted)' }}>{f.control_id}</span>
                    <span style={{ padding: '0.1rem 0.4rem', borderRadius: '999px', background: hexToRgba(sevColor, 0.15), color: sevColor, fontSize: '0.62rem', fontWeight: 700 }}>{sev}</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.4, marginBottom: '0.3rem' }}>
                    {f.check_title || f.check_id}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {f.pillar && (
                      <span style={{ padding: '0.1rem 0.4rem', borderRadius: '999px', background: 'rgba(0,148,255,.1)', color: 'var(--waf-brand)', fontSize: '0.62rem', fontWeight: 600 }}>
                        {f.pillar}
                      </span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--waf-brand)', fontWeight: 600 }}>Fix →</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Auto-Fix modal ── */}
      {autoFix && (
        <AutoFixModal
          run={run}
          findings={autoFix.findings}
          scopeLabel={autoFix.scopeLabel}
          onClose={() => setAutoFix(null)}
        />
      )}

    </div>
  )
}
