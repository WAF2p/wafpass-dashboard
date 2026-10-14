import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import FrameworkDetailPage from '../pages/FrameworkDetailPage'
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
  controls_loaded: 4,
  controls_run: 4,
  created_at: '2024-01-01T00:00:00Z',
  findings: [
    { id: 'f1', check_id: 'chk-1', check_title: 'MFA check', control_id: 'WAF-SEC-010', pillar: 'security', severity: 'critical', status: 'PASS', resource: 'r1', message: '', remediation: '', regulatory_mapping: [], comment_count: 0 },
    { id: 'f2', check_id: 'chk-2', check_title: 'Encryption check', control_id: 'WAF-SEC-020', pillar: 'security', severity: 'critical', status: 'FAIL', resource: 'r2', message: '', remediation: '', regulatory_mapping: [], comment_count: 0 },
  ],
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
      checks: [{ id: 'chk-1', title: 'MFA check', severity: 'critical', remediation: 'Enable MFA.', example: null }],
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
      checks: [{ id: 'chk-2', title: 'Encryption check', severity: 'critical', remediation: '', example: null }],
    },
    {
      id: 'WAF-OPS-010',
      title: 'Infrastructure as Code Standards',
      pillar: 'operations',
      severity: 'medium',
      category: 'iac',
      description: 'All infrastructure MUST be defined via IaC.',
      rationale: '',
      threat: [],
      regulatory_mapping: [{ framework: 'GDPR', controls: ['Art. 30'] }],
      checks: [],
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

vi.mock('../useControlsCatalogue', () => ({
  useControlsCatalogue: () => mockRun.controls_meta,
}))

const mockNavigate = vi.fn()

describe('FrameworkDetailPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders framework header and stats', () => {
    render(<FrameworkDetailPage run={mockRun} navigate={mockNavigate} frameworkId="GDPR" />)

    expect(screen.getByText('GDPR')).toBeInTheDocument()
    expect(screen.getByText('General Data Protection Regulation (EU) 2016/679')).toBeInTheDocument()
    expect(screen.getByText('European Union')).toBeInTheDocument()

    // 3 mapped controls (WAF-SEC-010, WAF-SEC-020, WAF-OPS-010), 1 passed, 1 failed, 1 unknown
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getAllByText('1')).toHaveLength(3)
    expect(screen.getByText('Passed')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('Not run')).toBeInTheDocument()
  })

  it('lists every mapped WAF++ control for the selected framework', () => {
    render(<FrameworkDetailPage run={mockRun} navigate={mockNavigate} frameworkId="GDPR" />)

    expect(screen.getByText('WAF-SEC-010')).toBeInTheDocument()
    expect(screen.getByText('WAF-SEC-020')).toBeInTheDocument()
    expect(screen.getByText('WAF-OPS-010')).toBeInTheDocument()
    expect(screen.queryByText('WAF-COST-010')).not.toBeInTheDocument()
  })

  it('filters controls by search term', async () => {
    render(<FrameworkDetailPage run={mockRun} navigate={mockNavigate} frameworkId="GDPR" />)

    const input = screen.getByLabelText('Search controls…')
    fireEvent.change(input, { target: { value: 'encryption' } })

    await waitFor(() => {
      expect(screen.queryByText('WAF-SEC-010')).not.toBeInTheDocument()
      expect(screen.getByText('WAF-SEC-020')).toBeInTheDocument()
      expect(screen.queryByText('WAF-OPS-010')).not.toBeInTheDocument()
    })
  })

  it('groups controls by framework requirement when toggled', async () => {
    render(<FrameworkDetailPage run={mockRun} navigate={mockNavigate} frameworkId="GDPR" />)

    const toggle = screen.getByRole('button', { name: /Group by requirement/i })
    fireEvent.click(toggle)

    await waitFor(() => {
      const groups = document.querySelectorAll('.fdg-group')
      expect(groups).toHaveLength(2)
    })

    // Art. 32 group header + 2 mapped controls; Art. 30 group header + 1 mapped control
    expect(screen.getAllByText('Art. 32')).toHaveLength(3)
    expect(screen.getAllByText('Art. 30')).toHaveLength(2)
  })

  it('navigates back to compliance overview when back button is clicked', () => {
    render(<FrameworkDetailPage run={mockRun} navigate={mockNavigate} frameworkId="GDPR" />)

    const back = screen.getByRole('button', { name: /Back to overview/i })
    fireEvent.click(back)

    expect(mockNavigate).toHaveBeenCalledWith('compliance')
  })

  it('shows not found state for unknown framework', () => {
    render(<FrameworkDetailPage run={mockRun} navigate={mockNavigate} frameworkId="UNKNOWN" />)

    expect(screen.getByText('Framework not found.')).toBeInTheDocument()
  })
})
