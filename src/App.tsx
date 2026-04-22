import { useEffect, useRef, useState } from 'react'
import { fetchRun, fetchRuns, RunDetail, RunSummary } from './api'
import { hasMinRole, useAuth } from './AuthContext'
import LoginPage from './pages/LoginPage'
import RunSelectorModal from './components/RunSelectorModal'
import PdfReport from './components/PdfReport'
import ControlsCataloguePage from './pages/ControlsCataloguePage'
import DashboardPage from './pages/DashboardPage'
import FindingsPage from './pages/FindingsPage'
import CompliancePage from './pages/CompliancePage'
import RegionsPage from './pages/RegionsPage'
import ExploitPathsPage from './pages/ExploitPathsPage'
import RunsListPage from './pages/RunsListPage'
import SettingsPage, { loadMaturityState, saveMaturityState, getMaturityMeta, Settings } from './pages/SettingsPage'
import RunScanPage from './pages/RunScanPage'
import SandboxPage from './pages/SandboxPage'
import WaiversPage from './pages/WaiversPage'
import RiskAcceptancePage from './pages/RiskAcceptancePage'
import ChangesPage from './pages/ChangesPage'
import BlastRadiusPage from './pages/BlastRadiusPage'
import RemediationSprintPage from './pages/RemediationSprintPage'
import RunDiffPage from './pages/RunDiffPage'
import SecretScanPage from './pages/SecretScanPage'
import ModuleScorePage from './pages/ModuleScorePage'
import DependencyGraphPage from './pages/DependencyGraphPage'
import FeedbackPage from './pages/FeedbackPage'
import { CONTROLS } from './controls-data'
import { ControlMeta } from './api'
import { emitScanReceived, recordFirstSeenFailures } from './audit'
import EvidencePage from './pages/EvidencePage'
import SkippedControlsPage from './pages/SkippedControlsPage'
import AuditLogPage from './pages/AuditLogPage'
import GapAnalysisPage from './pages/GapAnalysisPage'
import CostImpactPage from './pages/CostImpactPage'
import AccessRolesPage from './pages/AccessRolesPage'
import UserManagementPage from './pages/UserManagementPage'
import ApiManagementPage from './pages/ApiManagementPage'
import SsoSettingsPage from './pages/SsoSettingsPage'
import GroupMappingsPage from './pages/GroupMappingsPage'
import ProjectOverviewPage from './pages/ProjectOverviewPage'
import PassportDashboardPage from './pages/PassportDashboardPage'

const ALL_PAGES = [
  'dashboard', 'catalogue', 'findings', 'compliance', 'gapanalysis', 'regions',
  'exploitpath', 'blastradius', 'depgraph', 'remediation', 'secrets', 'modules',
  'cost', 'runs', 'diff', 'audit', 'evidence', 'settings', 'runscan', 'sandbox',
  'waivers', 'risk', 'changes', 'feedback', 'skipped', 'access', 'users', 'apikeys', 'sso', 'groupmappings',
  'projectoverview', 'passports',
] as const
type Page = typeof ALL_PAGES[number]
const PAGE_SET = new Set<string>(ALL_PAGES)

// ── Hash routing ──────────────────────────────────────────────────────────────

function parseHash(): { page: Page; runId: string | null } {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const qi = raw.indexOf('?')
  const slug = qi >= 0 ? raw.slice(0, qi) : raw
  const query = qi >= 0 ? raw.slice(qi + 1) : ''
  return {
    page: PAGE_SET.has(slug) ? (slug as Page) : 'dashboard',
    runId: new URLSearchParams(query).get('run'),
  }
}

function buildHash(page: Page, runId: string | null): string {
  return runId ? `#/${page}?run=${runId}` : `#/${page}`
}

const PAGE_TITLE: Record<Page, string> = {
  dashboard:   'Executive Dashboard',
  catalogue:   'Controls Catalogue',
  findings:    'Scan Findings',
  compliance:  'Compliance Matrix',
  gapanalysis: 'Regulatory Gap Analysis',
  regions:     'Deployed Regions',
  exploitpath:  'Exploit Path Analysis',
  blastradius:  'Blast Radius',
  depgraph:     'Dependency Graph',
  remediation:  'Remediation Sprint',
  secrets:      'Secret Scanner',
  modules:      'Module Score Breakdown',
  cost:         'Cost Impact Estimation',
  runs:        'Run History',
  diff:        'Run Comparison',
  audit:       'Audit Log',
  evidence:    'Evidence Package',
  settings:    'Settings',
  runscan:     'Run Scan',
  sandbox:     'Architect Sandbox',
  waivers:     'Waivers Manager',
  risk:        'Risk Acceptance',
  changes:     'Changes & Drift',
  feedback:    'Feedback',
  skipped:     'Skipped Controls',
  access:      'Access & Roles',
  users:       'User Management',
  apikeys:       'API Key Management',
  sso:           'SSO Settings',
  groupmappings:   'Group → Role Mappings',
  projectoverview: 'Project Overview',
  passports:       'Project Passports',
}

const PAGE_SUBTITLE: Record<Page, string> = {
  dashboard:   'Risk posture overview across all WAF++ pillars',
  catalogue:   'All WAF++ framework controls and your custom controls — browse, filter, author, and export',
  findings:    'Detailed results from the selected run',
  compliance:  'Pillar coverage, pass rates and regulatory framework mapping',
  gapanalysis: 'Shortest path to framework compliance — controls ranked by effort-per-requirement, with remediation steps and evidence export',
  changes:     'Terraform plan changes (adds, updates, replacements, destroys) and compliance drift — controls that regressed or recovered since the previous run',
  regions:     'Detected cloud deployment regions',
  exploitpath:  'Attack chain visualization · internet-facing surfaces are highest criticality',
  blastradius:  'Interactive dependency graph of all failing resources and their structural propagation paths',
  depgraph:     'Full resource dependency graph — all resources colored by compliance status, with connected-subgraph highlighting',
  remediation:  'Prioritised fix queue — select controls to form a sprint and see your projected score gain, resources fixed, and regulatory gaps closed',
  secrets:      'Hardcoded credential issues detected in IaC — passwords, API keys, tokens, and private keys that must be migrated to a secrets manager',
  modules:      'Per-module pass rate and score drag — identify which Terraform module is pulling the overall score down',
  cost:         'Estimated $/month impact for failing WAF-COST controls — waste, savings opportunities, and financial governance risk',
  runs:        'All recorded WAF++ scan runs',
  diff:        'Finding-level diff between two runs — newly broken controls, fixed controls, score delta per pillar',
  audit:       'Tamper-evident record of every waiver, risk acceptance, and scan event — export for SOC2/ISO27001 evidence collection',
  evidence:    'Generate a timestamped, auditor-ready evidence package — passing controls, waivers, risk acceptances, and audit trail',
  settings:    'Configure scan defaults, maturity level, and feature toggles',
  runscan:     'Trigger a WAF++ scan from the UI or generate a CLI command',
  sandbox:     'Evaluate Terraform HCL snippets against WAF++ controls instantly',
  waivers:     'Suppress controls from failing · export as .wafpass-skip.yml',
  risk:        'Formally accept or mitigate risks — with approver, expiry and traceability',
  feedback:    'Share your thoughts with the WAF++ team — we read every message',
  skipped:     'Controls skipped by the engine, waived, or risk-accepted — review your coverage gaps',
  access:      'Role definitions and page-level access model',
  users:       'Create, edit, activate/deactivate, and delete user accounts',
  apikeys:       'Generate and revoke API keys for CI/CD pipelines and service accounts',
  sso:           'Configure OIDC and SAML2 single sign-on for your organisation',
  groupmappings:   'Map IdP group memberships to WAF++ roles — evaluated first during SSO login',
  projectoverview: 'Per-project score trends, maturity progression, and achievement tracking across all scans',
  passports:       'All project passports at a glance — owner, criticality, environment, recent achievements',
}

function scoreColor(s: number) {
  return s >= 80 ? '#059669' : s >= 60 ? '#d97706' : '#DA2C38'
}

export default function App() {
  const { user, role, isLoading, logout } = useAuth()

  // Show nothing while restoring session (avoids flicker to login then dashboard)
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div className="spinner" />
      </div>
    )
  }

  // Not authenticated — show login page
  if (!user) return <LoginPage />

  return <AuthenticatedApp user={user} role={role ?? 'clevel'} onLogout={logout} />
}

function AuthenticatedApp({ user, role, onLogout }: { user: { username: string; display_name: string; role: string }; role: string; onLogout(): Promise<void> }) {
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [run, setRun] = useState<RunDetail | null>(null)
  const [loadingRun, setLoadingRun] = useState(false)
  const [page, setPage] = useState<Page>(() => parseHash().page)
  const [runsError, setRunsError] = useState<string | null>(null)
  const [waiverCount, setWaiverCount] = useState(0)
  const [riskCount, setRiskCount] = useState(0)
  const [showRunModal, setShowRunModal] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  // Capture the runId from the initial URL so the runs-load effect can select it
  const initialHashRunId = useRef(parseHash().runId)
  // Track whether initial mount has completed (to avoid pushState on first render)
  const mounted = useRef(false)

  function navigate(newPage: Page) {
    setPage(newPage)
    window.history.pushState(null, '', buildHash(newPage, selectedId))
  }

  function handleSharePdf() {
    window.print()
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    }).catch(() => {})
  }

  // Keep URL in sync: page changes push a history entry, run changes replace
  useEffect(() => {
    if (!mounted.current) return
    window.history.pushState(null, '', buildHash(page, selectedId))
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.history.replaceState(null, '', buildHash(page, selectedId))
  }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle browser back/forward
  useEffect(() => {
    function onPopState() {
      const { page: p, runId } = parseHash()
      setPage(p)
      if (runId) setSelectedId(runId)
    }
    window.addEventListener('popstate', onPopState)
    mounted.current = true
    // Initialise URL if landing on bare root
    if (!window.location.hash || window.location.hash === '#') {
      window.history.replaceState(null, '', buildHash(page, selectedId))
    }
    return () => window.removeEventListener('popstate', onPopState)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const initialMaturity = loadMaturityState()
  const [maturityLevel, setMaturityLevel] = useState(initialMaturity.level)
  const [settings, setSettings] = useState<Settings>(initialMaturity.settings)

  function handleSettingsChange(level: number, s: Settings) {
    setMaturityLevel(level)
    setSettings(s)
    saveMaturityState(level, s)
  }

  useEffect(() => {
    fetchRuns({ limit: 100 })
      .then(data => {
        setRuns(data)
        const hashRun = initialHashRunId.current
        if (hashRun && data.some(r => r.id === hashRun)) {
          setSelectedId(hashRun)
        } else if (data.length > 0) {
          setSelectedId(data[0].id)
        }
      })
      .catch((e: Error) => setRunsError(e.message))
  }, [])

  useEffect(() => {
    if (!selectedId) return
    setLoadingRun(true)
    setRun(null)
    fetchRun(selectedId)
      .then(r => {
        setRun(r)
        emitScanReceived(r)
        recordFirstSeenFailures(r.findings, r)
      })
      .catch(() => setRun(null))
      .finally(() => setLoadingRun(false))
  }, [selectedId])

  const failCount = run ? run.findings.filter(f => f.status?.toUpperCase() === 'FAIL').length : 0

  // Re-read localStorage counts whenever page changes
  useEffect(() => {
    try { setWaiverCount(Object.keys(JSON.parse(localStorage.getItem('wafpass_waivers') ?? '{}')).length) } catch {}
    try { setRiskCount(Object.keys(JSON.parse(localStorage.getItem('wafpass_risk_acceptances') ?? '{}')).length) } catch {}
  }, [page])

  // Controls for dropdowns: live from run, or fall back to static reference set
  const availableControls: Pick<ControlMeta, 'id' | 'title'>[] = run && run.controls_meta.length > 0
    ? run.controls_meta.map(c => ({ id: c.id, title: c.title }))
    : CONTROLS.map(c => ({ id: c.id, title: c.title }))
  const matMeta = getMaturityMeta(maturityLevel)

  // ── Role-based navigation ─────────────────────────────────────────────────
  // Filter nav sections: a user only sees sections at or below their own role level
  // (engineer sees all, clevel sees only their own section)

  type NavEntry = {
    page: Page; label: string; icon: string
    gate?: boolean; danger?: boolean
    badge?: { label: string; variant: 'fail' | 'neutral' } | null
    count?: number
  }
  type NavSection = { id: string; label: string; color: string; items: NavEntry[]; minRole?: string }

  const hide = settings.hideDisabledMenuItems

  const navSections: NavSection[] = [
    {
      id: 'projects', label: 'Projects', color: '#14b8a6', minRole: 'clevel',
      items: [
        { page: 'passports', label: 'Project Passports', icon: 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2' },
      ],
    },
    {
      id: 'clevel', label: 'C-Level', color: '#f59e0b',
      items: [
        { page: 'dashboard',   label: 'Dashboard',        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
        { page: 'compliance',  label: 'Compliance Matrix', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
        { page: 'cost',        label: 'Cost Impact',       gate: (settings.activePillars ?? []).includes('cost'), icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', badge: (() => { if (!run) return null; const n = run.findings.filter(f => f.pillar?.toLowerCase() === 'cost' && f.status?.toUpperCase() === 'FAIL').length; return n > 0 ? { label: String(n), variant: 'fail' as const } : null })() },
        { page: 'gapanalysis', label: 'Gap Analysis',      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', badge: (() => { if (!run) return null; const n = new Set(run.findings.filter(f => f.status?.toUpperCase() === 'FAIL').map(f => f.control_id)).size; return n > 0 ? { label: String(n), variant: 'fail' as const } : null })() },
      ],
    },
    {
      id: 'ciso', label: 'CISO', color: '#0094ff',
      items: [
        { page: 'risk',     label: 'Risk Acceptance',  icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',                                                                                                                                                                                                                                                                                                                                  count: riskCount },
        { page: 'waivers',  label: 'Waivers',          icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',                                                                                                                                                                                count: waiverCount },
        { page: 'skipped',  label: 'Skipped Controls', icon: 'M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z',                                                                                                                                                                                                                                                                                                                                          count: run ? (() => { const active = new Set(run.findings.filter(f => { const s = f.status?.toUpperCase(); return s === 'PASS' || s === 'FAIL' }).map(f => f.control_id)); return run.controls_meta.filter(c => !active.has(c.id)).length })() : undefined },
        { page: 'audit',    label: 'Audit Log',        icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
        { page: 'evidence', label: 'Evidence Package', gate: settings.evidenceCollection, icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
        { page: 'regions',  label: 'Deployed Regions', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      ],
    },
    {
      id: 'architect', label: 'Architect', color: '#8b5cf6',
      items: [
        { page: 'catalogue',   label: 'Controls Catalogue', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',                                                                                                                                                                                                                     badge: { label: run ? String(run.controls_meta.length || run.controls_loaded || 0) : '73+', variant: 'neutral' as const } },
        { page: 'exploitpath', label: 'Exploit Paths',      icon: 'M13 10V3L4 14h7v7l9-11h-7z',                                                                                                                                                                                                                                                                                                                                                   danger: true },
        { page: 'blastradius', label: 'Blast Radius',       gate: settings.blastRadius, icon: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z',                                                                                                    badge: run ? { label: String(new Set(run.findings.filter(f => f.status?.toUpperCase() === 'FAIL').map(f => f.resource).filter(Boolean)).size), variant: 'fail' as const } : null },
        { page: 'depgraph',    label: 'Dependency Graph',   gate: settings.dependencyGraph, icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-10l6-3m0 13l5.447-2.724A1 1 0 0021 16.382V5.618a1 1 0 00-1.447-.894L15 7m0 13V7',                                                                                                                                                                         badge: run ? { label: String(new Set(run.findings.map(f => f.resource).filter(Boolean)).size), variant: 'neutral' as const } : null },
        { page: 'modules',     label: 'Module Scores',      icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',                                                                                          badge: (() => { if (!run) return null; const paths = new Set(run.findings.map(f => { if (!f.resource?.startsWith('module.')) return '(root)'; const p = f.resource.split('.'); const s: string[] = []; let i = 0; while (i < p.length - 1 && p[i] === 'module') { s.push(`module.${p[i+1]}`); i += 2; } return s.join('.') || '(root)' })); return { label: String(paths.size), variant: 'neutral' as const } })() },
        { page: 'changes',     label: 'Changes & Drift',    gate: settings.driftDetection, icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',                                                                                                                                                                                                                                                                                            badge: (() => { if (!run?.plan_changes) return null; const total = (run.plan_changes.summary.add ?? 0) + (run.plan_changes.summary.change ?? 0) + (run.plan_changes.summary.destroy ?? 0) + (run.plan_changes.summary.replace ?? 0); if (total === 0) return null; const hasSec = run.plan_changes.changes.some(c => { const b = (c.before ?? {}) as Record<string, unknown>; const a = (c.after ?? {}) as Record<string, unknown>; return ['policy','assume_role_policy','ingress','egress','cidr_blocks','encryption_configuration','kms_key_id','kms_key_arn','acl'].some(k => JSON.stringify(b[k] ?? null) !== JSON.stringify(a[k] ?? null)) }); return { label: String(total), variant: (hasSec ? 'fail' : 'neutral') as 'fail' | 'neutral' } })() },
        { page: 'sandbox',     label: 'Sandbox',            icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
      ],
    },
    {
      id: 'engineer', label: 'Engineer', color: '#22c55e',
      items: [
        { page: 'findings',    label: 'Findings',           icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',                                                                                                                                                                                                                                badge: failCount > 0 ? { label: String(failCount), variant: 'fail' as const } : null },
        { page: 'secrets',     label: 'Secret Scanner',     gate: settings.secretScanner, icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',                                                                                                                                                                                                                                danger: true, badge: (() => { if (!run) return null; const SECRET_RE = [/hardcod/i, /plaintext/i, /no.hardcoded/i, /secret/i, /credential/i, /password/i, /api[_.\s-]?key/i, /private[_.\s-]?key/i, /access[_.\s-]?key/i, /token/i, /kms/i, /encrypt/i, /rotation/i]; const n = run.findings.filter(f => f.status?.toUpperCase() === 'FAIL' && SECRET_RE.some(re => re.test([f.control_id, f.check_id, f.check_title, f.message].join(' ')))).length; return n > 0 ? { label: String(n), variant: 'fail' as const } : null })() },
        { page: 'remediation', label: 'Remediation Sprint', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
      ],
    },
    {
      id: 'runs_nav', label: 'Runs', color: '#22c55e', minRole: 'engineer',
      items: [
        { page: 'runscan', label: 'Run Scan',       icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
        { page: 'runs',    label: 'Run History',    icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z', count: runs.length > 0 ? runs.length : undefined },
        { page: 'diff',    label: 'Run Comparison', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
      ],
    },
    {
      id: 'admin', label: 'Admin', color: '#f87171', minRole: 'admin',
      items: [
        { page: 'users',         label: 'Users',          icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
        { page: 'sso',           label: 'SSO Settings',   icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
        { page: 'apikeys',       label: 'API Keys',       icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
        { page: 'groupmappings', label: 'Group Mappings', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
      ],
    },
    {
      id: 'system', label: 'System', color: '#94a3b8', minRole: 'clevel',
      items: [
        { page: 'access',   label: 'Access & Roles', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
        { page: 'settings', label: 'Settings',       icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
        { page: 'feedback', label: 'Feedback',       icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
      ],
    },
  ]

  // Only show sections the user's role has access to
  const visibleSections = navSections.filter(s => hasMinRole(role, s.minRole ?? s.id))

  // Collapsed/expanded state — persisted in localStorage
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('wafpass_nav_expanded') ?? '{}') } catch { return {} }
  })
  function toggleSection(id: string, forceExpand?: boolean) {
    setExpandedSections(prev => {
      const next = { ...prev, [id]: forceExpand !== undefined ? forceExpand : !prev[id] }
      try { localStorage.setItem('wafpass_nav_expanded', JSON.stringify(next)) } catch {}
      return next
    })
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {showRunModal && (
        <RunSelectorModal
          runs={runs}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onClose={() => setShowRunModal(false)}
        />
      )}
      {/* Sidebar */}
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
              onClick={() => setShowRunModal(true)}
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

            // Only collapse if there are 2+ overflow items; 1 extra item is shown directly
            const threshold   = items.length - 2 >= 2 ? 2 : items.length
            const visibleItems = items.slice(0, threshold)
            const hiddenItems  = items.slice(threshold)
            // Auto-expand if the active page lives in the collapsed portion
            const activeInHidden = hiddenItems.some(i => i.page === page)
            const isExpanded = !!(expandedSections[section.id] || activeInHidden)

            function renderNavItem(item: NavEntry) {
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
                      color:      item.badge.variant === 'fail' ? '#fca5a5' : 'var(--sidebar-text)',
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

                {visibleItems.map(renderNavItem)}

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
                        opacity: 0.8,
                        transition: 'opacity 0.15s',
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
                    {isExpanded && hiddenItems.map(renderNavItem)}
                  </>
                )}
              </div>
            )
          })}
        </nav>

        {/* Policy version / controls footer */}
        {run && (
          <div style={{ padding: '0.625rem 1.25rem', borderTop: '1px solid var(--sidebar-border)' }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--sidebar-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>Policy Version</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                background: 'rgba(0,148,255,0.15)', border: '1px solid rgba(0,148,255,0.35)',
                borderRadius: '999px', padding: '0.18rem 0.6rem',
                fontSize: '0.72rem', fontWeight: 700, color: '#60a5fa', letterSpacing: '0.02em',
              }}>
                v1.0.0
              </span>
              {run.controls_loaded > 0 && (
                <span style={{ fontSize: '0.65rem', color: 'var(--sidebar-muted)' }}>{run.controls_loaded} controls</span>
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

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
        {/* Top header */}
        <header style={{
          background: 'rgba(247,248,251,.95)', backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)', padding: '0.75rem 1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              {PAGE_TITLE[page]}
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: 0 }}>
              {PAGE_SUBTITLE[page]}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {run && page !== 'runs' && page !== 'diff' && page !== 'catalogue' && page !== 'settings' && page !== 'runscan' && page !== 'sandbox' && page !== 'waivers' && page !== 'risk' && page !== 'audit' && page !== 'evidence' && page !== 'feedback' && page !== 'projectoverview' && page !== 'passports' && (
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                {run.project && <><strong style={{ color: 'var(--text)' }}>{run.project}</strong> · </>}
                {run.branch && <>{run.branch} · </>}
                {new Date(run.created_at).toLocaleString()}
              </span>
            )}
            {/* Copy deep-link button — always visible */}
            <button
              onClick={copyLink}
              title="Copy link to this page"
              style={{
                display: 'flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.35rem 0.7rem', borderRadius: '8px',
                background: linkCopied ? 'rgba(34,197,94,.12)' : 'var(--bg)',
                color: linkCopied ? '#15803d' : 'var(--muted)',
                border: `1px solid ${linkCopied ? 'rgba(34,197,94,.4)' : 'var(--border)'}`,
                cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                transition: 'all 0.15s',
              }}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {linkCopied
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                }
              </svg>
              {linkCopied ? 'Copied!' : 'Copy link'}
            </button>
            {run && page === 'dashboard' && (
              <button
                onClick={handleSharePdf}
                title={settings.pdfAutoOpen ? 'Share as PDF (auto-open enabled in settings)' : 'Share as PDF'}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.4rem 0.875rem', borderRadius: '8px',
                  background: 'var(--waf-brand)', color: '#fff',
                  border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                  boxShadow: '0 2px 8px rgba(0,148,255,.30)',
                }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Share as PDF
              </button>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {page === 'passports' ? (
            <PassportDashboardPage
              runs={runs}
              role={role}
              onOpenProject={project => { setSelectedProject(project); navigate('projectoverview') }}
            />
          ) : page === 'projectoverview' ? (
            <ProjectOverviewPage
              runs={runs}
              role={role}
              initialProject={selectedProject ?? undefined}
              onSelect={id => { setSelectedId(id); navigate('dashboard') }}
              onBack={() => navigate('passports')}
            />
          ) : page === 'users' ? (
            <UserManagementPage />
          ) : page === 'groupmappings' ? (
            <GroupMappingsPage />
          ) : page === 'apikeys' ? (
            <ApiManagementPage />
          ) : page === 'sso' ? (
            <SsoSettingsPage />
          ) : page === 'access' ? (
            <AccessRolesPage />
          ) : page === 'feedback' ? (
            <FeedbackPage />
          ) : page === 'settings' ? (
            <SettingsPage maturityLevel={maturityLevel} settings={settings} onChange={handleSettingsChange} />
          ) : page === 'runscan' ? (
            <RunScanPage />
          ) : page === 'sandbox' ? (
            <SandboxPage />
          ) : page === 'waivers' ? (
            <WaiversPage controls={availableControls} />
          ) : page === 'risk' ? (
            <RiskAcceptancePage controls={availableControls} />
          ) : page === 'audit' ? (
            <AuditLogPage />
          ) : page === 'evidence' ? (
            <EvidencePage run={run} />
          ) : page === 'runs' ? (
            <RunsListPage runs={runs} onSelect={id => { setSelectedId(id); navigate('dashboard') }} />
          ) : page === 'diff' ? (
            <RunDiffPage runs={runs} />
          ) : page === 'catalogue' ? (
            <ControlsCataloguePage coreControls={run?.controls_meta ?? []} />
          ) : page === 'skipped' ? (
            <SkippedControlsPage run={run} />
          ) : loadingRun ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
              <div className="spinner" />
            </div>
          ) : !run && runs.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* First-run welcome banner */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '1.25rem',
                padding: '1.25rem 1.5rem', borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(0,148,255,.08) 0%, rgba(124,58,237,.06) 100%)',
                border: '1px solid rgba(0,148,255,.25)',
              }}>
                <div style={{
                  flexShrink: 0, width: '40px', height: '40px', borderRadius: '10px',
                  background: 'rgba(0,148,255,.15)', border: '1px solid rgba(0,148,255,.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="20" height="20" fill="none" stroke="var(--waf-brand)" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.3rem' }}>
                    Welcome to WAF++ PASS
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.6 }}>
                    No scan results yet. Run your first <code style={{ color: 'var(--waf-brand)', background: 'rgba(0,148,255,.08)', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.78rem' }}>wafpass check</code> and push the results here to see your compliance dashboard — follow the guide below to get started in under 2 minutes.
                  </div>
                </div>
              </div>
              <RunScanPage />
            </div>
          ) : !run ? (
            <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: '4rem', fontSize: '0.85rem' }}>
              Select a run to view results.
            </div>
          ) : page === 'dashboard' ? (
            <DashboardPage run={run} onNav={p => navigate(p as Page)} waiverCount={waiverCount} riskCount={riskCount} runCount={runs.length} />
          ) : page === 'findings' ? (
            <FindingsPage run={run} />
          ) : page === 'compliance' ? (
            <CompliancePage run={run} />
          ) : page === 'gapanalysis' ? (
            <GapAnalysisPage run={run} />
          ) : page === 'changes' ? (
            <ChangesPage run={run} runs={runs} />
          ) : page === 'regions' ? (
            <RegionsPage run={run} />
          ) : page === 'exploitpath' ? (
            <ExploitPathsPage run={run} />
          ) : page === 'blastradius' ? (
            <BlastRadiusPage run={run} />
          ) : page === 'depgraph' ? (
            <DependencyGraphPage run={run} />
          ) : page === 'remediation' ? (
            <RemediationSprintPage run={run} />
          ) : page === 'secrets' ? (
            <SecretScanPage run={run} />
          ) : page === 'modules' ? (
            <ModuleScorePage run={run} />
          ) : page === 'cost' ? (
            <CostImpactPage run={run} />
          ) : null}
        </main>
      </div>
      {/* PDF report — hidden in normal view, shown only during print */}
      {run && (
        <div id="wafpass-pdf-root" style={{ display: 'none' }}>
          <PdfReport run={run} settings={settings} maturityLevel={maturityLevel} />
        </div>
      )}
    </div>
  )
}
