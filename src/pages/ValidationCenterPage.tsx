/**
 * Validation Center — unified page for the WAF++ PASS cryptographic validation
 * registry and the "ship run" submission flow, plus a 2028 GA teaser banner.
 */
import { useState } from 'react'
import { getGatewayRootCertificateUrl } from '../api'
import { useI18n } from '../i18n'
import ShipRunPage from './ShipRunPage'
import ValidationsPage from './ValidationsPage'

const TABS = [
  { key: 'registry', labelKey: 'tabRegistry' },
  { key: 'ship', labelKey: 'tabShip' },
] as const

type TabKey = typeof TABS[number]['key']

export interface ValidationCenterPageProps {
  initialTab?: TabKey
}

function TeaserBanner() {
  const { t } = useI18n()
  return (
    <div style={{
      marginBottom: '1.25rem',
      padding: '0.85rem 1rem',
      borderRadius: '10px',
      border: '1px solid rgba(217,119,6,0.25)',
      background: 'rgba(217,119,6,0.08)',
      color: 'var(--text)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.65rem',
      fontSize: '0.82rem',
    }}>
      <svg width="20" height="20" fill="none" stroke="#d97706" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
      <span>
        <strong style={{ color: '#b45309' }}>{t('pages.validationCenter.teaserLabel')}</strong>{' '}
        {t('pages.validationCenter.teaserText')}
      </span>
    </div>
  )
}

function linkBtnStyle(): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.45rem 0.75rem', borderRadius: '8px',
    background: 'var(--surface)', border: '1px solid var(--border)',
    color: 'var(--waf-brand)', fontSize: '0.78rem', fontWeight: 600,
    textDecoration: 'none',
  }
}

export default function ValidationCenterPage({ initialTab = 'registry' }: ValidationCenterPageProps) {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)

  return (
    <div style={{ padding: '1.25rem 1.5rem', maxWidth: '1600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.4rem', color: 'var(--text)' }}>
            {t('pages.validationCenter.title')}
          </h1>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)' }}>
            {t('pages.validationCenter.subtitle')}
          </p>
        </div>
        <a href={getGatewayRootCertificateUrl()} download style={linkBtnStyle()}>
          {t('pages.validationCenter.downloadRootCa')}
        </a>
      </div>

      <TeaserBanner />

      <div style={{
        display: 'inline-flex',
        gap: '0.25rem',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '0.35rem',
        marginBottom: '1.25rem',
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                border: 'none',
                background: active ? 'color-mix(in srgb, var(--waf-brand) 12%, transparent)' : 'transparent',
                color: active ? 'var(--waf-brand)' : 'var(--muted)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {t(`pages.validationCenter.${tab.labelKey}`)}
            </button>
          )
        })}
      </div>

      {activeTab === 'registry' ? (
        <ValidationsPage mode="panel" />
      ) : (
        <ShipRunPage mode="panel" />
      )}
    </div>
  )
}
