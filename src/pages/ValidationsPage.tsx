/**
 * Validation Registry — official WAF++ PASS cryptographic validations.
 *
 * Lists server-side validations, shows envelope details, and provides
 * download links for the badge, certificate PDF, and root trust anchor.
 * Admins can revoke validations; anyone with an API key can submit a new
 * validation attestation for official countersignature.
 */
import { useEffect, useMemo, useState } from 'react'
import { useAuth, hasMinRole } from '../AuthContext'
import { useI18n } from '../i18n'
import { loadMaturityState, type ValidationMetadata } from './settingsUtils'
import {
  checkApiReachable,
  checkValidationGatewayReachable,
  createRunAttestation,
  fetchGatewayValidation,
  fetchGatewayValidationBadge,
  fetchRuns,
  fetchServerCertificate,
  getApiBase,
  getGatewayRootCertificateUrl,
  getGatewayValidationBadgeSvgUrl,
  getGatewayValidationCertificatePdfUrl,
  getServerCertificateUrl,
  getValidationGatewayBase,
  revokeValidation,
  submitValidation,
  VALIDATION_URL_KEY,
  type RunSummary,
  type ValidationBadge,
  type ValidationRecord,
  type ValidationGatewaySubmit,
} from '../api'

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  official:  { color: '#059669', bg: 'rgba(5,150,105,0.09)' },
  active:    { color: '#059669', bg: 'rgba(5,150,105,0.09)' },
  revoked:   { color: '#DA2C38', bg: 'rgba(218,44,56,0.09)' },
  offline:   { color: '#b45309', bg: 'rgba(180,83,9,0.09)' },
}

function fmtDate(iso: string | undefined | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

function statusPill(status: string) {
  const s = status.toLowerCase()
  const { color, bg } = STATUS_COLORS[s] ?? { color: '#64748b', bg: 'rgba(100,116,139,0.09)' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
      padding: '0.25rem 0.6rem', borderRadius: '999px',
      background: bg, color, fontWeight: 700, fontSize: '0.72rem',
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
      {status}
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '1.75rem' }}>
      <h3 style={{
        fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.75rem',
      }}>{title}</h3>
      {children}
    </section>
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

function MonoRow({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '1rem', padding: '0.55rem 0', borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: '0.78rem', color: 'var(--muted)', flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
        <code style={{
          fontSize: '0.75rem', color: 'var(--text)', background: 'var(--bg)',
          padding: '0.2rem 0.45rem', borderRadius: '5px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={value}>{value}</code>
        {copy && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(value).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }).catch(() => {})
            }}
            style={{
              flexShrink: 0, padding: '0.25rem 0.45rem', borderRadius: '5px',
              border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer',
              fontSize: '0.65rem', fontWeight: 600, color: copied ? '#059669' : 'var(--muted)',
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  )
}

const provenanceTagStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
  padding: '0.25rem 0.5rem', borderRadius: '6px',
  background: 'var(--bg)', border: '1px solid var(--border)',
  fontSize: '0.72rem', color: 'var(--text)',
}

const smallBtnStyle: React.CSSProperties = {
  padding: '0.25rem 0.5rem', borderRadius: '5px',
  border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer',
  fontSize: '0.65rem', fontWeight: 600, color: 'var(--muted)',
}

function CertificateRow({ cert, index, total }: { cert: string; index: number; total: number }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const isRoot = index === total - 1
  const label = isRoot
    ? t('pages.validations.certRoot')
    : index === 0
      ? t('pages.validations.certServer')
      : t('pages.validations.certIntermediate', { n: index })

  const lines = cert.trim().split('\n')
  const firstLine = lines[0] ?? ''
  const preview = firstLine.slice(0, 70) + (firstLine.length > 70 || lines.length > 1 ? '…' : '')

  function handleCopy() {
    navigator.clipboard.writeText(cert).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  function handleDownload() {
    const blob = new Blob([cert], { type: 'application/x-pem-file' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${isRoot ? 'root' : index === 0 ? 'server' : `intermediate-${index}`}.crt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: '0.55rem 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.35rem' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button onClick={() => setOpen(!open)} style={smallBtnStyle}>
            {open ? t('pages.validations.hideFull') : t('pages.validations.viewFull')}
          </button>
          <button onClick={handleCopy} style={smallBtnStyle}>
            {copied ? t('common.copied') : t('common.copy')}
          </button>
          <button onClick={handleDownload} style={smallBtnStyle}>
            {t('common.download')}
          </button>
        </div>
      </div>
      <code style={{
        display: 'block', fontSize: '0.75rem', color: 'var(--text)', background: 'var(--bg)',
        padding: '0.2rem 0.45rem', borderRadius: '5px', overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }} title={cert}>{preview}</code>
      {open && (
        <pre style={{
          margin: '0.5rem 0 0', padding: '0.6rem 0.75rem', background: '#0f172a', color: '#e2e8f0',
          borderRadius: '8px', fontSize: '0.68rem', lineHeight: 1.55, overflowX: 'auto',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>{cert}</pre>
      )}
    </div>
  )
}

function ConnectionBanner() {
  const { t } = useI18n()
  const [apiReachable, setApiReachable] = useState<boolean | null>(null)
  const [gatewayReachable, setGatewayReachable] = useState<boolean | null>(null)
  const [gatewayUrl, setGatewayUrl] = useState(() => {
    try { return localStorage.getItem(VALIDATION_URL_KEY) ?? '' } catch { return '' }
  })

  useEffect(() => {
    let cancelled = false
    checkApiReachable().then(ok => { if (!cancelled) setApiReachable(ok) })
    checkValidationGatewayReachable().then(ok => { if (!cancelled) setGatewayReachable(ok) })
    return () => { cancelled = true }
  }, [gatewayUrl])

  const apiBase = getApiBase() || '(not configured)'
  const gatewayBase = getValidationGatewayBase() || '(not configured)'
  const hasGatewayConfigured = Boolean(getValidationGatewayBase())

  // All good: server reachable and either no gateway configured or gateway reachable.
  if (apiReachable === true && (!hasGatewayConfigured || gatewayReachable === true)) return null

  function saveGatewayUrl(url: string) {
    const trimmed = url.trim().replace(/\/$/, '')
    setGatewayUrl(trimmed)
    try { localStorage.setItem(VALIDATION_URL_KEY, trimmed) } catch {}
  }

  return (
    <div style={{
      marginBottom: '1.25rem', padding: '1rem 1.25rem', borderRadius: '12px',
      background: 'rgba(218,44,56,0.08)', border: '1px solid rgba(218,44,56,0.25)',
      color: 'var(--text)', fontSize: '0.82rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', fontWeight: 700 }}>
        <span style={{ color: '#DA2C38' }}>⚠</span>
        {t('pages.validations.connectionIssueTitle')}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.75rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
        <div>
          <strong style={{ color: 'var(--text)' }}>{t('pages.validations.serverLabel')}</strong>{' '}
          <code style={{ fontSize: '0.72rem' }}>{apiBase}</code>{' '}
          <span>{apiReachable === null ? t('pages.validations.checking') : apiReachable ? '✓' : '✗'}</span>
        </div>
        <div>
          <strong style={{ color: 'var(--text)' }}>{t('pages.validations.gatewayLabel')}</strong>{' '}
          <code style={{ fontSize: '0.72rem' }}>{gatewayBase}</code>{' '}
          <span>{gatewayReachable === null ? t('pages.validations.checking') : gatewayReachable ? '✓' : '✗'}</span>
        </div>
      </div>

      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
          {t('pages.validations.gatewayUrlInputLabel')}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={gatewayUrl}
            onChange={e => setGatewayUrl(e.target.value)}
            onBlur={e => saveGatewayUrl(e.target.value)}
            placeholder="http://localhost:8001"
            style={{
              flex: 1, padding: '0.45rem 0.7rem', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)',
              fontSize: '0.78rem',
            }}
          />
          <button
            onClick={() => saveGatewayUrl(gatewayUrl)}
            style={{
              padding: '0.45rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--text)', fontSize: '0.78rem', cursor: 'pointer',
            }}
          >
            {t('common.save')}
          </button>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.35rem' }}>
          {t('pages.validations.gatewayUrlHint')}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
        <a href="#/settings" style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
          padding: '0.45rem 0.75rem', borderRadius: '8px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          color: 'var(--waf-brand)', fontSize: '0.78rem', fontWeight: 600,
          textDecoration: 'none',
        }}>
          {t('pages.validations.openSettings')}
        </a>
        <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
          {t('pages.validations.localOnlyHint')}
        </span>
      </div>
    </div>
  )
}

function SubmitPanel({ onSubmitted }: { onSubmitted: (id: string) => void }) {
  const { t } = useI18n()
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [selectedRunId, setSelectedRunId] = useState('')
  const [loadingRuns, setLoadingRuns] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<string | null>(null)
  const [provenance, setProvenance] = useState<ValidationMetadata>({})

  useEffect(() => {
    const { settings } = loadMaturityState()
    setProvenance(settings.validationMetadata ?? {})
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoadingRuns(true)
    fetchRuns({ limit: 50 }).then(page => {
      if (cancelled) return
      setRuns(page.items)
      setLoadingRuns(false)
    }).catch((e: Error) => {
      if (cancelled) return
      setError(e.message)
      setLoadingRuns(false)
    })
    return () => { cancelled = true }
  }, [])

  async function handleSubmit() {
    setError(null)
    setStep(null)
    if (!selectedRunId) {
      setError(t('pages.validations.selectRunRequired'))
      return
    }
    if (!apiKey.trim()) {
      setError(t('pages.validations.apiKeyRequired'))
      return
    }
    setLoading(true)
    try {
      const { settings } = loadMaturityState()
      const meta = settings.validationMetadata ?? {}

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
        metadata: {
          organization: meta.organization?.trim() || undefined,
          environment: meta.environment?.trim() || undefined,
          validated_by: meta.validatedBy?.trim() || undefined,
          notes: meta.notes?.trim() || undefined,
        },
      }

      setStep('Submitting to validation gateway…')
      const record = await submitValidation(payload, apiKey.trim())
      onSubmitted(record.validation_id)
      setSelectedRunId('')
      setApiKey('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Submit failed')
    } finally {
      setStep(null)
      setLoading(false)
    }
  }

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <svg width="18" height="18" fill="none" stroke="var(--waf-brand)" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.95rem' }}>{t('pages.validations.requestPanelTitle')}</span>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0 0 0.75rem' }}>
        {t('pages.validations.requestPanelHint')}
      </p>
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
      <div style={{ marginBottom: '0.75rem' }}>
        {loadingRuns ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted)', fontSize: '0.8rem' }}>
            <div className="spinner" style={{ width: '14px', height: '14px' }} /> {t('pages.validations.loadingRuns')}
          </div>
        ) : (
          <select
            value={selectedRunId}
            onChange={e => setSelectedRunId(e.target.value)}
            style={{
              width: '100%', fontSize: '0.82rem',
              background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
              borderRadius: '8px', padding: '0.6rem 0.75rem', boxSizing: 'border-box',
            }}
          >
            <option value="">{t('pages.validations.selectRunPlaceholder')}</option>
            {runs.map(run => (
              <option key={run.id} value={run.id}>
                {t('pages.validations.runOptionLabel', {
                  project: run.project,
                  branch: run.branch,
                  score: run.score,
                  date: new Date(run.created_at).toLocaleString(),
                })}
              </option>
            ))}
          </select>
        )}
      </div>
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
          {t('pages.validations.metadataTitle')}
        </div>
        {Object.values(provenance).some(Boolean) ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {provenance.organization && (
              <span style={provenanceTagStyle}><strong>{t('pages.validations.metaOrganization')}:</strong> {provenance.organization}</span>
            )}
            {provenance.environment && (
              <span style={provenanceTagStyle}><strong>{t('pages.validations.metaEnvironment')}:</strong> {provenance.environment}</span>
            )}
            {provenance.validatedBy && (
              <span style={provenanceTagStyle}><strong>{t('pages.validations.metaValidatedBy')}:</strong> {provenance.validatedBy}</span>
            )}
            {provenance.notes && (
              <span style={provenanceTagStyle}><strong>{t('pages.validations.metaNotes')}:</strong> {provenance.notes}</span>
            )}
          </div>
        ) : (
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
            {t('pages.validations.noMetadataHint')}
          </div>
        )}
        <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.35rem' }}>
          {t('pages.validations.metadataHint')}
        </div>
      </div>
      {error && (
        <div style={{ color: '#DA2C38', fontSize: '0.78rem', marginBottom: '0.75rem' }}>{error}</div>
      )}
      {step && !error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted)', fontSize: '0.78rem', marginBottom: '0.75rem' }}>
          <div className="spinner" style={{ width: '14px', height: '14px' }} /> {step}
        </div>
      )}
      <button
        onClick={handleSubmit}
        disabled={loading || !selectedRunId || !apiKey.trim()}
        style={{
          padding: '0.55rem 1rem', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer',
          background: loading ? 'var(--border)' : 'var(--waf-brand)', color: '#fff', fontWeight: 700,
          fontSize: '0.8rem', border: 'none',
        }}
      >
        {loading ? t('common.saving') : t('pages.validations.submitBtn')}
      </button>
      <div style={{ marginTop: '0.75rem', fontSize: '0.72rem', color: 'var(--muted)' }}>
        {t('pages.validations.serverCertLink')} <a href={getServerCertificateUrl()} download style={{ color: 'var(--waf-brand)' }}>wafpass-server.crt</a>
      </div>
    </Card>
  )
}

function DetailPanel({
  id,
  onClose,
  role,
}: {
  id: string
  onClose: () => void
  role: string
}) {
  const { t } = useI18n()
  const [record, setRecord] = useState<ValidationRecord | null>(null)
  const [badge, setBadge] = useState<ValidationBadge | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revoking, setRevoking] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([fetchGatewayValidation(id), fetchGatewayValidationBadge(id)]).then(([r, b]) => {
      if (cancelled) return
      setRecord(r)
      // Gateway badge.json is shields.io-style and may lack run/project details.
      // Fill in anything missing from the verification record so the summary is useful.
      if (r && b && (!b.signer_public_key || b.signer_public_key === r.server_public_key)) {
        setBadge({
          ...b,
          status: b.status || r.status,
          run_hash: b.run_hash || r.canonical_hash,
          score: b.score ?? r.score ?? (typeof r.metadata?.score === 'number' ? r.metadata.score as number : null),
          project: b.project || r.project,
          branch: b.branch || r.branch,
          git_sha: b.git_sha || r.git_sha,
          validation_id: b.validation_id || r.validation_id,
          validated_at: b.validated_at || r.validated_at,
          signer_public_key: b.signer_public_key || r.server_public_key,
          metadata: { ...(b.metadata || {}), ...(r.metadata || {}) },
        })
      } else {
        setBadge(b)
      }
      setLoading(false)
    }).catch((e: Error) => {
      if (cancelled) return
      setError(e.message)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [id])

  async function handleRevoke() {
    if (!confirm(t('pages.validations.revokeConfirm'))) return
    setRevoking(true)
    try {
      await revokeValidation(id)
      const refreshed = await fetchGatewayValidation(id)
      setRecord(refreshed)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Revoke failed')
    } finally {
      setRevoking(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '16px',
          width: '100%', maxWidth: '760px', maxHeight: '90vh', overflow: 'auto',
          boxShadow: '0 20px 60px rgba(15,23,42,0.25)', padding: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text)' }}>Validation {shortId(id)}</h2>
            {record && statusPill(record.status)}
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.2rem',
          }}>✕</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" /></div>
        ) : error ? (
          <div style={{ color: '#DA2C38', fontSize: '0.85rem' }}>{error}</div>
        ) : !record ? (
          <div style={{ color: 'var(--muted)' }}>{t('pages.validations.notFound')}</div>
        ) : (
          <>
            <Section title={t('pages.validations.runIdentity')}>
              <Card>
                <MonoRow label="Validation ID" value={record.validation_id} />
                <MonoRow label="Run hash" value={record.canonical_hash} copy />
                <MonoRow label={t('pages.validations.colProject')} value={record.project || '—'} />
                <MonoRow label={t('pages.validations.colBranch')} value={record.branch || '—'} />
                <MonoRow label={t('pages.validations.colGitSha')} value={record.git_sha || '—'} />
                <MonoRow label="Validated at" value={fmtDate(record.validated_at)} />
                {record.expires_at && <MonoRow label="Expires at" value={fmtDate(record.expires_at)} />}
              </Card>
            </Section>

            {record.metadata && Object.keys(record.metadata).length > 0 && (
              <Section title={t('pages.validations.metadataSectionTitle')}>
                <Card>
                  {Boolean(record.metadata.organization) && (
                    <MonoRow label={t('pages.validations.metaOrganization')} value={String(record.metadata.organization)} />
                  )}
                  {Boolean(record.metadata.environment) && (
                    <MonoRow label={t('pages.validations.metaEnvironment')} value={String(record.metadata.environment)} />
                  )}
                  {Boolean(record.metadata.validated_by) && (
                    <MonoRow label={t('pages.validations.metaValidatedBy')} value={String(record.metadata.validated_by)} />
                  )}
                  {Boolean(record.metadata.notes) && (
                    <div style={{ padding: '0.55rem 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.35rem' }}>{t('pages.validations.metaNotes')}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{String(record.metadata.notes)}</div>
                    </div>
                  )}
                </Card>
              </Section>
            )}

            <Section title={t('pages.validations.cryptoProof')}>
              <Card>
                <MonoRow label="Server public key" value={record.server_public_key} copy />
                <MonoRow label="Server signature" value={record.server_signature} copy />
                {record.certificate_chain.map((cert, i) => (
                  <CertificateRow
                    key={i}
                    cert={cert}
                    index={i}
                    total={record.certificate_chain.length}
                  />
                ))}
              </Card>
            </Section>

            <Section title={t('pages.validations.publicArtifacts')}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                <a href={record.verification_url} target="_blank" rel="noreferrer" style={linkBtnStyle()}>
                  {t('pages.validations.verificationUrl')}
                </a>
                <a href={record.badge_url} target="_blank" rel="noreferrer" style={linkBtnStyle()}>
                  {t('pages.validations.badgeSvg')}
                </a>
                <a href={getGatewayValidationBadgeSvgUrl(record.validation_id)} target="_blank" rel="noreferrer" style={linkBtnStyle()}>
                  {t('pages.validations.rawSvg')}
                </a>
                <a href={getGatewayValidationCertificatePdfUrl(record.validation_id)} target="_blank" rel="noreferrer" style={linkBtnStyle()}>
                  {t('pages.validations.certificatePdf')}
                </a>
                <a href={getGatewayRootCertificateUrl()} download style={linkBtnStyle()}>
                  {t('pages.validations.rootCa')}
                </a>
              </div>
              {badge && (
                <div style={{
                  marginTop: '1rem', padding: '0.875rem 1rem', background: 'var(--surface)',
                  border: '1px solid var(--border)', borderRadius: '10px',
                }}>
                  <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                    <span><strong>Status:</strong> {badge.status}</span>
                    <span><strong>Score:</strong> {badge.score ?? '—'}%</span>
                    <span><strong>Signer key:</strong> <code title={badge.signer_public_key}>{badge.signer_public_key.slice(0, 20)}…</code></span>
                  </div>
                  {badge.metadata && Object.keys(badge.metadata).length > 0 && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--muted)' }}>
                      {Boolean(badge.metadata.organization) && <span><strong>{t('pages.validations.metaOrganization')}:</strong> {String(badge.metadata.organization)}</span>}
                      {Boolean(badge.metadata.environment) && <span><strong>{t('pages.validations.metaEnvironment')}:</strong> {String(badge.metadata.environment)}</span>}
                      {Boolean(badge.metadata.validated_by) && <span><strong>{t('pages.validations.metaValidatedBy')}:</strong> {String(badge.metadata.validated_by)}</span>}
                    </div>
                  )}
                </div>
              )}
            </Section>

            {hasMinRole(role, 'admin') && record.status !== 'revoked' && record.metadata?.gateway_source !== true && (
              <Section title={t('pages.validations.adminTitle')}>
                <button
                  onClick={handleRevoke}
                  disabled={revoking}
                  style={{
                    padding: '0.55rem 1rem', borderRadius: '8px', border: '1px solid #DA2C38',
                    background: 'rgba(218,44,56,0.08)', color: '#DA2C38', fontWeight: 700,
                    fontSize: '0.8rem', cursor: revoking ? 'not-allowed' : 'pointer',
                  }}
                >
                  {revoking ? t('common.saving') : t('pages.validations.revokeBtn')}
                </button>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function linkBtnStyle(): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.45rem 0.75rem', borderRadius: '8px',
    background: 'var(--surface)', border: '1px solid var(--border)',
    color: 'var(--waf-brand)', fontSize: '0.78rem', fontWeight: 600,
    textDecoration: 'none',
  }
}

export default function ValidationsPage() {
  const { t } = useI18n()
  const { role } = useAuth()
  const [ids, setIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('wafpass_validations') ?? '[]') as string[]
    } catch {
      return []
    }
  })
  const [selected, setSelected] = useState<string | null>(null)
  const [records, setRecords] = useState<Record<string, ValidationRecord | null>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [trackId, setTrackId] = useState('')

  // Persist known validation IDs to localStorage so repeat visits show history.
  useEffect(() => {
    localStorage.setItem('wafpass_validations', JSON.stringify(ids))
  }, [ids])

  // Load details for all known IDs.
  useEffect(() => {
    if (ids.length === 0) return
    setLoading(true)
    setError(null)
    Promise.all(ids.map(id => fetchGatewayValidation(id).catch(() => null))).then(results => {
      const map: Record<string, ValidationRecord | null> = {}
      ids.forEach((id, i) => { map[id] = results[i] })
      setRecords(map)
      setLoading(false)
    }).catch((e: Error) => {
      setError(e.message)
      setLoading(false)
    })
  }, [ids])

  function trackValidation(id: string) {
    const trimmed = id.trim()
    if (!trimmed) return
    if (!ids.includes(trimmed)) {
      setIds([trimmed, ...ids])
    }
    setSelected(trimmed)
    setTrackId('')
  }

  function handleSubmitted(newId: string) {
    if (!ids.includes(newId)) {
      setIds([newId, ...ids])
    }
    setSelected(newId)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return ids.filter(id => {
      const r = records[id]
      if (!q) return true
      return r && (
        r.validation_id.toLowerCase().includes(q) ||
        r.project.toLowerCase().includes(q) ||
        r.branch.toLowerCase().includes(q) ||
        r.git_sha.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      )
    })
  }, [ids, records, search])

  const canSubmit = hasMinRole(role ?? 'clevel', 'clevel')

  return (
    <div style={{ padding: '1.25rem 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      <ConnectionBanner />

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.4rem', color: 'var(--text)' }}>
            {t('pages.validations.title')}
          </h1>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)' }}>
            {t('pages.validations.subtitle')}
          </p>
        </div>
        <a href={getGatewayRootCertificateUrl()} download style={linkBtnStyle()}>
          Download WAF++ Root CA
        </a>
      </div>

      {canSubmit && (
        <div style={{ marginBottom: '1.5rem' }}>
          <SubmitPanel onSubmitted={handleSubmitted} />
        </div>
      )}

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by ID, project, branch, status…"
            style={{
              flex: 1, minWidth: '200px', padding: '0.5rem 0.75rem', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)',
              fontSize: '0.82rem',
            }}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            {filtered.length} of {ids.length} known
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            value={trackId}
            onChange={e => setTrackId(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') trackValidation(trackId) }}
            placeholder="Track an existing validation ID…"
            style={{
              flex: 1, padding: '0.5rem 0.75rem', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)',
              fontSize: '0.82rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          />
          <button
            onClick={() => trackValidation(trackId)}
            style={{
              padding: '0.5rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--waf-brand)', fontWeight: 600,
              fontSize: '0.78rem', cursor: 'pointer',
            }}
          >
            Track
          </button>
        </div>

        {loading && ids.length > 0 && (
          <div style={{ textAlign: 'center', padding: '1.5rem' }}><div className="spinner" /></div>
        )}

        {error && (
          <div style={{ color: '#DA2C38', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>
        )}

        {!loading && ids.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
            {t('pages.validations.noValidations')}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {[t('pages.validations.colStatus'), t('pages.validations.colProject'), t('pages.validations.colBranch'), t('pages.validations.colGitSha'), t('pages.validations.colValidated'), t('pages.validations.colAction')].map(h => (
                    <th key={h} style={{
                      padding: '0.55rem 0.75rem', textAlign: 'left',
                      fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(id => {
                  const r = records[id]
                  return (
                    <tr key={id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        {r ? statusPill(r.status) : <span style={{ color: 'var(--muted)' }}>loading…</span>}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text)', fontWeight: 600 }}>{r?.project || '—'}</td>
                      <td style={{ padding: '0.6rem 0.75rem', color: 'var(--text)' }}>{r?.branch || '—'}</td>
                      <td style={{ padding: '0.6rem 0.75rem', color: 'var(--muted)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {r?.git_sha ? shortId(r.git_sha) : '—'}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', color: 'var(--muted)', fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
                        {r ? fmtDate(r.validated_at) : '—'}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem' }}>
                        <button
                          onClick={() => setSelected(id)}
                          style={{
                            padding: '0.35rem 0.7rem', borderRadius: '6px', border: '1px solid var(--border)',
                            background: 'var(--bg)', color: 'var(--waf-brand)', fontWeight: 600,
                            fontSize: '0.75rem', cursor: 'pointer',
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <DetailPanel id={selected} onClose={() => setSelected(null)} role={role ?? 'clevel'} />
      )}

      {!canSubmit && (
        <div style={{ marginTop: '1.25rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
          {t('pages.validations.roleRequired')}
        </div>
      )}
    </div>
  )
}
