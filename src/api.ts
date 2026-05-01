const ENV_API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ''

export const SERVER_URL_KEY = 'wafpass_server_url'

export function getApiBase(): string {
  try {
    const stored = localStorage.getItem(SERVER_URL_KEY)
    if (stored?.trim()) return stored.trim().replace(/\/$/, '')
  } catch {}
  return ENV_API_BASE
}

// ── Auth token helpers ────────────────────────────────────────────────────────

export function getAccessToken(): string | null {
  try { return localStorage.getItem('wafpass_access_token') } catch { return null }
}

/** Returns an Authorization header object if a token is stored, else empty object. */
function _authHeaders(): Record<string, string> {
  const t = getAccessToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
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
  regulatory_mapping: { framework: string; controls: string[] }[]
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

export interface RunPage {
  items: RunSummary[]
  nextCursor: string | null
}

export async function fetchRuns(params?: {
  limit?: number
  cursor?: string
  project?: string
  stage?: string
}): Promise<RunPage> {
  const url = new URL(`${getApiBase()}/runs`, window.location.origin)
  if (params?.limit !== undefined) url.searchParams.set('limit', String(params.limit))
  if (params?.cursor) url.searchParams.set('cursor', params.cursor)
  if (params?.project) url.searchParams.set('project', params.project)
  if (params?.stage) url.searchParams.set('stage', params.stage)
  const res = await fetch(url.toString(), { headers: _authHeaders() })
  if (!res.ok) throw new Error(`Failed to fetch runs: ${res.status}`)
  const json = await res.json() as ApiEnvelope<RunSummary[]>
  return { items: json.data, nextCursor: json.meta?.next_cursor ?? null }
}

export async function fetchRun(id: string): Promise<RunDetail> {
  const res = await fetch(`${getApiBase()}/runs/${id}`, { headers: _authHeaders() })
  if (!res.ok) throw new Error(`Run not found: ${id}`)
  const json = await res.json() as ApiEnvelope<RunDetail>
  return json.data
}

export interface ProjectAchievement {
  id: string
  project: string
  tier_level: number
  tier_label: string
  score: number
  run_id: string
  verification_token: string
  snapshot_jsonb: Record<string, number>
  achieved_at: string
}

export async function fetchProjectAchievements(project: string): Promise<ProjectAchievement[]> {
  const res = await fetch(`${getApiBase()}/achievements/${encodeURIComponent(project)}`, { headers: _authHeaders() })
  if (!res.ok) return []
  const json = await res.json() as ApiEnvelope<ProjectAchievement[]>
  return json.data
}

export interface BadgeStatus {
  project: string
  tier_level: number
  tier_label: string
  score: number | null
  color: string
  badge_url: string
  updated_at: string | null
}

export async function fetchBadgeStatus(project: string): Promise<BadgeStatus | null> {
  const res = await fetch(`${getApiBase()}/public/badge/${encodeURIComponent(project)}/json`)
  if (!res.ok) return null
  return res.json() as Promise<BadgeStatus>
}

export async function fetchControls(runId: string): Promise<ControlMeta[]> {
  const res = await fetch(`${getApiBase()}/runs/${runId}/controls`, { headers: _authHeaders() })
  if (!res.ok) throw new Error(`Failed to fetch controls: ${res.status}`)
  const json = await res.json() as ApiEnvelope<ControlMeta[]>
  return json.data
}

export async function fetchFindings(
  runId: string,
  filters?: { severity?: string; pillar?: string; status?: string }
): Promise<Finding[]> {
  const url = new URL(`${getApiBase()}/runs/${runId}/findings`, window.location.origin)
  if (filters?.severity) url.searchParams.set('severity', filters.severity)
  if (filters?.pillar) url.searchParams.set('pillar', filters.pillar)
  if (filters?.status) url.searchParams.set('status', filters.status)
  const res = await fetch(url.toString(), { headers: _authHeaders() })
  if (!res.ok) throw new Error(`Failed to fetch findings: ${res.status}`)
  const json = await res.json() as ApiEnvelope<Finding[]>
  return json.data
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
  regulatory_mapping: { framework: string; controls: string[] }[]
}

interface ApiMeta {
  total?: number
  page?: number
  per_page?: number
  next_cursor?: string | null
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
  const res = await fetch(url.toString(), { headers: _authHeaders() })
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
  const res = await fetch(`${getApiBase()}/controls/${encodeURIComponent(id)}`, { headers: _authHeaders() })
  if (!res.ok) throw new Error(`Control not found: ${id}`)
  const json = await res.json() as ApiEnvelope<CatalogueControl>
  return json.data
}

// ── Waivers ──────────────────────────────────────────────────────────────────

export interface WaiverRecord {
  id: string
  reason: string
  owner: string
  expires: string | null
  project: string
  created_at: string
  updated_at: string
}

export async function fetchWaivers(project?: string): Promise<WaiverRecord[]> {
  const url = new URL(`${getApiBase()}/waivers`, window.location.origin)
  if (project) url.searchParams.set('project', project)
  const res = await fetch(url.toString(), { headers: _authHeaders() })
  if (!res.ok) throw new Error(`Failed to fetch waivers: ${res.status}`)
  const json = await res.json() as ApiEnvelope<WaiverRecord[]>
  return json.data
}

export async function upsertWaiver(id: string, payload: Omit<WaiverRecord, 'id' | 'created_at' | 'updated_at'>): Promise<WaiverRecord> {
  const res = await fetch(`${getApiBase()}/waivers/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ..._authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Failed to save waiver: ${res.status}`)
  const json = await res.json() as ApiEnvelope<WaiverRecord>
  return json.data
}

export async function deleteWaiver(id: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/waivers/${encodeURIComponent(id)}`, { method: 'DELETE', headers: _authHeaders() })
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
  expires: string | null
  accepted_at: string | null
  project: string
  created_at: string
  updated_at: string
}

export async function fetchRisks(project?: string): Promise<RiskRecord[]> {
  const url = new URL(`${getApiBase()}/risks`, window.location.origin)
  if (project) url.searchParams.set('project', project)
  const res = await fetch(url.toString(), { headers: _authHeaders() })
  if (!res.ok) throw new Error(`Failed to fetch risks: ${res.status}`)
  const json = await res.json() as ApiEnvelope<RiskRecord[]>
  return json.data
}

export async function upsertRisk(id: string, payload: Omit<RiskRecord, 'id' | 'created_at' | 'updated_at'>): Promise<RiskRecord> {
  const res = await fetch(`${getApiBase()}/risks/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ..._authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Failed to save risk: ${res.status}`)
  const json = await res.json() as ApiEnvelope<RiskRecord>
  return json.data
}

export async function deleteRisk(id: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/risks/${encodeURIComponent(id)}`, { method: 'DELETE', headers: _authHeaders() })
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
    headers: { 'Content-Type': 'application/json', ..._authHeaders() },
    body: JSON.stringify({ hcl, iac }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText })) as { detail?: string }
    throw new Error(body.detail ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<SandboxResponse>
}

export async function sandboxStatus(): Promise<{ engine_available: boolean; controls_dir: string; controls_dir_exists: boolean }> {
  const res = await fetch(`${getApiBase()}/sandbox/status`, { headers: _authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<{ engine_available: boolean; controls_dir: string; controls_dir_exists: boolean }>
}

// ── Server-side scan ──────────────────────────────────────────────────────────

export interface ScanStatus {
  enabled: boolean
  engine_available: boolean
  controls_dir: string
  controls_dir_exists: boolean
  scan_base_dir: string | null
}

export interface ScanRequest {
  path: string
  iac?: string
  project?: string
  branch?: string
  stage?: string
  triggered_by?: string
}

export async function fetchScanStatus(): Promise<ScanStatus> {
  const res = await fetch(`${getApiBase()}/scan/status`, { headers: _authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<ScanStatus>
}

export async function triggerScan(payload: ScanRequest): Promise<RunSummary> {
  const res = await fetch(`${getApiBase()}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ..._authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText })) as { detail?: string }
    throw new Error(body.detail ?? `HTTP ${res.status}`)
  }
  const json = await res.json() as ApiEnvelope<RunSummary>
  return json.data
}

export async function createCatalogueControl(payload: Omit<CatalogueControl, 'created_at' | 'updated_at'> & { source?: string }): Promise<CatalogueControl> {
  const res = await fetch(`${getApiBase()}/controls`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ..._authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to create control: ${res.status} ${text}`)
  }
  const json = await res.json() as ApiEnvelope<CatalogueControl>
  return json.data
}

// ── Authentication API ────────────────────────────────────────────────────────

export interface UserOut {
  id: string
  username: string
  display_name: string
  role: string
  auth_provider: string
  is_active: boolean
  last_login_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: UserOut
}

export async function loginUser(username: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${getApiBase()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Login failed' })) as { detail?: string }
    throw new Error(body.detail ?? 'Login failed')
  }
  return res.json() as Promise<LoginResponse>
}

export async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; token_type: string }> {
  const res = await fetch(`${getApiBase()}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!res.ok) throw new Error('Token refresh failed')
  return res.json() as Promise<{ access_token: string; refresh_token: string; token_type: string }>
}

export async function logoutUser(refreshToken: string): Promise<void> {
  await fetch(`${getApiBase()}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
}

export async function fetchUsers(): Promise<UserOut[]> {
  const res = await fetch(`${getApiBase()}/auth/users`, { headers: _authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<UserOut[]>
}

export async function createUser(payload: { username: string; password: string; display_name?: string; role?: string }): Promise<UserOut> {
  const res = await fetch(`${getApiBase()}/auth/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ..._authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Create failed' })) as { detail?: string }
    throw new Error(body.detail ?? 'Create failed')
  }
  return res.json() as Promise<UserOut>
}

export async function updateUser(id: string, payload: { display_name?: string; role?: string; is_active?: boolean; password?: string }): Promise<UserOut> {
  const res = await fetch(`${getApiBase()}/auth/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ..._authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Update failed' })) as { detail?: string }
    throw new Error(body.detail ?? 'Update failed')
  }
  return res.json() as Promise<UserOut>
}

export async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/auth/users/${encodeURIComponent(id)}`, { method: 'DELETE', headers: _authHeaders() })
  if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`)
}

export interface UserAuditLogEntry {
  id: string
  actor_id: string | null
  action: string
  detail: Record<string, unknown>
  ip: string
  timestamp: string
}

export async function fetchUserLogs(userId: string, limit = 100): Promise<UserAuditLogEntry[]> {
  const res = await fetch(`${getApiBase()}/auth/users/${encodeURIComponent(userId)}/logs?limit=${limit}`, { headers: _authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<UserAuditLogEntry[]>
}

// ── API key management ────────────────────────────────────────────────────────

export interface ApiKeyOut {
  id: string
  name: string
  key_prefix: string
  created_by: string | null
  is_active: boolean
  created_at: string
  last_used_at: string | null
}

export interface ApiKeyCreateResponse extends ApiKeyOut {
  raw_key: string
}

export async function fetchApiKeys(): Promise<ApiKeyOut[]> {
  const res = await fetch(`${getApiBase()}/auth/api-keys`, { headers: _authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<ApiKeyOut[]>
}

export async function createApiKey(name: string): Promise<ApiKeyCreateResponse> {
  const res = await fetch(`${getApiBase()}/auth/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ..._authHeaders() },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Create failed' })) as { detail?: string }
    throw new Error(body.detail ?? 'Create failed')
  }
  return res.json() as Promise<ApiKeyCreateResponse>
}

export async function revokeApiKey(id: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/auth/api-keys/${encodeURIComponent(id)}`, { method: 'DELETE', headers: _authHeaders() })
  if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`)
}

export interface ApiKeyUsageLogEntry {
  id: string
  used_at: string
  endpoint: string
  run_id: string | null
  project: string
  branch: string
  score: number | null
  ip: string
}

export async function fetchApiKeyLogs(keyId: string, limit = 50): Promise<ApiKeyUsageLogEntry[]> {
  const res = await fetch(`${getApiBase()}/auth/api-keys/${encodeURIComponent(keyId)}/logs?limit=${limit}`, { headers: _authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<ApiKeyUsageLogEntry[]>
}

// ── SSO Configuration API ─────────────────────────────────────────────────────

export interface SsoConfigOut {
  id: string
  enabled: boolean
  config: Record<string, unknown>
  updated_at: string | null
}

export interface SsoProviderInfo {
  provider: string
  enabled: boolean
  label: string
}

export async function fetchSsoConfigs(): Promise<SsoConfigOut[]> {
  const res = await fetch(`${getApiBase()}/sso/config`, { headers: _authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<SsoConfigOut[]>
}

export async function upsertSsoConfig(provider: 'oidc' | 'saml2', enabled: boolean, config: Record<string, unknown>): Promise<SsoConfigOut> {
  const res = await fetch(`${getApiBase()}/sso/config/${provider}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ..._authHeaders() },
    body: JSON.stringify({ enabled, config }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Save failed' })) as { detail?: string }
    throw new Error(body.detail ?? 'Save failed')
  }
  return res.json() as Promise<SsoConfigOut>
}

export async function deleteSsoConfig(provider: 'oidc' | 'saml2'): Promise<void> {
  const res = await fetch(`${getApiBase()}/sso/config/${provider}`, { method: 'DELETE', headers: _authHeaders() })
  if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`)
}

export async function fetchSsoProviders(): Promise<SsoProviderInfo[]> {
  const res = await fetch(`${getApiBase()}/sso/providers`)
  if (!res.ok) return []
  return res.json() as Promise<SsoProviderInfo[]>
}

export function getSsoAuthorizeUrl(provider: 'oidc' | 'saml2'): string {
  const base = getApiBase()
  if (provider === 'oidc') return `${base}/auth/oidc/authorize`
  return `${base}/auth/saml/login`
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  project: string
  display_name: string | null
  owner: string | null
  owner_team: string | null
  score: number
  tier_level: number
  tier_label: string
  achieved_at: string
  days_held: number
  tiers_gained: number | null
}

export interface LeaderboardOut {
  top_sovereign: LeaderboardEntry[]
  most_improved: LeaderboardEntry[]
}

export async function fetchLeaderboard(): Promise<LeaderboardOut> {
  const res = await fetch(`${getApiBase()}/leaderboard`, { headers: _authHeaders() })
  if (!res.ok) throw new Error(`Failed to fetch leaderboard: ${res.status}`)
  const json = await res.json() as ApiEnvelope<LeaderboardOut>
  return json.data
}

// ── Group → Role Mappings API ─────────────────────────────────────────────────

export interface GroupRoleMappingOut {
  id: string
  provider: string
  group_name: string
  role: string
  description: string
  priority: number
  created_at: string | null
  created_by: string | null
}

export interface GroupRoleMappingCreate {
  provider: string
  group_name: string
  role: string
  description?: string
  priority?: number
}

export async function fetchGroupMappings(): Promise<GroupRoleMappingOut[]> {
  const res = await fetch(`${getApiBase()}/sso/group-mappings`, { headers: _authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json() as Promise<GroupRoleMappingOut[]>
}

export async function createGroupMapping(payload: GroupRoleMappingCreate): Promise<GroupRoleMappingOut> {
  const res = await fetch(`${getApiBase()}/sso/group-mappings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ..._authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Create failed' })) as { detail?: string }
    throw new Error(body.detail ?? 'Create failed')
  }
  return res.json() as Promise<GroupRoleMappingOut>
}

export async function updateGroupMapping(id: string, payload: Partial<GroupRoleMappingCreate>): Promise<GroupRoleMappingOut> {
  const res = await fetch(`${getApiBase()}/sso/group-mappings/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ..._authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Update failed' })) as { detail?: string }
    throw new Error(body.detail ?? 'Update failed')
  }
  return res.json() as Promise<GroupRoleMappingOut>
}

// ── Evidence Locker API ───────────────────────────────────────────────────────

export interface EvidenceOut {
  id: string
  run_id: string
  title: string
  note: string
  project: string
  prepared_by: string
  organization: string
  audit_period: string
  frameworks: string[]
  hash_digest: string
  public_token: string
  locked_by: string | null
  created_at: string | null
}

export interface EvidenceCreate {
  run_id: string
  title?: string
  note?: string
  prepared_by?: string
  organization?: string
  audit_period?: string
  frameworks?: string[]
  snapshot: Record<string, unknown>
  report_html?: string | null
}

export async function fetchEvidence(project?: string): Promise<EvidenceOut[]> {
  const url = new URL(`${getApiBase()}/evidence`, window.location.origin)
  if (project) url.searchParams.set('project', project)
  const res = await fetch(url.toString(), { headers: _authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json() as ApiEnvelope<EvidenceOut[]>
  return json.data
}

export async function createEvidence(payload: EvidenceCreate): Promise<EvidenceOut> {
  const res = await fetch(`${getApiBase()}/evidence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ..._authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Lock failed' })) as { detail?: string }
    throw new Error(body.detail ?? 'Lock failed')
  }
  const json = await res.json() as ApiEnvelope<EvidenceOut>
  return json.data
}

export async function deleteEvidence(id: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/evidence/${encodeURIComponent(id)}`, {
    method: 'DELETE', headers: _authHeaders(),
  })
  if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`)
}

export function getEvidenceQrUrl(id: string): string {
  return `${getApiBase()}/evidence/${encodeURIComponent(id)}/qr.svg`
}

export function getEvidenceReportUrl(id: string): string {
  return `${getApiBase()}/evidence/${encodeURIComponent(id)}/report.html`
}

export function getEvidencePublicUrl(token: string): string {
  return `${getApiBase()}/evidence/p/${encodeURIComponent(token)}`
}

// ── Project Passport API ──────────────────────────────────────────────────────

export interface ProjectPassport {
  project: string
  display_name: string
  owner: string
  owner_team: string
  contact_email: string
  description: string
  criticality: string   // critical | high | medium | low | ""
  environment: string   // production | staging | development | mixed | ""
  cloud_provider: string // aws | azure | gcp | multi | other | ""
  repository_url: string
  documentation_url: string
  tags: string[]
  notes: string
  image_url: string
  updated_by: string
  created_at: string
  updated_at: string
}

export type ProjectPassportUpsert = Omit<ProjectPassport, 'project' | 'updated_by' | 'created_at' | 'updated_at'>

export async function fetchProjectPassports(): Promise<ProjectPassport[]> {
  const res = await fetch(`${getApiBase()}/projects/passports`, { headers: _authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json() as ApiEnvelope<ProjectPassport[]>
  return json.data
}

export async function fetchProjectPassport(project: string): Promise<ProjectPassport | null> {
  const res = await fetch(`${getApiBase()}/projects/${encodeURIComponent(project)}/passport`, { headers: _authHeaders() })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json() as ApiEnvelope<ProjectPassport>
  return json.data
}

export async function upsertProjectPassport(project: string, payload: ProjectPassportUpsert): Promise<ProjectPassport> {
  const res = await fetch(`${getApiBase()}/projects/${encodeURIComponent(project)}/passport`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ..._authHeaders() },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Save failed' })) as { detail?: string }
    throw new Error(body.detail ?? 'Save failed')
  }
  const json = await res.json() as ApiEnvelope<ProjectPassport>
  return json.data
}

export async function deleteProjectPassport(project: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/projects/${encodeURIComponent(project)}/passport`, {
    method: 'DELETE', headers: _authHeaders(),
  })
  if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`)
}

export async function deleteGroupMapping(id: string): Promise<void> {
  const res = await fetch(`${getApiBase()}/sso/group-mappings/${encodeURIComponent(id)}`, {
    method: 'DELETE', headers: _authHeaders(),
  })
  if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`)
}

// ── Compliance Audit Events API ───────────────────────────────────────────────

export interface ServerAuditEvent {
  id: string
  client_id: string
  actor: string
  category: string
  action: string
  subject_id: string
  subject_type: string
  summary: string
  before: unknown | null
  after: unknown | null
  timestamp: string
  created_by: string | null
}

export async function pushAuditEvent(event: {
  client_id: string
  actor: string
  category: string
  action: string
  subject_id: string
  subject_type: string
  summary: string
  timestamp: string
  before?: unknown
  after?: unknown
}): Promise<void> {
  const token = getAccessToken()
  if (!token) return  // unauthenticated — skip silently
  await fetch(`${getApiBase()}/audit/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(event),
  }).catch(() => { /* fire-and-forget: never throw */ })
}

export async function fetchServerAuditEvents(params?: {
  limit?: number
  category?: string
}): Promise<ServerAuditEvent[]> {
  const url = new URL(`${getApiBase()}/audit/events`, window.location.origin)
  if (params?.limit !== undefined) url.searchParams.set('limit', String(params.limit))
  if (params?.category) url.searchParams.set('category', params.category)
  const res = await fetch(url.toString(), { headers: _authHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json() as ApiEnvelope<ServerAuditEvent[]>
  return json.data
}

// ── Control Packs ─────────────────────────────────────────────────────────────

export interface ControlPackOut {
  version: string
  description: string
  is_active: boolean
  control_count: number
  imported_at: string
  imported_by: string | null
  activated_at: string | null
  activated_by: string | null
}

export async function fetchControlPacks(): Promise<ControlPackOut[]> {
  const res = await fetch(`${getApiBase()}/control-packs`, { headers: _authHeaders() })
  if (!res.ok) throw new Error(`Failed to fetch control packs: ${res.status}`)
  const json = await res.json() as ApiEnvelope<ControlPackOut[]>
  return json.data
}

export async function getActiveControlPack(): Promise<ControlPackOut | null> {
  const res = await fetch(`${getApiBase()}/control-packs/active`, { headers: _authHeaders() })
  if (!res.ok) throw new Error(`Failed to fetch active pack: ${res.status}`)
  const json = await res.json() as ApiEnvelope<ControlPackOut | null>
  return json.data
}

export async function syncControlPack(version: string, description: string): Promise<ControlPackOut> {
  const res = await fetch(`${getApiBase()}/control-packs/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ..._authHeaders() },
    body: JSON.stringify({ version, description }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`)
  }
  const json = await res.json() as ApiEnvelope<ControlPackOut>
  return json.data
}

export async function uploadControlPack(file: File, version: string, description: string): Promise<ControlPackOut> {
  const form = new FormData()
  form.append('file', file)
  form.append('version', version)
  form.append('description', description)
  const res = await fetch(`${getApiBase()}/control-packs/upload`, {
    method: 'POST',
    headers: _authHeaders(),
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`)
  }
  const json = await res.json() as ApiEnvelope<ControlPackOut>
  return json.data
}

export async function activateControlPack(version: string): Promise<ControlPackOut> {
  const res = await fetch(`${getApiBase()}/control-packs/${encodeURIComponent(version)}/activate`, {
    method: 'POST',
    headers: _authHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`)
  }
  const json = await res.json() as ApiEnvelope<ControlPackOut>
  return json.data
}

export async function downloadControlsZip(): Promise<Blob> {
  const res = await fetch(`${getApiBase()}/controls/export`, { headers: _authHeaders() })
  if (!res.ok) throw new Error(`Failed to download controls: ${res.status}`)
  return res.blob()
}

export interface ActivePackInfo {
  version: string
  description: string
  control_count: number
  imported_at: string
  activated_at: string | null
}

export async function fetchActivePackInfo(): Promise<ActivePackInfo | null> {
  const res = await fetch(`${getApiBase()}/controls/active-pack`, { headers: _authHeaders() })
  if (!res.ok) throw new Error(`Failed to fetch active pack: ${res.status}`)
  const json = await res.json() as ApiEnvelope<ActivePackInfo | null>
  return json.data
}

// ── User preferences ──────────────────────────────────────────────────────────

export async function fetchUserPrefsFromServer(): Promise<Record<string, unknown> | null> {
  const token = getAccessToken()
  if (!token) return null
  try {
    const res = await fetch(`${getApiBase()}/auth/me/prefs`, { headers: _authHeaders() })
    if (!res.ok) return null
    return await res.json() as Record<string, unknown>
  } catch {
    return null
  }
}

export async function pushUserPrefsToServer(prefs: Record<string, unknown>): Promise<void> {
  const token = getAccessToken()
  if (!token) return
  await fetch(`${getApiBase()}/auth/me/prefs`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(_authHeaders()) },
    body: JSON.stringify(prefs),
  }).catch(() => { /* fire-and-forget */ })
}


