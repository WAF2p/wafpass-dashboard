const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export interface Finding {
  check_id: string
  check_title: string
  control_id: string
  pillar: string
  severity: string
  status: string
  resource: string
  message: string
  remediation: string
  example?: Record<string, unknown> | null
}

export interface RunSummary {
  id: string
  project: string
  branch: string
  git_sha: string
  triggered_by: string
  iac_framework: string
  score: number
  pillar_scores: Record<string, number>
  path: string
  controls_loaded: number
  controls_run: number
  created_at: string
}

export interface ControlCheckMeta {
  id: string
  title: string
  severity: string
  remediation: string
  example?: { compliant?: string; non_compliant?: string } | null
}

export interface ControlMeta {
  id: string
  title: string
  pillar: string
  severity: string
  category: string
  description: string
  rationale: string
  threat: string[]
  regulatory_mapping: { framework: string; controls: string[] }[]
  checks: ControlCheckMeta[]
}

export interface PlanChange {
  address: string
  module_address: string | null
  type: string
  name: string
  provider: string
  action: 'create' | 'update' | 'delete' | 'replace' | 'no-op' | string
}

export interface PlanChanges {
  terraform_version: string
  format_version: string
  scanned_at: string
  summary: {
    add: number
    change: number
    destroy: number
    replace: number
    no_op: number
  }
  changes: PlanChange[]
}

export interface RunDetail extends RunSummary {
  findings: Finding[]
  detected_regions: string[][]
  source_paths: string[]
  controls_meta: ControlMeta[]
  plan_changes: PlanChanges | null
}

export async function fetchRuns(params?: {
  limit?: number
  offset?: number
  project?: string
}): Promise<RunSummary[]> {
  const url = new URL(`${API_BASE}/runs`, window.location.origin)
  if (params?.limit !== undefined) url.searchParams.set('limit', String(params.limit))
  if (params?.offset !== undefined) url.searchParams.set('offset', String(params.offset))
  if (params?.project) url.searchParams.set('project', params.project)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Failed to fetch runs: ${res.status}`)
  return res.json() as Promise<RunSummary[]>
}

export async function fetchRun(id: string): Promise<RunDetail> {
  const res = await fetch(`${API_BASE}/runs/${id}`)
  if (!res.ok) throw new Error(`Run not found: ${id}`)
  return res.json() as Promise<RunDetail>
}

export async function fetchControls(runId: string): Promise<ControlMeta[]> {
  const res = await fetch(`${API_BASE}/runs/${runId}/controls`)
  if (!res.ok) throw new Error(`Failed to fetch controls: ${res.status}`)
  return res.json() as Promise<ControlMeta[]>
}

export async function fetchFindings(
  runId: string,
  filters?: { severity?: string; pillar?: string; status?: string }
): Promise<Finding[]> {
  const url = new URL(`${API_BASE}/runs/${runId}/findings`, window.location.origin)
  if (filters?.severity) url.searchParams.set('severity', filters.severity)
  if (filters?.pillar) url.searchParams.set('pillar', filters.pillar)
  if (filters?.status) url.searchParams.set('status', filters.status)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Failed to fetch findings: ${res.status}`)
  return res.json() as Promise<Finding[]>
}
