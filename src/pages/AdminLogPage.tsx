/**
 * Admin Audit Log — sub-tab component used inside AuditLogPage.
 *
 * Reads server-side administrative/security audit events from
 * user_audit_logs and renders them in the SOC visual family.
 */
import { useEffect, useMemo, useState } from 'react'
import { AdminAuditLogEntry, fetchAdminLogs, fetchSyslogConfig, SyslogConfig } from '../api'
import { useI18n } from '../i18n'
import { LockIcon, SettingsIcon } from './shared/SocComponents'
import {
  SectionCard, KpiTile, SocStyles,
  SearchIcon, DownloadIcon, XIcon, CheckIcon, ExclaimIcon,
  statusColor,
} from './shared/SocComponents'
import SyslogConfigModal from './SyslogConfigModal'

const ACTION_META: Record<string, { label: string; color: string; bg: string }> = {
  login:    { label: 'Login',    color: '#059669', bg: 'rgba(5,150,105,.10)' },
  logout:   { label: 'Logout',   color: '#2563eb', bg: 'rgba(37,99,235,.10)' },
  'user.create': { label: 'User created', color: '#7c3aed', bg: 'rgba(124,58,237,.10)' },
  'user.update': { label: 'User updated', color: '#d97706', bg: 'rgba(217,119,6,.10)' },
  'user.delete': { label: 'User deleted', color: '#dc2626', bg: 'rgba(220,38,38,.10)' },
}

export function actionMeta(action: string) {
  return ACTION_META[action] ?? {
    label: action.replace(/\./g, ' ').replace(/^\w/, c => c.toUpperCase()),
    color: '#64748b',
    bg: 'rgba(100,116,139,.10)',
  }
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  Object.assign(document.createElement('a'), { href: url, download: filename }).click()
  URL.revokeObjectURL(url)
}

export function logsToCSV(logs: AdminAuditLogEntry[]): string {
  const header = 'id,timestamp,actor,actor_id,action,ip,mandant_id,detail'
  const rows = logs.map(l =>
    [l.id, l.timestamp, l.actor_username ?? '', l.actor_id ?? '', l.action, l.ip, l.mandant_id ?? '', `"${JSON.stringify(l.detail).replace(/"/g, '""')}"`].join(',')
  )
  return [header, ...rows].join('\n')
}

function relTime(iso: string, t: ReturnType<typeof useI18n>['t']) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return t('pages.adminLogs.ageDays', { days: Math.floor(h / 24) })
}

function EventRow({ log, t }: { log: AdminAuditLogEntry; t: ReturnType<typeof useI18n>['t'] }) {
  const [open, setOpen] = useState(false)
  const meta = actionMeta(log.action)

  return (
    <div className="adminlog-event">
      <div className="adminlog-event__header" onClick={() => setOpen(o => !o)}>
        <span className="adminlog-event__badge" style={{ color: meta.color, background: meta.bg, borderColor: `${meta.color}33` }}>
          {meta.label}
        </span>
        <div className="adminlog-event__main">
          <div className="adminlog-event__actor">{log.actor_username ?? '—'}</div>
          <div className="adminlog-event__summary">{log.ip}{log.mandant_id ? ` · mandate ${log.mandant_id.slice(0, 8)}…` : ''}</div>
        </div>
        <div className="adminlog-event__meta">
          <div className="adminlog-event__time">{relTime(log.timestamp, t)}</div>
          <div className="adminlog-event__id">{new Date(log.timestamp).toLocaleString()}</div>
        </div>
        <div className="adminlog-event__toggle" style={{ color: meta.color }}>{open ? '▲ hide' : '▼ detail'}</div>
      </div>

      {open && (
        <div className="adminlog-event__body">
          <div className="adminlog-event__detail-label">{t('pages.adminLogs.jsonLabel')}</div>
          <pre className="adminlog-event__code">{JSON.stringify({ ...log, detail: log.detail }, null, 2)}</pre>
          <div className="adminlog-event__id-line">
            {t('pages.adminLogs.eventId')}: {log.id}
          </div>
        </div>
      )}
    </div>
  )
}

function RawDetailsTable({ logs, t }: { logs: AdminAuditLogEntry[]; t: ReturnType<typeof useI18n>['t'] }) {
  return (
    <div className="adminlog-table__wrap">
      <table className="adminlog-table">
        <thead>
          <tr>
            {[t('pages.adminLogs.colTimestamp'), t('pages.adminLogs.colAction'), t('pages.adminLogs.colActor'), t('pages.adminLogs.colIp'), t('pages.adminLogs.colMandate')].map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.map(l => (
            <tr key={l.id}>
              <td>{new Date(l.timestamp).toLocaleString()}</td>
              <td>
                <span className="adminlog-table__badge" style={{ color: actionMeta(l.action).color, background: actionMeta(l.action).bg, borderColor: `${actionMeta(l.action).color}33` }}>
                  {actionMeta(l.action).label}
                </span>
              </td>
              <td>{l.actor_username ?? '—'}</td>
              <td className="adminlog-table__mono">{l.ip}</td>
              <td className="adminlog-table__mono">{l.mandant_id ? l.mandant_id.slice(0, 8) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AdminLogPage() {
  const { t } = useI18n()
  const [logs, setLogs] = useState<AdminAuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [subTab, setSubTab] = useState<'events' | 'details'>('events')
  const [actionFilter, setActionFilter] = useState('')
  const [search, setSearch] = useState('')
  const [syslogConfig, setSyslogConfig] = useState<SyslogConfig | null>(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchAdminLogs({ limit: 500 })
      .then(data => { if (!cancelled) setLogs(data) })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const refreshSyslogConfig = () => {
    fetchSyslogConfig()
      .then(setSyslogConfig)
      .catch(() => { setSyslogConfig(null) })
  }

  useEffect(() => {
    refreshSyslogConfig()
  }, [])

  const actions = useMemo(() => [...new Set(logs.map(l => l.action))].sort(), [logs])

  const filtered = useMemo(() => logs.filter(l => {
    const matchesAction = !actionFilter || l.action === actionFilter
    const q = search.toLowerCase()
    const matchesSearch = !q ||
      l.action.toLowerCase().includes(q) ||
      (l.actor_username?.toLowerCase().includes(q) ?? false) ||
      l.ip.toLowerCase().includes(q) ||
      JSON.stringify(l.detail).toLowerCase().includes(q)
    return matchesAction && matchesSearch
  }), [logs, actionFilter, search])

  const stats = useMemo(() => ({
    total: logs.length,
    actors: new Set(logs.map(l => l.actor_id).filter(Boolean)).size,
    actions: actions.length,
    withIp: logs.filter(l => l.ip && l.ip !== 'unknown').length,
  }), [logs, actions])

  const siemConfigured = Boolean(syslogConfig?.enabled && syslogConfig?.host)

  return (
    <>
      <SocStyles />
      <style>{adminLogCss}</style>

      <div className="scc-kpi-grid adminlog-kpi-grid">
        <KpiTile label={t('pages.adminLogs.totalEvents')} value={stats.total} color={statusColor('text')} />
        <KpiTile label={t('pages.adminLogs.uniqueActors')} value={stats.actors} color={statusColor('info')} />
        <KpiTile label={t('pages.adminLogs.actionTypes')} value={stats.actions} color={statusColor('good')} />
        <KpiTile label={t('pages.adminLogs.serverIpEvents')} value={stats.withIp} color={statusColor('warn')} />
        <KpiTile
          label={t('pages.adminLogs.siemKpiTitle')}
          value={siemConfigured ? t('pages.adminLogs.siemConfigured') : t('pages.adminLogs.siemNotConfigured')}
          color={siemConfigured ? statusColor('good') : statusColor('muted')}
        />
      </div>

      {error && (
        <div className="adminlog-error">
          <ExclaimIcon /> {error.includes('403') ? t('pages.adminLogs.accessDenied') : error}
        </div>
      )}

      {!loading && !error && logs.length > 0 && (
        <div className="adminlog-sync adminlog-sync--active">
          <span className="adminlog-sync__status"><CheckIcon /> {t('pages.adminLogs.serverSyncActive')}</span>
          <span className="adminlog-sync__detail">{t('pages.adminLogs.serverSyncActiveDetail', { count: logs.length })}</span>
        </div>
      )}

      {!loading && !error && logs.length === 0 && (
        <div className="adminlog-sync adminlog-sync--local">
          <span className="adminlog-sync__status"><ExclaimIcon /> {t('pages.adminLogs.serverSyncLocal')}</span>
          <span className="adminlog-sync__detail">{t('pages.adminLogs.serverSyncLocalDetail')}</span>
        </div>
      )}

      <SectionCard title={t('pages.adminLogs.heroTitle')}>
        <div className="adminlog-toolbar">
          <div className="adminlog-search">
            <SearchIcon />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('pages.adminLogs.searchPlaceholder')}
            />
          </div>
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="adminlog-select">
            <option value="">{t('pages.adminLogs.allActions')}</option>
            {actions.map(a => <option key={a} value={a}>{actionMeta(a).label}</option>)}
          </select>
          {(actionFilter || search) && (
            <button className="adminlog-btn-ghost" onClick={() => { setActionFilter(''); setSearch('') }}>
              <XIcon /> {t('common.cancel')}
            </button>
          )}
          <span className="adminlog-count">{filtered.length} / {logs.length}</span>

          <div className="adminlog-actions">
            <button className="adminlog-btn adminlog-btn--siem" onClick={() => setShowModal(true)}>
              <SettingsIcon /> {t('pages.adminLogs.configureSiem')}
            </button>
            <button
              className="adminlog-btn adminlog-btn--export"
              onClick={() => download(logsToCSV(filtered), `wafpass-admin-audit-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv')}
            >
              <DownloadIcon /> {t('pages.adminLogs.exportCsv')}
            </button>
          </div>
        </div>

        <div className="adminlog-subtabs">
          <button className={`adminlog-subtab ${subTab === 'events' ? 'adminlog-subtab--active' : ''}`} onClick={() => setSubTab('events')}>
            <LockIcon /> {t('pages.adminLogs.tabEvents')} ({filtered.length})
          </button>
          <button className={`adminlog-subtab ${subTab === 'details' ? 'adminlog-subtab--active' : ''}`} onClick={() => setSubTab('details')}>
            {t('pages.adminLogs.tabDetails')} ({filtered.length})
          </button>
        </div>

        {loading ? (
          <div className="adminlog-empty"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="adminlog-empty">
            <div className="adminlog-empty__icon">🛡️</div>
            <strong>{t('pages.adminLogs.noEvents')}</strong>
            <div>{t('pages.adminLogs.noEventsHint')}</div>
          </div>
        ) : subTab === 'events' ? (
          <div className="adminlog-timeline">
            {filtered.map(l => <EventRow key={l.id} log={l} t={t} />)}
          </div>
        ) : (
          <RawDetailsTable logs={filtered} t={t} />
        )}

        <div className="adminlog-hint">{t('pages.adminLogs.syslogHint')}</div>
      </SectionCard>

      {showModal && (
        <SyslogConfigModal
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false)
            refreshSyslogConfig()
          }}
        />
      )}
    </>
  )
}

const adminLogCss = `
.adminlog-kpi-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.75rem;
}
@media (max-width: 1100px) {
  .adminlog-kpi-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 700px) {
  .adminlog-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

.adminlog-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: rgba(220,38,38,.05);
  border: 1px solid rgba(220,38,38,.15);
  font-size: 0.8rem;
  color: #dc2626;
  font-weight: 600;
}

.adminlog-sync {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.9rem;
  border-radius: 8px;
  font-size: 0.78rem;
  border: 1px solid;
}
.adminlog-sync--active {
  background: rgba(5,150,105,.06);
  border-color: rgba(5,150,105,.2);
  color: #059669;
}
.adminlog-sync--local {
  background: rgba(148,163,184,.06);
  border-color: rgba(148,163,184,.2);
  color: var(--muted);
}
.adminlog-sync__status {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 700;
  white-space: nowrap;
}
.adminlog-sync__detail { color: var(--muted); }

.adminlog-subtabs {
  display: inline-flex;
  gap: 0.25rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.25rem;
  margin-bottom: 1rem;
}
.adminlog-subtab {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.75rem;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}
.adminlog-subtab:hover {
  color: var(--text);
  background: color-mix(in srgb, var(--waf-brand) 6%, transparent);
}
.adminlog-subtab--active {
  background: color-mix(in srgb, var(--waf-brand) 12%, transparent);
  color: var(--waf-brand);
}

.adminlog-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.adminlog-toolbar > *:first-child {
  flex: 1;
  min-width: 200px;
}
.adminlog-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-left: auto;
}

.adminlog-search {
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
.adminlog-search input {
  border: none;
  background: transparent;
  color: var(--text);
  outline: none;
  min-width: 0;
  flex: 1;
  font-size: 0.82rem;
}
.adminlog-search input::placeholder { color: var(--muted); }

.adminlog-select {
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 0.82rem;
  cursor: pointer;
  outline: none;
}

.adminlog-count {
  font-size: 0.72rem;
  color: var(--muted);
  font-weight: 700;
}

.adminlog-btn {
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
.adminlog-btn--export {
  color: var(--pass);
  border-color: color-mix(in srgb, var(--pass) 25%, transparent);
}
.adminlog-btn--export:hover {
  background: color-mix(in srgb, var(--pass) 8%, transparent);
}
.adminlog-btn--siem {
  color: var(--waf-brand);
  border-color: color-mix(in srgb, var(--waf-brand) 25%, transparent);
}
.adminlog-btn--siem:hover {
  background: color-mix(in srgb, var(--waf-brand) 8%, transparent);
}
.adminlog-btn-ghost {
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

.adminlog-empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--muted);
  font-size: 0.85rem;
}
.adminlog-empty__icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.adminlog-hint {
  margin-top: 1rem;
  font-size: 0.72rem;
  color: var(--muted);
  line-height: 1.6;
}

.adminlog-timeline {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.adminlog-event {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface);
}
.adminlog-event__header {
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
}
.adminlog-event__badge {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  border-radius: 4px;
  padding: 0.15rem 0.45rem;
  border: 1px solid;
  flex-shrink: 0;
  min-width: 78px;
  text-align: center;
}
.adminlog-event__main { flex: 1; min-width: 0; }
.adminlog-event__actor {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text);
}
.adminlog-event__summary {
  font-size: 0.72rem;
  color: var(--muted);
  margin-top: 0.15rem;
}
.adminlog-event__meta {
  flex-shrink: 0;
  text-align: right;
  font-size: 0.72rem;
  color: var(--muted);
}
.adminlog-event__time {
  white-space: nowrap;
}
.adminlog-event__id {
  font-size: 0.62rem;
  margin-top: 0.15rem;
}
.adminlog-event__toggle {
  font-size: 0.72rem;
  font-weight: 700;
  flex-shrink: 0;
}
.adminlog-event__body {
  padding: 0 1rem 1rem 1rem;
  border-top: 1px solid var(--border);
}
.adminlog-event__detail-label {
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--muted);
  margin: 0.75rem 0 0.3rem;
}
.adminlog-event__code {
  margin: 0;
  font-size: 0.72rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  line-height: 1.5;
  border-radius: 8px;
  padding: 0.6rem 0.75rem;
  overflow: auto;
  max-height: 320px;
  color: var(--muted);
  background: var(--bg);
  border: 1px solid var(--border);
}
.adminlog-event__id-line {
  margin-top: 0.5rem;
  font-size: 0.62rem;
  color: var(--muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.adminlog-table__wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 10px;
}
.adminlog-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
}
.adminlog-table th {
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
.adminlog-table td {
  padding: 0.55rem 0.75rem;
  border-top: 1px solid var(--border);
  color: var(--text);
}
.adminlog-table__mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.72rem;
  color: var(--muted);
}
.adminlog-table__badge {
  font-size: 0.58rem;
  font-weight: 700;
  text-transform: uppercase;
  border-radius: 4px;
  padding: 0.1rem 0.35rem;
  border: 1px solid;
}

@media (max-width: 900px) {
  .adminlog-toolbar { flex-direction: column; align-items: stretch; }
  .adminlog-toolbar > *:first-child { width: 100%; }
  .adminlog-actions { margin-left: 0; width: 100%; justify-content: flex-start; }
  .adminlog-event__header { flex-wrap: wrap; }
}
`
