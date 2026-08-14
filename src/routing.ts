export const ALL_PAGES = [
  'dashboard', 'globaldashboard', 'catalogue', 'findings', 'compliance', 'gapanalysis', 'regions',
  'exploitpath', 'blastradius', 'depgraph', 'remediation', 'secrets', 'modules',
  'cost', 'runs', 'diff', 'audit', 'evidence', 'settings', 'runscan', 'sandbox',
  'waivers', 'risk', 'changes', 'feedback', 'skipped', 'access', 'users', 'apikeys', 'sso', 'groupmappings', 'controlspacks',
  'projectoverview', 'passports', 'badge', 'leaderboard', 'journey', 'userprefs',
  'reference', 'antipattern', 'notifications', 'legal', 'projectgroups', 'pipelines',
  'compliance-readiness', 'autofix', 'engineering', 'architecture', 'maturity', 'rfc',
] as const

export type Page = typeof ALL_PAGES[number]

export const PAGE_SET = new Set<string>(ALL_PAGES)

export const PAGE_TITLE: Record<Page, string> = {
  dashboard:       'Executive Dashboard',
  globaldashboard: 'Flight Operations Center',
  catalogue:       'Controls Catalogue',
  findings:        'Scan Findings',
  compliance:      'Security Operations Center',
  gapanalysis:     'Regulatory Gap Analysis',
  regions:         'Deployed Regions',
  exploitpath:     'Exploit Path Analysis',
  blastradius:     'Blast Radius',
  depgraph:        'Dependency Graph',
  remediation:     'Remediation Sprint',
  secrets:         'Secret Scanner',
  modules:         'Module Score Breakdown',
  cost:            'Cost Operations Center',
  runs:            'Run History',
  diff:            'Run Comparison',
  audit:           'Audit Log',
  evidence:        'Evidence Package',
  settings:        'Settings',
  runscan:         'Run Scan',
  sandbox:         'Architect Sandbox',
  waivers:         'Waivers Manager',
  risk:            'Risk Acceptance',
  changes:         'Changes & Drift',
  feedback:        'Feedback',
  skipped:         'Skipped Controls',
  access:          'Access & Roles',
  users:           'User Management',
  apikeys:         'API Key Management',
  sso:             'SSO Settings',
  groupmappings:   'Group → Role Mappings',
  controlspacks:   'Controls Upgrade',
  projectoverview: 'Project Overview',
  passports:       'Project Passports',
  projectgroups:   'Project Groups',
  badge:           'Badge Integration',
  leaderboard:     'Hall of Fame',
  journey:         'Maturity Journey',
  userprefs:       'My Preferences',
  reference:       'Reference Architecture',
  antipattern:     'Anti-Pattern Museum',
  notifications:   'Notifications',
  legal:           'Legal Notice',
  pipelines:       'Pipeline Operations Center',
  'compliance-readiness': 'Compliance Readiness',
  autofix: 'Auto-Fix Wizard',
  engineering: 'Engineering Operations Center',
  architecture: 'Architecture Operations Center',
  maturity: 'Maturity Operations Center',
  rfc: 'RFC Tracker',
}

export const PAGE_SUBTITLE: Record<Page, string> = {
  dashboard:       'Risk posture overview across all WAF++ pillars',
  globaldashboard: 'Global flight operations view: project portfolio, maturity journey, and control matrix',
  catalogue:       'All WAF++ framework controls and your custom controls — browse, filter, author, and export',
  findings:        'Detailed results from the selected run',
  compliance:      'Security command center: pillar coverage, pass rates and regulatory framework mapping',
  gapanalysis:     'Shortest path to framework compliance — controls ranked by effort-per-requirement, with remediation steps and evidence export',
  changes:         'IaC plan changes (adds, updates, replacements, destroys) and compliance drift — controls that regressed or recovered since the previous run',
  regions:         'Detected cloud deployment regions',
  exploitpath:     'Attack chain visualization · internet-facing surfaces are highest criticality',
  blastradius:     'Interactive dependency graph of all failing resources and their structural propagation paths',
  depgraph:        'Full resource dependency graph — all resources colored by compliance status, with connected-subgraph highlighting',
  remediation:     'Prioritised fix queue — select controls to form a sprint and see your projected score gain, resources fixed, and regulatory gaps closed',
  secrets:         'Hardcoded credential issues detected in IaC — passwords, API keys, tokens, and private keys that must be migrated to a secrets manager',
  modules:         'Per-module pass rate and score drag — identify which module is pulling the overall score down',
  cost:            'Live cost operations center: financial exposure, burn-down projection, savings opportunities, and governance risk for failing WAF-COST controls',
  runs:            'All recorded WAF++ scan runs',
  diff:            'Finding-level diff between two runs — newly broken controls, fixed controls, score delta per pillar',
  audit:           'Tamper-evident record of every waiver, risk acceptance, and scan event — export for SOC2/ISO27001 evidence collection',
  evidence:        'Generate a timestamped, auditor-ready evidence package — passing controls, waivers, risk acceptances, and audit trail',
  settings:        'Configure scan defaults, maturity level, and feature toggles',
  runscan:         'Trigger a WAF++ scan from the UI or generate a CLI command',
  sandbox:         'Evaluate HCL snippets against WAF++ controls instantly',
  waivers:         'Suppress controls from failing · export as .wafpass-skip.yml',
  risk:            'Formally accept or mitigate risks — with approver, expiry and traceability',
  feedback:        'Share your thoughts with the WAF++ team — we read every message',
  skipped:         'Controls skipped by the engine, waived, or risk-accepted — review your coverage gaps',
  access:          'Role definitions and page-level access model',
  users:           'Create, edit, activate/deactivate, and delete user accounts',
  apikeys:         'Generate and revoke API keys for CI/CD pipelines and service accounts',
  sso:             'Configure OIDC and SAML2 single sign-on for your organisation',
  groupmappings:   'Map IdP group memberships to WAF++ roles — evaluated first during SSO login',
  controlspacks:   'Sync and activate versioned WAF++ control packs — import, roll back, and track control catalogue changes',
  projectoverview: 'Per-project score trends, maturity progression, and achievement tracking across all scans',
  passports:       'All project passports at a glance — owner, criticality, environment, recent achievements',
  projectgroups:   'Group-based access control — assign teams to projects for run access management',
  badge:           'Embed a live status badge in GitHub/GitLab READMEs, HTML docs, AsciiDoc, RST — with CI gate examples',
  leaderboard:     'Top sovereign projects by Tier 5 tenure and most improved teams in the last 30 days',
  journey:         'Your flight from ground to cruise altitude — the story of building secure cloud infrastructure',
  userprefs:       'Appearance, navigation defaults, date formats, and report behaviour — stored in this browser',
  reference:       'Complete system architecture documentation — wafpass-core, wafpass-server, wafpass-dashboard',
  antipattern:     "Side-by-side 'Bad vs. Good' code comparisons for each WAF++ pillar",
  notifications:   'System notifications — updates, urgent alerts, and important announcements',
  legal:           'Liability disclaimer, terms of use, and open source notice',
  pipelines:       'CI/CD dashboard: scan volume, pass rate, average score, active projects, and recent pipeline activity.',
  'compliance-readiness': 'Evidence collection status and audit readiness scores — prepare for compliance audits with offline support',
  autofix: 'Preview, review, and apply automated IaC remediations from a single page',
  engineering: 'Single pane for findings, remediation sprints, secrets, and infrastructure change drift',
  architecture: 'Design intelligence: controls, attack paths, blast radius, dependencies, modules, sandbox, and reference architecture',
  maturity: 'Company and project maturity journey, stage progression, and next milestones',
  rfc: 'Cross-repository Request for Comments tracker — status, authors, and commenters',
}

export interface FilterState {
  search?: string
  statusFilter?: string
  severityFilter?: string
  pillarFilter?: string
  [key: string]: string | undefined
}

export function parseHash(): { page: Page; runId: string | null; filters: FilterState } {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const qi = raw.indexOf('?')
  const slug = qi >= 0 ? raw.slice(0, qi) : raw
  const query = qi >= 0 ? raw.slice(qi + 1) : ''
  const params = new URLSearchParams(query)

  return {
    page: PAGE_SET.has(slug) ? (slug as Page) : 'dashboard',
    runId: params.get('run'),
    filters: Object.fromEntries(params.entries()) as FilterState,
  }
}

export function buildHash(page: Page, runId: string | null, filters: FilterState = {}): string {
  const params = new URLSearchParams()
  if (runId) params.set('run', runId)
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') {
      params.set(key, value)
    }
  }
  const query = params.toString()
  return query ? `#/${page}?${query}` : `#/${page}`
}

export function scoreColor(s: number): string {
  return s >= 80 ? '#059669' : s >= 60 ? '#d97706' : '#DA2C38'
}

export function buildJourneyHash(filters: FilterState = {}): string {
  return buildHash('journey', null, filters)
}
