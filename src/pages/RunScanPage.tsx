import { useState, useEffect } from 'react'
import { getApiBase, fetchScanStatus, triggerScan, type ScanStatus, type RunSummary } from '../api'
import { useI18n } from '../i18n'

function getServerUrl(): string {
  const base = getApiBase().trim().replace(/\/$/, '')
  return base || 'http://localhost:8000'
}

function CopyBlock({ code, lang = '' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <div style={{ position: 'relative' }}>
      <pre style={{
        background: '#0b1220', color: '#e2e8f0', borderRadius: '12px',
        padding: lang ? '1.75rem 3.25rem 1rem 1rem' : '1rem 3.25rem 1rem 1rem',
        fontSize: '0.8rem', overflowX: 'auto', lineHeight: 1.7, margin: 0,
        whiteSpace: 'pre', border: '1px solid rgba(148,163,184,.15)',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.2)',
      }}>
        {lang && <span style={{ position: 'absolute', top: '0.55rem', left: '0.9rem', fontSize: '0.62rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{lang}</span>}
        {code}
      </pre>
      <button onClick={copy} style={{
        position: 'absolute', top: '0.65rem', right: '0.65rem',
        background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)',
        borderRadius: '6px', color: copied ? '#22c55e' : '#94a3b8',
        fontSize: '0.68rem', fontWeight: 600, padding: '0.25rem 0.6rem', cursor: 'pointer',
        transition: 'all .15s',
      }}>
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}

const FRAMEWORKS = [
  { value: 'terraform', label: 'Terraform' },
  { value: 'cdk', label: 'AWS CDK' },
  { value: 'pulumi', label: 'Pulumi' },
  { value: 'bicep', label: 'Bicep' },
  { value: 'cfn', label: 'CloudFormation' },
]

function FrameworkSelect({ value, onChange, disabled = false }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      style={{
        background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)',
        borderRadius: '10px', padding: '0.5rem 0.75rem', fontSize: '0.82rem', outline: 'none',
      }}
    >
      {FRAMEWORKS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
    </select>
  )
}

function StatusBadge({ status, t }: { status: ScanStatus | null; t: (key: string) => string }) {
  const ready = status?.enabled && status?.engine_available && status?.controls_dir_exists
  const dotColor = status == null ? '#94a3b8' : ready ? '#22c55e' : '#f59e0b'
  const label = status == null ? t('pages.scan.checking') : ready ? t('pages.scan.ready') : t('pages.scan.unavailable')
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
      padding: '0.35rem 0.7rem', borderRadius: '999px',
      background: 'var(--surface)', border: '1px solid var(--border)',
      fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      {label}
    </div>
  )
}

function PathCard({
  active, icon, title, desc, badge, onClick,
}: {
  active: boolean
  icon: string
  title: string
  desc: string
  badge?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, minWidth: '220px',
        padding: '1.25rem 1.5rem', borderRadius: '16px',
        background: active ? 'var(--surface)' : 'var(--bg)',
        border: active ? '2px solid var(--waf-brand)' : '1px solid var(--border)',
        boxShadow: active ? '0 8px 28px rgba(0,148,255,.12)' : 'var(--shadow-sm)',
        cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = 'rgba(0,148,255,.4)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <svg width="24" height="24" fill="none" stroke={active ? 'var(--waf-brand)' : 'var(--muted)'} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={icon} />
        </svg>
        {badge && (
          <span style={{
            fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
            padding: '0.15rem 0.45rem', borderRadius: '999px',
            background: 'rgba(0,148,255,.12)', color: 'var(--waf-brand)',
          }}>{badge}</span>
        )}
      </div>
      <div>
        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.25rem' }}>{title}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.55 }}>{desc}</div>
      </div>
    </button>
  )
}

function Input({
  value, onChange, placeholder, label, disabled = false, hint,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  label: string
  disabled?: boolean
  hint?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1, minWidth: '160px' }}>
      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)',
          borderRadius: '10px', padding: '0.55rem 0.75rem', fontSize: '0.82rem', outline: 'none',
          opacity: disabled ? 0.6 : 1,
        }}
      />
      {hint && <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{hint}</div>}
    </div>
  )
}

function ServerScanPanel() {
  const { t } = useI18n()
  const [status, setStatus] = useState<ScanStatus | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  const [scanPath, setScanPath] = useState('')
  const [scanIac, setScanIac] = useState('terraform')
  const [scanProject, setScanProject] = useState('')
  const [scanBranch, setScanBranch] = useState('')
  const [scanStage, setScanStage] = useState('')

  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunSummary | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  useEffect(() => {
    fetchScanStatus()
      .then(setStatus)
      .catch(e => setStatusError(String(e)))
  }, [])

  async function handleScan() {
    setRunning(true)
    setResult(null)
    setRunError(null)
    try {
      const r = await triggerScan({
        path: scanPath,
        iac: scanIac,
        project: scanProject || undefined,
        branch: scanBranch || undefined,
        stage: scanStage || undefined,
        triggered_by: 'ui',
      })
      setResult(r)
    } catch (e) {
      setRunError(String(e))
    } finally {
      setRunning(false)
    }
  }

  const ready = status?.enabled && status?.engine_available && status?.controls_dir_exists

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <StatusBadge status={status} t={t} />
        {status && !ready && !statusError && (
          <div style={{
            flex: 1, minWidth: '240px', padding: '0.5rem 0.75rem', borderRadius: '8px',
            background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)',
            fontSize: '0.75rem', color: '#f59e0b',
          }}>
            {!status.enabled && 'Server-side scanning is disabled (WAFPASS_SCAN_ENABLED=false). '}
            {status.enabled && !status.engine_available && 'wafpass-core is not installed on the server. Run: pip install wafpass-core. '}
            {status.enabled && status.engine_available && !status.controls_dir_exists && `Controls directory not found on server: ${status.controls_dir}. Set WAFPASS_CONTROLS_DIR. `}
          </div>
        )}
      </div>

      {statusError && (
        <div style={{
          padding: '0.6rem 0.85rem', borderRadius: '8px',
          background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)',
          fontSize: '0.78rem', color: '#ef4444',
        }}>
          Could not reach server: {statusError}
        </div>
      )}

      {status && (
        <div style={{
          display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--muted)',
        }}>
          {[
            ['Engine', status.engine_available ? '✓ wafpass-core' : '✗ not installed'],
            ['Controls dir', status.controls_dir_exists ? '✓ found' : '✗ missing'],
            ...(status.scan_base_dir ? [['Base dir', status.scan_base_dir]] : []),
          ].map(([k, v]) => (
            <div key={k} style={{
              padding: '0.25rem 0.65rem', borderRadius: '6px',
              background: 'var(--bg)', border: '1px solid var(--border)',
            }}>
              <span style={{ fontWeight: 700 }}>{k}:</span> {v}
            </div>
          ))}
        </div>
      )}

      <div style={{
        padding: '1.25rem', borderRadius: '14px',
        background: 'var(--bg)', border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <Input
            label={t('pages.scan.iacPathLabel')}
            value={scanPath}
            onChange={setScanPath}
            placeholder="/srv/iac/my-infra"
            disabled={!ready}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('pages.scan.frameworkLabel')}</label>
            <FrameworkSelect value={scanIac} onChange={setScanIac} disabled={!ready} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <Input label={t('pages.scan.projectLabel')} value={scanProject} onChange={setScanProject} placeholder="my-service" disabled={!ready} />
          <Input label={t('pages.scan.branchLabel')} value={scanBranch} onChange={setScanBranch} placeholder="main" disabled={!ready} />
          <Input label={t('pages.scan.stageLabel')} value={scanStage} onChange={setScanStage} placeholder="dev | staging | prod" disabled={!ready} />
        </div>

        <button
          onClick={handleScan}
          disabled={!ready || running || !scanPath.trim()}
          style={{
            padding: '0.6rem 1.5rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 700,
            background: ready && !running && scanPath.trim() ? 'var(--waf-brand)' : 'var(--surface)',
            color: ready && !running && scanPath.trim() ? '#fff' : 'var(--muted)',
            border: '1px solid', borderColor: ready && !running && scanPath.trim() ? 'var(--waf-brand)' : 'var(--border)',
            cursor: ready && !running && scanPath.trim() ? 'pointer' : 'default',
            transition: 'all .15s', boxShadow: ready && !running && scanPath.trim() ? '0 4px 14px rgba(0,148,255,.25)' : 'none',
          }}
        >
          {running ? t('pages.scan.scanning') : t('pages.scan.runScan')}
        </button>
      </div>

      {runError && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: '8px',
          background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)',
          fontSize: '0.78rem', color: '#ef4444',
        }}>{runError}</div>
      )}

      {result && (
        <div style={{
          padding: '1rem 1.25rem', borderRadius: '14px',
          background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.25)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <svg width="18" height="18" fill="none" stroke="#22c55e" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#22c55e' }}>{t('pages.scan.scanComplete')}</div>
          </div>
          <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--muted)' }}>
            <div><span style={{ fontWeight: 700 }}>{t('pages.scan.scoreLabel')}</span>{' '}
              <span style={{ color: result.score >= 80 ? '#22c55e' : result.score >= 50 ? '#f59e0b' : '#ef4444', fontWeight: 800 }}>{result.score}%</span>
            </div>
            <div><span style={{ fontWeight: 700 }}>{t('pages.scan.controlsRunLabel')}</span> {result.controls_run}</div>
            {result.project && <div><span style={{ fontWeight: 700 }}>Project:</span> {result.project}</div>}
            {result.stage && <div><span style={{ fontWeight: 700 }}>Stage:</span> {result.stage}</div>}
          </div>
        </div>
      )}

      <div style={{
        padding: '0.85rem 1rem', borderRadius: '10px',
        background: 'rgba(0,148,255,.05)', border: '1px solid rgba(0,148,255,.15)',
        fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.6,
      }}>
        The server runs <code style={{ color: 'var(--text)', background: 'var(--surface)', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.72rem' }}>wafpass-core</code> directly against a path on its filesystem.
        {status?.scan_base_dir
          ? <> Paths are restricted to <code style={{ color: 'var(--text)', background: 'var(--surface)', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.72rem' }}>{status.scan_base_dir}</code>.</>
          : <> Set <code style={{ color: 'var(--text)', background: 'var(--surface)', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.72rem' }}>WAFPASS_SCAN_BASE_DIR</code> on the server to restrict which paths are allowed.</>}
      </div>
    </div>
  )
}

function CliPanel() {
  const { t } = useI18n()
  const serverUrl = getServerUrl()

  const [path, setPath] = useState('./infra')
  const [iac, setIac] = useState('terraform')
  const [project, setProject] = useState('')
  const [branch, setBranch] = useState('')
  const [stage, setStage] = useState('')
  const [planFile, setPlanFile] = useState('')

  const pushCmd = [
    'wafpass check \\\n',
    '  --output json \\\n',
    `  --push ${serverUrl}/runs \\\n`,
    ...(project ? [`  --project "${project}" \\\n`] : []),
    ...(branch ? [`  --branch "${branch}" \\\n`] : []),
    ...(stage ? [`  --stage "${stage}" \\\n`] : []),
    ...(iac !== 'terraform' ? [`  --iac ${iac} \\\n`] : []),
    ...(planFile ? [`  --plan-file ${planFile} \\\n`] : []),
    `  ${path}`,
  ].join('')

  const quickCmd = `wafpass check --output json --push ${serverUrl}/runs ${path}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{
        padding: '1.25rem', borderRadius: '14px',
        background: 'var(--bg)', border: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
          {t('pages.scan.cliBuilder')}
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <Input label={t('pages.scan.iacSourceLabel')} value={path} onChange={setPath} placeholder="./infra" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('pages.scan.frameworkLabel')}</label>
            <FrameworkSelect value={iac} onChange={setIac} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <Input label={t('pages.scan.projectLabel')} value={project} onChange={setProject} placeholder="my-service" />
          <Input label={t('pages.scan.branchLabel')} value={branch} onChange={setBranch} placeholder="main" />
          <Input label={t('pages.scan.stageLabel')} value={stage} onChange={setStage} placeholder="dev | staging | prod" />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <Input
            label={t('pages.scan.planFileLabel')}
            value={planFile}
            onChange={setPlanFile}
            placeholder="plan.json"
            hint={iac === 'terraform' ? 'Generate: terraform plan -out=tfplan && terraform show -json tfplan > plan.json' : undefined}
          />
        </div>
        <CopyBlock code={pushCmd} lang="sh" />
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem',
      }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'rgba(0,148,255,.12)', color: 'var(--waf-brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.72rem', fontWeight: 800,
            }}>1</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>Install</div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Python 3.10+ required.</div>
          <CopyBlock code="pip install wafpass-core" lang="sh" />
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'rgba(0,148,255,.12)', color: 'var(--waf-brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.72rem', fontWeight: 800,
            }}>2</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>Push</div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Fastest way from a local terminal.</div>
          <CopyBlock code={quickCmd} lang="sh" />
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'rgba(0,148,255,.12)', color: 'var(--waf-brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.72rem', fontWeight: 800,
            }}>3</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>CI/CD</div>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Add <code style={{ color: 'var(--text)' }}>--fail-on fail</code> to gate merges.</div>
          <CopyBlock code={`wafpass check --push ${serverUrl}/runs --project "\${{ github.repository }}" --branch "\${{ github.ref_name }}" ./infra`} lang="sh" />
        </div>
      </div>
    </div>
  )
}

function ApiPanel() {
  const serverUrl = getServerUrl()
  const { t } = useI18n()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{
        padding: '1rem 1.25rem', borderRadius: '12px',
        background: 'rgba(0,148,255,.05)', border: '1px solid rgba(0,148,255,.15)',
        fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.6,
      }}>
        POST JSON results directly — generated automatically with <code style={{ color: 'var(--text)', background: 'var(--surface)', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.72rem' }}>--output json --push</code>.
      </div>

      <CopyBlock lang="sh" code={`wafpass check --output json ./infra > results.json

curl -X POST ${serverUrl}/runs \\
  -H "Content-Type: application/json" \\
  -d @results.json`} />

      <div className="card">
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.875rem' }}>
          {t('pages.scan.directApiTitle')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {[
            ['POST', '/scan', 'Trigger server-side scan (persists Run)'],
            ['POST', '/runs', 'Submit a pre-built scan result'],
            ['GET', '/runs', 'List all scan runs'],
            ['GET', '/runs/{id}', 'Full run detail with findings'],
            ['GET', '/runs/{id}/findings', 'Filter by ?status=FAIL&severity=critical'],
          ].map(([method, p, desc]) => (
            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.78rem' }}>
              <span style={{
                padding: '0.15rem 0.5rem', borderRadius: '5px', fontSize: '0.65rem', fontWeight: 800, flexShrink: 0,
                background: method === 'POST' ? 'rgba(0,148,255,.12)' : 'rgba(34,197,94,.1)',
                color: method === 'POST' ? 'var(--waf-brand)' : '#22c55e',
              }}>{method}</span>
              <code style={{ fontSize: '0.74rem', color: 'var(--text)', flexShrink: 0 }}>{p}</code>
              <span style={{ color: 'var(--muted)' }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FlagsShelf({ t }: { t: (key: string) => string }) {
  const flags = [
    ['--push URL', 'POST results to dashboard'],
    ['--output json', 'Required for --push'],
    ['--project NAME', 'Label this run'],
    ['--branch NAME', 'Git branch'],
    ['--stage NAME', 'dev | staging | prod'],
    ['--iac FRAMEWORK', 'terraform | cdk | pulumi | bicep | cfn'],
    ['--pillars LIST', 'security,cost,reliability,…'],
    ['--severity LEVEL', 'critical | high | medium | low'],
    ['--fail-on fail', 'Exit non-zero on FAIL'],
    ['--fail-on skip', 'Exit on FAIL + SKIP'],
    ['--plan-file PATH', 'Terraform plan JSON'],
    ['--waiver-file PATH', '.wafpass-skip.yml'],
  ]

  return (
    <div className="card">
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
        {t('pages.scan.cliFlagsTitle')}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
        {flags.map(([flag, desc]) => (
          <div
            key={flag}
            style={{
              padding: '0.6rem 0.85rem', borderRadius: '10px',
              background: 'var(--bg)', border: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', gap: '0.15rem',
              minWidth: '180px', flex: 1,
            }}
          >
            <code style={{ fontSize: '0.76rem', color: 'var(--waf-brand)', fontWeight: 700, whiteSpace: 'nowrap' }}>{flag}</code>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function RunScanPage() {
  const { t } = useI18n()
  const serverUrl = getServerUrl()

  const [path, setPath] = useState<'cli' | 'server' | 'api'>('cli')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Hero */}
      <div style={{
        padding: '2rem 2.25rem', borderRadius: '20px',
        background: 'linear-gradient(135deg, rgba(0,148,255,.10) 0%, rgba(124,58,237,.06) 100%)',
        border: '1px solid rgba(0,148,255,.2)',
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px',
          borderRadius: '50%', background: 'rgba(0,148,255,.08)', filter: 'blur(40px)', pointerEvents: 'none',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{
            width: 46, height: 46, borderRadius: '14px',
            background: 'rgba(0,148,255,.15)', border: '1px solid rgba(0,148,255,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--waf-brand)',
          }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: 'var(--text)' }}>{t('pages.scan.title')}</h1>
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '0.15rem' }}>{t('pages.scan.subtitle')}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.4rem 0.8rem', borderRadius: '999px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            fontSize: '0.75rem', color: 'var(--muted)',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--waf-brand)', flexShrink: 0 }} />
            <span style={{ fontWeight: 600 }}>{t('pages.scan.serverUrlLabel')}</span>
            <code style={{ color: 'var(--waf-brand)', fontWeight: 700 }}>{serverUrl}</code>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
            {t('pages.scan.serverUrlHint')}
          </div>
        </div>
      </div>

      {/* Path selector */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <PathCard
          active={path === 'cli'}
          icon="M8 9l3 3-3 3m5 0h3 M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          title={t('pages.scan.cliPathTitle')}
          desc={t('pages.scan.cliPathDesc')}
          badge={t('pages.scan.recommendedBadge')}
          onClick={() => setPath('cli')}
        />
        <PathCard
          active={path === 'server'}
          icon="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
          title={t('pages.scan.serverPathTitle')}
          desc={t('pages.scan.serverPathDesc')}
          onClick={() => setPath('server')}
        />
        <PathCard
          active={path === 'api'}
          icon="M8 9l3 3-3 3m5 0h3 M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          title={t('pages.scan.apiPathTitle')}
          desc={t('pages.scan.apiPathDesc')}
          onClick={() => setPath('api')}
        />
      </div>

      {/* Active path content */}
      <div style={{ minHeight: '200px' }}>
        {path === 'server' && <ServerScanPanel />}
        {path === 'cli' && <CliPanel />}
        {path === 'api' && <ApiPanel />}
      </div>

      {/* Reference shelf */}
      <FlagsShelf t={t} />
    </div>
  )
}
