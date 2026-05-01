import { useEffect, useState } from 'react'
import { useTheme } from '../theme'
import { UserPreferences, saveUserPrefs, DEFAULT_USER_PREFS } from './userPrefsUtils'
import { LOCALES, useI18n } from '../i18n'

interface Props {
  prefs: UserPreferences
  user: { username: string; display_name: string; role: string }
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error'
  onChange: (prefs: UserPreferences) => void
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} style={{
      width: '36px', height: '20px', borderRadius: '999px', border: 'none',
      cursor: 'pointer', background: checked ? 'var(--waf-brand)' : '#475569',
      transition: 'background 0.2s', position: 'relative', flexShrink: 0,
    }}>
      <span style={{
        position: 'absolute', top: '2px', left: checked ? '18px' : '2px',
        width: '16px', height: '16px', borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
      }} />
    </button>
  )
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.55rem 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>{label}</div>
        {desc && <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.05rem' }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

const sel: React.CSSProperties = {
  background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 7, padding: '0.28rem 0.55rem', fontSize: '0.78rem', outline: 'none', cursor: 'pointer',
}

const PAGE_OPTIONS = [
  { value: 'dashboard',  label: 'Executive Dashboard' },
  { value: 'findings',   label: 'Scan Findings' },
  { value: 'compliance', label: 'Compliance Matrix' },
  { value: 'runs',       label: 'Run History' },
  { value: 'journey',    label: 'Maturity Journey' },
]

const SYNC_LABEL: Record<NonNullable<Props['syncStatus']>, { text: string; color: string }> = {
  idle:    { text: 'Local only',       color: '#64748b' },
  syncing: { text: 'Saving…',          color: '#0094FF' },
  synced:  { text: '✓ Synced',         color: '#22c55e' },
  error:   { text: 'Sync failed',      color: '#f87171' },
}

export default function UserPreferencesPage({ prefs, user, syncStatus, onChange }: Props) {
  const { t } = useI18n()
  const { themeName, toggleTheme } = useTheme()
  const [p, setP] = useState<UserPreferences>(prefs)

  // If the parent updates prefs (e.g. after server fetch on mount), reflect it
  useEffect(() => { setP(prefs) }, [prefs])

  function update(partial: Partial<UserPreferences>) {
    const next = { ...p, ...partial }
    setP(next)
    saveUserPrefs(next)  // localStorage immediately
    onChange(next)       // propagates to App → debounced server push
  }

  const initials = (user.display_name || user.username).slice(0, 2).toUpperCase()
  const sync = SYNC_LABEL[syncStatus]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Identity banner ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1rem',
        padding: '1rem 1.25rem', borderRadius: 12,
        background: 'var(--surface)', border: '1px solid var(--border)',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(0,148,255,.15)', border: '2px solid rgba(0,148,255,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.1rem', fontWeight: 800, color: 'var(--waf-brand)',
        }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>
            {user.display_name || user.username}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {user.role} · {user.username}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: sync.color }}>
            {sync.text}
          </div>
          <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: '0.15rem' }}>
            {t('prefs.changesInstant')}
          </div>
        </div>
      </div>

      {/* ── 3-column grid ───────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', alignItems: 'start' }}>

        {/* ── Appearance ──────────────────────────────────────────────────── */}
        <div className="card" style={{ padding: '0.9rem 1rem' }}>
          <div style={{ fontSize: '0.67rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>{t('prefs.appearance')}</div>

          <Row label={t('prefs.theme')}>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {(['dark', 'light'] as const).map(t => (
                <button key={t} onClick={() => { if (themeName !== t) toggleTheme() }} style={{
                  padding: '0.22rem 0.55rem', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${themeName === t ? 'var(--waf-brand)' : 'var(--border)'}`,
                  background: themeName === t ? 'rgba(0,148,255,0.15)' : 'var(--bg)',
                  color: themeName === t ? 'var(--waf-brand)' : 'var(--muted)',
                }}>
                  {t === 'dark' ? '🌙' : '☀️'} {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </Row>

          <Row label={t('prefs.compactSidebar')} desc={t('prefs.compactSidebarDesc')}>
            <Toggle checked={p.sidebarCompact} onChange={v => update({ sidebarCompact: v })} />
          </Row>

          <Row label={t('prefs.hideDisabled')} desc={t('prefs.hideDisabledDesc')}>
            <Toggle checked={p.hideDisabledMenuItems} onChange={v => update({ hideDisabledMenuItems: v })} />
          </Row>

          <Row label={t('prefs.inlineHelp')} desc={t('prefs.inlineHelpDesc')}>
            <Toggle checked={p.showInlineHelp} onChange={v => update({ showInlineHelp: v })} />
          </Row>
        </div>

        {/* ── Navigation & Dates ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <div className="card" style={{ padding: '0.9rem 1rem' }}>
            <div style={{ fontSize: '0.67rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>{t('prefs.navigation')}</div>

            <Row label={t('prefs.defaultPage')} desc={t('prefs.defaultPageDesc')}>
              <select value={p.defaultPage} onChange={e => update({ defaultPage: e.target.value })} style={sel}>
                {PAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Row>

            <Row label={t('prefs.language')} desc={t('prefs.languageDesc')}>
              <select value={p.language} onChange={e => update({ language: e.target.value })} style={sel}>
                <option value="">{t('prefs.languageSystemDefault')}</option>
                {Object.values(LOCALES).map(l => (
                  <option key={l.meta!.code} value={l.meta!.code}>
                    {l.meta!.flag} {l.meta!.name}
                  </option>
                ))}
              </select>
            </Row>
          </div>

          <div className="card" style={{ padding: '0.9rem 1rem' }}>
            <div style={{ fontSize: '0.67rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>{t('prefs.dates')}</div>

            <Row label={t('prefs.dateFormat')}>
              <select value={p.dateFormat} onChange={e => update({ dateFormat: e.target.value as UserPreferences['dateFormat'] })} style={sel}>
                <option value="relative">{t('prefs.dateRelative')}</option>
                <option value="absolute">{t('prefs.dateAbsolute')}</option>
                <option value="full">{t('prefs.dateFull')}</option>
              </select>
            </Row>

            <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.55rem', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', fontSize: '0.71rem', color: 'var(--muted)' }}>
              {t('prefs.datePreview')}{' '}
              <strong style={{ color: 'var(--text)' }}>
                {p.dateFormat === 'relative' && '2 hours ago'}
                {p.dateFormat === 'absolute' && new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                {p.dateFormat === 'full' && new Date().toISOString().slice(0, 16).replace('T', ' ')}
              </strong>
            </div>
          </div>
        </div>

        {/* ── Reports & Reset ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <div className="card" style={{ padding: '0.9rem 1rem' }}>
            <div style={{ fontSize: '0.67rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.5rem' }}>{t('prefs.reports')}</div>

            <Row label={t('prefs.autoPdf')} desc={t('prefs.autoPdfDesc')}>
              <Toggle checked={p.pdfAutoOpen} onChange={v => update({ pdfAutoOpen: v })} />
            </Row>
          </div>

          <div className="card" style={{ padding: '0.9rem 1rem' }}>
            <div style={{ fontSize: '0.67rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.6rem' }}>{t('prefs.resetSection')}</div>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
              {t('prefs.resetDesc')}
            </p>
            <button
              onClick={() => update({ ...DEFAULT_USER_PREFS })}
              style={{
                width: '100%', background: 'var(--bg)', color: 'var(--muted)',
                border: '1px solid var(--border)', borderRadius: 8,
                padding: '0.5rem', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
              }}>
              {t('prefs.resetBtn')}
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}
