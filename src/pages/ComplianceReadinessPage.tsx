/**
 * Compliance Readiness Index
 *
 * Tracks compliance evidence readiness for decentralized Wombat audits:
 * - % of controls mapped to frameworks (GDPR, ISO, SOC2, etc.)
 * - Evidence collection completeness per audit period
 * - Findings with missing remediation documentation
 * - "Ready for audit" score per project
 * - Expiration tracking for waivers/risk acceptances
 */
import { useEffect, useState } from 'react'
import {
  ComplianceReadinessData,
  FrameworkStats,
  RunDetail,
  RiskRecord,
  WaiverRecord,
  fetchComplianceReadiness,
  fetchRisks,
  fetchWaivers,
} from '../api'
import { scoreColor } from '../severity';
import { Card, EmptyState, PageHeader, Skeleton, SkeletonText, StatTile } from '../ui';
import { useI18n } from '../i18n';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  run: RunDetail | null
}


// ─── Helper functions ────────────────────────────────────────────────────────


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
  const { t } = useI18n()
  const [data, setData] = useState<ComplianceReadinessData | null>(null)
  const [waivers, setWaivers] = useState<WaiverRecord[]>([])
  const [risks, setRisks] = useState<RiskRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usingFallback, setUsingFallback] = useState(false)

  useEffect(() => {
    if (!run) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    setUsingFallback(false)

    const loadData = async () => {
      try {
        const result = await fetchComplianceReadiness(run.id)
        setData(result)
      } catch (err) {
        // Fallback to in-memory calculation if server is unreachable
        setData(calculateReadinessFromRun(run))
        setUsingFallback(true)
        setError(err instanceof Error ? err.message : t('pages.phase3.readiness.serverUnavailable'))
      } finally {
        setLoading(false)
      }

      // Fetch waivers and risks separately, scoped to the run's project
      try {
        const [w, r] = await Promise.all([fetchWaivers(run.project), fetchRisks(run.project)])
        setWaivers(w)
        setRisks(r)
      } catch {
        // Use localStorage cache if API fails
        try {
          const w = JSON.parse(localStorage.getItem('wombat_waivers') ?? '{}')
          setWaivers(Object.values(w) as WaiverRecord[])
        } catch {}
        try {
          const r = JSON.parse(localStorage.getItem('wombat_risk_acceptances') ?? '{}')
          setRisks(Object.values(r) as RiskRecord[])
        } catch {}
      }
    }

    loadData()
  }, [run])

  if (!run) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        <PageHeader
          title={t('pages.phase3.readiness.pageTitle')}
          description={t('pages.phase3.readiness.pageDescription')}
        />
        <EmptyState title={t('pages.phase3.readiness.selectRun')} />
      </div>
    )
  }

  const readinessData = data ?? calculateReadinessFromRun(run)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* ── Header Section ────────────────────────────────────────────────────── */}
      <PageHeader
        title={t('pages.phase3.readiness.pageTitle')}
        description={t('pages.phase3.readiness.pageDescription')}
      />

      {usingFallback && (
        <div style={{
          padding: '0.75rem 1rem',
          background: 'color-mix(in srgb, var(--score-mid) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--score-mid) 30%, transparent)',
          borderRadius: '8px',
          color: 'var(--score-mid-ink)',
          fontSize: '0.75rem',
        }}>
          <strong>{t('pages.phase3.readiness.offlineEstimateLabel')}</strong> {t('pages.phase3.readiness.offlineEstimateBody')}
        </div>
      )}

      {error && !usingFallback && (
        <div style={{
          padding: '0.75rem 1rem',
          background: 'color-mix(in srgb, var(--fail) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--fail) 30%, transparent)',
          borderRadius: '8px',
          color: 'var(--fail-ink)',
          fontSize: '0.75rem',
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          <span className="ui-sr-only">Loading compliance readiness metrics…</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ padding: '1.25rem', border: '1px solid var(--border)', borderRadius: '12px' }}>
                <Skeleton height={28} width="60%" style={{ margin: '0 auto 0.5rem' }} />
                <Skeleton height={10} width="80%" style={{ margin: '0 auto' }} />
              </div>
            ))}
          </div>
          <div style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '12px' }}>
            <SkeletonText lines={4} />
          </div>
        </div>
      ) : (
        <>
          {/* ── Stats Dashboard ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
        <StatTile
          label={t('pages.phase3.readiness.statControlsMapped')}
          value={`${readinessData.totalFrameworkCoverage}%`}
          tone="pass"
        />
        <StatTile
          label={t('pages.phase3.readiness.statFrameworks')}
          value={String(readinessData.frameworkCount)}
          tone="info"
        />
        <StatTile
          label={t('pages.phase3.readiness.statEvidenceReady')}
          value={`${readinessData.evidenceCompleteness}%`}
          tone="warn"
        />
        <StatTile
          label={t('pages.phase3.readiness.statMissingRemediation')}
          value={String(readinessData.findingsWithoutRemediation)}
          tone="fail"
        />
        <StatTile
          label={t('pages.phase3.readiness.statReadyForAudit')}
          value={`${readinessData.readinessScore}/100`}
          tone={readinessData.readinessScore >= 80 ? 'pass' : readinessData.readinessScore >= 60 ? 'warn' : 'fail'}
        />
      </div>

      {/* ── Audit Readiness Indicator ──────────────────────────────────────────── */}
      <Card title={t('pages.phase3.readiness.auditReadinessScore')}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: scoreColor(readinessData.readinessScore) }}>
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
                background: readinessData.readinessScore >= 70 ? 'color-mix(in srgb, var(--pass) 15%, transparent)' : readinessData.readinessScore >= 50 ? 'color-mix(in srgb, var(--score-mid) 15%, transparent)' : 'color-mix(in srgb, var(--fail) 15%, transparent)',
                border: `1px solid ${readinessData.readinessScore >= 70 ? 'color-mix(in srgb, var(--pass) 30%, transparent)' : readinessData.readinessScore >= 50 ? 'color-mix(in srgb, var(--score-mid) 30%, transparent)' : 'color-mix(in srgb, var(--fail) 30%, transparent)'}`,
                color: readinessData.readinessScore >= 70 ? 'var(--pass-ink)' : readinessData.readinessScore >= 50 ? 'var(--score-mid-ink)' : 'var(--fail-ink)',
              }}>
                {readinessData.readinessScore >= 70 ? t('pages.phase3.readiness.statusReadyForAudit') : readinessData.readinessScore >= 50 ? t('pages.phase3.readiness.statusNearReady') : t('pages.phase3.readiness.statusNeedsWork')}
              </span>
            </div>
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.7rem', color: 'var(--muted)' }}>
              {t('pages.phase3.readiness.basedOn')} <strong style={{ color: 'var(--text)' }}>{t('pages.phase3.readiness.basedOnFrameworkCoverage')}</strong>, <strong style={{ color: 'var(--text)' }}>{t('pages.phase3.readiness.basedOnEvidenceCompleteness')}</strong>, and <strong style={{ color: 'var(--text)' }}>{t('pages.phase3.readiness.basedOnRemediationDocumentation')}</strong>
            </p>
          </div>
          {/* Visual circular indicator */}
          <div style={{ flexShrink: 0 }}>
            <svg width="120" height="120" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="var(--track)" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="45"
                fill="none"
                stroke={scoreColor(readinessData.readinessScore)}
                strokeWidth="8"
                strokeDasharray="283"
                strokeDashoffset={Math.max(0, 283 - (readinessData.readinessScore / 100) * 283)}
                strokeLinecap="round"
              />
            </svg>
            <div style={{ textAlign: 'center', marginTop: '-90px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)' }}>{readinessData.readinessScore}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600 }}>{t('pages.phase3.readiness.readyScore')}</div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Evidence Collection by Framework ───────────────────────────────────── */}
      <Card
        title={
          <>
            <svg width="20" height="20" fill="none" stroke="var(--waf-brand)" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {' '}{t('pages.phase3.readiness.evidenceByFramework')}
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {readinessData.frameworks.length === 0 ? (
            <EmptyState compact title={t('pages.phase3.readiness.noFrameworkMappings')} />
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
                      color: fw.pct >= 80 ? 'var(--pass-ink)' : fw.pct >= 50 ? 'var(--score-mid-ink)' : 'var(--fail-ink)',
                    }}>
                      {t('pages.phase3.readiness.frameworkPercentComplete', { pct: fw.pct })}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{t('pages.phase3.readiness.frameworkControls', { count: fw.controls })}</div>
                  </div>
                </div>
                <div style={{ height: '8px', background: 'var(--track)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      background: fw.pct >= 80 ? 'var(--pass)' : fw.pct >= 50 ? 'var(--score-mid)' : 'var(--fail)',
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
      </Card>

      {/* ── Expiring Waivers & Risk Acceptances ────────────────────────────────── */}
      <Card
        title={
          <>
            <svg width="20" height="20" fill="none" stroke="var(--score-mid)" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {' '}{t('pages.phase3.readiness.waiversExpiringTitle')}
          </>
        }
      >
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '1rem' }}>
          {t('pages.phase3.readiness.waiversExpiringHint')}
        </div>

        {waivers.length === 0 && risks.length === 0 ? (
          <EmptyState compact title={t('pages.phase3.readiness.noWaiversOrRisks')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* Waivers */}
            {waivers.slice(0, 5).map((w: WaiverRecord, i) => (
              <div key={`waiver-${i}`} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                background: 'color-mix(in srgb, var(--score-mid) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--score-mid) 20%, transparent)',
                borderRadius: '8px',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--score-mid-ink)', fontFamily: 'monospace' }}>
                    {w.id}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--score-mid-ink)', marginTop: '0.2rem' }}>{w.reason}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                    {t('pages.phase3.readiness.expires')} {w.expires || t('pages.phase3.readiness.notSet')}
                  </div>
                </div>
                {w.expires && isExpiringSoon(w.expires) && (
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    background: 'color-mix(in srgb, var(--score-mid) 20%, transparent)',
                    color: 'var(--score-mid-ink)',
                  }}>
                    {t('pages.phase3.readiness.expiringSoon')}
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
                background: 'color-mix(in srgb, var(--waf-brand) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--waf-brand) 20%, transparent)',
                borderRadius: '8px',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--waf-brand-ink)', fontFamily: 'monospace' }}>
                    {ra.id}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--waf-brand-ink)', marginTop: '0.2rem' }}>{ra.reason}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                    {t('pages.phase3.readiness.expires')} {ra.expires || t('pages.phase3.readiness.notSet')} | {t('pages.phase3.readiness.riskLabel')} {ra.residual_risk || 'medium'}
                  </div>
                </div>
                {ra.expires && isExpiringSoon(ra.expires) && (
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    background: 'color-mix(in srgb, var(--waf-brand) 20%, transparent)',
                    color: 'var(--waf-brand-ink)',
                  }}>
                    {t('pages.phase3.readiness.expiringSoon')}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Findings Missing Remediation ───────────────────────────────────────── */}
      <Card
        title={
          <>
            <svg width="20" height="20" fill="none" stroke="var(--fail)" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {' '}{t('pages.phase3.readiness.findingsMissingRemediation')}
          </>
        }
      >
        {readinessData.controlsWithoutRemediation.length === 0 ? (
          <EmptyState compact title={t('pages.phase3.readiness.allControlsDocumented')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {readinessData.controlsWithoutRemediation.slice(0, 10).map((control, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                background: 'color-mix(in srgb, var(--fail) 5%, transparent)',
                border: '1px solid color-mix(in srgb, var(--fail) 15%, transparent)',
                borderRadius: '8px',
              }}>
                <svg width="20" height="20" fill="none" stroke="var(--fail)" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--fail-ink)', fontFamily: 'monospace' }}>
                    {control.id}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--fail-ink)' }}>{control.title}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                    {t('pages.phase3.readiness.controlCategorySeverity', { category: control.category, severity: control.severity })}
                  </div>
                </div>
              </div>
            ))}
            {readinessData.controlsWithoutRemediation.length > 10 && (
              <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--muted)' }}>
                {t('pages.phase3.readiness.moreControlsMissing', { count: readinessData.controlsWithoutRemediation.length - 10 })}
              </div>
            )}
          </div>
        )}
      </Card>
      </>)}
    </div>
  )
}

// ─── Fallback calculation ────────────────────────────────────────────────────

function frameworksForControl(control: RunDetail['controls_meta'][number]): Set<string> {
  return new Set((control.regulatory_mapping || []).map(m => m.framework).filter(Boolean))
}

function controlHasRemediation(control: RunDetail['controls_meta'][number]): boolean {
  return (control.checks || []).some(check => (check.remediation || '').trim().length > 0)
}

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

  const controls = run.controls_meta || []
  const totalControls = controls.length

  // Framework coverage: % of controls mapped to at least one framework
  const mappedControls = controls.filter(c => frameworksForControl(c).size > 0)
  const totalFrameworkCoverage = totalControls > 0
    ? Math.round((mappedControls.length / totalControls) * 100)
    : 0

  // Build per-framework stats. Offline fallback has no evidence data, so bars show 0%
  // to avoid the previous hard-coded 100% bug.
  const frameworkNames = new Set<string>()
  controls.forEach(c => frameworksForControl(c).forEach(fw => frameworkNames.add(fw)))

  const frameworks: FrameworkStats[] = []
  frameworkNames.forEach(fwName => {
    const fwControls = controls.filter(c => frameworksForControl(c).has(fwName))
    frameworks.push({
      name: fwName,
      description: getFrameworkDescription(fwName),
      controls: fwControls.length,
      pct: 0,
    })
  })
  frameworks.sort((a, b) => a.name.localeCompare(b.name))

  // Evidence completeness: unknown offline, so report 0 rather than guess.
  const evidenceCompleteness = 0

  // Controls missing remediation: require at least one check with non-empty remediation text
  const controlsWithoutRemediation = controls
    .filter(c => !controlHasRemediation(c))
    .map(c => ({
      id: c.id,
      title: c.title,
      category: c.category || 'unknown',
      severity: c.severity || 'medium',
    }))

  const remediationPenalty = totalControls > 0
    ? Math.min(20, Math.round((controlsWithoutRemediation.length / totalControls) * 20))
    : 0
  const readinessScore = Math.max(
    0,
    Math.round((totalFrameworkCoverage * 0.4) + (evidenceCompleteness * 0.4) - remediationPenalty),
  )

  return {
    totalFrameworkCoverage,
    frameworkCount: frameworkNames.size,
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
    'BSI C3A': 'Cloud Computing Security Requirements for Important Category (C3A)',
    'BSI C3A:2026': 'Cloud Computing Security Requirements for Important Category (C3A)',
    'EUCS': 'EU Cybersecurity Certification Scheme for Cloud',
    'EUCS (ENISA)': 'EU Cybersecurity Certification Scheme for Cloud',
    'CSRD': 'Corporate Sustainability Reporting Directive',
    'SOC 2': 'AICPA Service Organization Controls — Trust Services Criteria',
    'SOC 2 Type II': 'AICPA Service Organization Controls — Trust Services Criteria',
    'PCI DSS v4.0': 'Payment Card Industry Data Security Standard v4.0',
    'CIS Controls v8': 'Center for Internet Security Controls v8',
    'COBIT 2019': 'Control Objectives for Information and Related Technologies',
    'NIS2': 'Network and Information Security Directive (EU) 2022/2555',
    'DORA': 'Digital Operational Resilience Act (EU) 2022/2554',
    'CSA STAR': 'Cloud Security Alliance Security, Trust & Assurance Registry',
    'IT-Grundschutz': 'BSI IT-Grundschutz Compendium',
  }
  return descriptions[name] || ''
}
