import { useEffect, useMemo, useState } from 'react'
import {
  AutoFixPatch,
  AutoFixRequest,
  AutoFixResponse,
  AutoFixSkipped,
  postAutoFix,
  postAutoFixClassify,
  postAutoFixRollback,
  RunDetail,
} from '../api'
import DiffViewer from '../components/DiffViewer'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })}
      style={{
        position: 'absolute',
        top: '0.5rem',
        right: '0.5rem',
        background: 'rgba(255,255,255,.08)',
        border: '1px solid rgba(255,255,255,.12)',
        borderRadius: '5px',
        color: copied ? '#22c55e' : '#94a3b8',
        fontSize: '0.72rem',
        padding: '0.2rem 0.55rem',
        cursor: 'pointer',
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

interface AutoFixPageProps {
  run: RunDetail | null
  onBack: () => void
}

type ScopeMode = 'all' | 'pillar' | 'control'
type ViewMode = 'server' | 'local'

const statusColors: Record<string, string> = {
  PASS: '#22c55e',
  FAIL: '#ef4444',
  SKIP: '#f59e0b',
}

const tableColumns = [
  { key: 'File', width: '18%' },
  { key: 'Resource', width: '22%' },
  { key: 'Attribute', width: '15%' },
  { key: 'Kind', width: '10%' },
  { key: 'New value', width: '25%' },
  { key: 'Control', width: '10%' },
]

export default function AutoFixPage({ run, onBack }: AutoFixPageProps) {
  const [mode, setMode] = useState<ScopeMode>('all')
  const [pillar, setPillar] = useState<string>('')
  const [controlId, setControlId] = useState<string>('')
  const [viewMode, setViewMode] = useState<ViewMode>('server')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<AutoFixResponse | null>(null)
  const [showApplyConfirm, setShowApplyConfirm] = useState(false)
  const [rollbackResult, setRollbackResult] = useState<{ restored: string[]; missing: string[] } | null>(null)
  const [expandedSkipped, setExpandedSkipped] = useState<Record<string, boolean>>({})
  const [selectedPatchIndex, setSelectedPatchIndex] = useState<number | null>(null)

  const findings = useMemo(() => {
    if (!run) return []
    return run.findings.filter(f => f.status?.toUpperCase() === 'FAIL')
  }, [run])

  const pillars = useMemo(() => {
    const set = new Set<string>()
    findings.forEach(f => { if (f.pillar) set.add(f.pillar) })
    return Array.from(set).sort()
  }, [findings])

  const controlIds = useMemo(() => {
    const set = new Set<string>()
    findings.forEach(f => { if (f.control_id) set.add(f.control_id) })
    return Array.from(set).sort()
  }, [findings])

  useEffect(() => {
    if (pillars.length && !pillar) setPillar(pillars[0])
    if (controlIds.length && !controlId) setControlId(controlIds[0])
  }, [pillars, controlIds, pillar, controlId])

  if (!run) {
    return (
      <div style={{ padding: '2rem', color: 'var(--muted)', textAlign: 'center' }}>
        Select a run to use the Auto-Fix wizard.
      </div>
    )
  }

  const iacPath = run.path || run.source_paths?.[0]
  if (!iacPath) {
    return (
      <div style={{ padding: '2rem', color: 'var(--muted)', textAlign: 'center' }}>
        This run does not have an associated IaC path, so auto-fix cannot be invoked.
      </div>
    )
  }

  const selectedControlIds = useMemo(() => {
    if (mode === 'all') return undefined
    if (mode === 'pillar') {
      const ids = new Set<string>()
      findings.forEach(f => { if (f.pillar === pillar && f.control_id) ids.add(f.control_id) })
      return Array.from(ids)
    }
    return controlId ? [controlId] : undefined
  }, [mode, pillar, controlId, findings])

  const scopedFindings = useMemo(() => {
    if (mode === 'all') return findings
    if (mode === 'pillar') return findings.filter(f => f.pillar === pillar)
    return findings.filter(f => f.control_id === controlId)
  }, [findings, mode, pillar, controlId])

  const failCount = findings.length
  const affectedCount = scopedFindings.length

  function buildLocalFallback(errorMessage?: string): AutoFixResponse {
    return {
      patches_count: 0,
      skipped_count: scopedFindings.length,
      files_modified: [],
      applied: false,
      patches: [],
      skipped: scopedFindings.map(f => ({
        check_id: f.check_id,
        control_id: f.control_id,
        address: f.resource || '',
        attribute: f.message?.split(' ')[0] || '',
        op: 'manual',
        reason: errorMessage || 'Could not contact the classify endpoint.',
      })),
      diff_preview: {},
      warnings: errorMessage
        ? [`Local preview unavailable: ${errorMessage}`]
        : ['Local preview: no run_id was sent, so source snapshots cannot be used to generate diffs.'],
      delta: null,
    }
  }

  async function preview() {
    setLoading(true)
    setError(null)
    setResponse(null)
    setRollbackResult(null)
    setSelectedPatchIndex(null)
    try {
      if (viewMode === 'local') {
        const payload = {
          iac: run?.iac_framework || 'terraform',
          findings: scopedFindings.map(f => ({
            control_id: f.control_id,
            check_id: f.check_id,
            resource: f.resource,
            message: f.message,
          })),
          control_ids: selectedControlIds,
          run_id: run?.id,
        }
        try {
          const res = await postAutoFixClassify(payload)
          setResponse(res)
        } catch (e) {
          setResponse(buildLocalFallback(e instanceof Error ? e.message : 'classify endpoint failed'))
        }
      } else {
        const payload: AutoFixRequest = {
          path: iacPath,
          iac: run?.iac_framework || 'terraform',
          control_ids: selectedControlIds,
          apply: false,
        }
        const res = await postAutoFix(payload)
        setResponse(res)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setLoading(false)
    }
  }

  async function apply() {
    setLoading(true)
    setError(null)
    setRollbackResult(null)
    try {
      const payload: AutoFixRequest = {
        path: iacPath,
        iac: run?.iac_framework || 'terraform',
        control_ids: selectedControlIds,
        apply: true,
      }
      const res = await postAutoFix(payload)
      setResponse(res)
      setShowApplyConfirm(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Apply failed')
    } finally {
      setLoading(false)
    }
  }

  const cliCommand = useMemo(() => {
    const iacFlag = run?.iac_framework && run.iac_framework !== 'terraform'
      ? ` --iac ${run.iac_framework}`
      : ''
    const controlsFlag = selectedControlIds && selectedControlIds.length > 0 && selectedControlIds.length < controlIds.length
      ? ` --controls "${selectedControlIds.join(',')}"`
      : ''
    return `wafpass fix${iacFlag}${controlsFlag} --apply "${iacPath}"`
  }, [run, iacPath, selectedControlIds, controlIds.length])

  async function rollback() {
    setLoading(true)
    setError(null)
    try {
      const res = await postAutoFixRollback(iacPath)
      setRollbackResult(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rollback failed')
    } finally {
      setLoading(false)
    }
  }

  const groupedSkipped = useMemo(() => {
    if (!response) return null
    const byReason: Record<string, AutoFixSkipped[]> = {}
    response.skipped.forEach(s => {
      const k = s.reason || 'unknown'
      ;(byReason[k] ??= []).push(s)
    })
    return byReason
  }, [response])

  const selectedPatch = useMemo(() => {
    if (selectedPatchIndex === null || !response) return null
    return response.patches[selectedPatchIndex] ?? null
  }, [selectedPatchIndex, response])

  const diffLinesForPatch = useMemo(() => {
    if (!selectedPatch || !response?.diff_preview) return null
    const patchFile = selectedPatch.file
    const entries = Object.entries(response.diff_preview)
    const match = entries.find(([file]) =>
      file === patchFile || file.endsWith(`/${patchFile}`) || file.endsWith(patchFile)
    )
    if (!match) return null
    return { file: match[0], lines: match[1] }
  }, [selectedPatch, response])

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <button
          onClick={onBack}
          style={{
            padding: '0.55rem 1.1rem',
            borderRadius: '7px',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        >
          ← Back to dashboard
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.55rem', color: 'var(--text)' }}>Auto-Fix Wizard</h1>
          <div style={{ fontSize: '0.88rem', color: 'var(--muted)', marginTop: '0.3rem' }}>
            {run.project} · {run.branch} · {run.git_sha.slice(0, 7)} · {run.iac_framework || 'terraform'}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {[
          { label: 'Failing findings', value: failCount, color: '#ef4444' },
          { label: 'Selected scope', value: affectedCount, color: '#f59e0b' },
          { label: 'Score', value: `${run.score ?? 0}%`, color: statusColors[run.score >= 80 ? 'PASS' : run.score >= 60 ? 'SKIP' : 'FAIL'] },
        ].map(card => (
          <div
            key={card.label}
            style={{
              padding: '1.1rem 1.25rem',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              background: 'var(--card-bg, #fff)',
            }}
          >
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>{card.label}</div>
            <div style={{ fontSize: '1.55rem', fontWeight: 800, color: card.color, marginTop: '0.25rem' }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'flex-end',
          padding: '1.25rem',
          borderRadius: '10px',
          border: '1px solid var(--border)',
          background: 'var(--card-bg, #fff)',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          {(['all', 'pillar', 'control'] as ScopeMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '0.55rem 1rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: mode === m ? 'rgba(0,148,255,.12)' : 'var(--bg)',
                color: mode === m ? 'var(--waf-brand)' : 'var(--text)',
                fontWeight: mode === m ? 700 : 500,
                cursor: 'pointer',
                fontSize: '0.88rem',
              }}
            >
              {m === 'all' ? 'All failures' : m === 'pillar' ? 'By pillar' : 'By control'}
            </button>
          ))}
        </div>

        {mode === 'pillar' && (
          <select
            value={pillar}
            onChange={e => setPillar(e.target.value)}
            style={{ padding: '0.55rem 0.8rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.88rem' }}
          >
            {pillars.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}

        {mode === 'control' && (
          <select
            value={controlId}
            onChange={e => setControlId(e.target.value)}
            style={{ padding: '0.55rem 0.8rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.88rem', maxWidth: '420px' }}
          >
            {controlIds.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              gap: '0.35rem',
              padding: '0.35rem',
              borderRadius: '6px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
            }}
          >
            {(['server', 'local'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '5px',
                  border: 'none',
                  background: viewMode === v ? 'rgba(0,148,255,.12)' : 'transparent',
                  color: viewMode === v ? 'var(--waf-brand)' : 'var(--muted)',
                  fontWeight: viewMode === v ? 700 : 500,
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                }}
                title={v === 'server' ? 'Call wafpass-server /api/auto-fix (the server must have direct filesystem access to the IaC path)' : 'Build a read-only plan from stored findings and source snapshots (no filesystem access needed)'}
              >
                {v === 'server' ? 'Server preview' : 'Local preview'}
              </button>
            ))}
          </div>

          <button
            onClick={preview}
            disabled={loading}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '7px',
              border: 'none',
              background: 'rgba(0,148,255,.12)',
              color: 'var(--waf-brand)',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading && !response ? 'Previewing…' : 'Preview fixes'}
          </button>

          {response && !response.applied && response.patches_count > 0 && viewMode === 'server' && (
            <button
              onClick={() => setShowApplyConfirm(true)}
              disabled={loading}
              style={{
                padding: '0.6rem 1.2rem',
                borderRadius: '7px',
                border: 'none',
                background: '#22c55e',
                color: '#fff',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                opacity: loading ? 0.6 : 1,
              }}
            >
              Apply fixes
            </button>
          )}

          {response?.applied && (
            <button
              onClick={rollback}
              disabled={loading}
              style={{
                padding: '0.6rem 1.2rem',
                borderRadius: '7px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                opacity: loading ? 0.6 : 1,
              }}
            >
              Rollback
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '1.1rem 1.25rem',
            borderRadius: '8px',
            background: 'rgba(239,68,68,.08)',
            border: '1px solid rgba(239,68,68,.25)',
            color: '#b91c1c',
            fontSize: '0.88rem',
            marginBottom: '1.25rem',
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>Server cannot apply fixes directly</div>
          {error}
          <div style={{ marginTop: '0.75rem', color: 'var(--text)', fontSize: '0.85rem' }}>
            Server preview requires the wafpass-server container to have direct filesystem access to the IaC path. If it does not, switch to <strong>Local preview</strong> or run the CLI locally from the repository root:
          </div>
          <div style={{ position: 'relative', marginTop: '0.5rem' }}>
            <pre
              style={{
                background: '#0f172a',
                color: '#e2e8f0',
                borderRadius: '8px',
                padding: '0.85rem 3rem 0.85rem 1rem',
                fontSize: '0.85rem',
                overflowX: 'auto',
                lineHeight: 1.7,
                margin: 0,
              }}
            >{cliCommand}</pre>
            <CopyButton text={cliCommand} />
          </div>
        </div>
      )}

      {viewMode === 'local' && !response && (
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '8px',
            background: 'rgba(0,148,255,.08)',
            border: '1px solid rgba(0,148,255,.2)',
            color: 'var(--text)',
            fontSize: '0.86rem',
            marginBottom: '1.25rem',
            lineHeight: 1.5,
          }}
        >
          <strong>Local preview mode</strong>
          <div style={{ marginTop: '0.4rem' }}>
            This builds a read-only remediation plan from the stored scan findings. When the run has a stored source snapshot, unified diffs are generated directly from the database; otherwise only the patch list is shown. No filesystem access is required.
          </div>
          <div style={{ marginTop: '0.5rem', color: 'var(--muted)' }}>
            To store snapshots with a local CLI scan, run:{' '}
            <code style={{ background: 'rgba(255,255,255,.1)', padding: '0.15rem 0.35rem', borderRadius: '4px' }}>
              wafpass check ./infra --output json --push @ --upload-source
            </code>
          </div>
        </div>
      )}

      {rollbackResult && (
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: '8px',
            background: rollbackResult.restored.length ? 'rgba(34,197,94,.08)' : 'rgba(245,158,11,.08)',
            border: `1px solid ${rollbackResult.restored.length ? 'rgba(34,197,94,.25)' : 'rgba(245,158,11,.25)'}`,
            color: rollbackResult.restored.length ? '#15803d' : '#92400e',
            fontSize: '0.88rem',
            marginBottom: '1.25rem',
          }}
        >
          {rollbackResult.restored.length
            ? `Rollback complete: restored ${rollbackResult.restored.length} file(s).`
            : `No backup files found to restore.`}
        </div>
      )}

      {response && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            {[
              { label: 'Patches', value: response.patches_count, color: '#22c55e' },
              { label: 'Skipped', value: response.skipped_count, color: '#f59e0b' },
              { label: 'Files modified', value: response.files_modified.length, color: 'var(--waf-brand)' },
            ].map(card => (
              <div
                key={card.label}
                style={{
                  padding: '1rem 1.25rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--card-bg, #fff)',
                }}
              >
                <div style={{ fontSize: '0.76rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>{card.label}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: card.color, marginTop: '0.2rem' }}>{card.value}</div>
              </div>
            ))}
          </div>

          {response.delta && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              {[
                { label: 'Resolved', value: response.delta.resolved.length, color: '#22c55e' },
                { label: 'Still failing', value: response.delta.still_failing.length, color: '#ef4444' },
                { label: 'Regressions', value: response.delta.regressions.length, color: '#7c3aed' },
              ].map(card => (
                <div
                  key={card.label}
                  style={{
                    padding: '0.9rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--card-bg, #fff)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '0.76rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>{card.label}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: card.color, marginTop: '0.2rem' }}>{card.value}</div>
                </div>
              ))}
            </div>
          )}

          {response.warnings.length > 0 && (
            <div
              style={{
                padding: '1rem 1.25rem',
                borderRadius: '8px',
                background: 'rgba(245,158,11,.08)',
                border: '1px solid rgba(245,158,11,.25)',
                color: '#92400e',
                fontSize: '0.86rem',
                marginBottom: '1.5rem',
              }}
            >
              <strong>Warnings</strong>
              <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem' }}>
                {response.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {response.patches_count > 0 && response.diff_preview && Object.keys(response.diff_preview).length > 0 && (
            <section style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.15rem', color: 'var(--text)', marginBottom: '0.9rem' }}>Diff preview</h2>
              <DiffViewer diffPreview={response.diff_preview} />
            </section>
          )}

          {response.patches_count > 0 && (
            <section style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.15rem', color: 'var(--text)', marginBottom: '0.9rem' }}>
                Planned patches
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)', marginLeft: '0.5rem', fontWeight: 500 }}>(click a row to view diff)</span>
              </h2>
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    minWidth: '1400px',
                    tableLayout: 'fixed',
                    borderCollapse: 'collapse',
                    fontSize: '0.88rem',
                  }}
                >
                  <thead>
                    <tr style={{ background: 'rgba(0,148,255,.08)' }}>
                      {tableColumns.map(col => (
                        <th
                          key={col.key}
                          style={{
                            width: col.width,
                            padding: '0.65rem 1rem',
                            textAlign: 'left',
                            fontWeight: 700,
                            color: 'var(--text)',
                            borderBottom: '1px solid var(--border)',
                            fontSize: '0.78rem',
                          }}
                        >
                          {col.key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {response.patches.map((p: AutoFixPatch, i) => (
                      <tr
                        key={i}
                        onClick={() => setSelectedPatchIndex(i)}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          background: selectedPatchIndex === i ? 'rgba(0,148,255,.06)' : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <td style={{ padding: '0.65rem 1rem', color: 'var(--muted)', overflowWrap: 'anywhere' }}>{p.file}</td>
                        <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', color: 'var(--text)', overflowWrap: 'anywhere' }}>{p.address}</td>
                        <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', color: 'var(--text)', overflowWrap: 'anywhere' }}>{p.attribute}</td>
                        <td style={{ padding: '0.65rem 1rem' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              background: p.kind === 'ADD_BLOCK' ? 'rgba(124,58,237,.1)' : 'rgba(0,148,255,.1)',
                              color: p.kind === 'ADD_BLOCK' ? '#7c3aed' : 'var(--waf-brand)',
                            }}
                          >
                            {p.kind}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', color: 'var(--text)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{p.new_value}</td>
                        <td style={{ padding: '0.65rem 1rem', color: 'var(--muted)', overflowWrap: 'anywhere' }}>{p.control_id}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {selectedPatch && (
            <>
              <div
                onClick={() => setSelectedPatchIndex(null)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(15,23,42,.45)',
                  zIndex: 99,
                }}
              />
              <div
                style={{
                  position: 'fixed',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '900px',
                  maxWidth: '94vw',
                  maxHeight: '85vh',
                  background: 'var(--card-bg, #fff)',
                  borderRadius: '12px',
                  boxShadow: '0 24px 64px rgba(15,23,42,.25)',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '1rem 1.25rem',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text)' }}>Patch diff</h3>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.25rem', overflowWrap: 'anywhere' }}>
                      {selectedPatch.address} · {selectedPatch.attribute} · {selectedPatch.file}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPatchIndex(null)}
                    style={{
                      padding: '0.4rem 0.85rem',
                      borderRadius: '7px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    Close
                  </button>
                </div>
                <div style={{ flex: 1, overflow: 'auto', background: '#0f172a' }}>
                  {diffLinesForPatch ? (
                    <pre
                      style={{
                        margin: 0,
                        padding: '1rem 1.25rem',
                        fontSize: '0.78rem',
                        lineHeight: 1.6,
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        color: '#e2e8f0',
                      }}
                    >
                      {diffLinesForPatch.lines.map((line, idx) => {
                        let bg: string | undefined
                        let color = '#e2e8f0'
                        if (line.startsWith('+')) {
                          bg = 'rgba(34,197,94,.12)'
                          color = '#86efac'
                        } else if (line.startsWith('-')) {
                          bg = 'rgba(239,68,68,.12)'
                          color = '#fca5a5'
                        } else if (line.startsWith('@@') || line.startsWith('---') || line.startsWith('+++')) {
                          color = '#94a3b8'
                        }
                        return (
                          <div
                            key={idx}
                            style={{
                              background: bg,
                              color,
                              whiteSpace: 'pre',
                              padding: '0 0.35rem',
                            }}
                          >
                            {line || ' '}
                          </div>
                        )
                      })}
                    </pre>
                  ) : (
                    <div
                      style={{
                        padding: '2rem 1.25rem',
                        color: '#94a3b8',
                        fontSize: '0.85rem',
                        lineHeight: 1.6,
                      }}
                    >
                      <strong>No diff preview available for this patch.</strong>
                      <div style={{ marginTop: '0.5rem' }}>
                        {viewMode === 'local'
                          ? 'No unified diff is available for this patch. The source files are not stored for this run because it was pushed from a CI/CD pipeline (POST /runs). Only runs created via a server-side scan (POST /scan) keep a source snapshot. Switch to Server preview or run the CLI locally to see file-level changes.'
                          : 'The server did not return a diff for this file. This can happen when the patch target file is outside the scanned path or no textual change could be derived.'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {viewMode === 'local' && response.patches_count > 0 && (
            <section style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.15rem', color: 'var(--text)', marginBottom: '0.9rem' }}>Apply locally</h2>
              <div
                style={{
                  padding: '1rem 1.25rem',
                  borderRadius: '8px',
                  background: 'rgba(0,148,255,.08)',
                  border: '1px solid rgba(0,148,255,.2)',
                  color: 'var(--text)',
                  fontSize: '0.86rem',
                  lineHeight: 1.5,
                }}
              >
                The local preview is read-only. To actually modify the source files, run this command where your IaC is checked out:
              </div>
              <div style={{ position: 'relative', marginTop: '0.5rem' }}>
                <pre
                  style={{
                    background: '#0f172a',
                    color: '#e2e8f0',
                    borderRadius: '8px',
                    padding: '0.85rem 3rem 0.85rem 1rem',
                    fontSize: '0.85rem',
                    overflowX: 'auto',
                    lineHeight: 1.7,
                    margin: 0,
                  }}
                >{cliCommand}</pre>
                <CopyButton text={cliCommand} />
              </div>
            </section>
          )}

          {groupedSkipped && response.skipped_count > 0 && (
            <section>
              <h2 style={{ fontSize: '1.15rem', color: 'var(--text)', marginBottom: '0.9rem' }}>
                Manual remediation
                <span style={{ fontSize: '0.8rem', color: 'var(--muted)', marginLeft: '0.5rem', fontWeight: 500 }}>({response.skipped_count})</span>
              </h2>
              {Object.entries(groupedSkipped).map(([reason, items]) => {
                const expanded = expandedSkipped[reason] ?? false
                const showInitially = 5
                const hiddenCount = items.length - showInitially
                return (
                  <div key={reason} style={{ marginBottom: '1rem' }}>
                    <button
                      onClick={() => setExpandedSkipped(prev => ({ ...prev, [reason]: !expanded }))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        width: '100%',
                        textAlign: 'left',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: '#b45309',
                        background: 'transparent',
                        border: 'none',
                        padding: '0.35rem 0',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{expanded ? '▼' : '▶'}</span>
                      <span>{reason}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 500 }}>({items.length})</span>
                    </button>
                    {expanded && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.4rem' }}>
                        {items.map((s: AutoFixSkipped, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              gap: '1rem',
                              fontSize: '0.8rem',
                              padding: '0.5rem 0.75rem',
                              borderRadius: '6px',
                              background: 'rgba(245,158,11,.05)',
                              border: '1px solid rgba(245,158,11,.12)',
                            }}
                          >
                            <span style={{ fontFamily: 'monospace', color: 'var(--muted)', flexShrink: 0 }}>{s.control_id}</span>
                            <span style={{ fontFamily: 'monospace', color: 'var(--text)' }}>{s.address || '—'}</span>
                            <span style={{ color: 'var(--muted)' }}>{s.attribute}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {!expanded && hiddenCount > 0 && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.3rem', marginLeft: '1.3rem' }}>
                        {items.length} item(s) — click to expand
                      </div>
                    )}
                  </div>
                )
              })}
            </section>
          )}

          {response.patches_count === 0 && response.skipped_count === 0 && (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.9rem' }}>
              No fixes could be derived for the selected scope.
            </div>
          )}
        </>
      )}

      {showApplyConfirm && (
        <>
          <div
            onClick={() => setShowApplyConfirm(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 99 }}
          />
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '520px',
              maxWidth: '92vw',
              background: 'var(--card-bg, #fff)',
              borderRadius: '12px',
              boxShadow: '0 24px 64px rgba(15,23,42,.2)',
              padding: '1.5rem',
              zIndex: 100,
            }}
          >
            <h3 style={{ margin: '0 0 0.6rem', fontSize: '1.15rem', color: 'var(--text)' }}>Apply fixes?</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--muted)', lineHeight: 1.5 }}>
              This will write {response?.patches_count} patch(es) to {response?.files_modified.length} file(s).
              A <code>.bak</code> backup is created for each modified file and can be restored with the rollback button.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.25rem' }}>
              <button
                onClick={() => setShowApplyConfirm(false)}
                style={{
                  padding: '0.55rem 1.1rem',
                  borderRadius: '7px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={apply}
                disabled={loading}
                style={{
                  padding: '0.55rem 1.1rem',
                  borderRadius: '7px',
                  border: 'none',
                  background: '#22c55e',
                  color: '#fff',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? 'Applying…' : 'Confirm apply'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
