/**
 * BlastRadiusPage — interactive dependency graph of all failing resources.
 *
 * Nodes are every resource address that has at least one FAIL finding.
 * Edges are inferred from Terraform naming conventions:
 *   if resourceB.type starts with resourceA.type + "_" and they share the same
 *   instance name, B is structurally dependent on A
 *   (e.g. aws_s3_bucket.x → aws_s3_bucket_versioning.x).
 *
 * Layout: force-directed simulation seeded by concentric severity rings.
 * Runs synchronously in useMemo — ~5 ms for 70 nodes.
 */

import { useState, useMemo } from 'react'
import { RunDetail, Finding } from '../api'

interface Props { run: RunDetail }

// ── Severity constants ───────────────────────────────────────────────────────
const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#DA2C38', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e',
}
const SEV_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }

// ── Resource type short labels ───────────────────────────────────────────────
const ABBR: Record<string, string> = {
  aws_s3_bucket: 'S3',
  aws_s3_bucket_versioning: 'S3V',
  aws_s3_bucket_lifecycle_configuration: 'S3LC',
  aws_s3_bucket_server_side_encryption_configuration: 'SSE',
  aws_s3_bucket_public_access_block: 'S3P',
  aws_s3_bucket_acl: 'ACL',
  aws_s3_bucket_policy: 'S3Pol',
  aws_kms_key: 'KMS',
  aws_kms_alias: 'KMSa',
  aws_instance: 'EC2',
  aws_launch_template: 'LT',
  aws_lambda_function: 'λ',
  aws_db_instance: 'RDS',
  aws_dynamodb_table: 'DDB',
  aws_eks_cluster: 'EKS',
  aws_eks_node_group: 'ENG',
  aws_cloudwatch_log_group: 'CWL',
  aws_cloudwatch_metric_alarm: 'CWA',
  aws_cloudwatch_log_metric_filter: 'CWF',
  aws_security_group: 'SG',
  aws_iam_account_password_policy: 'IAM',
  aws_iam_role: 'IAMr',
  aws_iam_policy: 'IAMp',
  aws_secretsmanager_secret: 'SM',
  aws_cloudtrail: 'CT',
  aws_kinesis_stream: 'KNS',
  aws_flow_log: 'VFL',
  aws_vpc_endpoint: 'VPCe',
  aws_elasticache_cluster: 'Elc',
  azurerm_resource_group: 'RG',
  google_storage_bucket: 'GCS',
  google_compute_instance: 'GCE',
  provider: 'PROV',
  terraform: 'TF',
}

function getAbbr(rtype: string): string {
  if (ABBR[rtype]) return ABBR[rtype]
  const noProvider = rtype.replace(/^(aws|azurerm|google|oci|yandex|alicloud)_/, '')
  const parts = noProvider.split('_').filter(Boolean)
  if (parts.length === 0) return rtype.slice(0, 3).toUpperCase()
  if (parts.length === 1) return parts[0].slice(0, 4).toUpperCase()
  return parts.map(p => p[0].toUpperCase()).join('').slice(0, 4)
}

// ── Graph types ──────────────────────────────────────────────────────────────
interface GNode {
  id: string
  rtype: string
  name: string
  abbr: string
  provider: string
  severity: string
  failCount: number
  controlIds: string[]
  pillar: string
  findings: Finding[]
  x: number
  y: number
  r: number
}
interface GEdge { src: string; tgt: string }

// ── Edge inference ────────────────────────────────────────────────────────────
function inferEdges(nodes: GNode[]): GEdge[] {
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

// ── Force layout ──────────────────────────────────────────────────────────────
function applyForceLayout(nodes: GNode[], edges: GEdge[], W: number, H: number): void {
  if (nodes.length === 0) return

  // Seed: concentric severity rings
  const rings: Record<string, number> = { CRITICAL: 60, HIGH: 145, MEDIUM: 235, LOW: 315 }
  const sevIdx: Record<string, number> = {}
  const sevCnt: Record<string, number> = {}
  for (const n of nodes) sevCnt[n.severity] = (sevCnt[n.severity] ?? 0) + 1
  for (const sev in sevCnt) sevIdx[sev] = 0

  for (const n of nodes) {
    const ring = rings[n.severity] ?? 315
    const count = sevCnt[n.severity] || 1
    const idx = sevIdx[n.severity]++
    const angle = (idx / count) * 2 * Math.PI - Math.PI / 2
    n.x = W / 2 + ring * Math.cos(angle)
    n.y = H / 2 + ring * Math.sin(angle)
  }

  const nodeIdx = new Map(nodes.map((n, i) => [n.id, i]))
  const vx = new Array(nodes.length).fill(0)
  const vy = new Array(nodes.length).fill(0)

  for (let iter = 0; iter < 280; iter++) {
    const cool = 1 - iter / 280

    // Repulsion between every pair
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x
        const dy = nodes[j].y - nodes[i].y
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01
        const minD = nodes[i].r + nodes[j].r + 14
        if (d < minD) {
          const f = (minD - d) / d * 0.55
          vx[i] -= f * dx; vy[i] -= f * dy
          vx[j] += f * dx; vy[j] += f * dy
        } else {
          const f = 2200 / (d * d) * cool
          vx[i] -= f * dx / d; vy[i] -= f * dy / d
          vx[j] += f * dx / d; vy[j] += f * dy / d
        }
      }
    }

    // Spring along inferred edges
    for (const e of edges) {
      const ai = nodeIdx.get(e.src) ?? -1
      const bi = nodeIdx.get(e.tgt) ?? -1
      if (ai < 0 || bi < 0) continue
      const dx = nodes[bi].x - nodes[ai].x
      const dy = nodes[bi].y - nodes[ai].y
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01
      const ideal = nodes[ai].r + nodes[bi].r + 28
      const f = (d - ideal) * 0.045
      vx[ai] += f * dx / d; vy[ai] += f * dy / d
      vx[bi] -= f * dx / d; vy[bi] -= f * dy / d
    }

    // Integrate + damp + clamp
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].x = Math.max(nodes[i].r + 10, Math.min(W - nodes[i].r - 10, nodes[i].x + vx[i]))
      nodes[i].y = Math.max(nodes[i].r + 14, Math.min(H - nodes[i].r - 14, nodes[i].y + vy[i]))
      vx[i] *= 0.78; vy[i] *= 0.78
    }
  }
}

// ── Graph computation ─────────────────────────────────────────────────────────
const SVG_W = 980
const SVG_H = 560

function computeGraph(findings: Finding[]): { nodes: GNode[]; edges: GEdge[] } {
  const byRes = new Map<string, Finding[]>()
  for (const f of findings) {
    if (!f.resource || f.status?.toUpperCase() !== 'FAIL') continue
    const arr = byRes.get(f.resource) ?? []; arr.push(f); byRes.set(f.resource, arr)
  }

  const nodes: GNode[] = []
  for (const [addr, ff] of byRes) {
    const dot = addr.indexOf('.')
    const rtype = dot > 0 ? addr.slice(0, dot) : addr
    const name  = dot > 0 ? addr.slice(dot + 1) : ''

    const provider =
      rtype === 'provider'   ? name.split('.')[0] :
      rtype === 'terraform'  ? 'terraform' :
      rtype.startsWith('azurerm_')  ? 'azure' :
      rtype.startsWith('google_')   ? 'gcp' :
      rtype.startsWith('oci_')      ? 'oci' :
      rtype.startsWith('alicloud_') ? 'alicloud' :
      rtype.startsWith('yandex_')   ? 'yandex' :
                                      'aws'

    const sevs = ff.map(f => f.severity?.toUpperCase()).filter(Boolean)
    const severity = sevs.sort((a, b) => (SEV_RANK[b] ?? 0) - (SEV_RANK[a] ?? 0))[0] ?? 'LOW'
    const controlIds = [...new Set(ff.map(f => f.control_id).filter(Boolean))]

    const pillarCnt: Record<string, number> = {}
    for (const f of ff) if (f.pillar) pillarCnt[f.pillar] = (pillarCnt[f.pillar] ?? 0) + 1
    const pillar = Object.entries(pillarCnt).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''

    const r = Math.max(18, Math.min(36, 14 + controlIds.length * 2.4))

    nodes.push({ id: addr, rtype, name, abbr: getAbbr(rtype), provider, severity, failCount: controlIds.length, controlIds, pillar, findings: ff, x: 0, y: 0, r })
  }

  const edges = inferEdges(nodes)
  applyForceLayout(nodes, edges, SVG_W, SVG_H)
  return { nodes, edges }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function BlastRadiusPage({ run }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [sevFilter, setSevFilter]   = useState('')
  const [pillarFilter, setPillarFilter] = useState('')

  const failFindings = useMemo(
    () => run.findings.filter(f => f.status?.toUpperCase() === 'FAIL'),
    [run.findings]
  )

  const allPillars = useMemo(
    () => [...new Set(failFindings.map(f => f.pillar).filter(Boolean))].sort(),
    [failFindings]
  )

  const { nodes: allNodes, edges } = useMemo(() => computeGraph(failFindings), [failFindings])

  const nodes = useMemo(() => {
    let n = allNodes
    if (sevFilter)    n = n.filter(x => x.severity === sevFilter)
    if (pillarFilter) n = n.filter(x => x.pillar === pillarFilter)
    if (search) { const q = search.toLowerCase(); n = n.filter(x => x.id.toLowerCase().includes(q)) }
    return n
  }, [allNodes, sevFilter, pillarFilter, search])

  const visibleIds = useMemo(() => new Set(nodes.map(n => n.id)), [nodes])
  const visEdges   = useMemo(() => edges.filter(e => visibleIds.has(e.src) && visibleIds.has(e.tgt)), [edges, visibleIds])
  const nodeMap    = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes])
  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedId) ?? null, [nodes, selectedId])

  const sevCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const n of allNodes) c[n.severity] = (c[n.severity] ?? 0) + 1
    return c
  }, [allNodes])

  // ── Empty state ────────────────────────────────────────────────────────────
  if (failFindings.length === 0) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--muted)' }}>
        <svg width="52" height="52" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.25 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        <div style={{ fontWeight: 700, fontSize: '1rem' }}>No failing resources</div>
        <div style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>All controls are passing in this run.</div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Stats header ── */}
      <div className="card" style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--waf-danger)', lineHeight: 1 }}>{allNodes.length}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginLeft: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>failing resources</span>
        </div>
        <div style={{ width: '1px', height: '32px', background: 'var(--border)', flexShrink: 0 }} />
        <div>
          <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{edges.length}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginLeft: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>structural edges</span>
        </div>
        <div style={{ width: '1px', height: '32px', background: 'var(--border)', flexShrink: 0 }} />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).filter(s => sevCounts[s]).map(s => (
            <button key={s} onClick={() => setSevFilter(sevFilter === s ? '' : s)}
              style={{
                fontSize: '0.7rem', fontWeight: 700, padding: '0.25rem 0.65rem', borderRadius: '999px', cursor: 'pointer',
                background: sevFilter === s ? SEV_COLOR[s] : `${SEV_COLOR[s]}20`,
                color: sevFilter === s ? '#fff' : SEV_COLOR[s],
                border: `1px solid ${SEV_COLOR[s]}50`,
              }}>
              {sevCounts[s]} {s}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--muted)', maxWidth: '260px', lineHeight: 1.45 }}>
          Node size = failing controls count · edges = inferred structural dependencies
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text" placeholder="Search resource address…" value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px',
            padding: '0.375rem 0.75rem', fontSize: '0.82rem', color: 'var(--text)',
            outline: 'none', width: '240px',
          }}
        />
        <select value={sevFilter} onChange={e => setSevFilter(e.target.value)} className="filter-select">
          <option value="">All severities</option>
          {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={pillarFilter} onChange={e => setPillarFilter(e.target.value)} className="filter-select">
          <option value="">All pillars</option>
          {allPillars.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {(search || sevFilter || pillarFilter) && (
          <button onClick={() => { setSearch(''); setSevFilter(''); setPillarFilter('') }}
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

        {/* SVG graph */}
        <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden', minWidth: 0 }}>
          {/* Graph header / legend */}
          <div style={{ padding: '0.625rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Dependency Graph
            </span>
            <div style={{ display: 'flex', gap: '1rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
              {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(s => (
                <span key={s} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.68rem', color: 'var(--muted)' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: SEV_COLOR[s], display: 'inline-block', flexShrink: 0 }} />
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </span>
              ))}
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.68rem', color: 'var(--muted)' }}>
                <svg width="18" height="8" viewBox="0 0 18 8" style={{ flexShrink: 0 }}>
                  <line x1="0" y1="4" x2="12" y2="4" stroke="#94a3b8" strokeWidth="1.5" />
                  <polygon points="12,1 18,4 12,7" fill="#94a3b8" />
                </svg>
                dependency
              </span>
            </div>
          </div>

          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            <defs>
              <marker id="br-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
              </marker>
            </defs>

            {/* Click-to-deselect background */}
            <rect x="0" y="0" width={SVG_W} height={SVG_H} fill="transparent" onClick={() => setSelectedId(null)} />

            {/* Edges */}
            {visEdges.map((e, i) => {
              const s = nodeMap.get(e.src); const t = nodeMap.get(e.tgt)
              if (!s || !t) return null
              const dx = t.x - s.x; const dy = t.y - s.y
              const d = Math.sqrt(dx * dx + dy * dy) || 1
              return (
                <line key={i}
                  x1={s.x + (dx / d) * s.r} y1={s.y + (dy / d) * s.r}
                  x2={t.x - (dx / d) * (t.r + 8)} y2={t.y - (dy / d) * (t.r + 8)}
                  stroke="#94a3b8" strokeWidth="1.5" strokeOpacity="0.55"
                  markerEnd="url(#br-arrow)" />
              )
            })}

            {/* Nodes */}
            {nodes.map(n => {
              const sel = n.id === selectedId
              const col = SEV_COLOR[n.severity] ?? '#64748b'
              return (
                <g key={n.id} style={{ cursor: 'pointer' }}
                  onClick={e => { e.stopPropagation(); setSelectedId(sel ? null : n.id) }}>
                  {sel && <circle cx={n.x} cy={n.y} r={n.r + 6} fill="none" stroke="#0094FF" strokeWidth="2.5" opacity="0.65" />}
                  <circle cx={n.x} cy={n.y} r={n.r} fill={`${col}26`} stroke={col} strokeWidth={sel ? 2.5 : 1.5} />
                  <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central"
                    fontSize={n.abbr.length > 3 ? '8' : n.r > 28 ? '11' : '9'}
                    fontWeight="700" fill={col}
                    style={{ pointerEvents: 'none', userSelect: 'none', fontFamily: 'ui-monospace, monospace' }}>
                    {n.abbr}
                  </text>
                  <text x={n.x} y={n.y + n.r + 11} textAnchor="middle"
                    fontSize="7.5" fill="#64748b"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {n.name.length > 15 ? n.name.slice(0, 14) + '…' : n.name}
                  </text>
                  <title>{n.id}{'\n'}{n.severity} · {n.failCount} control{n.failCount !== 1 ? 's' : ''} failing{'\n'}Click to inspect</title>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Detail panel */}
        {selectedNode && (
          <div className="card" style={{ width: '340px', flexShrink: 0, maxHeight: '600px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem', fontWeight: 600 }}>Resource</div>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.78rem', fontWeight: 700, wordBreak: 'break-all', color: 'var(--text)' }}>{selectedNode.id}</div>
              </div>
              <button onClick={() => setSelectedId(null)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.3rem', lineHeight: 1, padding: 0, flexShrink: 0, marginTop: '1px' }}>
                ×
              </button>
            </div>

            {/* Badges */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px', background: `${SEV_COLOR[selectedNode.severity]}22`, color: SEV_COLOR[selectedNode.severity] }}>
                {selectedNode.severity}
              </span>
              <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                {selectedNode.provider.toUpperCase()}
              </span>
              {selectedNode.pillar && (
                <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                  {selectedNode.pillar}
                </span>
              )}
            </div>

            {/* Failing controls */}
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem', fontWeight: 600 }}>
                Failing Controls ({selectedNode.controlIds.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selectedNode.controlIds.map(cid => {
                  const ff = selectedNode.findings.filter(f => f.control_id === cid)
                  const sev = ff[0]?.severity?.toUpperCase() ?? 'LOW'
                  return (
                    <div key={cid} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.5rem 0.625rem', background: 'var(--bg)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: ff[0]?.check_title ? '0.2rem' : 0 }}>
                        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text)' }}>{cid}</span>
                        <span style={{ marginLeft: 'auto', fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '999px', background: `${SEV_COLOR[sev] ?? '#888'}22`, color: SEV_COLOR[sev] ?? '#888', flexShrink: 0 }}>
                          {sev}
                        </span>
                      </div>
                      {ff[0]?.check_title && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.4 }}>{ff[0].check_title}</div>
                      )}
                      {ff[0]?.message && (
                        <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '0.2rem', lineHeight: 1.35 }}>{ff[0].message}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Dependencies / dependents */}
            {(() => {
              const upstream   = edges.filter(e => e.tgt === selectedNode.id).map(e => nodeMap.get(e.src)).filter((n): n is GNode => !!n)
              const downstream = edges.filter(e => e.src === selectedNode.id).map(e => nodeMap.get(e.tgt)).filter((n): n is GNode => !!n)
              if (!upstream.length && !downstream.length) return null
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {upstream.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem', fontWeight: 600 }}>
                        Depends on ({upstream.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {upstream.map(n => (
                          <button key={n.id} onClick={() => setSelectedId(n.id)}
                            style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.68rem', padding: '0.2rem 0.5rem', borderRadius: '6px', background: `${SEV_COLOR[n.severity]}18`, border: `1px solid ${SEV_COLOR[n.severity]}40`, color: SEV_COLOR[n.severity], cursor: 'pointer' }}>
                            {n.name || n.id}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {downstream.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem', fontWeight: 600 }}>
                        Dependents ({downstream.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {downstream.map(n => (
                          <button key={n.id} onClick={() => setSelectedId(n.id)}
                            style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.68rem', padding: '0.2rem 0.5rem', borderRadius: '6px', background: `${SEV_COLOR[n.severity]}18`, border: `1px solid ${SEV_COLOR[n.severity]}40`, color: SEV_COLOR[n.severity], cursor: 'pointer' }}>
                            {n.name || n.id}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* ── Resource table ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '0.625rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Affected Resources
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>· sorted by severity · click row to highlight in graph</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                {['Resource', 'Type', 'Provider', 'Severity', 'Controls', 'Pillar'].map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {[...nodes]
                .sort((a, b) => (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0) || b.failCount - a.failCount)
                .map(n => (
                  <tr key={n.id}
                    onClick={() => setSelectedId(n.id === selectedId ? null : n.id)}
                    style={{ cursor: 'pointer', background: n.id === selectedId ? 'rgba(0,148,255,.06)' : undefined }}>
                    <td className="mono" style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.id}
                    </td>
                    <td className="mono" style={{ color: 'var(--muted)', fontSize: '0.72rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.rtype}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.12rem 0.45rem', borderRadius: '999px', background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                        {n.provider.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.12rem 0.5rem', borderRadius: '999px', background: `${SEV_COLOR[n.severity]}22`, color: SEV_COLOR[n.severity] }}>
                        {n.severity}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700 }}>{n.failCount}</td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.78rem', textTransform: 'capitalize' }}>{n.pillar || '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
