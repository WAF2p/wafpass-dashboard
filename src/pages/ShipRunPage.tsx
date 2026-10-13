/**
 * Ship Run for Validation — pick a recent scan run and submit it to the WAF++
 * validation gateway for official countersignature.
 */
import { useEffect, useMemo, useState } from 'react'
import { useAuth, hasMinRole } from '../AuthContext'
import { useI18n } from '../i18n'
import {
  createRunAttestation,
  fetchRuns,
  fetchServerCertificate,
  getValidationGatewayBase,
  submitValidation,
  VALIDATION_URL_KEY,
  type RunSummary,
  type ValidationGatewaySubmit,
} from '../api'

function scoreColor(s: number): string {
  return s >= 80 ? '#059669' : s >= 60 ? '#d97706' : '#DA2C38'
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  prod: { bg: '#fef2f2', text: '#b91c1c' },
  production: { bg: '#fef2f2', text: '#b91c1c' },
  staging: { bg: '#fff7ed', text: '#c2410c' },
  stage: { bg: '#fff7ed', text: '#c2410c' },
  dev: { bg: '#f0fdf4', text: '#15803d' },
  development: { bg: '#f0fdf4', text: '#15803d' },
  test: { bg: '#eff6ff', text: '#1d4ed8' },
  qa: { bg: '#faf5ff', text: '#7e22ce' },
}

function StageBadge({ stage }: { stage: string }) {
  if (!stage) return <span style={{ color: 'var(--muted)' }}>—</span>
  const colors = STAGE_COLORS[stage.toLowerCase()] ?? { bg: '#f1f5f9', text: '#475569' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '0.15rem 0.5rem', borderRadius: '999px',
      background: colors.bg, color: colors.text,
      fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap',
    }}>
      {stage}
    </span>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const color = scoreColor(score)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: '2.75rem', padding: '0.2rem 0.6rem', borderRadius: '999px',
      background: `${color}18`, color, fontWeight: 700, fontSize: '0.85rem',
    }}>
      {score}
    </span>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '12px', padding: '1rem 1.25rem',
    }}>
      {children}
    </div>
  )
}

export default function ShipRunPage() {
  const { t } = useI18n()
  const { role } = useAuth()
  const canSubmit = hasMinRole(role ?? 'clevel', 'clevel')

  const [runs, setRuns] = useState<RunSummary[]>([])
  const [loadingRuns, setLoadingRuns] = useState(false)
  const [runsError, setRunsError] = useState<string | null>(null)

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)
  const [gatewayUrl, setGatewayUrl] = useState(() => {
    try { return localStorage.getItem(VALIDATION_URL_KEY) ?? '' } catch { return '' }
  })
  const gatewayConfigured = Boolean(getValidationGatewayBase())

  useEffect(() => {
    let cancelled = false
    setLoadingRuns(true)
    setRunsError(null)
    fetchRuns({ limit: 100 }).then(page => {
      if (cancelled) return
      setRuns(page.items)
      setLoadingRuns(false)
    }).catch((e: Error) => {
      if (cancelled) return
      setRunsError(e.message)
      setLoadingRuns(false)
    })
    return () => { cancelled = true }
  }, [])

  const selectedRun = useMemo(
    () => runs.find(r => r.id === selectedRunId) ?? null,
    [runs, selectedRunId]
  )

  async function handleSubmit() {
    if (!selectedRunId) return
    if (!apiKey.trim()) return
    setSubmitting(true)
    setSubmitError(null)
    setStep(null)
    setSuccessId(null)

    try {
      setStep('Signing run locally…')
      const attestation = await createRunAttestation(selectedRunId)

      setStep('Fetching server certificate…')
      const serverCertificate = await fetchServerCertificate()

      const payload: ValidationGatewaySubmit = {
        server_certificate: serverCertificate,
        local_attestation: {
          public_key: attestation.public_key,
          signature: attestation.signature,
          algorithm: attestation.algorithm,
          canonical_hash: attestation.canonical_hash,
          signed_at: attestation.signed_at,
          signer_kind: attestation.signer_kind,
        },
        run: attestation.run,
      }

      setStep('Submitting to validation gateway…')
      const record = await submitValidation(payload, apiKey.trim())

      // Persist the new validation ID so it appears on ValidationsPage.
      try {
        const known = JSON.parse(localStorage.getItem('wafpass_validations') ?? '[]') as string[]
        if (!known.includes(record.validation_id)) {
          localStorage.setItem('wafpass_validations', JSON.stringify([record.validation_id, ...known]))
        }
      } catch {
        // localStorage failures are non-fatal.
      }

      setSuccessId(record.validation_id)
      setSelectedRunId(null)
      setApiKey('')
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Submit failed')
    } finally {
      setSubmitting(false)
      setStep(null)
    }
  }

  function handleSelectRun(id: string) {
    setSelectedRunId(id)
    setSubmitError(null)
    setSuccessId(null)
    setStep(null)
  }

  function handleSaveGatewayUrl() {
    const trimmed = gatewayUrl.trim().replace(/\/$/, '')
    setGatewayUrl(trimmed)
    try {
      localStorage.setItem(VALIDATION_URL_KEY, trimmed)
    } catch {
      // localStorage failures are non-fatal.
    }
  }

  const colHeaders = [
    t('pages.shiprun.colProject'),
    t('pages.shiprun.colBranch'),
    t('pages.shiprun.colStage'),
    t('pages.shiprun.colScore'),
    t('pages.shiprun.colFramework'),
    t('pages.shiprun.colTriggeredBy'),
    t('pages.shiprun.colControls'),
    t('pages.shiprun.colDate'),
    t('pages.shiprun.colAction'),
  ]

  return (
    <div style={{ padding: '1.25rem 1.5rem', maxWidth: '1600px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.4rem', color: 'var(--text)' }}>
          {t('pages.shiprun.title')}
        </h1>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)' }}>
          {t('pages.shiprun.subtitle')}
        </p>
      </div>

      {!gatewayConfigured && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <svg width="18" height="18" fill="none" stroke="#d97706" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.95rem' }}>Validation gateway URL not configured</span>
          </div>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--muted)' }}>
            Set the base URL of the WAF++ validation gateway. It is stored locally in this browser and is used when submitting runs for countersignature.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              type="url"
              value={gatewayUrl}
              onChange={e => setGatewayUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveGatewayUrl() }}
              placeholder="https://gateway.example.com"
              style={{
                flex: 1, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '0.6rem 0.85rem', fontSize: '0.82rem', outline: 'none',
              }}
            />
            <button
              onClick={handleSaveGatewayUrl}
              disabled={!gatewayUrl.trim()}
              style={{
                padding: '0.55rem 1rem', borderRadius: '8px', cursor: gatewayUrl.trim() ? 'pointer' : 'not-allowed',
                background: gatewayUrl.trim() ? 'var(--waf-brand)' : 'var(--border)', color: '#fff', fontWeight: 700,
                fontSize: '0.8rem', border: 'none', whiteSpace: 'nowrap',
              }}
            >
              Save URL
            </button>
          </div>
          <p style={{ margin: 0, fontSize: '0.71rem', color: 'var(--muted)' }}>
            You can also set the build-time variable <code style={{ fontSize: '0.68rem' }}>VITE_VALIDATION_URL</code> or configure it on the <a href="#/settings" style={{ color: 'var(--waf-brand)' }}>Settings</a> page.
          </p>
        </Card>
      )}

      {!canSubmit && (
        <Card>
          <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            {t('pages.shiprun.roleRequired')}
          </div>
        </Card>
      )}

      {successId && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <svg width="20" height="20" fill="none" stroke="#059669" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{t('pages.shiprun.successTitle')}</span>
          </div>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.82rem', color: 'var(--muted)' }}>
            {t('pages.shiprun.successMsg', { id: successId })}
          </p>
          <a
            href={`#/validations`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.45rem 0.75rem', borderRadius: '8px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              color: 'var(--waf-brand)', fontSize: '0.78rem', fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            {t('pages.shiprun.viewInRegistry')}
          </a>
        </Card>
      )}

      {canSubmit && selectedRun && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <svg width="18" height="18" fill="none" stroke="var(--waf-brand)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.95rem' }}>
              {t('pages.shiprun.selectRun')}
            </span>
          </div>

          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center',
            padding: '0.75rem', background: 'var(--bg)', borderRadius: '8px',
            marginBottom: '0.75rem', fontSize: '0.82rem',
          }}>
            <span style={{ fontWeight: 600, color: 'var(--waf-brand)' }}>{selectedRun.project || '—'}</span>
            <span style={{ color: 'var(--muted)' }}>{selectedRun.branch || '—'}</span>
            <StageBadge stage={selectedRun.stage} />
            <ScoreBadge score={selectedRun.score} />
            <span style={{ color: 'var(--muted)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
              {selectedRun.git_sha ? selectedRun.git_sha.slice(0, 7) : '—'}
            </span>
            <span style={{ color: 'var(--muted)', marginLeft: 'auto' }}>{fmtDate(selectedRun.created_at)}</span>
          </div>

          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={t('pages.shiprun.apiKeyLabel')}
            style={{
              width: '100%', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '0.75rem',
              background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
              borderRadius: '8px', padding: '0.75rem', boxSizing: 'border-box', marginBottom: '0.75rem',
            }}
          />
          <p style={{ margin: '-0.5rem 0 0.75rem', fontSize: '0.72rem', color: 'var(--muted)' }}>
            {t('pages.shiprun.apiKeyHint')}
          </p>

          {submitError && (
            <div style={{ color: '#DA2C38', fontSize: '0.78rem', marginBottom: '0.75rem' }}>{submitError}</div>
          )}
          {step && !submitError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted)', fontSize: '0.78rem', marginBottom: '0.75rem' }}>
              <div className="spinner" style={{ width: '14px', height: '14px' }} /> {step}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleSubmit}
              disabled={submitting || !apiKey.trim() || !gatewayConfigured}
              style={{
                padding: '0.55rem 1rem', borderRadius: '8px', cursor: submitting || !gatewayConfigured ? 'not-allowed' : 'pointer',
                background: submitting || !gatewayConfigured ? 'var(--border)' : 'var(--waf-brand)', color: '#fff', fontWeight: 700,
                fontSize: '0.8rem', border: 'none',
              }}
            >
              {submitting ? t('pages.shiprun.submitting') : t('pages.shiprun.submitBtn')}
            </button>
            <button
              onClick={() => { setSelectedRunId(null); setApiKey(''); setSubmitError(null) }}
              disabled={submitting}
              style={{
                padding: '0.55rem 1rem', borderRadius: '8px', cursor: submitting ? 'not-allowed' : 'pointer',
                background: 'var(--bg)', color: 'var(--muted)', fontWeight: 600,
                fontSize: '0.8rem', border: '1px solid var(--border)',
              }}
            >
              {t('common.cancel')}
            </button>
          </div>
        </Card>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        <Card>
          {loadingRuns ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '2rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
              <div className="spinner" style={{ width: '18px', height: '18px' }} /> {t('common.loading')}
            </div>
          ) : runsError ? (
            <div style={{ padding: '2rem', color: '#DA2C38', fontSize: '0.85rem' }}>{runsError}</div>
          ) : runs.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
              {t('pages.shiprun.noRuns')}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '1400px', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    {colHeaders.map(h => (
                      <th key={h} style={{
                        padding: '0.65rem 1rem', textAlign: 'left', fontSize: '0.7rem',
                        fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase',
                        letterSpacing: '0.05em', whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runs.map(r => (
                    <tr
                      key={r.id}
                      style={{
                        borderTop: '1px solid var(--border)',
                        background: selectedRunId === r.id ? 'var(--bg)' : undefined,
                      }}
                    >
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--waf-brand)' }}>{r.project || '—'}</div>
                        {r.git_sha && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'monospace', marginTop: '0.15rem' }}>
                            {r.git_sha.slice(0, 7)}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)' }}>{r.branch || '—'}</td>
                      <td style={{ padding: '0.75rem 1rem' }}><StageBadge stage={r.stage} /></td>
                      <td style={{ padding: '0.75rem 1rem' }}><ScoreBadge score={r.score} /></td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)', fontFamily: 'monospace', fontSize: '0.78rem' }}>{r.iac_framework}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)' }}>{r.triggered_by}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)' }}>
                        {r.controls_run > 0 ? `${r.controls_run} / ${r.controls_loaded}` : '—'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {fmtDate(r.created_at)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <button
                          onClick={() => handleSelectRun(r.id)}
                          disabled={!canSubmit || submitting}
                          style={{
                            padding: '0.35rem 0.7rem', borderRadius: '6px',
                            border: '1px solid var(--border)', background: selectedRunId === r.id ? 'var(--waf-brand)' : 'var(--bg)',
                            color: selectedRunId === r.id ? '#fff' : 'var(--waf-brand)', fontWeight: 600,
                            fontSize: '0.75rem', cursor: !canSubmit || submitting ? 'not-allowed' : 'pointer',
                            opacity: !canSubmit ? 0.6 : 1,
                          }}
                        >
                          {selectedRunId === r.id ? 'Selected' : t('pages.shiprun.actionValidate')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
