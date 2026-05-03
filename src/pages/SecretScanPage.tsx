import { useMemo, useState } from 'react'
import { RunDetail, Finding, SecretFinding } from '../api'
import { useI18n } from '../i18n'

interface Props { run: RunDetail }

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
  PASS: '#059669', FAIL: '#DA2C38', SKIP: '#94a3b8', WAIVED: '#a78bfa', ERROR: '#f97316',
}

// Patterns for identifying secrets-posture control findings
const SECRET_DOMAIN_RE = [
  /secret/i, /credential/i, /api[_.\s-]?key/i, /password/i,
  /private[_.\s-]?key/i, /access[_.\s-]?key/i, /token/i,
  /kms/i, /encrypt/i, /rotation/i, /vault/i,
]
const HARDCODED_RE = [/hardcod/i, /plaintext/i, /no.hardcoded/i]

function isSecretDomainFinding(f: Finding): boolean {
  const corpus = [f.control_id, f.check_id, f.check_title, f.message].join(' ')
  return SECRET_DOMAIN_RE.some(re => re.test(corpus))
}
function isHardcodedFinding(f: Finding): boolean {
  const corpus = [f.control_id, f.check_id, f.check_title, f.message].join(' ')
  return HARDCODED_RE.some(re => re.test(corpus)) || (f.control_id ?? '').toUpperCase().includes('SEC-060')
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SevBadge({ sev }: { sev: string }) {
  const s = (sev ?? 'INFO').toUpperCase()
  return (
    <span style={{
      fontSize: '0.62rem', fontWeight: 800, borderRadius: '4px', padding: '0.12rem 0.45rem',
      background: SEV_BG[s] ?? SEV_BG.INFO, color: SEV_COLOR[s] ?? SEV_COLOR.INFO,
      letterSpacing: '0.06em', flexShrink: 0,
    }}>{s}</span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s = (status ?? '').toUpperCase()
  const color = STATUS_COLOR[s] ?? '#94a3b8'
  return (
    <span style={{
      fontSize: '0.62rem', fontWeight: 700, borderRadius: '4px', padding: '0.12rem 0.45rem',
      background: `${color}18`, color, letterSpacing: '0.05em', flexShrink: 0,
    }}>{s}</span>
  )
}

// ── Raw secret scanner card ───────────────────────────────────────────────────

function RawSecretCard({ sf }: { sf: SecretFinding }) {
  const [open, setOpen] = useState(false)
  const sev = (sf.severity ?? 'HIGH').toUpperCase()
  const hasComments = (sf.comment_count ?? 0) > 0
  const commentCount = sf.comment_count ?? 0

  return (
    <div
      style={{
        borderRadius: '10px',
        border: '1px solid rgba(218,44,56,.30)',
        background: 'rgba(218,44,56,.025)',
        overflow: 'hidden', cursor: 'pointer',
      }}
      onClick={() => setOpen(o => !o)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem 0.875rem' }}>
        {/* Red stripe */}
        <div style={{ width: '4px', borderRadius: '2px', alignSelf: 'stretch', flexShrink: 0, minHeight: '28px', background: SEV_COLOR[sev] ?? '#DA2C38' }} />

        {/* Lock icon */}
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
          background: 'rgba(218,44,56,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="16" height="16" fill="none" stroke="#DA2C38" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
            <SevBadge sev={sf.severity} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#DA2C38' }}>{sf.pattern_name}</span>
            {hasComments && (
              <span style={{
                fontSize: '0.62rem',
                fontWeight: 700,
                borderRadius: '999px',
                padding: '0.05rem 0.4rem',
                background: 'rgba(0,148,255,.15)',
                color: '#0094ff',
              }}>
                {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
              </span>
            )}
          </div>
          {/* File + line */}
          <div style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sf.file}
            <span style={{ color: 'var(--muted)', fontWeight: 400 }}>:{sf.line_no}</span>
          </div>
          {/* Attribute + masked value */}
          <div style={{ marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {sf.matched_key && (
              <code style={{ fontSize: '0.72rem', background: 'rgba(218,44,56,.10)', color: '#DA2C38', borderRadius: '3px', padding: '0.1em 0.35em' }}>
                {sf.matched_key}
              </code>
            )}
            <code style={{ fontSize: '0.72rem', background: 'var(--bg)', color: 'var(--muted)', borderRadius: '3px', padding: '0.1em 0.35em', letterSpacing: '0.05em' }}>
              {sf.masked_value}
            </code>
          </div>
        </div>

        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ flexShrink: 0, opacity: 0.4, marginTop: '6px', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {open && (
        <div style={{ padding: '0 0.875rem 0.875rem 3.75rem', borderTop: '1px solid rgba(218,44,56,.15)', paddingTop: '0.75rem', background: 'var(--bg)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)', marginBottom: '0.2rem' }}>Pattern</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text)' }}>{sf.pattern_name}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)', marginBottom: '0.2rem' }}>Location</div>
              <code style={{ fontSize: '0.72rem', color: 'var(--text)' }}>{sf.file}:{sf.line_no}</code>
            </div>
          </div>
          <div style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(218,44,56,.07)', border: '1px solid rgba(218,44,56,.20)', fontSize: '0.75rem', color: '#DA2C38', lineHeight: 1.6 }}>
            <strong>Suppress this finding</strong> (use sparingly — add a justification comment):<br />
            <code style={{ fontSize: '0.7rem' }}>{'  '}{sf.matched_key || 'value'} = "..." <span style={{ opacity: 0.7 }}># wafpass:ignore-secret  reason: &lt;your justification&gt;</span></code>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Control-level finding card ────────────────────────────────────────────────

function ControlFindingCard({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false)
  const isFail = finding.status?.toUpperCase() === 'FAIL'
  const hasComments = (finding.comment_count ?? 0) > 0
  const commentCount = finding.comment_count ?? 0

  return (
    <div
      style={{
        borderRadius: '10px',
        border: isFail ? '1px solid rgba(218,44,56,.25)' : '1px solid var(--border)',
        background: 'var(--surface)', overflow: 'hidden', cursor: 'pointer',
      }}
      onClick={() => setOpen(o => !o)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.65rem 0.875rem' }}>
        <div style={{ width: '3px', borderRadius: '2px', alignSelf: 'stretch', flexShrink: 0, minHeight: '24px', background: isFail ? '#DA2C38' : '#059669' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
            <SevBadge sev={finding.severity} />
            <StatusBadge status={finding.status} />
            <span style={{ fontSize: '0.68rem', color: 'var(--muted)', fontFamily: 'monospace' }}>{finding.check_id}</span>
            {hasComments && (
              <span style={{
                fontSize: '0.62rem',
                fontWeight: 700,
                borderRadius: '999px',
                padding: '0.05rem 0.4rem',
                background: 'rgba(0,148,255,.15)',
                color: '#0094ff',
              }}>
                {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>{finding.check_title}</div>
          {finding.resource && (
            <div style={{ marginTop: '0.15rem', fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{finding.resource}</div>
          )}
        </div>
        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ flexShrink: 0, opacity: 0.4, marginTop: '4px', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {open && (
        <div style={{ padding: '0 0.875rem 0.75rem 2.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.625rem', background: 'var(--bg)' }}>
          {finding.message && <div style={{ fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.6, marginBottom: '0.5rem' }}>{finding.message}</div>}
          {finding.remediation && (
            <div>
              <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)', marginBottom: '0.2rem' }}>Remediation</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.6 }}>{finding.remediation}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Stat box ──────────────────────────────────────────────────────────────────

function StatBox({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div style={{
      flex: 1, minWidth: '100px', borderRadius: '10px', padding: '0.75rem 1rem',
      background: color ? `${color}0d` : 'var(--bg)',
      border: `1px solid ${color ? `${color}30` : 'var(--border)'}`,
    }}>
      <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: color ?? 'var(--muted)', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: color ?? 'var(--text)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: '0.2rem' }}>{sub}</div>}
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionLabel({ color, dot, children }: { color: string; dot?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color, display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
      {dot && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0 }} />}
      {children}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SecretScanPage({ run }: Props) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [sevFilter, setSevFilter] = useState('')

  // ── Raw scanner findings (the real thing) ──────────────────────────────────
  const rawSecrets = useMemo(() =>
    [...(run.secret_findings ?? [])].sort(
      (a, b) => (SEV_ORDER[a.severity?.toUpperCase()] ?? 9) - (SEV_ORDER[b.severity?.toUpperCase()] ?? 9)
    ), [run.secret_findings])

  const filteredRaw = useMemo(() =>
    rawSecrets.filter(sf =>
      (!sevFilter || sf.severity?.toUpperCase() === sevFilter) &&
      (!search || [sf.file, sf.pattern_name, sf.matched_key].join(' ').toLowerCase().includes(search.toLowerCase()))
    ), [rawSecrets, sevFilter, search])

  // ── Control-level findings for secrets posture ─────────────────────────────
  const postureFindings = useMemo(() =>
    run.findings
      .filter(f => isSecretDomainFinding(f) && !isHardcodedFinding(f))
      .sort((a, b) =>
        (SEV_ORDER[a.severity?.toUpperCase()] ?? 9) - (SEV_ORDER[b.severity?.toUpperCase()] ?? 9)
      ), [run.findings])

  const failPosture = postureFindings.filter(f => f.status?.toUpperCase() === 'FAIL')

  // ── Alarm state ────────────────────────────────────────────────────────────
  const critCount = rawSecrets.filter(s => s.severity?.toUpperCase() === 'CRITICAL').length
  const highCount = rawSecrets.filter(s => s.severity?.toUpperCase() === 'HIGH').length
  const hasAlarm = rawSecrets.length > 0 || failPosture.length > 0

  const selectStyle: React.CSSProperties = {
    background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.8rem', outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Alarm banner ── */}
      {hasAlarm && (
        <div style={{
          borderRadius: '14px', padding: '1.25rem 1.5rem',
          background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)',
          border: '1px solid rgba(239,68,68,.40)',
          boxShadow: '0 4px 24px rgba(218,44,56,.25)',
          display: 'flex', alignItems: 'center', gap: '1.25rem',
        }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '12px', flexShrink: 0,
            background: 'rgba(239,68,68,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="28" fill="none" stroke="#fca5a5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fef2f2', letterSpacing: '-0.01em' }}>
              {rawSecrets.length > 0
                ? t('pages.secretScan.alarmTitle', { count: String(rawSecrets.length) })
                : t('pages.secretScan.secretsIssue')}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#fca5a5', marginTop: '0.2rem' }}>
              {rawSecrets.length > 0
                ? <>
                    {critCount > 0 && <><strong>{critCount} CRITICAL</strong>{highCount > 0 ? ` · ${highCount} HIGH` : ''} · </>}
                    Hardcoded credentials are committed to version control and visible in git history forever. Rotate all affected secrets immediately.
                  </>
                : 'Secrets management controls are failing — credentials may not be properly protected at rest or in transit.'}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', flexShrink: 0, textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fef2f2', lineHeight: 1 }}>
              {rawSecrets.length || failPosture.length}
            </div>
            <div style={{ fontSize: '0.65rem', color: '#fca5a5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {rawSecrets.length > 0 ? 'Secrets' : 'Failures'}
            </div>
          </div>
        </div>
      )}

      {/* ── Clean banner ── */}
      {!hasAlarm && (
        <div style={{
          borderRadius: '14px', padding: '1.25rem 1.5rem',
          background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
          border: '1px solid rgba(16,185,129,.30)',
          display: 'flex', alignItems: 'center', gap: '1rem',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
            background: 'rgba(16,185,129,.20)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="26" height="26" fill="none" stroke="#6ee7b7" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ecfdf5' }}>{t('pages.secretScan.cleanTitle')}</div>
            <div style={{ fontSize: '0.78rem', color: '#6ee7b7', marginTop: '0.15rem' }}>
              The secret scanner found no hardcoded credentials in this run's IaC source files.
            </div>
          </div>
        </div>
      )}

      {/* ── Stats strip ── */}
      {(rawSecrets.length > 0 || postureFindings.length > 0) && (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <StatBox label={t('pages.secretScan.scannerHits')} value={rawSecrets.length}
            color={rawSecrets.length > 0 ? '#DA2C38' : undefined} sub="hardcoded in source" />
          <StatBox label={t('pages.secretScan.critical')} value={critCount} color={critCount > 0 ? '#DA2C38' : undefined} />
          <StatBox label={t('pages.secretScan.high')} value={highCount} color={highCount > 0 ? '#f97316' : undefined} />
          <StatBox label={t('pages.secretScan.postureFailures')} value={failPosture.length}
            color={failPosture.length > 0 ? '#d97706' : undefined} sub="control checks" />
          <StatBox label={t('pages.secretScan.postureChecks')} value={postureFindings.length} />
        </div>
      )}

      {/* ── Raw secret scanner section ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
          background: rawSecrets.length > 0 ? 'rgba(218,44,56,.03)' : undefined,
        }}>
          <svg width="15" height="15" fill="none" stroke={rawSecrets.length > 0 ? '#DA2C38' : 'var(--muted)'} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: rawSecrets.length > 0 ? '#DA2C38' : 'var(--text)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {t('pages.secretScan.hardcodedScanTitle')}
          </span>
          {rawSecrets.length > 0 && (
            <span style={{ fontSize: '0.68rem', fontWeight: 700, borderRadius: '999px', padding: '0.1rem 0.5rem', background: 'rgba(218,44,56,.15)', color: '#DA2C38' }}>
              {t('pages.secretScan.foundCount', { count: String(rawSecrets.length) })}
            </span>
          )}
          <div style={{ flex: 1 }} />
          {rawSecrets.length > 0 && (
            <>
              <input
                placeholder={t('pages.secretScan.filterPlaceholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...selectStyle, minWidth: '160px' }}
              />
              <select value={sevFilter} onChange={e => setSevFilter(e.target.value)} style={selectStyle}>
                <option value="">{t('pages.secretScan.allSeverities')}</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
              </select>
            </>
          )}
        </div>

        <div style={{ padding: '1rem' }}>
          {rawSecrets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--muted)', fontSize: '0.82rem' }}>
              <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ margin: '0 auto 0.5rem', opacity: 0.25, display: 'block' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              {t('pages.secretScan.noSecrets')}
              {run.secret_findings === undefined || (run.secret_findings as SecretFinding[] | null) === null
                ? <><br /><span style={{ fontSize: '0.75rem' }}>{t('pages.secretScan.updateCliHint')}</span></>
                : null}
            </div>
          ) : filteredRaw.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--muted)', fontSize: '0.82rem' }}>
              {t('pages.secretScan.noMatchFilter')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {filteredRaw.map((sf, i) => <RawSecretCard key={i} sf={sf} />)}
            </div>
          )}
        </div>
      </div>

      {/* ── Secrets posture (control findings) ── */}
      {postureFindings.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <svg width="15" height="15" fill="none" stroke="var(--muted)" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              {t('pages.secretScan.postureTitle')}
            </span>
            <span style={{ fontSize: '0.65rem', color: 'var(--muted)', marginLeft: '0.25rem' }}>
              {failPosture.length > 0 ? `${failPosture.length} failing · ` : ''}{postureFindings.length} total control checks
            </span>
          </div>
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {failPosture.length > 0 && <SectionLabel color="#DA2C38" dot>{t('pages.secretScan.failingLabel')}</SectionLabel>}
            {failPosture.map((f, i) => <ControlFindingCard key={`f-${i}`} finding={f} />)}
            {postureFindings.filter(f => f.status?.toUpperCase() !== 'FAIL').length > 0 && (
              <>
                <div style={{ height: '0.25rem' }} />
                <SectionLabel color="var(--muted)" dot>{t('pages.secretScan.passingLabel')}</SectionLabel>
                {postureFindings.filter(f => f.status?.toUpperCase() !== 'FAIL').map((f, i) => (
                  <ControlFindingCard key={`p-${i}`} finding={f} />
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Remediation reference ── */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)', marginBottom: '0.75rem' }}>
          {t('pages.secretScan.remediationRef')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
          {[
            { label: 'AWS · Secrets Manager', code: 'password = data.aws_secretsmanager_secret_version.db.secret_string' },
            { label: 'AWS · SSM Parameter Store', code: 'password = data.aws_ssm_parameter.db_pass.value' },
            { label: 'Azure · Key Vault', code: 'password = "@Microsoft.KeyVault(SecretUri=https://vault.vault.azure.net/secrets/db-pass/)"' },
            { label: 'GCP · Secret Manager', code: 'password = data.google_secret_manager_secret_version.db.secret_data' },
            { label: 'HashiCorp Vault', code: 'password = data.vault_generic_secret.db.data["password"]' },
            { label: 'Terraform variable (no default)', code: 'variable "db_password" {}\n# pass at runtime: TF_VAR_db_password=<value>' },
          ].map(({ label, code }) => (
            <div key={label} style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{ padding: '0.3rem 0.6rem', background: 'var(--bg)', fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
              <pre style={{ margin: 0, padding: '0.5rem 0.7rem', fontSize: '0.7rem', color: '#22c55e', background: '#0f172a', overflowX: 'auto', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {code}
              </pre>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'var(--bg)', border: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--text)' }}>Suppress a specific line</strong> (use sparingly — add a justification):<br />
          <code style={{ fontSize: '0.72rem' }}>{'  password = "..." # wafpass:ignore-secret  reason: non-sensitive test placeholder'}</code>
        </div>
      </div>
    </div>
  )
}
