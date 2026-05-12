/**
 * BlastRadiusPage — progressive-disclosure view of failing resources.
 *
 * Resources are listed as compact cards sorted by severity.
 * Clicking a card expands it to reveal:
 *  - Failing controls with severity + description
 *  - A mini radial dependency graph showing immediate connections
 *  - Clickable connection chips that jump to related resources
 */

import { useState, useMemo, useRef } from 'react'
import { RunDetail, Finding } from '../api'
import { useI18n } from '../i18n'

interface Props { run: RunDetail }

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#DA2C38', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e',
}
const SEV_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }

const TYPE_LABEL: Record<string, string> = {
  aws_s3_bucket: 'S3 Bucket', aws_s3_bucket_versioning: 'S3 Versioning',
  aws_s3_bucket_server_side_encryption_configuration: 'S3 Encryption',
  aws_s3_bucket_public_access_block: 'S3 Public Access',
  aws_s3_bucket_lifecycle_configuration: 'S3 Lifecycle',
  aws_s3_bucket_acl: 'S3 ACL', aws_s3_bucket_policy: 'S3 Bucket Policy',
  aws_kms_key: 'KMS Key', aws_kms_alias: 'KMS Alias',
  aws_instance: 'EC2 Instance', aws_launch_template: 'Launch Template',
  aws_lambda_function: 'Lambda Function', aws_db_instance: 'RDS Instance',
  aws_dynamodb_table: 'DynamoDB Table', aws_eks_cluster: 'EKS Cluster',
  aws_eks_node_group: 'EKS Node Group', aws_cloudwatch_log_group: 'CloudWatch Log Group',
  aws_cloudwatch_metric_alarm: 'CloudWatch Alarm',
  aws_cloudwatch_log_metric_filter: 'CloudWatch Metric Filter',
  aws_security_group: 'Security Group', aws_iam_account_password_policy: 'IAM Password Policy',
  aws_iam_role: 'IAM Role', aws_iam_policy: 'IAM Policy',
  aws_secretsmanager_secret: 'Secrets Manager Secret', aws_cloudtrail: 'CloudTrail',
  aws_kinesis_stream: 'Kinesis Stream', aws_flow_log: 'VPC Flow Log',
  aws_vpc_endpoint: 'VPC Endpoint', aws_elasticache_cluster: 'ElastiCache',
  azurerm_resource_group: 'Resource Group', azurerm_storage_account: 'Storage Account',
  azurerm_key_vault: 'Key Vault', azurerm_virtual_machine: 'Virtual Machine',
  google_storage_bucket: 'GCS Bucket', google_compute_instance: 'Compute Instance',
  google_sql_database_instance: 'Cloud SQL', provider: 'Provider', terraform: 'Terraform Block',
}

function humanType(rtype: string): string {
  if (TYPE_LABEL[rtype]) return TYPE_LABEL[rtype]
  const noProvider = rtype.replace(/^(aws|azurerm|google|oci|yandex|alicloud)_/, '')
  return noProvider.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function trunc(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface GNode {
  id: string; rtype: string; rtypeLabel: string; name: string
  provider: string; severity: string; failCount: number
  controlIds: string[]; pillar: string; findings: Finding[]
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

// ── Compute nodes (no force layout needed) ────────────────────────────────────
function computeNodes(findings: Finding[]): GNode[] {
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
      rtype === 'provider' ? name.split('.')[0] : rtype === 'terraform' ? 'terraform' :
      rtype.startsWith('azurerm_') ? 'azure' : rtype.startsWith('google_') ? 'gcp' :
      rtype.startsWith('oci_') ? 'oci' : 'aws'
    const sevs = ff.map(f => f.severity?.toUpperCase()).filter(Boolean)
    const severity = sevs.sort((a, b) => (SEV_RANK[b] ?? 0) - (SEV_RANK[a] ?? 0))[0] ?? 'LOW'
    const controlIds = [...new Set(ff.map(f => f.control_id).filter(Boolean))]
    const pillarCnt: Record<string, number> = {}
    for (const f of ff) if (f.pillar) pillarCnt[f.pillar] = (pillarCnt[f.pillar] ?? 0) + 1
    const pillar = Object.entries(pillarCnt).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
    nodes.push({ id: addr, rtype, rtypeLabel: humanType(rtype), name, provider, severity, failCount: controlIds.length, controlIds, pillar, findings: ff })
  }
  return nodes
}

// ── Mini radial dependency graph ──────────────────────────────────────────────
interface MiniNode extends GNode { x: number; y: number; dir: 'up' | 'down' }

function MiniGraph({ center, upstream, downstream, onNavigate }: {
  center: GNode
  upstream: GNode[]
  downstream: GNode[]
  onNavigate: (id: string) => void
}) {
  const W = 320, H = 220, CX = 160, CY = 110, R = 80
  const col = SEV_COLOR[center.severity] ?? '#64748b'

  const all: MiniNode[] = [
    ...upstream.slice(0, 4).map(n => ({ ...n, dir: 'up' as const, x: 0, y: 0 })),
    ...downstream.slice(0, 4).map(n => ({ ...n, dir: 'down' as const, x: 0, y: 0 })),
  ]
  all.forEach((n, i) => {
    const angle = (i / Math.max(all.length, 1)) * 2 * Math.PI - Math.PI / 2
    n.x = CX + R * Math.cos(angle)
    n.y = CY + R * Math.sin(angle)
  })

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <marker id="mini-arr" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
          <polygon points="0 0, 6 2.5, 0 5" fill="#94a3b8" opacity="0.8" />
        </marker>
      </defs>

      {/* Edges */}
      {all.map((n, i) => {
        const dx = n.x - CX, dy = n.y - CY
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        const ux = dx / len, uy = dy / len
        // upstream: arrow from neighbor → center; downstream: center → neighbor
        const [x1, y1, x2, y2] = n.dir === 'up'
          ? [n.x - ux * 20, n.y - uy * 20, CX + ux * 27, CY + uy * 27]
          : [CX + ux * 27, CY + uy * 27, n.x - ux * 20, n.y - uy * 20]
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#94a3b8" strokeWidth="1.4" strokeOpacity="0.55"
            strokeDasharray={n.dir === 'up' ? '4 2' : undefined}
            markerEnd="url(#mini-arr)" />
        )
      })}

      {/* Center node */}
      <circle cx={CX} cy={CY} r={27} fill={`${col}18`} stroke={col} strokeWidth="2.2" />
      <text x={CX} y={CY - 5} textAnchor="middle" fontSize="9" fontWeight="700" fill={col}
        style={{ userSelect: 'none' }}>
        {trunc(center.rtypeLabel.split(' ').slice(0, 2).join(' '), 14)}
      </text>
      <text x={CX} y={CY + 9} textAnchor="middle" fontSize="8" fill={col}
        style={{ userSelect: 'none', fontFamily: 'ui-monospace, monospace' }}>
        {trunc(center.name, 14)}
      </text>

      {/* Neighbor nodes */}
      {all.map((n, i) => {
        const nc = SEV_COLOR[n.severity] ?? '#64748b'
        return (
          <g key={`nb${i}`} style={{ cursor: 'pointer' }} onClick={() => onNavigate(n.id)}>
            <circle cx={n.x} cy={n.y} r={20} fill={`${nc}18`} stroke={nc} strokeWidth="1.5" />
            <text x={n.x} y={n.y - 3} textAnchor="middle" fontSize="7.5" fontWeight="600" fill={nc}
              style={{ userSelect: 'none', pointerEvents: 'none' }}>
              {trunc(humanType(n.rtype).split(' ')[0], 9)}
            </text>
            <text x={n.x} y={n.y + 9} textAnchor="middle" fontSize="6.5" fill="#94a3b8"
              style={{ userSelect: 'none', pointerEvents: 'none' }}>
              {trunc(n.name, 10)}
            </text>
            <title>{n.id}{'\n'}Click to navigate</title>
          </g>
        )
      })}

      {/* Legend */}
      <text x={8} y={H - 8} fontSize="7.5" fill="#94a3b8" style={{ userSelect: 'none' }}>
        — — depends on  ——→ used by
      </text>
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function BlastRadiusPage({ run }: Props) {
  const { t } = useI18n()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [sevFilter, setSevFilter]   = useState('')
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const failFindings = useMemo(
    () => run.findings.filter(f => f.status?.toUpperCase() === 'FAIL'),
    [run.findings]
  )

  const allNodes = useMemo(() => computeNodes(failFindings), [failFindings])
  const edges    = useMemo(() => inferEdges(allNodes), [allNodes])
  const nodeMap  = useMemo(() => new Map(allNodes.map(n => [n.id, n])), [allNodes])

  const nodes = useMemo(() => {
    let n = allNodes
    if (sevFilter) n = n.filter(x => x.severity === sevFilter)
    if (search) { const q = search.toLowerCase(); n = n.filter(x => x.id.toLowerCase().includes(q)) }
    return [...n].sort((a, b) => (SEV_RANK[b.severity] ?? 0) - (SEV_RANK[a.severity] ?? 0) || b.failCount - a.failCount)
  }, [allNodes, sevFilter, search])

  const sevCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const n of allNodes) c[n.severity] = (c[n.severity] ?? 0) + 1
    return c
  }, [allNodes])

  function toggle(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  function navigateTo(id: string) {
    setExpandedId(id)
    setTimeout(() => {
      cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 60)
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (failFindings.length === 0) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--muted)' }}>
        <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ margin: '0 auto 1rem', display: 'block', opacity: 0.25 }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{t('pages.blastRadius.noFailingResources')}</div>
        <div style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>{t('pages.blastRadius.allPassing')}</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Stats strip ── */}
      <div className="card" style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--waf-danger)', lineHeight: 1 }}>{allNodes.length}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginLeft: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{t('pages.blastRadius.failingResources')}</span>
        </div>
        <div style={{ width: '1px', height: '32px', background: 'var(--border)', flexShrink: 0 }} />
        <div>
          <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{edges.length}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginLeft: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{t('pages.blastRadius.inferredDeps')}</span>
        </div>
        <div style={{ width: '1px', height: '32px', background: 'var(--border)', flexShrink: 0 }} />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).filter(s => sevCounts[s]).map(s => (
            <button key={s} onClick={() => setSevFilter(sevFilter === s ? '' : s)} style={{
              fontSize: '0.7rem', fontWeight: 700, padding: '0.25rem 0.65rem', borderRadius: '999px', cursor: 'pointer',
              background: sevFilter === s ? SEV_COLOR[s] : `${SEV_COLOR[s]}20`,
              color: sevFilter === s ? '#fff' : SEV_COLOR[s], border: `1px solid ${SEV_COLOR[s]}50`,
            }}>
              {sevCounts[s]} {s}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--muted)', lineHeight: 1.45 }}>
          {t('pages.blastRadius.clickNode')}
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="text" placeholder={t('pages.blastRadius.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.375rem 0.75rem', fontSize: '0.82rem', color: 'var(--text)', outline: 'none', width: '240px' }} />
        <select value={sevFilter} onChange={e => setSevFilter(e.target.value)} className="filter-select">
          <option value="">{t('pages.blastRadius.allSeverities')}</option>
          {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search || sevFilter) && (
          <button onClick={() => { setSearch(''); setSevFilter('') }}
            style={{ fontSize: '0.78rem', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0.5rem' }}>
            Clear
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--muted)' }}>
          {t('pages.blastRadius.resourcesOf', { count: String(nodes.length), total: String(allNodes.length) })}
        </span>
      </div>

      {/* ── Resource accordion ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {nodes.map(n => {
          const isOpen = expandedId === n.id
          const col = SEV_COLOR[n.severity] ?? '#64748b'
          const upstream   = edges.filter(e => e.tgt === n.id).map(e => nodeMap.get(e.src)).filter((x): x is GNode => !!x)
          const downstream = edges.filter(e => e.src === n.id).map(e => nodeMap.get(e.tgt)).filter((x): x is GNode => !!x)
          const hasLinks = upstream.length > 0 || downstream.length > 0

          return (
            <div key={n.id} ref={el => { cardRefs.current[n.id] = el }}
              className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: `4px solid ${col}`, transition: 'box-shadow 0.2s', boxShadow: isOpen ? `0 0 0 1px ${col}40` : undefined }}>

              {/* ── Card header (always visible) ── */}
              <div onClick={() => toggle(n.id)} style={{ cursor: 'pointer', padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.875rem', userSelect: 'none' }}>
                {/* Severity badge */}
                <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.22rem 0.6rem', borderRadius: '999px', background: `${col}20`, color: col, flexShrink: 0, letterSpacing: '.04em' }}>
                  {n.severity}
                </span>

                {/* Type + name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.12rem', fontWeight: 500 }}>
                    {n.rtypeLabel}
                    {n.provider !== 'aws' && (
                      <span style={{ marginLeft: '0.4rem', fontSize: '0.62rem', fontWeight: 700, opacity: 0.6 }}>{n.provider.toUpperCase()}</span>
                    )}
                  </div>
                  <div style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: 'var(--text)', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.name || n.id}
                  </div>
                </div>

                {/* Meta: pill count + dependency indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
                  {hasLinks && (
                    <span title="Has inferred dependencies" style={{ fontSize: '0.7rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      {upstream.length + downstream.length}
                    </span>
                  )}
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, color: col }}>{n.failCount}</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--muted)', marginLeft: '0.25rem' }}>
                      {n.failCount === 1 ? 'control' : 'controls'}
                    </span>
                  </div>
                  <span style={{ color: 'var(--muted)', fontSize: '1rem', transition: 'transform 0.22s ease', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    ▾
                  </span>
                </div>
              </div>

              {/* ── Expanded content ── */}
              <div style={{
                maxHeight: isOpen ? '900px' : '0',
                opacity: isOpen ? 1 : 0,
                overflow: 'hidden',
                transition: 'max-height 0.38s ease, opacity 0.25s ease',
              }}>
                <div style={{ borderTop: `1px solid ${col}30`, padding: '1.125rem 1rem 1rem', display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>

                  {/* Left: details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Failing controls */}
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '.06em', marginBottom: '0.5rem' }}>
                      {t('pages.blastRadius.failingControls', { count: String(n.controlIds.length) })}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                      {n.controlIds.map(cid => {
                        const ff = n.findings.filter(f => f.control_id === cid)
                        const sev = ff[0]?.severity?.toUpperCase() ?? 'LOW'
                        const sc = SEV_COLOR[sev] ?? '#888'
                        return (
                          <div key={cid} style={{ padding: '0.5rem 0.625rem', borderRadius: '8px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: ff[0]?.check_title ? '0.18rem' : 0 }}>
                              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text)' }}>{cid}</span>
                              <span style={{ marginLeft: 'auto', fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.35rem', borderRadius: '999px', background: `${sc}22`, color: sc, flexShrink: 0 }}>{sev}</span>
                            </div>
                            {ff[0]?.check_title && <div style={{ fontSize: '0.73rem', color: 'var(--muted)', lineHeight: 1.4 }}>{ff[0].check_title}</div>}
                            {ff[0]?.message && <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '0.15rem', lineHeight: 1.35 }}>{ff[0].message}</div>}
                          </div>
                        )
                      })}
                    </div>

                    {/* Connections list */}
                    {hasLinks && (
                      <div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '.06em', marginBottom: '0.4rem' }}>
                          {t('pages.blastRadius.structuralConnections')}
                        </div>
                        {upstream.length > 0 && (
                          <div style={{ marginBottom: '0.35rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '2px', flexShrink: 0 }}>{t('pages.blastRadius.dependsOn')}</span>
                            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                              {upstream.map(dep => (
                                <button key={dep.id} onClick={e => { e.stopPropagation(); navigateTo(dep.id) }}
                                  style={{ fontSize: '0.7rem', padding: '0.18rem 0.5rem', borderRadius: '6px', background: `${SEV_COLOR[dep.severity] ?? '#888'}18`, border: `1px solid ${SEV_COLOR[dep.severity] ?? '#888'}40`, color: SEV_COLOR[dep.severity] ?? '#888', cursor: 'pointer', fontFamily: 'ui-monospace, monospace' }}>
                                  {dep.name || dep.rtypeLabel}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {downstream.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '2px', flexShrink: 0 }}>{t('pages.blastRadius.usedBy')}</span>
                            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                              {downstream.map(dep => (
                                <button key={dep.id} onClick={e => { e.stopPropagation(); navigateTo(dep.id) }}
                                  style={{ fontSize: '0.7rem', padding: '0.18rem 0.5rem', borderRadius: '6px', background: `${SEV_COLOR[dep.severity] ?? '#888'}18`, border: `1px solid ${SEV_COLOR[dep.severity] ?? '#888'}40`, color: SEV_COLOR[dep.severity] ?? '#888', cursor: 'pointer', fontFamily: 'ui-monospace, monospace' }}>
                                  {dep.name || dep.rtypeLabel}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: mini dependency graph (only when there are connections) */}
                  {hasLinks && (
                    <div style={{ width: '240px', flexShrink: 0 }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '.06em', marginBottom: '0.5rem' }}>
                        {t('pages.blastRadius.dependencyMap')}
                      </div>
                      <div className="card" style={{ padding: 0, overflow: 'hidden', background: 'var(--bg)' }}>
                        <MiniGraph
                          center={n}
                          upstream={upstream}
                          downstream={downstream}
                          onNavigate={navigateTo}
                        />
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: '0.35rem', lineHeight: 1.4, textAlign: 'center' }}>
                        {t('pages.blastRadius.clickNode')}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
