import { useEffect, useMemo, useState } from 'react'
import {
  AuditCategory, AuditEvent,
  clearAuditLog, clearFirstSeen,
  FirstSeenEntry, loadAuditLog, loadFirstSeen,
} from '../audit'
import { fetchServerAuditEvents, ServerAuditEvent } from '../api'
import { useI18n } from '../i18n'

// ─── Category metadata ────────────────────────────────────────────────────────

const CAT_META: Record<AuditCategory, { label: string; color: string; bg: string }> = {
  waiver:  { label: 'Waiver',  color: '#2563eb', bg: 'rgba(37,99,235,.10)'  },
  risk:    { label: 'Risk',    color: '#7c3aed', bg: 'rgba(124,58,237,.10)' },
  scan:    { label: 'Scan',    color: '#059669', bg: 'rgba(5,150,105,.10)'  },
  finding: { label: 'Finding', color: '#d97706', bg: 'rgba(217,119,6,.10)'  },
}

const ACTION_LABEL: Record<string, string> = {
  waiver_created:       'Waiver created',
  waiver_updated:       'Waiver updated',
  waiver_deleted:       'Waiver removed',
  risk_created:         'Risk accepted',
  risk_updated:         'Risk updated',
  risk_deleted:         'Risk removed',
  scan_received:        'Scan received',
  control_first_failed: 'First seen failing',
}

const SEV_COLOR: Record<string, string> = {
  critical: '#dc2626', high: '#d97706', medium: '#2563eb', low: '#059669', info: '#94a3b8',
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function eventsToCSV(events: AuditEvent[]): string {
  const header = 'id,timestamp,actor,category,action,subject_id,subject_type,summary'
  const rows = events.map(e =>
    [e.id, e.timestamp, e.actor, e.category, e.action, e.subject_id, e.subject_type, `"${e.summary.replace(/"/g, '""')}"`].join(',')
  )
  return [header, ...rows].join('\n')
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Event row ────────────────────────────────────────────────────────────────

function EventRow({ event }: { event: AuditEvent }) {
  const [open, setOpen] = useState(false)
  const cat = CAT_META[event.category] ?? CAT_META.scan
  const hasDiff = event.before !== undefined || event.after !== undefined

  const relTime = (() => {
    const diff = Date.now() - new Date(event.timestamp).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
  })()

  return (
    <div style={{ borderBottom: '1px solid var(--card-border)' }}>
      <div
        style={{ padding: '10px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, cursor: hasDiff ? 'pointer' : 'default' }}
        onClick={() => hasDiff && setOpen(o => !o)}
      >
        {/* Category badge */}
        <span style={{
          fontSize: 10, fontWeight: 700, color: cat.color, background: cat.bg,
          border: `1px solid ${cat.color}33`, borderRadius: 4, padding: '2px 6px',
          textTransform: 'uppercase', flexShrink: 0, marginTop: 2, minWidth: 52, textAlign: 'center',
        }}>
          {cat.label}
        </span>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {ACTION_LABEL[event.action] ?? event.action}
            </span>
            <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 3, padding: '1px 5px' }}>
              {event.subject_id}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{event.summary}</div>
        </div>

        {/* Meta */}
        <div style={{ flexShrink: 0, textAlign: 'right', fontSize: 11 }}>
          <div style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{relTime}</div>
          <div style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', marginTop: 1 }}>{event.actor}</div>
          {hasDiff && (
            <div style={{ color: cat.color, marginTop: 2 }}>{open ? '▲ hide' : '▼ diff'}</div>
          )}
        </div>
      </div>

      {/* Diff panel */}
      {open && hasDiff && (
        <div style={{ padding: '0 16px 12px 80px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {(['before', 'after'] as const).map(side => {
              const val = event[side]
              if (val === undefined) return null
              return (
                <div key={side}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: side === 'before' ? '#dc2626' : '#059669', marginBottom: 4 }}>
                    {side}
                  </div>
                  <pre style={{
                    margin: 0, fontSize: 11, fontFamily: 'monospace', lineHeight: 1.5,
                    background: side === 'before' ? 'rgba(220,38,38,.04)' : 'rgba(5,150,105,.04)',
                    border: `1px solid ${side === 'before' ? 'rgba(220,38,38,.15)' : 'rgba(5,150,105,.15)'}`,
                    borderRadius: 6, padding: '8px 10px', overflow: 'auto', maxHeight: 220,
                    color: 'var(--text-secondary)',
                  }}>
                    {JSON.stringify(val, null, 2)}
                  </pre>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            event id: {event.id} · {new Date(event.timestamp).toISOString()}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── First-seen table ─────────────────────────────────────────────────────────

function FirstSeenTable({ entries }: { entries: FirstSeenEntry[] }) {
  const { t } = useI18n()
  const [sevFilter, setSevFilter] = useState('')
  const [pillarFilter, setPillarFilter] = useState('')
  const [search, setSearch] = useState('')

  const pillars = useMemo(() => [...new Set(entries.map(e => e.pillar).filter(Boolean))].sort(), [entries])

  const filtered = useMemo(() => entries.filter(e =>
    (!sevFilter || e.severity?.toLowerCase() === sevFilter) &&
    (!pillarFilter || e.pillar === pillarFilter) &&
    (!search || e.control_id.toLowerCase().includes(search.toLowerCase()) || e.resource.toLowerCase().includes(search.toLowerCase()))
  ), [entries, sevFilter, pillarFilter, search])

  const sorted = [...filtered].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  // Duration: days since first seen
  const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)

  const selectStyle = { padding: '4px 8px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 12 }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search control or resource…"
          style={{ ...selectStyle, flex: 1, minWidth: 180 }} />
        <select value={sevFilter} onChange={e => setSevFilter(e.target.value)} style={selectStyle}>
          <option value="">{t('pages.findings.allSeverities')}</option>
          {['critical', 'high', 'medium', 'low'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={pillarFilter} onChange={e => setPillarFilter(e.target.value)} style={selectStyle}>
          <option value="">{t('pages.findings.allPillars')}</option>
          {pillars.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {(sevFilter || pillarFilter || search) && (
          <button onClick={() => { setSevFilter(''); setPillarFilter(''); setSearch('') }}
            style={{ ...selectStyle, cursor: 'pointer', background: 'none' }}>Clear</button>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{filtered.length} / {entries.length}</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)' }}>
              {[t('pages.audit.colControl'), t('pages.audit.colResource'), t('pages.audit.colSeverity'), t('pages.audit.colPillar'), t('pages.audit.colProject'), t('pages.audit.colFirstSeen'), t('pages.audit.colAge')].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((e, i) => {
              const days = daysSince(e.timestamp)
              const ageColor = days > 90 ? '#dc2626' : days > 30 ? '#d97706' : '#059669'
              return (
                <tr key={i} style={{ borderTop: '1px solid var(--card-border)' }}>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>{e.control_id}</td>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 10, color: 'var(--text-muted)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.resource}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: SEV_COLOR[e.severity?.toLowerCase()] ?? '#94a3b8', background: `${SEV_COLOR[e.severity?.toLowerCase()] ?? '#94a3b8'}18`, border: `1px solid ${SEV_COLOR[e.severity?.toLowerCase()] ?? '#94a3b8'}33`, borderRadius: 4, padding: '1px 5px', textTransform: 'uppercase' }}>
                      {e.severity}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{e.pillar}</td>
                  <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{e.project} / {e.branch}</td>
                  <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{new Date(e.timestamp).toLocaleDateString()}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: ageColor }}>{days}d</span>
                  </td>
                </tr>
              )
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                {t('pages.audit.noFirstSeen')}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function serverToAuditEvent(s: ServerAuditEvent): AuditEvent {
  return {
    id: s.client_id || s.id,
    timestamp: s.timestamp,
    actor: s.actor,
    category: s.category as AuditCategory,
    action: s.action as AuditEvent['action'],
    subject_id: s.subject_id,
    subject_type: s.subject_type,
    summary: s.summary,
    before: s.before ?? undefined,
    after: s.after ?? undefined,
  }
}

export default function AuditLogPage() {
  const { t } = useI18n()
  const [events, setEvents] = useState<AuditEvent[]>(() => loadAuditLog())
  const [serverCount, setServerCount] = useState<number | null>(null)
  const [firstSeen, setFirstSeen] = useState<Record<string, FirstSeenEntry>>(() => loadFirstSeen())
  const [tab, setTab] = useState<'events' | 'exposure'>('events')
  const [catFilter, setCatFilter] = useState<AuditCategory | ''>('')
  const [search, setSearch] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  // Merge server events with localStorage on mount
  useEffect(() => {
    fetchServerAuditEvents({ limit: 2000 }).then(serverEvents => {
      setServerCount(serverEvents.length)
      if (serverEvents.length === 0) return
      const serverIds = new Set(serverEvents.map(e => e.client_id || e.id))
      const local = loadAuditLog().filter(e => !serverIds.has(e.id))
      const merged = [
        ...serverEvents.map(serverToAuditEvent),
        ...local,
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      setEvents(merged)
    }).catch(() => { /* server unavailable — local-only mode */ })
  }, [])

  const firstSeenEntries = useMemo(() => Object.values(firstSeen), [firstSeen])

  const filtered = useMemo(() => events.filter(e =>
    (!catFilter || e.category === catFilter) &&
    (!search || e.summary.toLowerCase().includes(search.toLowerCase()) ||
      e.subject_id.toLowerCase().includes(search.toLowerCase()) ||
      e.actor.toLowerCase().includes(search.toLowerCase()))
  ), [events, catFilter, search])

  // Stats
  const stats = useMemo(() => ({
    total:    events.length,
    waivers:  events.filter(e => e.category === 'waiver').length,
    risks:    events.filter(e => e.category === 'risk').length,
    scans:    events.filter(e => e.category === 'scan').length,
    findings: firstSeenEntries.length,
    critOrHigh: firstSeenEntries.filter(e => ['critical', 'high'].includes(e.severity?.toLowerCase())).length,
    oldestFailDays: firstSeenEntries.length
      ? Math.max(...firstSeenEntries.map(e => Math.floor((Date.now() - new Date(e.timestamp).getTime()) / 86400000)))
      : 0,
  }), [events, firstSeenEntries])

  function handleClear() {
    clearAuditLog()
    clearFirstSeen()
    setEvents([])
    setFirstSeen({})
    setConfirmClear(false)
  }

  const selectStyle = { padding: '5px 10px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 12 }

  return (
    <div style={{ padding: '0 0 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Stats strip ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {[
          { label: t('pages.audit.totalEvents'),      value: stats.total,       color: 'var(--text-primary)' },
          { label: t('pages.audit.waiverEvents'),     value: stats.waivers,     color: '#2563eb' },
          { label: t('pages.audit.riskEvents'),       value: stats.risks,       color: '#7c3aed' },
          { label: t('pages.audit.scansReceived'),    value: stats.scans,       color: '#059669' },
          { label: t('pages.audit.controlsTracked'),  value: stats.findings,    color: '#d97706' },
          { label: t('pages.audit.critHighTracked'),  value: stats.critOrHigh,  color: '#dc2626' },
          ...(stats.oldestFailDays > 0
            ? [{ label: t('pages.audit.oldestFailure'), value: `${stats.oldestFailDays}d`, color: stats.oldestFailDays > 90 ? '#dc2626' : '#d97706' }]
            : []),
        ].map(({ label, value, color }) => (
          <div key={label} style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid var(--card-border)', textAlign: 'center', minWidth: 100 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Server sync banner ───────────────────────────────────────────── */}
      {serverCount !== null && (
        <div style={{
          marginBottom: 16, padding: '8px 14px', borderRadius: 7, fontSize: 12,
          background: serverCount > 0 ? 'rgba(5,150,105,.07)' : 'rgba(148,163,184,.08)',
          border: `1px solid ${serverCount > 0 ? 'rgba(5,150,105,.25)' : 'rgba(148,163,184,.25)'}`,
          color: serverCount > 0 ? '#059669' : 'var(--text-muted)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontWeight: 700 }}>{serverCount > 0 ? '✓ Server sync active' : 'ℹ Local-only mode'}</span>
          {serverCount > 0
            ? `${serverCount} events loaded from server and merged with local history.`
            : 'No server events found. Events will be pushed to the server when you are logged in.'}
        </div>
      )}

      {/* ── Tabs + controls ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap', borderBottom: '1px solid var(--card-border)', paddingBottom: 12 }}>
        <div style={{ display: 'flex', gap: 2 }}>
          {([['events', t('pages.audit.tabEvents', { count: events.length }), '#2563eb'], ['exposure', t('pages.audit.tabExposure', { count: firstSeenEntries.length }), '#d97706']] as const).map(([key, label, color]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: 'none', borderBottom: tab === key ? `2px solid ${color}` : '2px solid transparent',
              color: tab === key ? color : 'var(--text-muted)',
            }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Export buttons */}
          <button
            onClick={() => download(eventsToCSV(filtered), `wafpass-audit-${new Date().toISOString().slice(0,10)}.csv`, 'text/csv')}
            style={{ ...selectStyle, cursor: 'pointer', fontWeight: 600, color: '#059669' }}>
            ↓ CSV
          </button>
          <button
            onClick={() => download(JSON.stringify({ exported_at: new Date().toISOString(), events: filtered, first_seen: firstSeenEntries }, null, 2), `wafpass-audit-${new Date().toISOString().slice(0,10)}.json`, 'application/json')}
            style={{ ...selectStyle, cursor: 'pointer', fontWeight: 600, color: '#2563eb' }}>
            ↓ JSON
          </button>
          {!confirmClear ? (
            <button onClick={() => setConfirmClear(true)}
              style={{ ...selectStyle, cursor: 'pointer', color: '#dc2626', borderColor: 'rgba(220,38,38,.3)' }}>
              {t('pages.audit.clearLog')}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>{t('pages.audit.clearConfirm')}</span>
              <button onClick={handleClear} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #dc2626', background: '#dc2626', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>{t('pages.audit.clearYes')}</button>
              <button onClick={() => setConfirmClear(false)} style={{ ...selectStyle, cursor: 'pointer' }}>Cancel</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Event Timeline tab ───────────────────────────────────────────── */}
      {tab === 'events' && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('pages.audit.searchPlaceholder')}
              style={{ ...selectStyle, flex: 1, minWidth: 200 }} />
            <select value={catFilter} onChange={e => setCatFilter(e.target.value as AuditCategory | '')} style={selectStyle}>
              <option value="">{t('pages.audit.allCategories')}</option>
              {(Object.keys(CAT_META) as AuditCategory[]).map(c => (
                <option key={c} value={c}>{CAT_META[c].label}</option>
              ))}
            </select>
            {(catFilter || search) && (
              <button onClick={() => { setCatFilter(''); setSearch('') }} style={{ ...selectStyle, cursor: 'pointer', background: 'none' }}>Clear</button>
            )}
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{filtered.length} / {events.length}</span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', border: '1px dashed var(--card-border)', borderRadius: 10, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              <strong>{t('pages.audit.noEvents')}</strong>
              <div style={{ marginTop: 6, fontSize: 12, maxWidth: 420, margin: '6px auto 0' }}>
                {t('pages.audit.noEventsHint')}
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, overflow: 'hidden' }}>
              {filtered.map(e => <EventRow key={e.id} event={e} />)}
            </div>
          )}
        </div>
      )}

      {/* ── Control Exposure tab ─────────────────────────────────────────── */}
      {tab === 'exposure' && (
        <div>
          {firstSeenEntries.length > 0 && stats.critOrHigh > 0 && (
            <div style={{
              marginBottom: 16, padding: '12px 16px', borderRadius: 8,
              background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.2)',
              fontSize: 13, color: '#dc2626', fontWeight: 600,
            }}>
              ⚠ {stats.critOrHigh} critical/high severity control{stats.critOrHigh !== 1 ? 's' : ''} tracked —
              oldest open failure is {stats.oldestFailDays} days old.
              {stats.oldestFailDays > 90 && ' Failures exceeding 90 days may breach SLA commitments in SOC2/ISO27001.'}
            </div>
          )}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, overflow: 'hidden', padding: '16px' }}>
            <FirstSeenTable entries={firstSeenEntries} />
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <strong>Note:</strong> The first-seen date reflects when a run containing this failure was first loaded by any team member.
            Cross-reference with the run history on the server for a complete record.
            Export as CSV or JSON and attach to your SOC2/ISO27001 evidence package.
          </div>
        </div>
      )}
    </div>
  )
}
