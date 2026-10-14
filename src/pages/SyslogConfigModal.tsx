import { useEffect, useMemo, useState } from 'react'
import { fetchSyslogConfig, SYSLOG_ACTIONS, SyslogConfig, SyslogConfigInput, testSyslogConfig, updateSyslogConfig } from '../api'
import { useI18n } from '../i18n'
import { CheckIcon, ExclaimIcon, SettingsIcon, XIcon } from './shared/SocComponents'

interface Props {
  onClose: () => void
  onSaved?: (config: SyslogConfig) => void
}

const SEVERITY_LABELS = [
  '0 — Emergency',
  '1 — Alert',
  '2 — Critical',
  '3 — Error',
  '4 — Warning',
  '5 — Notice',
  '6 — Informational',
  '7 — Debug',
]

export default function SyslogConfigModal({ onClose, onSaved }: Props) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const [enabled, setEnabled] = useState(false)
  const [host, setHost] = useState('')
  const [port, setPort] = useState(514)
  const [protocol, setProtocol] = useState<'udp' | 'tcp'>('udp')
  const [syslogFormat, setSyslogFormat] = useState<'rfc3164' | 'rfc5424'>('rfc5424')
  const [facility, setFacility] = useState(13)
  const [tlsEnabled, setTlsEnabled] = useState(false)
  const [programTag, setProgramTag] = useState('wafpass-admin')
  const [overrides, setOverrides] = useState<[string, number][]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchSyslogConfig()
      .then(cfg => {
        if (cancelled) return
        setEnabled(cfg.enabled)
        setHost(cfg.host)
        setPort(cfg.port)
        setProtocol(cfg.protocol)
        setSyslogFormat(cfg.syslog_format)
        setFacility(cfg.facility)
        setTlsEnabled(cfg.tls_enabled)
        setProgramTag(cfg.program_tag)
        setOverrides(Object.entries(cfg.severity_overrides ?? {}))
      })
      .catch(e => {
        if (!cancelled) setLoadError(t('pages.adminLogs.siemLoadFailed', { error: e instanceof Error ? e.message : String(e) }))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [t])

  const usedActions = useMemo(() => new Set(overrides.map(([a]) => a)), [overrides])
  const availableActions = useMemo(() => SYSLOG_ACTIONS.filter(a => !usedActions.has(a)), [usedActions])

  function validate(): string | null {
    if (enabled && !host.trim()) return t('pages.adminLogs.siemHostRequired')
    if (port < 1 || port > 65535) return t('pages.adminLogs.siemPortRange')
    if (protocol !== 'udp' && protocol !== 'tcp') return t('pages.adminLogs.siemInvalidProtocol')
    if (syslogFormat !== 'rfc3164' && syslogFormat !== 'rfc5424') return t('pages.adminLogs.siemInvalidFormat')
    return null
  }

  async function handleSave() {
    setFormError(null)
    const err = validate()
    if (err) {
      setFormError(err)
      return
    }
    setSaving(true)
    const payload: SyslogConfigInput = {
      enabled,
      host: host.trim(),
      port,
      protocol,
      syslog_format: syslogFormat,
      facility,
      tls_enabled: tlsEnabled,
      program_tag: programTag.trim() || 'wafpass-admin',
      severity_overrides: Object.fromEntries(overrides.filter(([a]) => a)),
    }
    try {
      const cfg = await updateSyslogConfig(payload)
      onSaved?.(cfg)
      onClose()
    } catch (e) {
      setFormError(t('pages.adminLogs.siemSaveFailed', { error: e instanceof Error ? e.message : String(e) }))
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setFormError(null)
    setTestResult(null)
    const err = validate()
    if (err) {
      setFormError(err)
      return
    }
    setTesting(true)
    try {
      const res = await testSyslogConfig()
      setTestResult(res)
    } catch (e) {
      setTestResult({ success: false, message: e instanceof Error ? e.message : String(e) })
    } finally {
      setTesting(false)
    }
  }

  function addOverride() {
    const next = availableActions[0]
    if (!next) return
    setOverrides(prev => [...prev, [next, 6]])
  }

  function updateOverride(index: number, action: string, severity: number) {
    setOverrides(prev => prev.map((row, i) => (i === index ? [action, severity] : row)))
  }

  function removeOverride(index: number) {
    setOverrides(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="syslog-modal-backdrop" onClick={onClose}>
      <div className="syslog-modal" onClick={e => e.stopPropagation()}>
        <div className="syslog-modal__header">
          <h3><SettingsIcon /> {t('pages.adminLogs.siemModalTitle')}</h3>
          <button className="syslog-modal__close" onClick={onClose} aria-label={t('common.cancel')}><XIcon /></button>
        </div>

        <div className="syslog-modal__body">
          {loading ? (
            <div className="syslog-modal__loading"><div className="spinner" /></div>
          ) : loadError ? (
            <div className="syslog-modal__error"><ExclaimIcon /> {loadError}</div>
          ) : (
            <>
              <label className="syslog-field syslog-field--toggle">
                <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
                <span>{t('pages.adminLogs.siemEnabledLabel')}</span>
              </label>

              <div className="syslog-grid">
                <label className="syslog-field">
                  <span>{t('pages.adminLogs.siemHostLabel')}</span>
                  <input type="text" value={host} onChange={e => setHost(e.target.value)} placeholder="syslog.example.com" />
                </label>
                <label className="syslog-field">
                  <span>{t('pages.adminLogs.siemPortLabel')}</span>
                  <input type="number" value={port} onChange={e => setPort(Number(e.target.value))} min={1} max={65535} />
                </label>
              </div>

              <div className="syslog-grid">
                <label className="syslog-field">
                  <span>{t('pages.adminLogs.siemProtocolLabel')}</span>
                  <select value={protocol} onChange={e => setProtocol(e.target.value as 'udp' | 'tcp')}>
                    <option value="udp">UDP</option>
                    <option value="tcp">TCP</option>
                  </select>
                </label>
                <label className="syslog-field">
                  <span>{t('pages.adminLogs.siemFormatLabel')}</span>
                  <select value={syslogFormat} onChange={e => setSyslogFormat(e.target.value as 'rfc3164' | 'rfc5424')}>
                    <option value="rfc5424">RFC 5424</option>
                    <option value="rfc3164">RFC 3164</option>
                  </select>
                </label>
              </div>

              <div className="syslog-grid">
                <label className="syslog-field">
                  <span>{t('pages.adminLogs.siemFacilityLabel')}</span>
                  <input type="number" value={facility} onChange={e => setFacility(Number(e.target.value))} min={0} max={23} />
                </label>
                <label className="syslog-field">
                  <span>{t('pages.adminLogs.siemProgramTagLabel')}</span>
                  <input type="text" value={programTag} onChange={e => setProgramTag(e.target.value)} />
                </label>
              </div>

              <label className={`syslog-field syslog-field--toggle ${protocol !== 'tcp' ? 'syslog-field--disabled' : ''}`}>
                <input type="checkbox" checked={tlsEnabled} disabled={protocol !== 'tcp'} onChange={e => setTlsEnabled(e.target.checked)} />
                <span>{t('pages.adminLogs.siemTlsLabel')}</span>
              </label>

              <div className="syslog-overrides">
                <div className="syslog-overrides__title">{t('pages.adminLogs.siemSeverityOverrides')}</div>
                {overrides.map(([action, severity], idx) => (
                  <div key={idx} className="syslog-override">
                    <select value={action} onChange={e => updateOverride(idx, e.target.value, severity)}>
                      {SYSLOG_ACTIONS.map(a => (
                        <option key={a} value={a} disabled={a !== action && usedActions.has(a)}>{a}</option>
                      ))}
                    </select>
                    <select value={severity} onChange={e => updateOverride(idx, action, Number(e.target.value))}>
                      {SEVERITY_LABELS.map((label, value) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <button type="button" className="syslog-btn-ghost" onClick={() => removeOverride(idx)}>{t('pages.adminLogs.siemRemoveOverride')}</button>
                  </div>
                ))}
                {availableActions.length > 0 && (
                  <button type="button" className="syslog-btn-ghost" onClick={addOverride}>{t('pages.adminLogs.siemAddOverride')}</button>
                )}
              </div>

              {formError && (
                <div className="syslog-modal__error"><ExclaimIcon /> {formError}</div>
              )}
              {testResult && (
                <div className={`syslog-modal__test ${testResult.success ? 'syslog-modal__test--ok' : 'syslog-modal__test--err'}`}>
                  {testResult.success ? <CheckIcon /> : <ExclaimIcon />} {testResult.message}
                </div>
              )}
            </>
          )}
        </div>

        <div className="syslog-modal__footer">
          <button className="syslog-btn-ghost" onClick={onClose} disabled={saving || testing}>{t('pages.adminLogs.siemCancel')}</button>
          <div className="syslog-modal__actions">
            <button className="syslog-btn syslog-btn--secondary" onClick={handleTest} disabled={loading || saving || testing}>
              {testing ? t('pages.adminLogs.siemTestSending') : t('pages.adminLogs.siemTest')}
            </button>
            <button className="syslog-btn syslog-btn--primary" onClick={handleSave} disabled={loading || saving || testing}>
              {saving ? t('common.saving') : t('pages.adminLogs.siemSave')}
            </button>
          </div>
        </div>
      </div>

      <style>{syslogModalCss}</style>
    </div>
  )
}

const syslogModalCss = `
.syslog-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  background: rgba(0,0,0,0.45);
  padding: 4rem 1rem 1rem;
}
.syslog-modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: min(720px, 100%);
  max-height: min(80vh, calc(100vh - 5rem));
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
}
.syslog-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border);
}
.syslog-modal__header h3 {
  margin: 0;
  font-size: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.syslog-modal__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  border-radius: 6px;
  padding: 0.35rem;
}
.syslog-modal__close:hover { color: var(--text); background: var(--bg); }
.syslog-modal__body {
  padding: 1.25rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.syslog-modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border);
}
.syslog-modal__actions { display: flex; gap: 0.5rem; }
.syslog-modal__loading, .syslog-modal__error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
}
.syslog-modal__error {
  color: #dc2626;
  background: rgba(220,38,38,.06);
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
}
.syslog-modal__test {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 0.8rem;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 600;
}
.syslog-modal__test--ok { color: #059669; background: rgba(5,150,105,.08); }
.syslog-modal__test--err { color: #dc2626; background: rgba(220,38,38,.08); }

.syslog-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}
@media (max-width: 600px) {
  .syslog-grid { grid-template-columns: 1fr; }
}
.syslog-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.78rem;
  color: var(--text);
}
.syslog-field span {
  font-weight: 700;
  color: var(--muted);
}
.syslog-field input, .syslog-field select {
  padding: 0.5rem 0.7rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  font-size: 0.82rem;
  outline: none;
}
.syslog-field input:focus, .syslog-field select:focus { border-color: var(--waf-brand); }
.syslog-field--toggle {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}
.syslog-field--toggle input { width: 16px; height: 16px; accent-color: var(--waf-brand); }
.syslog-field--disabled { opacity: 0.5; cursor: not-allowed; }

.syslog-overrides__title {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--muted);
  margin-bottom: 0.4rem;
}
.syslog-override {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}
.syslog-override select { flex: 1; }

.syslog-btn, .syslog-btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.5rem 0.85rem;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  transition: all 0.15s ease;
}
.syslog-btn:disabled, .syslog-btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
.syslog-btn--primary { background: var(--waf-brand); color: #fff; border-color: var(--waf-brand); }
.syslog-btn--secondary { color: var(--waf-brand); border-color: color-mix(in srgb, var(--waf-brand) 30%, transparent); }
.syslog-btn-ghost { background: transparent; color: var(--muted); }
.syslog-btn-ghost:hover:not(:disabled) { background: var(--bg); color: var(--text); }
`
