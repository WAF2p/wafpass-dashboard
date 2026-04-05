/**
 * DependencyGraphPage — full-resource dependency graph with compliance status overlay.
 *
 * Unlike BlastRadiusPage (FAIL-only, severity-colored), this shows every resource
 * that appears in any finding, colored by its compliance status:
 *   green  = all checks passing
 *   red    = one or more checks failing (size scaled by worst severity)
 *   amber  = mixed pass + fail
 *   gray   = only skipped / waived
 *
 * Edges are the same naming-convention heuristic used by BlastRadiusPage.
 * Selecting a node dims all non-adjacent nodes so the dependency path
 * through the graph is immediately visible.
 */

import { useState, useMemo } from 'react'
import { RunDetail, Finding } from '../api'

interface Props { run: RunDetail }

// ── Constants ─────────────────────────────────────────────────────────────────

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#DA2C38', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e',
}
const SEV_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }

const STATUS_SEED_RING: Record<string, number> = {
  fail: 90, mixed: 200, pass: 310, skip: 390,
}

// Terraform resource type → short abbreviation
const ABBR: Record<string, string> = {
  aws_s3_bucket: 'S3', aws_s3_bucket_versioning: 'S3V',
  aws_s3_bucket_server_side_encryption_configuration: 'SSE',
  aws_s3_bucket_public_access_block: 'S3P', aws_s3_bucket_policy: 'S3Pol',
  aws_kms_key: 'KMS', aws_kms_alias: 'KMSa',
  aws_instance: 'EC2', aws_launch_template: 'LT',
  aws_lambda_function: 'λ', aws_db_instance: 'RDS',
  aws_dynamodb_table: 'DDB', aws_eks_cluster: 'EKS', aws_eks_node_group: 'ENG',
  aws_cloudwatch_log_group: 'CWL', aws_cloudwatch_metric_alarm: 'CWA',
  aws_security_group: 'SG', aws_iam_account_password_policy: 'IAM',
  aws_iam_role: 'IAMr', aws_iam_policy: 'IAMp',
  aws_secretsmanager_secret: 'SM', aws_cloudtrail: 'CT',
  aws_kinesis_stream: 'KNS', aws_flow_log: 'VFL',
  aws_vpc_endpoint: 'VPCe', aws_elasticache_cluster: 'Elc',
  azurerm_resource_group: 'RG', azurerm_storage_account: 'SA',
  azurerm_key_vault: 'KV', azurerm_virtual_machine: 'VM',
  google_storage_bucket: 'GCS', google_compute_instance: 'GCE',
  google_sql_database_instance: 'SQL',
  provider: 'PROV', terraform: 'TF',
}

function getAbbr(rtype: string): string {
  if (ABBR[rtype]) return ABBR[rtype]
  const noProvider = rtype.replace(/^(aws|azurerm|google|oci|yandex|alicloud)_/, '')
  const parts = noProvider.split('_').filter(Boolean)
  if (parts.length === 0) return rtype.slice(0, 3).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 4).toUpperCase()
  return parts.map(p => p[0].toUpperCase()).join('').slice(0, 4)
}

function extractProvider(rtype: string, name: string): string {
  if (rtype === 'provider') return name.split('.')[0]
  if (rtype === 'terraform') return 'terraform'
  if (rtype.startsWith('azurerm_')) return 'azure'
  if (rtype.startsWith('google_')) return 'gcp'
  if (rtype.startsWith('oci_')) return 'oci'
  return 'aws'
}

function extractModulePath(resource: string): string {
  if (!resource?.startsWith('module.')) return '(root)'
  const parts = resource.split('.')
  const segs: string[] = []
  let i = 0
  while (i < parts.length - 1 && parts[i] === 'module') { segs.push(`module.${parts[i + 1]}`); i += 2 }
  return segs.length > 0 ? segs.join('.') : '(root)'
}

// ── Node and edge types ───────────────────────────────────────────────────────

type NodeStatus = 'pass' | 'fail' | 'mixed' | 'skip'

interface DepNode {
  id: string
  rtype: string
  name: string
  abbr: string
  provider: string
  modulePath: string
  worstSev: string
  passCount: number   // unique control_ids with PASS
  failCount: number   // unique control_ids with FAIL
  skipCount: number   // unique control_ids with SKIP/WAIVED
  findings: Finding[]
  status: NodeStatus
  x: number
  y: number
  r: number
}

interface GEdge { src: string; tgt: string }

// ── Node color ────────────────────────────────────────────────────────────────

function nodeColor(n: DepNode): string {
  if (n.status === 'pass')  return '#059669'
  if (n.status === 'skip')  return '#94a3b8'
  if (n.status === 'mixed') return '#d97706'
  // fail — use severity color
  return SEV_COLOR[n.worstSev] ?? '#DA2C38'
}

// ── Edge inference ─────────────────────────────────────────────────────────────
// Type-prefix + same instance name → structural dependency

function inferEdges(nodes: DepNode[]): GEdge[] {
  const edges: GEdge[] = []
  const seen = new Set<string>()
  for (const a of nodes) {
    for (const b of nodes) {
      if (a.id === b.id) continue
      if (b.rtype.startsWith(a.rtype + '_') && b.name === a.name && a.name !== '') {
        const key = `${a.id}→${b.id}`
        if (!seen.has(key)) { seen.add(key); edges.push({ src: a.id, tgt: b.id }) }
      }
    }
  }
  return edges
}

// ── Force layout ───────────────────────────────────────────────────────────────
// Seeded by compliance status rings (fail → center, pass → outside)

function applyForceLayout(nodes: DepNode[], edges: GEdge[], W: number, H: number): void {
  if (nodes.length === 0) return

  const statusIdx: Record<string, number> = {}
  const statusCnt: Record<string, number> = {}
  for (const n of nodes) statusCnt[n.status] = (statusCnt[n.status] ?? 0) + 1
  for (const s in statusCnt) statusIdx[s] = 0

  for (const n of nodes) {
    const ring = STATUS_SEED_RING[n.status] ?? 310
    const count = statusCnt[n.status] || 1
    const idx = statusIdx[n.status]++
    const angle = (idx / count) * 2 * Math.PI - Math.PI / 2
    n.x = W / 2 + ring * Math.cos(angle)
    n.y = H / 2 + ring * Math.sin(angle)
  }

  const nodeIdx = new Map(nodes.map((n, i) => [n.id, i]))
  const vx = new Array(nodes.length).fill(0)
  const vy = new Array(nodes.length).fill(0)

  for (let iter = 0; iter < 280; iter++) {
    const cool = 1 - iter / 280

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x
        const dy = nodes[j].y - nodes[i].y
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01
        const minD = nodes[i].r + nodes[j].r + 12
        if (d < minD) {
          const f = (minD - d) / d * 0.55
          vx[i] -= f * dx; vy[i] -= f * dy
          vx[j] += f * dx; vy[j] += f * dy
        } else {
          const f = 2000 / (d * d) * cool
          vx[i] -= f * dx / d; vy[i] -= f * dy / d
          vx[j] += f * dx / d; vy[j] += f * dy / d
        }
      }
    }

    for (const e of edges) {
      const ai = nodeIdx.get(e.src) ?? -1; const bi = nodeIdx.get(e.tgt) ?? -1
      if (ai < 0 || bi < 0) continue
      const dx = nodes[bi].x - nodes[ai].x; const dy = nodes[bi].y - nodes[ai].y
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01
      const ideal = nodes[ai].r + nodes[bi].r + 24
      const f = (d - ideal) * 0.045
      vx[ai] += f * dx / d; vy[ai] += f * dy / d
      vx[bi] -= f * dx / d; vy[bi] -= f * dy / d
    }

    for (let i = 0; i < nodes.length; i++) {
      nodes[i].x = Math.max(nodes[i].r + 10, Math.min(W - nodes[i].r - 10, nodes[i].x + vx[i]))
      nodes[i].y = Math.max(nodes[i].r + 14, Math.min(H - nodes[i].r - 14, nodes[i].y + vy[i]))
      vx[i] *= 0.78; vy[i] *= 0.78
    }
  }
}

// ── Graph computation ──────────────────────────────────────────────────────────

const SVG_W = 980
const SVG_H = 580

function computeDepGraph(findings: Finding[]): { nodes: DepNode[]; edges: GEdge[] } {
  // Group ALL findings by resource address
  const byRes = new Map<string, Finding[]>()
  for (const f of findings) {
    if (!f.resource) continue
    const arr = byRes.get(f.resource) ?? []; arr.push(f); byRes.set(f.resource, arr)
  }

  const nodes: DepNode[] = []
  for (const [addr, ff] of byRes) {
    // For module paths, the "type" is the last non-module segment
    const stripped = addr.replace(/^(module\.[^.]+\.)+/, '')
    const dot = stripped.indexOf('.')
    const rtype = dot > 0 ? stripped.slice(0, dot) : stripped
    const name  = dot > 0 ? stripped.slice(dot + 1) : ''

    const provider = extractProvider(rtype, name)
    const modulePath = extractModulePath(addr)

    // Per-control pass/fail/skip counts
    const ctrlPass = new Set<string>()
    const ctrlFail = new Set<string>()
    const ctrlSkip = new Set<string>()
    for (const f of ff) {
      if (!f.control_id) continue
      const st = f.status?.toUpperCase()
      if (st === 'PASS') ctrlPass.add(f.control_id)
      else if (st === 'FAIL') ctrlFail.add(f.control_id)
      else ctrlSkip.add(f.control_id)
    }
    // A control that has both pass and fail records counts as fail
    for (const id of ctrlFail) { ctrlPass.delete(id) }

    const passCount = ctrlPass.size
    const failCount = ctrlFail.size
    const skipCount = ctrlSkip.size

    const status: NodeStatus =
      failCount > 0 && passCount > 0 ? 'mixed' :
      failCount > 0 ? 'fail' :
      passCount > 0 ? 'pass' : 'skip'

    const failFindings = ff.filter(f => f.status?.toUpperCase() === 'FAIL')
    const sevs = failFindings.map(f => f.severity?.toUpperCase()).filter(Boolean)
    const worstSev = sevs.sort((a, b) => (SEV_RANK[b] ?? 0) - (SEV_RANK[a] ?? 0))[0] ?? ''

    // Node radius: bigger = more controls checked
    const totalCtrl = passCount + failCount + skipCount
    const r = Math.max(16, Math.min(34, 12 + totalCtrl * 2))

    nodes.push({ id: addr, rtype, name, abbr: getAbbr(rtype), provider, modulePath, worstSev, passCount, failCount, skipCount, findings: ff, status, x: 0, y: 0, r })
  }

  // Sort nodes: fail → mixed → pass → skip (for deterministic seeding)
  const ORDER: Record<string, number> = { fail: 0, mixed: 1, pass: 2, skip: 3 }
  nodes.sort((a, b) => ORDER[a.status] - ORDER[b.status] || (SEV_RANK[b.worstSev] ?? 0) - (SEV_RANK[a.worstSev] ?? 0))

  const edges = inferEdges(nodes)
  applyForceLayout(nodes, edges, SVG_W, SVG_H)
  return { nodes, edges }
}

// ── Status pill ───────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<NodeStatus, string> = { pass: 'PASS', fail: 'FAIL', mixed: 'MIXED', skip: 'SKIP' }
const STATUS_COLOR_MAP: Record<NodeStatus, string> = { pass: '#059669', fail: '#DA2C38', mixed: '#d97706', skip: '#94a3b8' }

function StatusPill({ status }: { status: NodeStatus }) {
  const color = STATUS_COLOR_MAP[status]
  return (
    <span style={{ fontSize: '0.62rem', fontWeight: 800, borderRadius: '4px', padding: '0.1rem 0.45rem', background: `${color}18`, color, letterSpacing: '0.05em', flexShrink: 0 }}>
      {STATUS_LABEL[status]}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DependencyGraphPage({ run }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<NodeStatus | ''>('')
  const [providerFilter, setProviderFilter] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [search, setSearch] = useState('')

  const { nodes: allNodes, edges } = useMemo(
    () => computeDepGraph(run.findings),
    [run.findings]
  )

  const allProviders = useMemo(
    () => [...new Set(allNodes.map(n => n.provider))].sort(),
    [allNodes]
  )

  const allModules = useMemo(
    () => [...new Set(allNodes.map(n => n.modulePath))].sort(),
    [allNodes]
  )

  const nodes = useMemo(() => {
    let n = allNodes
    if (statusFilter)   n = n.filter(x => x.status === statusFilter)
    if (providerFilter) n = n.filter(x => x.provider === providerFilter)
    if (moduleFilter)   n = n.filter(x => x.modulePath === moduleFilter)
    if (search) { const q = search.toLowerCase(); n = n.filter(x => x.id.toLowerCase().includes(q)) }
    return n
  }, [allNodes, statusFilter, providerFilter, moduleFilter, search])

  const visibleIds = useMemo(() => new Set(nodes.map(n => n.id)), [nodes])
  const visEdges   = useMemo(() => edges.filter(e => visibleIds.has(e.src) && visibleIds.has(e.tgt)), [edges, visibleIds])
  const nodeMap    = useMemo(() => new Map(allNodes.map(n => [n.id, n])), [allNodes])
  const selectedNode = useMemo(() => allNodes.find(n => n.id === selectedId) ?? null, [allNodes, selectedId])

  // Nodes adjacent to selection (1-hop neighborhood for dimming)
  const adjacentIds = useMemo(() => {
    if (!selectedId) return null
    const adj = new Set<string>([selectedId])
    for (const e of edges) {
      if (e.src === selectedId) adj.add(e.tgt)
      if (e.tgt === selectedId) adj.add(e.src)
    }
    return adj
  }, [selectedId, edges])

  // Summary counts
  const counts = useMemo(() => {
    const c = { pass: 0, fail: 0, mixed: 0, skip: 0 }
    for (const n of allNodes) c[n.status]++
    return c
  }, [allNodes])

  if (run.findings.filter(f => f.resource).length === 0) {
    return (
      <div className="card" style={{ padding: '4rem', textAlign: 'center', color: 'var(--muted)' }}>
        <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.25 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        No resource addresses in this run's findings.
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px',
    padding: '0.375rem 0.75rem', fontSize: '0.82rem', color: 'var(--text)', outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Stats strip ── */}
      <div className="card" style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{allNodes.length}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginLeft: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>resources</span>
        </div>
        <div style={{ width: '1px', height: '32px', background: 'var(--border)', flexShrink: 0 }} />
        <div>
          <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{visEdges.length}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginLeft: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>edges</span>
        </div>
        <div style={{ width: '1px', height: '32px', background: 'var(--border)', flexShrink: 0 }} />
        {/* Status breakdown clickable pills */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(['fail', 'mixed', 'pass', 'skip'] as NodeStatus[]).filter(s => counts[s] > 0).map(s => (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
              style={{
                fontSize: '0.7rem', fontWeight: 700, padding: '0.25rem 0.65rem', borderRadius: '999px', cursor: 'pointer',
                background: statusFilter === s ? STATUS_COLOR_MAP[s] : `${STATUS_COLOR_MAP[s]}1a`,
                color: statusFilter === s ? '#fff' : STATUS_COLOR_MAP[s],
                border: `1px solid ${STATUS_COLOR_MAP[s]}50`,
              }}>
              {counts[s]} {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--muted)', maxWidth: '240px', lineHeight: 1.45, textAlign: 'right' }}>
          Click node to trace dependencies · green=passing · amber=mixed · red=failing
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="text" placeholder="Search resource address…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: '220px' }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as NodeStatus | '')} style={inputStyle}>
          <option value="">All statuses</option>
          <option value="fail">Failing</option>
          <option value="mixed">Mixed</option>
          <option value="pass">Passing</option>
          <option value="skip">Skip / Waived</option>
        </select>
        {allProviders.length > 1 && (
          <select value={providerFilter} onChange={e => setProviderFilter(e.target.value)} style={inputStyle}>
            <option value="">All providers</option>
            {allProviders.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
          </select>
        )}
        {allModules.length > 1 && (
          <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} style={inputStyle}>
            <option value="">All modules</option>
            {allModules.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        {(search || statusFilter || providerFilter || moduleFilter) && (
          <button onClick={() => { setSearch(''); setStatusFilter(''); setProviderFilter(''); setModuleFilter('') }}
            style={{ fontSize: '0.78rem', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0.5rem' }}>
            Clear
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--muted)' }}>
          {nodes.length} of {allNodes.length} shown
        </span>
      </div>

      {/* ── Graph + detail panel ── */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>

        {/* SVG canvas */}
        <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden', minWidth: 0 }}>
          {/* Legend bar */}
          <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Full Resource Graph
            </span>
            <div style={{ display: 'flex', gap: '0.875rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
              {([
                ['#059669', 'All passing'],
                ['#d97706', 'Mixed'],
                ['#DA2C38', 'Has failures'],
                ['#94a3b8', 'Skip / Waived'],
              ] as const).map(([color, label]) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.68rem', color: 'var(--muted)' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0, border: `1.5px solid ${color}` }} />
                  {label}
                </span>
              ))}
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.68rem', color: 'var(--muted)' }}>
                <svg width="20" height="8" viewBox="0 0 20 8" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="4" x2="13" y2="4" stroke="#94a3b8" strokeWidth="1.5" />
                  <polygon points="13,1 20,4 13,7" fill="#94a3b8" />
                </svg>
                dependency
              </span>
            </div>
          </div>

          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            <defs>
              <marker id="dg-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
              </marker>
            </defs>

            <rect x="0" y="0" width={SVG_W} height={SVG_H} fill="transparent" onClick={() => setSelectedId(null)} />

            {/* Edges */}
            {visEdges.map((e, i) => {
              const s = nodeMap.get(e.src); const t = nodeMap.get(e.tgt)
              if (!s || !t) return null
              const isAdjacentEdge = !adjacentIds || (adjacentIds.has(e.src) && adjacentIds.has(e.tgt))
              const dx = t.x - s.x; const dy = t.y - s.y
              const d = Math.sqrt(dx * dx + dy * dy) || 1
              const edgeColor = s.status === 'fail' || t.status === 'fail' ? '#DA2C38' : '#94a3b8'
              return (
                <line key={i}
                  x1={s.x + (dx / d) * s.r} y1={s.y + (dy / d) * s.r}
                  x2={t.x - (dx / d) * (t.r + 8)} y2={t.y - (dy / d) * (t.r + 8)}
                  stroke={edgeColor}
                  strokeWidth={isAdjacentEdge ? '1.8' : '1'}
                  strokeOpacity={adjacentIds ? (isAdjacentEdge ? 0.7 : 0.12) : 0.45}
                  markerEnd="url(#dg-arrow)" />
              )
            })}

            {/* Nodes */}
            {nodes.map(n => {
              const sel = n.id === selectedId
              const col = nodeColor(n)
              const inAdj = !adjacentIds || adjacentIds.has(n.id)
              const opacity = adjacentIds ? (inAdj ? 1 : 0.2) : 1
              return (
                <g key={n.id} style={{ cursor: 'pointer', opacity }}
                  onClick={e => { e.stopPropagation(); setSelectedId(sel ? null : n.id) }}>
                  {/* Selection ring */}
                  {sel && <circle cx={n.x} cy={n.y} r={n.r + 7} fill="none" stroke="#0094FF" strokeWidth="2.5" opacity="0.75" />}
                  {/* Node body */}
                  <circle cx={n.x} cy={n.y} r={n.r} fill={`${col}20`} stroke={col} strokeWidth={sel ? 2.5 : 1.8} />
                  {/* Abbreviation */}
                  <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central"
                    fontSize={n.abbr.length > 3 ? '8' : n.r > 26 ? '10' : '9'}
                    fontWeight="700" fill={col}
                    style={{ pointerEvents: 'none', userSelect: 'none', fontFamily: 'ui-monospace, monospace' }}>
                    {n.abbr}
                  </text>
                  {/* Instance name label below node */}
                  <text x={n.x} y={n.y + n.r + 10} textAnchor="middle"
                    fontSize="7" fill={col} opacity="0.75"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {n.name.length > 14 ? n.name.slice(0, 13) + '…' : n.name}
                  </text>
                  <title>{n.id}{'\n'}{n.status.toUpperCase()} · {n.passCount} pass / {n.failCount} fail · {n.modulePath}{'\n'}Click to inspect</title>
                </g>
              )
            })}
          </svg>
        </div>

        {/* ── Detail panel ── */}
        {selectedNode && (() => {
          const col = nodeColor(selectedNode)
          const upstream   = edges.filter(e => e.tgt === selectedNode.id).map(e => nodeMap.get(e.src)).filter((n): n is DepNode => !!n)
          const downstream = edges.filter(e => e.src === selectedNode.id).map(e => nodeMap.get(e.tgt)).filter((n): n is DepNode => !!n)
          const failFindings = selectedNode.findings.filter(f => f.status?.toUpperCase() === 'FAIL')
          const passFindings = selectedNode.findings.filter(f => f.status?.toUpperCase() === 'PASS')
          return (
            <div className="card" style={{ width: '340px', flexShrink: 0, maxHeight: '640px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.875rem', padding: '1rem' }}>

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.62rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem', fontWeight: 700 }}>Resource</div>
                  <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem', fontWeight: 700, wordBreak: 'break-all', color: col }}>{selectedNode.id}</div>
                </div>
                <button onClick={() => setSelectedId(null)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.3rem', lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
              </div>

              {/* Status + provider badges */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <StatusPill status={selectedNode.status} />
                <span style={{ fontSize: '0.62rem', fontWeight: 600, padding: '0.1rem 0.45rem', borderRadius: '4px', background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                  {selectedNode.provider.toUpperCase()}
                </span>
                {selectedNode.modulePath !== '(root)' && (
                  <span style={{ fontSize: '0.62rem', fontWeight: 600, padding: '0.1rem 0.45rem', borderRadius: '4px', background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)', fontFamily: 'monospace' }}>
                    {selectedNode.modulePath}
                  </span>
                )}
              </div>

              {/* Control counts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
                {[
                  { label: 'Pass', value: selectedNode.passCount, color: '#059669' },
                  { label: 'Fail', value: selectedNode.failCount, color: '#DA2C38' },
                  { label: 'Skip', value: selectedNode.skipCount, color: '#94a3b8' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ borderRadius: '8px', padding: '0.4rem 0.5rem', background: `${color}0d`, border: `1px solid ${color}25`, textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color }}>{label}</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Failing checks */}
              {failFindings.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#DA2C38', marginBottom: '0.35rem' }}>
                    Failing ({failFindings.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {failFindings.slice(0, 8).map((f, i) => {
                      const sev = (f.severity ?? 'LOW').toUpperCase()
                      return (
                        <div key={i} style={{ padding: '0.35rem 0.5rem', borderRadius: '6px', background: 'rgba(218,44,56,.06)', border: '1px solid rgba(218,44,56,.18)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: f.check_title ? '0.15rem' : 0 }}>
                            <span style={{ fontSize: '0.6rem', fontWeight: 800, borderRadius: '3px', padding: '0.05rem 0.3rem', background: `${SEV_COLOR[sev] ?? '#888'}20`, color: SEV_COLOR[sev] ?? '#888', flexShrink: 0 }}>{sev[0]}</span>
                            <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.control_id}</span>
                          </div>
                          {f.check_title && <div style={{ fontSize: '0.72rem', color: 'var(--text)', lineHeight: 1.3 }}>{f.check_title}</div>}
                        </div>
                      )
                    })}
                    {failFindings.length > 8 && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textAlign: 'center', paddingTop: '0.2rem' }}>+{failFindings.length - 8} more</div>
                    )}
                  </div>
                </div>
              )}

              {/* Sample passing checks */}
              {passFindings.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#059669', marginBottom: '0.35rem' }}>
                    Passing ({passFindings.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    {passFindings.slice(0, 4).map((f, i) => (
                      <div key={i} style={{ fontSize: '0.72rem', color: 'var(--muted)', padding: '0.2rem 0.5rem', borderRadius: '6px', background: 'rgba(5,150,105,.06)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ color: '#059669', fontWeight: 700, flexShrink: 0 }}>✓</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.check_title || f.control_id}</span>
                      </div>
                    ))}
                    {passFindings.length > 4 && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textAlign: 'center', paddingTop: '0.15rem' }}>+{passFindings.length - 4} more passing</div>
                    )}
                  </div>
                </div>
              )}

              {/* Dependency navigation */}
              {(upstream.length > 0 || downstream.length > 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {upstream.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)', marginBottom: '0.3rem' }}>
                        Depends on ({upstream.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {upstream.map(n => (
                          <button key={n.id} onClick={() => setSelectedId(n.id)}
                            style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.65rem', padding: '0.18rem 0.45rem', borderRadius: '5px', background: `${nodeColor(n)}18`, border: `1px solid ${nodeColor(n)}40`, color: nodeColor(n), cursor: 'pointer' }}>
                            {n.name || n.abbr}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {downstream.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--muted)', marginBottom: '0.3rem' }}>
                        Dependents ({downstream.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {downstream.map(n => (
                          <button key={n.id} onClick={() => setSelectedId(n.id)}
                            style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.65rem', padding: '0.18rem 0.45rem', borderRadius: '5px', background: `${nodeColor(n)}18`, border: `1px solid ${nodeColor(n)}40`, color: nodeColor(n), cursor: 'pointer' }}>
                            {n.name || n.abbr}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* ── Resource table ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.625rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>All Resources</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>· click row to highlight in graph</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                {['Resource', 'Type', 'Module', 'Provider', 'Status', 'Pass', 'Fail'].map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {[...nodes]
                .sort((a, b) => {
                  const so: Record<string, number> = { fail: 0, mixed: 1, skip: 2, pass: 3 }
                  return (so[a.status] ?? 4) - (so[b.status] ?? 4) || (SEV_RANK[b.worstSev] ?? 0) - (SEV_RANK[a.worstSev] ?? 0)
                })
                .map(n => {
                  const col = nodeColor(n)
                  return (
                    <tr key={n.id}
                      onClick={() => setSelectedId(n.id === selectedId ? null : n.id)}
                      style={{ cursor: 'pointer', background: n.id === selectedId ? 'rgba(0,148,255,.06)' : undefined }}>
                      <td className="mono" style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: col, fontWeight: 600 }}>
                        {n.id}
                      </td>
                      <td className="mono" style={{ color: 'var(--muted)', fontSize: '0.72rem', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.rtype}
                      </td>
                      <td style={{ fontSize: '0.72rem', color: 'var(--muted)', fontFamily: 'monospace', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.modulePath === '(root)' ? <span style={{ opacity: 0.45 }}>(root)</span> : n.modulePath}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '999px', background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                          {n.provider.toUpperCase()}
                        </span>
                      </td>
                      <td><StatusPill status={n.status} /></td>
                      <td style={{ fontWeight: 700, color: '#059669' }}>{n.passCount || '—'}</td>
                      <td style={{ fontWeight: 700, color: n.failCount > 0 ? '#DA2C38' : 'var(--muted)' }}>{n.failCount || '—'}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
