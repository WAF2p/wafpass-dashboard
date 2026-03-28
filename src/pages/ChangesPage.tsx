import { useState } from 'react'
import { PlanChange, PlanChanges, RunDetail } from '../api'

interface Props { run: RunDetail }

const ACTION_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  create:  { label: 'Add',     color: '#16a34a', bg: 'rgba(22,163,74,.08)',   icon: '+' },
  update:  { label: 'Change',  color: '#d97706', bg: 'rgba(217,119,6,.08)',   icon: '~' },
  delete:  { label: 'Destroy', color: '#dc2626', bg: 'rgba(220,38,38,.08)',   icon: '−' },
  replace: { label: 'Replace', color: '#7c3aed', bg: 'rgba(124,58,237,.08)', icon: '⟳' },
  'no-op': { label: 'No-op',   color: '#94a3b8', bg: 'transparent',           icon: '·' },
}

function actionMeta(action: string) {
  return ACTION_META[action] ?? ACTION_META['no-op']
}

function SummaryPill({ count, action }: { count: number; action: string }) {
  const { label, color, bg, icon } = actionMeta(action)
  if (count === 0) return null
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '0.75rem 1.25rem', borderRadius: '12px',
      background: bg, border: `1px solid ${color}33`,
      minWidth: '90px',
    }}>
      <div style={{ fontSize: '1.875rem', fontWeight: 800, color, lineHeight: 1 }}>{count}</div>
      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginTop: '0.2rem' }}>
        <span style={{ marginRight: '0.25rem', fontFamily: 'monospace', fontWeight: 800 }}>{icon}</span>
        {label}
      </div>
    </div>
  )
}

function ChangeRow({ change }: { change: PlanChange }) {
  const { color, bg, icon } = actionMeta(change.action)
  const hasModule = Boolean(change.module_address)

  return (
    <tr
      style={{ borderTop: '1px solid var(--border)', cursor: 'default' }}
      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
    >
      <td style={{ padding: '0.65rem 0.75rem', width: '2.25rem', textAlign: 'center' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '1.5rem', height: '1.5rem', borderRadius: '5px',
          background: bg, color, fontFamily: 'monospace', fontWeight: 800, fontSize: '0.8rem',
        }}>
          {icon}
        </span>
      </td>
      <td style={{ padding: '0.65rem 0.5rem' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text)', fontWeight: 600 }}>
          {change.address}
        </div>
        {hasModule && (
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
            module: {change.module_address}
          </div>
        )}
      </td>
      <td style={{ padding: '0.65rem 0.5rem', whiteSpace: 'nowrap' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--muted)' }}>
          {change.type}
        </span>
      </td>
      <td style={{ padding: '0.65rem 0.5rem', whiteSpace: 'nowrap' }}>
        {change.provider && (
          <span style={{
            padding: '0.1rem 0.4rem', borderRadius: '999px',
            background: 'rgba(0,148,255,.08)', color: 'var(--waf-brand)',
            fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
          }}>
            {change.provider}
          </span>
        )}
      </td>
      <td style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap' }}>
        <span style={{
          padding: '0.15rem 0.5rem', borderRadius: '999px',
          background: bg, color, fontSize: '0.68rem', fontWeight: 700,
        }}>
          {actionMeta(change.action).label}
        </span>
      </td>
    </tr>
  )
}

function NoChanges({ plan }: { plan: PlanChanges }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '3.5rem 2rem', gap: '1rem', textAlign: 'center',
    }}>
      <div style={{
        width: '3.5rem', height: '3.5rem', borderRadius: '50%',
        background: 'rgba(22,163,74,.1)', border: '2px solid rgba(22,163,74,.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg style={{ width: '1.75rem', height: '1.75rem', color: '#16a34a' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#16a34a' }}>No Infrastructure Changes</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '0.35rem' }}>
          This plan contains no resource additions, modifications, replacements, or deletions.
        </div>
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
        {plan.summary.no_op > 0 && (
          <span>{plan.summary.no_op} resource{plan.summary.no_op !== 1 ? 's' : ''} in state — all up to date</span>
        )}
      </div>
    </div>
  )
}

function NoPlanData({ run }: { run: RunDetail }) {
  const iacPath = run.path || run.source_paths?.[0] || '/path/to/terraform'
  const iac = run.iac_framework && run.iac_framework !== 'terraform' ? ` --iac ${run.iac_framework}` : ''
  const pushUrl = `${window.location.origin}`
  const [copied, setCopied] = useState(false)
  const cmd = `terraform plan -out=tfplan\nterraform show -json tfplan > plan.json\nwafpass check${iac} --output json --push ${pushUrl}/runs --plan-file plan.json ${iacPath}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '680px' }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
        padding: '1rem 1.1rem', borderRadius: '10px',
        background: 'rgba(148,163,184,.08)', border: '1px solid rgba(148,163,184,.2)',
      }}>
        <svg style={{ width: '1.1rem', height: '1.1rem', color: 'var(--muted)', flexShrink: 0, marginTop: '0.1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.25rem' }}>
            No plan data for this run
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.6 }}>
            This run was submitted without a <code style={{ color: 'var(--text)' }}>--plan-file</code>.
            Re-run with a Terraform plan JSON to see resource change analysis here.
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
          How to include plan data
        </div>
        <div style={{ position: 'relative' }}>
          <pre style={{
            background: '#0f172a', color: '#e2e8f0', borderRadius: '8px',
            padding: '0.875rem 3rem 0.875rem 0.875rem', fontSize: '0.78rem',
            overflowX: 'auto', lineHeight: 1.8, margin: 0,
          }}>
            {cmd}
          </pre>
          <button
            onClick={() => navigator.clipboard.writeText(cmd).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })}
            style={{
              position: 'absolute', top: '0.5rem', right: '0.5rem',
              background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)',
              borderRadius: '5px', color: copied ? '#22c55e' : '#94a3b8',
              fontSize: '0.65rem', padding: '0.2rem 0.5rem', cursor: 'pointer',
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.7 }}>
        The plan file is produced by <code style={{ color: 'var(--text)' }}>terraform show -json</code>.
        It contains a machine-readable description of every resource that Terraform intends to add,
        change, replace, or destroy. WAF++ embeds this in the push payload so the dashboard can
        display a <strong style={{ color: 'var(--text)' }}>Change Overview</strong> alongside compliance findings.
      </div>
    </div>
  )
}

export default function ChangesPage({ run }: Props) {
  const plan = run.plan_changes

  const [actionFilter, setActionFilter] = useState('')
  const [providerFilter, setProviderFilter] = useState('')
  const [search, setSearch] = useState('')

  if (!plan) return (
    <div style={{ maxWidth: '780px', margin: '0 auto' }}>
      <NoPlanData run={run} />
    </div>
  )

  const totalChanges = (plan.summary.add ?? 0) + (plan.summary.change ?? 0)
    + (plan.summary.destroy ?? 0) + (plan.summary.replace ?? 0)

  const providers = Array.from(new Set(plan.changes.map(c => c.provider).filter(Boolean))).sort()

  const filtered = plan.changes.filter(c => {
    const actionMapped: Record<string, string> = { create: 'create', update: 'update', delete: 'delete', replace: 'replace' }
    if (actionFilter && actionMapped[c.action] !== actionFilter) return false
    if (providerFilter && c.provider !== providerFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!c.address.toLowerCase().includes(q) && !c.type.toLowerCase().includes(q)) return false
    }
    return true
  })

  const selectStyle = {
    background: '#fff', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.8rem', outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Meta banner */}
      <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(0,148,255,.05)', border: '1px solid rgba(0,148,255,.15)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
        <div>
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>Terraform</span>
          {plan.terraform_version && <span style={{ marginLeft: '0.35rem', fontFamily: 'monospace' }}>v{plan.terraform_version}</span>}
        </div>
        {plan.scanned_at && (
          <div>Plan captured: <span style={{ color: 'var(--text)' }}>{new Date(plan.scanned_at).toLocaleString()}</span></div>
        )}
        <div style={{ marginLeft: 'auto', fontWeight: 600, color: totalChanges > 0 ? '#d97706' : '#16a34a' }}>
          {totalChanges === 0 ? 'No changes' : `${totalChanges} resource change${totalChanges !== 1 ? 's' : ''}`}
        </div>
      </div>

      {/* Summary strip */}
      {totalChanges === 0 ? (
        <div className="card" style={{ padding: 0 }}>
          <NoChanges plan={plan} />
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <SummaryPill count={plan.summary.add}     action="create"  />
            <SummaryPill count={plan.summary.change}  action="update"  />
            <SummaryPill count={plan.summary.replace} action="replace" />
            <SummaryPill count={plan.summary.destroy} action="delete"  />
            {plan.summary.no_op > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0.5rem 0.75rem', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)', fontSize: '0.72rem', color: 'var(--muted)' }}>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{plan.summary.no_op}</span>
                <span>unchanged</span>
              </div>
            )}
          </div>

          {/* Filter bar */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              placeholder="Search address or type…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ ...selectStyle, flex: '1', minWidth: '200px' }}
            />
            <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={selectStyle}>
              <option value="">All actions</option>
              <option value="create">Add</option>
              <option value="update">Change</option>
              <option value="replace">Replace</option>
              <option value="delete">Destroy</option>
            </select>
            {providers.length > 1 && (
              <select value={providerFilter} onChange={e => setProviderFilter(e.target.value)} style={selectStyle}>
                <option value="">All providers</option>
                {providers.map(p => <option key={p}>{p}</option>)}
              </select>
            )}
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
              {filtered.length} / {plan.changes.length}
            </span>
          </div>

          {/* Changes table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    <th style={{ padding: '0.6rem 0.75rem', width: '2.25rem' }} />
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Address</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Provider</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => <ChangeRow key={i} change={c} />)}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                        No changes match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Breakdown by type */}
          {plan.changes.length > 0 && (() => {
            const byType = plan.changes.reduce<Record<string, { add: number; update: number; delete: number; replace: number }>>((acc, c) => {
              if (!acc[c.type]) acc[c.type] = { add: 0, update: 0, delete: 0, replace: 0 }
              if (c.action === 'create')  acc[c.type].add++
              if (c.action === 'update')  acc[c.type].update++
              if (c.action === 'delete')  acc[c.type].delete++
              if (c.action === 'replace') acc[c.type].replace++
              return acc
            }, {})
            const rows = Object.entries(byType).sort((a, b) => {
              const ta = a[1].add + a[1].update + a[1].delete + a[1].replace
              const tb = b[1].add + b[1].update + b[1].delete + b[1].replace
              return tb - ta
            })
            if (!rows.length) return null
            return (
              <div className="card">
                <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.875rem' }}>
                  Breakdown by Resource Type
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {rows.map(([type, counts]) => {
                    const total = counts.add + counts.update + counts.delete + counts.replace
                    return (
                      <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem' }}>
                        <span style={{ fontFamily: 'monospace', color: 'var(--text)', flex: '1', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{type}</span>
                        <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                          {counts.add > 0     && <span style={{ padding: '0.1rem 0.4rem', borderRadius: '5px', background: 'rgba(22,163,74,.1)',   color: '#16a34a', fontSize: '0.68rem', fontWeight: 700 }}>+{counts.add}</span>}
                          {counts.update > 0  && <span style={{ padding: '0.1rem 0.4rem', borderRadius: '5px', background: 'rgba(217,119,6,.1)',  color: '#d97706', fontSize: '0.68rem', fontWeight: 700 }}>~{counts.update}</span>}
                          {counts.replace > 0 && <span style={{ padding: '0.1rem 0.4rem', borderRadius: '5px', background: 'rgba(124,58,237,.1)', color: '#7c3aed', fontSize: '0.68rem', fontWeight: 700 }}>⟳{counts.replace}</span>}
                          {counts.delete > 0  && <span style={{ padding: '0.1rem 0.4rem', borderRadius: '5px', background: 'rgba(220,38,38,.1)',  color: '#dc2626', fontSize: '0.68rem', fontWeight: 700 }}>−{counts.delete}</span>}
                        </div>
                        <span style={{ color: 'var(--muted)', fontSize: '0.7rem', flexShrink: 0, minWidth: '1.5rem', textAlign: 'right' }}>{total}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}
