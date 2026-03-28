import { useState, useEffect } from 'react'

export interface Settings {
  defaultIac: string
  failOn: string
  secretScanner: boolean
  autoFix: boolean
  carbonTracking: boolean
  blastRadius: boolean
  pdfAutoOpen: boolean
  defaultSeverity: string
}

export interface MaturityState {
  level: number
  settings: Settings
}

const DEFAULT_SETTINGS: Settings = {
  defaultIac: 'terraform',
  failOn: 'fail',
  secretScanner: true,
  autoFix: true,
  carbonTracking: false,
  blastRadius: true,
  pdfAutoOpen: false,
  defaultSeverity: '',
}

const MATURITY_PRESETS: Record<number, Partial<Settings>> = {
  1: { secretScanner: false, autoFix: false, carbonTracking: false, blastRadius: false, failOn: 'fail', defaultSeverity: 'critical' },
  2: { secretScanner: true, autoFix: false, carbonTracking: false, blastRadius: true, failOn: 'fail', defaultSeverity: '' },
  3: { secretScanner: true, autoFix: true, carbonTracking: true, blastRadius: true, failOn: 'skip', defaultSeverity: '' },
}

const MATURITY_META = [
  { level: 1, label: 'L1 Foundational', desc: 'Basic security posture — critical controls only, minimal automation', color: '#d97706', textColor: '#fbbf24' },
  { level: 2, label: 'L2 Operational', desc: 'Mature security operations — full scanning, blast radius analysis', color: '#0094FF', textColor: '#60a5fa' },
  { level: 3, label: 'L3 Optimised', desc: 'Cloud excellence — auto-remediation, carbon tracking, full compliance', color: '#059669', textColor: '#34d399' },
]

export function loadMaturityState(): MaturityState {
  const settings = { ...DEFAULT_SETTINGS }
  const level = 1
  try {
    const s = localStorage.getItem('wafpass_settings')
    if (s) Object.assign(settings, JSON.parse(s))
  } catch {}
  try {
    const m = localStorage.getItem('wafpass_maturity')
    if (m) return { level: parseInt(m) || 1, settings }
  } catch {}
  return { level, settings }
}

export function saveMaturityState(level: number, settings: Settings) {
  try {
    localStorage.setItem('wafpass_settings', JSON.stringify(settings))
    localStorage.setItem('wafpass_maturity', String(level))
  } catch {}
}

export function getMaturityMeta(level: number) {
  return MATURITY_META.find(m => m.level === level) ?? MATURITY_META[0]
}

interface Props {
  maturityLevel: number
  settings: Settings
  onChange: (level: number, settings: Settings) => void
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: '40px', height: '22px', borderRadius: '999px', border: 'none', cursor: 'pointer',
        background: checked ? 'var(--waf-brand)' : '#cbd5e1', transition: 'background 0.2s',
        position: 'relative', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: '3px', left: checked ? '21px' : '3px',
        width: '16px', height: '16px', borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
      }} />
    </button>
  )
}

export default function SettingsPage({ maturityLevel, settings, onChange }: Props) {
  const [level, setLevel] = useState(maturityLevel)
  const [s, setS] = useState<Settings>(settings)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setLevel(maturityLevel); setS(settings) }, [maturityLevel, settings])

  function applyMaturity(l: number) {
    setLevel(l)
    setS(prev => ({ ...prev, ...MATURITY_PRESETS[l] }))
  }

  function save() {
    saveMaturityState(level, s)
    onChange(level, s)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const meta = getMaturityMeta(level)

  const selectStyle = {
    background: '#fff', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.82rem', outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '700px', margin: '0 auto' }}>

      {/* Maturity level */}
      <div className="card">
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
          Maturity Level
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {MATURITY_META.map(m => (
            <button
              key={m.level}
              onClick={() => applyMaturity(m.level)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '1rem',
                borderRadius: '10px', border: `2px solid ${level === m.level ? m.color : 'var(--border)'}`,
                background: level === m.level ? `${m.color}11` : 'var(--bg)',
                cursor: 'pointer', textAlign: 'left', width: '100%',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                background: `${m.color}22`, border: `2px solid ${m.color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 800, color: m.textColor,
              }}>
                L{m.level}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: level === m.level ? m.textColor : 'var(--text)', marginBottom: '0.2rem' }}>
                  {m.label}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.5 }}>{m.desc}</div>
              </div>
              {level === m.level && (
                <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 700, color: m.textColor, whiteSpace: 'nowrap' }}>Active</span>
              )}
            </button>
          ))}
        </div>
        <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.875rem', borderRadius: '8px', background: `${meta.color}11`, border: `1px solid ${meta.color}33`, fontSize: '0.78rem', color: meta.textColor }}>
          Current maturity: <strong>{meta.label}</strong> — settings below reflect this level's defaults
        </div>
      </div>

      {/* Scan settings */}
      <div className="card">
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
          Scan Configuration
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>Default IaC Framework</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Used when --iac is not specified</div>
            </div>
            <select value={s.defaultIac} onChange={e => setS({ ...s, defaultIac: e.target.value })} style={selectStyle}>
              <option value="terraform">Terraform</option>
              <option value="cdk">AWS CDK</option>
              <option value="pulumi">Pulumi</option>
              <option value="bicep">Bicep</option>
              <option value="cfn">CloudFormation</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>Fail On</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Exit code behaviour when issues are found</div>
            </div>
            <select value={s.failOn} onChange={e => setS({ ...s, failOn: e.target.value })} style={selectStyle}>
              <option value="fail">FAIL findings</option>
              <option value="skip">FAIL + SKIP findings</option>
              <option value="never">Never fail</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>Default Severity Filter</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Run only checks at or above this severity</div>
            </div>
            <select value={s.defaultSeverity} onChange={e => setS({ ...s, defaultSeverity: e.target.value })} style={selectStyle}>
              <option value="">All severities</option>
              <option value="critical">Critical only</option>
              <option value="high">High+</option>
              <option value="medium">Medium+</option>
            </select>
          </div>
        </div>
      </div>

      {/* Feature toggles */}
      <div className="card">
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
          Feature Toggles
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {([
            ['secretScanner', 'Secret Scanner', 'Detect secrets & credentials embedded in IaC code'] as const,
            ['autoFix', 'Auto-Fix', 'Automatically apply safe remediations where possible'] as const,
            ['carbonTracking', 'Carbon Tracking', 'Estimate CO₂ footprint of deployed resources'] as const,
            ['blastRadius', 'Blast Radius Analysis', 'Map the impact radius of critical failures'] as const,
            ['pdfAutoOpen', 'Auto-open PDF Report', 'Open PDF in browser after report generation'] as const,
          ]).map(([key, label, desc]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>{label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{desc}</div>
              </div>
              <Toggle
                checked={s[key as keyof Settings] as boolean}
                onChange={v => setS({ ...s, [key]: v })}
              />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={save}
          style={{
            background: 'var(--waf-brand)', color: '#fff', border: 'none', borderRadius: '8px',
            padding: '0.6rem 1.5rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
          }}
        >
          Save Settings
        </button>
        {saved && <span style={{ fontSize: '0.8rem', color: '#22c55e', fontWeight: 600 }}>Saved!</span>}
      </div>
    </div>
  )
}
