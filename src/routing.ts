export const ALL_PAGES = [
  'dashboard', 'globaldashboard', 'catalogue', 'findings', 'compliance', 'gapanalysis', 'regions',
  'exploitpath', 'blastradius', 'depgraph', 'remediation', 'secrets', 'modules',
  'cost', 'runs', 'diff', 'audit', 'evidence', 'settings', 'runscan', 'sandbox',
  'waivers', 'risk', 'changes', 'feedback', 'skipped', 'access', 'users', 'apikeys', 'sso', 'groupmappings', 'controlspacks',
  'projectoverview', 'passports', 'badge', 'leaderboard', 'journey', 'userprefs',
  'reference', 'antipattern', 'notifications',
] as const

export type Page = typeof ALL_PAGES[number]

export const PAGE_SET = new Set<string>(ALL_PAGES)

export const PAGE_TITLE: Record<Page, string> = {
  dashboard:       'Executive Dashboard',
  globaldashboard: 'Global Overview',
  catalogue:       'Controls Catalogue',
  findings:        'Scan Findings',
  compliance:      'Compliance Matrix',
  gapanalysis:     'Regulatory Gap Analysis',
  regions:         'Deployed Regions',
  exploitpath:     'Exploit Path Analysis',
  blastradius:     'Blast Radius',
  depgraph:        'Dependency Graph',
  remediation:     'Remediation Sprint',
  secrets:         'Secret Scanner',
  modules:         'Module Score Breakdown',
  cost:            'Cost Impact Estimation',
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
  badge:           'Badge Integration',
  leaderboard:     'Hall of Fame',
  journey:         'Maturity Journey',
  userprefs:       'My Preferences',
  reference:       'Reference Architecture',
  antipattern:     'Anti-Pattern Museum',
  notifications:   'Notifications',
}

export const PAGE_SUBTITLE: Record<Page, string> = {
  dashboard:       'Risk posture overview across all WAF++ pillars',
  globaldashboard: 'Global view: project portfolio, maturity journey, and control matrix',
  catalogue:       'All WAF++ framework controls and your custom controls — browse, filter, author, and export',
  findings:        'Detailed results from the selected run',
  compliance:      'Pillar coverage, pass rates and regulatory framework mapping',
  gapanalysis:     'Shortest path to framework compliance — controls ranked by effort-per-requirement, with remediation steps and evidence export',
  changes:         'Terraform plan changes (adds, updates, replacements, destroys) and compliance drift — controls that regressed or recovered since the previous run',
  regions:         'Detected cloud deployment regions',
  exploitpath:     'Attack chain visualization · internet-facing surfaces are highest criticality',
  blastradius:     'Interactive dependency graph of all failing resources and their structural propagation paths',
  depgraph:        'Full resource dependency graph — all resources colored by compliance status, with connected-subgraph highlighting',
  remediation:     'Prioritised fix queue — select controls to form a sprint and see your projected score gain, resources fixed, and regulatory gaps closed',
  secrets:         'Hardcoded credential issues detected in IaC — passwords, API keys, tokens, and private keys that must be migrated to a secrets manager',
  modules:         'Per-module pass rate and score drag — identify which Terraform module is pulling the overall score down',
  cost:            'Estimated $/month impact for failing WAF-COST controls — waste, savings opportunities, and financial governance risk',
  runs:            'All recorded WAF++ scan runs',
  diff:            'Finding-level diff between two runs — newly broken controls, fixed controls, score delta per pillar',
  audit:           'Tamper-evident record of every waiver, risk acceptance, and scan event — export for SOC2/ISO27001 evidence collection',
  evidence:        'Generate a timestamped, auditor-ready evidence package — passing controls, waivers, risk acceptances, and audit trail',
  settings:        'Configure scan defaults, maturity level, and feature toggles',
  runscan:         'Trigger a WAF++ scan from the UI or generate a CLI command',
  sandbox:         'Evaluate Terraform HCL snippets against WAF++ controls instantly',
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
  badge:           'Embed a live status badge in GitHub/GitLab READMEs, HTML docs, AsciiDoc, RST — with CI gate examples',
  leaderboard:     'Top sovereign projects by Tier 5 tenure and most improved teams in the last 30 days',
  journey:         'Your flight from ground to cruise altitude — the story of building secure cloud infrastructure',
  userprefs:       'Appearance, navigation defaults, date formats, and report behaviour — stored in this browser',
  reference:       'Complete system architecture documentation — wafpass-core, wafpass-server, wafpass-dashboard',
  antipattern:     "Side-by-side 'Bad vs. Good' code comparisons for each WAF++ pillar",
  notifications:   'System notifications — updates, urgent alerts, and important announcements',
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
