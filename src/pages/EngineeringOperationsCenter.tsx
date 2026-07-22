import { useMemo } from 'react'
import { RunDetail, RunSummary } from '../api'
import { useI18n } from '../i18n'
import { Page, scoreColor } from '../routing'
import { CenterHero, Icon, KpiCard, MiniBadge, PriorityRow, RightRail, SectionCard, StubBanner, TwoColumnGrid } from './OperationsCenterShell'

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
const SEV_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const SEV_COLORS: Record<string, string> = { CRITICAL: '#DA2C38', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e' }
const SEV_BG: Record<string, string> = { CRITICAL: '#DA2C3822', HIGH: '#f9731622', MEDIUM: '#eab30822', LOW: '#22c55e22' }

function extractModulePath(resource: string): string {
  if (!resource?.trim()) return '(root)'
  const parts = resource.trim().split('.')
  const segs: string[] = []
  let i = 0
  while (i < parts.length - 1 && parts[i] === 'module') {
    segs.push(`module.${parts[i + 1]}`)
    i += 2
  }
  return segs.length > 0 ? segs.join('.') : '(root)'
}

export default function EngineeringOperationsCenter({
  run,
  runs,
  navigate,
}: {
  run: RunDetail | null
  runs: RunSummary[]
  navigate?: (page: Page) => void
}) {
  const { t } = useI18n()

  const failed = useMemo(() => run?.findings.filter(f => f.status?.toUpperCase() === 'FAIL') ?? [], [run])
  const secretHits = run?.secret_findings?.length ?? 0
  const plan = run?.plan_changes?.summary
  const planTotal = plan ? (plan.add ?? 0) + (plan.change ?? 0) + (plan.destroy ?? 0) + (plan.replace ?? 0) : 0

  const bySeverity = useMemo(() => {
    const counts: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
    for (const f of failed) counts[(f.severity?.toUpperCase() ?? 'LOW') as Severity]++
    return counts
  }, [failed])

  const topControls = useMemo(() => {
    const map = new Map<string, { control: string; title: string; count: number; severity: string; resources: number }>()
    for (const f of failed) {
      if (!map.has(f.control_id)) {
        map.set(f.control_id, {
          control: f.control_id,
          title: f.check_title,
          count: 0,
          severity: f.severity?.toUpperCase() ?? 'LOW',
          resources: 0,
        })
      }
      const entry = map.get(f.control_id)!
      entry.count++
    }
    return [...map.values()]
      .map(e => ({ ...e, resources: new Set(failed.filter(f => f.control_id === e.control).map(f => f.resource)).size }))
      .sort((a, b) => (SEV_ORDER.indexOf(a.severity as Severity) - SEV_ORDER.indexOf(b.severity as Severity)) || b.count - a.count)
      .slice(0, 8)
  }, [failed])

  const topModules = useMemo(() => {
    const map = new Map<string, { path: string; count: number; resources: Set<string> }>()
    for (const f of failed) {
      const path = extractModulePath(f.resource)
      const cur = map.get(path) ?? { path, count: 0, resources: new Set<string>() }
      cur.count++
      if (f.resource) cur.resources.add(f.resource)
      map.set(path, cur)
    }
    return [...map.values()]
      .map(e => ({ ...e, resources: e.resources.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [failed])

  const prevRun = useMemo(() => {
    if (!run) return null
    const sameProject = runs.filter(r => r.project === run.project && r.id !== run.id)
    return sameProject.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null
  }, [run, runs])
  const scoreDelta = run && prevRun ? run.score - prevRun.score : null

  const sprintImpact = useMemo(() => {
    if (!run || failed.length === 0) return { points: 0, effort: 0 }
    const sevWeight: Record<Severity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
    const totalWeight = failed.reduce((s, f) => s + (sevWeight[(f.severity?.toUpperCase() ?? 'LOW') as Severity] ?? 1), 0)
    const points = Math.min(100 - run.score, failed.reduce((s, f) => {
      const w = sevWeight[(f.severity?.toUpperCase() ?? 'LOW') as Severity] ?? 1
      return s + ((100 - run.score) * (w / totalWeight))
    }, 0))
    return { points: Math.round(points * 10) / 10, effort: Math.ceil(failed.length / 3) }
  }, [run, failed])

  const linkCard = (page: Page, label: string, icon: string, color: string, disabled?: boolean) => (
    <button
      key={page}
      onClick={() => navigate && !disabled && navigate(page)}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.9rem 1rem',
        borderRadius: '10px',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'all 0.15s',
        opacity: disabled ? 0.55 : 1,
      }}
      onMouseEnter={(e) => {
        if (disabled) return
        e.currentTarget.style.borderColor = color
        e.currentTarget.style.background = `${color}10`
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.background = 'var(--surface)'
      }}
    >
      <div style={{ color, flexShrink: 0 }}><Icon path={icon} size={20} /></div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>{label}</div>
        <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{disabled ? t('pages.costImpact.noRun') : `${t('common.view')} →`}</div>
      </div>
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <CenterHero
        eyebrow="Operations Center"
        title={t('pages.engineeringOps.title')}
        subtitle={t('pages.engineeringOps.subtitle')}
        accent="#22c55e"
      >
        {run && (
          <div style={{ textAlign: 'right', minWidth: '160px' }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.15rem' }}>
              {t('pages.dashboard.infrastructureScan')}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '1.6rem', fontWeight: 800, color: scoreColor(run.score) }}>{run.score}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>/100</span>
            </div>
            {scoreDelta !== null && (
              <div style={{ fontSize: '0.72rem', color: scoreDelta >= 0 ? '#059669' : '#DA2C38' }}>
                {scoreDelta >= 0 ? '+' : ''}{scoreDelta} {t('pages.changes.scoreDelta')}
              </div>
            )}
          </div>
        )}
      </CenterHero>

      <StubBanner
        title={t('pages.engineeringOps.stubsInProgress')}
        description={t('pages.engineeringOps.stubsVoteRfc')}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <KpiCard
          label={t('pages.engineeringOps.openFindings')}
          value={failed.length}
          sub={t('pages.dashboard.failedControls')}
          color="#DA2C38"
          icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
        <KpiCard
          label={t('pages.engineeringOps.secretHits')}
          value={secretHits}
          sub={t('pages.secretScan.secretsIssue')}
          color="#f97316"
          icon="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
        <KpiCard
          label={t('pages.engineeringOps.planChanges')}
          value={planTotal}
          sub={t('pages.changes.infraChanges')}
          color="#0094ff"
          icon="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
        />
        <KpiCard
          label={t('pages.engineeringOps.sprintGain')}
          value={`+${sprintImpact.points}`}
          sub={t('pages.remediation.sprintImpact')}
          color="#8b5cf6"
          icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
          demo
        />
      </div>

      {!run ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', border: '1px dashed var(--border)', borderRadius: '12px' }}>
          <Icon path="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" size={32} />
          <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', fontWeight: 600 }}>{t('pages.costImpact.noRun')}</div>
        </div>
      ) : (
        <TwoColumnGrid>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', minWidth: 0 }}>
            {/* Severity breakdown */}
            <SectionCard title={t('pages.dashboard.failuresBySeverity')} icon="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.6rem' }}>
                {SEV_ORDER.map((sev) => (
                  <div
                    key={sev}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '10px',
                      background: SEV_BG[sev],
                      border: `1px solid ${SEV_COLORS[sev]}30`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.2rem',
                    }}
                  >
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, color: SEV_COLORS[sev], textTransform: 'uppercase' }}>{sev}</span>
                    <span style={{ fontSize: '1.35rem', fontWeight: 800, color: SEV_COLORS[sev] }}>{bySeverity[sev]}</span>
                    <span style={{ fontSize: '0.62rem', color: 'var(--muted)' }}>
                      {failed.length ? Math.round((bySeverity[sev] / failed.length) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Top failing controls */}
            <SectionCard
              title={t('pages.dashboard.requiresAttention')}
              icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              action={
                <button onClick={() => navigate?.('findings')} style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--waf-brand)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  {t('common.view')} →
                </button>
              }
            >
              {topControls.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center', padding: '1rem' }}>{t('pages.remediation.allPassing')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {topControls.map((c) => (
                    <PriorityRow
                      key={c.control}
                      label={c.title || c.control}
                      count={c.count}
                      total={failed.length}
                      color={SEV_COLORS[c.severity]}
                      meta={`${c.resources} res · ${c.severity}`}
                      badge={<MiniBadge color={SEV_COLORS[c.severity]}>{c.severity}</MiniBadge>}
                    />
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Top modules */}
            <SectionCard title={t('pages.moduleScore.modulesWithFailures')} icon="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z">
              {topModules.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center', padding: '1rem' }}>{t('pages.moduleScore.noTopIssues')}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {topModules.map((m) => (
                    <PriorityRow
                      key={m.path}
                      label={m.path}
                      count={m.count}
                      total={failed.length}
                      color="#DA2C38"
                      meta={`${m.resources} resources affected`}
                    />
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <RightRail>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: '0.25rem' }}>
              {t('common.view')}
            </div>
            {linkCard('findings', t('nav.items.findings'), 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', '#DA2C38', !run)}
            {linkCard('remediation', t('nav.items.remediation'), 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', '#8b5cf6', !run)}
            {linkCard('secrets', t('nav.items.secrets'), 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', '#f97316', !run)}
            {linkCard('changes', t('nav.items.changes'), 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4', '#0094ff', !run)}
          </RightRail>
        </TwoColumnGrid>
      )}
    </div>
  )
}
