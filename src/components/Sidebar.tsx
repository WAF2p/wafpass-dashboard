import { useEffect, useState } from 'react'
import { RunDetail, RunSummary, getActiveControlPack } from '../api'
import { hasMinRole } from '../AuthContext'
import { getMaturityMeta, Settings } from '../pages/settingsUtils'
import { Page, scoreColor } from '../routing'
import { useI18n } from '../i18n'

export interface SidebarProps {
  run: RunDetail | null
  runs: RunSummary[]
  runsError: string | null
  page: Page
  role: string
  user: { username: string; display_name: string; role: string }
  maturityLevel: number
  settings: Settings
  hideDisabledMenuItems: boolean
  waiverCount: number
  riskCount: number
  failCount: number
  navigate: (page: Page) => void
  onShowRunModal: () => void
  onOpenUserPrefs: () => void
  onLogout: () => Promise<void>
}

type NavEntry = {
  page: Page
  label: string
  icon: string
  gate?: boolean
  danger?: boolean
  badge?: { label: string; variant: 'fail' | 'neutral' } | null
  count?: number
}

type NavSection = {
  id: string
  label: string
  color: string
  items: NavEntry[]
  minRole?: string
}

function buildNavSections(
  run: RunDetail | null,
  runs: RunSummary[],
  settings: Settings,
  waiverCount: number,
  riskCount: number,
  failCount: number,
  t: (key: string) => string,
): NavSection[] {
  return [
    {
      id: 'projects', label: t('nav.sections.journey'), color: '#14b8a6', minRole: 'clevel',
      items: [
        { page: 'passports',   label: t('nav.items.passports'),   icon: 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2' },
        { page: 'badge',       label: t('nav.items.badge'),       icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
        { page: 'leaderboard', label: t('nav.items.leaderboard'), icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
        { page: 'journey',     label: t('nav.items.journey'),     icon: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8' },
      ],
    },
    {
      id: 'clevel', label: t('nav.sections.clevel'), color: '#f59e0b',
      items: [
        { page: 'dashboard',   label: t('nav.items.dashboard'),  icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
        { page: 'compliance',  label: t('nav.items.compliance'), icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
        {
          page: 'cost', label: t('nav.items.cost'),
          gate: (settings.activePillars ?? []).includes('cost'),
          icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
          badge: (() => {
            if (!run) return null
            const n = run.findings.filter(f => f.pillar?.toLowerCase() === 'cost' && f.status?.toUpperCase() === 'FAIL').length
            return n > 0 ? { label: String(n), variant: 'fail' as const } : null
          })(),
        },
        {
          page: 'gapanalysis', label: t('nav.items.gapanalysis'),
          icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
          badge: (() => {
            if (!run) return null
            const n = new Set(run.findings.filter(f => f.status?.toUpperCase() === 'FAIL').map(f => f.control_id)).size
            return n > 0 ? { label: String(n), variant: 'fail' as const } : null
          })(),
        },
      ],
    },
    {
      id: 'ciso', label: t('nav.sections.ciso'), color: '#0094ff',
      items: [
        { page: 'risk',     label: t('nav.items.risk'),    count: riskCount,    icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
        { page: 'waivers',  label: t('nav.items.waivers'), count: waiverCount,  icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
        {
          page: 'skipped', label: t('nav.items.skipped'),
          icon: 'M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z',
          count: run ? (() => {
            const active = new Set(run.findings.filter(f => { const s = f.status?.toUpperCase(); return s === 'PASS' || s === 'FAIL' }).map(f => f.control_id))
            return run.controls_meta.filter(c => !active.has(c.id)).length
          })() : undefined,
        },
        { page: 'audit',    label: t('nav.items.audit'),   icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
        { page: 'evidence', label: t('nav.items.evidence'), gate: settings.evidenceCollection, icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
        { page: 'regions',  label: t('nav.items.regions'),  icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      ],
    },
    {
      id: 'architect', label: t('nav.sections.architect'), color: '#8b5cf6',
      items: [
        {
          page: 'catalogue', label: t('nav.items.catalogue'),
          icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',
          badge: { label: run ? String(run.controls_meta.length || run.controls_loaded || 0) : '73+', variant: 'neutral' as const },
        },
        { page: 'exploitpath', label: t('nav.items.exploitpath'), danger: true, icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
        {
          page: 'blastradius', label: t('nav.items.blastradius'),
          gate: settings.blastRadius,
          icon: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z',
          badge: run ? { label: String(new Set(run.findings.filter(f => f.status?.toUpperCase() === 'FAIL').map(f => f.resource).filter(Boolean)).size), variant: 'fail' as const } : null,
        },
        {
          page: 'depgraph', label: t('nav.items.depgraph'),
          gate: settings.dependencyGraph,
          icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-10l6-3m0 13l5.447-2.724A1 1 0 0021 16.382V5.618a1 1 0 00-1.447-.894L15 7m0 13V7',
          badge: run ? { label: String(new Set(run.findings.map(f => f.resource).filter(Boolean)).size), variant: 'neutral' as const } : null,
        },
        {
          page: 'modules', label: t('nav.items.modules'),
          icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
          badge: (() => {
            if (!run) return null
            const paths = new Set(run.findings.map(f => {
              if (!f.resource?.startsWith('module.')) return '(root)'
              const p = f.resource.split('.')
              const s: string[] = []
              let i = 0
              while (i < p.length - 1 && p[i] === 'module') { s.push(`module.${p[i + 1]}`); i += 2 }
              return s.join('.') || '(root)'
            }))
            return { label: String(paths.size), variant: 'neutral' as const }
          })(),
        },
        {
          page: 'changes', label: t('nav.items.changes'),
          gate: settings.driftDetection,
          icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
          badge: (() => {
            if (!run?.plan_changes) return null
            const total = (run.plan_changes.summary.add ?? 0) + (run.plan_changes.summary.change ?? 0) + (run.plan_changes.summary.destroy ?? 0) + (run.plan_changes.summary.replace ?? 0)
            if (total === 0) return null
            const hasSec = run.plan_changes.changes.some(c => {
              const b = (c.before ?? {}) as Record<string, unknown>
              const a = (c.after ?? {}) as Record<string, unknown>
              return ['policy', 'assume_role_policy', 'ingress', 'egress', 'cidr_blocks', 'encryption_configuration', 'kms_key_id', 'kms_key_arn', 'acl'].some(k => JSON.stringify(b[k] ?? null) !== JSON.stringify(a[k] ?? null))
            })
            return { label: String(total), variant: (hasSec ? 'fail' : 'neutral') as 'fail' | 'neutral' }
          })(),
        },
        { page: 'sandbox', label: t('nav.items.sandbox'), icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
      ],
    },
    {
      id: 'engineer', label: t('nav.sections.engineer'), color: '#22c55e',
      items: [
        {
          page: 'findings', label: t('nav.items.findings'),
          icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
          badge: failCount > 0 ? { label: String(failCount), variant: 'fail' as const } : null,
        },
        {
          page: 'secrets', label: t('nav.items.secrets'),
          gate: settings.secretScanner,
          danger: true,
          icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
          badge: (() => {
            if (!run) return null
            const SECRET_RE = [/hardcod/i, /plaintext/i, /no.hardcoded/i, /secret/i, /credential/i, /password/i, /api[_.\s-]?key/i, /private[_.\s-]?key/i, /access[_.\s-]?key/i, /token/i, /kms/i, /encrypt/i, /rotation/i]
            const n = run.findings.filter(f => f.status?.toUpperCase() === 'FAIL' && SECRET_RE.some(re => re.test([f.control_id, f.check_id, f.check_title, f.message].join(' ')))).length
            return n > 0 ? { label: String(n), variant: 'fail' as const } : null
          })(),
        },
        { page: 'remediation', label: t('nav.items.remediation'), icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
      ],
    },
    {
      id: 'runs_nav', label: t('nav.sections.runs'), color: '#22c55e', minRole: 'engineer',
      items: [
        { page: 'runscan', label: t('nav.items.runscan'), icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
        { page: 'runs',    label: t('nav.items.runs'),    count: runs.length > 0 ? runs.length : undefined, icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z' },
        { page: 'diff',    label: t('nav.items.diff'),    icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
      ],
    },
    {
      id: 'admin', label: t('nav.sections.admin'), color: '#f87171', minRole: 'admin',
      items: [
        { page: 'users',         label: t('nav.items.users'),         icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
        { page: 'sso',           label: t('nav.items.sso'),           icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
        { page: 'apikeys',       label: t('nav.items.apikeys'),       icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
        { page: 'groupmappings', label: t('nav.items.groupmappings'), icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
        { page: 'controlspacks', label: t('nav.items.controlspacks'), icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
      ],
    },
    {
      id: 'system', label: t('nav.sections.system'), color: '#94a3b8', minRole: 'architect',
      items: [
        { page: 'access',   label: t('nav.items.access'),   icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
        { page: 'settings', label: t('nav.items.settings'), icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
        { page: 'feedback', label: t('nav.items.feedback'), icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
      ],
    },
  ]
}

function NavItem({ item, page, navigate }: { item: NavEntry; page: Page; navigate: (p: Page) => void }) {
  return (
    <button
      key={item.page}
      onClick={() => navigate(item.page)}
      className={`sidebar-link${page === item.page ? ' active' : ''}`}
      style={item.danger && page !== item.page ? { color: '#f87171' } : undefined}
    >
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
      </svg>
      {item.label}
      {item.badge && (
        <span style={{
          marginLeft: 'auto', fontSize: '0.65rem', borderRadius: '999px', padding: '0.1rem 0.45rem',
          background: item.badge.variant === 'fail' ? 'rgba(218,44,56,.25)' : 'rgba(255,255,255,.08)',
          color: item.badge.variant === 'fail' ? '#fca5a5' : 'var(--sidebar-text)',
        }}>
          {item.badge.label}
        </span>
      )}
      {!item.badge && item.count != null && item.count > 0 && (
        <span style={{ marginLeft: 'auto', fontSize: '0.65rem', borderRadius: '999px', padding: '0.1rem 0.45rem', background: 'rgba(255,255,255,.08)', color: 'var(--sidebar-text)' }}>
          {item.count}
        </span>
      )}
    </button>
  )
}

export default function Sidebar({
  run, runs, runsError, page, role, user,
  maturityLevel, settings, hideDisabledMenuItems, waiverCount, riskCount, failCount,
  navigate, onShowRunModal, onOpenUserPrefs, onLogout,
}: SidebarProps) {
  const matMeta = getMaturityMeta(maturityLevel)
  const hide = hideDisabledMenuItems
  const { t } = useI18n()

  const allSections = buildNavSections(run, runs, settings, waiverCount, riskCount, failCount, t)
  const visibleSections = allSections.filter(s => hasMinRole(role, s.minRole ?? s.id))

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('wafpass_nav_expanded') ?? '{}') } catch { return {} }
  })

  const [activePackVersion, setActivePackVersion] = useState<string | null>(null)
  const [controlsCount, setControlsCount] = useState<number>(0)

  // Fetch active control pack info on mount and when run changes
  useEffect(() => {
    let cancelled = false
    getActiveControlPack().then(pack => {
      if (!cancelled && pack) {
        setActivePackVersion(pack.version)
        setControlsCount(pack.control_count)
      }
    }).catch(() => {
      // Fallback to run data if API fails
      if (run?.controls_loaded != null) {
        setControlsCount(run.controls_loaded)
      }
    })
    return () => { cancelled = true }
  }, [run?.id])

  function toggleSection(id: string) {
    setExpandedSections(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem('wafpass_nav_expanded', JSON.stringify(next)) } catch {}
      return next
    })
  }

  return (
    <aside style={{
      width: '16rem', flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)',
      overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--sidebar-border)' }}>
        <img src="/logo.png" alt="WAF++ PASS" style={{ height: '32px', width: 'auto', objectFit: 'contain', filter: 'brightness(1.05)' }} />
        <div style={{ marginTop: '0.375rem', fontSize: '0.62rem', color: 'var(--sidebar-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
          Controls Dashboard
        </div>
      </div>

      {/* Run selector */}
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--sidebar-border)' }}>
        <div style={{ fontSize: '0.62rem', color: 'var(--sidebar-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem', fontWeight: 600 }}>
          Active Run
        </div>
        {runsError ? (
          <div style={{ fontSize: '0.75rem', color: '#f87171' }}>API unreachable</div>
        ) : runs.length === 0 ? (
          <div style={{ fontSize: '0.75rem', color: 'var(--sidebar-muted)' }}>No runs yet</div>
        ) : (
          <button
            onClick={onShowRunModal}
            style={{
              width: '100%', background: 'var(--sidebar-surf)', color: 'var(--sidebar-text)',
              border: '1px solid var(--sidebar-border)', borderRadius: '8px',
              padding: '0.4rem 0.6rem', fontSize: '0.75rem', cursor: 'pointer',
              textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {run ? `${run.project || 'unnamed'} · ${new Date(run.created_at).toLocaleDateString()}` : 'Select run…'}
            </span>
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0, opacity: 0.6 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
            </svg>
          </button>
        )}
      </div>

      {/* Score badge */}
      {run && (
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--sidebar-border)' }}>
          <div style={{ fontSize: '0.62rem', color: 'var(--sidebar-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Overall Score</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: scoreColor(run.score) }}>{run.score}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--sidebar-muted)' }}>/100</span>
          </div>
          {run.path && (
            <div style={{ fontSize: '0.62rem', color: 'var(--sidebar-muted)', marginTop: '0.2rem', wordBreak: 'break-all' }}>{run.path}</div>
          )}
        </div>
      )}

      {/* Maturity level */}
      <div style={{ padding: '0.625rem 1.25rem', borderBottom: '1px solid var(--sidebar-border)' }}>
        <div style={{ fontSize: '0.62rem', color: 'var(--sidebar-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem', fontWeight: 600 }}>Maturity</div>
        <button
          onClick={() => navigate('settings')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: `${matMeta.color}18`, border: `1px solid ${matMeta.color}40`,
            borderRadius: '999px', padding: '0.18rem 0.6rem',
            fontSize: '0.72rem', fontWeight: 700, color: matMeta.textColor,
            cursor: 'pointer', letterSpacing: '0.02em',
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: matMeta.textColor, flexShrink: 0 }} />
          {matMeta.label}
        </button>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '0.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {visibleSections.map((section, si) => {
          const items = hide ? section.items.filter(i => i.gate === undefined || i.gate) : section.items
          if (items.length === 0) return null

          const threshold = items.length - 2 >= 2 ? 2 : items.length
          const visibleItems = items.slice(0, threshold)
          const hiddenItems = items.slice(threshold)
          const activeInHidden = hiddenItems.some(i => i.page === page)
          const isExpanded = !!(expandedSections[section.id] || activeInHidden)

          return (
            <div key={section.id}>
              {si > 0 && <div style={{ borderTop: '1px solid var(--sidebar-border)', margin: '0.35rem 0' }} />}
              <div style={{
                fontSize: '0.58rem', color: section.color,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                fontWeight: 700, padding: '0.25rem 0.5rem 0.15rem',
                display: 'flex', alignItems: 'center', gap: '0.35rem',
              }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: section.color, flexShrink: 0 }} />
                {section.label}
              </div>

              {visibleItems.map(item => (
                <NavItem key={item.page} item={item} page={page} navigate={navigate} />
              ))}

              {hiddenItems.length > 0 && (
                <>
                  <button
                    onClick={() => toggleSection(section.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.3rem',
                      width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                      padding: '0.22rem 0.5rem', borderRadius: '6px',
                      fontSize: '0.65rem', fontWeight: 600,
                      color: activeInHidden ? section.color : 'var(--sidebar-muted)',
                      opacity: 0.8, transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.8' }}
                  >
                    <svg
                      width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      style={{ flexShrink: 0, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                    {isExpanded ? 'Show less' : `${hiddenItems.length} more…`}
                  </button>
                  {isExpanded && hiddenItems.map(item => (
                    <NavItem key={item.page} item={item} page={page} navigate={navigate} />
                  ))}
                </>
              )}
            </div>
          )
        })}
      </nav>

      {/* Policy version footer */}
      {run && (
        <div style={{ padding: '0.625rem 1.25rem', borderTop: '1px solid var(--sidebar-border)' }}>
          <div style={{ fontSize: '0.62rem', color: 'var(--sidebar-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Policy Version</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {activePackVersion ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                background: 'rgba(0,148,255,0.15)', border: '1px solid rgba(0,148,255,0.35)',
                borderRadius: '999px', padding: '0.18rem 0.6rem',
                fontSize: '0.72rem', fontWeight: 700, color: '#60a5fa', letterSpacing: '0.02em',
              }}>
                {activePackVersion}
              </span>
            ) : (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                background: 'rgba(0,148,255,0.15)', border: '1px solid rgba(0,148,255,0.35)',
                borderRadius: '999px', padding: '0.18rem 0.6rem',
                fontSize: '0.72rem', fontWeight: 700, color: '#60a5fa', letterSpacing: '0.02em',
              }}>
                v1.0.0
              </span>
            )}
            {controlsCount > 0 && (
              <span style={{ fontSize: '0.65rem', color: 'var(--sidebar-muted)' }}>{controlsCount} controls</span>
            )}
          </div>
        </div>
      )}

      {/* User widget */}
      <div style={{ padding: '0.625rem 1rem', borderTop: '1px solid var(--sidebar-border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{
          width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
          background: 'rgba(0,148,255,.15)', border: '1px solid rgba(0,148,255,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.65rem', fontWeight: 700, color: 'var(--waf-brand)',
        }}>
          {(user.display_name || user.username).charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--sidebar-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.display_name || user.username}
          </div>
          <div style={{ fontSize: '0.6rem', color: 'var(--sidebar-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{role}</div>
        </div>
        <button
          onClick={onOpenUserPrefs}
          title="User preferences"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sidebar-muted)', padding: '0.2rem', borderRadius: '4px', flexShrink: 0 }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <button
          onClick={onLogout}
          title="Sign out"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sidebar-muted)', padding: '0.2rem', borderRadius: '4px', flexShrink: 0 }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>

      <div style={{ padding: '0.5rem 1.25rem', borderTop: '1px solid var(--sidebar-border)', fontSize: '0.65rem', color: 'var(--sidebar-muted)' }}>
        WAF++ PASS v1.0.0
      </div>
    </aside>
  )
}
