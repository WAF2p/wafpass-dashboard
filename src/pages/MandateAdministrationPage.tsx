/**
 * Mandate Administration — the one-way multi-mandant activation switch.
 * Moved out of SettingsPage.tsx into its own System-section page. Visible
 * to admin/holding_admin only; see decisions/adrs/ADR-003-multi-mandant-tenancy.md
 * and .plan.md.
 */
import { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import { fetchInstanceMode, activateMultiMandant, type InstanceModeOut } from '../api'
import { useI18n } from '../i18n'

function HelpCircleIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 115.82 1c0 2-3 2-3 5" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Impact disclosure — extensive by default before activation (so an admin
// reads it before they can even see the activate button), tucked behind a
// "?" toggle (collapsed by default) once the switch has already been
// flipped, since it's reference material at that point, not a decision aid.
function ImpactDisclosure({ defaultOpen }: { defaultOpen: boolean }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(defaultOpen)

  const sections: Array<[string, string]> = [
    ['dataHeading', 'dataBody'],
    ['enforcementHeading', 'enforcementBody'],
    ['rolesHeading', 'rolesBody'],
    ['apiKeysHeading', 'apiKeysBody'],
    ['ssoHeading', 'ssoBody'],
    ['badgesHeading', 'badgesBody'],
    ['performanceHeading', 'performanceBody'],
    ['irreversibleHeading', 'irreversibleBody'],
    ['nextStepsHeading', 'nextStepsBody'],
  ]

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          color: 'var(--waf-brand)', fontSize: '0.78rem', fontWeight: 600,
        }}
      >
        <HelpCircleIcon />
        {t('pages.mandateAdmin.impact.toggleLabel')}
      </button>

      {open && (
        <div style={{
          marginTop: '0.75rem', padding: '1rem 1.1rem', borderRadius: '10px',
          background: 'var(--bg)', border: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: '0.9rem',
        }}>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.35rem' }}>
              {t('pages.mandateAdmin.impact.title')}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--muted)', lineHeight: 1.55 }}>
              {t('pages.mandateAdmin.impact.intro')}
            </div>
          </div>
          {sections.map(([headingKey, bodyKey]) => (
            <div key={headingKey}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.2rem' }}>
                {t(`pages.mandateAdmin.impact.${headingKey}`)}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.55 }}>
                {t(`pages.mandateAdmin.impact.${bodyKey}`)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MandateAdministrationPage() {
  const { t } = useI18n()
  const { role, isHoldingAdmin, refreshUser } = useAuth()
  const canSeeMandateAdmin = role === 'admin' || isHoldingAdmin

  const [info, setInfo] = useState<InstanceModeOut | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activating, setActivating] = useState(false)
  const [activateErr, setActivateErr] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!canSeeMandateAdmin) { setLoading(false); return }
    fetchInstanceMode()
      .then(setInfo)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [canSeeMandateAdmin])

  async function handleActivate() {
    setActivating(true)
    setActivateErr(null)
    try {
      await activateMultiMandant()
      const refreshed = await fetchInstanceMode()
      setInfo(refreshed)
      setConfirming(false)
      // The acting admin becomes the holding's first holding_admin
      // server-side (see admin.py's _activate()) — but nothing else
      // re-fetches this session's own user profile, so isHoldingAdmin
      // would otherwise stay stale (and the Mandates nav item invisible)
      // until the next login or page reload.
      await refreshUser()
    } catch (e) {
      setActivateErr((e as Error).message)
    } finally {
      setActivating(false)
    }
  }

  if (!canSeeMandateAdmin) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '1rem 1.25rem', borderRadius: '10px',
        background: 'rgba(218,44,56,0.06)', border: '1px solid rgba(218,44,56,0.18)',
      }}>
        <svg width="16" height="16" fill="none" stroke="#DA2C38" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span style={{ fontSize: '0.83rem', color: '#DA2C38', fontWeight: 600 }}>{t('pages.mandateAdmin.accessDenied')}</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <section className="card">
        {loading ? (
          <div style={{ padding: '0.5rem 0' }}><div className="spinner" /></div>
        ) : error ? (
          <div style={{ color: '#DA2C38', fontSize: '0.8rem' }}>{error}</div>
        ) : info && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{t('pages.mandateAdmin.currentMode')}</span>
              <span style={{
                display: 'inline-flex', padding: '0.2rem 0.65rem', borderRadius: '999px',
                background: info.instance_mode === 'multi_mandant' ? 'rgba(124,58,237,0.1)' : 'rgba(100,116,139,0.1)',
                color: info.instance_mode === 'multi_mandant' ? '#7c3aed' : 'var(--muted)',
                fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.02em',
              }}>
                {info.instance_mode === 'multi_mandant'
                  ? t('pages.mandateAdmin.modeMultiMandant')
                  : t('pages.mandateAdmin.modeSingleTenant')}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
              <span>{t('pages.mandateAdmin.userCount', { count: info.user_count })}</span>
              <span>{t('pages.mandateAdmin.mandantCount', { count: info.mandant_count })}</span>
            </div>

            {info.instance_mode === 'multi_mandant' ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.6rem 0.85rem', borderRadius: '8px',
                background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)',
              }}>
                <svg width="14" height="14" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#7c3aed' }}>
                  {t('pages.mandateAdmin.irreversibleBadge')}
                </span>
                {info.changed_by_username && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginLeft: '0.25rem' }}>
                    {t('pages.mandateAdmin.activatedBy', { username: info.changed_by_username })}
                  </span>
                )}
              </div>
            ) : null}

            {info.instance_mode === 'multi_mandant' ? (
              <ImpactDisclosure defaultOpen={false} />
            ) : !confirming ? (
              <>
                <ImpactDisclosure defaultOpen={true} />
                <div>
                  <button
                    onClick={() => setConfirming(true)}
                    style={{
                      padding: '0.45rem 0.9rem', borderRadius: '8px', border: 'none',
                      background: '#7c3aed', color: '#fff', fontWeight: 600,
                      fontSize: '0.78rem', cursor: 'pointer',
                    }}
                  >
                    {t('pages.mandateAdmin.activateBtn')}
                  </button>
                </div>
              </>
            ) : (
              <div style={{
                padding: '0.85rem', borderRadius: '8px',
                background: 'rgba(218,44,56,0.05)', border: '1px solid rgba(218,44,56,0.2)',
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.4rem' }}>
                  {t('pages.mandateAdmin.confirmTitle')}
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--muted)', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                  {t('pages.mandateAdmin.confirmBody')}
                </div>
                {activateErr && <div style={{ color: '#DA2C38', fontSize: '0.76rem', marginBottom: '0.6rem' }}>{activateErr}</div>}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={handleActivate}
                    disabled={activating}
                    style={{
                      padding: '0.4rem 0.85rem', borderRadius: '8px', border: 'none',
                      background: '#DA2C38', color: '#fff', fontWeight: 700,
                      fontSize: '0.76rem', cursor: activating ? 'default' : 'pointer', opacity: activating ? 0.7 : 1,
                    }}
                  >
                    {activating ? t('pages.mandateAdmin.activating') : t('pages.mandateAdmin.confirmBtn')}
                  </button>
                  <button
                    onClick={() => { setConfirming(false); setActivateErr(null) }}
                    style={{
                      padding: '0.4rem 0.85rem', borderRadius: '8px',
                      border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)',
                      fontSize: '0.76rem', cursor: 'pointer',
                    }}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
