import { useState, useEffect, useRef } from 'react'
import {
  SERVER_URL_KEY, VALIDATION_URL_KEY, getValidationGatewayBase,
} from '../api'
import { externalFetch } from '../lib/http'
import { FRAMEWORKS } from '../controls-data'
import { LOCALES, useI18n } from '../i18n'
import Toggle from '../components/Toggle'
import { Input, PageHeader, Select } from '../ui'
import {
  ALL_PILLARS, controlsForLevel, DEFAULT_REPORT_SECTIONS,
  getMaturityMeta, MATURITY_META, MATURITY_PRESETS, PILLAR_COUNTS, saveMaturityState, SEV_COUNTS, TOTAL_CONTROLS,
  type ReportSections, type Settings,
} from './settingsUtils'
import { useControlCounts } from '../useControlCounts'
export type { MaturityState, ReportSections, Settings } from './settingsUtils'

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: subtitle ? '1.1rem' : '0.9rem' }}>
      <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title}
      </h2>
      {subtitle && (
        <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.35rem', lineHeight: 1.55 }}>
          {subtitle}
        </div>
      )}
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
  // Live counts from the deployed pack; static tables are the offline fallback.
  const liveCounts = useControlCounts()
  const pillarCounts = liveCounts?.pillarCounts ?? PILLAR_COUNTS
  const totalControls = liveCounts?.total ?? TOTAL_CONTROLS
  const severityCounts: Record<string, number> = liveCounts?.severityCounts ?? SEV_COUNTS
  const pillarCount = (pillar: string) => pillarCounts[pillar] ?? 0
  const sevCount = (severity: string) => severityCounts[severity] ?? 0
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

  // Validation gateway URL — stored independently, takes effect immediately
  const [validationUrl, setValidationUrl] = useState(() => {
    try { return localStorage.getItem(VALIDATION_URL_KEY) ?? '' } catch { return '' }
  })
  const [validationStatus, setValidationStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [validationStatusMsg, setValidationStatusMsg] = useState('')
  const validationCheckTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      externalFetch(`${base}/health`)
        .then(async res => {
          if (res.ok) {
            const json = await res.json().catch(() => ({})) as Record<string, unknown>
            setServerStatus('ok')
            setServerStatusMsg(t('pages.phase3.restB.settings.connected', { status: String(json.status ?? 'ok') }))
          } else {
            setServerStatus('error')
            setServerStatusMsg(`HTTP ${res.status} ${res.statusText}`)
          }
        })
        .catch(e => {
          setServerStatus('error')
          setServerStatusMsg(e instanceof Error ? e.message : t('pages.phase3.restB.settings.unreachable'))
        })
    }, 400)
  }

  function saveValidationUrl(url: string) {
    const trimmed = url.trim().replace(/\/$/, '')
    setValidationUrl(trimmed)
    try { localStorage.setItem(VALIDATION_URL_KEY, trimmed) } catch {}
  }

  function checkValidationConnection(url: string) {
    const base = url.trim().replace(/\/$/, '')
    if (!base) { setValidationStatus('idle'); setValidationStatusMsg(''); return }
    setValidationStatus('checking')
    setValidationStatusMsg('')
    if (validationCheckTimeout.current) clearTimeout(validationCheckTimeout.current)
    validationCheckTimeout.current = setTimeout(() => {
      externalFetch(`${base}/api/v1/validations/root.crt`)
        .then(async res => {
          if (res.ok) {
            const text = await res.text()
            const hasCert = text.includes('BEGIN CERTIFICATE')
            setValidationStatus(hasCert ? 'ok' : 'error')
            setValidationStatusMsg(hasCert ? t('pages.phase3.restB.settings.gatewayReachable') : t('pages.phase3.restB.settings.unexpectedResponse'))
          } else {
            setValidationStatus('error')
            setValidationStatusMsg(`HTTP ${res.status} ${res.statusText}`)
          }
        })
        .catch(e => {
          setValidationStatus('error')
          setValidationStatusMsg(e instanceof Error ? e.message : t('pages.phase3.restB.settings.unreachable'))
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
  const controlCount = controlsForLevel(level, liveCounts ?? undefined)

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

  // ── Action buttons ─────────────────────────────────────────────────────────

  const saveButton = (
    <button
      key="save"
      onClick={save}
      style={{
        background: 'var(--waf-brand-btn)', color: '#fff', border: 'none', borderRadius: '8px',
        padding: '0.6rem 1.5rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {t('pages.settingsPage.saveBtn')}
    </button>
  )

  const resetButton = (
    <button
      key="reset"
      onClick={() => applyMaturity(level)}
      style={{
        background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)',
        borderRadius: '8px', padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: 600,
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      {t('pages.settingsPage.resetBtn', { level })}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <PageHeader
        title={t('pages.settingsPage.pageTitle')}
        description={t('pages.settingsPage.pageSubtitle')}
        actions={
          <>
            {resetButton}
            {saveButton}
            {saved && <span style={{ fontSize: '0.8rem', color: 'var(--pass-ink)', fontWeight: 600 }}>{t('pages.settingsPage.savedMsg')}</span>}
          </>
        }
      />

      {/* ── Maturity Level ─────────────────────────────────────────────────── */}
      <section className="card">
        <SectionHeader title={t('pages.settingsPage.sectionMaturity')} />

        {/* 5-level selector grid — full width */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          {MATURITY_META.map(m => {
            const active = level === m.level
            return (
              <button
                key={m.level}
                onClick={() => applyMaturity(m.level)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  gap: '0.5rem', padding: '1rem 1.1rem',
                  borderRadius: '12px', border: `2px solid ${active ? 'transparent' : 'var(--border)'}`,
                  background: active ? m.color : 'var(--bg)',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  transition: 'background-color 0.15s, border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '50%',
                    background: active ? m.color : 'var(--bg)', border: `2px solid ${active ? '#ffffff' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.72rem', fontWeight: 800, color: active ? '#ffffff' : 'var(--text)', flexShrink: 0,
                  }}>
                    L{m.level}
                  </div>
                  {active && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ffffff', background: 'rgba(255,255,255,0.25)', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                      {t('pages.settingsPage.activeLabel')}
                    </span>
                  )}
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: active ? '#ffffff' : 'var(--text)', lineHeight: 1.2, marginTop: '0.15rem' }}>
                  {m.short}
                </div>
                <div style={{ fontSize: '0.72rem', color: active ? 'rgba(255,255,255,0.85)' : 'var(--muted)', lineHeight: 1.45 }}>
                  {m.desc}
                </div>
              </button>
            )
          })}
        </div>

        {/* Impact panel for selected level */}
        <div style={{
          padding: '1.25rem 1.5rem', borderRadius: '12px',
          background: 'var(--bg)', border: `2px solid ${meta.color}`,
          display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1.75rem',
        }}>
          {/* Left: tagline + control count */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('pages.settingsPage.activeAtLevel')}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text)', fontWeight: 600, lineHeight: 1.4 }}>
              {meta.tagline}
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '0.35rem' }}>{t('pages.settingsPage.controlCoverage')}</div>
              <ProgressBar value={controlCount} total={totalControls} color={meta.color} />
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>
              {t('pages.settingsPage.severityThreshold')}{' '}
              <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                {level === 1 ? t('pages.settingsPage.criticalOnly') : level === 2 ? t('pages.settingsPage.highPlus') : level === 3 ? t('pages.settingsPage.mediumPlus') : t('pages.settingsPage.allSeverities')}
              </span>
            </div>
          </div>

          {/* Middle: pillars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('pages.settingsPage.pillarsCovered')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem 0.75rem' }}>
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
                      <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginLeft: 'auto' }}>
                        {pillarCount(p)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right: what's new at this level + active intelligence */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {level === 1 ? t('pages.settingsPage.startingPoint') : t('pages.settingsPage.addedVsLevel', { level: level - 1 })}
            </div>
            <div style={{ fontSize: '0.77rem', color: 'var(--muted)', lineHeight: 1.55 }}>
              {meta.newAt}
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('pages.settingsPage.intelligenceActive')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {intelligenceToggles
                .filter(([key]) => (MATURITY_PRESETS[level] as Settings)[key as keyof Settings] === true)
                .map(([key]) => (
                  <span key={key} style={{
                    padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600,
                    background: `${meta.color}20`, color: meta.color,
                    border: `1px solid ${meta.color}44`,
                  }}>{t(`pages.phase3.restB.settings.toggle.${key}.label`)}</span>
                ))
              }
            </div>
          </div>
        </div>
      </section>

      {/* ── Three-column layout: Scan Config + Pillar Coverage + Language ───── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1.5rem' }}>

        {/* Scan Configuration */}
        <div className="card">
          <SectionHeader title={t('pages.settingsPage.sectionScan')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Select
              label={t('pages.settingsPage.defaultIacLabel')}
              hint={t('pages.settingsPage.defaultIacDesc')}
              value={s.defaultIac}
              onChange={e => setS({ ...s, defaultIac: e.target.value })}
            >
              <option value="terraform">Terraform</option>
              <option value="cdk">AWS CDK</option>
              <option value="pulumi">Pulumi</option>
              <option value="bicep">Bicep</option>
              <option value="cfn">CloudFormation</option>
            </Select>
            <Select
              label={t('pages.settingsPage.failOnLabel')}
              hint={t('pages.settingsPage.failOnDesc')}
              value={s.failOn}
              onChange={e => setS({ ...s, failOn: e.target.value })}
            >
              <option value="fail">{t('pages.phase3.restB.settings.failOnFail')}</option>
              <option value="skip">{t('pages.phase3.restB.settings.failOnSkip')}</option>
              <option value="never">{t('pages.phase3.restB.settings.failOnNever')}</option>
            </Select>
            <Select
              label={t('pages.settingsPage.minSeverityLabel')}
              hint={t('pages.settingsPage.minSeverityDesc')}
              value={s.defaultSeverity}
              onChange={e => setS({ ...s, defaultSeverity: e.target.value })}
            >
              <option value="">{t('pages.phase3.restB.settings.severityAll', { count: totalControls })}</option>
              <option value="critical">{t('pages.phase3.restB.settings.severityCritical', { count: sevCount('critical') })}</option>
              <option value="high">{t('pages.phase3.restB.settings.severityHigh', { count: sevCount('critical') + sevCount('high') })}</option>
              <option value="medium">{t('pages.phase3.restB.settings.severityMedium', { count: sevCount('critical') + sevCount('high') + sevCount('medium') })}</option>
            </Select>
          </div>
        </div>

        {/* Pillar Coverage */}
        <div className="card">
          <SectionHeader
            title={t('pages.settingsPage.sectionPillars')}
            subtitle={t('pages.settingsPage.pillarCoverageDesc')}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {ALL_PILLARS.map(p => {
              const active = (s.activePillars ?? ALL_PILLARS).includes(p)
              return (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Toggle checked={active} onChange={() => togglePillar(p)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>
                      {PILLAR_ICONS[p]} {p.charAt(0).toUpperCase() + p.slice(1)}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginLeft: '0.5rem' }}>
                      {t('pages.phase3.restB.settings.controlsCount', { count: pillarCount(p) })}
                    </span>
                  </div>
                  {!active && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--fail-ink)', fontWeight: 600 }}>{t('pages.settingsPage.offLabel')}</span>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: '0.85rem', fontSize: '0.72rem', color: 'var(--muted)', padding: '0.5rem 0.7rem', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            {t('pages.phase3.restB.settings.activeLabel')}{' '}
            <strong style={{ color: 'var(--text)' }}>
              {(s.activePillars ?? ALL_PILLARS).reduce((n, p) => n + pillarCount(p), 0)}
            </strong>
            {' '}/ {totalControls} {t('pages.phase3.restB.settings.controlsAcross')}{' '}
            <strong style={{ color: 'var(--text)' }}>{(s.activePillars ?? ALL_PILLARS).length}</strong>
            {' '}/ {ALL_PILLARS.length} {t('pages.phase3.restB.settings.pillarsLabel')}
          </div>
        </div>

        {/* Default Interface Language */}
        <div className="card">
          <SectionHeader title={t('pages.settingsPage.sectionLanguage')} />
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '1rem', lineHeight: 1.55 }}>
            {t('pages.phase3.restB.settings.languageDesc')}
          </div>
          <select
            value={s.defaultLanguage ?? 'en'}
            onChange={e => setS(prev => ({ ...prev, defaultLanguage: e.target.value }))}
            style={{
              background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '0.45rem 0.75rem', fontSize: '0.85rem', outline: 'none', cursor: 'pointer',
              width: '100%',
            }}
          >
            {Object.values(LOCALES).map(l => (
              <option key={l.meta!.code} value={l.meta!.code}>
                {l.meta!.flag} {l.meta!.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Intelligence & Features ────────────────────────────────────────── */}
      <section className="card">
        <SectionHeader
          title={t('pages.settingsPage.sectionIntelligence')}
          subtitle={t('pages.settingsPage.intelligenceDesc')}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem 2rem' }}>
          {Object.entries(categoryLabels).map(([cat]) => {
            const rows = toggleGroups[cat]
            if (!rows?.length) return null
            return (
              <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                <div style={{
                  fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase',
                  letterSpacing: '0.06em', marginBottom: '0.5rem', paddingBottom: '0.35rem', borderBottom: '1px solid var(--border)',
                }}>
                  {t(`pages.phase3.restB.settings.category.${cat}`)}
                </div>
                {rows.map(([key]) => (
                  <div key={key} style={{
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                    gap: '0.75rem', padding: '0.55rem 0', borderBottom: '1px solid var(--border)',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>{t(`pages.phase3.restB.settings.toggle.${key}.label`)}</div>
                      <div style={{ fontSize: '0.71rem', color: 'var(--muted)', lineHeight: 1.45, marginTop: '0.1rem' }}>{t(`pages.phase3.restB.settings.toggle.${key}.desc`)}</div>
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
      </section>

      {/* ── Two-column layout: Regulatory Scope + PDF Report Sections ────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1.5rem' }}>

        {/* Regulatory Scope */}
        <div className="card">
          <SectionHeader
            title={t('pages.settingsPage.sectionRegulatory')}
            subtitle={t('pages.settingsPage.regulatoryScopeDesc')}
          />

          {/* Presets */}
          <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.1rem', flexWrap: 'wrap' }}>
            {REGION_PRESETS.map((preset, presetIndex) => {
              const isActive = preset.regions.length === activeRegions.length &&
                preset.regions.every(r => activeRegions.includes(r))
              return (
                <button key={preset.label}
                  onClick={() => setS({ ...s, regulatoryRegions: preset.regions })}
                  style={{
                    padding: '0.4rem 0.9rem', borderRadius: 8, cursor: 'pointer',
                    fontSize: '0.85rem', fontWeight: 600,
                    border: `1px solid ${isActive ? 'var(--waf-brand)' : 'var(--border)'}`,
                    background: isActive ? 'color-mix(in srgb, var(--waf-brand) 12%, transparent)' : 'var(--bg)',
                    color: isActive ? 'var(--waf-brand)' : 'var(--text)',
                    transition: 'border-color 0.15s, background-color 0.15s, color 0.15s',
                  }}>
                  {t(`pages.phase3.restB.settings.regionPreset.${presetIndex}.label`)}
                  <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: isActive ? 'var(--waf-brand)' : 'var(--muted)', fontWeight: 400 }}>
                    {t(`pages.phase3.restB.settings.regionPreset.${presetIndex}.desc`)}
                  </span>
                </button>
              )
            })}
            <button
              onClick={() => setS({ ...s, regulatoryRegions: allRegions.map(r => r.region) })}
              style={{
                padding: '0.4rem 0.9rem', borderRadius: 8, cursor: 'pointer',
                fontSize: '0.85rem', fontWeight: 600,
                border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--muted)',
              }}>
              {t('pages.settingsPage.allRegionsBtn')}
            </button>
          </div>

          {/* Individual region toggles */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {allRegions.map(({ region, country, flag }) => {
              const active = activeRegions.includes(region)
              return (
                <button key={region}
                  onClick={() => toggleRegion(region)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                    padding: '0.35rem 0.8rem', borderRadius: 999, cursor: 'pointer',
                    fontSize: '0.78rem', fontWeight: 600,
                    border: `1px solid ${active ? 'var(--waf-brand)' : 'var(--border)'}`,
                    background: active ? 'color-mix(in srgb, var(--waf-brand) 12%, transparent)' : 'var(--bg)',
                    color: active ? 'var(--waf-brand)' : 'var(--muted)',
                    transition: 'border-color 0.15s, background-color 0.15s, color 0.15s',
                  }}>
                  <span style={{ fontSize: '1rem', lineHeight: 1 }}>{flag}</span>
                  {country}
                  {active && <span style={{ fontSize: '0.7rem', color: 'var(--waf-brand)' }}>✓</span>}
                </button>
              )
            })}
          </div>

          <div style={{ marginTop: '0.9rem', fontSize: '0.72rem', color: 'var(--muted)', padding: '0.45rem 0.65rem', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
            {t('pages.phase3.restB.settings.activeLabel')} <strong style={{ color: 'var(--text)' }}>{activeRegions.length}</strong> {activeRegions.length !== 1 ? t('pages.phase3.restB.settings.regionMany') : t('pages.phase3.restB.settings.regionOne')} ·{' '}
            <strong style={{ color: 'var(--text)' }}>
              {FRAMEWORKS.filter(fw => activeRegions.includes(fw.region)).length}
            </strong> {t('pages.phase3.restB.settings.frameworksInScope')}
          </div>
        </div>

        {/* PDF Report Sections */}
        <div className="card">
          <SectionHeader
            title={t('pages.settingsPage.sectionPdf')}
            subtitle={t('pages.settingsPage.pdfSectionsDesc')}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0 0' }}>
            {([
              ['executiveSummary', 'Executive Summary',    'Score, KPIs, run metadata — always recommended',         1],
              ['pillarBreakdown',  'Pillar Breakdown',     'Scores per Wombat pillar',                                2],
              ['criticalFindings', 'Critical & High Findings', 'Table of critical and high severity failures',       2],
              ['complianceMatrix', 'Compliance Matrix',    'Regulatory readiness and category pass rates',           3],
              ['architecturalDebt','Architectural Debt',   'Failure heatmap by pillar and severity',                 3],
              ['allFindings',      'All Findings',         'Complete findings table across all severities',          3],
              ['remediationPlan',  'Remediation Plan',     'Quick wins and auto-fix guidance',                       4],
              ['cloudFootprint',   'Cloud Footprint',      'Detected regions and cloud providers',                   4],
              ['planChanges',      'Plan Changes',         'IaC plan adds, updates, destroys, replacements',   5],
            ] as [keyof ReportSections, string, string, number][]).map(([key, , , minLevel]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', padding: '0.55rem 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>{t(`pages.phase3.restB.settings.pdf.${key}.label`)}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.05rem 0.35rem', borderRadius: '999px', background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                      L{minLevel}+
                    </span>
                  </div>
                  <div style={{ fontSize: '0.71rem', color: 'var(--muted)', lineHeight: 1.45, marginTop: '0.1rem' }}>{t(`pages.phase3.restB.settings.pdf.${key}.desc`)}</div>
                </div>
                <Toggle
                  checked={s.reportSections?.[key] ?? false}
                  onChange={v => setS({ ...s, reportSections: { ...(s.reportSections ?? DEFAULT_REPORT_SECTIONS), [key]: v } })}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Connection & Real Engine ───────────────────────────────────────── */}
      <section className="card">
        <SectionHeader
          title={t('pages.settingsPage.sectionConnection')}
          subtitle={t('pages.settingsPage.connectionDesc')}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '2rem', alignItems: 'start' }}>

          {/* Left: server URL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', paddingBottom: '0.35rem', borderBottom: '1px solid var(--border)' }}>
              {t('pages.settingsPage.backendServerUrl')}
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
                    borderRadius: '8px', padding: '0.45rem 0.7rem', fontSize: '0.85rem', outline: 'none',
                  }}
                />
                <button
                  onClick={() => { saveServerUrl(serverUrl); checkConnection(serverUrl) }}
                  style={{
                    background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
                    borderRadius: '8px', padding: '0.45rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  {t('pages.settingsPage.testBtn')}
                </button>
              </div>
              <div style={{ marginTop: '0.35rem', fontSize: '0.71rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                {t('pages.phase3.restB.settings.enterBaseUrl')} <code style={{ fontSize: '0.7rem' }}>/api/v1/runs</code> {t('pages.phase3.restB.settings.suffixHint')} <code style={{ fontSize: '0.7rem' }}>http://localhost:8000</code> {t('pages.phase3.restB.settings.runningLocallyHint')}
              </div>
            </div>

            {serverStatus !== 'idle' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.85rem', borderRadius: '8px', fontSize: '0.78rem',
                background: serverStatus === 'ok' ? 'color-mix(in srgb, var(--pass) 8%, transparent)' : serverStatus === 'checking' ? 'color-mix(in srgb, var(--waf-brand) 8%, transparent)' : 'color-mix(in srgb, var(--fail) 8%, transparent)',
                border: `1px solid ${serverStatus === 'ok' ? 'color-mix(in srgb, var(--pass) 30%, transparent)' : serverStatus === 'checking' ? 'color-mix(in srgb, var(--waf-brand) 30%, transparent)' : 'color-mix(in srgb, var(--fail) 30%, transparent)'}`,
                color: serverStatus === 'ok' ? 'var(--pass-ink)' : serverStatus === 'checking' ? 'var(--waf-brand-ink)' : 'var(--fail-ink)',
              }}>
                <span style={{ fontSize: '0.7rem' }}>
                  {serverStatus === 'ok' ? '●' : serverStatus === 'checking' ? '○' : '✕'}
                </span>
                {serverStatus === 'checking' ? t('pages.settingsPage.checking') : serverStatusMsg}
              </div>
            )}

            <div style={{ fontSize: '0.71rem', color: 'var(--muted)', fontFamily: 'monospace' }}>
              {t('pages.phase3.restB.settings.activeLabel')} <strong style={{ color: 'var(--text)' }}>{serverUrl.trim() || t('pages.phase3.restB.settings.sameOrigin')}</strong>
            </div>

            <div style={{ fontSize: '0.71rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              {t('pages.phase3.restB.settings.persistentDefaultPrefix')}{' '}
              <code style={{ color: 'var(--waf-brand)', fontSize: '0.7rem' }}>VITE_API_URL=http://localhost:8000</code>{' '}
              {t('pages.phase3.restB.settings.persistentDefaultTo')} <code style={{ color: 'var(--text)', fontSize: '0.7rem' }}>.env.local</code>{' '}
              {t('pages.phase3.restB.settings.persistentDefaultCopyFrom')} <code style={{ color: 'var(--text)', fontSize: '0.7rem' }}>.env.example</code>{t('pages.phase3.restB.settings.persistentDefaultSuffix')}
            </div>
          </div>

          {/* Middle: validation gateway URL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', paddingBottom: '0.35rem', borderBottom: '1px solid var(--border)' }}>
              {t('pages.phase3.restB.settings.validationGatewayUrl')}
            </div>

            <div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  value={validationUrl}
                  onChange={e => { setValidationUrl(e.target.value); setValidationStatus('idle') }}
                  onBlur={e => { saveValidationUrl(e.target.value); checkValidationConnection(e.target.value) }}
                  placeholder="https://gateway.example.com"
                  style={{
                    flex: 1, background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)',
                    borderRadius: '8px', padding: '0.45rem 0.7rem', fontSize: '0.85rem', outline: 'none',
                  }}
                />
                <button
                  onClick={() => { saveValidationUrl(validationUrl); checkValidationConnection(validationUrl) }}
                  style={{
                    background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
                    borderRadius: '8px', padding: '0.45rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  {t('pages.settingsPage.testBtn')}
                </button>
              </div>
              <div style={{ marginTop: '0.35rem', fontSize: '0.71rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                {t('pages.phase3.restB.settings.validationGatewayDescPrefix')} <code style={{ fontSize: '0.7rem' }}>VITE_VALIDATION_URL</code> {t('pages.phase3.restB.settings.validationGatewayDescSuffix')}
              </div>
            </div>

            {validationStatus !== 'idle' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.85rem', borderRadius: '8px', fontSize: '0.78rem',
                background: validationStatus === 'ok' ? 'color-mix(in srgb, var(--pass) 8%, transparent)' : validationStatus === 'checking' ? 'color-mix(in srgb, var(--waf-brand) 8%, transparent)' : 'color-mix(in srgb, var(--fail) 8%, transparent)',
                border: `1px solid ${validationStatus === 'ok' ? 'color-mix(in srgb, var(--pass) 30%, transparent)' : validationStatus === 'checking' ? 'color-mix(in srgb, var(--waf-brand) 30%, transparent)' : 'color-mix(in srgb, var(--fail) 30%, transparent)'}`,
                color: validationStatus === 'ok' ? 'var(--pass-ink)' : validationStatus === 'checking' ? 'var(--waf-brand-ink)' : 'var(--fail-ink)',
              }}>
                <span style={{ fontSize: '0.7rem' }}>
                  {validationStatus === 'ok' ? '●' : validationStatus === 'checking' ? '○' : '✕'}
                </span>
                {validationStatus === 'checking' ? t('pages.settingsPage.checking') : validationStatusMsg}
              </div>
            )}

            <div style={{ fontSize: '0.71rem', color: 'var(--muted)', fontFamily: 'monospace' }}>
              {t('pages.phase3.restB.settings.activeLabel')} <strong style={{ color: 'var(--text)' }}>{validationUrl.trim() || getValidationGatewayBase() || t('pages.phase3.restB.settings.notConfigured')}</strong>
            </div>

            <div style={{ fontSize: '0.71rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              {t('pages.phase3.restB.settings.gatewayTrustPrefix')} <code style={{ color: 'var(--waf-brand)', fontSize: '0.7rem' }}>WOMBAT_SERVER_SUBCA_CERT</code> {t('pages.phase3.restB.settings.gatewayTrustSuffix')}
            </div>
          </div>

          {/* Right: real engine guide */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', paddingBottom: '0.35rem', borderBottom: '1px solid var(--border)' }}>
              {t('pages.settingsPage.architectSandbox')}
            </div>

            <div style={{ fontSize: '0.79rem', color: 'var(--text)', lineHeight: 1.6 }}>
              {t('pages.settingsPage.realEngineDesc')}
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text)' }}>{t('pages.settingsPage.requirements')}:</strong>
              <ul style={{ margin: '0.35rem 0 0 1rem', padding: 0 }}>
                <li><code style={{ color: 'var(--waf-brand)', fontSize: '0.72rem' }}>wombat-core</code> {t('pages.phase3.restB.settings.installedOnServer')}</li>
                <li><code style={{ color: 'var(--waf-brand)', fontSize: '0.72rem' }}>WOMBAT_CONTROLS_DIR</code> {t('pages.phase3.restB.settings.pointingToControls')}</li>
              </ul>
            </div>

            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text)', display: 'block', marginBottom: '0.2rem' }}>{t('pages.settingsPage.dockerCompose')}</strong>
              {t('pages.phase3.restB.settings.controlsCopiedHint')}
            </div>
            <pre style={{
              background: '#0f172a', color: '#e2e8f0', borderRadius: '8px',
              padding: '0.65rem 0.85rem', fontSize: '0.72rem', lineHeight: 1.6, margin: 0, overflowX: 'auto',
            }}>
              {`docker compose up --build`}
            </pre>

            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text)', display: 'block', marginBottom: '0.2rem' }}>{t('pages.settingsPage.customControls')}</strong>
              {t('pages.phase3.restB.settings.overrideControlsHint')}
            </div>
            <pre style={{
              background: '#0f172a', color: '#e2e8f0', borderRadius: '8px',
              padding: '0.65rem 0.85rem', fontSize: '0.72rem', lineHeight: 1.6, margin: 0, overflowX: 'auto',
            }}>
              {`# In docker-compose.yml — wombat-server environment:\nWOMBAT_CONTROLS_DIR: /app/controls\n\n# Or mount a local directory:\nvolumes:\n  - ./my-controls:/app/controls:ro`}
            </pre>

            <div style={{ fontSize: '0.71rem', color: 'var(--muted)' }}>
              {t('pages.settingsPage.statusProbe')}: <code style={{ color: 'var(--text)', fontSize: '0.71rem' }}>{(serverUrl.trim() || '') + '/api/v1/sandbox/status'}</code>
            </div>
          </div>
        </div>
      </section>

      {/* ── Validation Provenance Defaults ───────────────────────────────────── */}
      <section className="card">
        <SectionHeader
          title={t('pages.settingsPage.sectionValidationProvenance')}
          subtitle={t('pages.settingsPage.validationProvenanceDesc')}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '1rem' }}>
          <Input
            label={t('pages.settingsPage.validationOrganization')}
            hint={t('pages.settingsPage.validationOrganizationDesc')}
            type="text"
            value={s.validationMetadata?.organization ?? ''}
            onChange={e => setS(prev => ({
              ...prev,
              validationMetadata: { ...(prev.validationMetadata ?? {}), organization: e.target.value },
            }))}
            placeholder={t('pages.settingsPage.validationOrganizationPlaceholder')}
          />

          <Input
            label={t('pages.settingsPage.validationEnvironment')}
            hint={t('pages.settingsPage.validationEnvironmentDesc')}
            type="text"
            value={s.validationMetadata?.environment ?? ''}
            onChange={e => setS(prev => ({
              ...prev,
              validationMetadata: { ...(prev.validationMetadata ?? {}), environment: e.target.value },
            }))}
            placeholder={t('pages.settingsPage.validationEnvironmentPlaceholder')}
          />

          <Input
            label={t('pages.settingsPage.validationValidatedBy')}
            hint={t('pages.settingsPage.validationValidatedByDesc')}
            type="text"
            value={s.validationMetadata?.validatedBy ?? ''}
            onChange={e => setS(prev => ({
              ...prev,
              validationMetadata: { ...(prev.validationMetadata ?? {}), validatedBy: e.target.value },
            }))}
            placeholder={t('pages.settingsPage.validationValidatedByPlaceholder')}
          />

          <Input
            label={t('pages.settingsPage.validationNotes')}
            hint={t('pages.settingsPage.validationNotesDesc')}
            type="text"
            value={s.validationMetadata?.notes ?? ''}
            onChange={e => setS(prev => ({
              ...prev,
              validationMetadata: { ...(prev.validationMetadata ?? {}), notes: e.target.value },
            }))}
            placeholder={t('pages.settingsPage.validationNotesPlaceholder')}
          />
        </div>
      </section>

      {/* ── Sticky bottom save bar ───────────────────────────────────────────── */}
      <div style={{
        position: 'sticky', bottom: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
        padding: '0.85rem 1.25rem', background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '12px', boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
          {saved ? t('pages.settingsPage.savedMsg') : t('pages.settingsPage.pageSubtitle')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          {resetButton}
          {saveButton}
        </div>
      </div>

    </div>
  )
}

