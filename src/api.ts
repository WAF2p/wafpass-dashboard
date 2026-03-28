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
  created_at: string
}

export interface RunDetail extends RunSummary {
  findings: Finding[]
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
