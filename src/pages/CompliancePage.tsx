import { useMemo, useState } from 'react'
import { RunDetail, ControlMeta } from '../api'
import { FRAMEWORKS, PILLAR_COLOR } from '../controls-data'
import { useControlsCatalogue } from '../useControlsCatalogue'
import type { Settings } from './settingsUtils'
import { useI18n } from '../i18n'

interface Props { run: RunDetail; settings?: Settings }

function scoreColor(s: number) {
  return s >= 80 ? '#059669' : s >= 60 ? '#d97706' : '#DA2C38'
}

function ProgressBar({ value }: { value: number }) {
  const color = scoreColor(value)
  return (
    <div style={{ height: '6px', borderRadius: '999px', background: 'var(--border)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: '999px', transition: 'width 0.4s ease' }} />
    </div>
  )
}

type SortKey = 'country' | 'name' | 'coverage_desc' | 'coverage_asc'

export default function CompliancePage({ run, settings }: Props) {
  const { t } = useI18n()
  const [tab, setTab] = useState<'pillars' | 'frameworks'>('pillars')
  const catalogue = useControlsCatalogue()

  // Framework filter state
  const allCountries = useMemo(() =>
    [...new Map(FRAMEWORKS.map(f => [f.country, { country: f.country, flag: f.flag }])).values()],
    []
  )
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(() => {
    const activeRegions = settings?.regulatoryRegions
    if (activeRegions && activeRegions.length > 0) {
      return new Set(FRAMEWORKS.filter(f => activeRegions.includes(f.region)).map(f => f.country))
    }
    return new Set(allCountries.map(c => c.country))
  })
  const [fwSearch, setFwSearch]   = useState('')
  const [sortKey, setSortKey]     = useState<SortKey>('country')
  const findings = run.findings
  const pillars = Array.from(new Set(findings.map(f => f.pillar).filter((p): p is string => Boolean(p)))).sort()

  // Prefer run.controls_meta (from engine), fall back to server catalogue / static
  const controlsCatalogue: ControlMeta[] = useMemo(() =>
    run.controls_meta.length > 0 ? run.controls_meta : catalogue as unknown as ControlMeta[],
    [run.controls_meta, catalogue]
  )

  // ── Pillar tab ──────────────────────────────────────────────────────────
  const pillarStats = pillars.map(p => {
    const pf = findings.filter(f => f.pillar === p)
    const total  = pf.length
    const pass   = pf.filter(f => f.status?.toUpperCase() === 'PASS').length
    const fail   = pf.filter(f => f.status?.toUpperCase() === 'FAIL').length
    const waived = pf.filter(f => f.status?.toUpperCase() === 'WAIVED').length
    const passRate = total > 0 ? Math.round((pass / total) * 100) : 0
    const score  = run.pillar_scores[p] ?? passRate
    return { pillar: p, total, pass, fail, waived, passRate, score }
  })

  const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
  const sevColor: Record<string, string> = {
    CRITICAL: '#DA2C38', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e',
  }

  // ── Frameworks tab ──────────────────────────────────────────────────────
  // For each framework, find controls that map to it and their run status
  function controlRunStatus(ctrlId: string): 'PASS' | 'FAIL' | 'SKIP' | 'UNKNOWN' {
    const related = findings.filter(f => f.control_id === ctrlId)
    if (!related.length) return 'UNKNOWN'
    if (related.some(f => f.status?.toUpperCase() === 'FAIL')) return 'FAIL'
    if (related.every(f => f.status?.toUpperCase() === 'PASS')) return 'PASS'
    return 'SKIP'
  }

  const STATUS_COLOR: Record<string, string> = {
    PASS: '#22c55e', FAIL: '#DA2C38', SKIP: '#94a3b8', UNKNOWN: '#cbd5e1',
  }

  const tabStyle = (active: boolean) => ({
    padding: '0.5rem 1.25rem', border: 'none', cursor: 'pointer', fontWeight: 600,
    fontSize: '0.85rem', background: 'transparent',
    color: active ? 'var(--waf-brand)' : 'var(--muted)',
    borderBottom: active ? '2px solid var(--waf-brand)' : '2px solid transparent',
    transition: 'all 0.15s',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Tab switcher */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '0' }}>
        <button style={tabStyle(tab === 'pillars')}    onClick={() => setTab('pillars')}>{t('compliance.pillarTab')}</button>
        <button style={tabStyle(tab === 'frameworks')} onClick={() => setTab('frameworks')}>{t('compliance.frameworkTab')}</button>
      </div>

      {tab === 'pillars' && (
        <>
          {pillars.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
              {t('compliance.noPillarData')}
            </div>
          ) : (
            <>
              {/* Pillar cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                {pillarStats.map(s => {
                  const pc = PILLAR_COLOR[s.pillar] ?? 'var(--waf-brand)'
                  return (
                    <div key={s.pillar} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderLeft: `3px solid ${pc}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize' }}>{s.pillar}</div>
                        <div style={{ fontWeight: 800, fontSize: '1.25rem', color: scoreColor(s.score) }}>{s.score}</div>
                      </div>
                      <ProgressBar value={s.score} />
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
                        <span style={{ color: '#22c55e' }}>✓ {s.pass}</span>
                        {s.fail > 0 && <span style={{ color: '#DA2C38' }}>✗ {s.fail}</span>}
                        {s.waived > 0 && <span style={{ color: '#a78bfa' }}>~ {s.waived}</span>}
                        <span style={{ color: 'var(--muted)', marginLeft: 'auto' }}>{s.total} total</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Severity breakdown table */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                  <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                    {t('compliance.failingFindings')}
                  </h2>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg)' }}>
                        <th style={{ padding: '0.65rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('compliance.pillarCol')}</th>
                        <th style={{ padding: '0.65rem 1rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('compliance.passRate')}</th>
                        {severities.map(s => (
                          <th key={s} style={{ padding: '0.65rem 1rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: sevColor[s], textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s}</th>
                        ))}
                        <th style={{ padding: '0.65rem 1rem', textAlign: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('compliance.totalCol')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pillarStats.map(s => (
                        <tr key={s.pillar} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text)', textTransform: 'capitalize' }}>{s.pillar}</td>
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                            <span style={{ fontWeight: 700, color: scoreColor(s.passRate) }}>{s.passRate}%</span>
                          </td>
                          {severities.map(sev => {
                            const count = findings.filter(f =>
                              f.pillar === s.pillar &&
                              f.severity?.toUpperCase() === sev &&
                              f.status?.toUpperCase() === 'FAIL'
                            ).length
                            return (
                              <td key={sev} style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                {count > 0
                                  ? <span style={{ fontWeight: 700, color: sevColor[sev] }}>{count}</span>
                                  : <span style={{ color: 'var(--muted)' }}>—</span>
                                }
                              </td>
                            )
                          })}
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center', color: 'var(--muted)' }}>{s.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'frameworks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* ── Filter / sort toolbar ─────────────────────────────────────── */}
          <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {/* Search + Sort row */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder={t('compliance.searchPlaceholder')}
                value={fwSearch}
                onChange={e => setFwSearch(e.target.value)}
                style={{
                  flex: '1 1 180px', padding: '0.45rem 0.75rem',
                  borderRadius: 8, border: '1px solid var(--border)',
                  background: 'var(--bg)', color: 'var(--text)', fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
                style={{
                  padding: '0.45rem 0.75rem', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text)', fontSize: '0.82rem', cursor: 'pointer',
                }}
              >
                <option value="country">{t('compliance.sortCountry')}</option>
                <option value="name">{t('compliance.sortName')}</option>
                <option value="coverage_desc">{t('compliance.sortCoverageDesc')}</option>
                <option value="coverage_asc">{t('compliance.sortCoverageAsc')}</option>
              </select>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => setSelectedCountries(new Set(allCountries.map(c => c.country)))}
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--muted)', cursor: 'pointer' }}>
                  All
                </button>
                <button onClick={() => setSelectedCountries(new Set())}
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--muted)', cursor: 'pointer' }}>
                  None
                </button>
              </div>
            </div>

            {/* Country filter chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {allCountries.map(({ country, flag }) => {
                const active = selectedCountries.has(country)
                return (
                  <button key={country}
                    onClick={() => {
                      const next = new Set(selectedCountries)
                      if (next.has(country)) next.delete(country); else next.add(country)
                      setSelectedCountries(next)
                    }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                      padding: '0.3rem 0.7rem', borderRadius: 999, cursor: 'pointer',
                      fontSize: '0.78rem', fontWeight: 600,
                      border: `1px solid ${active ? 'var(--waf-brand)' : 'var(--border)'}`,
                      background: active ? 'rgba(0,148,255,0.12)' : 'var(--bg)',
                      color: active ? 'var(--waf-brand)' : 'var(--muted)',
                      transition: 'all 0.15s',
                    }}>
                    <span style={{ fontSize: '1rem', lineHeight: 1 }}>{flag}</span>
                    {country}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Framework cards ───────────────────────────────────────────── */}
          {(() => {
            // Compute per-framework stats first (needed for sort-by-coverage)
            const withStats = FRAMEWORKS.map(fw => {
              const mappedControls = controlsCatalogue.filter(c =>
                c.regulatory_mapping.some(m => m.framework === fw.id)
              )
              const statuses   = mappedControls.map(c => controlRunStatus(c.id))
              const passCount  = statuses.filter(s => s === 'PASS').length
              const failCount  = statuses.filter(s => s === 'FAIL').length
              const knownCount = statuses.filter(s => s !== 'UNKNOWN').length
              const passRate   = knownCount > 0 ? Math.round((passCount / knownCount) * 100) : null
              return { fw, mappedControls, passCount, failCount, passRate }
            })

            // Filter
            const filtered = withStats.filter(({ fw }) =>
              selectedCountries.has(fw.country) &&
              (fwSearch === '' ||
                fw.label.toLowerCase().includes(fwSearch.toLowerCase()) ||
                fw.desc.toLowerCase().includes(fwSearch.toLowerCase()) ||
                fw.country.toLowerCase().includes(fwSearch.toLowerCase()))
            )

            // Sort
            const sorted = [...filtered].sort((a, b) => {
              if (sortKey === 'country') {
                const rc = a.fw.country.localeCompare(b.fw.country)
                return rc !== 0 ? rc : a.fw.label.localeCompare(b.fw.label)
              }
              if (sortKey === 'name') return a.fw.label.localeCompare(b.fw.label)
              const ar = a.passRate ?? -1, br = b.passRate ?? -1
              return sortKey === 'coverage_desc' ? br - ar : ar - br
            })

            if (sorted.length === 0) return (
              <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
                {t('compliance.noMatch')}
              </div>
            )

            return sorted.map(({ fw, mappedControls, passCount, failCount, passRate }) => (
              <div key={fw.id} className="card">
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                      <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{fw.flag}</span>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>{fw.label}</span>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 600, padding: '0.1rem 0.5rem',
                        borderRadius: 999, background: 'var(--bg)',
                        border: '1px solid var(--border)', color: 'var(--muted)',
                      }}>{fw.country}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{fw.desc}</div>
                  </div>
                  {passRate !== null ? (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '1.5rem', color: scoreColor(passRate) }}>{passRate}%</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{t('compliance.passRate')}</div>
                    </div>
                  ) : (
                    <div style={{
                      flexShrink: 0, padding: '0.25rem 0.65rem', borderRadius: 6,
                      fontSize: '0.72rem', fontWeight: 600,
                      background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--muted)',
                    }}>{t('compliance.notMappedBadge')}</div>
                  )}
                </div>

                {/* Progress bar */}
                {passRate !== null && (
                  <div style={{ marginBottom: '1rem' }}>
                    <ProgressBar value={passRate} />
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', fontSize: '0.75rem' }}>
                      <span style={{ color: '#22c55e' }}>✓ {passCount} {t('compliance.passLabel')}</span>
                      {failCount > 0 && <span style={{ color: '#DA2C38' }}>✗ {failCount} {t('compliance.failLabel')}</span>}
                      <span style={{ color: 'var(--muted)' }}>{mappedControls.length} {t('compliance.controlsMapped')}</span>
                    </div>
                  </div>
                )}

                {/* Control chips */}
                {mappedControls.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {mappedControls.map(ctrl => {
                      const st = controlRunStatus(ctrl.id)
                      const sc = STATUS_COLOR[st]
                      const mapping = ctrl.regulatory_mapping.find(m => m.framework === fw.id)
                      return (
                        <div key={ctrl.id} style={{
                          padding: '0.35rem 0.65rem', borderRadius: '8px',
                          background: `${sc}12`, border: `1px solid ${sc}33`,
                          fontSize: '0.75rem',
                        }}>
                          <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '0.1rem' }}>{ctrl.id}</div>
                          {mapping && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{mapping.controls.join(', ')}</div>
                          )}
                          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: sc, marginTop: '0.2rem' }}>{st}</div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontStyle: 'italic' }}>
                    {t('compliance.noMappingDesc')}
                  </div>
                )}
              </div>
            ))
          })()}

        </div>
      )}
    </div>
  )
}
