import { useState, useEffect } from 'react'
import { ControlMeta, Finding } from '../api'
import { PILLAR_COLOR } from '../controls-data'
import { useControlsCatalogue } from '../useControlsCatalogue'
import { useI18n } from '../i18n'
import { severityColor } from '../severity'
import { EmptyState } from '../ui'
import { PAGE_TITLE } from '../routing'

interface Props {
  controls: ControlMeta[]   // from active run API — empty when no run selected
  findings: Finding[]       // from active run, used for pass/fail overlay
}

const STATUS_COLOR: Record<string, string> = {
  PASS: 'var(--pass)', FAIL: 'var(--fail)', SKIP: 'var(--skip)', WAIVED: 'var(--waived)',
}

function pillarColor(pillar: string): string {
  return PILLAR_COLOR[pillar.toLowerCase()] ?? 'var(--skip)'
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '0.15rem 0.55rem', borderRadius: '999px',
      background: `color-mix(in srgb, ${color} 13%, transparent)`, color, fontSize: '0.72rem', fontWeight: 700,
    }}>
      {label}
    </span>
  )
}

function controlStatus(ctrlId: string, checks: { id: string }[], findings: Finding[]): 'PASS' | 'FAIL' | 'SKIP' | null {
  if (!findings.length) return null
  const related = findings.filter(f =>
    checks.some(c => c.id === f.check_id) || f.control_id === ctrlId
  )
  if (!related.length) return null
  if (related.some(f => f.status?.toUpperCase() === 'FAIL')) return 'FAIL'
  if (related.every(f => f.status?.toUpperCase() === 'PASS')) return 'PASS'
  return 'SKIP'
}

type TabId = 'overview' | 'why' | 'regulatory' | 'checks' | 'fix' | 'waiver'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview',    label: 'Overview' },
  { id: 'why',         label: 'Why it Matters' },
  { id: 'regulatory',  label: 'Regulatory' },
  { id: 'checks',      label: 'Checks' },
  { id: 'fix',         label: 'How to Fix' },
  { id: 'waiver',      label: 'Waiver' },
]

function CopyBtn({ code }: { code: string }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })}
      style={{ position: 'absolute', top: '0.4rem', right: '0.4rem', background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.15)', borderRadius: '4px', color: copied ? 'var(--pass)' : 'var(--skip)', fontSize: '0.7rem', padding: '0.15rem 0.45rem', cursor: 'pointer' }}
    >
      {copied ? t('common.copied') : t('common.copy')}
    </button>
  )
}

function DetailPanel({ ctrl, status, onClose }: { ctrl: ControlMeta; status: 'PASS' | 'FAIL' | 'SKIP' | null; onClose: () => void }) {
  const { t } = useI18n()
  const pc = pillarColor(ctrl.pillar)
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  // Waiver tab state
  const WAIVER_KEY = 'wombat_waivers'
  const [wReason, setWReason] = useState('')
  const [wOwner, setWOwner] = useState('')
  const [wExpires, setWExpires] = useState('')
  const [wSaved, setWSaved] = useState(false)

  const existingWaiver = (() => {
    try { return JSON.parse(localStorage.getItem(WAIVER_KEY) ?? '{}')[ctrl.id] ?? null } catch { return null }
  })()

  useEffect(() => {
    if (existingWaiver) {
      setWReason(existingWaiver.reason ?? '')
      setWOwner(existingWaiver.owner ?? '')
      setWExpires(existingWaiver.expires ?? '')
    }
  }, [ctrl.id])

  function saveWaiver() {
    try {
      const all = JSON.parse(localStorage.getItem(WAIVER_KEY) ?? '{}')
      all[ctrl.id] = { control_id: ctrl.id, reason: wReason, owner: wOwner, expires: wExpires, created_at: new Date().toISOString() }
      localStorage.setItem(WAIVER_KEY, JSON.stringify(all))
      setWSaved(true); setTimeout(() => setWSaved(false), 2000)
    } catch {}
  }

  function removeWaiver() {
    try {
      const all = JSON.parse(localStorage.getItem(WAIVER_KEY) ?? '{}')
      delete all[ctrl.id]
      localStorage.setItem(WAIVER_KEY, JSON.stringify(all))
      setWReason(''); setWOwner(''); setWExpires('')
    } catch {}
  }

  const inputStyle = {
    background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.85rem', outline: 'none', width: '100%', boxSizing: 'border-box' as const,
  }

  return (
    <div style={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: '1040px', maxWidth: '92vw', maxHeight: '85vh',
      background: 'var(--surface)', borderRadius: '12px',
      boxShadow: '0 24px 64px rgba(15,23,42,.18)',
      display: 'flex', flexDirection: 'column', zIndex: 100,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '1.25rem 1.25rem 0', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.875rem' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--muted)', marginBottom: '0.25rem' }}>{ctrl.id}</div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{ctrl.title}</div>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              <Pill label={ctrl.pillar} color={pc} />
              <Pill label={ctrl.severity} color={severityColor(ctrl.severity)} />
              {status && <Pill label={status} color={STATUS_COLOR[status] ?? 'var(--skip)'} />}
            </div>
          </div>
          <button aria-label={t('common.close')} onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '0.25rem', flexShrink: 0, fontSize: '1.2rem' }}>✕</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map(tab => {
            const tabLabel: Record<TabId, string> = {
              overview: t('pages.controlsPage.tabOverview'),
              why: t('pages.controlsPage.tabWhy'),
              regulatory: t('pages.controlsPage.tabRegulatory'),
              checks: t('pages.controlsPage.tabChecks'),
              fix: t('pages.controlsPage.tabFix'),
              waiver: t('pages.controlsPage.tabWaiver'),
            }
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: activeTab === tab.id ? 700 : 500,
                  color: activeTab === tab.id ? 'var(--waf-brand)' : 'var(--muted)',
                  borderBottom: activeTab === tab.id ? '2px solid var(--waf-brand)' : '2px solid transparent',
                  marginBottom: '-1px', whiteSpace: 'nowrap',
                }}
              >
                {tabLabel[tab.id]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {activeTab === 'overview' && (
          <>
            {ctrl.description && (
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>{t('pages.phase3.restA.controlsPage.description')}</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>{ctrl.description}</p>
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {ctrl.category && (
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>{t('pages.phase3.restA.controlsPage.category')}</div>
                  <Pill label={ctrl.category} color="var(--waf-brand)" />
                </div>
              )}
              {ctrl.checks.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>{t('pages.phase3.restA.controlsPage.automatedChecks')}</div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>{ctrl.checks.length}</span>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'why' && (
          <>
            {ctrl.rationale && (
              <div style={{ background: 'color-mix(in srgb, var(--waf-brand) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--waf-brand) 20%, transparent)', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--waf-brand)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>{t('pages.phase3.restA.controlsPage.businessImpact')}</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>{ctrl.rationale}</p>
              </div>
            )}
            {ctrl.threat && ctrl.threat.length > 0 && (
              <div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>{t('pages.phase3.restA.controlsPage.technicalImpact')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {ctrl.threat.map((t, i) => (
                    <div key={i} style={{ background: 'color-mix(in srgb, var(--fail) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--fail) 18%, transparent)', borderRadius: '8px', padding: '0.65rem 0.875rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.5 }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'regulatory' && (
          ctrl.regulatory_mapping.length > 0
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {ctrl.regulatory_mapping.map((m, i) => (
                  <div key={i} style={{ background: 'var(--bg)', borderRadius: '8px', padding: '0.75rem', border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--waf-brand)', marginBottom: '0.4rem' }}>{m.framework}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {m.controls.map((c, j) => (
                        <span key={j} style={{ padding: '0.1rem 0.5rem', borderRadius: '999px', background: 'color-mix(in srgb, var(--waf-brand) 10%, transparent)', color: 'var(--waf-brand)', fontSize: '0.72rem', fontWeight: 600 }}>{c}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            : <EmptyState compact title={t('pages.phase3.restA.controlsPage.noRegulatoryMappings')} />
        )}

        {activeTab === 'checks' && (
          ctrl.checks.length > 0
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {ctrl.checks.map((chk, i) => (
                  <div key={i} style={{ background: 'var(--bg)', borderRadius: '8px', padding: '0.75rem', border: '1px solid var(--border)' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.2rem' }}>{chk.id}</div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)', marginBottom: '0.35rem' }}>{chk.title}</div>
                    <Pill label={chk.severity} color={severityColor(chk.severity)} />
                  </div>
                ))}
              </div>
            : <EmptyState compact title={t('pages.phase3.restA.controlsPage.noAutomatedChecks')} />
        )}

        {activeTab === 'fix' && (
          ctrl.checks.length > 0
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {ctrl.checks.map((chk, i) => (
                  <div key={i} style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                    <div style={{ padding: '0.75rem', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--muted)' }}>{chk.id}</span>
                      <Pill label={chk.severity} color={severityColor(chk.severity)} />
                    </div>
                    <div style={{ padding: '0.75rem' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)', marginBottom: '0.4rem' }}>{chk.title}</div>
                      {chk.remediation && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: '0 0 0.5rem', lineHeight: 1.6 }}>{chk.remediation}</p>
                      )}
                      {chk.example?.compliant && (
                        <div style={{ position: 'relative' }}>
                          <pre style={{ background: '#0f172a', color: '#e2e8f0', borderRadius: '8px', padding: '0.75rem 2.5rem 0.75rem 0.75rem', fontSize: '0.72rem', overflowX: 'auto', lineHeight: 1.6, margin: 0 }}>
                            {chk.example.compliant}
                          </pre>
                          <CopyBtn code={chk.example.compliant} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            : <EmptyState compact title={t('pages.phase3.restA.controlsPage.noRemediation')} />
        )}

        {activeTab === 'waiver' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '580px' }}>
            {existingWaiver && (
              <div style={{ background: 'color-mix(in srgb, var(--waived) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--waived) 30%, transparent)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.85rem', color: 'var(--waf-info)' }}>
                {t('pages.controlsPage.existingWaiver')}
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.25rem' }}>{t('pages.controlsPage.waiverReason')}</label>
              <textarea
                value={wReason} onChange={e => setWReason(e.target.value)}
                rows={3} placeholder={t('pages.phase3.restA.controlsPage.waiverReasonPlaceholder')}
                style={{ ...inputStyle, resize: 'vertical' as const }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.25rem' }}>{t('pages.controlsPage.waiverOwner')}</label>
                <input value={wOwner} onChange={e => setWOwner(e.target.value)} placeholder={t('pages.phase3.restA.controlsPage.waiverOwnerPlaceholder')} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginBottom: '0.25rem' }}>{t('pages.controlsPage.waiverExpires')}</label>
                <input type="date" value={wExpires} onChange={e => setWExpires(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={saveWaiver}
                disabled={!wReason.trim()}
                style={{ padding: '0.45rem 1rem', borderRadius: '8px', border: 'none', cursor: wReason.trim() ? 'pointer' : 'not-allowed', background: wSaved ? 'var(--pass)' : 'var(--waf-brand)', color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}
              >
                {wSaved ? t('pages.controlsPage.waiverSaved') : existingWaiver ? t('pages.controlsPage.waiverUpdate') : t('pages.controlsPage.waiveSave')}
              </button>
              {existingWaiver && (
                <button
                  onClick={removeWaiver}
                  style={{ padding: '0.45rem 1rem', borderRadius: '8px', border: '1px solid color-mix(in srgb, var(--fail) 30%, transparent)', cursor: 'pointer', background: 'color-mix(in srgb, var(--fail) 6%, transparent)', color: 'var(--fail-ink)', fontWeight: 700, fontSize: '0.85rem' }}
                >
                  {t('pages.controlsPage.waiverRemove')}
                </button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default function ControlsPage({ controls, findings }: Props) {
  const { t } = useI18n()
  const catalogue = useControlsCatalogue()

  // Use live run controls when available, fall back to server catalogue / static
  const source: ControlMeta[] = controls.length > 0
    ? controls
    : catalogue.map(c => ({
        id: c.id,
        title: c.title,
        pillar: c.pillar,
        severity: c.severity,
        category: c.category,
        description: c.description,
        rationale: c.rationale ?? '',
        threat: c.threat ?? [],
        regulatory_mapping: c.regulatory_mapping,
        checks: c.automated_checks.map(chk => ({
          id: chk.id,
          title: chk.title,
          severity: chk.severity,
          remediation: chk.remediation ?? '',
          example: chk.example ?? null,
        })),
      }))

  const isLive = controls.length > 0

  const [search, setSearch] = useState('')
  const [pillarFilter, setPillarFilter] = useState('')
  const [sevFilter, setSevFilter] = useState('')
  const [selected, setSelected] = useState<ControlMeta | null>(null)

  const pillars = Array.from(new Set(source.map(c => c.pillar))).sort()

  const filtered = source.filter(c =>
    (!pillarFilter || c.pillar.toLowerCase() === pillarFilter.toLowerCase()) &&
    (!sevFilter    || c.severity.toLowerCase() === sevFilter.toLowerCase()) &&
    (!search       || c.title.toLowerCase().includes(search.toLowerCase()) ||
                      c.id.toLowerCase().includes(search.toLowerCase()) ||
                      c.category.toLowerCase().includes(search.toLowerCase()))
  )

  const selectStyle = {
    background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.8rem', outline: 'none',
  }

  return (
    <>
      <h1 className="ui-sr-only">{PAGE_TITLE['catalogue']}</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Source indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          padding: '0.6rem 0.875rem', borderRadius: '10px', fontSize: '0.8rem',
          background: isLive ? 'color-mix(in srgb, var(--waf-brand) 6%, transparent)' : 'color-mix(in srgb, var(--skip) 8%, transparent)',
          border: `1px solid ${isLive ? 'color-mix(in srgb, var(--waf-brand) 20%, transparent)' : 'color-mix(in srgb, var(--skip) 20%, transparent)'}`,
          color: isLive ? 'var(--waf-brand)' : 'var(--muted)',
        }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: isLive ? 'var(--waf-brand)' : 'var(--skip)', flexShrink: 0 }} />
          {isLive
            ? <><strong>{t('pages.phase3.restA.controlsPage.countControls', { count: source.length })}</strong> {t('pages.phase3.restA.controlsPage.loadedFromActiveRun')}</>
            : <>{t('pages.phase3.restA.controlsPage.showingReferenceSetBefore')} <code style={{ fontSize: '0.75rem' }}>wombat check --output json --push …</code> {t('pages.phase3.restA.controlsPage.showingReferenceSetAfter')}</>
          }
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            placeholder={t('pages.controlsPage.searchPlaceholder')}
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...selectStyle, flex: '1', minWidth: '180px' }}
          />
          <select value={pillarFilter} onChange={e => setPillarFilter(e.target.value)} style={selectStyle}>
            <option value="">{t('pages.controlsPage.allPillars')}</option>
            {pillars.map(p => <option key={p}>{p}</option>)}
          </select>
          <select value={sevFilter} onChange={e => setSevFilter(e.target.value)} style={selectStyle}>
            <option value="">{t('pages.controlsPage.allSeverities')}</option>
            {['critical', 'high', 'medium', 'low'].map(s => <option key={s}>{s}</option>)}
          </select>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
            {t('pages.controlsPage.controlsOf', { count: String(filtered.length), total: String(source.length) })}
          </span>
        </div>

        {/* Controls grid */}
        {filtered.length === 0 ? (
          <EmptyState
            title={source.length === 0
              ? t('pages.controlsPage.noControls')
              : t('pages.controlsPage.noMatch')}
          />
        ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
          {filtered.map(ctrl => {
            const status = controlStatus(ctrl.id, ctrl.checks, findings)
            const pc = pillarColor(ctrl.pillar)
            const sc = severityColor(ctrl.severity)
            return (
              <div
                key={ctrl.id}
                className="card"
                onClick={() => setSelected(selected?.id === ctrl.id ? null : ctrl)}
                style={{ cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)'}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--muted)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: pc, flexShrink: 0 }} aria-hidden="true" />
                    {ctrl.id}
                  </div>
                  {status && (
                    <span style={{
                      flexShrink: 0, padding: '0.1rem 0.45rem', borderRadius: '999px',
                      background: `color-mix(in srgb, ${STATUS_COLOR[status]} 13%, transparent)`, color: STATUS_COLOR[status],
                      fontSize: '0.7rem', fontWeight: 700,
                    }}>
                      {status}
                    </span>
                  )}
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)', marginBottom: '0.4rem', lineHeight: 1.4 }}>
                  {ctrl.title}
                </div>
                {ctrl.description && (
                  <p style={{
                    fontSize: '0.78rem', color: 'var(--muted)', margin: 0, lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {ctrl.description}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                  <Pill label={ctrl.pillar} color={pc} />
                  <Pill label={ctrl.severity} color={sc} />
                  {ctrl.checks.length > 0 && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--muted)' }}>
                      {ctrl.checks.length} {ctrl.checks.length !== 1 ? t('pages.phase3.restA.controlsPage.checkPlural') : t('pages.phase3.restA.controlsPage.checkSingular')}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        )}
      </div>

      {selected && (
        <>
          <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'var(--scrim)', zIndex: 99 }} />
          <DetailPanel
            ctrl={selected}
            status={controlStatus(selected.id, selected.checks, findings)}
            onClose={() => setSelected(null)}
          />
        </>
      )}

    </>
  )
}
