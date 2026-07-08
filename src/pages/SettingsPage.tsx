import { useState, useEffect, useRef } from 'react'
import { SERVER_URL_KEY, getApiBase } from '../api'
import { FRAMEWORKS } from '../controls-data'
import { LOCALES, useI18n } from '../i18n'
import {
  ALL_PILLARS, controlsForLevel, DEFAULT_REPORT_SECTIONS,
  getMaturityMeta, MATURITY_META, MATURITY_PRESETS, PILLAR_COUNTS, saveMaturityState, TOTAL_CONTROLS,
  type ReportSections, type Settings,
} from './settingsUtils'
export type { MaturityState, ReportSections, Settings } from './settingsUtils'
export { getMaturityMeta, loadMaturityState, MATURITY_META, saveMaturityState } from './settingsUtils'

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: '40px', height: '22px', borderRadius: '999px', border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        background: checked ? 'var(--waf-brand)' : '#cbd5e1',
        transition: 'background 0.2s', position: 'relative', flexShrink: 0,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: '3px', left: checked ? '21px' : '3px',
        width: '16px', height: '16px', borderRadius: '50%',
        background: '#fff', transition: 'left 0.2s',
      }} />
    </button>
  )
}

function ProgressBar({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = Math.min(100, Math.round((value / total) * 100))
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <div style={{ flex: 1, height: '6px', borderRadius: '999px', background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '999px', transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, color, minWidth: '3.5rem', textAlign: 'right' }}>
        {value} / {total}
      </span>
    </div>
  )
}

const PILLAR_ICONS: Record<string, string> = {
  security: '🔒', cost: '💰', operations: '⚙️', reliability: '🔁',
  performance: '⚡', sovereign: '🏛️', sustainability: '🌱', agentic: '🤖',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  maturityLevel: number
  settings: Settings
  onChange: (level: number, settings: Settings) => void
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage({ maturityLevel, settings, onChange }: Props) {
  const { t } = useI18n()
  const [level, setLevel] = useState(maturityLevel)
  const [s, setS] = useState<Settings>(settings)
  const [saved, setSaved] = useState(false)

  // Server URL — stored independently, takes effect immediately
  const [serverUrl, setServerUrl] = useState(() => {
    try { return localStorage.getItem(SERVER_URL_KEY) ?? '' } catch { return '' }
  })
  const [serverStatus, setServerStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [serverStatusMsg, setServerStatusMsg] = useState('')
  const checkTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  function saveServerUrl(url: string) {
    const trimmed = url.trim().replace(/\/$/, '')
    setServerUrl(trimmed)
    try { localStorage.setItem(SERVER_URL_KEY, trimmed) } catch {}
  }

  function checkConnection(url: string) {
    const base = url.trim().replace(/\/$/, '')
    if (!base) { setServerStatus('idle'); setServerStatusMsg(''); return }
    setServerStatus('checking')
    setServerStatusMsg('')
    if (checkTimeout.current) clearTimeout(checkTimeout.current)
    checkTimeout.current = setTimeout(() => {
      fetch(`${base}/health`)
        .then(async res => {
          if (res.ok) {
            const json = await res.json().catch(() => ({})) as Record<string, unknown>
            setServerStatus('ok')
            setServerStatusMsg(`Connected · ${json.status ?? 'ok'}`)
          } else {
            setServerStatus('error')
            setServerStatusMsg(`HTTP ${res.status} ${res.statusText}`)
          }
        })
        .catch(e => {
          setServerStatus('error')
          setServerStatusMsg(e instanceof Error ? e.message : 'Unreachable')
        })
    }, 400)
  }

  useEffect(() => { setLevel(maturityLevel); setS(settings) }, [maturityLevel, settings])

  function applyMaturity(l: number) {
    setLevel(l)
    setS(prev => ({ ...prev, ...MATURITY_PRESETS[l] }))
  }

  function save() {
    saveMaturityState(level, s)
    onChange(level, s)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const meta = getMaturityMeta(level)
  const controlCount = controlsForLevel(level)

  const selectStyle: React.CSSProperties = {
    background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.82rem', outline: 'none',
    width: '100%',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.72rem', fontWeight: 600,
    color: 'var(--muted)', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em',
  }

  function togglePillar(pillar: string) {
    const current = s.activePillars ?? ALL_PILLARS
    const next = current.includes(pillar)
      ? current.filter(p => p !== pillar)
      : [...current, pillar]
    setS({ ...s, activePillars: next })
  }

  // ── Feature toggle rows ────────────────────────────────────────────────────

  const intelligenceToggles: Array<[keyof Settings, string, string, string]> = [
    ['secretScanner',         'Secret Scanner',           'Detect secrets & credentials embedded in IaC code', 'security'],
    ['blastRadius',           'Blast Radius Analysis',    'Map the propagation radius of critical failures across resources', 'security'],
    ['autoFix',               'Auto-Fix Suggestions',     'Suggest safe automated remediations for common violations', 'operations'],
    ['driftDetection',        'Drift Detection',          'Compare plan against state to surface configuration drift', 'operations'],
    ['complianceGating',      'Compliance Gating',        'Block CI/CD pipeline when controls fail at configured severity', 'governance'],
    ['riskScoring',           'Risk Scoring',             'Compute weighted risk scores per resource based on control failures', 'governance'],
    ['dependencyGraph',       'Dependency Graph',         'Visualise resource dependencies and propagation paths', 'visibility'],
    ['evidenceCollection',    'Evidence Collection',      'Auto-collect compliance evidence artefacts for audit trails', 'governance'],
    ['multiCloudNormalization','Multi-Cloud Normalization','Normalise findings across AWS, Azure, GCP, and other providers', 'visibility'],
    ['carbonTracking',        'Carbon Tracking',          'Estimate CO₂ footprint and surface high-emission resource patterns', 'sustainability'],
  ]

  // Group toggles by category for display
  const toggleGroups: Record<string, typeof intelligenceToggles> = {}
  for (const tog of intelligenceToggles) {
    const cat = tog[3]
    if (!toggleGroups[cat]) toggleGroups[cat] = []
    toggleGroups[cat].push(tog)
  }

  const categoryLabels: Record<string, string> = {
    security: 'Security Intelligence',
    operations: 'Operational Automation',
    governance: 'Governance & Compliance',
    visibility: 'Visibility & Insights',
    sustainability: 'Sustainability',
  }

  // Regulatory scope data derived from FRAMEWORKS
  const allRegions = (() => {
    const seen = new Map<string, { region: string; country: string; flag: string }>()
    for (const fw of FRAMEWORKS) {
      if (!seen.has(fw.region)) seen.set(fw.region, { region: fw.region, country: fw.country, flag: fw.flag })
    }
    return [...seen.values()]
  })()

  const REGION_PRESETS = [
    { label: '🌍 International', regions: ['global'],                         desc: 'Global standards only' },
    { label: '🇪🇺 Europe',        regions: ['global', 'eu', 'gb', 'de', 'fr', 'nl', 'es'], desc: 'EU + member states' },
    { label: '🇩🇪 Germany',       regions: ['global', 'eu', 'de'],             desc: 'International + EU + Germany' },
  ]

  function toggleRegion(region: string) {
    const current = s.regulatoryRegions ?? ['global', 'eu', 'de']
    const next = current.includes(region)
      ? current.filter(r => r !== region)
      : [...current, region]
    setS({ ...s, regulatoryRegions: next.length > 0 ? next : ['global'] })
  }

  const activeRegions = s.regulatoryRegions ?? ['global', 'eu', 'de']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>

      {/* ── Maturity Level ─────────────────────────────────────────────────── */}
      <div className="card">
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>
          {t('pages.settingsPage.sectionMaturity')}
        </h2>

        {/* 5-level selector grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {MATURITY_META.map(m => {
            const active = level === m.level
            return (
              <button
                key={m.level}
                onClick={() => applyMaturity(m.level)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  gap: '0.5rem', padding: '0.9rem 1rem',
                  borderRadius: '12px', border: `2px solid ${active ? 'transparent' : 'var(--border)'}`,
                  background: active ? m.color : 'var(--bg)',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: active ? m.color : 'var(--bg)', border: `2px solid ${active ? m.color : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.72rem', fontWeight: 800, color: active ? '#ffffff' : 'var(--text)', flexShrink: 0,
                  }}>
                    L{m.level}
                  </div>
                  {active && (
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#ffffff', background: m.color, padding: '0.1rem 0.4rem', borderRadius: '999px', border: `1px solid ${m.color}` }}>
                      {t('pages.settingsPage.activeLabel')}
                    </span>
                  )}
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: active ? '#ffffff' : 'var(--text)', lineHeight: 1.2 }}>
                  {m.short}
                </div>
                <div style={{ fontSize: '0.72rem', color: active ? '#ffffff' : 'var(--muted)', lineHeight: 1.45 }}>
                  {m.desc}
                </div>
              </button>
            )
          })}
        </div>

        {/* Impact panel for selected level */}
        <div style={{
          padding: '1rem 1.25rem', borderRadius: '10px',
          background: 'var(--bg)', border: `2px solid ${meta.color}`,
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem',
        }}>
          {/* Left: tagline + control count */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('pages.settingsPage.activeAtLevel')}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text)', fontWeight: 600, lineHeight: 1.4 }}>
              {meta.tagline}
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '0.35rem' }}>{t('pages.settingsPage.controlCoverage')}</div>
              <ProgressBar value={controlCount} total={TOTAL_CONTROLS} color={meta.color} />
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
              {t('pages.settingsPage.severityThreshold')}{' '}
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                {level === 1 ? t('pages.settingsPage.criticalOnly') : level === 2 ? t('pages.settingsPage.highPlus') : level === 3 ? t('pages.settingsPage.mediumPlus') : t('pages.settingsPage.allSeverities')}
              </span>
            </div>
          </div>

          {/* Middle: pillars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('pages.settingsPage.pillarsCovered')}
            </div>
            {ALL_PILLARS.map(p => {
              const preset = MATURITY_PRESETS[level] as Settings
              const active = (preset.activePillars ?? []).includes(p)
              return (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.76rem' }}>
                  <span style={{ fontSize: '0.8rem', color: active ? meta.color : 'var(--muted)' }}>{active ? '✓' : '○'}</span>
                  <span style={{ color: active ? 'var(--text)' : 'var(--muted)', fontWeight: active ? 600 : 400 }}>
                    {PILLAR_ICONS[p]} {p.charAt(0).toUpperCase() + p.slice(1)}
                  </span>
                  {active && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--muted)', marginLeft: 'auto' }}>
                      {PILLAR_COUNTS[p]}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Right: what's new at this level */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {level === 1 ? t('pages.settingsPage.startingPoint') : t('pages.settingsPage.addedVsLevel', { level: level - 1 })}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--muted)', lineHeight: 1.55 }}>
              {meta.newAt}
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('pages.settingsPage.intelligenceActive')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {intelligenceToggles
                .filter(([key]) => (MATURITY_PRESETS[level] as Settings)[key as keyof Settings] === true)
                .map(([key, label]) => (
                  <span key={key} style={{
                    padding: '0.1rem 0.45rem', borderRadius: '999px', fontSize: '0.64rem', fontWeight: 600,
                    background: `${meta.color}20`, color: meta.color,
                    border: `1px solid ${meta.color}44`,
                  }}>{label}</span>
                ))
              }
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-column layout: Scan Config + Pillar Coverage ───────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

        {/* Scan Configuration */}
        <div className="card">
          <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1.1rem' }}>
            {t('pages.settingsPage.sectionScan')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>{t('pages.settingsPage.defaultIacLabel')}</label>
              <select value={s.defaultIac} onChange={e => setS({ ...s, defaultIac: e.target.value })} style={selectStyle}>
                <option value="terraform">Terraform</option>
                <option value="cdk">AWS CDK</option>
                <option value="pulumi">Pulumi</option>
                <option value="bicep">Bicep</option>
                <option value="cfn">CloudFormation</option>
              </select>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.25rem' }}>Used when --iac is not specified on CLI</div>
            </div>
            <div>
              <label style={labelStyle}>{t('pages.settingsPage.failOnLabel')}</label>
              <select value={s.failOn} onChange={e => setS({ ...s, failOn: e.target.value })} style={selectStyle}>
                <option value="fail">Exit non-zero on FAIL findings</option>
                <option value="skip">Exit non-zero on FAIL + SKIP findings</option>
                <option value="never">Never fail (report only)</option>
              </select>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.25rem' }}>Controls CI/CD exit code — affects pipeline gating</div>
            </div>
            <div>
              <label style={labelStyle}>{t('pages.settingsPage.minSeverityLabel')}</label>
              <select value={s.defaultSeverity} onChange={e => setS({ ...s, defaultSeverity: e.target.value })} style={selectStyle}>
                <option value="">All severities (73 controls)</option>
                <option value="critical">Critical only (~8 controls)</option>
                <option value="high">High+ (~42 controls)</option>
                <option value="medium">Medium+ (~70 controls)</option>
              </select>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.25rem' }}>Only controls at or above this severity are evaluated</div>
            </div>
          </div>
        </div>

        {/* Pillar Coverage */}
        <div className="card">
          <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1.1rem' }}>
            {t('pages.settingsPage.sectionPillars')}
          </h2>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.9rem', lineHeight: 1.55 }}>
            Choose which WAF++ control pillars are evaluated in every scan. Disabling a pillar reduces scan time and noise for teams not yet responsible for that domain.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {ALL_PILLARS.map(p => {
              const active = (s.activePillars ?? ALL_PILLARS).includes(p)
              return (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Toggle checked={active} onChange={() => togglePillar(p)} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.83rem', color: 'var(--text)' }}>
                      {PILLAR_ICONS[p]} {p.charAt(0).toUpperCase() + p.slice(1)}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginLeft: '0.5rem' }}>
                      {PILLAR_COUNTS[p]} controls
                    </span>
                  </div>
                  {!active && (
                    <span style={{ fontSize: '0.65rem', color: '#dc2626', fontWeight: 600 }}>{t('pages.settingsPage.offLabel')}</span>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--muted)', padding: '0.45rem 0.6rem', background: 'var(--bg)', borderRadius: '6px', border: '1px solid var(--border)' }}>
            Active:{' '}
            <strong style={{ color: 'var(--text)' }}>
              {(s.activePillars ?? ALL_PILLARS).reduce((n, p) => n + (PILLAR_COUNTS[p] ?? 0), 0)}
            </strong>
            {' '}/ {TOTAL_CONTROLS} controls across{' '}
            <strong style={{ color: 'var(--text)' }}>{(s.activePillars ?? ALL_PILLARS).length}</strong>
            {' '}/ {ALL_PILLARS.length} pillars
          </div>
        </div>
      </div>

      {/* ── Intelligence & Feature Toggles ─────────────────────────────────── */}
      <div className="card">
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
          {t('pages.settingsPage.sectionIntelligence')}
        </h2>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '1.1rem', lineHeight: 1.55 }}>
          Fine-tune the intelligence capabilities beyond the maturity preset. Enabling a feature here overrides the preset without changing your maturity level.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 2rem' }}>
          {Object.entries(categoryLabels).map(([cat, catLabel]) => {
            const rows = toggleGroups[cat]
            if (!rows?.length) return null
            return (
              <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem', paddingBottom: '0.35rem', borderBottom: '1px solid var(--border)' }}>
                  {catLabel}
                </div>
                {rows.map(([key, label, desc]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text)' }}>{label}</div>
                      <div style={{ fontSize: '0.71rem', color: 'var(--muted)', lineHeight: 1.45, marginTop: '0.1rem' }}>{desc}</div>
                    </div>
                    <Toggle
                      checked={s[key as keyof Settings] as boolean}
                      onChange={v => setS({ ...s, [key]: v })}
                    />
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Default Interface Language ─────────────────────────────────────── */}
      <div className="card">
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
          {t('pages.settingsPage.sectionLanguage')}
        </h2>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '1rem', lineHeight: 1.55 }}>
          Applied to all users who have not set a personal language preference.
        </div>
        <select
          value={s.defaultLanguage ?? 'en'}
          onChange={e => setS(prev => ({ ...prev, defaultLanguage: e.target.value }))}
          style={{
            background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '0.45rem 0.75rem', fontSize: '0.82rem', outline: 'none', cursor: 'pointer',
          }}
        >
          {Object.values(LOCALES).map(l => (
            <option key={l.meta!.code} value={l.meta!.code}>
              {l.meta!.flag} {l.meta!.name}
            </option>
          ))}
        </select>
      </div>

      {/* ── Regulatory Scope ───────────────────────────────────────────────── */}
      <div className="card">
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
          {t('pages.settingsPage.sectionRegulatory')}
        </h2>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '1.1rem', lineHeight: 1.55 }}>
          Set which countries' and regions' regulatory frameworks are active by default in the Compliance Matrix and reports. Users can always adjust their view per session. At least one region must remain selected.
        </div>

        {/* Presets */}
        <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.1rem', flexWrap: 'wrap' }}>
          {REGION_PRESETS.map(preset => {
            const isActive = preset.regions.length === activeRegions.length &&
              preset.regions.every(r => activeRegions.includes(r))
            return (
              <button key={preset.label}
                onClick={() => setS({ ...s, regulatoryRegions: preset.regions })}
                style={{
                  padding: '0.4rem 0.9rem', borderRadius: 8, cursor: 'pointer',
                  fontSize: '0.82rem', fontWeight: 600,
                  border: `1px solid ${isActive ? 'var(--waf-brand)' : 'var(--border)'}`,
                  background: isActive ? 'rgba(0,148,255,0.12)' : 'var(--bg)',
                  color: isActive ? 'var(--waf-brand)' : 'var(--text)',
                  transition: 'all 0.15s',
                }}>
                {preset.label}
                <span style={{ marginLeft: '0.4rem', fontSize: '0.68rem', color: isActive ? 'var(--waf-brand)' : 'var(--muted)', fontWeight: 400 }}>
                  {preset.desc}
                </span>
              </button>
            )
          })}
          <button
            onClick={() => setS({ ...s, regulatoryRegions: allRegions.map(r => r.region) })}
            style={{
              padding: '0.4rem 0.9rem', borderRadius: 8, cursor: 'pointer',
              fontSize: '0.82rem', fontWeight: 600,
              border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--muted)',
            }}>
            {t('pages.settingsPage.allRegionsBtn')}
          </button>
        </div>

        {/* Individual region toggles */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          {allRegions.map(({ region, country, flag }) => {
            const active = activeRegions.includes(region)
            return (
              <button key={region}
                onClick={() => toggleRegion(region)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.3rem 0.75rem', borderRadius: 999, cursor: 'pointer',
                  fontSize: '0.78rem', fontWeight: 600,
                  border: `1px solid ${active ? 'var(--waf-brand)' : 'var(--border)'}`,
                  background: active ? 'rgba(0,148,255,0.12)' : 'var(--bg)',
                  color: active ? 'var(--waf-brand)' : 'var(--muted)',
                  transition: 'all 0.15s',
                }}>
                <span style={{ fontSize: '1rem', lineHeight: 1 }}>{flag}</span>
                {country}
                {active && <span style={{ fontSize: '0.65rem', color: 'var(--waf-brand)' }}>✓</span>}
              </button>
            )
          })}
        </div>

        <div style={{ marginTop: '0.9rem', fontSize: '0.72rem', color: 'var(--muted)', padding: '0.4rem 0.65rem', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
          Active: <strong style={{ color: 'var(--text)' }}>{activeRegions.length}</strong> region{activeRegions.length !== 1 ? 's' : ''} ·{' '}
          <strong style={{ color: 'var(--text)' }}>
            {FRAMEWORKS.filter(fw => activeRegions.includes(fw.region)).length}
          </strong> frameworks in scope
        </div>
      </div>

      {/* ── PDF Report Sections ────────────────────────────────────────────── */}
      <div className="card">
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
          {t('pages.settingsPage.sectionPdf')}
        </h2>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '1.1rem', lineHeight: 1.55 }}>
          Choose which sections are included when you export a run as PDF. Defaults follow your maturity level preset.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 2rem' }}>
          {([
            ['executiveSummary', 'Executive Summary',    'Score, KPIs, run metadata — always recommended',         1],
            ['pillarBreakdown',  'Pillar Breakdown',     'Scores per WAF++ pillar',                                2],
            ['criticalFindings', 'Critical & High Findings', 'Table of critical and high severity failures',       2],
            ['complianceMatrix', 'Compliance Matrix',    'Regulatory readiness and category pass rates',           3],
            ['architecturalDebt','Architectural Debt',   'Failure heatmap by pillar and severity',                 3],
            ['allFindings',      'All Findings',         'Complete findings table across all severities',          3],
            ['remediationPlan',  'Remediation Plan',     'Quick wins and auto-fix guidance',                       4],
            ['cloudFootprint',   'Cloud Footprint',      'Detected regions and cloud providers',                   4],
            ['planChanges',      'Plan Changes',         'IaC plan adds, updates, destroys, replacements',   5],
          ] as [keyof ReportSections, string, string, number][]).map(([key, label, desc, minLevel]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text)' }}>{label}</span>
                  <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.05rem 0.35rem', borderRadius: '999px', background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                    L{minLevel}+
                  </span>
                </div>
                <div style={{ fontSize: '0.71rem', color: 'var(--muted)', lineHeight: 1.45, marginTop: '0.1rem' }}>{desc}</div>
              </div>
              <Toggle
                checked={s.reportSections?.[key] ?? false}
                onChange={v => setS({ ...s, reportSections: { ...(s.reportSections ?? DEFAULT_REPORT_SECTIONS), [key]: v } })}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Connection & Real Engine ───────────────────────────────────────── */}
      <div className="card">
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>
          {t('pages.settingsPage.sectionConnection')}
        </h2>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '1.25rem', lineHeight: 1.55 }}>
          Configure the backend server URL and enable the real WAF++ engine in the Architect Sandbox.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>

          {/* Left: server URL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', paddingBottom: '0.35rem', borderBottom: '1px solid var(--border)' }}>
              Backend Server URL
            </div>

            <div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  value={serverUrl}
                  onChange={e => { setServerUrl(e.target.value); setServerStatus('idle') }}
                  onBlur={e => { saveServerUrl(e.target.value); checkConnection(e.target.value) }}
                  placeholder="http://localhost:8000"
                  style={{
                    flex: 1, background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)',
                    borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.82rem', outline: 'none',
                  }}
                />
                <button
                  onClick={() => { saveServerUrl(serverUrl); checkConnection(serverUrl) }}
                  style={{
                    background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
                    borderRadius: '8px', padding: '0.4rem 0.75rem', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  {t('pages.settingsPage.testBtn')}
                </button>
              </div>
              <div style={{ marginTop: '0.3rem', fontSize: '0.71rem', color: 'var(--muted)' }}>
                Enter the base URL only — no <code style={{ fontSize: '0.68rem' }}>/runs</code> suffix (e.g. <code style={{ fontSize: '0.68rem' }}>http://localhost:8000</code> when running locally). Leave empty to use the same origin as the dashboard. Takes effect immediately — no reload needed.
              </div>
            </div>

            {serverStatus !== 'idle' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.45rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem',
                background: serverStatus === 'ok' ? 'rgba(34,197,94,.08)' : serverStatus === 'checking' ? 'rgba(0,148,255,.08)' : 'rgba(218,44,56,.08)',
                border: `1px solid ${serverStatus === 'ok' ? 'rgba(34,197,94,.3)' : serverStatus === 'checking' ? 'rgba(0,148,255,.3)' : 'rgba(218,44,56,.3)'}`,
                color: serverStatus === 'ok' ? '#15803d' : serverStatus === 'checking' ? '#0369a1' : '#DA2C38',
              }}>
                <span style={{ fontSize: '0.6rem' }}>
                  {serverStatus === 'ok' ? '●' : serverStatus === 'checking' ? '○' : '✕'}
                </span>
                {serverStatus === 'checking' ? t('pages.settingsPage.checking') : serverStatusMsg}
              </div>
            )}

            <div style={{ fontSize: '0.71rem', color: 'var(--muted)', fontFamily: 'monospace' }}>
              Active:{' '}
              <strong style={{ color: 'var(--text)' }}>
                {serverUrl.trim() || '(same origin)'}
              </strong>
            </div>

            <div style={{ fontSize: '0.71rem', color: 'var(--muted)', lineHeight: 1.6, marginTop: '0.25rem' }}>
              To set a persistent default without rebuilding, add{' '}
              <code style={{ color: 'var(--waf-brand)', fontSize: '0.68rem' }}>VITE_API_URL=http://localhost:8000</code>{' '}
              to <code style={{ color: 'var(--text)', fontSize: '0.68rem' }}>.env.local</code>{' '}
              (copy from <code style={{ color: 'var(--text)', fontSize: '0.68rem' }}>.env.example</code>).
              The runtime value above takes precedence.
            </div>
          </div>

          {/* Right: real engine guide */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', paddingBottom: '0.35rem', borderBottom: '1px solid var(--border)' }}>
              Architect Sandbox — Real Engine
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.6 }}>
              The Sandbox can run the full WAF++ engine server-side instead of the browser-side regex mock.
              The real engine evaluates all 70+ controls and returns exact check-level findings.
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text)' }}>Requirements:</strong>
              <ul style={{ margin: '0.35rem 0 0 1rem', padding: 0 }}>
                <li><code style={{ color: 'var(--waf-brand)', fontSize: '0.72rem' }}>wafpass-core</code> installed on the server</li>
                <li><code style={{ color: 'var(--waf-brand)', fontSize: '0.72rem' }}>WAFPASS_CONTROLS_DIR</code> pointing to control YAML files</li>
              </ul>
            </div>

            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text)', display: 'block', marginBottom: '0.2rem' }}>Docker Compose (bundled controls)</strong>
              Controls are copied into the image automatically — no extra config needed:
            </div>
            <pre style={{
              background: '#0f172a', color: '#e2e8f0', borderRadius: '6px',
              padding: '0.6rem 0.75rem', fontSize: '0.72rem', lineHeight: 1.6, margin: 0, overflowX: 'auto',
            }}>
              {`docker compose up --build`}
            </pre>

            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text)', display: 'block', marginBottom: '0.2rem' }}>Custom controls or bare server</strong>
              Override with your own controls directory:
            </div>
            <pre style={{
              background: '#0f172a', color: '#e2e8f0', borderRadius: '6px',
              padding: '0.6rem 0.75rem', fontSize: '0.72rem', lineHeight: 1.6, margin: 0, overflowX: 'auto',
            }}>
              {`# In docker-compose.yml — wafpass-server environment:\nWAFPASS_CONTROLS_DIR: /app/controls\n\n# Or mount a local directory:\nvolumes:\n  - ./my-controls:/app/controls:ro`}
            </pre>

            <div style={{ fontSize: '0.71rem', color: 'var(--muted)' }}>
              Status probe: <code style={{ color: 'var(--text)', fontSize: '0.71rem' }}>{(serverUrl.trim() || '') + '/sandbox/status'}</code>
            </div>
          </div>
        </div>
      </div>

      {/* ── Version Information ──────────────────────────────────────────────── */}
      <div className="card">
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
          {t('pages.settingsPage.sectionVersion') || 'Version Information'}
        </h2>
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '1rem', lineHeight: 1.55 }}>
          {t('pages.settingsPage.debugInfo') || 'Server and engine versions for debugging'}
        </div>
        <VersionInfoBox t={t} />
      </div>

      {/* ── Save ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1rem' }}>
        <button
          onClick={save}
          style={{
            background: 'var(--waf-brand)', color: '#fff', border: 'none', borderRadius: '8px',
            padding: '0.6rem 1.75rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
          }}
        >
          {t('pages.settingsPage.saveBtn')}
        </button>
        <button
          onClick={() => applyMaturity(level)}
          style={{
            background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '0.6rem 1.25rem', fontSize: '0.82rem', fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('pages.settingsPage.resetBtn', { level })}
        </button>
        {saved && <span style={{ fontSize: '0.8rem', color: '#22c55e', fontWeight: 600 }}>{t('pages.settingsPage.savedMsg')}</span>}

      </div>

    </div>
  )
}

// ─── Version Info Component ───────────────────────────────────────────────────

interface VersionInfo {
  server_version: string
  core_version: string
  wafpass_server: string
  wafpass_core: string
}

interface VersionInfoBoxProps {
  t: (key: string) => string
}

function VersionInfoBox({ t }: VersionInfoBoxProps) {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchVersionInfo = async () => {
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
    fetchVersionInfo()
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem', color: 'var(--muted)' }}>
        <div className="spinner" />
        <span style={{ fontSize: '0.78rem' }}>Loading version info...</span>
      </div>
    )
  }

  if (error || !versionInfo) {
    return (
      <div style={{
        padding: '1rem', borderRadius: '8px', fontSize: '0.78rem',
        background: 'rgba(218,44,56,0.08)', border: '1px solid rgba(218,44,56,0.3)',
        color: '#DA2C38',
      }}>
        <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginRight: '0.35rem' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.008m-3 6h3a2 2 0 002-2v-6a2 2 0 00-2-2h-3a2 2 0 00-2 2v6a2 2 0 002 2z" />
          </svg>
          {t('pages.settingsPage.versionInfo') || 'Version Information'}
        </div>
        <p style={{ margin: 0 }}>{error || 'Unable to fetch version information'}</p>
      </div>
    )
  }

  const serverUrl = (getApiBase() || window.location.origin).replace(/\/$/, '')
  const dashboardUrl = window.location.origin.replace(/\/$/, '')
  const dashboardVersion = import.meta.env.VITE_APP_VERSION || '1.1.0'

  return (
    <div style={{
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '1rem',
      fontSize: '0.75rem',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
        {/* wafpass-server */}
        <div style={{
          padding: '0.75rem', borderRadius: '8px',
          background: 'var(--surface)', border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '0.25rem' }}>
            wafpass-server
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace' }}>
            {versionInfo.wafpass_server}
          </div>
          <div style={{ marginTop: '0.4rem' }}>
            <a href={`${serverUrl}/health`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--waf-brand)', textDecoration: 'none', fontSize: '0.7rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v12a2.25 2.25 0 002.25 2.25h10.5A2.25 2.25 0 0021 18.25v-10.5a2.25 2.25 0 00-2.25-2.25H15" /></svg>
              Health Check
            </a>
          </div>
        </div>

        {/* wafpass-core - shows all versions from /version endpoint */}
        <div style={{
          padding: '0.75rem', borderRadius: '8px',
          background: 'var(--surface)', border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '0.25rem' }}>
            wafpass-core
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace', marginBottom: '0.5rem' }}>
            {versionInfo.wafpass_core}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 0.75rem', fontSize: '0.72rem' }}>
            <span style={{ color: 'var(--muted)' }}>server_version:</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{versionInfo.server_version}</span>
            <span style={{ color: 'var(--muted)' }}>core_version:</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{versionInfo.core_version}</span>
          </div>
          <div style={{ marginTop: '0.4rem' }}>
            <a href={`${serverUrl}/version`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--waf-brand)', textDecoration: 'none', fontSize: '0.7rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v12a2.25 2.25 0 002.25 2.25h10.5A2.25 2.25 0 0021 18.25v-10.5a2.25 2.25 0 00-2.25-2.25H15" /></svg>
              API Version
            </a>
          </div>
        </div>

        {/* Dashboard UI */}
        <div style={{
          padding: '0.75rem', borderRadius: '8px',
          background: 'var(--surface)', border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '0.25rem' }}>
            Dashboard UI
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace' }}>
            {dashboardVersion}
          </div>
          <div style={{ marginTop: '0.4rem' }}>
            <a href={`${dashboardUrl}/health`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--waf-brand)', textDecoration: 'none', fontSize: '0.7rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v12a2.25 2.25 0 002.25 2.25h10.5A2.25 2.25 0 0021 18.25v-10.5a2.25 2.25 0 00-2.25-2.25H15" /></svg>
              Dashboard Health
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
