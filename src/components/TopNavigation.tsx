import { useState, useEffect, useRef } from 'react'
import { Page } from '../routing'
import { NotificationBell } from './NotificationBell'
import { hasMinRole } from '../AuthContext'

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size))
  }
  return result
}
import { Settings, getMaturityMeta } from '../pages/settingsUtils'
import { RunDetail, RunSummary } from '../api'
import { useI18n } from '../i18n'
import { loadUserPrefs, saveUserPrefs } from '../pages/userPrefsUtils'

export interface NavEntry {
  page: Page
  label: string
  icon: string
  gate?: boolean
  danger?: boolean
  count?: number
  badge?: { label: string; variant: 'fail' | 'neutral' } | null
}

export interface NavSection {
  id: string
  label: string
  color: string
  description: string
  items: NavEntry[]
  minRole?: string
}

export interface TopNavigationProps {
  run: RunDetail | null
  runs: RunSummary[]
  page: Page
  role: string
  user: { username: string; display_name: string; image_url: string; role: string }
  maturityLevel: number
  settings: Settings
  waiverCount: number
  riskCount: number
  failCount: number
  navigate: (page: Page) => void
  onOpenUserPrefs: () => void
  onLogout: () => Promise<void>
  onShowRunModal: () => void
}

// Role icons from AccessRolesPage (ROLES array)
const roleIcons: Record<string, string> = {
  overview: 'M12 2L2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
  journey: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8',
  bestpractices: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7 M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4 M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',
  ciso: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4',
  architect: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  engineer: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  runs: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  admin: 'M12 8c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 12c-6.627 0-12-5.373-12-12s5.373-12 12-12 12 5.373 12 12-5.373 12-12 12z',
  system: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
}

const categoryDescriptions: Record<string, string> = {
  overview: 'Executive summary and risk posture overview',
  journey: 'Project maturity, achievements, and long-term progress',
  bestpractices: 'Reference architecture and anti-patterns guidance',
  ciso: 'Security, risk acceptance, waivers, and compliance',
  architect: 'Infrastructure design, dependency analysis, and sandbox',
  engineer: 'Finding resolution, remediation, and engineering work',
  runs: 'Scan history, comparisons, and run management',
  admin: 'User management, SSO, and system configuration',
  system: 'System settings, access control, and feedback',
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
      id: 'overview',
      label: t('nav.sections.overview'),
      color: '#f59e0b',
      description: categoryDescriptions['overview'] || 'Executive summary and risk posture overview',
      items: [
        { page: 'globaldashboard', label: t('nav.items.globaldashboard'), icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
        { page: 'dashboard', label: t('nav.items.dashboard'), icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
        { page: 'compliance', label: t('nav.items.compliance'), icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
        {
          page: 'cost', label: t('nav.items.cost'),
          gate: (settings.activePillars ?? []).includes('cost'),
          icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        },
        {
          page: 'gapanalysis', label: t('nav.items.gapanalysis'),
          icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
        },
      ],
    },
    {
      id: 'projects',
      label: t('nav.sections.journey'),
      color: '#14b8a6',
      minRole: 'clevel',
      description: categoryDescriptions['journey'] || 'Project maturity, achievements, and long-term progress',
      items: [
        { page: 'passports', label: t('nav.items.passports'), icon: 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2' },
        { page: 'badge', label: t('nav.items.badge'), icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
        { page: 'leaderboard', label: t('nav.items.leaderboard'), icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
        { page: 'journey', label: t('nav.items.journey'), icon: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8' },
      ],
    },
    {
      id: 'bestpractices',
      label: t('nav.sections.bestpractices'),
      color: '#10b981',
      minRole: 'clevel',
      description: categoryDescriptions['bestpractices'] || 'Reference architecture and anti-patterns guidance',
      items: [
        { page: 'reference', label: t('nav.items.reference'), icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4' },
        { page: 'antipattern', label: t('nav.items.antipattern'), icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
      ],
    },
    {
      id: 'ciso',
      label: t('nav.sections.ciso'),
      color: '#0094ff',
      description: categoryDescriptions['ciso'] || 'Security, risk acceptance, waivers, and compliance',
      items: [
        { page: 'risk', label: t('nav.items.risk'), count: riskCount, icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
        { page: 'waivers', label: t('nav.items.waivers'), count: waiverCount, icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
        {
          page: 'skipped', label: t('nav.items.skipped'),
          icon: 'M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z',
          count: run ? (() => {
            const active = new Set(run.findings.filter(f => { const s = f.status?.toUpperCase(); return s === 'PASS' || s === 'FAIL' }).map(f => f.control_id))
            return run.controls_meta.filter(c => !active.has(c.id)).length
          })() : undefined,
        },
        { page: 'audit', label: t('nav.items.audit'), icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
        { page: 'evidence', label: t('nav.items.evidence'), gate: settings.evidenceCollection, icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
        { page: 'regions', label: t('nav.items.regions'), icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      ],
    },
    {
      id: 'architect',
      label: t('nav.sections.architect'),
      color: '#8b5cf6',
      description: categoryDescriptions['architect'] || 'Infrastructure design, dependency analysis, and sandbox',
      items: [
        {
          page: 'catalogue', label: t('nav.items.catalogue'),
          icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',
        },
        { page: 'exploitpath', label: t('nav.items.exploitpath'), danger: true, icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
        {
          page: 'blastradius', label: t('nav.items.blastradius'),
          gate: settings.blastRadius,
          icon: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z',
        },
        {
          page: 'depgraph', label: t('nav.items.depgraph'),
          gate: settings.dependencyGraph,
          icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-10l6-3m0 13l5.447-2.724A1 1 0 0021 16.382V5.618a1 1 0 00-1.447-.894L15 7m0 13V7',
        },
        {
          page: 'modules', label: t('nav.items.modules'),
          icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
        },
        {
          page: 'changes', label: t('nav.items.changes'),
          gate: settings.driftDetection,
          icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
        },
        { page: 'sandbox', label: t('nav.items.sandbox'), icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
      ],
    },
    {
      id: 'engineer',
      label: t('nav.sections.engineer'),
      color: '#22c55e',
      description: categoryDescriptions['engineer'] || 'Finding resolution, remediation, and engineering work',
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
        },
        { page: 'remediation', label: t('nav.items.remediation'), icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
      ],
    },
    {
      id: 'runs',
      label: t('nav.sections.runs'),
      color: '#22c55e',
      minRole: 'engineer',
      description: categoryDescriptions['runs'] || 'Scan history, comparisons, and run management',
      items: [
        { page: 'runscan', label: t('nav.items.runscan'), icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
        { page: 'runs', label: t('nav.items.runs'), count: runs.length > 0 ? runs.length : undefined, icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z' },
        { page: 'diff', label: t('nav.items.diff'), icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
      ],
    },
    {
      id: 'admin',
      label: t('nav.sections.admin'),
      color: '#f87171',
      minRole: 'admin',
      description: categoryDescriptions['admin'] || 'User management, SSO, and system configuration',
      items: [
        { page: 'users', label: t('nav.items.users'), icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
        { page: 'sso', label: t('nav.items.sso'), icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
        { page: 'apikeys', label: t('nav.items.apikeys'), icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
        { page: 'groupmappings', label: t('nav.items.groupmappings'), icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
        { page: 'controlspacks', label: t('nav.items.controlspacks'), icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
      ],
    },
    {
      id: 'system',
      label: t('nav.sections.system'),
      color: '#94a3b8',
      minRole: 'architect',
      description: categoryDescriptions['system'] || 'System settings, access control, and feedback',
      items: [
        { page: 'access', label: t('nav.items.access'), icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
        { page: 'settings', label: t('nav.items.settings'), icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
        { page: 'feedback', label: t('nav.items.feedback'), icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
      ],
    },
  ]
}

function NavItem({ item, page, navigate }: { item: NavEntry; page: Page; navigate: (p: Page) => void }) {
  const isActive = page === item.page

  return (
    <button
      key={item.page}
      onClick={() => navigate(item.page)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        padding: '0.5rem 0.75rem',
        borderRadius: '6px',
        background: isActive ? 'rgba(0,148,255,0.15)' : 'transparent',
        border: isActive ? '1px solid var(--sidebar-border)' : '1px solid transparent',
        cursor: 'pointer',
        fontSize: '0.8rem',
        color: isActive ? 'var(--waf-brand)' : (item.danger ? 'var(--waf-danger)' : 'var(--sidebar-text)'),
        fontWeight: isActive ? 600 : 400,
        transition: 'all 0.15s',
        width: '100%',
        textAlign: 'left',
      }}
    >
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
      </svg>
      <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
      {item.count != null && item.count > 0 && (
        <span style={{ fontSize: '0.65rem', borderRadius: '999px', padding: '0.1rem 0.45rem', background: 'var(--sidebar-surf)', color: 'var(--sidebar-text)' }}>
          {item.count}
        </span>
      )}
    </button>
  )
}


function NavSectionDropdown({ section, page, navigate }: { section: NavSection; page: Page; navigate: (p: Page) => void }) {
  const [expanded, setExpanded] = useState(false)
  const hasActive = section.items.some(item => item.page === page)

  return (
    <div
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{ position: 'relative' }}
    >
      <button
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.75rem 1rem', borderRadius: '6px',
          background: expanded || hasActive ? 'rgba(0,148,255,0.15)' : 'transparent',
          border: expanded ? '1px solid var(--sidebar-border)' : (hasActive ? '1px solid var(--waf-brand)' : '1px solid transparent'),
          cursor: 'pointer', color: hasActive ? 'var(--waf-brand)' : 'var(--sidebar-text)',
          fontSize: '0.85rem', fontWeight: hasActive ? 600 : 500,
          transition: 'all 0.15s',
        }}
      >
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: hasActive ? 'var(--waf-brand)' : section.color, flexShrink: 0 }} />
        {section.label}
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.5 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div
          onMouseEnter={() => setExpanded(true)}
          onMouseLeave={() => setExpanded(false)}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            minWidth: '700px',
            background: 'var(--sidebar-bg)',
            border: '1px solid var(--sidebar-border)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            padding: '1.5rem',
            zIndex: 100,
            display: 'flex',
            gap: '1.5rem',
          }}
        >
          {/* Left: User image + description (block text) */}
          <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* User image icon alone */}
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'var(--sidebar-surf)', border: '2px solid var(--sidebar-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: section.color,
              flexShrink: 0,
            }}>
              <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={roleIcons[section.id] || roleIcons['overview']} />
              </svg>
            </div>

            {/* Description in block text (no ellipsis, full text) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: 700, color: 'var(--sidebar-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                {section.label}
              </p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--sidebar-text)', lineHeight: 1.6 }}>
                {section.description}
              </p>
            </div>
          </div>

          {/* Right: Navigation items - 4 per column, next columns for more items */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: '2rem' }}>
            {chunkArray(section.items, 4).map((chunk, chunkIdx) => (
              <div key={chunkIdx} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {chunk.map((item) => (
                  <NavItem
                    key={item.page}
                    item={item}
                    page={page}
                    navigate={navigate}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LanguageSwitcher({ currentLang, onChange }: { currentLang: string; onChange: (code: string) => void }) {
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const languages = [
    { code: 'en', flag: '🇬🇧', label: 'English' },
    { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
    { code: 'fr', flag: '🇫🇷', label: 'Français' },
    { code: 'es', flag: '🇪🇸', label: 'Español' },
    { code: 'pt', flag: '🇵🇹', label: 'Português' },
    { code: 'br', flag: '🇧🇷', label: 'Português BR' },
    { code: 'el', flag: '🇬🇷', label: 'Ελληνικά' },
  ]

  const currentLanguage = languages.find(l => l.code === currentLang) || languages[0]

  const handleSelect = (code: string) => {
    setShowMenu(false)
    onChange(code)
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMenu])

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setShowMenu(!showMenu)
        }}
        title="Language"
        style={{
          background: 'var(--sidebar-surf)',
          border: '1px solid var(--sidebar-border)',
          cursor: 'pointer',
          color: 'var(--sidebar-text)',
          padding: '0.5rem',
          borderRadius: '8px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          fontSize: '0.75rem',
        }}
      >
        <span style={{ fontSize: '0.85rem' }}>{currentLanguage.flag}</span>
      </button>
      {showMenu && (
        <div
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: '0.25rem',
            maxHeight: '240px',
            overflow: 'auto',
            minWidth: '160px',
            maxWidth: '200px',
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
          }}
        >
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={(e) => {
                e.stopPropagation()
                handleSelect(l.code)
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: currentLang === l.code ? 'var(--text)' : 'var(--text-secondary)',
              }}
            >
              <span>{l.flag}</span>
              <span>{l.label}</span>
              {currentLang === l.code && (
                <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--waf-brand)' }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TopNavigation({
  run, runs, page, role, user, maturityLevel,
  settings, waiverCount, riskCount, failCount,
  navigate, onOpenUserPrefs, onLogout, onShowRunModal,
}: TopNavigationProps) {
  const { t, lang } = useI18n()
  const [linkCopied, setLinkCopied] = useState(false)
  const showNotifications = role === 'admin'


  const allSections = buildNavSections(run, runs, settings, waiverCount, riskCount, failCount, t)
  const visibleSections = allSections.filter(s => hasMinRole(role, s.minRole ?? s.id))

  const currentRunLabel = run ? `${run.project || 'unnamed'} · ${new Date(run.created_at).toLocaleDateString()}` : 'Select run…'

  const handleLanguageChange = (code: string) => {
    const prefs = { ...loadUserPrefs(), language: code }
    saveUserPrefs(prefs)
    window.location.reload()
  }

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
      .then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000) })
      .catch(() => {})
  }

  return (
    <header className="app-top-nav" style={{
      background: 'var(--sidebar-bg)',
      borderBottom: '1px solid var(--sidebar-border)',
      padding: '0.5rem 1.5rem',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '1rem',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <img src="/logo.png" alt="WAF++ PASS" style={{ height: '32px', width: 'auto', objectFit: 'contain', filter: 'brightness(1.05)' }} />
      </div>

      {/* Navigation - only on large screens */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1, justifyContent: 'center' }}>
        {visibleSections.map(section => (
          <NavSectionDropdown
            key={section.id}
            section={section}
            page={page}
            navigate={navigate}
          />
        ))}
      </div>

      {/* Right side - User controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Run selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={onShowRunModal}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.5rem', borderRadius: '8px',
              background: 'var(--sidebar-surf)',
              border: '1px solid var(--sidebar-border)',
              cursor: 'pointer',
              fontSize: '0.75rem', color: 'var(--sidebar-text)',
            }}
          >
            {run ? (
              <>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.6 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
                <span style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentRunLabel}
                </span>
              </>
            ) : (
              <>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.6 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L16 14M7 18l-4.553-2.276A1 1 0 012 15.382V8.618a1 1 0 011.447-.894L7 10m0 0l4.553 2.276A1 1 0 0012 12.382V8" />
                </svg>
                <span>No runs selected</span>
              </>
            )}
          </button>
        </div>

        {/* Dark mode toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Notifications bell (admin only) */}
          {showNotifications && <NotificationBell navigate={navigate} />}

          {/* Dark mode toggle */}
          <button
            onClick={() => {
              const html = document.documentElement
              const isDark = html.getAttribute('data-theme') === 'dark'
              html.setAttribute('data-theme', isDark ? 'light' : 'dark')
            }}
            title={document.documentElement.getAttribute('data-theme') === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0.5rem', borderRadius: '8px',
              background: 'var(--sidebar-surf)', color: 'var(--sidebar-text)',
              border: '1px solid var(--sidebar-border)',
              cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
            }}
          >
            {document.documentElement.getAttribute('data-theme') === 'dark'
              ? <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5" strokeWidth={2}/><path strokeLinecap="round" strokeWidth={2} d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              : <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
            }
          </button>
        </div>

        {/* Copy link */}
        <button
          onClick={copyLink}
          title="Copy link to this page"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0.5rem', borderRadius: '8px',
            background: linkCopied ? 'rgba(34,197,94,.12)' : 'var(--sidebar-surf)',
            color: linkCopied ? '#15803d' : 'var(--sidebar-muted)',
            border: `1px solid ${linkCopied ? 'rgba(34,197,94,.4)' : 'var(--sidebar-border)'}`,
            cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {linkCopied
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            }
          </svg>
        </button>

        {/* PDF Export */}
        <button
          onClick={() => window.print()}
          title="Export as PDF"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0.5rem', borderRadius: '8px',
            background: 'var(--sidebar-surf)',
            color: 'var(--sidebar-muted)',
            border: '1px solid var(--sidebar-border)',
            cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#22d3ee'
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(34,211,238,0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--sidebar-muted)'
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>

        {/* Maturity level */}
        {(() => {
          const meta = getMaturityMeta(maturityLevel)
          return (
            <button
              onClick={() => navigate('settings')}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                background: meta.color,
                borderRadius: '999px', padding: '0.4rem 0.9rem',
                fontSize: '0.75rem', fontWeight: 700,
                color: '#ffffff',
                cursor: 'pointer', flexShrink: 0,
                border: 'none',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ffffff', flexShrink: 0, opacity: 0.5 }} />
              <span>{meta.short}</span>
            </button>
          )
        })()}

        {/* Language switcher */}
        <LanguageSwitcher currentLang={lang} onChange={handleLanguageChange} />

        {/* User dropdown - avatar with hover menu */}
        <div className="top-nav-wrapper" style={{ position: 'relative' }}>
          <button
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'var(--sidebar-surf)',
              border: '1px solid var(--sidebar-border)',
              cursor: 'pointer', transition: 'all 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--sidebar-bg)'
              e.currentTarget.style.transform = 'scale(1.05)'
              e.currentTarget.style.borderColor = 'var(--waf-brand)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--sidebar-surf)'
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.borderColor = 'var(--sidebar-border)'
            }}
          >
            {user.image_url && user.image_url !== '' ? (
              <img src={user.image_url} alt={user.display_name || user.username} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0094FF' }}>
                {user.display_name ? user.display_name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
              </span>
            )}
          </button>

          {/* Hover menu */}
          <div className="user-menu-hover" style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '0.5rem',
            width: '200px',
            background: 'var(--sidebar-bg)',
            border: '1px solid var(--sidebar-border)',
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            zIndex: 100,
            display: 'none',
          }}>
            {/* User info header */}
            <div style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid var(--sidebar-border)',
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--sidebar-text)' }}>
                {user.display_name || user.username}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--sidebar-muted)' }}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </div>
            </div>

            {/* User preferences */}
            <button
              onClick={onOpenUserPrefs}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.5rem 1rem',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.8rem', color: 'var(--sidebar-text)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0,148,255,0.1)'
                e.currentTarget.style.color = 'var(--waf-brand)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none'
                e.currentTarget.style.color = 'var(--sidebar-text)'
              }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>User Preferences</span>
            </button>

            {/* Logout */}
            <button
              onClick={onLogout}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.5rem 1rem',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.8rem', color: 'var(--waf-danger)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(218,44,56,0.1)'
                e.currentTarget.style.color = 'var(--waf-danger)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none'
                e.currentTarget.style.color = 'var(--waf-danger)'
              }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Sign out</span>
            </button>
          </div>
        </div>

        {/* CSS for hover menu display */}
        <style>{`
          .top-nav-wrapper:hover .user-menu-hover {
            display: block !important;
          }
        `}</style>
      </div>
    </header>
  )
}
