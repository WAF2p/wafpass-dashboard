import { useState } from 'react'
import { getApiBase } from '../api'

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

export default function RunScanPage() {
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
    background: '#fff', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.82rem', outline: 'none',
  }

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Server info banner */}
      <div style={{ padding: '0.875rem 1.1rem', borderRadius: '10px', background: 'rgba(0,148,255,.06)', border: '1px solid rgba(0,148,255,.2)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--waf-brand)', flexShrink: 0 }}/>
        <div>
          <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>Dashboard server: </span>
          <code style={{ fontSize: '0.8rem', color: 'var(--waf-brand)', fontWeight: 700 }}>{serverUrl}</code>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--muted)' }}>
          Results pushed here appear in Run History instantly
        </div>
      </div>

      {/* Quick-start */}
      <div className="card">
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1.25rem' }}>
          Quick Start
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          <Step n={1} title="Install wafpass-core">
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>
              Install from PyPI (Python 3.10+ required):
            </div>
            <CopyBlock code="pip install wafpass-core" lang="sh"/>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
              Or from source: <code style={{ color: 'var(--text)', fontSize: '0.75rem' }}>git clone https://github.com/WAF2p/waf-plus-plus && cd waf-plus-plus/pass && pip install -e .</code>
            </div>
          </Step>

          <Step n={2} title="Run a scan and push results">
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>
              Point wafpass at your IaC directory and push results to this dashboard:
            </div>
            <CopyBlock code={`wafpass check --output json --push ${serverUrl}/runs /path/to/terraform`} lang="sh"/>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
              Results appear in <strong style={{ color: 'var(--text)' }}>Run History</strong> within seconds.
            </div>
          </Step>

          <Step n={3} title="Add project metadata (optional)">
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>
              Label your run with a project name and branch:
            </div>
            <CopyBlock code={`wafpass check \\
  --output json \\
  --push ${serverUrl}/runs \\
  --project "my-service" \\
  --branch main \\
  /path/to/terraform`} lang="sh"/>
          </Step>

          <Step n={4} title="CI/CD — GitHub Actions example">
            <CopyBlock lang="yaml" code={`- name: WAF++ scan
  run: |
    pip install wafpass-core
    wafpass check \\
      --output json \\
      --push ${serverUrl}/runs \\
      --project "\${{ github.repository }}" \\
      --branch "\${{ github.ref_name }}" \\
      ./terraform`}/>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
              Add <code style={{ color: 'var(--text)' }}>--fail-on fail</code> to break the pipeline on FAIL findings.
            </div>
          </Step>

        </div>
      </div>

      {/* Command builder */}
      <div className="card">
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
          Command Builder
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.25rem' }}>IaC Source Path</label>
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
            <div style={{ flex: 1, minWidth: '140px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.25rem' }}>Project name</label>
              <input value={project} onChange={e => setProject(e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' as const }} placeholder="my-service"/>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.25rem' }}>
              Terraform Plan File <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional — enables Change Overview)</span>
            </label>
            <input
              value={planFile}
              onChange={e => setPlanFile(e.target.value)}
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' as const }}
              placeholder="plan.json"
            />
            {iac === 'terraform' && (
              <div style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--muted)' }}>
                Generate with:{' '}
                <code style={{ color: 'var(--text)', background: 'var(--bg)', padding: '0.1rem 0.3rem', borderRadius: '4px', fontSize: '0.72rem' }}>
                  terraform plan -out=tfplan &amp;&amp; terraform show -json tfplan &gt; plan.json
                </code>
              </div>
            )}
          </div>
        </div>
        <CopyBlock code={pushCmd} lang="sh"/>
      </div>

      {/* API reference */}
      <div className="card">
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
          Direct API Push
        </h2>
        <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>
          You can also POST JSON results directly. wafpass-core generates this automatically with <code style={{ color: 'var(--text)' }}>--output json --push</code>, but you can call it manually:
        </div>
        <CopyBlock lang="sh" code={`# Run and capture JSON
wafpass check --output json ./terraform > results.json

# Push to dashboard
curl -X POST ${serverUrl}/runs \\
  -H "Content-Type: application/json" \\
  -d @results.json`}/>
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[
            ['POST', '/runs', 'Submit a new scan result'],
            ['GET',  '/runs', 'List all scan runs'],
            ['GET',  '/runs/{id}', 'Get full run detail including findings'],
            ['GET',  '/runs/{id}/findings', 'Get findings (filter by ?status=FAIL&severity=critical)'],
            ['GET',  '/runs/{id}/controls', 'Get controls metadata for run'],
          ].map(([method, path, desc]) => (
            <div key={path} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem' }}>
              <span style={{
                padding: '0.12rem 0.5rem', borderRadius: '5px', fontSize: '0.65rem', fontWeight: 700,
                background: method === 'POST' ? 'rgba(0,148,255,.12)' : 'rgba(34,197,94,.1)',
                color: method === 'POST' ? 'var(--waf-brand)' : '#22c55e', flexShrink: 0,
              }}>{method}</span>
              <code style={{ fontSize: '0.78rem', color: 'var(--text)' }}>{serverUrl}{path}</code>
              <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Common flags */}
      <div className="card">
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.875rem' }}>
          Common CLI Flags
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.4rem 1rem', fontSize: '0.8rem' }}>
          {[
            ['--push URL',           'POST results to dashboard server — use the /runs endpoint (e.g. http://localhost:8000/runs)'],
            ['--output json',        'Required for --push; outputs structured JSON'],
            ['--project NAME',       'Label this run (shows in sidebar dropdown)'],
            ['--branch NAME',        'Git branch name for the run'],
            ['--iac FRAMEWORK',      'terraform | cdk | pulumi | bicep | cfn'],
            ['--pillars LIST',       'Comma-separated: security,cost,reliability,…'],
            ['--severity LEVEL',     'Minimum severity: critical | high | medium | low'],
            ['--fail-on fail',       'Exit non-zero when FAIL findings exist (default)'],
            ['--fail-on skip',       'Exit non-zero on FAIL + SKIP findings'],
            ['--plan-file PATH',      'Terraform plan JSON for Change Overview (terraform show -json)'],
            ['--waiver-file PATH',   'Skip controls listed in .wafpass-skip.yml'],
          ].map(([flag, desc]) => (
            <>
              <code key={`f-${flag}`} style={{ color: 'var(--waf-brand)', fontWeight: 600, padding: '0.15rem 0', alignSelf: 'start' }}>{flag}</code>
              <span key={`d-${flag}`} style={{ color: 'var(--muted)', padding: '0.15rem 0', borderBottom: '1px solid var(--border)' }}>{desc}</span>
            </>
          ))}
        </div>
      </div>

    </div>
  )
}
