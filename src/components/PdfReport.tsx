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
  darkMode?: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e',
}
const STATUS_COLOR: Record<string, string> = {
  PASS: '#22c55e', FAIL: '#ef4444', SKIP: '#94a3b8', WAIVED: '#a78bfa',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(s: number, darkMode: boolean) {
  return darkMode
    ? s >= 80 ? '#22c55e' : s >= 60 ? '#eab308' : '#ef4444'
    : s >= 80 ? '#059669' : s >= 60 ? '#d97706' : '#DA2C38'
}

function pct(pass: number, total: number) {
  return total > 0 ? Math.round((pass / total) * 100) : 0
}

function SectionTitle({ children, colors }: { children: React.ReactNode; colors: any }) {
  return (
    <div style={{
      fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.08em', color: colors.accent,
      borderBottom: `2px solid ${colors.accent}`, paddingBottom: '0.4rem',
      marginBottom: '0.9rem', marginTop: '1.25rem',
    }}>
      {children}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PdfReport({ run, settings, maturityLevel, darkMode = false }: Props) {

  const colors = {
    textMain: darkMode ? '#f8fafc' : '#0b1220',
    textMuted: darkMode ? '#94a3b8' : '#64748b',
    accent: '#0094FF',
    darkMode,
  }

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

  const containerStyle: React.CSSProperties = {
    fontFamily: '"ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    color: colors.textMain,
    background: darkMode ? '#0f172a' : '#ffffff',
    padding: '0',
    maxWidth: '100%',
    margin: '0',
  }

  const pageStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '800px',
    margin: '0 auto',
    padding: darkMode ? '1.5rem' : '1.5rem',
    background: darkMode ? '#0f172a' : '#ffffff',
  }

  const cardStyle: React.CSSProperties = {
    border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
    borderRadius: '12px',
    padding: '1.25rem',
    background: darkMode ? '#1e293b' : '#ffffff',
  }

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.68rem',
  }

  const tableHeaderStyle: React.CSSProperties = {
    background: darkMode ? '#0f172a' : '#f8fafc',
  }

  const tableRowStyle: React.CSSProperties = {
    borderBottom: `1px solid ${darkMode ? '#334155' : '#f1f5f9'}`,
    background: darkMode ? '#1e293b' : '#ffffff',
  }

  return (
    <div data-theme={darkMode ? 'dark' : 'light'} style={containerStyle}>
      <div style={pageStyle}>

        {/* ── Cover ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: `3px solid ${colors.accent}`, paddingBottom: '1.75rem', marginBottom: '2rem' }}>
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: colors.accent, marginBottom: '0.5rem' }}>
              WAF++ PASS · Compliance Report
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: colors.textMain, lineHeight: 1.15, marginBottom: '0.75rem' }}>
              {run.project || 'Unnamed Project'}
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.78rem', color: colors.textMuted }}>
              {run.branch && <span>Branch: <strong style={{ color: colors.textMain }}>{run.branch}</strong></span>}
              {run.git_sha && <span>SHA: <code style={{ fontSize: '0.75rem', background: darkMode ? '#334155' : '#f1f5f9', padding: '0.15rem 0.35rem', borderRadius: '4px' }}>{run.git_sha.slice(0, 8)}</code></span>}
              {run.iac_framework && <span>IaC: <strong style={{ color: colors.textMain }}>{run.iac_framework}</strong></span>}
              {run.path && <span>Path: <code style={{ fontSize: '0.75rem', background: darkMode ? '#334155' : '#f1f5f9', padding: '0.15rem 0.35rem', borderRadius: '4px' }}>{run.path}</code></span>}
            </div>
            <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: colors.textMuted }}>
              Generated: <strong style={{ color: colors.textMain }}>{new Date().toLocaleString()}</strong>
              {' · '}
              Run scanned: <strong style={{ color: colors.textMain }}>{new Date(run.created_at).toLocaleString()}</strong>
            </div>
          </div>
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{
              width: '100px', height: '100px', borderRadius: '50%',
              border: `6px solid ${colors.accent}`,
              boxShadow: `0 0 20px ${colors.accent}66, 0 0 40px ${colors.accent}33`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: darkMode ? '#1e293b' : '#ffffff',
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: colors.accent, lineHeight: 1 }}>{run.score}</div>
              <div style={{ fontSize: '0.65rem', color: colors.accent }}>/100</div>
            </div>
            <div style={{ marginTop: '0.6rem', fontSize: '0.7rem', fontWeight: 700, color: colors.accent }}>
              {matMeta.label}
            </div>
          </div>
        </div>

        {/* ── Executive Summary ── */}
        {sec.executiveSummary && (
          <div style={{ marginBottom: '2rem' }}>
            <SectionTitle colors={colors}>Executive Summary</SectionTitle>

            {/* Control KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={cardStyle}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#22c55e', lineHeight: 1 }}>{ctrlPass}</div>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: colors.textMuted, marginTop: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Passed Controls</div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ef4444', lineHeight: 1 }}>{ctrlFail}</div>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: colors.textMuted, marginTop: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Failed Controls</div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: colors.textMuted, lineHeight: 1 }}>{ctrlSkip}</div>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: colors.textMuted, marginTop: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Skipped Controls</div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#a78bfa', lineHeight: 1 }}>{ctrlWaived}</div>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: colors.textMuted, marginTop: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Waived Controls</div>
              </div>
            </div>

            {/* Check-level stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={cardStyle}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#60a5fa', lineHeight: 1 }}>{total}</div>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: colors.textMuted, marginTop: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Checks Run</div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: passRate >= 80 ? '#22c55e' : passRate >= 60 ? '#eab308' : '#ef4444', lineHeight: 1 }}>{passRate}%</div>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: colors.textMuted, marginTop: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Check Pass Rate</div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#60a5fa', lineHeight: 1 }}>{resources}</div>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: colors.textMuted, marginTop: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Resources Scanned</div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: failRes > 0 ? '#ef4444' : '#22c55e', lineHeight: 1 }}>{failRes}</div>
                <div style={{ fontSize: '0.68rem', fontWeight: 600, color: colors.textMuted, marginTop: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Resources Failing</div>
              </div>
            </div>

            {/* Severity breakdown */}
            {severityCounts.length > 0 && (
              <div style={cardStyle}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                  Failing Checks by Severity
                </div>
                <div style={{ display: 'flex', gap: '1.75rem', flexWrap: 'wrap' }}>
                  {severityCounts.map(({ sev, count }) => (
                    <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: SEVERITY_COLOR[sev] }} />
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: SEVERITY_COLOR[sev] }}>{sev}</span>
                      <span style={{ fontSize: '0.8rem', color: colors.textMain, fontWeight: 600 }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Pillar Breakdown ── */}
        {sec.pillarBreakdown && pillarData.length > 0 && (
          <div style={{ pageBreakInside: 'avoid', marginBottom: '2rem' }}>
            <SectionTitle colors={colors}>Pillar Breakdown</SectionTitle>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={tableHeaderStyle}>
                    <th style={{ padding: '0.35rem 0.4rem', textAlign: 'left', fontWeight: 700, color: colors.textMuted, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>Pillar</th>
                    <th style={{ padding: '0.35rem 0.4rem', textAlign: 'right', fontWeight: 700, color: colors.textMuted, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, width: '60px' }}>Score</th>
                    <th style={{ padding: '0.35rem 0.4rem', fontWeight: 700, color: colors.textMuted, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>Visual</th>
                    <th style={{ padding: '0.35rem 0.4rem', textAlign: 'right', fontWeight: 700, color: colors.textMuted, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, width: '70px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...pillarData].sort((a, b) => b.score - a.score).map(({ pillar, score }) => (
                    <tr key={pillar} style={tableRowStyle}>
                      <td style={{ padding: '0.3rem 0.4rem', fontWeight: 600, textTransform: 'capitalize', color: colors.textMain, fontSize: '0.65rem' }}>{pillar}</td>
                      <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', fontWeight: 800, color: scoreColor(score, darkMode), fontSize: '0.65rem' }}>{score}</td>
                      <td style={{ padding: '0.3rem 0.4rem' }}>
                        <div style={{ height: '6px', borderRadius: '999px', background: darkMode ? '#334155' : '#e2e8f0', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: '999px', background: scoreColor(score, darkMode), width: `${score}%` }} />
                        </div>
                      </td>
                      <td style={{ padding: '0.3rem 0.4rem', textAlign: 'right', fontSize: '0.58rem', fontWeight: 700, color: scoreColor(score, darkMode) }}>
                        {score >= 80 ? 'Good' : score >= 60 ? 'Attn' : 'Risk'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Critical & High Findings ── */}
        {sec.criticalFindings && critHighFails.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <SectionTitle colors={colors}>Critical & High Findings ({critHighFails.length})</SectionTitle>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={tableHeaderStyle}>
                    {['Severity', 'Control', 'Check', 'Resource', 'Pillar'].map(h => (
                      <th key={h} style={{ padding: '0.3rem 0.4rem', textAlign: 'left', fontWeight: 700, color: colors.textMuted, fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {critHighFails.map((f, i) => {
                    const sev = f.severity?.toUpperCase()
                    return (
                      <tr key={i} style={tableRowStyle}>
                        <td style={{ padding: '0.3rem 0.4rem' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.3rem', borderRadius: '999px', background: `${SEVERITY_COLOR[sev ?? '']}20`, color: SEVERITY_COLOR[sev ?? ''] ?? '#888' }}>{sev}</span>
                        </td>
                        <td style={{ padding: '0.3rem 0.4rem', fontFamily: 'monospace', fontSize: '0.65rem', color: colors.textMuted }}>{f.control_id}</td>
                        <td style={{ padding: '0.3rem 0.4rem', fontWeight: 500, color: colors.textMain, maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>{f.check_title || f.check_id}</td>
                        <td style={{ padding: '0.3rem 0.4rem', fontFamily: 'monospace', fontSize: '0.6rem', color: colors.textMuted, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.resource}</td>
                        <td style={{ padding: '0.3rem 0.4rem', fontSize: '0.65rem', textTransform: 'capitalize', color: colors.textMuted }}>{f.pillar}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Compliance Matrix ── */}
        {sec.complianceMatrix && (
          <div style={{ pageBreakInside: 'avoid', marginBottom: '1.25rem' }}>
            <SectionTitle colors={colors}>Compliance Matrix</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {regulatoryReadiness.length > 0 && (
                <div style={cardStyle}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: colors.accent, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Frameworks</div>
                  <div style={{ fontSize: '0.65rem', color: colors.textMuted, lineHeight: 1.4 }}>
                    {regulatoryReadiness.map(({ framework, pass: p, total: t }) => (
                      <div key={framework} style={{ marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 600, color: colors.textMain }}>{framework}:</span> {p}/{t} passed
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {categoryBreakdown.length > 0 && (
                <div style={cardStyle}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: colors.accent, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Categories</div>
                  <div style={{ fontSize: '0.65rem', color: colors.textMuted, lineHeight: 1.4 }}>
                    {categoryBreakdown.map(({ cat, pass: p, total: t }) => (
                      <div key={cat} style={{ marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 600, color: colors.textMain }}>{cat}:</span> {pct(p, t)}% pass rate
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Architectural Debt Heatmap ── */}
        {sec.architecturalDebt && pillars.length > 0 && (
          <div style={{ pageBreakInside: 'avoid', marginBottom: '2rem' }}>
            <SectionTitle colors={colors}>Architectural Debt Heatmap</SectionTitle>
            <div style={{ fontSize: '0.75rem', color: colors.textMuted, marginBottom: '0.75rem' }}>Failing controls by pillar × severity</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={tableHeaderStyle}>
                    <th style={{ padding: '0.3rem 0.4rem', textAlign: 'left', fontWeight: 700, color: colors.textMuted, fontSize: '0.6rem', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>Pillar</th>
                    {SEVERITY_ORDER.map(s => (
                      <th key={s} style={{ padding: '0.3rem 0.4rem', textAlign: 'center', fontWeight: 700, color: SEVERITY_COLOR[s], fontSize: '0.6rem', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>{s}</th>
                    ))}
                    <th style={{ padding: '0.3rem 0.4rem', textAlign: 'center', fontWeight: 700, color: colors.textMuted, fontSize: '0.6rem', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pillars.map(p => {
                    const rowCounts = SEVERITY_ORDER.map(s =>
                      findings.filter(f => f.pillar === p && f.severity?.toUpperCase() === s && f.status?.toUpperCase() === 'FAIL').length
                    )
                    const rowTotal = rowCounts.reduce((a, b) => a + b, 0)
                    return (
                      <tr key={p} style={tableRowStyle}>
                        <td style={{ padding: '0.3rem 0.4rem', fontWeight: 600, textTransform: 'capitalize', color: colors.textMain, fontSize: '0.65rem' }}>{p}</td>
                        {rowCounts.map((count, i) => {
                          const col = SEVERITY_COLOR[SEVERITY_ORDER[i]] ?? '#888'
                          const intensity = count === 0 ? 0 : 0.12 + (count / heatMax) * 0.65
                          return (
                            <td key={i} style={{ padding: '0.3rem 0.4rem', textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-block', minWidth: '1.4rem', padding: '0.1rem 0.25rem',
                                borderRadius: '4px', fontWeight: count > 0 ? 700 : 400,
                                background: count === 0 ? 'transparent' : `rgba(${parseInt(col.slice(1,3),16)},${parseInt(col.slice(3,5),16)},${parseInt(col.slice(5,7),16)},${intensity})`,
                                color: count === 0 ? (darkMode ? '#475569' : '#cbd5e1') : col,
                                fontSize: '0.6rem'
                              }}>
                                {count === 0 ? '—' : count}
                              </span>
                            </td>
                          )
                        })}
                        <td style={{ padding: '0.3rem 0.4rem', textAlign: 'center', fontWeight: 700, color: rowTotal > 0 ? '#ef4444' : '#22c55e', fontSize: '0.65rem' }}>
                          {rowTotal}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── All Findings ── */}
        {sec.allFindings && findings.length > 0 && (
          <div style={{ pageBreakInside: 'avoid', marginBottom: '2rem' }}>
            <SectionTitle colors={colors}>All Findings ({findings.length})</SectionTitle>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={tableHeaderStyle}>
                    {['Status', 'Severity', 'Control', 'Check', 'Resource', 'Pillar'].map(h => (
                      <th key={h} style={{ padding: '0.35rem 0.4rem', textAlign: 'left', fontWeight: 700, color: colors.textMuted, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>{h}</th>
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
                        <tr key={i} style={tableRowStyle}>
                          <td style={{ padding: '0.25rem 0.35rem' }}>
                            <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '0.08rem 0.25rem', borderRadius: '999px', background: `${STATUS_COLOR[status ?? ''] ?? '#888'}18`, color: STATUS_COLOR[status ?? ''] ?? '#888' }}>{status}</span>
                          </td>
                          <td style={{ padding: '0.25rem 0.35rem' }}>
                            <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '0.08rem 0.25rem', borderRadius: '999px', background: `${SEVERITY_COLOR[sev ?? ''] ?? '#888'}18`, color: SEVERITY_COLOR[sev ?? ''] ?? '#888' }}>{sev}</span>
                          </td>
                          <td style={{ padding: '0.25rem 0.35rem', fontFamily: 'monospace', fontSize: '0.62rem', color: colors.textMuted }}>{f.control_id}</td>
                          <td style={{ padding: '0.25rem 0.35rem', fontWeight: 500, color: colors.textMain, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>{f.check_title || f.check_id}</td>
                          <td style={{ padding: '0.25rem 0.35rem', fontFamily: 'monospace', fontSize: '0.62rem', color: colors.textMuted, maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.resource}</td>
                          <td style={{ padding: '0.25rem 0.35rem', fontSize: '0.62rem', textTransform: 'capitalize', color: colors.textMuted }}>{f.pillar}</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Remediation Plan ── */}
        {sec.remediationPlan && quickWins.length > 0 && (
          <div style={{ pageBreakInside: 'avoid', marginBottom: '2rem' }}>
            <SectionTitle colors={colors}>Remediation Plan — Top {quickWins.length} Priorities</SectionTitle>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={tableHeaderStyle}>
                    {['#', 'Severity', 'Control', 'Check', 'Resource', 'Remediation'].map(h => (
                      <th key={h} style={{ padding: '0.35rem 0.4rem', textAlign: 'left', fontWeight: 700, color: colors.textMuted, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quickWins.map((f, i) => {
                    const sev = f.severity?.toUpperCase()
                    return (
                      <tr key={i} style={tableRowStyle}>
                        <td style={{ padding: '0.25rem 0.35rem', color: colors.textMuted, fontWeight: 700, fontSize: '0.6rem' }}>{i + 1}</td>
                        <td style={{ padding: '0.25rem 0.35rem' }}>
                          <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '0.08rem 0.25rem', borderRadius: '999px', background: `${SEVERITY_COLOR[sev ?? ''] ?? '#888'}18`, color: SEVERITY_COLOR[sev ?? ''] ?? '#888' }}>{sev}</span>
                        </td>
                        <td style={{ padding: '0.25rem 0.35rem', fontFamily: 'monospace', fontSize: '0.62rem', color: colors.textMuted }}>{f.control_id}</td>
                        <td style={{ padding: '0.25rem 0.35rem', fontWeight: 500, color: colors.textMain, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.6rem' }}>{f.check_title || f.check_id}</td>
                        <td style={{ padding: '0.25rem 0.35rem', fontFamily: 'monospace', fontSize: '0.62rem', color: colors.textMuted, maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.resource}</td>
                        <td style={{ padding: '0.25rem 0.35rem', fontSize: '0.62rem', color: colors.textMuted, maxWidth: '140px' }}>{f.remediation || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Cloud Footprint ── */}
        {sec.cloudFootprint && detectedRegions.length > 0 && (
          <div style={{ pageBreakInside: 'avoid', marginBottom: '2rem' }}>
            <SectionTitle colors={colors}>Cloud Footprint</SectionTitle>
            <div style={{ display: 'flex', gap: '2rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <div style={{ border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: '10px', padding: '0.875rem 1.25rem', textAlign: 'center', minWidth: '90px', background: darkMode ? '#1e293b' : '#ffffff' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: colors.accent }}>{detectedRegions.length}</div>
                <div style={{ fontSize: '0.68rem', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.2rem' }}>Regions</div>
              </div>
              {Object.entries(providerCounts).map(([prov, cnt]) => (
                <div key={prov} style={{ border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: '10px', padding: '0.875rem 1.25rem', textAlign: 'center', minWidth: '90px', background: darkMode ? '#1e293b' : '#ffffff' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: colors.textMain }}>{cnt}</div>
                  <div style={{ fontSize: '0.68rem', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.2rem' }}>{prov}</div>
                </div>
              ))}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={tableHeaderStyle}>
                    <th style={{ padding: '0.25rem 0.35rem', textAlign: 'left', fontWeight: 700, color: colors.textMuted, fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>Region</th>
                    <th style={{ padding: '0.25rem 0.35rem', textAlign: 'left', fontWeight: 700, color: colors.textMuted, fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>Provider</th>
                  </tr>
                </thead>
                <tbody>
                  {detectedRegions.map(([region, provider], i) => (
                    <tr key={i} style={tableRowStyle}>
                      <td style={{ padding: '0.25rem 0.35rem', fontFamily: 'monospace', fontSize: '0.62rem', color: colors.textMain }}>{region}</td>
                      <td style={{ padding: '0.25rem 0.35rem', textTransform: 'capitalize', color: colors.textMuted, fontSize: '0.62rem' }}>{provider}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Plan Changes ── */}
        {sec.planChanges && run.plan_changes && (
          <div style={{ pageBreakInside: 'avoid', marginBottom: '2rem' }}>
            <SectionTitle colors={colors}>Plan Changes</SectionTitle>
            <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              {Object.entries(run.plan_changes.summary).map(([op, cnt]) => {
                const opColor: Record<string, string> = { add: '#22c55e', change: '#eab308', destroy: '#ef4444', replace: '#f97316', no_op: '#94a3b8' }
                return (
                  <div key={op} style={{ border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, borderRadius: '10px', padding: '0.75rem 1rem', textAlign: 'center', minWidth: '75px', background: darkMode ? '#1e293b' : '#ffffff' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: opColor[op] ?? '#94a3b8' }}>{cnt}</div>
                    <div style={{ fontSize: '0.65rem', color: colors.textMuted, textTransform: 'capitalize', marginTop: '0.2rem' }}>{op.replace('_', ' ')}</div>
                  </div>
                )
              })}
            </div>
            {run.plan_changes.changes.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={tableHeaderStyle}>
                      {['Resource', 'Type', 'Action'].map(h => (
                        <th key={h} style={{ padding: '0.25rem 0.35rem', textAlign: 'left', fontWeight: 700, color: colors.textMuted, fontSize: '0.6rem', textTransform: 'uppercase', borderBottom: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {run.plan_changes.changes.slice(0, 50).map((c, i) => {
                      const actionColor: Record<string, string> = { create: '#22c55e', update: '#eab308', delete: '#ef4444', replace: '#f97316', 'no-op': '#94a3b8' }
                      const action = c.action ?? '—'
                      return (
                        <tr key={i} style={tableRowStyle}>
                          <td style={{ padding: '0.25rem 0.35rem', fontFamily: 'monospace', fontSize: '0.62rem', color: colors.textMain }}>{c.address ?? '—'}</td>
                          <td style={{ padding: '0.25rem 0.35rem', fontFamily: 'monospace', fontSize: '0.62rem', color: colors.textMuted }}>{c.type ?? '—'}</td>
                          <td style={{ padding: '0.25rem 0.35rem' }}>
                            <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '0.08rem 0.25rem', borderRadius: '999px', background: `${actionColor[action] ?? '#888'}18`, color: actionColor[action] ?? '#888' }}>
                              {action}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`, display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.62rem', color: colors.accent }}>
          <div style={{ textAlign: 'center', fontWeight: 600 }}>WAF++ PASS · Open Source Compliance Framework</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'center', opacity: 0.8 }}>
            <span>Generated: {new Date().toLocaleString()}</span>
            <span>Maturity: {matMeta.label}</span>
            <span>Score: {run.score}/100</span>
          </div>
          <div style={{ textAlign: 'center', opacity: 0.6 }}>© 2026 WAF++ · waf2p.dev</div>
        </div>

      </div>
    </div>
  )
}
