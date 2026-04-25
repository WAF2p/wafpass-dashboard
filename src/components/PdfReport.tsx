/**
 * PdfReport — data-driven compliance report.
 *
 * Rendered as a hidden React subtree that becomes the only visible content
 * during window.print().  Sections are driven by settings.reportSections,
 * which in turn defaults to the active maturity level.
 */

import { RunDetail } from '../api'
import { Settings, MATURITY_META } from '../pages/settingsUtils'

interface Props {
  run: RunDetail
  settings: Settings
  maturityLevel: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: '#DA2C38', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e',
}
const STATUS_COLOR: Record<string, string> = {
  PASS: '#16a34a', FAIL: '#dc2626', SKIP: '#64748b', WAIVED: '#7c3aed',
}

function scoreColor(s: number) {
  return s >= 80 ? '#059669' : s >= 60 ? '#d97706' : '#DA2C38'
}

function pct(pass: number, total: number) {
  return total > 0 ? Math.round((pass / total) * 100) : 0
}

// ── Shared micro-components ───────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.08em', color: '#64748b',
      borderBottom: '2px solid #0094FF', paddingBottom: '0.4rem',
      marginBottom: '0.875rem', marginTop: '1.5rem',
    }}>
      {children}
    </div>
  )
}

function KpiCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      border: '1px solid #e2e8f0', borderRadius: '10px',
      padding: '0.875rem 1rem', textAlign: 'center',
      background: '#fff',
    }}>
      <div style={{ fontSize: '1.75rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#64748b', marginTop: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    </div>
  )
}

function ProgressBar({ label, pass, total }: { label: string; pass: number; total: number }) {
  const p = pct(pass, total)
  const color = p >= 80 ? '#16a34a' : p >= 60 ? '#d97706' : '#dc2626'
  return (
    <div style={{ marginBottom: '0.6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', fontSize: '0.78rem' }}>
        <span style={{ fontWeight: 500, color: '#0b1220', textTransform: 'capitalize' }}>{label.replace(/_/g, ' ')}</span>
        <span style={{ color, fontWeight: 700 }}>{p}% <span style={{ color: '#64748b', fontWeight: 400 }}>({pass}/{total})</span></span>
      </div>
      <div style={{ height: '6px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: '999px', background: color, width: `${p}%` }} />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PdfReport({ run, settings, maturityLevel }: Props) {
  const sec = settings.reportSections ?? {}
  const matMeta = MATURITY_META.find(m => m.level === maturityLevel) ?? MATURITY_META[0]
  const findings = run.findings

  // ── Derived stats (same logic as DashboardPage) ───────────────────────────

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

  const total       = findings.length
  const pass        = findings.filter(f => f.status?.toUpperCase() === 'PASS').length
  const passRate    = pct(pass, total)
  const resources   = new Set(findings.map(f => f.resource).filter(Boolean)).size
  const failRes     = new Set(findings.filter(f => f.status?.toUpperCase() === 'FAIL').map(f => f.resource).filter(Boolean)).size

  const allFails    = findings.filter(f => f.status?.toUpperCase() === 'FAIL')
  const critHighFails = allFails.filter(f => ['CRITICAL', 'HIGH'].includes(f.severity?.toUpperCase()))

  const pillarData = Object.entries(run.pillar_scores)
    .map(([p, s]) => ({ pillar: p, score: s as number }))
    .sort((a, b) => a.score - b.score)

  const severityCounts = SEVERITY_ORDER.map(s => ({
    sev: s,
    count: allFails.filter(f => f.severity?.toUpperCase() === s).length,
  })).filter(d => d.count > 0)

  // Category pass rate
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
    .map(([cat, v]) => ({ cat, ...v }))
    .sort((a, b) => pct(a.pass, a.total) - pct(b.pass, b.total))

  // Regulatory readiness
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
    .map(([framework, v]) => ({ framework, ...v }))
    .sort((a, b) => pct(a.pass, a.total) - pct(b.pass, b.total))

  // Heatmap
  const pillars = Array.from(new Set(findings.map(f => f.pillar).filter((p): p is string => Boolean(p)))).sort()
  const heatMax = Math.max(1, ...SEVERITY_ORDER.flatMap(s =>
    pillars.map(p => findings.filter(f => f.pillar === p && f.severity?.toUpperCase() === s && f.status?.toUpperCase() === 'FAIL').length)
  ))

  // Quick wins (medium + low fails sorted by severity weight)
  const SWEIGHT: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
  const quickWins = allFails
    .sort((a, b) => (SWEIGHT[b.severity?.toUpperCase() ?? ''] ?? 0) - (SWEIGHT[a.severity?.toUpperCase() ?? ''] ?? 0))
    .slice(0, 10)

  // Cloud footprint
  const detectedRegions = run.detected_regions ?? []
  const providerCounts = detectedRegions.reduce<Record<string, number>>((acc, [, prov]) => {
    if (prov) acc[prov] = (acc[prov] ?? 0) + 1
    return acc
  }, {})

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div id="wafpass-pdf-report" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif', color: '#0b1220', background: '#fff', padding: '2rem 2.5rem', maxWidth: '900px', margin: '0 auto' }}>

      {/* ── Cover ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '3px solid #0094FF', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b', marginBottom: '0.3rem' }}>
            WAF++ PASS · Compliance Report
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0b1220', lineHeight: 1.15 }}>
            {run.project || 'Unnamed Project'}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem', color: '#64748b' }}>
            {run.branch    && <span>Branch: <strong style={{ color: '#0b1220' }}>{run.branch}</strong></span>}
            {run.git_sha   && <span>SHA: <code style={{ fontSize: '0.75rem' }}>{run.git_sha.slice(0, 8)}</code></span>}
            {run.iac_framework && <span>IaC: <strong style={{ color: '#0b1220' }}>{run.iac_framework}</strong></span>}
            {run.path      && <span>Path: <code style={{ fontSize: '0.75rem' }}>{run.path}</code></span>}
          </div>
          <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: '#64748b' }}>
            Generated: <strong style={{ color: '#0b1220' }}>{new Date().toLocaleString()}</strong>
            &nbsp;·&nbsp;
            Run scanned: <strong style={{ color: '#0b1220' }}>{new Date(run.created_at).toLocaleString()}</strong>
          </div>
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{
            width: '90px', height: '90px', borderRadius: '50%',
            border: `6px solid ${scoreColor(run.score)}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: scoreColor(run.score), lineHeight: 1 }}>{run.score}</div>
            <div style={{ fontSize: '0.6rem', color: '#64748b' }}>/100</div>
          </div>
          <div style={{ marginTop: '0.4rem', fontSize: '0.65rem', fontWeight: 700, color: matMeta.color }}>
            {matMeta.label}
          </div>
        </div>
      </div>

      {/* ── Executive Summary ── */}
      {sec.executiveSummary && (
        <div>
          <SectionTitle>Executive Summary</SectionTitle>

          {/* Control KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
            <KpiCard label="Passed Controls"  value={ctrlPass}   color="#059669" />
            <KpiCard label="Failed Controls"  value={ctrlFail}   color="#DA2C38" />
            <KpiCard label="Skipped Controls" value={ctrlSkip}   color="#64748b" />
            <KpiCard label="Waived Controls"  value={ctrlWaived} color="#7c3aed" />
          </div>

          {/* Check-level stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
            <KpiCard label="Checks Run"       value={total}      color="#0094FF" />
            <KpiCard label="Check Pass Rate"  value={`${passRate}%`} color={passRate >= 80 ? '#16a34a' : passRate >= 60 ? '#d97706' : '#dc2626'} />
            <KpiCard label="Resources Scanned" value={resources}  color="#0094FF" />
            <KpiCard label="Resources Failing" value={failRes}    color={failRes > 0 ? '#dc2626' : '#16a34a'} />
          </div>

          {/* Severity breakdown */}
          {severityCounts.length > 0 && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.875rem 1rem', background: '#fff', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
                Failing Checks by Severity
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                {severityCounts.map(({ sev, count }) => (
                  <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: SEVERITY_COLOR[sev] }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: SEVERITY_COLOR[sev] }}>{sev}</span>
                    <span style={{ fontSize: '0.78rem', color: '#0b1220', fontWeight: 600 }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Pillar Breakdown ── */}
      {sec.pillarBreakdown && pillarData.length > 0 && (
        <div style={{ pageBreakInside: 'avoid' }}>
          <SectionTitle>Pillar Breakdown</SectionTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>Pillar</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#64748b', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', width: '80px' }}>Score</th>
                <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: '#64748b', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>Visual</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#64748b', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', width: '80px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {[...pillarData].sort((a, b) => b.score - a.score).map(({ pillar, score }) => (
                <tr key={pillar} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, textTransform: 'capitalize' }}>{pillar}</td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 800, color: scoreColor(score) }}>{score}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    <div style={{ height: '8px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: '999px', background: scoreColor(score), width: `${score}%` }} />
                    </div>
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontSize: '0.72rem', fontWeight: 700, color: scoreColor(score) }}>
                    {score >= 80 ? 'Good' : score >= 60 ? 'Attention' : 'High Risk'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Critical & High Findings ── */}
      {sec.criticalFindings && critHighFails.length > 0 && (
        <div>
          <SectionTitle>Critical &amp; High Findings ({critHighFails.length})</SectionTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ background: '#fff1f2' }}>
                {['Severity', 'Control', 'Check', 'Resource', 'Pillar'].map(h => (
                  <th key={h} style={{ padding: '0.45rem 0.75rem', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #fecaca' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {critHighFails.map((f, i) => {
                const sev = f.severity?.toUpperCase()
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #fee2e2', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '0.4rem 0.75rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px', background: `${SEVERITY_COLOR[sev ?? '']}20`, color: SEVERITY_COLOR[sev ?? ''] ?? '#888' }}>{sev}</span>
                    </td>
                    <td style={{ padding: '0.4rem 0.75rem', fontFamily: 'monospace', fontSize: '0.72rem', color: '#475569' }}>{f.control_id}</td>
                    <td style={{ padding: '0.4rem 0.75rem', fontWeight: 500, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.check_title || f.check_id}</td>
                    <td style={{ padding: '0.4rem 0.75rem', fontFamily: 'monospace', fontSize: '0.7rem', color: '#475569', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.resource}</td>
                    <td style={{ padding: '0.4rem 0.75rem', fontSize: '0.72rem', textTransform: 'capitalize', color: '#475569' }}>{f.pillar}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Compliance Matrix ── */}
      {sec.complianceMatrix && (
        <div style={{ pageBreakInside: 'avoid' }}>
          <SectionTitle>Compliance Matrix</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {regulatoryReadiness.length > 0 && (
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Regulatory Frameworks</div>
                {regulatoryReadiness.map(({ framework, pass: p, total: t }) => (
                  <ProgressBar key={framework} label={framework} pass={p} total={t} />
                ))}
              </div>
            )}
            {categoryBreakdown.length > 0 && (
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Pass Rate by Category</div>
                {categoryBreakdown.map(({ cat, pass: p, total: t }) => (
                  <ProgressBar key={cat} label={cat} pass={p} total={t} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Architectural Debt Heatmap ── */}
      {sec.architecturalDebt && pillars.length > 0 && (
        <div style={{ pageBreakInside: 'avoid' }}>
          <SectionTitle>Architectural Debt Heatmap</SectionTitle>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem' }}>Failing controls by pillar × severity</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '0.45rem 0.75rem', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: '0.68rem', borderBottom: '1px solid #e2e8f0' }}>Pillar</th>
                {SEVERITY_ORDER.map(s => (
                  <th key={s} style={{ padding: '0.45rem 0.75rem', textAlign: 'center', fontWeight: 700, color: SEVERITY_COLOR[s], fontSize: '0.68rem', borderBottom: '1px solid #e2e8f0' }}>{s}</th>
                ))}
                <th style={{ padding: '0.45rem 0.75rem', textAlign: 'center', fontWeight: 700, color: '#64748b', fontSize: '0.68rem', borderBottom: '1px solid #e2e8f0' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {pillars.map(p => {
                const rowCounts = SEVERITY_ORDER.map(s =>
                  findings.filter(f => f.pillar === p && f.severity?.toUpperCase() === s && f.status?.toUpperCase() === 'FAIL').length
                )
                const rowTotal = rowCounts.reduce((a, b) => a + b, 0)
                return (
                  <tr key={p} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.45rem 0.75rem', fontWeight: 600, textTransform: 'capitalize' }}>{p}</td>
                    {rowCounts.map((count, i) => {
                      const col = SEVERITY_COLOR[SEVERITY_ORDER[i]] ?? '#888'
                      const intensity = count === 0 ? 0 : 0.12 + (count / heatMax) * 0.65
                      return (
                        <td key={i} style={{ padding: '0.45rem 0.75rem', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block', minWidth: '1.75rem', padding: '0.15rem 0.3rem',
                            borderRadius: '6px', fontWeight: count > 0 ? 700 : 400,
                            background: count === 0 ? 'transparent' : `rgba(${parseInt(col.slice(1,3),16)},${parseInt(col.slice(3,5),16)},${parseInt(col.slice(5,7),16)},${intensity})`,
                            color: count === 0 ? '#cbd5e1' : col,
                          }}>
                            {count === 0 ? '—' : count}
                          </span>
                        </td>
                      )
                    })}
                    <td style={{ padding: '0.45rem 0.75rem', textAlign: 'center', fontWeight: 700, color: rowTotal > 0 ? '#dc2626' : '#16a34a' }}>
                      {rowTotal}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── All Findings ── */}
      {sec.allFindings && findings.length > 0 && (
        <div>
          <SectionTitle>All Findings ({findings.length})</SectionTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Status', 'Severity', 'Control', 'Check', 'Resource', 'Pillar'].map(h => (
                  <th key={h} style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...findings]
                .sort((a, b) => {
                  const sw = (f: typeof a) => SWEIGHT[f.severity?.toUpperCase() ?? ''] ?? 0
                  return sw(b) - sw(a)
                })
                .map((f, i) => {
                  const sev = f.severity?.toUpperCase()
                  const status = f.status?.toUpperCase()
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '0.35rem 0.6rem' }}>
                        <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '999px', background: `${STATUS_COLOR[status ?? ''] ?? '#888'}18`, color: STATUS_COLOR[status ?? ''] ?? '#888' }}>{status}</span>
                      </td>
                      <td style={{ padding: '0.35rem 0.6rem' }}>
                        <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '999px', background: `${SEVERITY_COLOR[sev ?? ''] ?? '#888'}18`, color: SEVERITY_COLOR[sev ?? ''] ?? '#888' }}>{sev}</span>
                      </td>
                      <td style={{ padding: '0.35rem 0.6rem', fontFamily: 'monospace', fontSize: '0.68rem', color: '#475569' }}>{f.control_id}</td>
                      <td style={{ padding: '0.35rem 0.6rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.check_title || f.check_id}</td>
                      <td style={{ padding: '0.35rem 0.6rem', fontFamily: 'monospace', fontSize: '0.65rem', color: '#475569', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.resource}</td>
                      <td style={{ padding: '0.35rem 0.6rem', fontSize: '0.7rem', textTransform: 'capitalize', color: '#475569' }}>{f.pillar}</td>
                    </tr>
                  )
                })
              }
            </tbody>
          </table>
        </div>
      )}

      {/* ── Remediation Plan ── */}
      {sec.remediationPlan && quickWins.length > 0 && (
        <div style={{ pageBreakInside: 'avoid' }}>
          <SectionTitle>Remediation Plan — Top {quickWins.length} Priorities</SectionTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ background: '#f0fdf4' }}>
                {['#', 'Severity', 'Control', 'Check', 'Resource', 'Remediation'].map(h => (
                  <th key={h} style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #bbf7d0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quickWins.map((f, i) => {
                const sev = f.severity?.toUpperCase()
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.4rem 0.6rem', color: '#64748b', fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ padding: '0.4rem 0.6rem' }}>
                      <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '999px', background: `${SEVERITY_COLOR[sev ?? ''] ?? '#888'}18`, color: SEVERITY_COLOR[sev ?? ''] ?? '#888' }}>{sev}</span>
                    </td>
                    <td style={{ padding: '0.4rem 0.6rem', fontFamily: 'monospace', fontSize: '0.68rem', color: '#475569' }}>{f.control_id}</td>
                    <td style={{ padding: '0.4rem 0.6rem', fontWeight: 500, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.check_title || f.check_id}</td>
                    <td style={{ padding: '0.4rem 0.6rem', fontFamily: 'monospace', fontSize: '0.65rem', color: '#475569', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.resource}</td>
                    <td style={{ padding: '0.4rem 0.6rem', fontSize: '0.72rem', color: '#475569', maxWidth: '200px' }}>{f.remediation || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Cloud Footprint ── */}
      {sec.cloudFootprint && detectedRegions.length > 0 && (
        <div style={{ pageBreakInside: 'avoid' }}>
          <SectionTitle>Cloud Footprint</SectionTitle>
          <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem 1.25rem', textAlign: 'center', minWidth: '100px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0094FF' }}>{detectedRegions.length}</div>
              <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.15rem' }}>Regions</div>
            </div>
            {Object.entries(providerCounts).map(([prov, cnt]) => (
              <div key={prov} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem 1.25rem', textAlign: 'center', minWidth: '100px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0b1220' }}>{cnt}</div>
                <div style={{ fontSize: '0.68rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.15rem' }}>{prov}</div>
              </div>
            ))}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '0.4rem 0.75rem', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: '0.65rem', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Region</th>
                <th style={{ padding: '0.4rem 0.75rem', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: '0.65rem', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>Provider</th>
              </tr>
            </thead>
            <tbody>
              {detectedRegions.map(([region, provider], i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.35rem 0.75rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>{region}</td>
                  <td style={{ padding: '0.35rem 0.75rem', textTransform: 'capitalize', color: '#64748b' }}>{provider}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Plan Changes ── */}
      {sec.planChanges && run.plan_changes && (
        <div style={{ pageBreakInside: 'avoid' }}>
          <SectionTitle>Terraform Plan Changes</SectionTitle>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {Object.entries(run.plan_changes.summary).map(([op, cnt]) => {
              const opColor: Record<string, string> = { add: '#16a34a', change: '#d97706', destroy: '#dc2626', replace: '#f97316', no_op: '#64748b' }
              return (
                <div key={op} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.6rem 1rem', textAlign: 'center', minWidth: '80px' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: opColor[op] ?? '#64748b' }}>{cnt}</div>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'capitalize', marginTop: '0.1rem' }}>{op.replace('_', ' ')}</div>
                </div>
              )
            })}
          </div>
          {run.plan_changes.changes.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Resource', 'Type', 'Action'].map(h => (
                    <th key={h} style={{ padding: '0.4rem 0.75rem', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: '0.65rem', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {run.plan_changes.changes.slice(0, 50).map((c, i) => {
                  const actionColor: Record<string, string> = { create: '#16a34a', update: '#d97706', delete: '#dc2626', replace: '#f97316', 'no-op': '#64748b' }
                  const action = c.action ?? '—'
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.35rem 0.75rem', fontFamily: 'monospace', fontSize: '0.7rem' }}>{c.address ?? '—'}</td>
                      <td style={{ padding: '0.35rem 0.75rem', fontFamily: 'monospace', fontSize: '0.7rem', color: '#64748b' }}>{c.type ?? '—'}</td>
                      <td style={{ padding: '0.35rem 0.75rem' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '999px', background: `${actionColor[action] ?? '#888'}18`, color: actionColor[action] ?? '#888' }}>
                          {action}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ marginTop: '2.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#94a3b8' }}>
        <span>WAF++ PASS v0.4.0 · waf2p.dev</span>
        <span>Maturity: {matMeta.label} · Generated {new Date().toLocaleDateString()}</span>
      </div>
    </div>
  )
}

