import { useMemo } from 'react'
import { Finding, RunDetail } from '../api'
import { useI18n } from '../i18n'
import { Page, scoreColor } from '../routing'
import { CenterHero, Icon, KpiCard, MiniBadge, PriorityRow, RightRail, SectionCard, StubBanner, TwoColumnGrid } from './OperationsCenterShell'

type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

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
const SEV_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const SEV_COLORS: Record<string, string> = { CRITICAL: '#DA2C38', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e' }

type PillarStat = { pillar: string; fail: number; pass: number; score: number }

function severityOf(f: Finding): Severity {
  return (f.severity?.toUpperCase() ?? 'LOW') as Severity
}

export default function ArchitectureOperationsCenter({
  run,
  navigate,
}: {
  run: RunDetail | null
  navigate?: (page: Page) => void
}) {
  const { t } = useI18n()

  const failed = useMemo(() => run?.findings.filter(f => f.status?.toUpperCase() === 'FAIL') ?? [], [run])
  const controlsLoaded = run?.controls_meta?.length ?? 0
  const controlsRun = run?.controls_run ?? 0

  const failingModules = useMemo(() => {
    const mods = new Set<string>()
    for (const f of failed) {
      if (f.resource) mods.add(extractModulePath(f.resource))
    }
    return mods.size
  }, [failed])

  const topControls = useMemo(() => {
    const map = new Map<string, { control: string; title: string; count: number; severity: string; resources: number }>()
    for (const f of failed) {
      if (!map.has(f.control_id)) {
        map.set(f.control_id, {
          control: f.control_id,
          title: f.check_title,
          count: 0,
          severity: severityOf(f),
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

  const pillarStats = useMemo<PillarStat[]>(() => {
    const map = new Map<string, PillarStat>()
    for (const f of run?.findings ?? []) {
      const p = f.pillar || t('common.notMapped')
      const cur = map.get(p) ?? { pillar: p, fail: 0, pass: 0, score: 0 }
      if (f.status?.toUpperCase() === 'FAIL') cur.fail++
      else if (f.status?.toUpperCase() === 'PASS') cur.pass++
      map.set(p, cur)
    }
    for (const c of run?.controls_meta ?? []) {
      const p = c.pillar || t('common.notMapped')
      if (!map.has(p)) map.set(p, { pillar: p, fail: 0, pass: 0, score: 0 })
    }
    return [...map.values()]
      .map(p => ({ ...p, score: p.fail + p.pass === 0 ? 0 : Math.round((p.pass / (p.fail + p.pass)) * 100) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 8)
  }, [run, t])

  const criticalCount = useMemo(() => failed.filter(f => severityOf(f) === 'CRITICAL').length, [failed])

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
        title={t('pages.architectureOps.title')}
        subtitle={t('pages.architectureOps.subtitle')}
        accent="#8b5cf6"
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
          </div>
        )}
      </CenterHero>

      <StubBanner
        title={t('pages.architectureOps.stubsInProgress')}
        description={t('pages.architectureOps.stubsVoteRfc')}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <KpiCard
          label={t('pages.architectureOps.controlsLoaded')}
          value={controlsLoaded}
          sub={t('pages.dashboard.controlsLoaded', { count: controlsRun })}
          color="#0094ff"
          icon="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
        />
        <KpiCard
          label={t('pages.architectureOps.failingModules')}
          value={failingModules}
          sub={t('pages.moduleScore.modulesWithFailures')}
          color="#DA2C38"
          icon="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
        />
        <KpiCard
          label={t('pages.architectureOps.criticalFindings')}
          value={criticalCount}
          sub={t('pages.dashboard.critHigh')}
          color="#f97316"
          icon="M13 10V3L4 14h7v7l9-11h-7z"
        />
        <KpiCard
          label={t('pages.architectureOps.attackPaths')}
          value={12}
          sub={t('pages.exploitPaths.criticalPathsSub')}
          color="#8b5cf6"
          icon="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          demo
        />
      </div>

      {!run ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', border: '1px dashed var(--border)', borderRadius: '12px' }}>
          <Icon path="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" size={32} />
          <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', fontWeight: 600 }}>{t('pages.costImpact.noRun')}</div>
        </div>
      ) : (
        <TwoColumnGrid>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', minWidth: 0 }}>
            {/* Pillar health */}
            <SectionCard title={t('pages.dashboard.pillarHealth')} icon="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z">
              {pillarStats.length === 0 ? (
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center', padding: '1rem' }}>{t('common.noData')}</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem' }}>
                  {pillarStats.map((p) => {
                    const isHealthy = p.score >= 80
                    return (
                      <div
                        key={p.pillar}
                        style={{
                          padding: '0.8rem',
                          borderRadius: '10px',
                          background: `var(--surface)`,
                          border: '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.35rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.pillar}</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: scoreColor(p.score) }}>{p.score}%</span>
                        </div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--muted)' }}>
                          {p.pass} pass · {p.fail} fail
                        </div>
                        <div style={{ height: '6px', background: 'var(--bg)', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ width: `${p.score}%`, height: '100%', background: scoreColor(p.score), borderRadius: '999px' }} />
                        </div>
                        <div style={{ fontSize: '0.6rem', color: isHealthy ? '#059669' : '#d97706', fontWeight: 700 }}>
                          {isHealthy ? t('common.health') : t('common.needsAttention')}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
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
          </div>

          <RightRail>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: '0.25rem' }}>
              {t('common.view')}
            </div>
            {linkCard('catalogue', t('nav.items.catalogue'), 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4', '#0094ff')}
            {linkCard('exploitpath', t('nav.items.exploitpath'), 'M13 10V3L4 14h7v7l9-11h-7z', '#DA2C38', !run)}
            {linkCard('blastradius', t('nav.items.blastradius'), 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z', '#8b5cf6', !run)}
            {linkCard('depgraph', t('nav.items.depgraph'), 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-10l6-3m0 13l5.447-2.724A1 1 0 0021 16.382V5.618a1 1 0 00-1.447-.894L15 7m0 13V7', '#f97316', !run)}
            {linkCard('modules', t('nav.items.modules'), 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z', '#22c55e', !run)}
            {linkCard('sandbox', t('nav.items.sandbox'), 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4', '#d97706')}
            {linkCard('reference', t('nav.items.reference'), 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', '#14b8a6')}
          </RightRail>
        </TwoColumnGrid>
      )}
    </div>
  )
}
