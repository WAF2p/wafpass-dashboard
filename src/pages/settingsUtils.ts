// Shared settings types and utilities — extracted so SettingsPage can be lazy-loaded.

export interface ReportSections {
  executiveSummary: boolean
  pillarBreakdown: boolean
  criticalFindings: boolean
  complianceMatrix: boolean
  architecturalDebt: boolean
  allFindings: boolean
  remediationPlan: boolean
  cloudFootprint: boolean
  planChanges: boolean
}

export interface Settings {
  // Scan
  defaultIac: string
  failOn: string
  defaultSeverity: string
  activePillars: string[]
  // Intelligence
  secretScanner: boolean
  autoFix: boolean
  blastRadius: boolean
  driftDetection: boolean
  complianceGating: boolean
  riskScoring: boolean
  dependencyGraph: boolean
  // Observability
  carbonTracking: boolean
  evidenceCollection: boolean
  multiCloudNormalization: boolean
  // UX
  pdfAutoOpen: boolean
  hideDisabledMenuItems: boolean
  // PDF Report
  reportSections: ReportSections
}

export interface MaturityState {
  level: number
  settings: Settings
}

export const ALL_PILLARS = ['security', 'cost', 'operations', 'reliability', 'performance', 'sovereign', 'sustainability']

export const PILLAR_COUNTS: Record<string, number> = {
  security: 13, cost: 10, operations: 10, reliability: 10,
  performance: 10, sovereign: 10, sustainability: 10,
}
export const SEV_COUNTS = { critical: 8, high: 34, medium: 28, low: 3 }
export const TOTAL_CONTROLS = 73

export function controlsForLevel(level: number): number {
  const sevThresholds: Record<number, string[]> = {
    1: ['critical'],
    2: ['critical', 'high'],
    3: ['critical', 'high', 'medium'],
    4: ['critical', 'high', 'medium', 'low'],
    5: ['critical', 'high', 'medium', 'low'],
  }
  const pillarsForLevel: Record<number, string[]> = {
    1: ['security'],
    2: ['security', 'cost'],
    3: ['security', 'cost', 'operations', 'reliability'],
    4: ALL_PILLARS.filter(p => p !== 'sustainability'),
    5: ALL_PILLARS,
  }
  const sevs = new Set(sevThresholds[level] ?? [])
  const sevFraction = Object.entries(SEV_COUNTS)
    .filter(([s]) => sevs.has(s))
    .reduce((n, [, c]) => n + c, 0) / TOTAL_CONTROLS
  const pillarCount = pillarsForLevel[level].reduce((n, p) => n + PILLAR_COUNTS[p], 0)
  return Math.round(pillarCount * sevFraction)
}

export const DEFAULT_REPORT_SECTIONS: ReportSections = {
  executiveSummary: true,
  pillarBreakdown: false,
  criticalFindings: false,
  complianceMatrix: false,
  architecturalDebt: false,
  allFindings: false,
  remediationPlan: false,
  cloudFootprint: false,
  planChanges: false,
}

export const DEFAULT_SETTINGS: Settings = {
  defaultIac: 'terraform',
  failOn: 'fail',
  defaultSeverity: '',
  activePillars: ALL_PILLARS,
  secretScanner: true,
  autoFix: true,
  blastRadius: true,
  driftDetection: false,
  complianceGating: false,
  riskScoring: false,
  dependencyGraph: false,
  carbonTracking: false,
  evidenceCollection: false,
  multiCloudNormalization: false,
  pdfAutoOpen: false,
  hideDisabledMenuItems: false,
  reportSections: DEFAULT_REPORT_SECTIONS,
}

export const MATURITY_PRESETS: Record<number, Partial<Settings>> = {
  1: {
    secretScanner: false, autoFix: false, blastRadius: false,
    driftDetection: false, complianceGating: false, riskScoring: false,
    dependencyGraph: false, carbonTracking: false, evidenceCollection: false,
    multiCloudNormalization: false,
    failOn: 'fail', defaultSeverity: 'critical',
    activePillars: ['security'],
    reportSections: { executiveSummary: true, pillarBreakdown: false, criticalFindings: false, complianceMatrix: false, architecturalDebt: false, allFindings: false, remediationPlan: false, cloudFootprint: false, planChanges: false },
  },
  2: {
    secretScanner: true, autoFix: false, blastRadius: true,
    driftDetection: false, complianceGating: false, riskScoring: false,
    dependencyGraph: false, carbonTracking: false, evidenceCollection: false,
    multiCloudNormalization: false,
    failOn: 'fail', defaultSeverity: 'high',
    activePillars: ['security', 'cost'],
    reportSections: { executiveSummary: true, pillarBreakdown: true, criticalFindings: true, complianceMatrix: false, architecturalDebt: false, allFindings: false, remediationPlan: false, cloudFootprint: false, planChanges: false },
  },
  3: {
    secretScanner: true, autoFix: true, blastRadius: true,
    driftDetection: true, complianceGating: true, riskScoring: true,
    dependencyGraph: false, carbonTracking: false, evidenceCollection: false,
    multiCloudNormalization: false,
    failOn: 'fail', defaultSeverity: 'medium',
    activePillars: ['security', 'cost', 'operations', 'reliability'],
    reportSections: { executiveSummary: true, pillarBreakdown: true, criticalFindings: true, complianceMatrix: true, architecturalDebt: true, allFindings: true, remediationPlan: false, cloudFootprint: false, planChanges: false },
  },
  4: {
    secretScanner: true, autoFix: true, blastRadius: true,
    driftDetection: true, complianceGating: true, riskScoring: true,
    dependencyGraph: true, carbonTracking: false, evidenceCollection: true,
    multiCloudNormalization: true,
    failOn: 'skip', defaultSeverity: '',
    activePillars: ALL_PILLARS.filter(p => p !== 'sustainability'),
    reportSections: { executiveSummary: true, pillarBreakdown: true, criticalFindings: true, complianceMatrix: true, architecturalDebt: true, allFindings: true, remediationPlan: true, cloudFootprint: true, planChanges: false },
  },
  5: {
    secretScanner: true, autoFix: true, blastRadius: true,
    driftDetection: true, complianceGating: true, riskScoring: true,
    dependencyGraph: true, carbonTracking: true, evidenceCollection: true,
    multiCloudNormalization: true,
    failOn: 'skip', defaultSeverity: '',
    activePillars: ALL_PILLARS,
    reportSections: { executiveSummary: true, pillarBreakdown: true, criticalFindings: true, complianceMatrix: true, architecturalDebt: true, allFindings: true, remediationPlan: true, cloudFootprint: true, planChanges: true },
  },
}

export const MATURITY_META = [
  {
    level: 1, label: 'L1 · Foundational', short: 'Foundational',
    color: '#d97706', textColor: '#fbbf24', bg: 'rgba(217,119,6,',
    desc: 'Critical-only security checks. No automation.',
    tagline: 'First scan · quick health check · zero noise',
    newAt: 'Critical security controls, minimal configuration',
  },
  {
    level: 2, label: 'L2 · Operational', short: 'Operational',
    color: '#0094FF', textColor: '#60a5fa', bg: 'rgba(0,148,255,',
    desc: 'Security + cost compliance, high+ severity, secret scanning.',
    tagline: 'Regular security ops · cost governance · team awareness',
    newAt: 'Secret scanner, blast radius, cost pillar, high-severity controls',
  },
  {
    level: 3, label: 'L3 · Governed', short: 'Governed',
    color: '#0891b2', textColor: '#22d3ee', bg: 'rgba(8,145,178,',
    desc: 'Multi-pillar, CI gating, auto-fix, risk scoring.',
    tagline: 'Mature engineering · CI/CD enforcement · remediation',
    newAt: 'Auto-fix, compliance gating, risk scoring, ops & reliability pillars',
  },
  {
    level: 4, label: 'L4 · Optimized', short: 'Optimized',
    color: '#7c3aed', textColor: '#c4b5fd', bg: 'rgba(124,58,237,',
    desc: 'All controls, drift detection, dependency graphs, evidence.',
    tagline: 'Platform teams · full control inventory · audit-ready',
    newAt: 'Drift detection, dependency graph, evidence collection, multi-cloud, all non-sustainability pillars',
  },
  {
    level: 5, label: 'L5 · Excellence', short: 'Excellence',
    color: '#059669', textColor: '#34d399', bg: 'rgba(5,150,105,',
    desc: 'All 73 controls · carbon tracking · continuous compliance.',
    tagline: 'Cloud CoE · regulated industries · full intelligence',
    newAt: 'Carbon tracking, sustainability pillar — full multi-cloud intelligence stack',
  },
]

export function loadMaturityState(): MaturityState {
  const settings = { ...DEFAULT_SETTINGS }
  const level = 1
  try {
    const s = localStorage.getItem('wafpass_settings')
    if (s) Object.assign(settings, JSON.parse(s))
  } catch {}
  try {
    const m = localStorage.getItem('wafpass_maturity')
    if (m) return { level: parseInt(m) || 1, settings }
  } catch {}
  return { level, settings }
}

export function saveMaturityState(level: number, settings: Settings) {
  try {
    localStorage.setItem('wafpass_settings', JSON.stringify(settings))
    localStorage.setItem('wafpass_maturity', String(level))
  } catch {}
}

export function getMaturityMeta(level: number) {
  return MATURITY_META.find(m => m.level === level) ?? MATURITY_META[0]
}
