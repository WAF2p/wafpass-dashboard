import { useEffect, useState } from 'react'
import { fetchRun, fetchRuns, RunDetail, RunSummary } from './api'
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
import AuditLogPage from './pages/AuditLogPage'

type Page = 'dashboard' | 'catalogue' | 'findings' | 'compliance' | 'regions' | 'exploitpath' | 'blastradius' | 'depgraph' | 'remediation' | 'secrets' | 'modules' | 'runs' | 'diff' | 'audit' | 'settings' | 'runscan' | 'sandbox' | 'waivers' | 'risk' | 'changes' | 'feedback'

const PAGE_TITLE: Record<Page, string> = {
  dashboard:   'Executive Dashboard',
  catalogue:   'Controls Catalogue',
  findings:    'Scan Findings',
  compliance:  'Compliance Matrix',
  regions:     'Deployed Regions',
  exploitpath:  'Exploit Path Analysis',
  blastradius:  'Blast Radius',
  depgraph:     'Dependency Graph',
  remediation:  'Remediation Sprint',
  secrets:      'Secret Scanner',
  modules:      'Module Score Breakdown',
  runs:        'Run History',
  diff:        'Run Comparison',
  audit:       'Audit Log',
  settings:    'Settings',
  runscan:     'Run Scan',
  sandbox:     'Architect Sandbox',
  waivers:     'Waivers Manager',
  risk:        'Risk Acceptance',
  changes:     'Changes & Drift',
  feedback:    'Feedback',
}

const PAGE_SUBTITLE: Record<Page, string> = {
  dashboard:   'Risk posture overview across all WAF++ pillars',
  catalogue:   'All WAF++ framework controls and your custom controls — browse, filter, author, and export',
  findings:    'Detailed results from the selected run',
  compliance:  'Pillar coverage, pass rates and regulatory framework mapping',
  changes:     'Terraform plan changes (adds, updates, replacements, destroys) and compliance drift — controls that regressed or recovered since the previous run',
  regions:     'Detected cloud deployment regions',
  exploitpath:  'Attack chain visualization · internet-facing surfaces are highest criticality',
  blastradius:  'Interactive dependency graph of all failing resources and their structural propagation paths',
  depgraph:     'Full resource dependency graph — all resources colored by compliance status, with connected-subgraph highlighting',
  remediation:  'Prioritised fix queue — select controls to form a sprint and see your projected score gain, resources fixed, and regulatory gaps closed',
  secrets:      'Hardcoded credential issues detected in IaC — passwords, API keys, tokens, and private keys that must be migrated to a secrets manager',
  modules:      'Per-module pass rate and score drag — identify which Terraform module is pulling the overall score down',
  runs:        'All recorded WAF++ scan runs',
  diff:        'Finding-level diff between two runs — newly broken controls, fixed controls, score delta per pillar',
  audit:       'Tamper-evident record of every waiver, risk acceptance, and scan event — export for SOC2/ISO27001 evidence collection',
  settings:    'Configure scan defaults, maturity level, and feature toggles',
  runscan:     'Trigger a WAF++ scan from the UI or generate a CLI command',
  sandbox:     'Evaluate Terraform HCL snippets against WAF++ controls instantly',
  waivers:     'Suppress controls from failing · export as .wafpass-skip.yml',
  risk:        'Formally accept or mitigate risks — with approver, expiry and traceability',
  feedback:    'Share your thoughts with the WAF++ team — we read every message',
}

function scoreColor(s: number) {
  return s >= 80 ? '#059669' : s >= 60 ? '#d97706' : '#DA2C38'
}

export default function App() {
  const [runs, setRuns] = useState<RunSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [run, setRun] = useState<RunDetail | null>(null)
  const [loadingRun, setLoadingRun] = useState(false)
  const [page, setPage] = useState<Page>('dashboard')
  const [runsError, setRunsError] = useState<string | null>(null)
  const [waiverCount, setWaiverCount] = useState(0)
  const [riskCount, setRiskCount] = useState(0)
  const [showRunModal, setShowRunModal] = useState(false)
  function handleSharePdf() {
    window.print()
  }

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
        if (data.length > 0) setSelectedId(data[0].id)
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

  const navItems: { page: Page; label: string; icon: string; badge?: { label: string; variant: 'fail' | 'neutral' } | null; danger?: boolean; divider?: boolean }[] = [
    { page: 'dashboard',   label: 'Dashboard',         icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { page: 'catalogue',   label: 'Controls Catalogue', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4', badge: { label: run ? String(run.controls_meta.length || run.controls_loaded || 0) : '73+', variant: 'neutral' } },
    { page: 'findings',    label: 'Findings',          icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', badge: failCount > 0 ? { label: String(failCount), variant: 'fail' } : null },
    { page: 'compliance',  label: 'Compliance Matrix', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { page: 'changes',     label: 'Changes & Drift',   icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4', badge: (() => { if (!run?.plan_changes) return null; const total = (run.plan_changes.summary.add ?? 0) + (run.plan_changes.summary.change ?? 0) + (run.plan_changes.summary.destroy ?? 0) + (run.plan_changes.summary.replace ?? 0); if (total === 0) return null; const hasSec = run.plan_changes.changes.some(c => { const b = (c.before ?? {}) as Record<string, unknown>; const a = (c.after ?? {}) as Record<string, unknown>; return ['policy','assume_role_policy','ingress','egress','cidr_blocks','encryption_configuration','kms_key_id','kms_key_arn','acl'].some(k => JSON.stringify(b[k] ?? null) !== JSON.stringify(a[k] ?? null)) }); return { label: String(total), variant: (hasSec ? 'fail' : 'neutral') as 'fail' | 'neutral' } })() },
    { page: 'regions',     label: 'Deployed Regions',  icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { page: 'exploitpath',  label: 'Exploit Paths',     icon: 'M13 10V3L4 14h7v7l9-11h-7z', danger: true },
    { page: 'blastradius',  label: 'Blast Radius',      icon: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z', badge: run ? { label: String(new Set(run.findings.filter(f => f.status?.toUpperCase() === 'FAIL').map(f => f.resource).filter(Boolean)).size), variant: 'fail' as const } : null },
    { page: 'depgraph',    label: 'Dependency Graph',  icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-10l6-3m0 13l5.447-2.724A1 1 0 0021 16.382V5.618a1 1 0 00-1.447-.894L15 7m0 13V7', badge: run ? { label: String(new Set(run.findings.map(f => f.resource).filter(Boolean)).size), variant: 'neutral' as const } : null },
    { page: 'remediation',  label: 'Remediation Sprint', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { page: 'secrets', label: 'Secret Scanner', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', danger: true, badge: (() => { if (!run) return null; const SECRET_RE = [/hardcod/i, /plaintext/i, /no.hardcoded/i, /secret/i, /credential/i, /password/i, /api[_.\s-]?key/i, /private[_.\s-]?key/i, /access[_.\s-]?key/i, /token/i, /kms/i, /encrypt/i, /rotation/i]; const n = run.findings.filter(f => f.status?.toUpperCase() === 'FAIL' && SECRET_RE.some(re => re.test([f.control_id, f.check_id, f.check_title, f.message].join(' ')))).length; return n > 0 ? { label: String(n), variant: 'fail' as const } : null })() },
    { page: 'modules', label: 'Module Scores', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z', badge: (() => { if (!run) return null; const paths = new Set(run.findings.map(f => { if (!f.resource?.startsWith('module.')) return '(root)'; const p = f.resource.split('.'); const s: string[] = []; let i = 0; while (i < p.length - 1 && p[i] === 'module') { s.push(`module.${p[i+1]}`); i += 2; } return s.join('.') || '(root)' })); return { label: String(paths.size), variant: 'neutral' as const } })() },
  ]

  const toolItems: { page: Page; label: string; icon: string; count?: number }[] = [
    { page: 'runscan', label: 'Run Scan',        icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { page: 'sandbox', label: 'Sandbox',         icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
    { page: 'waivers', label: 'Waivers',         icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', count: waiverCount },
    { page: 'risk',    label: 'Risk Acceptance', icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', count: riskCount },
    { page: 'audit',   label: 'Audit Log',       icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  ]

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
            onClick={() => setPage('settings')}
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
        <nav style={{ flex: 1, padding: '0.75rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {navItems.map(item => (
            <button
              key={item.page}
              onClick={() => setPage(item.page)}
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
            </button>
          ))}

          <div style={{ borderTop: '1px solid var(--sidebar-border)', margin: '0.5rem 0' }} />

          {/* Run History */}
          <button
            onClick={() => setPage('runs')}
            className={`sidebar-link${page === 'runs' ? ' active' : ''}`}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            Run History
            {runs.length > 0 && (
              <span style={{ marginLeft: 'auto', fontSize: '0.65rem', borderRadius: '999px', padding: '0.1rem 0.45rem', background: 'rgba(255,255,255,.08)', color: 'var(--sidebar-text)' }}>
                {runs.length}
              </span>
            )}
          </button>

          {/* Run Comparison */}
          <button
            onClick={() => setPage('diff')}
            className={`sidebar-link${page === 'diff' ? ' active' : ''}`}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Run Comparison
          </button>

          <div style={{ borderTop: '1px solid var(--sidebar-border)', margin: '0.5rem 0' }} />

          {/* Tools */}
          <div style={{ fontSize: '0.58rem', color: 'var(--sidebar-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, padding: '0 0.5rem', marginBottom: '2px' }}>
            Tools
          </div>
          {toolItems.map(item => (
            <button
              key={item.page}
              onClick={() => setPage(item.page)}
              className={`sidebar-link${page === item.page ? ' active' : ''}`}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              {item.label}
              {item.count != null && item.count > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: '0.65rem', borderRadius: '999px', padding: '0.1rem 0.45rem', background: 'rgba(255,255,255,.08)', color: 'var(--sidebar-text)' }}>
                  {item.count}
                </span>
              )}
            </button>
          ))}

          <div style={{ borderTop: '1px solid var(--sidebar-border)', margin: '0.5rem 0' }} />

          {/* Settings */}
          <button
            onClick={() => setPage('settings')}
            className={`sidebar-link${page === 'settings' ? ' active' : ''}`}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>

          {/* Feedback */}
          <button
            onClick={() => setPage('feedback')}
            className={`sidebar-link${page === 'feedback' ? ' active' : ''}`}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Feedback
          </button>
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
                v0.4.0
              </span>
              {run.controls_loaded > 0 && (
                <span style={{ fontSize: '0.65rem', color: 'var(--sidebar-muted)' }}>{run.controls_loaded} controls</span>
              )}
            </div>
          </div>
        )}

        <div style={{ padding: '0.5rem 1.25rem', borderTop: '1px solid var(--sidebar-border)', fontSize: '0.65rem', color: 'var(--sidebar-muted)' }}>
          WAF++ PASS v0.4.0
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
            {run && page !== 'runs' && page !== 'diff' && page !== 'catalogue' && page !== 'settings' && page !== 'runscan' && page !== 'sandbox' && page !== 'waivers' && page !== 'risk' && page !== 'audit' && page !== 'feedback' && (
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                {run.project && <><strong style={{ color: 'var(--text)' }}>{run.project}</strong> · </>}
                {run.branch && <>{run.branch} · </>}
                {new Date(run.created_at).toLocaleString()}
              </span>
            )}
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
          {page === 'feedback' ? (
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
          ) : page === 'runs' ? (
            <RunsListPage runs={runs} onSelect={id => { setSelectedId(id); setPage('dashboard') }} />
          ) : page === 'diff' ? (
            <RunDiffPage runs={runs} />
          ) : page === 'catalogue' ? (
            <ControlsCataloguePage coreControls={run?.controls_meta ?? []} />
          ) : loadingRun ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
              <div className="spinner" />
            </div>
          ) : !run ? (
            <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: '4rem' }}>
              {runs.length === 0
                ? <>No runs yet. Run <code>wafpass check --push http://localhost:8000</code> to get started.</>
                : 'Select a run to view results.'
              }
            </div>
          ) : page === 'dashboard' ? (
            <DashboardPage run={run} onNav={p => setPage(p as Page)} />
          ) : page === 'findings' ? (
            <FindingsPage run={run} />
          ) : page === 'compliance' ? (
            <CompliancePage run={run} />
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
