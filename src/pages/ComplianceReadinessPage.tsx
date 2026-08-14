/**
 * Compliance Readiness Index
 *
 * Tracks compliance evidence readiness for decentralized WAF++ audits:
 * - % of controls mapped to frameworks (GDPR, ISO, SOC2, etc.)
 * - Evidence collection completeness per audit period
 * - Findings with missing remediation documentation
 * - "Ready for audit" score per project
 * - Expiration tracking for waivers/risk acceptances
 */
import { useEffect, useState } from 'react'
import { RunDetail, WaiverRecord, RiskRecord, fetchWaivers, fetchRisks } from '../api'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  run: RunDetail | null
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FrameworkStats {
  name: string
  description: string
  controls: number
  pct: number
}

interface ComplianceReadinessData {
  totalFrameworkCoverage: number
  frameworkCount: number
  evidenceCompleteness: number
  findingsWithoutRemediation: number
  readinessScore: number
  frameworks: FrameworkStats[]
  controlsWithoutRemediation: Array<{ id: string; title: string; category: string; severity: string }>
}


// ─── Helper functions ────────────────────────────────────────────────────────

function scoreHex(s: number): string {
  return s >= 80 ? '#059669' : s >= 60 ? '#d97706' : '#dc2626'
}

function isExpiringSoon(dateStr: string | undefined): boolean {
  if (!dateStr) return false
  const today = new Date()
  const target = new Date(dateStr)
  const diffTime = target.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays >= 0 && diffDays <= 30
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ComplianceReadinessPage({ run }: Props) {
  const [data, setData] = useState<ComplianceReadinessData | null>(null)
  const [waivers, setWaivers] = useState<WaiverRecord[]>([])
  const [risks, setRisks] = useState<RiskRecord[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch compliance readiness data from server
        const res = await fetch('/api/v1/compliance-readiness')
        if (res.ok) {
          const result = await res.json()
          setData(result)
        } else {
          // Fallback to in-memory calculation if API fails
          setData(calculateReadinessFromRun(run))
        }
      } catch {
        setData(calculateReadinessFromRun(run))
      }

      // Fetch waivers and risks separately
      try {
        const [w, r] = await Promise.all([fetchWaivers(), fetchRisks()])
        setWaivers(w)
        setRisks(r)
      } catch {
        // Use localStorage cache if API fails
        try {
          const w = JSON.parse(localStorage.getItem('wafpass_waivers') ?? '{}')
          setWaivers(Object.values(w) as WaiverRecord[])
        } catch {}
        try {
          const r = JSON.parse(localStorage.getItem('wafpass_risk_acceptances') ?? '{}')
          setRisks(Object.values(r) as RiskRecord[])
        } catch {}
      }
    }

    fetchData()
  }, [run])

  if (!run) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
        <p>Select a scan run to view compliance readiness metrics.</p>
      </div>
    )
  }

  // Fallback calculation if server data is not available
  const readinessData = data || calculateReadinessFromRun(run)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* ── Header Section ────────────────────────────────────────────────────── */}
      <div>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)' }}>
          Compliance Readiness
        </h1>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
          Evidence collection status and audit readiness scores — prepare for compliance audits with offline support
        </p>
      </div>

      {/* ── Stats Dashboard ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
        <StatCard
          label="Controls Mapped"
          value={`${readinessData.totalFrameworkCoverage}%`}
          color="#059669"
          bg="rgba(5,150,105,.08)"
          border="rgba(5,150,105,.2)"
        />
        <StatCard
          label="Frameworks"
          value={String(readinessData.frameworkCount)}
          color="#0094ff"
          bg="rgba(0,148,255,.08)"
          border="rgba(0,148,255,.2)"
        />
        <StatCard
          label="Evidence Ready"
          value={`${readinessData.evidenceCompleteness}%`}
          color="#d97706"
          bg="rgba(217,119,6,.08)"
          border="rgba(217,119,6,.2)"
        />
        <StatCard
          label="Missing Remediation"
          value={String(readinessData.findingsWithoutRemediation)}
          color="#dc2626"
          bg="rgba(220,38,38,.08)"
          border="rgba(220,38,38,.2)"
        />
        <StatCard
          label="Ready for Audit"
          value={`${readinessData.readinessScore}/100`}
          color="#7c3aed"
          bg="rgba(124,58,237,.08)"
          border="rgba(124,58,237,.2)"
          highlight
        />
      </div>

      {/* ── Audit Readiness Indicator ──────────────────────────────────────────── */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>Audit Readiness Score</h2>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: scoreHex(readinessData.readinessScore) }}>
                {readinessData.readinessScore}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>/100</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.15rem 0.6rem',
                borderRadius: '999px',
                background: readinessData.readinessScore >= 70 ? 'rgba(5,150,105,.15)' : readinessData.readinessScore >= 50 ? 'rgba(217,119,6,.15)' : 'rgba(220,38,38,.15)',
                border: `1px solid ${readinessData.readinessScore >= 70 ? 'rgba(5,150,105,.3)' : readinessData.readinessScore >= 50 ? 'rgba(217,119,6,.3)' : 'rgba(220,38,38,.3)'}`,
                color: readinessData.readinessScore >= 70 ? '#059669' : readinessData.readinessScore >= 50 ? '#d97706' : '#dc2626',
              }}>
                {readinessData.readinessScore >= 70 ? 'Ready for Audit' : readinessData.readinessScore >= 50 ? 'Near Ready' : 'Needs Work'}
              </span>
            </div>
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.7rem', color: 'var(--muted)' }}>
              Based on: <strong style={{ color: 'var(--text)' }}>Framework Coverage</strong>, <strong style={{ color: 'var(--text)' }}>Evidence Completeness</strong>, and <strong style={{ color: 'var(--text)' }}>Remediation Documentation</strong>
            </p>
          </div>
          {/* Visual circular indicator */}
          <div style={{ flexShrink: 0 }}>
            <svg width="120" height="120" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#f1f5f9" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="45"
                fill="none"
                stroke="#7c3aed"
                strokeWidth="8"
                strokeDasharray="283"
                strokeDashoffset={Math.max(0, 283 - (readinessData.readinessScore / 100) * 283)}
                strokeLinecap="round"
              />
            </svg>
            <div style={{ textAlign: 'center', marginTop: '-90px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)' }}>{readinessData.readinessScore}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 600 }}>Ready Score</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Evidence Collection by Framework ───────────────────────────────────── */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <svg width="20" height="20" fill="none" stroke="var(--waf-brand)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>Evidence Collection by Framework</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {readinessData.frameworks.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>No framework mappings found in control library.</p>
          ) : (
            readinessData.frameworks.map((fw, idx) => (
              <div key={fw.name} style={{
                borderBottom: idx < readinessData.frameworks.length - 1 ? '1px solid var(--border)' : 'none',
                paddingBottom: '0.75rem',
                marginBottom: '0.25rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>{fw.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{fw.description}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      color: fw.pct >= 80 ? '#059669' : fw.pct >= 50 ? '#d97706' : '#dc2626',
                    }}>
                      {fw.pct}% complete
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>{fw.controls} controls</div>
                  </div>
                </div>
                <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      background: fw.pct >= 80 ? '#059669' : fw.pct >= 50 ? '#d97706' : '#dc2626',
                      width: `${fw.pct}%`,
                      borderRadius: '999px',
                      transition: 'width 0.5s ease-out',
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Expiring Waivers & Risk Acceptances ────────────────────────────────── */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <svg width="20" height="20" fill="none" stroke="#d97706" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>Waivers & Risk Acceptances Expiring (30 days)</h2>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '1rem' }}>
          Review items that need attention before your audit.
        </div>

        {waivers.length === 0 && risks.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            color: 'var(--muted)',
            fontSize: '0.8rem',
            background: 'rgba(255,255,255,0.5)',
            borderRadius: '8px',
          }}>
            No waivers or risk acceptances configured.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* Waivers */}
            {waivers.slice(0, 5).map((w: WaiverRecord, i) => (
              <div key={`waiver-${i}`} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                background: 'rgba(251,191,36,.08)',
                border: '1px solid rgba(217,119,6,.2)',
                borderRadius: '8px',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#d97706', fontFamily: 'monospace' }}>
                    {w.id}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#d97706', marginTop: '0.2rem' }}>{w.reason}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                    Expires: {w.expires || 'Not set'}
                  </div>
                </div>
                {w.expires && isExpiringSoon(w.expires) && (
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    background: 'rgba(251,191,36,.2)',
                    color: '#d97706',
                  }}>
                    EXPIRING SOON
                  </span>
                )}
              </div>
            ))}
            {/* Risk Acceptances */}
            {risks.slice(0, 5).map((ra: RiskRecord, i) => (
              <div key={`risk-${i}`} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                background: 'rgba(14,165,233,.08)',
                border: '1px solid rgba(14,165,233,.2)',
                borderRadius: '8px',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0094ff', fontFamily: 'monospace' }}>
                    {ra.id}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#0094ff', marginTop: '0.2rem' }}>{ra.reason}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                    Expires: {ra.expires || 'Not set'} | Risk: {ra.residual_risk || 'medium'}
                  </div>
                </div>
                {ra.expires && isExpiringSoon(ra.expires) && (
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    background: 'rgba(14,165,233,.2)',
                    color: '#0094ff',
                  }}>
                    EXPIRING SOON
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Findings Missing Remediation ───────────────────────────────────────── */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <svg width="20" height="20" fill="none" stroke="#dc2626" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>
            Findings Missing Remediation Documentation
          </h2>
        </div>

        {readinessData.controlsWithoutRemediation.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '1.5rem',
            color: 'var(--muted)',
            fontSize: '0.8rem',
            background: 'rgba(5,150,105,.04)',
            border: '1px solid rgba(5,150,105,.2)',
            borderRadius: '8px',
          }}>
            All controls have remediation documentation.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {readinessData.controlsWithoutRemediation.slice(0, 10).map((control, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                background: 'rgba(220,38,38,.05)',
                border: '1px solid rgba(220,38,38,.15)',
                borderRadius: '8px',
              }}>
                <svg width="20" height="20" fill="none" stroke="#fca5a5" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: '2px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#dc2626', fontFamily: 'monospace' }}>
                    {control.id}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#dc2626' }}>{control.title}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                    {control.category} | severity: {control.severity}
                  </div>
                </div>
              </div>
            ))}
            {readinessData.controlsWithoutRemediation.length > 10 && (
              <div style={{ textAlign: 'center', fontSize: '0.65rem', color: 'var(--muted)' }}>
                +{readinessData.controlsWithoutRemediation.length - 10} more controls missing remediation
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Stat Card Component ─────────────────────────────────────────────────────

function StatCard({ label, value, color, bg, border, highlight = false }: {
  label: string
  value: string
  color: string
  bg: string
  border: string
  highlight?: boolean
}) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '1.25rem',
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: '12px',
    }}>
      <div
        style={{
          fontSize: highlight ? '2rem' : '1.75rem',
          fontWeight: 800,
          color: color,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: '0.65rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: color,
          marginTop: '0.25rem',
        }}
      >
        {label}
      </div>
    </div>
  )
}

// ─── Fallback calculation ────────────────────────────────────────────────────

function calculateReadinessFromRun(run: RunDetail | null): ComplianceReadinessData {
  if (!run) {
    return {
      totalFrameworkCoverage: 0,
      frameworkCount: 0,
      evidenceCompleteness: 0,
      findingsWithoutRemediation: 0,
      readinessScore: 0,
      frameworks: [],
      controlsWithoutRemediation: [],
    }
  }

  // Count controls with regulatory mapping
  const controlsWithFramework = run.controls_meta.filter(c => c.regulatory_mapping && c.regulatory_mapping.length > 0)
  const totalFrameworkCoverage = run.controls_meta.length > 0
    ? Math.round((controlsWithFramework.length / run.controls_meta.length) * 100)
    : 0

  // Count unique frameworks
  const frameworkSet = new Set<string>()
  run.controls_meta.forEach(c => {
    c.regulatory_mapping?.forEach(m => frameworkSet.add(m.framework))
  })
  const frameworkCount = frameworkSet.size

  // Evidence completeness (controls with evidence defined)
  const controlsWithEvidence = run.controls_meta.filter(c => (c as any).evidence && (c as any).evidence.required && (c as any).evidence.required.length > 0)
  const evidenceCompleteness = run.controls_meta.length > 0
    ? Math.round((controlsWithEvidence.length / run.controls_meta.length) * 100)
    : 0

  // Find controls missing remediation (check remediation field)
  const controlsWithoutRemediation = run.controls_meta.filter(c => !(c as any).remediation || (c as any).remediation.trim() === '').map(c => ({
    id: c.id,
    title: c.title,
    category: c.category || 'unknown',
    severity: c.severity || 'medium',
  }))

  // Calculate readiness score
  const remediationPenalty = Math.min(20, Math.round((controlsWithoutRemediation.length / run.controls_meta.length) * 20))
  const readinessScore = Math.max(0, Math.round((totalFrameworkCoverage * 0.4) + (evidenceCompleteness * 0.4) - remediationPenalty))

  // Framework stats
  const frameworks: FrameworkStats[] = []
  frameworkSet.forEach(fwName => {
    const frameworkControls = run.controls_meta.filter(c => c.regulatory_mapping?.some(m => m.framework === fwName))
    frameworks.push({
      name: fwName,
      description: getFrameworkDescription(fwName),
      controls: frameworkControls.length,
      pct: Math.round((frameworkControls.filter(c => c.regulatory_mapping?.some(m => m.framework === fwName)).length / frameworkControls.length) * 100) || 0,
    })
  })
  frameworks.sort((a, b) => b.pct - a.pct)

  return {
    totalFrameworkCoverage,
    frameworkCount,
    evidenceCompleteness,
    findingsWithoutRemediation: controlsWithoutRemediation.length,
    readinessScore,
    frameworks,
    controlsWithoutRemediation,
  }
}

function getFrameworkDescription(name: string): string {
  const descriptions: Record<string, string> = {
    'GDPR': 'General Data Protection Regulation (EU) 2016/679',
    'ISO 27001': 'Information Security Management Systems',
    'ISO 27001:2022': 'Information Security Management Systems',
    'BSI C5': 'Cloud Computing Compliance Criteria Catalogue',
    'BSI C5:2020': 'Cloud Computing Compliance Criteria Catalogue',
    'EUCS': 'EU Cybersecurity Certification Scheme for Cloud',
    'EUCS (ENISA)': 'EU Cybersecurity Certification Scheme for Cloud',
    'CSRD': 'Corporate Sustainability Reporting Directive',
    'SOC 2': 'AICPA Service Organization Controls — Trust Services Criteria',
    'SOC 2 Type II': 'AICPA Service Organization Controls — Trust Services Criteria',
  }
  return descriptions[name] || ''
}
