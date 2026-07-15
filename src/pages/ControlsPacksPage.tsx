/**
 * Controls Upgrade — versioned WAF++ control pack management.
 * Sync a new pack from the server's controls directory, view pack history,
 * and roll back to any previously imported version.  Admin role required.
 */
import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import {
  fetchControlPacks,
  syncControlPack,
  uploadControlPack,
  activateControlPack,
  fetchUpdateInfo,
  type ControlPackOut,
  type UpdateInfo,
} from '../api'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function ActiveBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '0.15rem 0.55rem', borderRadius: 6,
      background: 'rgba(5,150,105,0.10)', color: '#059669',
      fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.03em',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
      ACTIVE
    </span>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ControlsPacksPage() {
  const { t } = useI18n()
  const [packs, setPacks]           = useState<ControlPackOut[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [updateLoading, setUpdateLoading] = useState(true)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [activeTab, setActiveTab]         = useState<'sync' | 'upload'>('upload')
  const [syncVersion, setSyncVersion]     = useState('')
  const [syncDesc, setSyncDesc]           = useState('')
  const [syncing, setSyncing]             = useState(false)
  const [syncError, setSyncError]         = useState<string | null>(null)
  const [uploadVersion, setUploadVersion] = useState('')
  const [uploadDesc, setUploadDesc]       = useState('')
  const [uploadFile, setUploadFile]       = useState<File | null>(null)
  const [uploading, setUploading]         = useState(false)
  const [uploadError, setUploadError]     = useState<string | null>(null)
  const [activating, setActivating]       = useState<string | null>(null)
  const [actionError, setActionError]     = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setPacks(await fetchControlPacks())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    setUpdateLoading(true)
    setUpdateError(null)
    fetchUpdateInfo()
      .then(setUpdateInfo)
      .catch((e: Error) => {
        console.error('Failed to fetch framework update info:', e)
        setUpdateInfo(null)
        setUpdateError(t('pages.controlspacks.versionLoadError') ?? 'Could not reach the WAF++ framework repository.')
      })
      .finally(() => setUpdateLoading(false))
  }, [t])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!uploadFile || !uploadVersion.trim()) return
    setUploading(true)
    setUploadError(null)
    try {
      await uploadControlPack(uploadFile, uploadVersion.trim(), uploadDesc.trim())
      setUploadVersion('')
      setUploadDesc('')
      setUploadFile(null)
      // reset the file input
      const input = document.getElementById('zip-file-input') as HTMLInputElement | null
      if (input) input.value = ''
      await load()
    } catch (e) {
      setUploadError(String(e))
    } finally {
      setUploading(false)
    }
  }

  async function handleSync(e: React.FormEvent) {
    e.preventDefault()
    if (!syncVersion.trim()) return
    setSyncing(true)
    setSyncError(null)
    try {
      await syncControlPack(syncVersion.trim(), syncDesc.trim())
      setSyncVersion('')
      setSyncDesc('')
      await load()
    } catch (e) {
      setSyncError(String(e))
    } finally {
      setSyncing(false)
    }
  }

  async function handleActivate(version: string) {
    setActivating(version)
    setActionError(null)
    try {
      await activateControlPack(version)
      await load()
    } catch (e) {
      setActionError(String(e))
    } finally {
      setActivating(null)
    }
  }

  const activePack = packs.find(p => p.is_active)

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Active pack banner ─────────────────────────────────────────── */}
      <div className="card" style={{
        display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap',
        borderLeft: '4px solid var(--waf-brand)',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: 'rgba(0,148,255,0.12)', border: '1px solid rgba(0,148,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" fill="none" stroke="var(--waf-brand)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 2 }}>
            {t('pages.controlspacks.activePack')}
          </div>
          {activePack ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--waf-brand)', fontFamily: 'monospace' }}>
                {activePack.version}
              </span>
              {activePack.description && (
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {activePack.description}
                </span>
              )}
            </div>
          ) : (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {t('pages.controlspacks.noPack')}
            </span>
          )}
        </div>
        {activePack && (
          <div style={{ textAlign: 'right', flexShrink: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <div>{t('pages.controlspacks.controlsCount', { count: activePack.control_count })}</div>
            <div>{t('pages.controlspacks.activated')} {fmtDate(activePack.activated_at)}</div>
          </div>
        )}
      </div>

      {/* ── Framework Update Reference ─────────────────────────────────────── */}
      <div className="card" style={{
        display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap',
        borderLeft: '4px solid #0094FF',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: 'rgba(0,148,255,0.12)', border: '1px solid rgba(0,148,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" fill="none" stroke="var(--waf-brand)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 2 }}>
            WAF++ Framework Reference
          </div>
          {updateLoading ? (
            <div style={{ fontSize: '0.82rem', color: 'var(--text)' }}>
              Loading latest version information…
            </div>
          ) : updateError ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem 0.75rem', borderRadius: 8,
              background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.18)',
              color: '#c2410c', fontSize: '0.82rem',
            }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {updateError}
            </div>
          ) : updateInfo ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text)', fontFamily: 'monospace' }}>
                  {updateInfo.framework.version.display || updateInfo.version}
                </span>
                <span style={{ padding: '0.1rem 0.5rem', borderRadius: '999px', background: 'rgba(0,148,255,.12)', color: '#0094FF', fontSize: '0.68rem', fontWeight: 600 }}>
                  {updateInfo.generated_at ? `Updated: ${new Date(updateInfo.generated_at).toLocaleDateString()}` : ''}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Branch: <strong style={{ color: 'var(--text-primary)' }}>{updateInfo.framework.git_branch}</strong>
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Commit: <strong style={{ color: 'var(--text-primary)' }}>{updateInfo.framework.last_commit.hash?.substring(0, 8) || '—'}</strong>
                </span>
              </div>
            </>
          ) : (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              No framework version information available.
            </div>
          )}
        </div>
      </div>

      {/* ── Import new pack (tabbed: Upload ZIP / Sync from directory) ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--card-border)' }}>
          {(['upload', 'sync'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: '0.7rem 1rem', fontWeight: 700, fontSize: '0.82rem',
                border: 'none', cursor: 'pointer', transition: 'all 0.12s',
                borderBottom: activeTab === tab ? '2px solid var(--waf-brand)' : '2px solid transparent',
                background: activeTab === tab ? 'rgba(0,148,255,0.05)' : 'transparent',
                color: activeTab === tab ? 'var(--waf-brand)' : 'var(--text-muted)',
              }}
            >
              {tab === 'upload' ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {t('pages.controlspacks.uploadZip')}
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {t('pages.controlspacks.syncDirectory')}
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ padding: '1.1rem 1.25rem' }}>

          {/* ── Upload ZIP tab ──────────────────────────────────────────── */}
          {activeTab === 'upload' && (
            <>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: '1rem' }}>
                {t('pages.controlspacks.uploadZipDesc')}
              </p>

              <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>

                  {/* File picker */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 280px' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {t('pages.controlspacks.zipFile')}
                    </label>
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                      padding: '0.55rem 0.8rem', borderRadius: 8, fontSize: '0.84rem',
                      border: `2px dashed ${uploadFile ? 'var(--waf-brand)' : 'var(--card-border)'}`,
                      background: uploadFile ? 'rgba(0,148,255,0.04)' : 'var(--bg)',
                      color: uploadFile ? 'var(--waf-brand)' : 'var(--text-muted)',
                      transition: 'all 0.15s',
                    }}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 0v10m0-10a2 2 0 012 2h2a2 2 0 012-2" />
                      </svg>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {uploadFile ? uploadFile.name : t('pages.controlspacks.chooseFile')}
                      </span>
                      <input
                        id="zip-file-input"
                        type="file"
                        accept=".zip"
                        style={{ display: 'none' }}
                        onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>

                  {/* Version */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 0 160px' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {t('pages.controlspacks.version')}
                    </label>
                    <input
                      value={uploadVersion}
                      onChange={e => setUploadVersion(e.target.value)}
                      placeholder={t('pages.controlspacks.versionPlaceholder')}
                      required
                      style={{
                        padding: '0.45rem 0.7rem', borderRadius: 8, fontSize: '0.85rem',
                        border: '1px solid var(--card-border)', background: 'var(--bg)',
                        color: 'var(--text-primary)', outline: 'none', fontFamily: 'monospace',
                      }}
                    />
                  </div>

                  {/* Description */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 220px' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {t('pages.controlspacks.description')}
                    </label>
                    <input
                      value={uploadDesc}
                      onChange={e => setUploadDesc(e.target.value)}
                      placeholder={t('pages.controlspacks.descriptionPlaceholder')}
                      style={{
                        padding: '0.45rem 0.7rem', borderRadius: 8, fontSize: '0.85rem',
                        border: '1px solid var(--card-border)', background: 'var(--bg)',
                        color: 'var(--text-primary)', outline: 'none',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button
                    type="submit"
                    disabled={uploading || !uploadFile || !uploadVersion.trim()}
                    style={{
                      padding: '0.45rem 1.1rem', borderRadius: 8, fontWeight: 700,
                      fontSize: '0.85rem', cursor: uploading || !uploadFile || !uploadVersion.trim() ? 'not-allowed' : 'pointer',
                      background: 'var(--waf-brand)', color: '#fff', border: 'none',
                      opacity: uploading || !uploadFile || !uploadVersion.trim() ? 0.6 : 1,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    {uploading ? (
                      <>
                        <span className="spinner" style={{ width: 14, height: 14 }} />
                        {t('pages.controlspacks.uploading')}
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        {t('pages.controlspacks.uploadActivate')}
                      </>
                    )}
                  </button>
                </div>

                {uploadError && (
                  <div style={{ padding: '0.6rem 0.9rem', borderRadius: 8, background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', fontSize: '0.8rem' }}>
                    {uploadError}
                  </div>
                )}
              </form>
            </>
          )}

          {/* ── Sync from directory tab ─────────────────────────────────── */}
          {activeTab === 'sync' && (
            <>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 0, marginBottom: '1rem' }}>
                {t('pages.controlspacks.syncDesc')}
              </p>

              <form onSubmit={handleSync} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '0 0 160px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Version *
                  </label>
                  <input
                    value={syncVersion}
                    onChange={e => setSyncVersion(e.target.value)}
                    placeholder={t('pages.controlspacks.versionPlaceholder')}
                    required
                    style={{
                      padding: '0.45rem 0.7rem', borderRadius: 8, fontSize: '0.85rem',
                      border: '1px solid var(--card-border)', background: 'var(--bg)',
                      color: 'var(--text-primary)', outline: 'none', fontFamily: 'monospace',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 260px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Description
                  </label>
                  <input
                    value={syncDesc}
                    onChange={e => setSyncDesc(e.target.value)}
                    placeholder={t('pages.controlspacks.descriptionPlaceholder')}
                    style={{
                      padding: '0.45rem 0.7rem', borderRadius: 8, fontSize: '0.85rem',
                      border: '1px solid var(--card-border)', background: 'var(--bg)',
                      color: 'var(--text-primary)', outline: 'none',
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={syncing || !syncVersion.trim()}
                  style={{
                    padding: '0.45rem 1.1rem', borderRadius: 8, fontWeight: 700,
                    fontSize: '0.85rem', cursor: syncing ? 'not-allowed' : 'pointer',
                    background: 'var(--waf-brand)', color: '#fff', border: 'none',
                    opacity: syncing || !syncVersion.trim() ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {syncing ? (
                    <>
                      <span className="spinner" style={{ width: 14, height: 14 }} />
                      {t('pages.controlspacks.syncing')}
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      {t('pages.controlspacks.syncActivate')}
                    </>
                  )}
                </button>
              </form>

              {syncError && (
                <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.9rem', borderRadius: 8, background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', fontSize: '0.8rem' }}>
                  {syncError}
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {/* ── Pack history ───────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            {t('pages.controlspacks.packHistory')}
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {t('pages.controlspacks.pack', { count: packs.length, suffix: packs.length === 1 ? '' : 's' })}
          </span>
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
            <div className="spinner" />
          </div>
        )}

        {error && (
          <div style={{ padding: '1rem 1.25rem', color: '#dc2626', fontSize: '0.85rem' }}>{error}</div>
        )}

        {actionError && (
          <div style={{ margin: '0.75rem 1.25rem', padding: '0.6rem 0.9rem', borderRadius: 8, background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', fontSize: '0.8rem' }}>
            {actionError}
          </div>
        )}

        {!loading && packs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {t('pages.controlspacks.noPacks')}
          </div>
        )}

        {!loading && packs.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {[t('pages.controlspacks.versionCol'), t('pages.controlspacks.descriptionCol'), t('pages.controlspacks.controlsCol'), t('pages.controlspacks.importedCol'), t('pages.controlspacks.activatedCol'), ''].map(h => (
                  <th key={h} style={{
                    padding: '0.6rem 1rem', textAlign: 'left',
                    fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {packs.map(pack => (
                <tr key={pack.version} style={{
                  borderTop: '1px solid var(--card-border)',
                  background: pack.is_active ? 'rgba(0,148,255,0.03)' : 'transparent',
                }}>
                  <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {pack.version}
                      </span>
                      {pack.is_active && <ActiveBadge />}
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', maxWidth: 260 }}>
                    {pack.description || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right', paddingRight: '2rem' }}>
                    {pack.control_count}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                    {fmtDate(pack.imported_at)}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                    {fmtDate(pack.activated_at)}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                    {!pack.is_active && (
                      <button
                        disabled={activating === pack.version}
                        onClick={() => handleActivate(pack.version)}
                        style={{
                          padding: '0.3rem 0.75rem', borderRadius: 7, fontSize: '0.75rem',
                          fontWeight: 600, cursor: activating ? 'not-allowed' : 'pointer',
                          border: '1px solid var(--card-border)',
                          background: 'var(--bg)', color: 'var(--text-secondary)',
                          opacity: activating === pack.version ? 0.6 : 1,
                          transition: 'all 0.12s',
                        }}
                      >
                        {activating === pack.version ? 'Activating…' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── How it works ──────────────────────────────────────────────── */}
      <div className="card" style={{ background: 'var(--bg)', border: '1px solid var(--card-border)' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 10 }}>
          How It Works
        </div>
        <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <li><strong>Upload ZIP:</strong> package your <code style={{ background: 'var(--card-bg)', padding: '0 4px', borderRadius: 4, fontSize: '0.78rem' }}>*.yml</code> control files into a <code style={{ background: 'var(--card-bg)', padding: '0 4px', borderRadius: 4, fontSize: '0.78rem' }}>.zip</code> and upload directly from your browser.</li>
          <li><strong>Sync from Directory:</strong> place updated YAML files in <code style={{ background: 'var(--card-bg)', padding: '0 4px', borderRadius: 4, fontSize: '0.78rem' }}>WAFPASS_CONTROLS_DIR</code> on the server and trigger a sync.</li>
          <li>Either method stores a full immutable snapshot and upserts all controls into the catalogue, then marks the new pack as active.</li>
          <li>To roll back, click <strong>Activate</strong> on any historical pack — the stored snapshot is re-applied without needing filesystem access.</li>
        </ol>
      </div>

    </div>
  )
}
