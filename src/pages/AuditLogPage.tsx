/**
 * Audit Log
 *
 * SOC-style redesign: hero, KPI tiles, segmented tabs, and SectionCard panels.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  AuditCategory, AuditEvent,
  clearAuditLog, clearFirstSeen,
  FirstSeenEntry, loadAuditLog, loadFirstSeen,
} from '../audit'
import { fetchServerAuditEvents, ServerAuditEvent } from '../api'
import { useI18n } from '../i18n'
import {
  SectionCard, SegmentedTabs, KpiTile, SocStyles,
  SearchIcon, DownloadIcon, XIcon, CheckIcon, ShieldIcon, ExclaimIcon, LockIcon,
  statusColor,
} from './shared/SocComponents'
import AdminLogPage from './AdminLogPage'

// ─── Category metadata ──────────────────────────────────────────────────────────

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
  Object.assign(document.createElement('a'), { href: url, download: filename }).click()
  URL.revokeObjectURL(url)
}

// ─── Event row ────────────────────────────────────────────────────────────────

function EventRow({ event, t }: { event: AuditEvent; t: ReturnType<typeof useI18n>['t'] }) {
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
    <div className="audit-event">
      <div
        className={`audit-event__header ${hasDiff ? 'audit-event__header--clickable' : ''}`}
        onClick={() => hasDiff && setOpen(o => !o)}
      >
        <span className="audit-event__cat" style={{ color: cat.color, background: cat.bg, borderColor: `${cat.color}33` }}>
          {cat.label}
        </span>

        <div className="audit-event__main">
          <div className="audit-event__title-row">
            <span className="audit-event__action">{ACTION_LABEL[event.action] ?? event.action}</span>
            <span className="audit-event__subject">{event.subject_id}</span>
          </div>
          <div className="audit-event__summary">{event.summary}</div>
        </div>

        <div className="audit-event__meta">
          <div className="audit-event__time">{relTime}</div>
          <div className="audit-event__actor">{event.actor}</div>
          {hasDiff && <div className="audit-event__diff-toggle" style={{ color: cat.color }}>{open ? '▲ hide' : '▼ diff'}</div>}
        </div>
      </div>

      {open && hasDiff && (
        <div className="audit-event__body">
          <div className="audit-diff">
            {(['before', 'after'] as const).map(side => {
              const val = event[side]
              if (val === undefined) return null
              return (
                <div key={side} className="audit-diff__side">
                  <div className={`audit-diff__label ${side === 'before' ? 'audit-diff__label--before' : 'audit-diff__label--after'}`}>
                    {side === 'before' ? t('pages.audit.diffBefore') : t('pages.audit.diffAfter')}
                  </div>
                  <pre className={`audit-diff__code audit-diff__code--${side}`}>
                    {JSON.stringify(val, null, 2)}
                  </pre>
                </div>
              )
            })}
          </div>
          <div className="audit-event__id">
            {t('pages.audit.eventId')}: {event.id} · {new Date(event.timestamp).toISOString()}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── First-seen table ─────────────────────────────────────────────────────────

function FirstSeenTable({ entries, t }: { entries: FirstSeenEntry[]; t: ReturnType<typeof useI18n>['t'] }) {
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

  const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)

  return (
    <div>
      <div className="audit-table__filters">
        <div className="audit-search">
          <SearchIcon />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('pages.findings.searchPlaceholder')}
          />
        </div>
        <select value={sevFilter} onChange={e => setSevFilter(e.target.value)} className="audit-select">
          <option value="">{t('pages.findings.allSeverities')}</option>
          {['critical', 'high', 'medium', 'low'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={pillarFilter} onChange={e => setPillarFilter(e.target.value)} className="audit-select">
          <option value="">{t('pages.findings.allPillars')}</option>
          {pillars.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {(sevFilter || pillarFilter || search) && (
          <button className="audit-btn-ghost" onClick={() => { setSevFilter(''); setPillarFilter(''); setSearch('') }}>
            <XIcon /> {t('common.cancel')}
          </button>
        )}
        <span className="audit-count">{filtered.length} / {entries.length}</span>
      </div>

      <div className="audit-table__wrap">
        <table className="audit-table">
          <thead>
            <tr>
              {[t('pages.audit.colControl'), t('pages.audit.colResource'), t('pages.audit.colSeverity'), t('pages.audit.colPillar'), t('pages.audit.colProject'), t('pages.audit.colFirstSeen'), t('pages.audit.colAge')].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((e, i) => {
              const days = daysSince(e.timestamp)
              const ageColor = days > 90 ? statusColor('bad') : days > 30 ? statusColor('warn') : statusColor('good')
              const sev = e.severity?.toLowerCase()
              return (
                <tr key={i}>
                  <td className="audit-table__mono audit-table__mono--strong">{e.control_id}</td>
                  <td className="audit-table__mono" title={e.resource}>{e.resource}</td>
                  <td>
                    <span className="audit-sev" style={{ color: SEV_COLOR[sev] ?? '#94a3b8', background: `${SEV_COLOR[sev] ?? '#94a3b8'}18`, borderColor: `${SEV_COLOR[sev] ?? '#94a3b8'}33` }}>
                      {e.severity}
                    </span>
                  </td>
                  <td>{e.pillar}</td>
                  <td className="audit-table__mono">{e.project} / {e.branch}</td>
                  <td>{new Date(e.timestamp).toLocaleDateString()}</td>
                  <td>
                    <span className="audit-age" style={{ color: ageColor }}>{t('pages.audit.ageDays', { days })}</span>
                  </td>
                </tr>
              )
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="audit-table__empty">
                  {t('pages.audit.noFirstSeen')}
                </td>
              </tr>
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
  const [tab, setTab] = useState<'events' | 'exposure' | 'admin'>('events')
  const [catFilter, setCatFilter] = useState<AuditCategory | ''>('')
  const [search, setSearch] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

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

  return (
    <div className="audit-root">
      <SocStyles />
      <style>{auditCss}</style>

      {/* Hero */}
      <div className="audit-hero">
        <div className="audit-hero__main">
          <div className="audit-hero__badge"><ShieldIcon /> AUDIT LOG</div>
          <h1 className="audit-hero__title">{t('pages.audit.heroTitle')}</h1>
          <p className="audit-hero__subtitle">{t('pages.audit.heroSubtitle')}</p>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="scc-kpi-grid">
        <KpiTile label={t('pages.audit.totalEvents')} value={stats.total} color={statusColor('text')} />
        <KpiTile label={t('pages.audit.waiverEvents')} value={stats.waivers} color={statusColor('info')} />
        <KpiTile label={t('pages.audit.riskEvents')} value={stats.risks} color={statusColor('info')} />
        <KpiTile label={t('pages.audit.scansReceived')} value={stats.scans} color={statusColor('good')} />
        <KpiTile label={t('pages.audit.controlsTracked')} value={stats.findings} color={statusColor('warn')} />
        <KpiTile label={t('pages.audit.critHighTracked')} value={stats.critOrHigh} color={statusColor('bad')} />
        {stats.oldestFailDays > 0 && (
          <KpiTile
            label={t('pages.audit.oldestFailure')}
            value={t('pages.audit.ageDays', { days: stats.oldestFailDays })}
            color={stats.oldestFailDays > 90 ? statusColor('bad') : statusColor('warn')}
          />
        )}
      </div>

      {/* Server sync banner */}
      {serverCount !== null && (
        <div className={`audit-sync ${serverCount > 0 ? 'audit-sync--active' : 'audit-sync--local'}`}>
          <span className="audit-sync__status">
            {serverCount > 0 ? <><CheckIcon /> {t('pages.audit.serverSyncActive')}</> : <><ExclaimIcon /> {t('pages.audit.serverSyncLocal')}</>}
          </span>
          <span className="audit-sync__detail">
            {serverCount > 0
              ? t('pages.audit.serverSyncActiveDetail', { count: serverCount })
              : t('pages.audit.serverSyncLocalDetail')}
          </span>
        </div>
      )}

      {/* Tabs */}
      <SegmentedTabs
        options={[
          { key: 'events', label: `${t('pages.audit.tabEvents')} (${events.length})`, icon: ShieldIcon },
          { key: 'exposure', label: `${t('pages.audit.tabExposure')} (${firstSeenEntries.length})`, icon: ExclaimIcon },
          { key: 'admin', label: t('pages.adminLogs.heroTitle'), icon: LockIcon },
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* Event Timeline tab */}
      {tab === 'events' && (
        <SectionCard title={t('pages.audit.tabEvents')}>
          <div className="audit-toolbar">
            <div className="audit-search">
              <SearchIcon />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('pages.audit.searchPlaceholder')}
              />
            </div>
            <select value={catFilter} onChange={e => setCatFilter(e.target.value as AuditCategory | '')} className="audit-select">
              <option value="">{t('pages.audit.allCategories')}</option>
              {(Object.keys(CAT_META) as AuditCategory[]).map(c => (
                <option key={c} value={c}>{CAT_META[c].label}</option>
              ))}
            </select>
            {(catFilter || search) && (
              <button className="audit-btn-ghost" onClick={() => { setCatFilter(''); setSearch('') }}>
                <XIcon /> {t('common.cancel')}
              </button>
            )}
            <span className="audit-count">{filtered.length} / {events.length}</span>

            <div className="audit-actions">
              <button
                className="audit-btn audit-btn--export"
                onClick={() => download(eventsToCSV(filtered), `wafpass-audit-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv')}
              >
                <DownloadIcon /> {t('pages.audit.exportCsv')}
              </button>
              <button
                className="audit-btn audit-btn--export"
                onClick={() => download(JSON.stringify({ exported_at: new Date().toISOString(), events: filtered, first_seen: firstSeenEntries }, null, 2), `wafpass-audit-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')}
              >
                {t('pages.audit.exportJson')}
              </button>
              {!confirmClear ? (
                <button className="audit-btn audit-btn--danger" onClick={() => setConfirmClear(true)}>
                  {t('pages.audit.clearLog')}
                </button>
              ) : (
                <div className="audit-confirm">
                  <span>{t('pages.audit.clearConfirm')}</span>
                  <button className="audit-btn audit-btn--danger-solid" onClick={handleClear}>{t('pages.audit.clearYes')}</button>
                  <button className="audit-btn-ghost" onClick={() => setConfirmClear(false)}>{t('common.cancel')}</button>
                </div>
              )}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="audit-empty">
              <div className="audit-empty__icon">📋</div>
              <strong>{t('pages.audit.noEvents')}</strong>
              <div>{t('pages.audit.noEventsHint')}</div>
            </div>
          ) : (
            <div className="audit-timeline">
              {filtered.map(e => <EventRow key={e.id} event={e} t={t} />)}
            </div>
          )}
        </SectionCard>
      )}

      {/* Control Exposure tab */}
      {tab === 'exposure' && (
        <SectionCard title={t('pages.audit.tabExposure')}>
          {firstSeenEntries.length > 0 && stats.critOrHigh > 0 && (
            <div className="audit-alert">
              <ExclaimIcon />
              {t('pages.audit.exposureAlert', { count: stats.critOrHigh, days: stats.oldestFailDays })}
              {stats.oldestFailDays > 90 && t('pages.audit.exposureAlertSla')}
            </div>
          )}
          <FirstSeenTable entries={firstSeenEntries} t={t} />
          <div className="audit-hint">
            {t('pages.audit.exposureHint')}
          </div>
        </SectionCard>
      )}

      {/* Server admin audit log tab */}
      {tab === 'admin' && (
        <AdminLogPage />
      )}
    </div>
  )
}

const auditCss = `
.audit-root {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-bottom: 2rem;
  animation: auditFadeIn 0.4s ease forwards;
}
@keyframes auditFadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.audit-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  background:
    radial-gradient(circle at 20% 50%, color-mix(in srgb, var(--waf-brand) 10%, transparent) 0%, transparent 40%),
    radial-gradient(circle at 80% 20%, color-mix(in srgb, var(--waf-brand) 6%, transparent) 0%, transparent 35%),
    linear-gradient(135deg, var(--surface) 0%, var(--bg) 100%);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 1.5rem 1.75rem;
  flex-wrap: wrap;
}
.audit-hero__main { flex: 1; min-width: 0; }
.audit-hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.7rem;
  border-radius: 6px;
  background: color-mix(in srgb, var(--waf-brand) 12%, transparent);
  color: var(--waf-brand);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  width: fit-content;
  margin-bottom: 0.75rem;
}
.audit-hero__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--text);
  line-height: 1.2;
}
.audit-hero__subtitle {
  margin: 0.45rem 0 0;
  font-size: 0.85rem;
  color: var(--muted);
  max-width: 520px;
}

.audit-sync {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.9rem;
  border-radius: 8px;
  font-size: 0.78rem;
  border: 1px solid;
}
.audit-sync--active {
  background: rgba(5,150,105,.06);
  border-color: rgba(5,150,105,.2);
  color: #059669;
}
.audit-sync--local {
  background: rgba(148,163,184,.06);
  border-color: rgba(148,163,184,.2);
  color: var(--muted);
}
.audit-sync__status {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 700;
  white-space: nowrap;
}
.audit-sync__detail {
  color: var(--muted);
}

.audit-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.audit-toolbar > *:first-child {
  flex: 1;
  min-width: 200px;
}
.audit-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-left: auto;
}

.audit-search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.7rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 0.82rem;
}
.audit-search input {
  border: none;
  background: transparent;
  color: var(--text);
  outline: none;
  min-width: 0;
  flex: 1;
  font-size: 0.82rem;
}
.audit-search input::placeholder { color: var(--muted); }

.audit-select {
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 0.82rem;
  cursor: pointer;
  outline: none;
}

.audit-count {
  font-size: 0.72rem;
  color: var(--muted);
  font-weight: 700;
}

.audit-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.85rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}
.audit-btn--export {
  color: var(--pass);
  border-color: color-mix(in srgb, var(--pass) 25%, transparent);
}
.audit-btn--export:hover {
  background: color-mix(in srgb, var(--pass) 8%, transparent);
}
.audit-btn--danger {
  color: var(--fail);
  border-color: color-mix(in srgb, var(--fail) 25%, transparent);
}
.audit-btn--danger:hover {
  background: color-mix(in srgb, var(--fail) 8%, transparent);
}
.audit-btn--danger-solid {
  background: var(--fail);
  color: #fff;
  border-color: var(--fail);
}
.audit-btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
}
.audit-confirm {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.78rem;
  color: var(--fail);
  font-weight: 700;
}

.audit-empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--muted);
  font-size: 0.85rem;
}
.audit-empty__icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.audit-timeline {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.audit-event {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface);
}
.audit-event__header {
  padding: 0.75rem 1rem;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}
.audit-event__header--clickable { cursor: pointer; }
.audit-event__cat {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  border-radius: 4px;
  padding: 0.15rem 0.45rem;
  border: 1px solid;
  flex-shrink: 0;
  margin-top: 0.15rem;
  min-width: 52px;
  text-align: center;
}
.audit-event__main { flex: 1; min-width: 0; }
.audit-event__title-row {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.audit-event__action {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text);
}
.audit-event__subject {
  font-size: 0.72rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--muted);
  background: var(--bg);
  border-radius: 4px;
  padding: 0.1rem 0.35rem;
}
.audit-event__summary {
  font-size: 0.78rem;
  color: var(--muted);
  margin-top: 0.2rem;
  line-height: 1.4;
}
.audit-event__meta {
  flex-shrink: 0;
  text-align: right;
  font-size: 0.72rem;
}
.audit-event__time {
  color: var(--muted);
  white-space: nowrap;
}
.audit-event__actor {
  color: var(--muted);
  white-space: nowrap;
  margin-top: 0.1rem;
}
.audit-event__diff-toggle {
  margin-top: 0.25rem;
  font-weight: 700;
}
.audit-event__body {
  padding: 0 1rem 1rem 4.5rem;
  border-top: 1px solid var(--border);
}
.audit-event__id {
  margin-top: 0.5rem;
  font-size: 0.62rem;
  color: var(--muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.audit-diff {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-top: 0.75rem;
}
.audit-diff__label {
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  margin-bottom: 0.3rem;
}
.audit-diff__label--before { color: #dc2626; }
.audit-diff__label--after  { color: #059669; }
.audit-diff__code {
  margin: 0;
  font-size: 0.72rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  line-height: 1.5;
  border-radius: 8px;
  padding: 0.6rem 0.75rem;
  overflow: auto;
  max-height: 220px;
  color: var(--muted);
}
.audit-diff__code--before {
  background: rgba(220,38,38,.04);
  border: 1px solid rgba(220,38,38,.15);
}
.audit-diff__code--after {
  background: rgba(5,150,105,.04);
  border: 1px solid rgba(5,150,105,.15);
}

.audit-alert {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  border-radius: 8px;
  background: rgba(220,38,38,.05);
  border: 1px solid rgba(220,38,38,.15);
  font-size: 0.8rem;
  color: #dc2626;
  font-weight: 600;
}
.audit-hint {
  margin-top: 1rem;
  font-size: 0.72rem;
  color: var(--muted);
  line-height: 1.6;
}

.audit-table__filters {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}
.audit-table__filters .audit-search {
  flex: 1;
  min-width: 180px;
}
.audit-table__wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 10px;
}
.audit-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
}
.audit-table th {
  padding: 0.6rem 0.75rem;
  text-align: left;
  font-size: 0.58rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
  background: var(--bg);
}
.audit-table td {
  padding: 0.55rem 0.75rem;
  border-top: 1px solid var(--border);
  color: var(--text);
}
.audit-table__mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.72rem;
  color: var(--muted);
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.audit-table__mono--strong {
  color: var(--text);
  font-weight: 600;
}
.audit-sev {
  font-size: 0.58rem;
  font-weight: 700;
  text-transform: uppercase;
  border-radius: 4px;
  padding: 0.1rem 0.35rem;
  border: 1px solid;
}
.audit-age {
  font-weight: 700;
}
.audit-table__empty {
  padding: 2rem;
  text-align: center;
  color: var(--muted);
}

@media (max-width: 900px) {
  .audit-toolbar { flex-direction: column; align-items: stretch; }
  .audit-toolbar > *:first-child { width: 100%; }
  .audit-actions { margin-left: 0; width: 100%; justify-content: flex-start; }
  .audit-diff { grid-template-columns: 1fr; }
  .audit-event__body { padding-left: 1rem; }
}
`
