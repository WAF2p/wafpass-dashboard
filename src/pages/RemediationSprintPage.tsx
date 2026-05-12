/**
 * RemediationSprintPage — interactive sprint planner for failing controls.
 *
 * Prioritises controls by ROI = score_impact × (1 + 0.3 × framework_count) / effort.
 * Score gain estimate: each failing control is responsible for a share of the
 * current deficit proportional to its severity weight.
 * Framework gap = a regulatory framework where every currently-failing mapped
 * control has been added to the sprint.
 *
 * Sprint selection is persisted to localStorage keyed by run.id.
 */

import { useState, useMemo, useEffect } from 'react'
import { RunDetail, ControlMeta, getApiBase, getAccessToken } from '../api'
import { useI18n } from '../i18n'

interface Props { run: RunDetail }

// ── Constants ────────────────────────────────────────────────────────────────
const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#DA2C38', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e',
}
const SEV_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
const EFFORT_COLOR = { Low: '#22c55e', Medium: '#f97316', High: '#DA2C38' }

// ── Data model ───────────────────────────────────────────────────────────────
interface FailingCtrl {
  id: string
  title: string
  pillar: string
  severity: string               // uppercase
  category: string
  description: string
  checkCount: number             // distinct failing check_ids
  failResCount: number           // distinct failing resource addresses
  frameworks: string[]           // unique framework names from regulatory_mapping
  frameworkMappings: ControlMeta['regulatory_mapping']
  effort: 'Low' | 'Medium' | 'High'
  effortScore: number            // 1 | 2 | 3
  pointsGain: number             // estimated score gain (rounded to 1 dp)
  roi: number                    // sort key
  remediations: string[]         // up to 3 unique remediation texts
}

interface SprintImpact {
  projectedScore: number
  pointsGain: number
  resourcesFixed: number
  closedFrameworks: string[]     // frameworks where ALL failing controls are in sprint
  touchedFrameworks: string[]    // any framework touched by sprint
  effortTotal: number            // sum effortScore
  effortLabel: string
}

// ── Computation ───────────────────────────────────────────────────────────────

function buildFailingControls(run: RunDetail): FailingCtrl[] {
  const failFindings = run.findings.filter(f => f.status?.toUpperCase() === 'FAIL')
  if (failFindings.length === 0) return []

  // Group findings by control_id
  const byCtrl = new Map<string, typeof failFindings>()
  for (const f of failFindings) {
    if (!f.control_id) continue
    const arr = byCtrl.get(f.control_id) ?? []; arr.push(f); byCtrl.set(f.control_id, arr)
  }

  // Build a meta lookup (may be empty on some server versions)
  const metaById = new Map(run.controls_meta.map(c => [c.id, c]))

  // Total severity weight of ALL failing controls (for proportional score estimate)
  const totalFailSevWeight = [...byCtrl.keys()].reduce((sum, cid) => {
    const meta = metaById.get(cid)
    const sev = (meta?.severity ?? byCtrl.get(cid)![0]?.severity ?? 'low').toUpperCase()
    return sum + (SEV_RANK[sev] ?? 1)
  }, 0) || 1

  const maxRecoverable = 100 - run.score

  const controls: FailingCtrl[] = []

  for (const [cid, ff] of byCtrl) {
    const meta = metaById.get(cid)
    const sev  = (meta?.severity ?? ff[0]?.severity ?? 'low').toUpperCase()
    const sevWeight = SEV_RANK[sev] ?? 1

    const checkCount   = new Set(ff.map(f => f.check_id).filter(Boolean)).size
    const failResCount = new Set(ff.map(f => f.resource).filter(Boolean)).size

    // Effort: based on total work = failing resources + failing checks
    const work = failResCount + checkCount
    const effort: FailingCtrl['effort'] = work <= 3 ? 'Low' : work <= 9 ? 'Medium' : 'High'
    const effortScore = effort === 'Low' ? 1 : effort === 'Medium' ? 2 : 3

    const frameworkMappings = meta?.regulatory_mapping ?? []
    const frameworks = [...new Set(frameworkMappings.map(m => m.framework))]

    const pointsGain = Math.round((sevWeight / totalFailSevWeight) * maxRecoverable * 10) / 10

    // ROI: higher is better – rewards high impact, many frameworks, low effort
    const roi = (pointsGain * (1 + frameworks.length * 0.35)) / effortScore

    // Unique remediation texts (at most 3)
    const remediations = [...new Set(ff.map(f => f.remediation).filter(Boolean))].slice(0, 3)

    controls.push({
      id: cid,
      title:       meta?.title ?? ff[0]?.check_title ?? cid,
      pillar:      (meta?.pillar  ?? ff[0]?.pillar  ?? '').toLowerCase(),
      severity:    sev,
      category:    meta?.category ?? '',
      description: meta?.description ?? '',
      checkCount, failResCount, frameworks, frameworkMappings,
      effort, effortScore, pointsGain, roi, remediations,
    })
  }

  // Default order: ROI descending
  return controls.sort((a, b) => b.roi - a.roi)
}

// ── Component ─────────────────────────────────────────────────────────────────

function computeSprintImpact(
  sprint: FailingCtrl[],
  all: FailingCtrl[],
  currentScore: number,
): SprintImpact {
  if (sprint.length === 0) return {
    projectedScore: currentScore, pointsGain: 0, resourcesFixed: 0,
    closedFrameworks: [], touchedFrameworks: [], effortTotal: 0, effortLabel: '—',
  }

  const sprintSet  = new Set(sprint.map(c => c.id))
  const pointsGain = sprint.reduce((s, c) => s + c.pointsGain, 0)
  const projectedScore  = Math.min(100, Math.round((currentScore + pointsGain) * 10) / 10)
  const resourcesFixed  = sprint.reduce((s, c) => s + c.failResCount, 0)
  const effortTotal     = sprint.reduce((s, c) => s + c.effortScore, 0)
  const effortLabel     = effortTotal <= 2 ? 'Low' : effortTotal <= 5 ? 'Medium' : 'High'

  const fwToFailing = new Map<string, Set<string>>()
  for (const ctrl of all) {
    for (const m of ctrl.frameworkMappings) {
      const s = fwToFailing.get(m.framework) ?? new Set()
      s.add(ctrl.id); fwToFailing.set(m.framework, s)
    }
  }

  const closedFrameworks  = [...fwToFailing.entries()]
    .filter(([, ids]) => [...ids].every(id => sprintSet.has(id)))
    .map(([fw]) => fw)
  const touchedFrameworks = [...new Set(sprint.flatMap(c => c.frameworks))]

  return {
    projectedScore,
    pointsGain: Math.round(pointsGain * 10) / 10,
    resourcesFixed,
    closedFrameworks,
    touchedFrameworks,
    effortTotal,
    effortLabel,
  }
}

// placeholder to be replaced – see above

type SortKey = 'roi' | 'points' | 'effort' | 'severity' | 'frameworks'

export default function RemediationSprintPage({ run }: Props) {
  const { t } = useI18n()
  const storageKey = `wafpass_sprint_${run.id}`

  const [sprintIds, setSprintIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(storageKey) ?? '[]') as string[]) }
    catch { return new Set() }
  })
  const [sortBy,       setSortBy]       = useState<SortKey>('roi')
  const [pillarFilter, setPillarFilter] = useState('')
  const [sevFilter,    setSevFilter]    = useState('')
  const [effortFilter, setEffortFilter] = useState('')
  const [expanded,     setExpanded]     = useState<string | null>(null)

  // Persist sprint
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify([...sprintIds])) } catch {}
  }, [sprintIds, storageKey])

  // ── Export handlers ────────────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false)
  const apiBase = getApiBase()
  const authHeaders: Record<string, string> = getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}

  const handleExportCsv = async () => {
    if (sprintIds.size === 0) return
    const sprintList = [...sprintIds].join(',')
    const url = `${apiBase}/runs/${run.id}/export/csv?sprint=${encodeURIComponent(sprintList)}`
    try {
      setIsExporting(true)
      const response = await fetch(url, { headers: authHeaders })
      if (!response.ok) throw new Error(`Export failed: ${response.status}`)
      const blob = await response.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.setAttribute('download', `remediation_sprint_${run.project.replace(/ /g, '_')}_${run.created_at?.split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportJira = async () => {
    if (sprintIds.size === 0) return
    const sprintList = [...sprintIds].join(',')
    const url = `${apiBase}/runs/${run.id}/export/jira?sprint=${encodeURIComponent(sprintList)}`
    try {
      setIsExporting(true)
      const response = await fetch(url, { headers: authHeaders })
      if (!response.ok) throw new Error(`Export failed: ${response.status}`)
      const blob = await response.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.setAttribute('download', `jira_issues_${run.project.replace(/ /g, '_')}_${run.created_at?.split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportSlack = async () => {
    if (sprintIds.size === 0) return
    const sprintList = [...sprintIds].join(',')
    const url = `${apiBase}/runs/${run.id}/export/slack`
    try {
      setIsExporting(true)
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ sprint: sprintList }),
      })
      if (!response.ok) throw new Error(`Export failed: ${response.status}`)
      const data = await response.json() as { text: string; preview: string; control_count: string; project: string; run_id: string }
      // Show message in a simple modal for sharing
      const textArea = document.createElement('textarea')
      textArea.value = data.text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      alert('Slack/Teams message text copied to clipboard! You can paste it into your message.')
    } finally {
      setIsExporting(false)
    }
  }

  const allControls = useMemo(() => buildFailingControls(run), [run])

  const pillars = useMemo(
    () => [...new Set(allControls.map(c => c.pillar).filter(Boolean))].sort(),
    [allControls]
  )

  const backlog = useMemo(() => {
    let list = allControls.filter(c => !sprintIds.has(c.id))
    if (pillarFilter) list = list.filter(c => c.pillar === pillarFilter)
    if (sevFilter)    list = list.filter(c => c.severity === sevFilter)
    if (effortFilter) list = list.filter(c => c.effort === effortFilter)
    return [...list].sort((a, b) => {
      if (sortBy === 'roi')       return b.roi       - a.roi
      if (sortBy === 'points')    return b.pointsGain - a.pointsGain
      if (sortBy === 'effort')    return a.effortScore - b.effortScore
      if (sortBy === 'severity')  return (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0)
      if (sortBy === 'frameworks') return b.frameworks.length - a.frameworks.length
      return 0
    })
  }, [allControls, sprintIds, pillarFilter, sevFilter, effortFilter, sortBy])

  const sprintControls = useMemo(
    () => allControls.filter(c => sprintIds.has(c.id)),
    [allControls, sprintIds]
  )

  const impact = useMemo(
    () => computeSprintImpact(sprintControls, allControls, run.score),
    [sprintControls, allControls, run.score]
  )

  function addToSprint(id: string)    { setSprintIds(s => new Set([...s, id])) }
  function removeFromSprint(id: string){ setSprintIds(s => { const n = new Set(s); n.delete(id); return n }) }
  function clearSprint()               { setSprintIds(new Set()) }

  function addTopN(n: number) {
    const top = backlog.slice(0, n).map(c => c.id)
    setSprintIds(s => new Set([...s, ...top]))
  }

  function addBySeverity(sev: string) {
    const ids = allControls.filter(c => c.severity === sev && !sprintIds.has(c.id)).map(c => c.id)
    setSprintIds(s => new Set([...s, ...ids]))
  }

  if (allControls.length === 0) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--muted)' }}>
        <svg width="52" height="52" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.25 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{t('pages.remediation.noFailing')}</div>
        <div style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>{t('pages.remediation.allPassing')}</div>
      </div>
    )
  }

  const scoreColor = (s: number) => s >= 80 ? '#059669' : s >= 60 ? '#d97706' : '#DA2C38'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Quick-add bar ── */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('pages.remediation.quickAdd')}:</span>
        <button onClick={() => addTopN(5)}
          style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}>
          {t('pages.remediation.top5roi')}
        </button>
        {(['CRITICAL', 'HIGH'] as const).map(s => (
          allControls.some(c => c.severity === s) && (
            <button key={s} onClick={() => addBySeverity(s)}
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', borderRadius: '8px', border: `1px solid ${SEV_COLOR[s]}50`, background: `${SEV_COLOR[s]}12`, color: SEV_COLOR[s], cursor: 'pointer', fontWeight: 700 }}>
              All {s}
            </button>
          )
        ))}
        {sprintIds.size > 0 && (
          <button onClick={clearSprint}
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', cursor: 'pointer', marginLeft: 'auto' }}>
            {t('pages.remediation.clearSprint')}
          </button>
        )}
      </div>

      {/* ── Main two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1rem', alignItems: 'start' }}>

        {/* ── LEFT: Backlog ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

          {/* Backlog header + filters */}
          <div className="card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('pages.remediation.backlog', { count: backlog.length })}
            </span>

            <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Sort */}
              <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} className="filter-select" style={{ fontSize: '0.75rem' }}>
                <option value="roi">{t('pages.remediation.sortRoi')}</option>
                <option value="points">{t('pages.remediation.sortPoints')}</option>
                <option value="severity">{t('pages.remediation.sortSeverity')}</option>
                <option value="effort">{t('pages.remediation.sortEffort')}</option>
                <option value="frameworks">{t('pages.remediation.sortFrameworks')}</option>
              </select>
              {/* Filters */}
              <select value={pillarFilter} onChange={e => setPillarFilter(e.target.value)} className="filter-select" style={{ fontSize: '0.75rem' }}>
                <option value="">All pillars</option>
                {pillars.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={sevFilter} onChange={e => setSevFilter(e.target.value)} className="filter-select" style={{ fontSize: '0.75rem' }}>
                <option value="">{t('pages.findings.allSeverities')}</option>
                {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={effortFilter} onChange={e => setEffortFilter(e.target.value)} className="filter-select" style={{ fontSize: '0.75rem' }}>
                <option value="">{t('pages.remediation.allEffort')}</option>
                <option value="Low">{t('pages.remediation.lowEffort')}</option>
                <option value="Medium">{t('pages.remediation.mediumEffort')}</option>
                <option value="High">{t('pages.remediation.highEffort')}</option>
              </select>
              {(pillarFilter || sevFilter || effortFilter) && (
                <button onClick={() => { setPillarFilter(''); setSevFilter(''); setEffortFilter('') }}
                  style={{ fontSize: '0.72rem', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem 0.4rem' }}>
                  {t('pages.remediation.clearFilters')}
                </button>
              )}
            </div>
          </div>

          {/* Control cards */}
          {backlog.length === 0 ? (
            <div className="card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)' }}>
              {sprintIds.size === allControls.length
                ? t('pages.remediation.allInSprint')
                : t('pages.remediation.noMatch')}
            </div>
          ) : (
            backlog.map(ctrl => (
              <ControlCard
                key={ctrl.id}
                ctrl={ctrl}
                inSprint={false}
                expanded={expanded === ctrl.id}
                onExpand={() => setExpanded(expanded === ctrl.id ? null : ctrl.id)}
                onAction={() => addToSprint(ctrl.id)}
              />
            ))
          )}
        </div>

        {/* ── RIGHT: Sprint + impact ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', position: 'sticky', top: '1rem' }}>

          {/* Impact projection card */}
          <div className="card" style={{ padding: '1.25rem', background: sprintControls.length > 0 ? 'linear-gradient(135deg, #0b1220 0%, #0f1e3a 100%)' : undefined, border: sprintControls.length > 0 ? '1px solid #0094FF40' : undefined }}>
            {sprintControls.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.4rem' }}>{t('pages.remediation.sprintImpact')}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                  {t('pages.remediation.sprintImpactHint')}
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', marginBottom: '0.75rem' }}>
                  {t('pages.remediation.sprintImpactProjection')}
                </div>

                {/* Score gauge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', marginBottom: '1rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: scoreColor(run.score), lineHeight: 1 }}>{run.score}</div>
                    <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('pages.remediation.current')}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                    <svg width="32" height="14" viewBox="0 0 32 14">
                      <line x1="0" y1="7" x2="24" y2="7" stroke="#0094FF" strokeWidth="2" />
                      <polygon points="24,3 32,7 24,11" fill="#0094FF" />
                    </svg>
                    <span style={{ fontSize: '0.65rem', color: '#0094FF', fontWeight: 700 }}>+{impact.pointsGain} pts</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: scoreColor(impact.projectedScore), lineHeight: 1 }}>{impact.projectedScore}</div>
                    <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('pages.remediation.projected')}</div>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ height: '6px', borderRadius: '999px', background: '#1e293b', overflow: 'hidden', marginBottom: '1rem' }}>
                  <div style={{ height: '100%', borderRadius: '999px', background: `linear-gradient(90deg, ${scoreColor(run.score)}, ${scoreColor(impact.projectedScore)})`, width: `${impact.projectedScore}%`, transition: 'width 0.4s' }} />
                </div>

                {/* Metrics grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.875rem' }}>
                  {[
                    { label: t('pages.remediation.metricControls'), value: String(sprintControls.length), sub: t('pages.remediation.metricInSprint') },
                    { label: t('pages.remediation.metricResources'), value: String(impact.resourcesFixed), sub: t('pages.remediation.metricToFix') },
                    { label: t('pages.remediation.metricFrameworks'), value: String(impact.touchedFrameworks.length), sub: t('pages.remediation.metricAddressed') },
                    { label: t('pages.remediation.metricGapsClosed'), value: String(impact.closedFrameworks.length), sub: t('pages.remediation.metricFullyResolved') },
                  ].map(m => (
                    <div key={m.label} style={{ background: '#0f1e3a', borderRadius: '8px', padding: '0.5rem 0.625rem', border: '1px solid #1e3a5f' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{m.value}</div>
                      <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '0.15rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
                      <div style={{ fontSize: '0.6rem', color: '#475569' }}>{m.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Effort */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                  <span style={{ color: '#64748b' }}>{t('pages.remediation.sprintEffort')}</span>
                  <span style={{ fontWeight: 700, color: EFFORT_COLOR[impact.effortLabel as keyof typeof EFFORT_COLOR] ?? '#64748b' }}>
                    {impact.effortLabel}
                  </span>
                </div>

                {/* Closed frameworks list */}
                {impact.closedFrameworks.length > 0 && (
                  <div style={{ marginTop: '0.75rem', padding: '0.625rem', background: '#0a1628', borderRadius: '8px', border: '1px solid #22c55e30' }}>
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
                      {t('pages.remediation.fullyClosing')}
                    </div>
                    {impact.closedFrameworks.map(fw => (
                      <div key={fw} style={{ fontSize: '0.7rem', color: '#86efac', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
                        <span style={{ color: '#22c55e', fontWeight: 700 }}>✓</span> {fw}
                      </div>
                    ))}
                  </div>
                )}

                {/* Export buttons */}
                {sprintControls.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #1e3a5f' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', marginBottom: '0.5rem' }}>
                      {t('pages.remediation.exportLabel')}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <button
                        onClick={handleExportCsv}
                        disabled={isExporting}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          padding: '0.5rem 0.75rem', borderRadius: '8px',
                          border: '1px solid #0094FF', background: '#0094FF1A',
                          color: '#0094FF', cursor: isExporting ? 'not-allowed' : 'pointer',
                          fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.2s',
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h18v18H3V3zm0 18h18M3 12h18" />
                        </svg>
                        {t('pages.remediation.exportCsv')}
                      </button>
                      <button
                        onClick={handleExportJira}
                        disabled={isExporting}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          padding: '0.5rem 0.75rem', borderRadius: '8px',
                          border: '1px solid #f59e0b', background: '#f59e0b1A',
                          color: '#f59e0b', cursor: isExporting ? 'not-allowed' : 'pointer',
                          fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.2s',
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="8" cy="8" r="3" />
                          <path d="M2 12h6m4 0h6m-4 4v-4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {t('pages.remediation.exportJira')}
                      </button>
                      <button
                        onClick={handleExportSlack}
                        disabled={isExporting}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          padding: '0.5rem 0.75rem', borderRadius: '8px',
                          border: '1px solid #22c55e', background: '#22c55e1A',
                          color: '#22c55e', cursor: isExporting ? 'not-allowed' : 'pointer',
                          fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.2s',
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                          <path d="M10 9l-4 5 4 5" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M14 9l4 5-4 5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {t('pages.remediation.exportSlack')}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sprint control list */}
          {sprintControls.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', maxHeight: '480px', overflowY: 'auto' }}>
              <div style={{ padding: '0.625rem 0.875rem', borderBottom: '1px solid var(--border)', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {t('pages.remediation.sprintHeader', { count: sprintControls.length })}
              </div>
              {sprintControls.map(ctrl => (
                <div key={ctrl.id} style={{ padding: '0.625rem 0.875rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.625rem', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', flexShrink: 0 }}>{ctrl.id}</span>
                      <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '999px', background: `${SEV_COLOR[ctrl.severity]}22`, color: SEV_COLOR[ctrl.severity], flexShrink: 0 }}>
                        {ctrl.severity}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ctrl.title}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>
                      +{ctrl.pointsGain} pts · {ctrl.frameworks.length} fw · {t('pages.remediation.effortBadge', { effort: ctrl.effort })}
                    </div>
                  </div>
                  <button onClick={() => removeFromSprint(ctrl.id)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.1rem', lineHeight: 1, padding: '0.1rem', flexShrink: 0 }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Backlog control card ───────────────────────────────────────────────────────
function ControlCard({
  ctrl, inSprint, expanded, onExpand, onAction,
}: {
  ctrl: FailingCtrl
  inSprint: boolean
  expanded: boolean
  onExpand: () => void
  onAction: () => void
}) {
  const { t } = useI18n()
  const sevCol  = SEV_COLOR[ctrl.severity] ?? '#64748b'
  const effCol  = EFFORT_COLOR[ctrl.effort]

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', border: inSprint ? `1px solid #0094FF40` : undefined }}>
      {/* Main row */}
      <div style={{ padding: '0.75rem 1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>

        {/* Add button */}
        <button onClick={onAction}
          title={inSprint ? t('pages.remediation.removeFromSprint') : t('pages.remediation.addToSprint')}
          style={{
            flexShrink: 0, width: '28px', height: '28px', borderRadius: '8px', cursor: 'pointer',
            border: inSprint ? '1px solid #0094FF' : '1px solid var(--border)',
            background: inSprint ? '#0094FF' : 'var(--bg)',
            color: inSprint ? '#fff' : 'var(--muted)',
            fontSize: '1.1rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700,
          }}>
          {inSprint ? '✓' : '+'}
        </button>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 700, flexShrink: 0 }}>{ctrl.id}</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text)', flex: 1, minWidth: 0 }}>{ctrl.title}</span>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.12rem 0.45rem', borderRadius: '999px', background: `${sevCol}20`, color: sevCol, flexShrink: 0 }}>
              {ctrl.severity}
            </span>
          </div>

          {/* Metadata row */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem', fontSize: '0.72rem', color: 'var(--muted)' }}>
            {ctrl.pillar && <span style={{ textTransform: 'capitalize' }}>{ctrl.pillar}</span>}
            {ctrl.category && <span style={{ color: 'var(--border)' }}>·</span>}
            {ctrl.category && <span>{ctrl.category}</span>}
            <span style={{ color: 'var(--border)' }}>·</span>
            <span>{ctrl.failResCount} resource{ctrl.failResCount !== 1 ? 's' : ''}</span>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span>{ctrl.checkCount} check{ctrl.checkCount !== 1 ? 's' : ''}</span>
          </div>

          {/* Metrics row */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Score bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: '120px' }}>
              <div style={{ flex: 1, height: '5px', borderRadius: '999px', background: 'var(--bg)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '999px', background: '#0094FF', width: `${Math.min(100, ctrl.pointsGain * 5)}%` }} />
              </div>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#0094FF', whiteSpace: 'nowrap' }}>~{ctrl.pointsGain} pts</span>
            </div>
            {/* Framework badge */}
            <span style={{ fontSize: '0.68rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
              {ctrl.frameworks.length > 0 ? `${ctrl.frameworks.length} framework${ctrl.frameworks.length !== 1 ? 's' : ''}` : t('pages.remediation.noFrameworks')}
            </span>
            {/* Effort badge */}
            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: '999px', background: `${effCol}18`, color: effCol, border: `1px solid ${effCol}35`, whiteSpace: 'nowrap' }}>
              {t('pages.remediation.effortBadge', { effort: ctrl.effort })}
            </span>
          </div>
        </div>

        {/* Expand chevron */}
        {(ctrl.description || ctrl.remediations.length > 0 || ctrl.frameworks.length > 0) && (
          <button onClick={onExpand}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '0.25rem', flexShrink: 0, marginTop: '2px' }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={expanded ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
            </svg>
          </button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: '0 1rem 0.875rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '0.75rem' }}>

          {ctrl.description && (
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>{t('pages.remediation.description')}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.55 }}>{ctrl.description}</div>
            </div>
          )}

          {ctrl.remediations.length > 0 && (
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>{t('pages.remediation.remediationSteps')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {ctrl.remediations.map((r, i) => (
                  <div key={i} style={{ fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.55, padding: '0.5rem 0.75rem', background: 'var(--bg)', borderRadius: '8px', borderLeft: '3px solid #0094FF' }}>
                    {r}
                  </div>
                ))}
              </div>
            </div>
          )}

          {ctrl.frameworks.length > 0 && (
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>{t('pages.remediation.regulatoryMapping')}</div>
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                {ctrl.frameworks.map(fw => (
                  <span key={fw} style={{ fontSize: '0.68rem', padding: '0.2rem 0.55rem', borderRadius: '6px', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                    {fw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
