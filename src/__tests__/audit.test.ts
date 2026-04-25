import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the api module so appendAuditEvent's fire-and-forget push doesn't make real network calls
vi.mock('../api', () => ({
  pushAuditEvent: vi.fn().mockResolvedValue(undefined),
  getAccessToken: vi.fn().mockReturnValue(null),
}))

import {
  appendAuditEvent,
  clearAuditLog,
  clearFirstSeen,
  emitScanReceived,
  loadAuditLog,
  loadFirstSeen,
  recordFirstSeenFailures,
} from '../audit'

const AUDIT_KEY = 'wafpass_audit_log'
const FIRST_SEEN_KEY = 'wafpass_first_seen_failures'

const makeRun = (overrides = {}) => ({
  id: 'run-abc',
  project: 'my-project',
  branch: 'main',
  created_at: '2024-06-01T00:00:00Z',
  ...overrides,
})

const makeFinding = (overrides = {}) => ({
  control_id: 'ctrl1',
  check_id: 'chk1',
  resource: 'aws_s3_bucket.main',
  severity: 'HIGH',
  pillar: 'encryption',
  status: 'FAIL',
  ...overrides,
})

// ── loadAuditLog ──────────────────────────────────────────────────────────────

describe('loadAuditLog', () => {
  beforeEach(() => localStorage.clear())

  it('returns empty array when nothing stored', () => {
    expect(loadAuditLog()).toEqual([])
  })

  it('parses stored events correctly', () => {
    const events = [{ id: 'x1', timestamp: '2024-01-01T00:00:00Z', actor: 'alice', category: 'scan', action: 'scan_received', subject_id: 'r1', subject_type: 'run', summary: 'ok' }]
    localStorage.setItem(AUDIT_KEY, JSON.stringify(events))
    expect(loadAuditLog()).toEqual(events)
  })

  it('returns empty array on malformed JSON', () => {
    localStorage.setItem(AUDIT_KEY, '{broken json')
    expect(loadAuditLog()).toEqual([])
  })
})

// ── appendAuditEvent ──────────────────────────────────────────────────────────

describe('appendAuditEvent', () => {
  beforeEach(() => localStorage.clear())

  it('writes a single event with generated id and current timestamp', () => {
    const before = Date.now()
    appendAuditEvent({ actor: 'alice', category: 'waiver', action: 'waiver_created', subject_id: 'ctrl1', subject_type: 'waiver', summary: 'Waiver created for ctrl1' })
    const log = loadAuditLog()
    expect(log).toHaveLength(1)
    const [e] = log
    expect(e.actor).toBe('alice')
    expect(e.category).toBe('waiver')
    expect(e.action).toBe('waiver_created')
    expect(e.subject_id).toBe('ctrl1')
    expect(e.id).toBeTruthy()
    expect(new Date(e.timestamp).getTime()).toBeGreaterThanOrEqual(before)
  })

  it('prepends events so the newest is first', () => {
    appendAuditEvent({ actor: 'alice', category: 'scan', action: 'scan_received', subject_id: 'r1', subject_type: 'run', summary: 'first' })
    appendAuditEvent({ actor: 'bob',   category: 'scan', action: 'scan_received', subject_id: 'r2', subject_type: 'run', summary: 'second' })
    const log = loadAuditLog()
    expect(log[0].summary).toBe('second')
    expect(log[1].summary).toBe('first')
  })

  it('stores optional before/after snapshots', () => {
    const before = { reason: 'old' }
    const after  = { reason: 'new' }
    appendAuditEvent({ actor: 'x', category: 'risk', action: 'risk_updated', subject_id: 'risk1', subject_type: 'risk_acceptance', summary: 's', before, after })
    const [e] = loadAuditLog()
    expect(e.before).toEqual(before)
    expect(e.after).toEqual(after)
  })

  it('generates unique ids for concurrent events', () => {
    for (let i = 0; i < 10; i++) {
      appendAuditEvent({ actor: 'x', category: 'scan', action: 'scan_received', subject_id: `r${i}`, subject_type: 'run', summary: `s${i}` })
    }
    const ids = loadAuditLog().map(e => e.id)
    expect(new Set(ids).size).toBe(10)
  })

  it('caps the log at MAX_EVENTS (2000)', () => {
    // Pre-fill with 1999 entries
    const seed = Array.from({ length: 1999 }, (_, i) => ({
      id: `seed-${i}`, timestamp: new Date().toISOString(), actor: 'x',
      category: 'scan', action: 'scan_received', subject_id: `r${i}`, subject_type: 'run', summary: 's',
    }))
    localStorage.setItem(AUDIT_KEY, JSON.stringify(seed))

    appendAuditEvent({ actor: 'y', category: 'waiver', action: 'waiver_created', subject_id: 'c', subject_type: 'waiver', summary: 'over limit' })
    expect(loadAuditLog()).toHaveLength(2000)

    appendAuditEvent({ actor: 'y', category: 'waiver', action: 'waiver_created', subject_id: 'c2', subject_type: 'waiver', summary: 'one more' })
    expect(loadAuditLog()).toHaveLength(2000)
  })
})

// ── clearAuditLog ─────────────────────────────────────────────────────────────

describe('clearAuditLog', () => {
  beforeEach(() => localStorage.clear())

  it('empties the log', () => {
    appendAuditEvent({ actor: 'a', category: 'scan', action: 'scan_received', subject_id: 'r', subject_type: 'run', summary: 's' })
    clearAuditLog()
    expect(loadAuditLog()).toEqual([])
  })

  it('is safe to call when log is already empty', () => {
    expect(() => clearAuditLog()).not.toThrow()
  })
})

// ── loadFirstSeen / clearFirstSeen ────────────────────────────────────────────

describe('loadFirstSeen / clearFirstSeen', () => {
  beforeEach(() => localStorage.clear())

  it('returns empty object when nothing stored', () => {
    expect(loadFirstSeen()).toEqual({})
  })

  it('round-trips through localStorage', () => {
    const data = { 'ctrl1||chk1||res1': { key: 'ctrl1||chk1||res1', control_id: 'ctrl1', check_id: 'chk1', resource: 'res1', run_id: 'r', project: 'p', branch: 'b', severity: 'HIGH', pillar: 'enc', timestamp: '2024-01-01T00:00:00Z' } }
    localStorage.setItem(FIRST_SEEN_KEY, JSON.stringify(data))
    expect(loadFirstSeen()).toEqual(data)
  })

  it('clearFirstSeen removes the index', () => {
    localStorage.setItem(FIRST_SEEN_KEY, JSON.stringify({ x: {} }))
    clearFirstSeen()
    expect(loadFirstSeen()).toEqual({})
  })
})

// ── recordFirstSeenFailures ───────────────────────────────────────────────────

describe('recordFirstSeenFailures', () => {
  beforeEach(() => localStorage.clear())

  it('returns 0 when there are no FAIL findings', () => {
    const findings = [makeFinding({ status: 'PASS' }), makeFinding({ status: 'SKIP', check_id: 'chk2', resource: 'other' })]
    expect(recordFirstSeenFailures(findings, makeRun())).toBe(0)
  })

  it('records a first-seen entry for each unique FAIL finding', () => {
    const findings = [makeFinding(), makeFinding({ check_id: 'chk2', resource: 'aws_s3_bucket.logs' })]
    const newCount = recordFirstSeenFailures(findings, makeRun())
    expect(newCount).toBe(2)
    const index = loadFirstSeen()
    expect(Object.keys(index)).toHaveLength(2)
    expect(index['ctrl1||chk1||aws_s3_bucket.main'].severity).toBe('HIGH')
    expect(index['ctrl1||chk2||aws_s3_bucket.logs'].resource).toBe('aws_s3_bucket.logs')
  })

  it('does not duplicate an already-seen failure', () => {
    const finding = makeFinding()
    recordFirstSeenFailures([finding], makeRun({ id: 'run-1' }))
    const second = recordFirstSeenFailures([finding], makeRun({ id: 'run-2' }))
    expect(second).toBe(0)
    expect(Object.keys(loadFirstSeen())).toHaveLength(1)
  })

  it('emits a control_first_failed audit event for each new finding', () => {
    recordFirstSeenFailures([makeFinding()], makeRun())
    const log = loadAuditLog()
    expect(log).toHaveLength(1)
    expect(log[0].action).toBe('control_first_failed')
    expect(log[0].category).toBe('finding')
    expect(log[0].subject_id).toBe('ctrl1')
  })

  it('stores run metadata in the first-seen entry', () => {
    const run = makeRun({ id: 'run-xyz', project: 'billing', branch: 'feat/x' })
    recordFirstSeenFailures([makeFinding()], run)
    const entry = loadFirstSeen()['ctrl1||chk1||aws_s3_bucket.main']
    expect(entry.run_id).toBe('run-xyz')
    expect(entry.project).toBe('billing')
    expect(entry.branch).toBe('feat/x')
    expect(entry.timestamp).toBe(run.created_at)
  })

  it('does not write to localStorage if no new failures found', () => {
    const finding = makeFinding()
    recordFirstSeenFailures([finding], makeRun())
    const ts1 = localStorage.getItem(FIRST_SEEN_KEY)!

    recordFirstSeenFailures([finding], makeRun({ id: 'run-2' }))
    const ts2 = localStorage.getItem(FIRST_SEEN_KEY)!

    // Content should be identical (no write happened for duplicate)
    expect(ts1).toBe(ts2)
  })
})

// ── emitScanReceived ─────────────────────────────────────────────────────────

describe('emitScanReceived', () => {
  beforeEach(() => localStorage.clear())

  it('appends a scan_received event with correct fields', () => {
    emitScanReceived({ id: 'run1', project: 'svc', branch: 'main', git_sha: 'abc1234', triggered_by: 'ci', score: 78 })
    const [e] = loadAuditLog()
    expect(e.action).toBe('scan_received')
    expect(e.category).toBe('scan')
    expect(e.actor).toBe('ci')
    expect(e.subject_id).toBe('run1')
    expect(e.subject_type).toBe('run')
    expect((e.after as Record<string, unknown>)?.score).toBe(78)
  })

  it('falls back to "system" actor when triggered_by is empty', () => {
    emitScanReceived({ id: 'r', project: 'p', branch: 'b', git_sha: 'sha', triggered_by: '', score: 0 })
    expect(loadAuditLog()[0].actor).toBe('system')
  })

  it('includes a short git_sha in the summary', () => {
    emitScanReceived({ id: 'r', project: 'p', branch: 'b', git_sha: 'deadbeef1234', triggered_by: 'alice', score: 90 })
    expect(loadAuditLog()[0].summary).toContain('deadbeef')
  })
})
