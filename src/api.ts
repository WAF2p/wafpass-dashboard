const ENV_API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export const SERVER_URL_KEY = 'wafpass_server_url'

export function getApiBase(): string {
  try {
    const stored = localStorage.getItem(SERVER_URL_KEY)
    if (stored?.trim()) return stored.trim().replace(/\/$/, '')
  } catch {}
  return ENV_API_BASE
}

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
  stage: string
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
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  after_unknown?: Record<string, unknown> | null
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

export interface SecretFinding {
  file: string        // relative path to the source file
  line_no: number     // 1-based line number
  pattern_name: string // e.g. "Hardcoded password", "AWS access key ID"
  severity: string    // critical | high
  matched_key: string // attribute name, e.g. "password" (empty for format patterns)
  masked_value: string // first 4 chars + *** — raw value is never stored
  suppressed: boolean
}

export interface RunDetail extends RunSummary {
  findings: Finding[]
  detected_regions: string[][]
  source_paths: string[]
  controls_meta: ControlMeta[]
  secret_findings: SecretFinding[]
  plan_changes: PlanChanges | null
}

export async function fetchRuns(params?: {
  limit?: number
  offset?: number
  project?: string
  stage?: string
}): Promise<RunSummary[]> {
  const url = new URL(`${getApiBase()}/runs`, window.location.origin)
  if (params?.limit !== undefined) url.searchParams.set('limit', String(params.limit))
  if (params?.offset !== undefined) url.searchParams.set('offset', String(params.offset))
  if (params?.project) url.searchParams.set('project', params.project)
  if (params?.stage) url.searchParams.set('stage', params.stage)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Failed to fetch runs: ${res.status}`)
  return res.json() as Promise<RunSummary[]>
}

export async function fetchRun(id: string): Promise<RunDetail> {
  const res = await fetch(`${getApiBase()}/runs/${id}`)
  if (!res.ok) throw new Error(`Run not found: ${id}`)
  return res.json() as Promise<RunDetail>
}

export async function fetchControls(runId: string): Promise<ControlMeta[]> {
  const res = await fetch(`${getApiBase()}/runs/${runId}/controls`)
  if (!res.ok) throw new Error(`Failed to fetch controls: ${res.status}`)
  return res.json() as Promise<ControlMeta[]>
}

export async function fetchFindings(
  runId: string,
  filters?: { severity?: string; pillar?: string; status?: string }
): Promise<Finding[]> {
  const url = new URL(`${getApiBase()}/runs/${runId}/findings`, window.location.origin)
  if (filters?.severity) url.searchParams.set('severity', filters.severity)
  if (filters?.pillar) url.searchParams.set('pillar', filters.pillar)
  if (filters?.status) url.searchParams.set('status', filters.status)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Failed to fetch findings: ${res.status}`)
  return res.json() as Promise<Finding[]>
}

// ── Controls catalogue (wafpass-server /controls) ─────────────────────────────

export interface CatalogueCheck {
  id: string
  engine: string
  description: string
  expected: string
}

export interface CatalogueControl {
  id: string
  pillar: string
  severity: string
  type: string[]
  description: string
  checks: CatalogueCheck[]
  source: string
  created_at: string
  updated_at: string
}

interface ApiMeta {
  total?: number
  page?: number
  per_page?: number
}

interface ApiEnvelope<T> {
  data: T
  meta: ApiMeta
}

export async function fetchCatalogueControls(params?: {
  pillar?: string
  severity?: string
  page?: number
  per_page?: number
}): Promise<{ controls: CatalogueControl[]; total: number; page: number; per_page: number }> {
  const url = new URL(`${getApiBase()}/controls`, window.location.origin)
  if (params?.pillar) url.searchParams.set('pillar', params.pillar)
  if (params?.severity) url.searchParams.set('severity', params.severity)
  if (params?.page !== undefined) url.searchParams.set('page', String(params.page))
  if (params?.per_page !== undefined) url.searchParams.set('per_page', String(params.per_page))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Failed to fetch controls catalogue: ${res.status}`)
  const json = await res.json() as ApiEnvelope<CatalogueControl[]>
  return {
    controls: json.data,
    total: json.meta.total ?? json.data.length,
    page: json.meta.page ?? 1,
    per_page: json.meta.per_page ?? json.data.length,
  }
}

export async function fetchCatalogueControl(id: string): Promise<CatalogueControl> {
  const res = await fetch(`${getApiBase()}/controls/${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error(`Control not found: ${id}`)
  const json = await res.json() as ApiEnvelope<CatalogueControl>
  return json.data
}

// ── Waivers ──────────────────────────────────────────────────────────────────

export interface WaiverRecord {
  id: string
  reason: string
  owner: string
  expires: string
  project: string
  created_at: string
  updated_at: string
}

export async function fetchWaivers(project?: string): Promise<WaiverRecord[]> {
  const url = new URL(`${getApiBase()}/waivers`, window.location.origin)
  if (project) url.searchParams.set('project', project)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Failed to fetch waivers: ${res.status}`)
  return res.json() as Promise<WaiverRecord[]>
}

export async function upsertWaiver(id: string, payload: Omit<WaiverRecord, 'id' | 'created_at' | 'updated_at'>): Promise<WaiverRecord> {
  const res = await fetch(`${getApiBase()}/waivers/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Failed to save waiver: ${res.status}`)
  return res.json() as Promise<WaiverRecord>
}

export async function deleteWaiver(id: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/waivers/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) throw new Error(`Failed to delete waiver: ${res.status}`)
}

// ── Risk Acceptances ──────────────────────────────────────────────────────────

export interface RiskRecord {
  id: string
  reason: string
  approver: string
  owner: string
  rfc: string
  jira_link: string
  other_link: string
  notes: string
  risk_level: string
  residual_risk: string
  expires: string
  accepted_at: string
  project: string
  created_at: string
  updated_at: string
}

export async function fetchRisks(project?: string): Promise<RiskRecord[]> {
  const url = new URL(`${getApiBase()}/risks`, window.location.origin)
  if (project) url.searchParams.set('project', project)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Failed to fetch risks: ${res.status}`)
  return res.json() as Promise<RiskRecord[]>
}

export async function upsertRisk(id: string, payload: Omit<RiskRecord, 'id' | 'created_at' | 'updated_at'>): Promise<RiskRecord> {
  const res = await fetch(`${getApiBase()}/risks/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Failed to save risk: ${res.status}`)
  return res.json() as Promise<RiskRecord>
}

export async function deleteRisk(id: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/risks/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) throw new Error(`Failed to delete risk: ${res.status}`)
}

// ── Sandbox (real engine) ─────────────────────────────────────────────────────

export interface SandboxCheckResult {
  check_id: string
  check_title: string
  control_id: string
  severity: string
  status: string
  resource: string
  message: string
  remediation: string
}

export interface SandboxControlResult {
  control_id: string
  control_title: string
  pillar: string
  severity: string
  status: string
  check_results: SandboxCheckResult[]
}

export interface SandboxResponse {
  engine: string
  controls_dir: string
  controls_loaded: number
  score: number
  total_pass: number
  total_fail: number
  total_skip: number
  results: SandboxControlResult[]
}

export async function sandboxScan(hcl: string, iac = 'terraform'): Promise<SandboxResponse> {
  const res = await fetch(`${getApiBase()}/sandbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hcl, iac }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText })) as { detail?: string }
    throw new Error(body.detail ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<SandboxResponse>
}

export async function sandboxStatus(): Promise<{ engine_available: boolean; controls_dir: string; controls_dir_exists: boolean }> {
  const res = await fetch(`${getApiBase()}/sandbox/status`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<{ engine_available: boolean; controls_dir: string; controls_dir_exists: boolean }>
}

export async function createCatalogueControl(payload: Omit<CatalogueControl, 'created_at' | 'updated_at'> & { source?: string }): Promise<CatalogueControl> {
  const res = await fetch(`${getApiBase()}/controls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to create control: ${res.status} ${text}`)
  }
  const json = await res.json() as ApiEnvelope<CatalogueControl>
  return json.data
}
