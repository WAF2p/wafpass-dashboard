/**
 * DependencyGraphPage — grouped compliance health view with progressive disclosure.
 *
 * Resources are grouped by compliance status (FAILING → MIXED → PASSING → SKIP).
 * Each group starts collapsed (except FAILING and MIXED) to avoid information overload.
 * Clicking a resource card expands it to reveal:
 *  - Pass / fail / skip control counts
 *  - Specific failing checks with descriptions
 *  - Inferred structural connections (clickable to navigate to related resources)
 */

import { useState, useMemo, useRef } from 'react'
import { RunDetail, Finding } from '../api'
import { useI18n } from '../i18n'

interface Props { run: RunDetail }

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#DA2C38', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e',
}
const SEV_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }

const STATUS_COLOR: Record<string, string> = {
  fail: '#DA2C38', mixed: '#d97706', pass: '#059669', skip: '#94a3b8',
}
const STATUS_LABEL: Record<string, string> = {
  fail: 'FAILING', mixed: 'MIXED', pass: 'PASSING', skip: 'SKIP / WAIVED',
}
const STATUS_ORDER = ['fail', 'mixed', 'pass', 'skip']

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

function extractModule(resource: string): string {
  if (!resource?.startsWith('module.')) return '(root)'
  const parts = resource.split('.')
  const segs: string[] = []
  let i = 0
  while (i < parts.length - 1 && parts[i] === 'module') { segs.push(`module.${parts[i + 1]}`); i += 2 }
  return segs.length > 0 ? segs.join('.') : '(root)'
}

// ── Types ─────────────────────────────────────────────────────────────────────
type NodeStatus = 'pass' | 'fail' | 'mixed' | 'skip'

interface DepNode {
  id: string; rtype: string; rtypeLabel: string; name: string
  provider: string; modulePath: string; worstSev: string
  passCount: number; failCount: number; skipCount: number
  findings: Finding[]; status: NodeStatus
}
interface GEdge { src: string; tgt: string }

// ── Edge inference ────────────────────────────────────────────────────────────
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

// ── Compute nodes ─────────────────────────────────────────────────────────────
function computeNodes(findings: Finding[]): DepNode[] {
  const byRes = new Map<string, Finding[]>()
  for (const f of findings) {
    if (!f.resource) continue
    const arr = byRes.get(f.resource) ?? []; arr.push(f); byRes.set(f.resource, arr)
  }

  const nodes: DepNode[] = []
  for (const [addr, ff] of byRes) {
    const stripped = addr.replace(/^(module\.[^.]+\.)+/, '')
    const dot = stripped.indexOf('.')
    const rtype = dot > 0 ? stripped.slice(0, dot) : stripped
    const name  = dot > 0 ? stripped.slice(dot + 1) : ''
    const provider =
      rtype === 'provider' ? name.split('.')[0] : rtype === 'terraform' ? 'terraform' :
      rtype.startsWith('azurerm_') ? 'azure' : rtype.startsWith('google_') ? 'gcp' :
      rtype.startsWith('oci_') ? 'oci' : 'aws'
    const modulePath = extractModule(addr)

    const ctrlPass = new Set<string>(), ctrlFail = new Set<string>(), ctrlSkip = new Set<string>()
    for (const f of ff) {
      if (!f.control_id) continue
      const st = f.status?.toUpperCase()
      if (st === 'PASS') ctrlPass.add(f.control_id)
      else if (st === 'FAIL') ctrlFail.add(f.control_id)
      else ctrlSkip.add(f.control_id)
    }
    for (const id of ctrlFail) ctrlPass.delete(id)

    const passCount = ctrlPass.size, failCount = ctrlFail.size, skipCount = ctrlSkip.size
    const status: NodeStatus =
      failCount > 0 && passCount > 0 ? 'mixed' :
      failCount > 0 ? 'fail' :
      passCount > 0 ? 'pass' : 'skip'

    const failFF = ff.filter(f => f.status?.toUpperCase() === 'FAIL')
    const sevs = failFF.map(f => f.severity?.toUpperCase()).filter(Boolean)
    const worstSev = sevs.sort((a, b) => (SEV_RANK[b] ?? 0) - (SEV_RANK[a] ?? 0))[0] ?? ''

    nodes.push({ id: addr, rtype, rtypeLabel: humanType(rtype), name, provider, modulePath, worstSev, passCount, failCount, skipCount, findings: ff, status })
  }
  return nodes
}

function nodeColor(n: DepNode): string {
  if (n.status === 'pass')  return '#059669'
  if (n.status === 'skip')  return '#94a3b8'
  if (n.status === 'mixed') return '#d97706'
  return SEV_COLOR[n.worstSev] ?? '#DA2C38'
}

// ── Resource card ─────────────────────────────────────────────────────────────
function ResourceCard({ node, edges, nodeMap, isOpen, onToggle, onNavigate }: {
  node: DepNode
  edges: GEdge[]
  nodeMap: Map<string, DepNode>
  isOpen: boolean
  onToggle: () => void
  onNavigate: (id: string) => void
}) {
  const { t } = useI18n()
  const col = nodeColor(node)
  const total = node.passCount + node.failCount + node.skipCount
  const passRatio = total > 0 ? node.passCount / total : 0

  const upstream   = edges.filter(e => e.tgt === node.id).map(e => nodeMap.get(e.src)).filter((x): x is DepNode => !!x)
  const downstream = edges.filter(e => e.src === node.id).map(e => nodeMap.get(e.tgt)).filter((x): x is DepNode => !!x)
  const hasLinks   = upstream.length > 0 || downstream.length > 0

  const failFindings = node.findings.filter(f => f.status?.toUpperCase() === 'FAIL')
  const passFindings = node.findings.filter(f => f.status?.toUpperCase() === 'PASS')

  return (
    <div style={{ borderRadius: '10px', overflow: 'hidden', border: `1px solid ${isOpen ? col + '50' : 'var(--border)'}`, background: 'var(--surface)', transition: 'border-color 0.2s' }}>

      {/* Card header */}
      <div onClick={onToggle} style={{ cursor: 'pointer', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', userSelect: 'none', borderLeft: `4px solid ${col}` }}>
        {/* Status dot */}
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col, flexShrink: 0, boxShadow: isOpen ? `0 0 0 3px ${col}25` : undefined }} />

        {/* Type + name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '0.1rem', fontWeight: 500 }}>
            {node.rtypeLabel}
            {node.modulePath !== '(root)' && (
              <span style={{ marginLeft: '0.4rem', fontFamily: 'monospace', fontSize: '0.62rem', opacity: 0.7 }}>{node.modulePath}</span>
            )}
          </div>
          <div style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: col, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.name || node.id}
          </div>
        </div>

        {/* Pass ratio bar + counts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          {/* Mini ratio bar */}
          <div style={{ width: '60px', height: '5px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden' }}>
            {passRatio > 0 && <div style={{ width: `${passRatio * 100}%`, height: '100%', background: '#059669', borderRadius: '3px', opacity: 0.8 }} />}
          </div>
          {/* Counts */}
          <div style={{ display: 'flex', gap: '0.4rem', fontSize: '0.72rem', fontWeight: 700 }}>
            {node.passCount > 0 && <span style={{ color: '#059669' }}>✓{node.passCount}</span>}
            {node.failCount > 0 && <span style={{ color: '#DA2C38' }}>✗{node.failCount}</span>}
            {node.skipCount > 0 && node.passCount === 0 && node.failCount === 0 && (
              <span style={{ color: '#94a3b8' }}>{node.skipCount} skip</span>
            )}
          </div>
          {hasLinks && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2" opacity="0.6" style={{ flexShrink: 0 }}>
              <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          )}
          <span style={{ color: 'var(--muted)', fontSize: '1rem', transition: 'transform 0.22s ease', display: 'inline-block', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            ▾
          </span>
        </div>
      </div>

      {/* Expanded section */}
      <div style={{
        maxHeight: isOpen ? '800px' : '0',
        opacity: isOpen ? 1 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.38s ease, opacity 0.25s ease',
      }}>
        <div style={{ padding: '1rem', borderTop: `1px solid ${col}25`, display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>

          {/* Control counts */}
          <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.125rem' }}>
            {[
              { label: t('pages.dependencyGraph.passingLabel'), value: node.passCount, color: '#059669' },
              { label: t('pages.dependencyGraph.failingLabel'), value: node.failCount, color: '#DA2C38' },
              { label: t('pages.dependencyGraph.skippedLabel'), value: node.skipCount, color: '#94a3b8' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ borderRadius: '8px', padding: '0.4rem 0.6rem', background: `${color}0d`, border: `1px solid ${color}20`, textAlign: 'center' }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', color, letterSpacing: '.05em' }}>{label}</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Failing checks */}
          {failFindings.length > 0 && (
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#DA2C38', letterSpacing: '.06em', marginBottom: '0.4rem' }}>
                {t('pages.dependencyGraph.failingChecks', { count: String(failFindings.length) })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {failFindings.slice(0, 6).map((f, i) => {
                  const sev = (f.severity ?? 'LOW').toUpperCase()
                  const sc = SEV_COLOR[sev] ?? '#888'
                  return (
                    <div key={i} style={{ padding: '0.4rem 0.6rem', borderRadius: '7px', background: 'rgba(218,44,56,.06)', border: '1px solid rgba(218,44,56,.16)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: f.check_title ? '0.12rem' : 0 }}>
                        <span style={{ fontSize: '0.6rem', fontWeight: 800, borderRadius: '3px', padding: '0.05rem 0.3rem', background: `${sc}20`, color: sc, flexShrink: 0 }}>{sev[0]}</span>
                        <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.control_id}</span>
                      </div>
                      {f.check_title && <div style={{ fontSize: '0.73rem', color: 'var(--text)', lineHeight: 1.35 }}>{f.check_title}</div>}
                    </div>
                  )
                })}
                {failFindings.length > 6 && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textAlign: 'center', paddingTop: '0.1rem' }}>{t('pages.dependencyGraph.moreFailing', { count: String(failFindings.length - 6) })}</div>
                )}
              </div>
            </div>
          )}

          {/* Sample passing (only when mixed) */}
          {node.status === 'mixed' && passFindings.length > 0 && (
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#059669', letterSpacing: '.06em', marginBottom: '0.4rem' }}>
                {t('pages.dependencyGraph.passingSample')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {passFindings.slice(0, 5).map((f, i) => (
                  <span key={i} style={{ fontSize: '0.7rem', padding: '0.18rem 0.5rem', borderRadius: '6px', background: 'rgba(5,150,105,.08)', border: '1px solid rgba(5,150,105,.2)', color: '#059669', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ fontWeight: 700 }}>✓</span>
                    {f.check_title || f.control_id}
                  </span>
                ))}
                {passFindings.length > 5 && <span style={{ fontSize: '0.7rem', color: 'var(--muted)', alignSelf: 'center' }}>+{passFindings.length - 5} more</span>}
              </div>
            </div>
          )}

          {/* Connections */}
          {hasLinks && (
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '.06em', marginBottom: '0.4rem' }}>
                {t('pages.dependencyGraph.connections')}
              </div>
              {upstream.length > 0 && (
                <div style={{ marginBottom: '0.3rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '2px', flexShrink: 0 }}>{t('pages.dependencyGraph.dependsOn')}</span>
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {upstream.map(dep => (
                      <button key={dep.id} onClick={e => { e.stopPropagation(); onNavigate(dep.id) }}
                        style={{ fontSize: '0.7rem', padding: '0.18rem 0.5rem', borderRadius: '6px', background: `${nodeColor(dep)}18`, border: `1px solid ${nodeColor(dep)}40`, color: nodeColor(dep), cursor: 'pointer', fontFamily: 'ui-monospace, monospace' }}>
                        {dep.name || dep.rtypeLabel}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {downstream.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '2px', flexShrink: 0 }}>{t('pages.dependencyGraph.usedBy')}</span>
                  <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                    {downstream.map(dep => (
                      <button key={dep.id} onClick={e => { e.stopPropagation(); onNavigate(dep.id) }}
                        style={{ fontSize: '0.7rem', padding: '0.18rem 0.5rem', borderRadius: '6px', background: `${nodeColor(dep)}18`, border: `1px solid ${nodeColor(dep)}40`, color: nodeColor(dep), cursor: 'pointer', fontFamily: 'ui-monospace, monospace' }}>
                        {dep.name || dep.rtypeLabel}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DependencyGraphPage({ run }: Props) {
  const { t } = useI18n()
  const [expandedId, setExpandedId]     = useState<string | null>(null)
  const [collapsedGroups, setCollapsed] = useState<Set<string>>(new Set(['pass', 'skip']))
  const [search, setSearch]             = useState('')
  const [providerFilter, setProviderFilter] = useState('')
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const allNodes = useMemo(() => computeNodes(run.findings), [run.findings])
  const edges    = useMemo(() => inferEdges(allNodes), [allNodes])
  const nodeMap  = useMemo(() => new Map(allNodes.map(n => [n.id, n])), [allNodes])

  const allProviders = useMemo(() => [...new Set(allNodes.map(n => n.provider))].sort(), [allNodes])

  const filteredNodes = useMemo(() => {
    let n = allNodes
    if (providerFilter) n = n.filter(x => x.provider === providerFilter)
    if (search) { const q = search.toLowerCase(); n = n.filter(x => x.id.toLowerCase().includes(q)) }
    return n
  }, [allNodes, providerFilter, search])

  const grouped = useMemo(() => {
    const groups: Record<string, DepNode[]> = { fail: [], mixed: [], pass: [], skip: [] }
    for (const n of filteredNodes) groups[n.status]?.push(n)
    // Within each group, sort by worst severity then name
    for (const status of STATUS_ORDER) {
      groups[status].sort((a, b) => (SEV_RANK[b.worstSev] ?? 0) - (SEV_RANK[a.worstSev] ?? 0) || a.name.localeCompare(b.name))
    }
    return groups
  }, [filteredNodes])

  const counts = useMemo(() => {
    const c: Record<string, number> = { fail: 0, mixed: 0, pass: 0, skip: 0 }
    for (const n of allNodes) c[n.status] = (c[n.status] ?? 0) + 1
    return c
  }, [allNodes])

  function toggleGroup(status: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(status) ? next.delete(status) : next.add(status)
      return next
    })
  }

  function navigateTo(id: string) {
    // Find which group this node is in and uncollapse it
    const node = nodeMap.get(id)
    if (node) {
      setCollapsed(prev => { const next = new Set(prev); next.delete(node.status); return next })
    }
    setExpandedId(id)
    setTimeout(() => {
      cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 80)
  }

  if (run.findings.filter(f => f.resource).length === 0) {
    return (
      <div className="card" style={{ padding: '4rem', textAlign: 'center', color: 'var(--muted)' }}>
        {t('pages.dependencyGraph.noResources')}
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
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginLeft: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>{t('pages.dependencyGraph.resourcesLabel')}</span>
        </div>
        <div style={{ width: '1px', height: '32px', background: 'var(--border)', flexShrink: 0 }} />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {STATUS_ORDER.filter(s => counts[s] > 0).map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.65rem', borderRadius: '999px', background: `${STATUS_COLOR[s]}18`, border: `1px solid ${STATUS_COLOR[s]}40` }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: STATUS_COLOR[s], display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: STATUS_COLOR[s] }}>{counts[s]}</span>
              <span style={{ fontSize: '0.68rem', color: STATUS_COLOR[s], opacity: 0.85 }}>{STATUS_LABEL[s]}</span>
            </div>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--muted)', lineHeight: 1.45 }}>
          {t('pages.dependencyGraph.clickNode')}
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="text" placeholder={t('pages.dependencyGraph.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, width: '240px' }} />
        {allProviders.length > 1 && (
          <select value={providerFilter} onChange={e => setProviderFilter(e.target.value)} style={inputStyle}>
            <option value="">{t('pages.dependencyGraph.allProviders')}</option>
            {allProviders.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
          </select>
        )}
        {(search || providerFilter) && (
          <button onClick={() => { setSearch(''); setProviderFilter('') }}
            style={{ fontSize: '0.78rem', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem 0.5rem' }}>
            {t('pages.dependencyGraph.clear')}
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--muted)' }}>
          {t('pages.dependencyGraph.resourcesOf', { count: String(filteredNodes.length), total: String(allNodes.length) })}
        </span>
      </div>

      {/* ── Status groups ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {STATUS_ORDER.filter(status => grouped[status].length > 0).map(status => {
          const isCollapsed = collapsedGroups.has(status)
          const col = STATUS_COLOR[status]
          const groupNodes = grouped[status]

          return (
            <div key={status}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(status)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.875rem', borderRadius: '10px', border: `1px solid ${col}35`, background: `${col}0a`, cursor: 'pointer', marginBottom: isCollapsed ? 0 : '0.5rem', transition: 'background 0.15s' }}
              >
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: col, flexShrink: 0 }} />
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: col, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  {STATUS_LABEL[status]}
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: col, marginLeft: '0.1rem', opacity: 0.8 }}>
                  ({groupNodes.length})
                </span>
                {status === 'fail' && groupNodes.length > 0 && (
                  <span style={{ fontSize: '0.68rem', color: col, opacity: 0.7, fontStyle: 'italic' }}>
                    {t('pages.dependencyGraph.groupFailingSummary', { count: String(groupNodes.reduce((sum, n) => sum + n.failCount, 0)) })}
                  </span>
                )}
                <span style={{ marginLeft: 'auto', color: col, fontSize: '1rem', transition: 'transform 0.22s ease', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                  ▾
                </span>
              </button>

              {/* Group cards */}
              <div style={{
                maxHeight: isCollapsed ? '0' : `${groupNodes.length * 120 + 200}px`,
                overflow: 'hidden',
                transition: 'max-height 0.4s ease',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {groupNodes.map(n => (
                    <div key={n.id} ref={el => { cardRefs.current[n.id] = el }}>
                      <ResourceCard
                        node={n}
                        edges={edges}
                        nodeMap={nodeMap}
                        isOpen={expandedId === n.id}
                        onToggle={() => setExpandedId(prev => prev === n.id ? null : n.id)}
                        onNavigate={navigateTo}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
