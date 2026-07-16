/**
 * Controls Upgrade — versioned WAF++ control pack management.
 * Sync a new pack from the server's controls directory, view pack history,
 * and roll back to any previously imported version. Admin role required.
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

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '0.2rem 0.55rem', borderRadius: 999,
      background: active ? 'rgba(5,150,105,0.10)' : 'var(--bg)',
      color: active ? '#059669' : 'var(--muted)',
      border: active ? '1px solid rgba(5,150,105,.2)' : '1px solid var(--border)',
      fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
      {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669', display: 'inline-block' }} />}
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function Icon({ d, size = 20, color = 'currentColor' }: { d: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
    </svg>
  )
}

function Input({
  label, value, onChange, placeholder, required = false, type = 'text', hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  required?: boolean
  type?: string
  hint?: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1, minWidth: '180px' }}>
      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={{
          background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)',
          borderRadius: '10px', padding: '0.55rem 0.75rem', fontSize: '0.82rem', outline: 'none',
        }}
      />
      {hint && <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{hint}</div>}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export interface ControlsPacksPageProps {
  navigate: (page: 'catalogue' | 'controlspacks') => void
}

export default function ControlsPacksPage({ navigate }: ControlsPacksPageProps) {
  const { t } = useI18n()
  const [packs, setPacks]           = useState<ControlPackOut[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [updateLoading, setUpdateLoading] = useState(true)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const [mode, setMode]               = useState<'upload' | 'sync' | null>(null)
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
      const input = document.getElementById('zip-file-input') as HTMLInputElement | null
      if (input) input.value = ''
      setMode(null)
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
      setMode(null)
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
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Hero header ──────────────────────────────────────────────── */}
      <div style={{
        padding: '1.75rem 2rem', borderRadius: '20px',
        background: 'linear-gradient(135deg, rgba(0,148,255,.10) 0%, rgba(124,58,237,.06) 100%)',
        border: '1px solid rgba(0,148,255,.2)',
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '-50px', right: '-40px', width: '200px', height: '200px',
          borderRadius: '50%', background: 'rgba(0,148,255,.08)', filter: 'blur(45px)', pointerEvents: 'none',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: 46, height: 46, borderRadius: '14px',
            background: 'rgba(0,148,255,.15)', border: '1px solid rgba(0,148,255,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--waf-brand)',
          }}>
            <Icon d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" size={22} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: 'var(--text)' }}>
              {t('pages.controlspacks.title')}
            </h1>
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
              {t('pages.controlspacks.subtitle')}
            </div>
          </div>
        </div>
      </div>

      {/* ── Status row: active pack + framework reference ─────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>

        {/* Active pack */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.1rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
            background: activePack ? 'var(--waf-brand)' : 'var(--border)',
          }} />
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: 'rgba(0,148,255,0.12)', border: '1px solid rgba(0,148,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--waf-brand)',
          }}>
            <Icon d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '0.2rem' }}>
              {t('pages.controlspacks.activePack')}
            </div>
            {activePack ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                    {activePack.version}
                  </span>
                  <StatusBadge active />
                </div>
                {activePack.description && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.25rem' }}>{activePack.description}</div>
                )}
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.4rem' }}>
                  {t('pages.controlspacks.controlsCount', { count: activePack.control_count })} · {t('pages.controlspacks.activated')} {fmtDate(activePack.activated_at)}
                </div>
              </>
            ) : (
              <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{t('pages.controlspacks.noPack')}</span>
            )}
          </div>
        </div>

        {/* Framework reference */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.1rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: '#0094FF' }} />
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: 'rgba(0,148,255,0.12)', border: '1px solid rgba(0,148,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--waf-brand)',
          }}>
            <Icon d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '0.2rem' }}>
              {t('pages.controlspacks.frameworkReference')}
            </div>
            {updateLoading ? (
              <div style={{ fontSize: '0.82rem', color: 'var(--text)' }}>{t('common.loading')}</div>
            ) : updateError ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.75rem', borderRadius: 8,
                background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.18)',
                color: '#c2410c', fontSize: '0.78rem',
              }}>
                <Icon d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" size={16} />
                {updateError}
              </div>
            ) : updateInfo ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                    {updateInfo.framework.version.display || updateInfo.version}
                  </span>
                  <span style={{ padding: '0.15rem 0.55rem', borderRadius: '999px', background: 'rgba(0,148,255,.12)', color: '#0094FF', fontSize: '0.65rem', fontWeight: 700 }}>
                    {updateInfo.generated_at ? `Updated ${new Date(updateInfo.generated_at).toLocaleDateString()}` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                    Branch: <strong style={{ color: 'var(--text)' }}>{updateInfo.framework.git_branch}</strong>
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                    Commit: <strong style={{ color: 'var(--text)' }}>{updateInfo.framework.last_commit.hash?.substring(0, 8) || '—'}</strong>
                  </span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>No framework version information available.</div>
            )}
          </div>
        </div>
      </div>

      {/* ── How it works strip ───────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem',
      }}>
        {[
          { n: 1, body: t('pages.controlspacks.uploadZipStep') },
          { n: 2, body: t('pages.controlspacks.syncStep') },
          { n: 3, body: t('pages.controlspacks.immutableSnapshot') },
          { n: 4, body: t('pages.controlspacks.rollBack') },
        ].map((step, i, arr) => (
          <div key={step.n} style={{
            position: 'relative', padding: '1rem 1.1rem', borderRadius: '14px',
            background: 'var(--bg)', border: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', gap: '0.4rem',
          }}>
            {i < arr.length - 1 && (
              <div style={{
                position: 'absolute', top: '50%', right: '-0.6rem', width: '1.2rem', height: '1px',
                background: 'var(--border)', display: window.innerWidth > 900 ? 'block' : 'none',
              }} />
            )}
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: 'rgba(0,148,255,.12)', color: 'var(--waf-brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.72rem', fontWeight: 800,
            }}>{step.n}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.55 }}>{step.body}</div>
          </div>
        ))}
      </div>

      {/* ── Import new pack ──────────────────────────────────────────── */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {t('pages.controlspacks.addNewPack')}
          </h2>
          {mode && (
            <button
              onClick={() => setMode(null)}
              style={{
                background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer',
                fontSize: '0.78rem', fontWeight: 600,
              }}
            >
              {t('common.cancel')}
            </button>
          )}
        </div>

        {!mode && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {/* Upload card */}
            <button
              onClick={() => setMode('upload')}
              style={{
                padding: '1.25rem', borderRadius: '14px', textAlign: 'left', cursor: 'pointer',
                background: 'var(--bg)', border: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', gap: '0.75rem', transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,148,255,.4)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: 'rgba(0,148,255,.12)', color: 'var(--waf-brand)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" size={20} />
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)' }}>{t('pages.controlspacks.uploadZip')}</div>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.55 }}>{t('pages.controlspacks.uploadZipDesc')}</div>
            </button>

            {/* Sync card */}
            <button
              onClick={() => setMode('sync')}
              style={{
                padding: '1.25rem', borderRadius: '14px', textAlign: 'left', cursor: 'pointer',
                background: 'var(--bg)', border: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', gap: '0.75rem', transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,148,255,.4)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: 'rgba(0,148,255,.12)', color: 'var(--waf-brand)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" size={20} />
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)' }}>{t('pages.controlspacks.syncDirectory')}</div>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.55 }}>{t('pages.controlspacks.syncDesc')}</div>
            </button>
          </div>
        )}

        {mode === 'upload' && (
          <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{
              padding: '1.25rem', borderRadius: '14px', border: `2px dashed ${uploadFile ? 'var(--waf-brand)' : 'var(--border)'}`,
              background: uploadFile ? 'rgba(0,148,255,.04)' : 'var(--bg)', transition: 'all .15s',
            }}>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', padding: '1rem' }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: uploadFile ? 'rgba(0,148,255,.15)' : 'var(--surface)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: uploadFile ? 'var(--waf-brand)' : 'var(--muted)',
                }}>
                  <Icon d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 0v10m0-10a2 2 0 012 2h2a2 2 0 012-2" size={22} />
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: uploadFile ? 'var(--waf-brand)' : 'var(--text)' }}>
                  {uploadFile ? uploadFile.name : t('pages.controlspacks.chooseFile')}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{t('pages.controlspacks.uploadZipDesc')}</div>
                <input
                  id="zip-file-input"
                  type="file"
                  accept=".zip"
                  style={{ display: 'none' }}
                  onChange={e => setUploadFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Input
                label={t('pages.controlspacks.version')}
                value={uploadVersion}
                onChange={setUploadVersion}
                placeholder={t('pages.controlspacks.versionPlaceholder')}
                required
              />
              <Input
                label={t('pages.controlspacks.description')}
                value={uploadDesc}
                onChange={setUploadDesc}
                placeholder={t('pages.controlspacks.descriptionPlaceholder')}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="submit"
                disabled={uploading || !uploadFile || !uploadVersion.trim()}
                style={{
                  padding: '0.6rem 1.25rem', borderRadius: '10px', fontWeight: 700,
                  fontSize: '0.85rem', cursor: uploading || !uploadFile || !uploadVersion.trim() ? 'not-allowed' : 'pointer',
                  background: 'var(--waf-brand)', color: '#fff', border: 'none',
                  opacity: uploading || !uploadFile || !uploadVersion.trim() ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', gap: 6,
                  boxShadow: '0 4px 14px rgba(0,148,255,.25)',
                }}
              >
                {uploading ? (
                  <>
                    <span className="spinner" style={{ width: 14, height: 14 }} />
                    {t('pages.controlspacks.uploading')}
                  </>
                ) : (
                  <>
                    <Icon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" size={16} />
                    {t('pages.controlspacks.uploadActivate')}
                  </>
                )}
              </button>
            </div>
            {uploadError && (
              <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', fontSize: '0.8rem' }}>
                {uploadError}
              </div>
            )}
          </form>
        )}

        {mode === 'sync' && (
          <form onSubmit={handleSync} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{
              padding: '1rem 1.25rem', borderRadius: '12px',
              background: 'rgba(0,148,255,.05)', border: '1px solid rgba(0,148,255,.15)',
              fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.6,
            }}
              dangerouslySetInnerHTML={{
                __html: t('pages.controlspacks.syncDesc')
                  .replace('WAFPASS_CONTROLS_DIR', '<code style="color:var(--text);background:var(--surface);padding:0.1rem 0.35rem;border-radius:4px;font-size:0.72rem">WAFPASS_CONTROLS_DIR</code>'),
              }}
            />
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Input
                label={t('pages.controlspacks.version')}
                value={syncVersion}
                onChange={setSyncVersion}
                placeholder={t('pages.controlspacks.versionPlaceholder')}
                required
              />
              <Input
                label={t('pages.controlspacks.description')}
                value={syncDesc}
                onChange={setSyncDesc}
                placeholder={t('pages.controlspacks.descriptionPlaceholder')}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="submit"
                disabled={syncing || !syncVersion.trim()}
                style={{
                  padding: '0.6rem 1.25rem', borderRadius: '10px', fontWeight: 700,
                  fontSize: '0.85rem', cursor: syncing ? 'not-allowed' : 'pointer',
                  background: 'var(--waf-brand)', color: '#fff', border: 'none',
                  opacity: syncing || !syncVersion.trim() ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', gap: 6,
                  boxShadow: '0 4px 14px rgba(0,148,255,.25)',
                }}
              >
                {syncing ? (
                  <>
                    <span className="spinner" style={{ width: 14, height: 14 }} />
                    {t('pages.controlspacks.syncing')}
                  </>
                ) : (
                  <>
                    <Icon d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" size={16} />
                    {t('pages.controlspacks.syncActivate')}
                  </>
                )}
              </button>
            </div>
            {syncError && (
              <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', fontSize: '0.8rem' }}>
                {syncError}
              </div>
            )}
          </form>
        )}
      </div>

      {/* ── Pack history ─────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {t('pages.controlspacks.packHistory')}
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            {t('pages.controlspacks.pack', { count: packs.length, suffix: packs.length === 1 ? '' : 's' })}
          </span>
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem' }}>
            <div className="spinner" />
          </div>
        )}

        {error && (
          <div style={{ padding: '1rem 1.5rem', color: '#dc2626', fontSize: '0.85rem' }}>{error}</div>
        )}

        {actionError && (
          <div style={{ margin: '0.75rem 1.5rem', padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626', fontSize: '0.8rem' }}>
            {actionError}
          </div>
        )}

        {!loading && packs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
            {t('pages.controlspacks.noPacks')}
          </div>
        )}

        {!loading && packs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {packs.map((pack, idx) => (
              <div
                key={pack.version}
                style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  padding: '1rem 1.5rem',
                  borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
                  background: pack.is_active ? 'rgba(0,148,255,.03)' : 'transparent',
                  transition: 'background .12s',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: pack.is_active ? 'rgba(0,148,255,.12)' : 'var(--bg)',
                  border: `1px solid ${pack.is_active ? 'rgba(0,148,255,.25)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: pack.is_active ? 'var(--waf-brand)' : 'var(--muted)',
                }}>
                  <Icon d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" size={18} />
                </div>

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>
                      {pack.version}
                    </span>
                    <StatusBadge active={pack.is_active} />
                  </div>
                  {pack.description ? (
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{pack.description}</div>
                  ) : (
                    <div style={{ fontSize: '0.78rem', color: 'var(--border)' }}>—</div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'right', minWidth: '80px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('pages.controlspacks.controlsCol')}</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text)' }}>{pack.control_count}</div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: '110px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('pages.controlspacks.importedCol')}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{fmtDate(pack.imported_at)}</div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: '110px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('pages.controlspacks.activatedCol')}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{fmtDate(pack.activated_at)}</div>
                  </div>
                </div>

                <div style={{ flexShrink: 0 }}>
                  {!pack.is_active ? (
                    <button
                      disabled={activating === pack.version}
                      onClick={() => handleActivate(pack.version)}
                      style={{
                        padding: '0.45rem 1rem', borderRadius: '8px', fontSize: '0.78rem',
                        fontWeight: 700, cursor: activating === pack.version ? 'not-allowed' : 'pointer',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)', color: 'var(--text)',
                        opacity: activating === pack.version ? 0.6 : 1,
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => { if (activating !== pack.version) e.currentTarget.style.borderColor = 'var(--waf-brand)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                    >
                      {activating === pack.version ? t('pages.controlspacks.activating') : t('pages.controlspacks.activateBtn')}
                    </button>
                  ) : (
                    <div style={{
                      padding: '0.45rem 1rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700,
                      color: '#059669', background: 'rgba(5,150,105,.08)', border: '1px solid rgba(5,150,105,.2)',
                    }}>
                      {t('pages.controlspacks.currentActive')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Catalogue link footer ────────────────────────────────────── */}
      <div className="card" style={{
        display: 'flex', alignItems: 'center', gap: '1rem', justifyContent: 'space-between', flexWrap: 'wrap',
        background: 'var(--bg)', border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'rgba(0,148,255,.12)', color: 'var(--waf-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text)' }}>{t('pages.controlspacks.manageControls')}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{t('pages.controlspacks.singlePointTruth')}</div>
          </div>
        </div>
        <button
          onClick={() => navigate('catalogue')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            padding: '0.5rem 1rem', borderRadius: '8px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            color: 'var(--text)', fontSize: '0.78rem', fontWeight: 700,
            cursor: 'pointer', transition: 'all .12s',
          }}
        >
          {t('pages.controlspacks.catalogueLink')}
          <Icon d="M9 5l7 7-7 7" size={14} />
        </button>
      </div>

    </div>
  )
}
