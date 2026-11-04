import { useState, useEffect, useCallback } from 'react'
import { appendAuditEvent } from '../audit'
import { fetchWaivers, upsertWaiver, deleteWaiver } from '../api'
import { useI18n } from '../i18n'
import { PAGE_TITLE } from '../routing'
import { Card, EmptyState, Skeleton, SkeletonText } from '../ui'
import { yamlQuote } from '../yamlQuote'

export interface Waiver {
  id: string
  reason: string
  owner: string
  expires: string
  project?: string
}

const STORAGE_KEY = 'wombat_waivers'

function loadLocalWaivers(): Record<string, Waiver> {
  try {
    const s = localStorage.getItem(STORAGE_KEY)
    return s ? JSON.parse(s) : {}
  } catch { return {} }
}

function saveLocalWaivers(w: Record<string, Waiver>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(w)) } catch {}
}

function exportYaml(waivers: Record<string, Waiver>): string {
  const entries = Object.values(waivers)
  if (!entries.length) return ''
  let yaml = 'version: "1"\nwaivers:\n'
  for (const w of entries) {
    yaml += `  - id: ${yamlQuote(w.id)}\n`
    yaml += `    reason: ${yamlQuote(w.reason)}\n`
    yaml += `    owner: ${yamlQuote(w.owner)}\n`
    yaml += `    expires: ${yamlQuote(w.expires)}\n`
  }
  return yaml
}

type SyncStatus = 'loading' | 'synced' | 'offline' | 'saving' | 'error'

interface FormState { id: string; reason: string; owner: string; expires: string }
const EMPTY_FORM: FormState = { id: '', reason: '', owner: '', expires: '' }

interface Props {
  controls: { id: string; title: string }[]
  onCountChange?: (count: number) => void
}

export default function WaiversPage({ controls, onCountChange }: Props) {
  const { t } = useI18n()
  const [waivers, setWaivers] = useState<Record<string, Waiver>>({})
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [copied, setCopied] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading')
  const [syncError, setSyncError] = useState<string | null>(null)

  function applyMap(map: Record<string, Waiver>) {
    setWaivers(map)
    saveLocalWaivers(map)
    onCountChange?.(Object.keys(map).length)
  }

  // Fetch from server on mount; fall back to read-only localStorage cache if unreachable
  useEffect(() => {
    setSyncStatus('loading')
    fetchWaivers()
      .then(records => {
        const map: Record<string, Waiver> = {}
        for (const r of records) {
          map[r.id] = { id: r.id, reason: r.reason, owner: r.owner, expires: r.expires ?? '', project: r.project }
        }
        applyMap(map)
        setSyncStatus('synced')
      })
      .catch((e: unknown) => {
        const cached = loadLocalWaivers()
        setWaivers(cached)
        setSyncStatus('offline')
        setSyncError(e instanceof TypeError
          ? t('pages.phase3.restB.waivers.errorOfflineCached')
          : t('pages.phase3.restB.waivers.errorServerLoading', { error: e instanceof Error ? e.message : String(e) }))
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const submit = useCallback(async () => {
    if (!form.id.trim()) return
    const waiver: Waiver = { id: form.id.trim(), reason: form.reason, owner: form.owner, expires: form.expires, project: '' }
    const existing = waivers[waiver.id]
    setSyncStatus('saving')
    setSyncError(null)
    try {
      await upsertWaiver(waiver.id, { reason: waiver.reason, owner: waiver.owner, expires: waiver.expires, project: waiver.project ?? '' })
      const next = { ...waivers, [waiver.id]: waiver }
      applyMap(next)
      setSyncStatus('synced')
      appendAuditEvent({
        actor: waiver.owner || 'unknown',
        category: 'waiver',
        action: existing ? 'waiver_updated' : 'waiver_created',
        subject_id: waiver.id,
        subject_type: 'waiver',
        summary: existing
          ? `Waiver updated for ${waiver.id} by ${waiver.owner} (expires ${waiver.expires})`
          : `Waiver created for ${waiver.id} by ${waiver.owner} (expires ${waiver.expires})`,
        before: existing ?? undefined,
        after: waiver,
      })
      setShowForm(false)
    } catch (e) {
      setSyncStatus(e instanceof TypeError ? 'offline' : 'error')
      setSyncError(e instanceof TypeError
        ? t('pages.phase3.restB.waivers.errorOfflineSave')
        : t('pages.phase3.restB.waivers.errorServerSave', { error: e instanceof Error ? e.message : String(e) }))
    }
  }, [form, waivers]) // eslint-disable-line react-hooks/exhaustive-deps

  const remove = useCallback(async (id: string) => {
    const existing = waivers[id]
    setSyncStatus('saving')
    setSyncError(null)
    try {
      await deleteWaiver(id)
      const next = { ...waivers }
      delete next[id]
      applyMap(next)
      setSyncStatus('synced')
      if (existing) {
        appendAuditEvent({
          actor: existing.owner || 'unknown',
          category: 'waiver',
          action: 'waiver_deleted',
          subject_id: id,
          subject_type: 'waiver',
          summary: `Waiver removed for ${id} (was owned by ${existing.owner})`,
          before: existing,
        })
      }
    } catch (e) {
      setSyncStatus(e instanceof TypeError ? 'offline' : 'error')
      setSyncError(e instanceof TypeError
        ? t('pages.phase3.restB.waivers.errorOfflineRemove')
        : t('pages.phase3.restB.waivers.errorServerRemove', { error: e instanceof Error ? e.message : String(e) }))
    }
  }, [waivers]) // eslint-disable-line react-hooks/exhaustive-deps

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
    a.download = '.wombat-skip.yml'
    a.click()
    URL.revokeObjectURL(url)
  }

  const inputStyle = {
    background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.85rem',
    outline: 'none', width: '100%', boxSizing: 'border-box' as const,
  }

  const isExpired = (expires: string) => {
    if (!expires) return false
    return new Date(expires) < new Date()
  }

  const syncPill = (() => {
    if (syncStatus === 'loading') return { label: t('pages.waivers.syncLoading'), color: 'var(--skip)' }
    if (syncStatus === 'saving') return { label: t('pages.waivers.syncSaving'), color: 'var(--waf-brand)' }
    if (syncStatus === 'synced') return { label: t('pages.waivers.syncSynced'), color: 'var(--pass)' }
    if (syncStatus === 'offline') return { label: t('pages.waivers.syncOffline'), color: 'var(--waf-warn)' }
    return { label: t('pages.waivers.syncError'), color: 'var(--fail)' }
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px' }}>
      <h1 className="ui-sr-only">{PAGE_TITLE.waivers}</h1>

      {/* Header actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          onClick={openAdd}
          disabled={syncStatus === 'offline'}
          style={{
            background: syncStatus === 'offline' ? 'var(--skip)' : 'var(--waf-brand)',
            color: '#fff', border: 'none', borderRadius: '8px',
            padding: '0.5rem 1.1rem', fontSize: '0.85rem', fontWeight: 700,
            cursor: syncStatus === 'offline' ? 'not-allowed' : 'pointer',
          }}
        >
          {t('pages.waivers.addBtn')}
        </button>
        {entries.length > 0 && (
          <>
            <button
              onClick={copyYaml}
              style={{
                background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '0.5rem 1.1rem', fontSize: '0.85rem', cursor: 'pointer',
              }}
            >
              {copied ? t('pages.waivers.copied') : t('pages.waivers.copyYaml')}
            </button>
            <button
              onClick={downloadYaml}
              style={{
                background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '0.5rem 1.1rem', fontSize: '0.85rem', cursor: 'pointer',
              }}
            >
              {t('pages.waivers.downloadYml')}
            </button>
          </>
        )}
        <span style={{
          marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 600, color: syncPill.color,
          background: `color-mix(in srgb, ${syncPill.color} 9%, transparent)`, border: `1px solid color-mix(in srgb, ${syncPill.color} 25%, transparent)`,
          borderRadius: '999px', padding: '0.2rem 0.7rem',
        }}>
          {syncPill.label}
        </span>
      </div>

      {/* Sync error banner */}
      {syncError && (
        <div style={{
          background: 'color-mix(in srgb, var(--fail) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--fail) 30%, transparent)',
          borderRadius: '8px', padding: '0.6rem 0.875rem', fontSize: '0.78rem', color: 'var(--fail-ink)',
        }}>
          {syncError}
        </div>
      )}

      {/* Waivers list */}
      {syncStatus === 'loading' ? (
        <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[0, 1, 2].map(i => (
            <Card key={i}>
              <Skeleton width="38%" height={14} />
              <SkeletonText lines={2} />
              <Skeleton width="22%" height={10} />
            </Card>
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card padding="none">
          <EmptyState
            title={t('pages.waivers.noWaivers')}
            description={t('pages.waivers.noWaiversHint')}
          />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {entries.map(w => {
            const expired = isExpired(w.expires)
            return (
              <div key={w.id} className="card" style={{ borderLeft: `3px solid ${expired ? 'var(--fail)' : 'var(--waived)'}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                      <code style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--waf-brand)' }}>{w.id}</code>
                      {expired && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--fail-ink)', background: 'color-mix(in srgb, var(--fail) 15%, transparent)', padding: '0.08rem 0.4rem', borderRadius: '999px' }}>
                          {t('pages.waivers.expired')}
                        </span>
                      )}
                      {w.expires && !expired && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{t('pages.waivers.expires')} {w.expires}</span>
                      )}
                      {w.project && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--muted)', background: 'var(--bg-secondary)', borderRadius: '4px', padding: '0.08rem 0.4rem' }}>
                          {w.project}
                        </span>
                      )}
                    </div>
                    {w.reason && <div style={{ fontSize: '0.8rem', color: 'var(--text)', marginBottom: '0.2rem' }}>{w.reason}</div>}
                    {w.owner && <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{t('pages.waivers.owner')}: {w.owner}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    <button
                      onClick={() => openEdit(w)}
                      disabled={syncStatus === 'offline'}
                      style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.25rem 0.6rem', fontSize: '0.72rem', cursor: syncStatus === 'offline' ? 'not-allowed' : 'pointer', color: 'var(--muted)', opacity: syncStatus === 'offline' ? 0.5 : 1 }}
                    >
                      {t('pages.phase3.restB.waivers.edit')}
                    </button>
                    <button
                      onClick={() => void remove(w.id)}
                      disabled={syncStatus === 'offline'}
                      style={{ background: 'none', border: '1px solid color-mix(in srgb, var(--fail) 30%, transparent)', borderRadius: '6px', padding: '0.25rem 0.6rem', fontSize: '0.72rem', cursor: syncStatus === 'offline' ? 'not-allowed' : 'pointer', color: 'var(--fail-ink)', opacity: syncStatus === 'offline' ? 0.5 : 1 }}
                    >
                      {t('pages.phase3.restB.waivers.remove')}
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
            {t('pages.waivers.previewTitle')}
          </h2>
          <pre style={{
            background: '#0f172a', color: '#e2e8f0', borderRadius: '8px',
            padding: '0.875rem 1rem', fontSize: '0.78rem', overflowX: 'auto', lineHeight: 1.7, margin: 0,
          }}>
            {exportYaml(waivers)}
          </pre>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.5rem' }}>
            {t('pages.waivers.previewHint')}
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <>
          <div
            onClick={() => setShowForm(false)}
            style={{ position: 'fixed', inset: 0, background: 'var(--scrim)', zIndex: 99 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            background: 'var(--surface)', borderRadius: '12px', boxShadow: '0 20px 60px color-mix(in srgb, black 20%, transparent)',
            padding: '1.5rem', width: '440px', maxWidth: '90vw', zIndex: 100,
            display: 'flex', flexDirection: 'column', gap: '1rem',
          }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              {editId ? t('pages.waivers.editWaiver') : t('pages.waivers.addWaiver')}
            </h2>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.3rem' }}>
                {t('pages.waivers.controlLabel')} *
              </label>
              {editId ? (
                <input value={form.id} disabled style={{ ...inputStyle, opacity: 0.6 }} />
              ) : (
                <select
                  value={form.id}
                  onChange={e => setForm({ ...form, id: e.target.value })}
                  style={inputStyle}
                >
                  <option value="">{t('pages.phase3.restB.waivers.selectControl')}</option>
                  {controls.map(c => (
                    <option key={c.id} value={c.id}>{c.id} — {c.title}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.3rem' }}>
                {t('pages.waivers.reasonLabel')}
              </label>
              <textarea
                value={form.reason}
                onChange={e => setForm({ ...form, reason: e.target.value })}
                placeholder={t('pages.phase3.restB.waivers.reasonPlaceholder')}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.3rem' }}>
                  {t('pages.waivers.ownerLabel')}
                </label>
                <input
                  value={form.owner}
                  onChange={e => setForm({ ...form, owner: e.target.value })}
                  placeholder={t('pages.phase3.restB.waivers.ownerPlaceholder')}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.3rem' }}>
                  {t('pages.waivers.expiresLabel')}
                </label>
                <input
                  type="date"
                  value={form.expires}
                  onChange={e => setForm({ ...form, expires: e.target.value })}
                  style={inputStyle}
                />
              </div>
            </div>

            {syncError && syncStatus !== 'loading' && (
              <div style={{
                background: 'color-mix(in srgb, var(--fail) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--fail) 30%, transparent)',
                borderRadius: '8px', padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: 'var(--fail-ink)',
              }}>
                {syncError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowForm(false)}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.45rem 1rem', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--muted)' }}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => void submit()}
                disabled={!form.id || syncStatus === 'saving'}
                style={{
                  background: form.id && syncStatus !== 'saving' ? 'var(--waf-brand)' : 'var(--skip)', color: '#fff',
                  border: 'none', borderRadius: '8px', padding: '0.45rem 1rem',
                  fontSize: '0.85rem', fontWeight: 700,
                  cursor: form.id && syncStatus !== 'saving' ? 'pointer' : 'not-allowed',
                }}
              >
                {syncStatus === 'saving' ? t('pages.waivers.syncSaving') : editId ? t('pages.waivers.saveChanges') : t('pages.waivers.addBtn')}
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  )
}
