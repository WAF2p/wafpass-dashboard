import { useMemo, useState } from 'react'
import { RunSummary } from '../api'

interface Props {
  runs: RunSummary[]
  selectedId: string | null
  onSelect: (id: string) => void
  onClose: () => void
}

function scoreColor(s: number) {
  return s >= 80 ? '#059669' : s >= 60 ? '#d97706' : '#DA2C38'
}

export default function RunSelectorModal({ runs, selectedId, onSelect, onClose }: Props) {
  const [search, setSearch]     = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return runs.filter(r => {
      if (q && !r.project?.toLowerCase().includes(q) &&
               !r.branch?.toLowerCase().includes(q) &&
               !r.git_sha?.toLowerCase().includes(q)) return false
      if (dateFrom && new Date(r.created_at) < new Date(dateFrom)) return false
      if (dateTo   && new Date(r.created_at) > new Date(dateTo + 'T23:59:59')) return false
      return true
    })
  }, [runs, search, dateFrom, dateTo])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
          zIndex: 9999, backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10000, width: '660px', maxWidth: '95vw',
        background: 'var(--surface)', borderRadius: '16px',
        border: '1px solid var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,.22)',
        display: 'flex', flexDirection: 'column', maxHeight: '80vh',
      }}>

        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>Select Active Run</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
              {runs.length} run{runs.length !== 1 ? 's' : ''} available
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: '8px',
              color: 'var(--muted)', cursor: 'pointer', padding: '0.3rem 0.65rem', fontSize: '0.85rem',
            }}
          >✕</button>
        </div>

        {/* Filters */}
        <div style={{
          padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)',
          display: 'flex', gap: '0.75rem', flexShrink: 0, flexWrap: 'wrap', alignItems: 'flex-end',
        }}>
          {/* Search */}
          <div style={{ flex: 1, minWidth: '180px', position: 'relative' }}>
            <svg
              width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"
              style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              autoFocus
              type="text"
              placeholder="Search project, branch, SHA…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', paddingLeft: '2.1rem', paddingRight: '0.75rem',
                paddingTop: '0.45rem', paddingBottom: '0.45rem',
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: '8px', fontSize: '0.83rem', color: 'var(--text)', outline: 'none',
              }}
            />
          </div>

          {/* Date from */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.62rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '0.4rem 0.6rem',
                fontSize: '0.82rem', color: 'var(--text)', outline: 'none', cursor: 'pointer',
              }}
            />
          </div>

          {/* Date to */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.62rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '0.4rem 0.6rem',
                fontSize: '0.82rem', color: 'var(--text)', outline: 'none', cursor: 'pointer',
              }}
            />
          </div>

          {/* Clear dates */}
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo('') }}
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: '8px',
                color: 'var(--muted)', cursor: 'pointer', padding: '0.4rem 0.65rem',
                fontSize: '0.78rem', alignSelf: 'flex-end',
              }}
            >Clear dates</button>
          )}
        </div>

        {/* Run list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
              No runs match your filters.
            </div>
          ) : filtered.map(r => {
            const isActive = r.id === selectedId
            return (
              <button
                key={r.id}
                onClick={() => { onSelect(r.id); onClose() }}
                style={{
                  width: '100%', textAlign: 'left', border: 'none',
                  background: isActive ? 'rgba(0,148,255,.07)' : 'transparent',
                  borderBottom: '1px solid var(--border)',
                  padding: '0.875rem 1.5rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg)' }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                {/* Score badge */}
                <div style={{
                  width: '2.75rem', height: '2.75rem', borderRadius: '10px', flexShrink: 0,
                  background: `${scoreColor(r.score)}18`,
                  border: `2px solid ${scoreColor(r.score)}${isActive ? 'cc' : '40'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.85rem', fontWeight: 800, color: scoreColor(r.score),
                }}>
                  {r.score}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <span style={{
                      fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {r.project || 'unnamed'}
                    </span>
                    {isActive && (
                      <span style={{
                        fontSize: '0.62rem', fontWeight: 700, flexShrink: 0,
                        background: 'rgba(0,148,255,.15)', color: '#0094FF',
                        borderRadius: '999px', padding: '0.1rem 0.5rem',
                      }}>Active</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--muted)', flexWrap: 'wrap' }}>
                    {r.branch       && <span>{r.branch}</span>}
                    {r.git_sha      && <span style={{ fontFamily: 'ui-monospace, monospace' }}>{r.git_sha.slice(0, 7)}</span>}
                    {r.iac_framework && <span>{r.iac_framework}</span>}
                    {r.path         && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{r.path}</span>}
                  </div>
                </div>

                {/* Date + time */}
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', flexShrink: 0, textAlign: 'right', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 500, color: 'var(--text)' }}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </div>
                  <div>
                    {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: '0.875rem 1.5rem', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            {filtered.length} of {runs.length} shown
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '0.45rem 1.1rem', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--bg)',
              color: 'var(--text)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
            }}
          >Cancel</button>
        </div>
      </div>
    </>
  )
}
