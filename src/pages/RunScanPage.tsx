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
    <div style={{ position: 'relative', marginTop: '0.5rem' }}>
      <pre style={{
        background: '#0f172a', color: '#e2e8f0', borderRadius: '8px',
        padding: '0.875rem 3rem 0.875rem 1rem', fontSize: '0.8rem',
        overflowX: 'auto', lineHeight: 1.7, margin: 0, whiteSpace: 'pre',
      }}>
        {lang && <span style={{ position: 'absolute', top: '0.5rem', left: '0.75rem', fontSize: '0.62rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{lang}</span>}
        {code}
      </pre>
      <button onClick={copy} style={{
        position: 'absolute', top: '0.5rem', right: '0.5rem',
        background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)',
        borderRadius: '5px', color: copied ? '#22c55e' : '#94a3b8',
        fontSize: '0.68rem', padding: '0.2rem 0.5rem', cursor: 'pointer',
      }}>
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '1rem' }}>
      <div style={{
        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
        background: 'rgba(0,148,255,0.15)', border: '2px solid rgba(0,148,255,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.75rem', fontWeight: 800, color: 'var(--waf-brand)',
      }}>{n}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', marginBottom: '0.5rem' }}>{title}</div>
        {children}
      </div>
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

  const inputStyle = {
    background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.82rem', outline: 'none',
  }

  const ready = status?.enabled && status?.engine_available && status?.controls_dir_exists
  const dotColor = status == null
    ? '#94a3b8'
    : ready ? '#22c55e' : '#f59e0b'
  const dotLabel = status == null
    ? t('pages.scan.checking')
    : ready ? t('pages.scan.ready') : t('pages.scan.unavailable')

  return (
    <div className="card" style={{ borderColor: 'rgba(34,197,94,.25)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, flex: 1 }}>
          {t('pages.scan.serverPanel')}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dotColor, flexShrink: 0 }}/>
          {dotLabel}
        </div>
      </div>

      {statusError && (
        <div style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', fontSize: '0.75rem', color: '#ef4444', marginBottom: '0.875rem' }}>
          Could not reach server: {statusError}
        </div>
      )}

      {status && !ready && !statusError && (
        <div style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', fontSize: '0.75rem', color: '#f59e0b', marginBottom: '0.875rem' }}>
          {!status.enabled && 'Server-side scanning is disabled (WAFPASS_SCAN_ENABLED=false). '}
          {status.enabled && !status.engine_available && 'wafpass-core is not installed on the server. Run: pip install wafpass-core. '}
          {status.enabled && status.engine_available && !status.controls_dir_exists && `Controls directory not found on server: ${status.controls_dir}. Set WAFPASS_CONTROLS_DIR. `}
        </div>
      )}

      {status && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.875rem', fontSize: '0.72rem', color: 'var(--muted)' }}>
          {[
            ['Engine', status.engine_available ? '✓ wafpass-core' : '✗ not installed'],
            ['Controls dir', status.controls_dir_exists ? '✓ found' : '✗ missing'],
            ...(status.scan_base_dir ? [['Base dir', status.scan_base_dir]] : []),
          ].map(([k, v]) => (
            <div key={k} style={{ padding: '0.2rem 0.6rem', borderRadius: '5px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 600 }}>{k}:</span> {v}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '0.875rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 3, minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.25rem' }}>{t('pages.scan.iacPathLabel')} <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              value={scanPath}
              onChange={e => setScanPath(e.target.value)}
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' as const }}
              placeholder="/srv/terraform/my-infra"
              disabled={!ready}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.25rem' }}>{t('pages.scan.frameworkLabel')}</label>
            <select value={scanIac} onChange={e => setScanIac(e.target.value)} style={inputStyle} disabled={!ready}>
              <option value="terraform">Terraform</option>
              <option value="cdk">AWS CDK</option>
              <option value="pulumi">Pulumi</option>
              <option value="bicep">Bicep</option>
              <option value="cfn">CloudFormation</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '130px' }}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.25rem' }}>{t('pages.scan.projectLabel')}</label>
            <input value={scanProject} onChange={e => setScanProject(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' as const }} placeholder="my-service" disabled={!ready}/>
          </div>
          <div style={{ flex: 1, minWidth: '130px' }}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.25rem' }}>{t('pages.scan.branchLabel')}</label>
            <input value={scanBranch} onChange={e => setScanBranch(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' as const }} placeholder="main" disabled={!ready}/>
          </div>
          <div style={{ flex: 1, minWidth: '130px' }}>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.25rem' }}>{t('pages.scan.stageLabel')}</label>
            <input value={scanStage} onChange={e => setScanStage(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' as const }} placeholder="dev | staging | prod" disabled={!ready}/>
          </div>
        </div>
      </div>

      <button
        onClick={handleScan}
        disabled={!ready || running || !scanPath.trim()}
        style={{
          padding: '0.45rem 1.25rem', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 700,
          background: ready && !running && scanPath.trim() ? 'var(--waf-brand)' : 'var(--bg)',
          color: ready && !running && scanPath.trim() ? '#fff' : 'var(--muted)',
          border: '1px solid', borderColor: ready && !running && scanPath.trim() ? 'var(--waf-brand)' : 'var(--border)',
          cursor: ready && !running && scanPath.trim() ? 'pointer' : 'default',
          transition: 'all .15s',
        }}
      >
        {running ? t('pages.scan.scanning') : t('pages.scan.runScan')}
      </button>

      {runError && (
        <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.85rem', borderRadius: '6px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', fontSize: '0.78rem', color: '#ef4444' }}>
          {runError}
        </div>
      )}

      {result && (
        <div style={{ marginTop: '0.875rem', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.25)' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#22c55e', marginBottom: '0.5rem' }}>{t('pages.scan.scanComplete')}</div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--muted)' }}>
            <div><span style={{ fontWeight: 600 }}>{t('pages.scan.scoreLabel')}:</span> <span style={{ color: result.score >= 80 ? '#22c55e' : result.score >= 50 ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>{result.score}%</span></div>
            <div><span style={{ fontWeight: 600 }}>{t('pages.scan.controlsRunLabel')}:</span> {result.controls_run}</div>
            {result.project && <div><span style={{ fontWeight: 600 }}>Project:</span> {result.project}</div>}
            {result.stage && <div><span style={{ fontWeight: 600 }}>Stage:</span> {result.stage}</div>}
            <div><span style={{ fontWeight: 600 }}>ID:</span> <code style={{ fontSize: '0.72rem' }}>{result.id}</code></div>
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--muted)' }}>
            Open <strong style={{ color: 'var(--text)' }}>Run History</strong> to view the full report.
          </div>
        </div>
      )}

      <div style={{ marginTop: '0.875rem', fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.6, padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
        The server runs <code style={{ color: 'var(--text)' }}>wafpass-core</code> directly against a path on its filesystem.
        {status?.scan_base_dir
          ? <> Paths are restricted to <code style={{ color: 'var(--text)' }}>{status.scan_base_dir}</code>.</>
          : <> Set <code style={{ color: 'var(--text)' }}>WAFPASS_SCAN_BASE_DIR</code> on the server to restrict which paths are allowed.</>
        }
      </div>
    </div>
  )
}

export default function RunScanPage() {
  const { t } = useI18n()
  const serverUrl = getServerUrl()

  const [path, setPath] = useState('/path/to/terraform')
  const [iac, setIac] = useState('terraform')
  const [project, setProject] = useState('')
  const [planFile, setPlanFile] = useState('')

  const pushCmd = [
    'wafpass check \\',
    '  --output json \\',
    `  --push ${serverUrl}/runs \\`,
    ...(project ? [`  --project "${project}" \\`] : []),
    ...(iac !== 'terraform' ? [`  --iac ${iac} \\`] : []),
    ...(planFile ? [`  --plan-file ${planFile} \\`] : []),
    `  ${path}`,
  ].join('\n')

  const inputStyle = {
    background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.82rem', outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Top bar: server URL + config hint side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(0,148,255,.06)', border: '1px solid rgba(0,148,255,.2)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--waf-brand)', flexShrink: 0 }}/>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Dashboard server: </span>
            <code style={{ fontSize: '0.78rem', color: 'var(--waf-brand)', fontWeight: 700 }}>{serverUrl}</code>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--muted)' }}>
            Results pushed here appear in Run History instantly
          </div>
        </div>
        <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.6, display: 'flex', alignItems: 'center' }}>
          <div>
            <strong style={{ color: 'var(--text)' }}>Configuring the server URL:</strong>{' '}
            change it in <strong style={{ color: 'var(--text)' }}>Settings → Connection & Real Engine</strong>, or set{' '}
            <code style={{ color: 'var(--waf-brand)', fontSize: '0.72rem' }}>VITE_API_URL=http://localhost:8000</code> in{' '}
            <code style={{ color: 'var(--text)', fontSize: '0.72rem' }}>.env.local</code>.
          </div>
        </div>
      </div>

      {/* Main two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'start' }}>

        {/* LEFT column — interactive panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Server-side scan */}
          <ServerScanPanel />

          {/* Command builder */}
          <div className="card">
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
              {t('pages.scan.cliBuilder')}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 2, minWidth: '180px' }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.25rem' }}>{t('pages.scan.iacSourceLabel')}</label>
                  <input value={path} onChange={e => setPath(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' as const }} placeholder="/path/to/terraform"/>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.25rem' }}>Framework</label>
                  <select value={iac} onChange={e => setIac(e.target.value)} style={inputStyle}>
                    <option value="terraform">Terraform</option>
                    <option value="cdk">AWS CDK</option>
                    <option value="pulumi">Pulumi</option>
                    <option value="bicep">Bicep</option>
                    <option value="cfn">CloudFormation</option>
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.25rem' }}>Project</label>
                  <input value={project} onChange={e => setProject(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' as const }} placeholder="my-service"/>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.25rem' }}>
                  {t('pages.scan.planFileLabel')}
                </label>
                <input
                  value={planFile}
                  onChange={e => setPlanFile(e.target.value)}
                  style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' as const }}
                  placeholder="plan.json"
                />
                {iac === 'terraform' && (
                  <div style={{ marginTop: '0.3rem', fontSize: '0.7rem', color: 'var(--muted)' }}>
                    Generate:{' '}
                    <code style={{ color: 'var(--text)', background: 'var(--bg)', padding: '0.1rem 0.3rem', borderRadius: '4px', fontSize: '0.7rem' }}>
                      terraform plan -out=tfplan &amp;&amp; terraform show -json tfplan &gt; plan.json
                    </code>
                  </div>
                )}
              </div>
            </div>
            <CopyBlock code={pushCmd} lang="sh"/>
          </div>

          {/* API endpoints */}
          <div className="card">
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.875rem' }}>
              {t('pages.scan.directApiTitle')}
            </h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.65rem' }}>
              POST JSON results directly — generated automatically with <code style={{ color: 'var(--text)' }}>--output json --push</code>:
            </div>
            <CopyBlock lang="sh" code={`wafpass check --output json ./terraform > results.json

curl -X POST ${serverUrl}/runs \\
  -H "Content-Type: application/json" \\
  -d @results.json`}/>
            <div style={{ marginTop: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {[
                ['POST', '/scan',             'Trigger server-side scan (persists Run)'],
                ['POST', '/runs',             'Submit a pre-built scan result'],
                ['GET',  '/runs',             'List all scan runs'],
                ['GET',  '/runs/{id}',        'Full run detail with findings'],
                ['GET',  '/runs/{id}/findings','Filter by ?status=FAIL&severity=critical'],
              ].map(([method, p, desc]) => (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.75rem' }}>
                  <span style={{
                    padding: '0.1rem 0.45rem', borderRadius: '4px', fontSize: '0.62rem', fontWeight: 700, flexShrink: 0,
                    background: method === 'POST' ? 'rgba(0,148,255,.12)' : 'rgba(34,197,94,.1)',
                    color: method === 'POST' ? 'var(--waf-brand)' : '#22c55e',
                  }}>{method}</span>
                  <code style={{ fontSize: '0.72rem', color: 'var(--text)', flexShrink: 0 }}>{p}</code>
                  <span style={{ color: 'var(--muted)', fontSize: '0.72rem' }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT column — documentation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Quick start */}
          <div className="card">
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1.25rem' }}>
              {t('pages.scan.quickStartTitle')}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              <Step n={1} title="Install wafpass-core">
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.35rem' }}>Python 3.10+ required:</div>
                <CopyBlock code="pip install wafpass-core" lang="sh"/>
              </Step>

              <Step n={2} title="Run a scan and push results">
                <CopyBlock code={`wafpass check --output json --push ${serverUrl}/runs /path/to/terraform`} lang="sh"/>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.4rem' }}>
                  Results appear in <strong style={{ color: 'var(--text)' }}>Run History</strong> within seconds.
                </div>
              </Step>

              <Step n={3} title="Add project metadata">
                <CopyBlock code={`wafpass check \\
  --output json \\
  --push ${serverUrl}/runs \\
  --project "my-service" \\
  --branch main \\
  /path/to/terraform`} lang="sh"/>
              </Step>

              <Step n={4} title="CI/CD — GitHub Actions">
                <CopyBlock lang="yaml" code={`- name: WAF++ scan
  run: |
    pip install wafpass-core
    wafpass check \\
      --output json \\
      --push ${serverUrl}/runs \\
      --project "\${{ github.repository }}" \\
      --branch "\${{ github.ref_name }}" \\
      ./terraform`}/>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.4rem' }}>
                  Add <code style={{ color: 'var(--text)' }}>--fail-on fail</code> to break the pipeline on FAIL findings.
                </div>
              </Step>

            </div>
          </div>

          {/* CLI flags reference */}
          <div className="card">
            <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.875rem' }}>
              {t('pages.scan.cliFlagsTitle')}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.35rem 1rem', fontSize: '0.78rem' }}>
              {[
                ['--push URL',          'POST results to dashboard (use /runs endpoint)'],
                ['--output json',       'Required for --push; outputs structured JSON'],
                ['--project NAME',      'Label this run (shows in sidebar dropdown)'],
                ['--branch NAME',       'Git branch name for the run'],
                ['--stage NAME',        'Deployment stage: dev | staging | prod'],
                ['--iac FRAMEWORK',     'terraform | cdk | pulumi | bicep | cfn'],
                ['--pillars LIST',      'Comma-separated: security,cost,reliability,…'],
                ['--severity LEVEL',    'Minimum: critical | high | medium | low'],
                ['--fail-on fail',      'Exit non-zero on FAIL findings (default)'],
                ['--fail-on skip',      'Exit non-zero on FAIL + SKIP findings'],
                ['--plan-file PATH',    'Terraform plan JSON for Change Overview'],
                ['--waiver-file PATH',  'Skip controls listed in .wafpass-skip.yml'],
              ].map(([flag, desc]) => (
                <>
                  <code key={`f-${flag}`} style={{ color: 'var(--waf-brand)', fontWeight: 600, padding: '0.15rem 0', alignSelf: 'start', whiteSpace: 'nowrap' }}>{flag}</code>
                  <span key={`d-${flag}`} style={{ color: 'var(--muted)', padding: '0.15rem 0', borderBottom: '1px solid var(--border)' }}>{desc}</span>
                </>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
