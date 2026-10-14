import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ComplianceReadinessPage from '../pages/ComplianceReadinessPage'
import type { RunDetail } from '../api'

const mockRun: RunDetail = {
  id: 'run-1',
  project: 'acme',
  branch: 'main',
  git_sha: 'abc123',
  triggered_by: 'local',
  is_cicd: false,
  iac_framework: 'terraform',
  stage: 'prod',
  score: 72,
  pillar_scores: {},
  path: '/tmp',
  controls_loaded: 3,
  controls_run: 3,
  created_at: '2024-01-01T00:00:00Z',
  findings: [],
  detected_regions: [],
  source_paths: [],
  controls_meta: [
    {
      id: 'WAF-SEC-010',
      title: 'Identity & Access Management Baseline',
      pillar: 'security',
      severity: 'critical',
      category: 'iam',
      description: 'All AWS accounts MUST enforce MFA.',
      rationale: '',
      threat: [],
      regulatory_mapping: [{ framework: 'GDPR', controls: ['Art. 32'] }],
      checks: [
        { id: 'chk-1', title: 'MFA check', severity: 'critical', remediation: 'Enable MFA.', example: null },
      ],
    },
    {
      id: 'WAF-SEC-020',
      title: 'Data Encryption',
      pillar: 'security',
      severity: 'critical',
      category: 'encryption',
      description: 'Encrypt data at rest and in transit.',
      rationale: '',
      threat: [],
      regulatory_mapping: [
        { framework: 'GDPR', controls: ['Art. 32'] },
        { framework: 'ISO 27001:2022', controls: ['A.8.24'] },
      ],
      checks: [
        { id: 'chk-2', title: 'Encryption check', severity: 'critical', remediation: '', example: null },
      ],
    },
    {
      id: 'WAF-COST-010',
      title: 'Resource Tagging',
      pillar: 'cost',
      severity: 'medium',
      category: 'tagging',
      description: 'Tag resources.',
      rationale: '',
      threat: [],
      regulatory_mapping: [],
      checks: [],
    },
  ],
  secret_findings: [],
  plan_changes: null,
}

const mockReadiness = {
  totalFrameworkCoverage: 67,
  frameworkCount: 2,
  evidenceCompleteness: 33,
  findingsWithoutRemediation: 1,
  readinessScore: 28,
  frameworks: [
    { name: 'GDPR', description: 'General Data Protection Regulation', controls: 2, pct: 50 },
    { name: 'ISO 27001:2022', description: 'Information Security Management Systems', controls: 1, pct: 0 },
  ],
  controlsWithoutRemediation: [{ id: 'WAF-SEC-020', title: 'Data Encryption', category: 'encryption', severity: 'critical' }],
}

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api')
  return {
    ...actual,
    fetchComplianceReadiness: vi.fn(),
    fetchWaivers: vi.fn().mockResolvedValue([]),
    fetchRisks: vi.fn().mockResolvedValue([]),
  }
})

const { fetchComplianceReadiness } = await import('../api')

describe('ComplianceReadinessPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders loading state initially', () => {
    vi.mocked(fetchComplianceReadiness).mockReturnValue(new Promise(() => {}))
    render(<ComplianceReadinessPage run={mockRun} />)
    expect(screen.getByText('Loading compliance readiness metrics…')).toBeInTheDocument()
  })

  it('renders server-provided metrics correctly', async () => {
    vi.mocked(fetchComplianceReadiness).mockResolvedValue(mockReadiness)
    render(<ComplianceReadinessPage run={mockRun} />)

    await waitFor(() => expect(screen.queryByText('Loading compliance readiness metrics…')).not.toBeInTheDocument())

    expect(screen.getByText('67%')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('33%')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('28/100')).toBeInTheDocument()
    expect(screen.getByText('Needs Work')).toBeInTheDocument()
    expect(screen.getByText('GDPR')).toBeInTheDocument()
    expect(screen.getByText('50% complete')).toBeInTheDocument()
  })

  it('falls back to local calculation when the server is unreachable', async () => {
    vi.mocked(fetchComplianceReadiness).mockRejectedValue(new Error('Network error'))
    render(<ComplianceReadinessPage run={mockRun} />)

    await waitFor(() => expect(screen.queryByText('Loading compliance readiness metrics…')).not.toBeInTheDocument())

    // Framework coverage: 2 of 3 controls mapped → 67%
    expect(screen.getByText('67%')).toBeInTheDocument()
    // Offline fallback has no evidence data → 0%
    expect(screen.getByText('0%')).toBeInTheDocument()
    // WAF-SEC-020 has an empty remediation; WAF-COST-010 has no checks at all.
    // Both the "Frameworks" count and the "Missing Remediation" count are 2.
    expect(screen.getAllByText('2')).toHaveLength(2)
    expect(screen.getByText('Missing Remediation')).toBeInTheDocument()
    expect(screen.getByText('14/100')).toBeInTheDocument()
    expect(screen.getByText('Offline estimate:')).toBeInTheDocument()
  })

  it('does not report every framework as 100% complete in fallback mode', async () => {
    vi.mocked(fetchComplianceReadiness).mockRejectedValue(new Error('Network error'))
    render(<ComplianceReadinessPage run={mockRun} />)

    await waitFor(() => expect(screen.queryByText('Loading compliance readiness metrics…')).not.toBeInTheDocument())

    // Both framework bars should show 0% in offline fallback, never 100%
    const completenessLabels = screen.getAllByText('0% complete')
    expect(completenessLabels.length).toBeGreaterThan(0)
    expect(screen.queryByText('100% complete')).not.toBeInTheDocument()
  })
})
