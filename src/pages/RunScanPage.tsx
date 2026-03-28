import { useState } from 'react'

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export default function RunScanPage() {
  const [path, setPath] = useState('')
  const [iac, setIac] = useState('terraform')
  const [pillars, setPillars] = useState<string[]>([])
  const [severity, setSeverity] = useState('')
  const [push, setPush] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const PILLARS = ['security', 'cost', 'reliability', 'operations', 'sovereignty', 'sustainability', 'performance', 'governance']

  function togglePillar(p: string) {
    setPillars(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  async function runScan() {
    if (!path.trim()) return
    setScanning(true)
    setResult(null)
    try {
      const args: string[] = ['wafpass', 'check', '--output', 'json']
      if (push) args.push('--push', `${window.location.origin}${API_BASE}`)
      if (iac !== 'terraform') args.push('--iac', iac)
      if (pillars.length > 0) args.push('--pillars', pillars.join(','))
      if (severity) args.push('--severity', severity)
      args.push(path)

      const res = await fetch(`${API_BASE}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, iac, pillars, severity, push }),
      })
      if (res.ok) {
        setResult({ success: true, message: 'Scan started successfully. Results will appear in Run History.' })
      } else {
        const err = await res.text()
        setResult({ success: false, message: err || 'Scan endpoint returned an error. Run manually using the command below.' })
      }
    } catch {
      setResult({ success: false, message: 'Could not reach scan endpoint. Run the command below in your terminal.' })
    } finally {
      setScanning(false)
    }
  }

  const cmdParts = ['wafpass check --output json']
  if (push) cmdParts.push(`--push ${window.location.origin}${API_BASE}`)
  if (iac !== 'terraform') cmdParts.push(`--iac ${iac}`)
  if (pillars.length > 0) cmdParts.push(`--pillars ${pillars.join(',')}`)
  if (severity) cmdParts.push(`--severity ${severity}`)
  if (path.trim()) cmdParts.push(path.trim())
  const previewCmd = cmdParts.join(' \\\n  ')

  const inputStyle = {
    background: '#fff', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.85rem', outline: 'none',
    width: '100%',
  }

  const selectStyle = { ...inputStyle, width: 'auto', minWidth: '160px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '700px' }}>

      <div className="card">
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
          Target
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.3rem' }}>
              IaC Source Path
            </label>
            <input
              value={path}
              onChange={e => setPath(e.target.value)}
              placeholder="/path/to/terraform"
              style={inputStyle}
            />
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
              Absolute or relative path to your Terraform / CDK / Pulumi directory
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.3rem' }}>
                IaC Framework
              </label>
              <select value={iac} onChange={e => setIac(e.target.value)} style={selectStyle}>
                <option value="terraform">Terraform</option>
                <option value="cdk">AWS CDK</option>
                <option value="pulumi">Pulumi</option>
                <option value="bicep">Bicep</option>
                <option value="cfn">CloudFormation</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.3rem' }}>
                Min. Severity
              </label>
              <select value={severity} onChange={e => setSeverity(e.target.value)} style={selectStyle}>
                <option value="">All</option>
                <option value="critical">Critical</option>
                <option value="high">High+</option>
                <option value="medium">Medium+</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
          Pillar Filter
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {PILLARS.map(p => {
            const active = pillars.includes(p)
            return (
              <button
                key={p}
                onClick={() => togglePillar(p)}
                style={{
                  padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid',
                  borderColor: active ? 'var(--waf-brand)' : 'var(--border)',
                  background: active ? 'rgba(0,148,255,0.1)' : 'var(--bg)',
                  color: active ? 'var(--waf-brand)' : 'var(--muted)',
                  fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {p}
              </button>
            )
          })}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
          {pillars.length === 0 ? 'All pillars will be scanned' : `Scanning: ${pillars.join(', ')}`}
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
          Output
        </h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={push} onChange={e => setPush(e.target.checked)} style={{ width: '16px', height: '16px' }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>Push results to dashboard</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>POST results to {window.location.origin}{API_BASE}/runs</div>
          </div>
        </label>
      </div>

      {/* Command preview */}
      <div className="card">
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
          Generated Command
        </h2>
        <pre style={{
          background: '#0f172a', color: '#e2e8f0', borderRadius: '8px',
          padding: '0.875rem 1rem', fontSize: '0.78rem', overflowX: 'auto', lineHeight: 1.7, margin: 0,
        }}>
          {previewCmd}
        </pre>
        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
          Run this command in your terminal, or click "Start Scan" to trigger it via the API.
        </div>
      </div>

      {result && (
        <div style={{
          padding: '0.875rem 1rem', borderRadius: '10px',
          background: result.success ? 'rgba(34,197,94,.08)' : 'rgba(218,44,56,.08)',
          border: `1px solid ${result.success ? 'rgba(34,197,94,.25)' : 'rgba(218,44,56,.25)'}`,
          color: result.success ? '#16a34a' : '#DA2C38',
          fontSize: '0.85rem',
        }}>
          {result.message}
        </div>
      )}

      <div>
        <button
          onClick={runScan}
          disabled={scanning || !path.trim()}
          style={{
            background: scanning || !path.trim() ? '#94a3b8' : 'var(--waf-brand)',
            color: '#fff', border: 'none', borderRadius: '8px',
            padding: '0.65rem 1.5rem', fontSize: '0.875rem', fontWeight: 700,
            cursor: scanning || !path.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}
        >
          {scanning ? (
            <><span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> Scanning…</>
          ) : 'Start Scan'}
        </button>
      </div>
    </div>
  )
}
