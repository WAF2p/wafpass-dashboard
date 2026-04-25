import { useMemo, useState } from 'react'
import { Finding, RunDetail } from '../api'

interface Props { run: RunDetail }

// ─── Cost model ───────────────────────────────────────────────────────────────
// All figures are $/month estimates based on AWS public pricing + industry
// benchmarks. They are ESTIMATES — actual costs require AWS Cost Explorer data.

type CostCategory = 'waste' | 'savings' | 'risk'

interface CostBand {
  min: number        // $ / resource / month (conservative)
  max: number        // $ / resource / month (aggressive)
  basis: string      // one-line explanation
  category: CostCategory
  confidence: 'high' | 'medium' | 'low'
}

// Resource-type level estimates (derived from Terraform resource address)
const RESOURCE_TYPE_COST: Record<string, CostBand> = {
  aws_instance:            { min: 20,  max: 150, basis: 'EC2 on-demand overprovisioning / prev-gen premium (20–40% typical waste)', category: 'waste',   confidence: 'medium' },
  aws_db_instance:         { min: 50,  max: 400, basis: 'RDS on-demand vs 1yr reserved (35–45% savings available)',                  category: 'savings', confidence: 'high'   },
  aws_rds_cluster:         { min: 100, max: 800, basis: 'Aurora cluster reserved capacity (40–55% savings vs on-demand)',            category: 'savings', confidence: 'high'   },
  aws_elasticache_cluster: { min: 30,  max: 200, basis: 'ElastiCache reserved node savings (30–45%)',                               category: 'savings', confidence: 'high'   },
  aws_elasticache_replication_group: { min: 40, max: 250, basis: 'ElastiCache replication group reserved savings', category: 'savings', confidence: 'high' },
  aws_eks_node_group:      { min: 80,  max: 600, basis: 'EKS node group reserved capacity savings (35–60%)',                        category: 'savings', confidence: 'medium' },
  aws_s3_bucket:           { min: 10,  max: 200, basis: 'S3 data accumulation without lifecycle policy ($0.023/GB/mo Standard)',     category: 'waste',   confidence: 'medium' },
  aws_ebs_volume:          { min: 5,   max: 50,  basis: 'Unattached or oversized EBS volume ($0.08–$0.125/GB/mo)',                   category: 'waste',   confidence: 'medium' },
  aws_cloudwatch_log_group:{ min: 15,  max: 120, basis: 'CloudWatch logs at $0.50/GB ingested + $0.03/GB stored, no retention cap',  category: 'waste',   confidence: 'medium' },
  aws_cloudwatch_log_stream:{ min: 5,  max: 40,  basis: 'Log stream contributing to unbounded CloudWatch retention costs',           category: 'waste',   confidence: 'low'    },
  aws_vpc:                 { min: 30,  max: 300, basis: 'NAT Gateway charges for S3/DynamoDB traffic without VPC endpoints ($0.045/GB)', category: 'waste', confidence: 'low' },
  aws_nat_gateway:         { min: 35,  max: 120, basis: 'NAT Gateway hourly ($0.045/hr) + per-GB processing that could be avoided',  category: 'waste',   confidence: 'medium' },
  aws_eip:                 { min: 4,   max: 4,   basis: 'Idle Elastic IP ($3.65/IP/mo when unassociated)',                           category: 'waste',   confidence: 'high'   },
  aws_lambda_function:     { min: 2,   max: 30,  basis: 'Over-provisioned Lambda memory or inefficient timeout setting',             category: 'waste',   confidence: 'low'    },
  aws_sagemaker_endpoint:  { min: 150, max: 1200,basis: 'SageMaker endpoint on-demand vs savings plan (up to 64% savings)',          category: 'savings', confidence: 'medium' },
  aws_redshift_cluster:    { min: 80,  max: 600, basis: 'Redshift on-demand vs reserved node (40–75% savings)',                      category: 'savings', confidence: 'high'   },
  aws_opensearch_domain:   { min: 60,  max: 400, basis: 'OpenSearch on-demand vs reserved instance (36–37% savings)',                category: 'savings', confidence: 'high'   },
  aws_kinesis_stream:      { min: 20,  max: 150, basis: 'Kinesis shard-hours without right-sizing or enhanced fan-out review',       category: 'waste',   confidence: 'low'    },
  // Azure equivalents
  azurerm_virtual_machine: { min: 20,  max: 150, basis: 'Azure VM on-demand vs reserved (35–55% savings)',                          category: 'savings', confidence: 'medium' },
  azurerm_mssql_database:  { min: 50,  max: 400, basis: 'Azure SQL on-demand vs reserved capacity',                                 category: 'savings', confidence: 'medium' },
  azurerm_storage_account: { min: 10,  max: 150, basis: 'Azure Blob storage without lifecycle management policy',                   category: 'waste',   confidence: 'medium' },
  // GCP equivalents
  google_compute_instance:  { min: 20, max: 150, basis: 'GCP Compute Engine on-demand vs committed use discount (37–55%)',           category: 'savings', confidence: 'medium' },
}

// Check-ID level overrides (more specific than resource type)
const CHECK_COST: Record<string, Partial<CostBand>> = {
  'waf-cost-040.tf.aws.s3-lifecycle-rule-defined':          { min: 15, max: 200, basis: 'S3 objects accumulating indefinitely — old versions, incomplete multipart uploads, non-current versions uncharged until lifecycle rules control them', category: 'waste', confidence: 'medium' },
  'waf-cost-040.tf.aws.cloudwatch-log-retention-not-zero':  { min: 20, max: 120, basis: 'CloudWatch log retention unset → infinite storage at $0.03/GB/mo; typical production app logs 5–50GB/mo', category: 'waste', confidence: 'medium' },
  'waf-cost-070.tf.aws.cloudwatch-retention-not-infinite':  { min: 15, max: 80,  basis: 'CloudWatch log group without retention tier — all logs stored at same cost regardless of age', category: 'waste', confidence: 'medium' },
  'waf-cost-090.tf.aws.vpc-endpoint-s3-exists':             { min: 25, max: 250, basis: 'S3 traffic via NAT Gateway at $0.045/GB vs free via VPC endpoint; typical workload 500GB/mo = $22.50 avoidable', category: 'waste', confidence: 'medium' },
  'waf-cost-090.tf.aws.no-public-ip-internal-compute':      { min: 4,  max: 15,  basis: 'Public IPv4 address on internal compute: $0.005/hr = $3.65/IP/mo × quantity', category: 'waste', confidence: 'high' },
  'waf-cost-080.tf.aws.ec2-capacity-commitment-tag':        { min: 35, max: 180, basis: 'EC2 on-demand vs 1yr standard RI: 35–40% discount ($35–$180/mo depending on instance family)', category: 'savings', confidence: 'medium' },
  'waf-cost-080.tf.azurerm.vm-commitment-tag':              { min: 30, max: 150, basis: 'Azure VM on-demand vs 1yr reserved: up to 43% savings', category: 'savings', confidence: 'medium' },
}

// Control-level fallbacks (least specific)
const CONTROL_COST: Record<string, CostBand> = {
  'WAF-COST-010': { min: 5,   max: 20,  basis: 'Untagged resources cannot be attributed to cost centres — orphaned resource risk and billing allocation gap', category: 'risk',    confidence: 'low'    },
  'WAF-COST-020': { min: 0,   max: 0,   basis: 'No budget alerts configured — overspend can go undetected (impact depends on total account spend)', category: 'risk', confidence: 'low' },
  'WAF-COST-030': { min: 15,  max: 120, basis: 'Rightsizing opportunity — EC2/VM without reviewed sizing tag (20–40% compute waste typical)', category: 'waste',   confidence: 'low'    },
  'WAF-COST-040': { min: 10,  max: 80,  basis: 'Storage/retention lifecycle missing — data accumulates at full tier pricing', category: 'waste',   confidence: 'low'    },
  'WAF-COST-050': { min: 30,  max: 200, basis: 'High lock-in resource without cost assessment in ADR — portability and future migration cost risk', category: 'risk',    confidence: 'low'    },
  'WAF-COST-060': { min: 20,  max: 150, basis: 'No FinOps review cadence — industry average 28% cloud waste without regular review cycles', category: 'risk',    confidence: 'low'    },
  'WAF-COST-070': { min: 15,  max: 80,  basis: 'Observability logging without cost tiers — debug/trace logs at operational log pricing', category: 'waste',   confidence: 'low'    },
  'WAF-COST-080': { min: 30,  max: 200, basis: 'Steady-state workload without reserved capacity — 35–72% savings foregone vs on-demand', category: 'savings', confidence: 'low'    },
  'WAF-COST-090': { min: 20,  max: 150, basis: 'Egress/transfer fees without traffic optimisation (VPC endpoints, PrivateLink, public IPs)', category: 'waste',   confidence: 'low'    },
}

const CATEGORY_META: Record<CostCategory, { label: string; color: string; bg: string; icon: string; desc: string }> = {
  waste:   { label: 'Direct waste',            color: '#dc2626', bg: 'rgba(220,38,38,.08)',   icon: '🔥', desc: 'Resources incurring unnecessary spend right now' },
  savings: { label: 'Savings opportunity',     color: '#d97706', bg: 'rgba(217,119,6,.08)',   icon: '💰', desc: 'On-demand charges that reserved/committed pricing would reduce' },
  risk:    { label: 'Financial governance risk',color: '#7c3aed', bg: 'rgba(124,58,237,.08)', icon: '⚠️', desc: 'Controls that, when failing, create untracked or future cost risk' },
}

const CONF_META: Record<string, { label: string; color: string }> = {
  high:   { label: 'High confidence',   color: '#059669' },
  medium: { label: 'Medium confidence', color: '#d97706' },
  low:    { label: 'Estimate only',     color: '#94a3b8' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractResourceType(address: string): string {
  const parts = address.replace(/\[.*?\]/g, '').split('.')
  let i = 0
  while (i + 1 < parts.length && parts[i] === 'module') i += 2
  return parts[i] ?? ''
}

function getCostBand(finding: Finding): CostBand {
  // 1. Check ID override
  const checkOverride = CHECK_COST[finding.check_id]
  if (checkOverride?.min !== undefined) {
    const base = CONTROL_COST[finding.control_id] ?? { min: 10, max: 50, basis: '', category: 'waste' as CostCategory, confidence: 'low' as const }
    return { ...base, ...checkOverride } as CostBand
  }
  // 2. Resource type
  if (finding.resource) {
    const rtype = extractResourceType(finding.resource)
    const rtCost = RESOURCE_TYPE_COST[rtype]
    if (rtCost) return rtCost
  }
  // 3. Control fallback
  return CONTROL_COST[finding.control_id] ?? { min: 5, max: 30, basis: 'Generic cost control violation', category: 'risk', confidence: 'low' }
}

function fmtDollar(n: number): string {
  if (n === 0) return '$0'
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${Math.round(n)}`
}

function fmtRange(min: number, max: number): string {
  if (min === 0 && max === 0) return 'N/A'
  if (min === max) return fmtDollar(min)
  return `${fmtDollar(min)}–${fmtDollar(max)}`
}

// ─── Aggregated control item ──────────────────────────────────────────────────

interface ControlCostItem {
  controlId: string
  controlTitle: string
  findings: Finding[]             // all FAIL findings for this control
  resourceBands: { finding: Finding; band: CostBand }[]
  totalMin: number
  totalMax: number
  totalMid: number
  dominantCategory: CostCategory
  dominantConf: 'high' | 'medium' | 'low'
}

function buildControlItems(findings: Finding[]): ControlCostItem[] {
  const byControl = new Map<string, Finding[]>()
  for (const f of findings) {
    if (f.pillar?.toLowerCase() !== 'cost' || f.status?.toUpperCase() !== 'FAIL') continue
    if (!byControl.has(f.control_id)) byControl.set(f.control_id, [])
    byControl.get(f.control_id)!.push(f)
  }

  return [...byControl.entries()].map(([controlId, cFindings]) => {
    // De-duplicate by resource (one estimate per unique resource address)
    const seen = new Set<string>()
    const resourceBands: { finding: Finding; band: CostBand }[] = []
    for (const f of cFindings) {
      const key = f.resource || f.check_id
      if (seen.has(key)) continue
      seen.add(key)
      resourceBands.push({ finding: f, band: getCostBand(f) })
    }

    const totalMin = resourceBands.reduce((s, r) => s + r.band.min, 0)
    const totalMax = resourceBands.reduce((s, r) => s + r.band.max, 0)
    const totalMid = resourceBands.reduce((s, r) => s + Math.round((r.band.min + r.band.max) / 2), 0)

    // Dominant category (by count)
    const cats = resourceBands.map(r => r.band.category)
    const catCount: Record<CostCategory, number> = { waste: 0, savings: 0, risk: 0 }
    cats.forEach(c => catCount[c]++)
    const dominantCategory = (Object.entries(catCount).sort((a, b) => b[1] - a[1])[0][0]) as CostCategory

    const confOrder = { high: 0, medium: 1, low: 2 }
    const dominantConf = resourceBands
      .map(r => r.band.confidence)
      .sort((a, b) => confOrder[a] - confOrder[b])[0] ?? 'low'

    const controlTitle = cFindings[0]?.check_title?.replace(/^.*?:/, '').trim() || controlId

    return { controlId, controlTitle, findings: cFindings, resourceBands, totalMin, totalMax, totalMid, dominantCategory, dominantConf }
  }).sort((a, b) => b.totalMid - a.totalMid)
}

// ─── Horizontal bar chart ─────────────────────────────────────────────────────

function CostBar({ min, max, maxVal }: { min: number; max: number; maxVal: number }) {
  if (maxVal === 0) return null
  // Cap percentages to 100 so the bar never overflows its container
  const cap = (v: number) => Math.min(100, Math.max(0, (v / maxVal) * 100))
  const startPct = cap(min)
  const endPct   = cap(max)
  const widthPct = Math.max(endPct - startPct, 0.5)
  const midPct   = cap((min + max) / 2)
  return (
    <div style={{ position: 'relative', height: 8, background: 'var(--track)', borderRadius: 4, overflow: 'hidden' }}>
      {/* Range band */}
      <div style={{
        position: 'absolute', top: 0, height: '100%', borderRadius: 4,
        left: `${startPct}%`, width: `${widthPct}%`,
        background: 'rgba(220,38,38,.28)',
      }} />
      {/* Midpoint marker */}
      <div style={{
        position: 'absolute', top: 0, width: 2, height: '100%',
        left: `${midPct}%`, background: '#dc2626',
      }} />
    </div>
  )
}

// ─── Control card ─────────────────────────────────────────────────────────────

function ControlCostCard({ item, maxMax }: { item: ControlCostItem; maxMax: number }) {
  const [open, setOpen] = useState(false)
  const cat  = CATEGORY_META[item.dominantCategory]
  const conf = CONF_META[item.dominantConf]
  const hasEstimate = item.totalMid > 0

  return (
    <div style={{
      border: `1px solid ${cat.color}33`, borderRadius: 10, marginBottom: 10,
      background: cat.bg, overflow: 'hidden',
    }}>
      {/* ── Card header (always visible) ─────────────────────────────── */}
      <div style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }}
        onClick={() => setOpen(o => !o)}>

        {/* Category icon */}
        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 3 }}>{cat.icon}</span>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: 'var(--muted)' }}>{item.controlId}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{item.controlTitle}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: hasEstimate ? 8 : 0 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: cat.color, background: `${cat.color}18`, border: `1px solid ${cat.color}33`, borderRadius: 4, padding: '2px 7px' }}>
              {cat.label}
            </span>
            <span style={{ fontSize: 10, color: conf.color, background: 'var(--bg)', borderRadius: 4, padding: '2px 7px', fontWeight: 600 }}>
              {conf.label}
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              {item.resourceBands.length} resource{item.resourceBands.length !== 1 ? 's' : ''}
            </span>
          </div>
          {hasEstimate && (
            <CostBar min={item.totalMin} max={item.totalMax} maxVal={maxMax} />
          )}
        </div>

        {/* Cost + toggle */}
        <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 100 }}>
          {hasEstimate ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 800, color: cat.color, lineHeight: 1 }}>
                ~{fmtDollar(item.totalMid)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>/month</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                range: {fmtRange(item.totalMin, item.totalMax)}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.4 }}>
              governance<br />risk only
            </div>
          )}
          <div style={{ color: 'var(--muted)', fontSize: 10, marginTop: 6, userSelect: 'none' }}>{open ? '▲' : '▼'}</div>
        </div>
      </div>

      {/* ── Expanded detail ───────────────────────────────────────────── */}
      {open && (
        <div style={{ borderTop: `1px solid ${cat.color}22` }}>

          {/* Resource table */}
          <div style={{ overflowX: 'auto', padding: '0 16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 10 }}>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: '22%' }}>Resource</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: '16%' }}>Type</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: '14%' }}>Category</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: '12%' }}>Est. $/mo</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '36%' }}>Basis</th>
                </tr>
              </thead>
              <tbody>
                {item.resourceBands.map(({ finding, band }, i) => {
                  const mid   = Math.round((band.min + band.max) / 2)
                  const rtype = finding.resource ? extractResourceType(finding.resource) : '—'
                  const cm    = CATEGORY_META[band.category]
                  return (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0 }} title={finding.resource || ''}>
                        {finding.resource || '—'}
                      </td>
                      <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: 10, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                        {rtype}
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <span style={{ fontSize: 10, color: cm.color, background: `${cm.color}15`, border: `1px solid ${cm.color}25`, borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {cm.icon} {cm.label}
                        </span>
                      </td>
                      <td style={{ padding: '6px 10px', fontWeight: 700, color: cm.color, whiteSpace: 'nowrap', fontSize: 11 }}>
                        {band.min === 0 && band.max === 0 ? '—' : `~${fmtDollar(mid)}`}
                        {band.min !== band.max && band.max > 0 && (
                          <div style={{ fontSize: 9, fontWeight: 400, color: 'var(--muted)' }}>{fmtRange(band.min, band.max)}</div>
                        )}
                      </td>
                      <td style={{ padding: '6px 10px', fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>
                        {band.basis}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Finding + Fix messages */}
          <div style={{ padding: '10px 16px 14px' }}>
            {item.findings[0]?.message && (
              <div style={{ padding: '8px 10px', background: 'rgba(0,0,0,.03)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 6 }}>
                <strong style={{ color: 'var(--text)' }}>Finding: </strong>{item.findings[0].message}
              </div>
            )}
            {item.findings[0]?.remediation && (
              <div style={{ padding: '8px 10px', background: 'rgba(5,150,105,.06)', border: '1px solid rgba(5,150,105,.18)', borderRadius: 6, fontSize: 11, color: 'var(--text)', lineHeight: 1.5 }}>
                <strong style={{ color: '#059669' }}>Fix: </strong>{item.findings[0].remediation}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CostImpactPage({ run }: Props) {
  const [catFilter, setCatFilter] = useState<CostCategory | 'all'>('all')

  const controlItems = useMemo(() => buildControlItems(run.findings), [run.findings])

  const filtered = useMemo(() =>
    catFilter === 'all' ? controlItems : controlItems.filter(i => i.dominantCategory === catFilter),
    [controlItems, catFilter]
  )

  // Use totalMax (not totalMid) as the bar scale so bars never overflow their container
  const maxMax = useMemo(() => Math.max(...controlItems.map(i => i.totalMax), 1), [controlItems])

  // Totals
  const totals = useMemo(() => {
    const allMin = controlItems.reduce((s, i) => s + i.totalMin, 0)
    const allMax = controlItems.reduce((s, i) => s + i.totalMax, 0)
    const allMid = controlItems.reduce((s, i) => s + i.totalMid, 0)
    const byCategory: Record<CostCategory, number> = { waste: 0, savings: 0, risk: 0 }
    for (const item of controlItems) byCategory[item.dominantCategory] += item.totalMid
    const failingControls  = controlItems.length
    const failingResources = controlItems.reduce((s, i) => s + i.resourceBands.length, 0)
    return { allMin, allMax, allMid, byCategory, failingControls, failingResources }
  }, [controlItems])

  const hasCostFindings = controlItems.length > 0

  return (
    <div style={{ padding: '0 0 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Summary banner ────────────────────────────────────────────── */}
      <div style={{
        borderRadius: 12, padding: '20px 24px', marginBottom: 24,
        background: hasCostFindings
          ? 'linear-gradient(135deg, rgba(220,38,38,.07) 0%, rgba(217,119,6,.05) 100%)'
          : 'linear-gradient(135deg, rgba(5,150,105,.07) 0%, rgba(16,185,129,.05) 100%)',
        border: `1px solid ${hasCostFindings ? 'rgba(220,38,38,.2)' : 'rgba(5,150,105,.2)'}`,
        display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 40, lineHeight: 1 }}>💸</div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            {hasCostFindings
              ? `${totals.failingControls} failing cost controls — estimated ~${fmtDollar(totals.allMid)}/month`
              : 'No failing cost controls detected'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5 }}>
            {hasCostFindings
              ? `Range: ${fmtRange(totals.allMin, totals.allMax)}/month across ${totals.failingResources} resources. ` +
                `These are estimates based on AWS public pricing and industry benchmarks — actual figures require AWS Cost Explorer.`
              : 'All WAF-COST controls are passing for this run.'}
          </div>
        </div>

        {hasCostFindings && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {(Object.keys(CATEGORY_META) as CostCategory[]).map(cat => {
              const mid = totals.byCategory[cat]
              if (mid === 0) return null
              const cm = CATEGORY_META[cat]
              return (
                <div key={cat} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: cm.color }}>~{fmtDollar(mid)}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>{cm.icon} {cm.label.split(' ')[0].toLowerCase()}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {!hasCostFindings ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', border: '1px dashed var(--border)', borderRadius: 10, color: '#059669', fontSize: 14 }}>
          ✅ No failing cost findings — all WAF-COST controls passing
        </div>
      ) : (
        <>
          {/* ── Category filter ────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => setCatFilter('all')} style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${catFilter === 'all' ? 'var(--waf-brand)' : 'var(--border)'}`,
              background: catFilter === 'all' ? 'rgba(0,148,255,.08)' : 'none',
              color: catFilter === 'all' ? 'var(--waf-brand)' : 'var(--muted)',
            }}>All ({controlItems.length})</button>
            {(Object.keys(CATEGORY_META) as CostCategory[]).map(cat => {
              const count = controlItems.filter(i => i.dominantCategory === cat).length
              if (count === 0) return null
              const cm = CATEGORY_META[cat]
              return (
                <button key={cat} onClick={() => setCatFilter(cat)} style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${catFilter === cat ? cm.color : 'var(--border)'}`,
                  background: catFilter === cat ? `${cm.color}12` : 'none',
                  color: catFilter === cat ? cm.color : 'var(--muted)',
                }}>
                  {cm.icon} {cm.label} ({count})
                </button>
              )
            })}

            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>
              Sorted by estimated monthly impact (highest first)
            </span>
          </div>

          {/* ── Control cards ──────────────────────────────────────────── */}
          {filtered.map(item => (
            <ControlCostCard key={item.controlId} item={item} maxMax={maxMax} />
          ))}

          {/* ── Methodology note ───────────────────────────────────────── */}
          <div style={{
            marginTop: 20, padding: '14px 16px', borderRadius: 8,
            background: 'var(--bg)', border: '1px solid var(--border)',
            fontSize: 11, color: 'var(--muted)', lineHeight: 1.7,
          }}>
            <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>📌 Methodology</strong>
            Estimates are derived from <strong>AWS public pricing</strong> and industry benchmarks (AWS Well-Architected, Cloud FinOps Foundation).
            {' '}<strong>Waste</strong> = spend occurring now that could be eliminated.
            {' '}<strong>Savings opportunity</strong> = on-demand spend that reserved/committed pricing would reduce by 35–72%.
            {' '}<strong>Financial governance risk</strong> = controls whose failure creates future or untracked cost exposure.
            Estimates do not account for data volume, instance type, or negotiated EDP discounts.
            For precise figures, use <strong>AWS Cost Explorer</strong>, <strong>AWS Compute Optimizer</strong>, or your cloud provider's cost management tooling.
          </div>
        </>
      )}
    </div>
  )
}
