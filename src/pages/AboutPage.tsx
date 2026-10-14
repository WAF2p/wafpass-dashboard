import { useEffect, useState } from 'react'
import { getApiBase } from '../api'
import { useI18n } from '../i18n'
import { SectionCard, SocStyles } from './shared/SocComponents'

interface VersionInfo {
  server_version: string
  core_version: string
  wafpass_server: string
  wafpass_core: string
}

export default function AboutPage() {
  const { t } = useI18n()
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const fetchVersionInfo = async () => {
    setLoading(true)
    setError(null)
    try {
      const base = getApiBase() || window.location.origin
      const res = await fetch(`${base}/version`)
      if (res.ok) {
        const data = await res.json() as VersionInfo
        setVersionInfo(data)
      } else {
        setError(`Failed to fetch version info: ${res.status} ${res.statusText}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch version info')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchVersionInfo() }, [])

  const dashboardVersion = import.meta.env.VITE_APP_VERSION || '1.1.0'
  const serverUrl = (getApiBase() || window.location.origin).replace(/\/$/, '')
  const dashboardUrl = window.location.origin.replace(/\/$/, '')

  const debugText = [
    `Dashboard UI: ${dashboardVersion}`,
    `Dashboard URL: ${dashboardUrl}`,
    `Server URL: ${serverUrl}`,
    versionInfo ? `wafpass-server: ${versionInfo.wafpass_server}` : null,
    versionInfo ? `wafpass-core: ${versionInfo.wafpass_core}` : null,
    versionInfo ? `server_version: ${versionInfo.server_version}` : null,
    versionInfo ? `core_version: ${versionInfo.core_version}` : null,
  ].filter(Boolean).join('\n')

  return (
    <div className="about-root">
      <SocStyles />
      <style>{aboutPageCss}</style>

      <div className="about-hero">
        <div className="about-hero__badge">WAF++</div>
        <h1 className="about-hero__title">{t('about.title')}</h1>
        <p className="about-hero__subtitle">{t('about.subtitle')}</p>
      </div>

      <div className="about-grid">
        <div className="about-main">
          <SectionCard title={t('about.projectTitle')}>
            <div className="about-copy">
              <p>{t('about.projectP1')}</p>
              <p>{t('about.projectP2')}</p>
            </div>
          </SectionCard>

          <SectionCard title={t('about.missionTitle')}>
            <div className="about-copy">
              <p>{t('about.missionP1')}</p>
              <p>{t('about.missionP2')}</p>
            </div>
          </SectionCard>

          <SectionCard title={t('about.teamTitle')}>
            <div className="about-copy">
              <p>{t('about.teamP1')}</p>
            </div>
          </SectionCard>

          <SectionCard title={t('about.openSourceTitle')}>
            <div className="about-copy">
              <p>{t('about.openSourceP1')}</p>
              <p>{t('about.openSourceP2')}</p>
            </div>
          </SectionCard>

          <SectionCard title={t('about.supportTitle')}>
            <div className="about-copy">
              <p>{t('about.supportP1')}</p>
              <p className="about-email">{t('about.supportEmail')}</p>
            </div>
          </SectionCard>
        </div>

        <div className="about-sidebar">
          <SectionCard
            title={t('about.debugTitle')}
            subtitle={t('about.debugSubtitle')}
            style={{ position: 'sticky', top: '1rem' }}
          >
            {loading && (
              <div className="about-debug-loading">
                <div className="spinner" />
                <span>{t('about.loadingVersion')}</span>
              </div>
            )}

            {!loading && (error || !versionInfo) && (
              <div className="about-debug-error">
                <div className="about-debug-error__title">{t('about.versionError')}</div>
                <p>{error || 'Unable to fetch version information'}</p>
              </div>
            )}

            {!loading && versionInfo && (
              <div className="about-debug-grid">
                <div className="about-debug-card">
                  <div className="about-debug-card__label">{t('about.componentServer')}</div>
                  <div className="about-debug-card__value">{versionInfo.wafpass_server}</div>
                  <a className="about-debug-card__link" href={`${serverUrl}/health`} target="_blank" rel="noopener noreferrer">
                    {t('about.healthCheck')}
                  </a>
                </div>
                <div className="about-debug-card">
                  <div className="about-debug-card__label">{t('about.componentCore')}</div>
                  <div className="about-debug-card__value">{versionInfo.wafpass_core}</div>
                  <div className="about-debug-card__mini">
                    <span>server_version:</span> {versionInfo.server_version}
                  </div>
                  <div className="about-debug-card__mini">
                    <span>core_version:</span> {versionInfo.core_version}
                  </div>
                  <a className="about-debug-card__link" href={`${serverUrl}/version`} target="_blank" rel="noopener noreferrer">
                    {t('about.apiVersion')}
                  </a>
                </div>
                <div className="about-debug-card">
                  <div className="about-debug-card__label">{t('about.componentDashboard')}</div>
                  <div className="about-debug-card__value">{dashboardVersion}</div>
                  <a className="about-debug-card__link" href={`${dashboardUrl}/health`} target="_blank" rel="noopener noreferrer">
                    {t('about.dashboardHealth')}
                  </a>
                </div>
              </div>
            )}

            <div className="about-debug-actions">
              <button className="scc-btn-ghost" onClick={fetchVersionInfo} disabled={loading}>
                {t('about.refresh')}
              </button>
              <button
                className="scc-btn-ghost"
                onClick={() => navigator.clipboard.writeText(debugText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })}
                disabled={loading || !versionInfo}
              >
                {copied ? t('about.copiedDebug') : t('about.copyDebug')}
              </button>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

const aboutPageCss = `
.about-root {
  padding: 0 0 24px;
  max-width: 1100px;
  margin: 0 auto;
}

.about-hero {
  margin-bottom: 1.25rem;
}
.about-hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--waf-brand);
  text-transform: uppercase;
  background: color-mix(in srgb, var(--waf-brand) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--waf-brand) 20%, transparent);
  border-radius: 999px;
  padding: 0.25rem 0.65rem;
  margin-bottom: 0.5rem;
}
.about-hero__title {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text);
  margin: 0;
}
.about-hero__subtitle {
  font-size: 0.8rem;
  color: var(--muted);
  margin: 0.35rem 0 0;
  max-width: 680px;
}

.about-grid {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
}
.about-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.about-sidebar {
  width: 360px;
  flex-shrink: 0;
}

.about-copy {
  font-size: 0.85rem;
  line-height: 1.8;
  color: var(--text);
}
.about-copy p {
  margin: 0 0 0.85rem;
}
.about-copy p:last-child {
  margin-bottom: 0;
}
.about-email {
  display: inline-block;
  font-weight: 600;
  font-family: monospace;
  background: color-mix(in srgb, var(--waf-brand) 10%, transparent);
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  margin-top: 0.25rem;
}

.about-debug-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 0;
  color: var(--muted);
  font-size: 0.78rem;
}
.about-debug-error {
  padding: 0.75rem;
  border-radius: 8px;
  background: rgba(220, 38, 38, 0.08);
  border: 1px solid rgba(220, 38, 38, 0.25);
  color: #dc2626;
  font-size: 0.78rem;
  margin-bottom: 0.75rem;
}
.about-debug-error__title {
  font-weight: 700;
  margin-bottom: 0.25rem;
}
.about-debug-error p {
  margin: 0;
}

.about-debug-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.about-debug-card {
  padding: 0.75rem;
  border-radius: 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.about-debug-card__label {
  font-size: 0.55rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.09em;
}
.about-debug-card__value {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text);
  font-family: monospace;
  word-break: break-word;
}
.about-debug-card__mini {
  font-size: 0.72rem;
  color: var(--text);
  font-family: monospace;
}
.about-debug-card__mini span {
  color: var(--muted);
  margin-right: 0.35rem;
}
.about-debug-card__link {
  color: var(--waf-brand);
  text-decoration: none;
  font-size: 0.7rem;
  font-weight: 600;
  margin-top: 0.25rem;
}
.about-debug-card__link:hover {
  text-decoration: underline;
}

.about-debug-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  border-top: 1px solid var(--border);
  padding-top: 0.75rem;
}

@media (max-width: 900px) {
  .about-grid { flex-direction: column; }
  .about-sidebar { width: 100%; position: static; }
}
`
