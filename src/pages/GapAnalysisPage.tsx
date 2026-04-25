import { useMemo, useState } from 'react'
import { ControlMeta, Finding, RunDetail } from '../api'
import { FRAMEWORKS } from '../controls-data'
import { useControlsCatalogue } from '../useControlsCatalogue'

interface Props { run: RunDetail }

// ─── Types ────────────────────────────────────────────────────────────────────

type ControlStatus = 'PASS' | 'FAIL' | 'PARTIAL' | 'WAIVED' | 'UNKNOWN'

interface GapItem {
  ctrl: ControlMeta
  status: ControlStatus
  requirements: string[]        // requirement IDs in the selected framework
  failFindings: Finding[]
  failResources: string[]       // unique resources with FAIL
  failChecks: string[]          // unique check_ids with FAIL
  passChecks: string[]          // unique check_ids with PASS
  effort: number                // failResources.length — how many resource remediations needed
  value: number                 // requirements.length — how many req IDs get unlocked
  costPerReq: number            // effort / value — lower = better ROI
  hasWaiver: boolean
  waiverOwner?: string
  hasRisk: boolean
  riskApprover?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
const SEV_COLOR: Record<string, string> = {
  critical: '#dc2626', high: '#d97706', medium: '#2563eb', low: '#059669', info: '#94a3b8',
}

const STATUS_META: Record<ControlStatus, { label: string; color: string; bg: string }> = {
  PASS:    { label: 'Passing',  color: '#059669', bg: 'rgba(5,150,105,.08)'   },
  FAIL:    { label: 'Failing',  color: '#dc2626', bg: 'rgba(220,38,38,.08)'   },
  PARTIAL: { label: 'Partial',  color: '#d97706', bg: 'rgba(217,119,6,.08)'   },
  WAIVED:  { label: 'Waived',   color: '#7c3aed', bg: 'rgba(124,58,237,.08)'  },
  UNKNOWN: { label: 'No data',  color: '#94a3b8', bg: 'rgba(148,163,184,.08)' },
}

function loadWaivers(): Record<string, { owner?: string }> {
  try { return JSON.parse(localStorage.getItem('wafpass_waivers') ?? '{}') } catch { return {} }
}
function loadRisks(): Record<string, { approver?: string }> {
  try { return JSON.parse(localStorage.getItem('wafpass_risk_acceptances') ?? '{}') } catch { return {} }
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  Object.assign(document.createElement('a'), { href: url, download: filename }).click()
  URL.revokeObjectURL(url)
}

// ─── Build gap items for a given framework ────────────────────────────────────

function buildGapItems(
  framework: string,
  controls: ControlMeta[],
  findings: Finding[],
): GapItem[] {
  const waivers = loadWaivers()
  const risks   = loadRisks()

  return controls
    .map(ctrl => {
      // Framework requirements this control covers
      const mapping = ctrl.regulatory_mapping?.find(m => m.framework === framework)
      if (!mapping || !mapping.controls.length) return null

      const requirements = mapping.controls

      // Findings for this control
      const ctrlFindings = findings.filter(f => f.control_id === ctrl.id)
      const failFindings = ctrlFindings.filter(f => f.status?.toUpperCase() === 'FAIL')
      const passFindings = ctrlFindings.filter(f => f.status?.toUpperCase() === 'PASS')
      const waivedFindings = ctrlFindings.filter(f => f.status?.toUpperCase() === 'WAIVED')

      const failResources = [...new Set(failFindings.map(f => f.resource).filter(Boolean))]
      const failChecks    = [...new Set(failFindings.map(f => f.check_id).filter(Boolean))]
      const passChecks    = [...new Set(passFindings.map(f => f.check_id).filter(Boolean))]

      let status: ControlStatus
      if (!ctrlFindings.length) {
        status = 'UNKNOWN'
      } else if (failFindings.length === 0 && waivedFindings.length > 0) {
        status = 'WAIVED'
      } else if (failFindings.length === 0) {
        status = 'PASS'
      } else if (passFindings.length > 0 || waivedFindings.length > 0) {
        status = 'PARTIAL'
      } else {
        status = 'FAIL'
      }

      const effort   = Math.max(failResources.length, failFindings.length > 0 ? 1 : 0)
      const value    = requirements.length
      const costPerReq = effort / Math.max(value, 1)

      const waiver = waivers[ctrl.id]
      const risk   = risks[ctrl.id]

      const item: GapItem = {
        ctrl, status, requirements,
        failFindings, failResources, failChecks, passChecks,
        effort, value, costPerReq,
        hasWaiver: !!waiver, waiverOwner: waiver?.owner,
        hasRisk: !!risk, riskApprover: risk?.approver,
      }
      return item
    })
    .filter((x): x is GapItem => x !== null)
}

// ─── Coverage meter SVG ───────────────────────────────────────────────────────

function CoverageMeter({ pct, label, color }: { pct: number; label: string; color: string }) {
  const r = 36, stroke = 7
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={90} height={90} viewBox="0 0 90 90">
        <circle cx={45} cy={45} r={r} fill="none" stroke="var(--bg-secondary)" strokeWidth={stroke} />
        <circle cx={45} cy={45} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 45 45)" style={{ transition: 'stroke-dasharray 0.5s' }} />
        <text x={45} y={49} textAnchor="middle" fontSize={15} fontWeight={800} fill={color}>{pct}%</text>
      </svg>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

// ─── Roadmap item ─────────────────────────────────────────────────────────────

function RoadmapItem({ item, rank, cumulativeReqs, totalReqs }: {
  item: GapItem; rank: number; cumulativeReqs: number; totalReqs: number
}) {
  const [open, setOpen] = useState(false)
  const { ctrl, status } = item
  const sm = STATUS_META[status]
  const sevColor = SEV_COLOR[ctrl.severity?.toLowerCase()] ?? '#94a3b8'
  const isActionable = status === 'FAIL' || status === 'PARTIAL'

  const topFinding = item.failFindings.sort((a, b) =>
    (SEV_ORDER[a.severity?.toLowerCase()] ?? 9) - (SEV_ORDER[b.severity?.toLowerCase()] ?? 9)
  )[0]

  return (
    <div style={{
      border: `1px solid ${isActionable ? sm.color + '44' : 'var(--card-border)'}`,
      borderRadius: 10, marginBottom: 10, overflow: 'hidden',
      background: isActionable ? sm.bg : 'var(--card-bg)',
      opacity: status === 'UNKNOWN' ? 0.7 : 1,
    }}>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}>

        {/* Rank badge */}
        {isActionable && (
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: sm.color, color: '#fff', fontSize: 12, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
          }}>{rank}</div>
        )}
        {!isActionable && (
          <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: sm.bg, border: `1px solid ${sm.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
            {status === 'PASS' ? '✓' : status === 'WAIVED' ? '~' : '?'}
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-muted)' }}>{ctrl.id}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{ctrl.title}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: sm.color, background: `${sm.color}18`, border: `1px solid ${sm.color}33`, borderRadius: 4, padding: '1px 6px', textTransform: 'uppercase' }}>
              {sm.label}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: sevColor, background: `${sevColor}18`, border: `1px solid ${sevColor}33`, borderRadius: 4, padding: '1px 6px', textTransform: 'uppercase' }}>
              {ctrl.severity}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 4, padding: '1px 6px' }}>
              {ctrl.pillar}
            </span>
            {/* Framework requirements */}
            {item.requirements.map(req => (
              <span key={req} style={{
                fontSize: 10, fontFamily: 'monospace', color: isActionable ? sm.color : '#059669',
                background: isActionable ? `${sm.color}10` : 'rgba(5,150,105,.08)',
                border: `1px solid ${isActionable ? sm.color : '#059669'}22`, borderRadius: 4, padding: '1px 5px',
              }}>{req}</span>
            ))}
            {item.hasWaiver && <span style={{ fontSize: 10, color: '#7c3aed', background: 'rgba(124,58,237,.08)', border: '1px solid rgba(124,58,237,.2)', borderRadius: 4, padding: '1px 6px' }}>waived · {item.waiverOwner}</span>}
            {item.hasRisk && <span style={{ fontSize: 10, color: '#d97706', background: 'rgba(217,119,6,.08)', border: '1px solid rgba(217,119,6,.2)', borderRadius: 4, padding: '1px 6px' }}>risk accepted · {item.riskApprover}</span>}
          </div>
        </div>

        {/* Right metrics */}
        <div style={{ flexShrink: 0, textAlign: 'right', fontSize: 11 }}>
          {isActionable && (
            <>
              <div style={{ fontWeight: 700, color: sm.color }}>{item.effort} resource{item.effort !== 1 ? 's' : ''} to fix</div>
              <div style={{ color: '#059669', fontWeight: 600 }}>unlocks {item.value} req{item.value !== 1 ? 's' : ''}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 2 }}>
                {cumulativeReqs}/{totalReqs} after fix
              </div>
            </>
          )}
          <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>{open ? '▲' : '▼'}</div>
        </div>
      </div>

      {open && (
        <div style={{ padding: '0 16px 14px 56px', borderTop: `1px solid ${sm.color}22` }}>
          {/* Description */}
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 10 }}>
            {ctrl.description}
          </div>

          {/* Top failing finding + remediation */}
          {topFinding && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(220,38,38,.04)', border: '1px solid rgba(220,38,38,.15)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>
                Failing check: {topFinding.check_title || topFinding.check_id}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{topFinding.message}</div>
              {topFinding.remediation && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  <strong style={{ color: 'var(--text-secondary)' }}>Fix: </strong>{topFinding.remediation}
                </div>
              )}
            </div>
          )}

          {/* Checks summary */}
          {(item.failChecks.length > 0 || item.passChecks.length > 0) && (
            <div style={{ marginTop: 10, display: 'flex', gap: 20, fontSize: 11 }}>
              {item.failChecks.length > 0 && (
                <div>
                  <div style={{ color: '#dc2626', fontWeight: 700, marginBottom: 4 }}>Failing checks ({item.failChecks.length})</div>
                  {item.failChecks.slice(0, 5).map(c => (
                    <div key={c} style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: 10 }}>✗ {c}</div>
                  ))}
                  {item.failChecks.length > 5 && <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>+{item.failChecks.length - 5} more</div>}
                </div>
              )}
              {item.passChecks.length > 0 && (
                <div>
                  <div style={{ color: '#059669', fontWeight: 700, marginBottom: 4 }}>Passing checks ({item.passChecks.length})</div>
                  {item.passChecks.slice(0, 3).map(c => (
                    <div key={c} style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: 10 }}>✓ {c}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Affected resources sample */}
          {item.failResources.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                Affected resources ({item.failResources.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {item.failResources.slice(0, 6).map(r => (
                  <span key={r} style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 4, padding: '1px 5px' }}>{r}</span>
                ))}
                {item.failResources.length > 6 && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>+{item.failResources.length - 6} more</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Requirements map ─────────────────────────────────────────────────────────

function RequirementsMap({ items, framework }: { items: GapItem[]; framework: string }) {
  // Collect all unique requirement IDs and the controls that cover them
  const reqMap = new Map<string, { items: GapItem[]; met: boolean }>()

  for (const item of items) {
    for (const req of item.requirements) {
      if (!reqMap.has(req)) reqMap.set(req, { items: [], met: false })
      const entry = reqMap.get(req)!
      entry.items.push(item)
      if (item.status === 'PASS' || item.status === 'WAIVED') entry.met = true
    }
  }

  const reqs = [...reqMap.entries()].sort((a, b) => {
    // Unmet first, then alphabetical
    if (a[1].met !== b[1].met) return a[1].met ? 1 : -1
    return a[0].localeCompare(b[0])
  })

  const metCount = reqs.filter(([, v]) => v.met).length

  return (
    <div>
      <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--text-muted)' }}>
        {reqs.length} {framework} requirements mapped · <strong style={{ color: '#059669' }}>{metCount} met</strong> · <strong style={{ color: '#dc2626' }}>{reqs.length - metCount} gaps</strong>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
        {reqs.map(([req, { items: ri, met }]) => (
          <div key={req} style={{
            padding: '12px 14px', borderRadius: 8,
            border: `1px solid ${met ? 'rgba(5,150,105,.25)' : 'rgba(220,38,38,.25)'}`,
            background: met ? 'rgba(5,150,105,.04)' : 'rgba(220,38,38,.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{met ? '✓' : '✗'}</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: met ? '#059669' : '#dc2626' }}>{req}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {ri.map(item => {
                const sm = STATUS_META[item.status]
                return (
                  <span key={item.ctrl.id} style={{
                    fontSize: 10, fontFamily: 'monospace', padding: '1px 5px', borderRadius: 4,
                    background: `${sm.color}15`, border: `1px solid ${sm.color}33`, color: sm.color, fontWeight: 600,
                  }}>
                    {item.ctrl.id}
                  </span>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function gapToCSV(items: GapItem[], framework: string): string {
  const header = 'framework,requirement_id,control_id,control_title,status,severity,pillar,effort_resources,value_requirements,cost_per_req,has_waiver,has_risk'
  const rows: string[] = []
  for (const item of items) {
    for (const req of item.requirements) {
      rows.push([
        framework, req, item.ctrl.id,
        `"${item.ctrl.title.replace(/"/g, '""')}"`,
        item.status, item.ctrl.severity, item.ctrl.pillar,
        item.effort, item.value, item.costPerReq.toFixed(2),
        item.hasWaiver ? 'yes' : 'no',
        item.hasRisk   ? 'yes' : 'no',
      ].join(','))
    }
  }
  return [header, ...rows].join('\n')
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GapAnalysisPage({ run }: Props) {
  const [framework, setFramework] = useState(FRAMEWORKS[1].id) // ISO 27001 default
  const [tab, setTab]             = useState<'roadmap' | 'requirements'>('roadmap')
  const [sortMode, setSortMode]   = useState<'efficiency' | 'severity' | 'value'>('efficiency')
  const [showPassing, setShowPassing] = useState(false)

  const catalogue = useControlsCatalogue()

  // Prefer run.controls_meta (live), fall back to server catalogue / static
  const controls: ControlMeta[] = useMemo(() =>
    run.controls_meta.length > 0 ? run.controls_meta : catalogue as unknown as ControlMeta[],
    [run.controls_meta, catalogue]
  )

  const allItems = useMemo(
    () => buildGapItems(framework, controls, run.findings),
    [framework, controls, run.findings]
  )

  // Coverage stats
  const stats = useMemo(() => {
    const totalReqs = new Set(allItems.flatMap(i => i.requirements)).size
    const metReqs   = new Set(allItems.filter(i => i.status === 'PASS' || i.status === 'WAIVED').flatMap(i => i.requirements)).size
    const gapItems  = allItems.filter(i => i.status === 'FAIL' || i.status === 'PARTIAL')
    const passItems = allItems.filter(i => i.status === 'PASS')
    const waivedItems = allItems.filter(i => i.status === 'WAIVED')
    const unknownItems = allItems.filter(i => i.status === 'UNKNOWN')
    const coveragePct  = totalReqs > 0 ? Math.round((metReqs / totalReqs) * 100) : 0
    const potentialReqs = new Set([
      ...allItems.filter(i => i.status === 'PASS' || i.status === 'WAIVED').flatMap(i => i.requirements),
      ...gapItems.flatMap(i => i.requirements),
    ]).size
    const potentialPct = totalReqs > 0 ? Math.round((potentialReqs / totalReqs) * 100) : 0
    return { totalReqs, metReqs, coveragePct, potentialPct, gapItems, passItems, waivedItems, unknownItems }
  }, [allItems])

  // Roadmap: failing + partial items sorted by chosen mode
  const roadmapItems = useMemo(() => {
    const actionable = stats.gapItems.slice()
    if (sortMode === 'efficiency') {
      actionable.sort((a, b) => a.costPerReq - b.costPerReq || (SEV_ORDER[a.ctrl.severity?.toLowerCase()] ?? 9) - (SEV_ORDER[b.ctrl.severity?.toLowerCase()] ?? 9))
    } else if (sortMode === 'severity') {
      actionable.sort((a, b) => (SEV_ORDER[a.ctrl.severity?.toLowerCase()] ?? 9) - (SEV_ORDER[b.ctrl.severity?.toLowerCase()] ?? 9) || a.effort - b.effort)
    } else {
      actionable.sort((a, b) => b.value - a.value || a.effort - b.effort)
    }
    return actionable
  }, [stats.gapItems, sortMode])

  // Running cumulative requirement count (for "N/total after fix" display)
  const cumulativeReqs = useMemo(() => {
    const alreadyMet = new Set(
      allItems.filter(i => i.status === 'PASS' || i.status === 'WAIVED').flatMap(i => i.requirements)
    )
    const running: number[] = []
    const seen = new Set(alreadyMet)
    for (const item of roadmapItems) {
      for (const r of item.requirements) seen.add(r)
      running.push(seen.size)
    }
    return running
  }, [roadmapItems, allItems])

  const fw = FRAMEWORKS.find(f => f.id === framework)

  return (
    <div style={{ padding: '0 0 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Framework selector ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {FRAMEWORKS.map(f => (
          <button key={f.id} onClick={() => setFramework(f.id)} style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            border: `2px solid ${framework === f.id ? 'var(--waf-brand)' : 'var(--card-border)'}`,
            background: framework === f.id ? 'rgba(0,148,255,.08)' : 'none',
            color: framework === f.id ? 'var(--waf-brand)' : 'var(--text-muted)',
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Coverage summary ──────────────────────────────────────────── */}
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--card-border)',
        borderRadius: 12, padding: '20px 24px', marginBottom: 24,
        display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <CoverageMeter pct={stats.coveragePct} label="Current coverage"
          color={stats.coveragePct >= 80 ? '#059669' : stats.coveragePct >= 60 ? '#d97706' : '#dc2626'} />
        <CoverageMeter pct={stats.potentialPct} label="After all gaps fixed" color="#2563eb" />

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            {fw?.label} — {fw?.desc}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
            {stats.metReqs} of {stats.totalReqs} requirements currently met ·
            <strong style={{ color: '#dc2626' }}> {stats.totalReqs - stats.metReqs} gaps</strong>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { n: stats.gapItems.length,    label: 'controls to fix',  color: '#dc2626' },
              { n: stats.passItems.length,   label: 'passing',           color: '#059669' },
              { n: stats.waivedItems.length, label: 'waived',            color: '#7c3aed' },
              { n: stats.unknownItems.length,label: 'no data',           color: '#94a3b8' },
            ].map(({ n, label, color }) => n > 0 && (
              <div key={label} style={{ textAlign: 'center', padding: '6px 12px', borderRadius: 6, background: `${color}10`, border: `1px solid ${color}25` }}>
                <div style={{ fontSize: 18, fontWeight: 800, color }}>{n}</div>
                <div style={{ fontSize: 10, color, textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => downloadCSV(gapToCSV(allItems, framework), `gap-analysis-${framework.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().slice(0,10)}.csv`)}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--card-border)', background: 'none', color: '#059669', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          ↓ Export CSV
        </button>
      </div>

      {allItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', border: '1px dashed var(--card-border)', borderRadius: 10, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>🗺</div>
          <strong>No controls mapped to {framework}</strong>
          <div style={{ marginTop: 6, fontSize: 12 }}>
            This run's controls do not include regulatory mappings for {framework}.
            Ensure controls are loaded from a run that includes regulatory metadata.
          </div>
        </div>
      ) : (
        <>
          {/* ── Tabs ────────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--card-border)', paddingBottom: 0 }}>
            {([['roadmap', 'Remediation Roadmap'], ['requirements', 'Requirements Map']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} style={{
                padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: 'none', color: tab === key ? 'var(--waf-brand)' : 'var(--text-muted)',
                borderBottom: tab === key ? '2px solid var(--waf-brand)' : '2px solid transparent',
                marginBottom: -1,
              }}>{label}</button>
            ))}
          </div>

          {/* ── Roadmap tab ──────────────────────────────────────────────── */}
          {tab === 'roadmap' && (
            <div>
              {/* Sort + filter controls */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sort by:</span>
                {([
                  ['efficiency', 'Shortest path (effort ÷ requirements)'],
                  ['severity',   'Highest severity first'],
                  ['value',      'Most requirements unlocked first'],
                ] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setSortMode(key)} style={{
                    padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600,
                    border: `1px solid ${sortMode === key ? 'var(--waf-brand)' : 'var(--card-border)'}`,
                    background: sortMode === key ? 'rgba(0,148,255,.08)' : 'none',
                    color: sortMode === key ? 'var(--waf-brand)' : 'var(--text-muted)',
                  }}>{label}</button>
                ))}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 'auto' }}>
                  <input type="checkbox" checked={showPassing} onChange={e => setShowPassing(e.target.checked)} />
                  Show passing controls
                </label>
              </div>

              {/* Intro blurb */}
              {roadmapItems.length > 0 && (
                <div style={{ padding: '10px 14px', marginBottom: 14, borderRadius: 8, background: 'rgba(0,148,255,.06)', border: '1px solid rgba(0,148,255,.18)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <strong>Shortest path to {fw?.label} compliance:</strong> Fix the {roadmapItems.length} controls below in order.
                  Each item shows how many resources need remediating (effort) and how many framework requirements it unlocks (value).
                  Controls ranked #1 give you the highest requirement coverage per unit of effort.
                </div>
              )}

              {roadmapItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', border: '1px dashed rgba(5,150,105,.3)', borderRadius: 10, color: '#059669', fontSize: 14 }}>
                  ✅ All {fw?.label}-mapped controls are passing — no gaps detected
                </div>
              ) : (
                roadmapItems.map((item, i) => (
                  <RoadmapItem
                    key={item.ctrl.id} item={item} rank={i + 1}
                    cumulativeReqs={cumulativeReqs[i] ?? stats.metReqs}
                    totalReqs={stats.totalReqs}
                  />
                ))
              )}

              {/* Passing controls (collapsed by default) */}
              {showPassing && stats.passItems.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    Passing controls ({stats.passItems.length})
                  </div>
                  {[...stats.passItems, ...stats.waivedItems, ...stats.unknownItems].map(item => (
                    <RoadmapItem key={item.ctrl.id} item={item} rank={0} cumulativeReqs={stats.metReqs} totalReqs={stats.totalReqs} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Requirements map tab ─────────────────────────────────────── */}
          {tab === 'requirements' && <RequirementsMap items={allItems} framework={framework} />}
        </>
      )}
    </div>
  )
}
