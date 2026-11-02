/**
 * ImpersonationBanner — a persistent strip above the top nav, visible on
 * every page, whenever a holding_admin/holding_viewer is "viewing as" one
 * specific mandate (Phase 6a's Global Context Switcher — set via
 * MandateIndicator's dropdown or by clicking a mandate's logo on
 * MandateManagementPage). Exists so switching context is never silent:
 * every other page a holding_admin lands on while switched in should make
 * it obvious they aren't seeing their full cross-mandate view.
 *
 * Sets/removes a class on <body> rather than rendering inline, so
 * index.css's .app-top-nav/.app-main-content can shift down by exactly
 * this banner's height from one place (--impersonation-banner-height)
 * instead of this component needing to know about the nav's own layout.
 */
import { useEffect } from 'react'
import { useAuth } from '../AuthContext'
import { useI18n } from '../i18n'

export default function ImpersonationBanner() {
  const { effectiveMandantId, effectiveMandantName, setEffectiveMandantId } = useAuth()
  const { t } = useI18n()

  useEffect(() => {
    document.body.classList.toggle('has-impersonation-banner', !!effectiveMandantId)
    return () => { document.body.classList.remove('has-impersonation-banner') }
  }, [effectiveMandantId])

  if (!effectiveMandantId) return null

  return (
    <div className="impersonation-banner">
      <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
      </svg>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {t('nav.impersonationBanner.viewingAs', { name: effectiveMandantName || t('nav.impersonationBanner.unknownMandate') })}
      </span>
      <button
        onClick={() => {
          setEffectiveMandantId(null)
          // Same reasoning as MandateIndicator's own switch: every page's
          // already-fetched data was scoped under the mandate being exited,
          // so a full reload is the simple, always-correct way back.
          window.location.reload()
        }}
      >
        {t('nav.impersonationBanner.exit')}
      </button>
    </div>
  )
}
