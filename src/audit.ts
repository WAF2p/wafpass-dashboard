// ─── Audit event model ────────────────────────────────────────────────────────

export type AuditCategory = 'waiver' | 'risk' | 'scan' | 'finding'

export type AuditAction =
  | 'waiver_created' | 'waiver_updated' | 'waiver_deleted'
  | 'risk_created'   | 'risk_updated'   | 'risk_deleted'
  | 'scan_received'
  | 'control_first_failed'

export interface AuditEvent {
  id: string           // uuid-lite (timestamp + random)
  timestamp: string    // ISO 8601
  actor: string        // owner / approver / triggered_by / 'system'
  category: AuditCategory
  action: AuditAction
  subject_id: string   // control id, run id, etc.
  subject_type: string // 'waiver' | 'risk_acceptance' | 'run' | 'finding'
  summary: string      // human-readable one-liner
  before?: unknown     // snapshot before change (for updates)
  after?: unknown      // snapshot after change (for creates / updates)
}

// ─── First-seen failure index ─────────────────────────────────────────────────

export interface FirstSeenEntry {
  key: string       // `${control_id}||${check_id}||${resource}`
  control_id: string
  check_id: string
  resource: string
  run_id: string
  project: string
  branch: string
  severity: string
  pillar: string
  timestamp: string  // ISO — date of the run where it was first seen
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const AUDIT_KEY      = 'wafpass_audit_log'
const FIRST_SEEN_KEY = 'wafpass_first_seen_failures'
const MAX_EVENTS     = 2000

// ─── ID generation ────────────────────────────────────────────────────────────

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// ─── Core log operations ─────────────────────────────────────────────────────

export function loadAuditLog(): AuditEvent[] {
  try {
    const s = localStorage.getItem(AUDIT_KEY)
    return s ? (JSON.parse(s) as AuditEvent[]) : []
  } catch { return [] }
}

export function appendAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): void {
  try {
    const log = loadAuditLog()
    const entry: AuditEvent = { ...event, id: makeId(), timestamp: new Date().toISOString() }
    log.unshift(entry)                          // newest first
    if (log.length > MAX_EVENTS) log.length = MAX_EVENTS
    localStorage.setItem(AUDIT_KEY, JSON.stringify(log))
  } catch { /* storage full — silently drop */ }
}

export function clearAuditLog(): void {
  try { localStorage.removeItem(AUDIT_KEY) } catch {}
}

// ─── First-seen failure operations ───────────────────────────────────────────

export function loadFirstSeen(): Record<string, FirstSeenEntry> {
  try {
    const s = localStorage.getItem(FIRST_SEEN_KEY)
    return s ? (JSON.parse(s) as Record<string, FirstSeenEntry>) : {}
  } catch { return {} }
}

/**
 * Called when a run's details are loaded. For every FAIL finding, checks if
 * it has been seen before; if not, records it and emits a `control_first_failed`
 * audit event.
 *
 * Returns the number of newly-discovered first-seen failures.
 */
export function recordFirstSeenFailures(findings: {
  control_id: string; check_id: string; resource: string
  severity: string; pillar: string; status: string
}[], run: { id: string; project: string; branch: string; created_at: string }): number {
  try {
    const index = loadFirstSeen()
    let newCount = 0

    for (const f of findings) {
      if (f.status?.toUpperCase() !== 'FAIL') continue
      const key = `${f.control_id}||${f.check_id}||${f.resource}`
      if (index[key]) continue  // already known

      const entry: FirstSeenEntry = {
        key, control_id: f.control_id, check_id: f.check_id, resource: f.resource,
        run_id: run.id, project: run.project, branch: run.branch,
        severity: f.severity, pillar: f.pillar, timestamp: run.created_at,
      }
      index[key] = entry
      newCount++

      appendAuditEvent({
        actor: 'system',
        category: 'finding',
        action: 'control_first_failed',
        subject_id: f.control_id,
        subject_type: 'finding',
        summary: `${f.control_id} first seen FAIL on ${f.resource} (${f.severity}) — run ${run.id.slice(0, 8)} · ${run.project}/${run.branch}`,
        after: entry,
      })
    }

    if (newCount > 0) {
      localStorage.setItem(FIRST_SEEN_KEY, JSON.stringify(index))
    }
    return newCount
  } catch { return 0 }
}

export function clearFirstSeen(): void {
  try { localStorage.removeItem(FIRST_SEEN_KEY) } catch {}
}

// ─── Convenience emitters ────────────────────────────────────────────────────

export function emitScanReceived(run: {
  id: string; project: string; branch: string; git_sha: string
  triggered_by: string; score: number
}): void {
  appendAuditEvent({
    actor: run.triggered_by || 'system',
    category: 'scan',
    action: 'scan_received',
    subject_id: run.id,
    subject_type: 'run',
    summary: `Scan received: ${run.project}/${run.branch} · score ${run.score} · SHA ${run.git_sha?.slice(0, 8) ?? 'unknown'}`,
    after: { id: run.id, project: run.project, branch: run.branch, score: run.score, git_sha: run.git_sha },
  })
}
