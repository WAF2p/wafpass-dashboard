import { useState, useEffect } from 'react'

export interface Waiver {
  id: string
  reason: string
  owner: string
  expires: string
}

const STORAGE_KEY = 'wafpass_waivers'

function loadWaivers(): Record<string, Waiver> {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    return s ? JSON.parse(s) : {}
  } catch { return {} }
}

function saveWaivers(w: Record<string, Waiver>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(w)) } catch {}
}

function exportYaml(waivers: Record<string, Waiver>): string {
  const entries = Object.values(waivers)
  if (!entries.length) return ''
  let yaml = 'version: "1"\nwaivers:\n'
  for (const w of entries) {
    yaml += `  - id: "${w.id}"\n`
    yaml += `    reason: "${w.reason.replace(/"/g, '\\"')}"\n`
    yaml += `    owner: "${w.owner.replace(/"/g, '\\"')}"\n`
    yaml += `    expires: "${w.expires}"\n`
  }
  return yaml
}

interface FormState { id: string; reason: string; owner: string; expires: string }
const EMPTY_FORM: FormState = { id: '', reason: '', owner: '', expires: '' }

export default function WaiversPage() {
  const [waivers, setWaivers] = useState<Record<string, Waiver>>(loadWaivers)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [copied, setCopied] = useState(false)

  useEffect(() => { saveWaivers(waivers) }, [waivers])

  const entries = Object.values(waivers).sort((a, b) => a.id.localeCompare(b.id))

  function openAdd() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(w: Waiver) {
    setEditId(w.id)
    setForm({ id: w.id, reason: w.reason, owner: w.owner, expires: w.expires })
    setShowForm(true)
  }

  function submit() {
    if (!form.id.trim()) return
    const waiver: Waiver = { id: form.id.trim(), reason: form.reason, owner: form.owner, expires: form.expires }
    setWaivers(prev => ({ ...prev, [waiver.id]: waiver }))
    setShowForm(false)
  }

  function remove(id: string) {
    setWaivers(prev => { const w = { ...prev }; delete w[id]; return w })
  }

  function copyYaml() {
    const yaml = exportYaml(waivers)
    if (!yaml) return
    navigator.clipboard.writeText(yaml).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function downloadYaml() {
    const yaml = exportYaml(waivers)
    if (!yaml) return
    const blob = new Blob([yaml], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '.wafpass-skip.yml'
    a.click()
    URL.revokeObjectURL(url)
  }

  const inputStyle = {
    background: '#fff', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.82rem',
    outline: 'none', width: '100%', boxSizing: 'border-box' as const,
  }

  const isExpired = (expires: string) => {
    if (!expires) return false
    return new Date(expires) < new Date()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px' }}>

      {/* Header actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          onClick={openAdd}
          style={{
            background: 'var(--waf-brand)', color: '#fff', border: 'none', borderRadius: '8px',
            padding: '0.5rem 1.1rem', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
          }}
        >
          + Add Waiver
        </button>
        {entries.length > 0 && (
          <>
            <button
              onClick={copyYaml}
              style={{
                background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '0.5rem 1.1rem', fontSize: '0.82rem', cursor: 'pointer',
              }}
            >
              {copied ? 'Copied!' : 'Copy YAML'}
            </button>
            <button
              onClick={downloadYaml}
              style={{
                background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '0.5rem 1.1rem', fontSize: '0.82rem', cursor: 'pointer',
              }}
            >
              Download .wafpass-skip.yml
            </button>
          </>
        )}
      </div>

      {/* Waivers list */}
      {entries.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>No waivers configured</div>
          <div style={{ fontSize: '0.78rem' }}>
            Add waivers to suppress specific controls from failing the scan.
            Export as <code>.wafpass-skip.yml</code> for CLI use.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {entries.map(w => {
            const expired = isExpired(w.expires)
            return (
              <div key={w.id} className="card" style={{ borderLeft: `3px solid ${expired ? '#DA2C38' : '#a78bfa'}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                      <code style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--waf-brand)' }}>{w.id}</code>
                      {expired && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#DA2C38', background: 'rgba(218,44,56,.15)', padding: '0.08rem 0.4rem', borderRadius: '999px' }}>
                          EXPIRED
                        </span>
                      )}
                      {w.expires && !expired && (
                        <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>expires {w.expires}</span>
                      )}
                    </div>
                    {w.reason && <div style={{ fontSize: '0.8rem', color: 'var(--text)', marginBottom: '0.2rem' }}>{w.reason}</div>}
                    {w.owner && <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Owner: {w.owner}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    <button
                      onClick={() => openEdit(w)}
                      style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.25rem 0.6rem', fontSize: '0.72rem', cursor: 'pointer', color: 'var(--muted)' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(w.id)}
                      style={{ background: 'none', border: '1px solid rgba(218,44,56,.3)', borderRadius: '6px', padding: '0.25rem 0.6rem', fontSize: '0.72rem', cursor: 'pointer', color: '#DA2C38' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* YAML preview */}
      {entries.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
            .wafpass-skip.yml Preview
          </h2>
          <pre style={{
            background: '#0f172a', color: '#e2e8f0', borderRadius: '8px',
            padding: '0.875rem 1rem', fontSize: '0.78rem', overflowX: 'auto', lineHeight: 1.7, margin: 0,
          }}>
            {exportYaml(waivers)}
          </pre>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
            Place this file in your repository root. wafpass-core will skip these controls automatically.
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <>
          <div
            onClick={() => setShowForm(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 99 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            background: '#fff', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            padding: '1.5rem', width: '440px', maxWidth: '90vw', zIndex: 100,
            display: 'flex', flexDirection: 'column', gap: '1rem',
          }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              {editId ? 'Edit Waiver' : 'Add Waiver'}
            </h2>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.3rem' }}>
                Control ID *
              </label>
              <input
                value={form.id}
                onChange={e => setForm({ ...form, id: e.target.value })}
                placeholder="e.g. WAF-SEC-030"
                disabled={!!editId}
                style={{ ...inputStyle, opacity: editId ? 0.6 : 1 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.3rem' }}>
                Reason
              </label>
              <textarea
                value={form.reason}
                onChange={e => setForm({ ...form, reason: e.target.value })}
                placeholder="Business justification for waiving this control"
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.3rem' }}>
                  Owner
                </label>
                <input
                  value={form.owner}
                  onChange={e => setForm({ ...form, owner: e.target.value })}
                  placeholder="team or person"
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.3rem' }}>
                  Expires
                </label>
                <input
                  type="date"
                  value={form.expires}
                  onChange={e => setForm({ ...form, expires: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowForm(false)}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.45rem 1rem', fontSize: '0.82rem', cursor: 'pointer', color: 'var(--muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!form.id.trim()}
                style={{
                  background: form.id.trim() ? 'var(--waf-brand)' : '#94a3b8', color: '#fff',
                  border: 'none', borderRadius: '8px', padding: '0.45rem 1rem',
                  fontSize: '0.82rem', fontWeight: 700, cursor: form.id.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                {editId ? 'Save Changes' : 'Add Waiver'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
