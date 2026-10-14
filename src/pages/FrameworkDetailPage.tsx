import { useMemo, useState } from 'react'
import { RunDetail, ControlMeta } from '../api'
import { FRAMEWORKS, PILLAR_COLOR } from '../controls-data'
import { useControlsCatalogue } from '../useControlsCatalogue'
import { useI18n } from '../i18n'
import type { FilterState, Page } from '../routing'

interface Props {
  run: RunDetail
  navigate: (page: Page, filters?: FilterState) => void
  frameworkId?: string
}

function scoreColor(s: number) {
  return s >= 80 ? 'var(--score-high)' : s >= 60 ? 'var(--score-mid)' : 'var(--score-low)'
}

function statusColor(role: 'good' | 'warn' | 'bad' | 'info' | 'text' | 'muted') {
  const map: Record<typeof role, string> = {
    good: 'var(--pass)', warn: 'var(--score-mid)', bad: 'var(--fail)', info: 'var(--waf-brand)',
    text: 'var(--text)', muted: 'var(--muted)',
  }
  return map[role]
}

function CircularScore({ value, size = 96, stroke = 8, color, track = 'var(--track)' }: { value: number; size?: number; stroke?: number; color: string; track?: string }) {
  const pct = Math.min(100, Math.max(0, value))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <div style={{ position: 'relative', width: size, height: size, filter: `drop-shadow(0 0 8px ${color})` }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={`fdgGrad-${value}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#fdgGrad-${value})`}
          strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1, color, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>{value}</span>
        <span style={{ fontSize: '0.55rem', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.06em' }}>/100</span>
      </div>
    </div>
  )
}

function IconWrapper({ children, size = 16 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

function CheckIcon() { return <IconWrapper size={14}><polyline points="20 6 9 17 4 12" /></IconWrapper> }
function XIcon() { return <IconWrapper size={14}><path d="M18 6 6 18M6 6l12 12" /></IconWrapper> }
function MinusIcon() { return <IconWrapper size={14}><path d="M5 12h14" /></IconWrapper> }
function SearchIcon() { return <IconWrapper><circle cx={11} cy={11} r="8" /><path d="m21 21-4.35-4.35" /></IconWrapper> }
function ArrowLeftIcon() { return <IconWrapper><path d="M19 12H5M12 19l-7-7 7-7" /></IconWrapper> }
function GridIcon() { return <IconWrapper><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></IconWrapper> }
function ListIcon() { return <IconWrapper><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></IconWrapper> }
function EditIcon() { return <IconWrapper size={14}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></IconWrapper> }
function TrashIcon() { return <IconWrapper size={14}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></IconWrapper> }

function frameworkLogoStorageKey(id: string): string {
  return `wafpp:fw-logo:${id}`
}

function FrameworkLogo({ framework, onChange }: { framework: typeof FRAMEWORKS[number]; onChange?: (src: string | null) => void }) {
  const [custom, setCustom] = useState<string | null>(() => {
    try { return localStorage.getItem(frameworkLogoStorageKey(framework.id)) }
    catch { return null }
  })

  const src = custom ?? framework.logo
  const hasCustom = Boolean(custom)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null
      if (!dataUrl) return
      try { localStorage.setItem(frameworkLogoStorageKey(framework.id), dataUrl) }
      catch (err) { console.warn('Failed to persist custom framework logo', err) }
      setCustom(dataUrl)
      onChange?.(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  function reset() {
    try { localStorage.removeItem(frameworkLogoStorageKey(framework.id)) }
    catch {}
    setCustom(null)
    onChange?.(null)
  }

  return (
    <div className="fdg-hero__logo-wrap">
      <img
        src={src}
        alt={framework.label}
        className="fdg-hero__logo"
        onError={e => { e.currentTarget.style.display = 'none' }}
      />
      <label className="fdg-hero__logo-upload" title="Upload custom logo">
        <input type="file" accept="image/*" onChange={handleFile} aria-label="Upload custom framework logo" />
        <EditIcon />
      </label>
      {hasCustom && (
        <button
          className="fdg-hero__logo-reset"
          title="Reset to default logo"
          onClick={reset}
          aria-label="Reset framework logo"
        >
          <TrashIcon />
        </button>
      )}
    </div>
  )
}

function SectionCard({ title, subtitle, children, style = {} }: { title: string; subtitle?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1.5rem', ...style,
    }}>
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

export default function FrameworkDetailPage({ run, navigate, frameworkId }: Props) {
  const { t } = useI18n()
  const catalogue = useControlsCatalogue()
  const [search, setSearch] = useState('')
  const [groupByRequirement, setGroupByRequirement] = useState(false)

  const controlsCatalogue: ControlMeta[] = useMemo(() =>
    run.controls_meta.length > 0 ? run.controls_meta : catalogue as unknown as ControlMeta[],
    [run.controls_meta, catalogue]
  )

  const framework = useMemo(() => FRAMEWORKS.find(f => f.id === frameworkId), [frameworkId])

  function controlRunStatus(ctrlId: string): 'PASS' | 'FAIL' | 'SKIP' | 'UNKNOWN' {
    const related = run.findings.filter(f => f.control_id === ctrlId)
    if (!related.length) return 'UNKNOWN'
    if (related.some(f => f.status?.toUpperCase() === 'FAIL')) return 'FAIL'
    if (related.every(f => f.status?.toUpperCase() === 'PASS')) return 'PASS'
    return 'SKIP'
  }

  const STATUS_COLOR: Record<string, string> = {
    PASS: 'var(--pass)', FAIL: 'var(--fail)', SKIP: 'var(--muted)', UNKNOWN: 'var(--muted)',
  }
  const STATUS_ICON: Record<string, () => JSX.Element> = {
    PASS: CheckIcon, FAIL: XIcon, SKIP: MinusIcon, UNKNOWN: MinusIcon,
  }

  const mappedControls = useMemo(() => {
    return controlsCatalogue.filter(c => c.regulatory_mapping.some(m => m.framework === frameworkId))
  }, [controlsCatalogue, frameworkId])

  const stats = useMemo(() => {
    const statuses = mappedControls.map(c => controlRunStatus(c.id))
    const pass = statuses.filter(s => s === 'PASS').length
    const fail = statuses.filter(s => s === 'FAIL').length
    const skip = statuses.filter(s => s === 'SKIP').length
    const unknown = statuses.filter(s => s === 'UNKNOWN').length
    const known = statuses.filter(s => s !== 'UNKNOWN').length
    const passRate = known > 0 ? Math.round((pass / known) * 100) : 0
    return { total: mappedControls.length, pass, fail, skip, unknown, passRate, known }
  }, [mappedControls, run.findings]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredControls = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return mappedControls
    return mappedControls.filter(c =>
      c.id.toLowerCase().includes(term) ||
      c.title.toLowerCase().includes(term) ||
      c.category.toLowerCase().includes(term) ||
      c.pillar.toLowerCase().includes(term)
    )
  }, [mappedControls, search])

  // Every requirement ID known for this framework across the whole WAF++ catalogue
  const allRequirements = useMemo(() => {
    const ids = new Set<string>()
    controlsCatalogue.forEach(c => {
      c.regulatory_mapping.forEach(m => {
        if (m.framework === frameworkId && m.controls?.length) {
          m.controls.forEach(req => ids.add(req))
        }
      })
    })
    return [...ids].sort((a, b) => a.localeCompare(b))
  }, [controlsCatalogue, frameworkId])

  const mappedRequirements = useMemo(() => {
    const ids = new Set<string>()
    mappedControls.forEach(c => {
      c.regulatory_mapping
        .filter(m => m.framework === frameworkId)
        .forEach(m => m.controls?.forEach(req => ids.add(req)))
    })
    return ids
  }, [mappedControls, frameworkId])

  const totalRequirements = allRequirements.length
  const mappedRequirementCount = mappedRequirements.size
  const unmappedRequirementCount = totalRequirements - mappedRequirementCount
  const requirementCoverage = totalRequirements > 0 ? Math.round((mappedRequirementCount / totalRequirements) * 100) : 0

  const groupedByRequirement = useMemo(() => {
    const map = new Map<string, ControlMeta[]>()
    filteredControls.forEach(c => {
      const mapping = c.regulatory_mapping.find(m => m.framework === frameworkId)
      const reqs = mapping?.controls?.length ? mapping.controls : []
      reqs.forEach(req => {
        if (!map.has(req)) map.set(req, [])
        map.get(req)!.push(c)
      })
    })
    return allRequirements.map(req => [req, map.get(req) ?? []] as [string, ControlMeta[]])
  }, [filteredControls, frameworkId, allRequirements])

  if (!framework) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
        <p>{t('frameworkDetail.notFound')}</p>
        <button className="scc-btn" onClick={() => navigate('compliance')}>
          <ArrowLeftIcon /> {t('frameworkDetail.back')}
        </button>
      </div>
    )
  }

  const color = stats.known > 0 ? scoreColor(stats.passRate) : 'var(--muted)'

  return (
    <div className="fdg-root">
      <style>{frameworkDetailCss}</style>

      {/* Header */}
      <div className="fdg-hero" style={{ '--fw-color': color } as React.CSSProperties}>
        <button className="fdg-back" onClick={() => navigate('compliance')} aria-label={t('frameworkDetail.back')}>
          <ArrowLeftIcon /> {t('frameworkDetail.back')}
        </button>
        <div className="fdg-hero__content">
          <FrameworkLogo framework={framework} />
          <div className="fdg-hero__flag">{framework.flag}</div>
          <div>
            <h1 className="fdg-hero__title">{framework.label}</h1>
            <p className="fdg-hero__subtitle">{framework.desc}</p>
            <span className="fdg-hero__country">{framework.country}</span>
          </div>
        </div>
        <div className="fdg-hero__score">
          <CircularScore value={stats.passRate} size={120} stroke={10} color={color} />
          <div className="fdg-hero__score-label">
            <span className="fdg-hero__score-value" style={{ color }}>{stats.passRate}%</span>
            <span className="fdg-hero__score-unit">{t('frameworkDetail.passRate')}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="fdg-stats">
        <StatCard label={t('frameworkDetail.mapped')} value={String(stats.total)} color={statusColor('info')} />
        <StatCard label={t('frameworkDetail.passed')} value={String(stats.pass)} color={statusColor('good')} />
        <StatCard label={t('frameworkDetail.failed')} value={String(stats.fail)} color={stats.fail > 0 ? statusColor('bad') : statusColor('muted')} />
        <StatCard label={t('frameworkDetail.unknown')} value={String(stats.unknown)} color={statusColor('muted')} />
        <StatCard label={t('frameworkDetail.requirements')} value={String(totalRequirements)} color={statusColor('text')} />
        <StatCard label={t('frameworkDetail.mappedRequirements')} value={String(mappedRequirementCount)} color={statusColor('good')} />
        <StatCard label={t('frameworkDetail.unmappedRequirements')} value={String(unmappedRequirementCount)} color={unmappedRequirementCount > 0 ? statusColor('bad') : statusColor('muted')} />
        <StatCard label={t('frameworkDetail.coverageRate')} value={`${requirementCoverage}%`} color={statusColor('info')} />
      </div>

      {/* Controls list */}
      <SectionCard title={t('frameworkDetail.controlsTitle')} subtitle={t('frameworkDetail.controlsSubtitle')}>
        <div className="fdg-toolbar">
          <div className="fdg-search">
            <SearchIcon />
            <input
              type="text"
              placeholder={t('frameworkDetail.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label={t('frameworkDetail.searchPlaceholder')}
            />
          </div>
          <button
            className={`fdg-toggle ${groupByRequirement ? 'fdg-toggle--active' : ''}`}
            onClick={() => setGroupByRequirement(v => !v)}
            aria-pressed={groupByRequirement}
          >
            {groupByRequirement ? <GridIcon /> : <ListIcon />}
            {t('frameworkDetail.groupByRequirement')}
          </button>
        </div>

        {filteredControls.length === 0 && !groupByRequirement ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem', fontSize: '0.85rem' }}>
            {search ? t('frameworkDetail.noSearchMatch') : t('frameworkDetail.noMappedControls')}
          </div>
        ) : groupByRequirement ? (
          <div className="fdg-groups">
            {groupedByRequirement
              .filter(([, controls]) => controls.length > 0 || !search.trim())
              .map(([req, controls]) => (
                <div key={req} className="fdg-group">
                  <div className="fdg-group__header">
                    <span className="fdg-group__req">{req}</span>
                    {controls.length > 0 ? (
                      <span className="fdg-group__count">{controls.length} {t('frameworkDetail.controls')}</span>
                    ) : (
                      <span className="fdg-group__count fdg-group__count--none">{t('frameworkDetail.requirementUnmapped')}</span>
                    )}
                  </div>
                  {controls.length > 0 ? (
                    <div className="fdg-control-list">
                      {controls.map(ctrl => <ControlRow key={ctrl.id} ctrl={ctrl} frameworkId={framework.id} statusColor={STATUS_COLOR} statusIcon={STATUS_ICON} controlRunStatus={controlRunStatus} />)}
                    </div>
                  ) : (
                    <div className="fdg-group__empty">{t('frameworkDetail.noMappedControls')}</div>
                  )}
                </div>
              ))}
          </div>
        ) : (
          <div className="fdg-control-list">
            {filteredControls.map(ctrl => (
              <ControlRow key={ctrl.id} ctrl={ctrl} frameworkId={framework.id} statusColor={STATUS_COLOR} statusIcon={STATUS_ICON} controlRunStatus={controlRunStatus} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="fdg-stat" style={{ borderColor: color }}>
      <div className="fdg-stat__value" style={{ color }}>{value}</div>
      <div className="fdg-stat__label">{label}</div>
    </div>
  )
}

function ControlRow({
  ctrl,
  frameworkId,
  statusColor,
  statusIcon,
  controlRunStatus,
}: {
  ctrl: ControlMeta
  frameworkId: string
  statusColor: Record<string, string>
  statusIcon: Record<string, () => JSX.Element>
  controlRunStatus: (id: string) => 'PASS' | 'FAIL' | 'SKIP' | 'UNKNOWN'
}) {
  const st = controlRunStatus(ctrl.id)
  const sc = statusColor[st]
  const Icon = statusIcon[st]
  const mapping = ctrl.regulatory_mapping.find(m => m.framework === frameworkId)
  const pillarColor = PILLAR_COLOR[ctrl.pillar.toLowerCase()] ?? 'var(--muted)'
  return (
    <div className="fdg-control" style={{ '--ctrl-color': sc } as React.CSSProperties}>
      <div className="fdg-control__main">
        <span className="fdg-control__status"><Icon /></span>
        <span className="fdg-control__id">{ctrl.id}</span>
        <span className="fdg-control__title">{ctrl.title}</span>
        <span className="fdg-control__pillar" style={{ color: pillarColor, borderColor: pillarColor }}>{ctrl.pillar}</span>
        <span className="fdg-control__severity" style={{ color: sc, borderColor: sc }}>{ctrl.severity}</span>
        <span className="fdg-control__category">{ctrl.category}</span>
      </div>
      {mapping && mapping.controls.length > 0 && (
        <div className="fdg-control__mapping">
          {mapping.controls.map(req => (
            <span key={req} className="fdg-control__req">{req}</span>
          ))}
        </div>
      )}
    </div>
  )
}

const frameworkDetailCss = `
.fdg-root {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-bottom: 2rem;
  animation: fdgFadeIn 0.4s ease forwards;
}
@keyframes fdgFadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.fdg-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  background:
    radial-gradient(circle at 20% 50%, color-mix(in srgb, var(--fw-color) 12%, transparent) 0%, transparent 40%),
    radial-gradient(circle at 80% 20%, color-mix(in srgb, var(--waf-brand) 8%, transparent) 0%, transparent 35%),
    linear-gradient(135deg, var(--surface) 0%, var(--bg) 100%);
  border: 1px solid color-mix(in srgb, var(--fw-color) 22%, transparent);
  border-radius: 20px;
  padding: 1.5rem 1.75rem;
  position: relative;
  flex-wrap: wrap;
}
.fdg-back {
  position: absolute;
  top: 1rem;
  left: 1rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: color-mix(in srgb, var(--waf-brand) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--waf-brand) 25%, transparent);
  color: var(--waf-brand);
  border-radius: 6px;
  padding: 0.35rem 0.65rem;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s ease;
}
.fdg-back:hover {
  background: color-mix(in srgb, var(--waf-brand) 18%, transparent);
}
.fdg-hero__content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding-top: 1.5rem;
}
.fdg-hero__flag {
  font-size: 2.5rem;
  line-height: 1;
  flex-shrink: 0;
}
.fdg-hero__logo-wrap {
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  padding: 6px;
  border-radius: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: 0 0 20px color-mix(in srgb, var(--fw-color) 18%, transparent);
}
.fdg-hero__logo {
  width: 100%;
  height: 100%;
  border-radius: 10px;
  flex-shrink: 0;
  object-fit: contain;
}
.fdg-hero__logo-upload,
.fdg-hero__logo-reset {
  position: absolute;
  bottom: -6px;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
}
.fdg-hero__logo-upload:hover,
.fdg-hero__logo-reset:hover {
  background: var(--waf-brand);
  color: white;
  border-color: var(--waf-brand);
}
.fdg-hero__logo-upload input {
  position: absolute;
  inset: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}
.fdg-hero__logo-upload { right: -8px; }
.fdg-hero__logo-reset { right: 18px; }
.fdg-hero__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 800;
  color: var(--text);
  line-height: 1.2;
}
.fdg-hero__subtitle {
  margin: 0.45rem 0 0;
  font-size: 0.85rem;
  color: var(--muted);
  max-width: 520px;
}
.fdg-hero__country {
  display: inline-block;
  margin-top: 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--fw-color);
  background: color-mix(in srgb, var(--fw-color) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--fw-color) 25%, transparent);
  border-radius: 4px;
  padding: 0.2rem 0.5rem;
}
.fdg-hero__score {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 1rem;
}
.fdg-hero__score-label {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.fdg-hero__score-value {
  font-size: 1.8rem;
  font-weight: 800;
  line-height: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.fdg-hero__score-unit {
  font-size: 0.62rem;
  color: var(--muted);
  font-weight: 700;
  letter-spacing: 0.08em;
}

.fdg-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
}
.fdg-stat {
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 3px solid;
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.fdg-stat__value {
  font-size: 1.6rem;
  font-weight: 800;
  line-height: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.fdg-stat__label {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.fdg-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}
.fdg-search {
  position: relative;
  flex: 1;
  min-width: 220px;
}
.fdg-search svg {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted);
  pointer-events: none;
}
.fdg-search input {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.55rem 0.75rem 0.55rem 2.25rem;
  color: var(--text);
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s ease;
}
.fdg-search input:focus {
  border-color: var(--waf-brand);
}
.fdg-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.5rem 0.85rem;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}
.fdg-toggle--active {
  background: color-mix(in srgb, var(--waf-brand) 12%, transparent);
  border-color: color-mix(in srgb, var(--waf-brand) 30%, transparent);
  color: var(--waf-brand);
}

.fdg-groups {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.fdg-group {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}
.fdg-group__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: color-mix(in srgb, var(--waf-brand) 6%, transparent);
  border-bottom: 1px solid var(--border);
}
.fdg-group__req {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.fdg-group__count {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.fdg-group__count--none {
  color: var(--fail);
  background: color-mix(in srgb, var(--fail) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--fail) 20%, transparent);
  border-radius: 4px;
  padding: 0.1rem 0.35rem;
}
.fdg-group__empty {
  padding: 1rem;
  font-size: 0.75rem;
  color: var(--muted);
  font-style: italic;
}

.fdg-control-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.fdg-control {
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 3px solid var(--ctrl-color);
  border-radius: 10px;
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  transition: background 0.2s ease;
}
.fdg-control:hover {
  background: color-mix(in srgb, var(--ctrl-color) 5%, var(--surface));
}
.fdg-control__main {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}
.fdg-control__status {
  color: var(--ctrl-color);
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}
.fdg-control__id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--waf-brand);
  flex-shrink: 0;
}
.fdg-control__title {
  flex: 1;
  min-width: 200px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
}
.fdg-control__pillar,
.fdg-control__severity,
.fdg-control__category {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.2rem 0.4rem;
  flex-shrink: 0;
}
.fdg-control__pillar {
  border-color: currentColor;
}
.fdg-control__category {
  color: var(--muted);
}
.fdg-control__mapping {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.fdg-control__req {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--waf-brand);
  background: color-mix(in srgb, var(--waf-brand) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--waf-brand) 25%, transparent);
  border-radius: 4px;
  padding: 0.15rem 0.4rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

@media (max-width: 640px) {
  .fdg-hero__content {
    flex-direction: column;
  }
  .fdg-hero__score {
    width: 100%;
    justify-content: flex-start;
  }
  .fdg-control__main {
    flex-direction: column;
    align-items: flex-start;
  }
}
`
