import { useMemo, useState } from 'react'
import { Finding, RunDetail } from '../api'
import { useI18n } from '../i18n'
import { useTheme } from '../theme'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

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
  aws_sagemaker_endpoint:  { min: 150, max: 1200, basis: 'SageMaker endpoint on-demand vs savings plan (up to 64% savings)',          category: 'savings', confidence: 'medium' },
  aws_redshift_cluster:    { min: 80,  max: 600, basis: 'Redshift on-demand vs reserved node (40–75% savings)',                      category: 'savings', confidence: 'high'   },
  aws_opensearch_domain:   { min: 60,  max: 400, basis: 'OpenSearch on-demand vs reserved instance (36–37% savings)',                category: 'savings', confidence: 'high'   },
  aws_kinesis_stream:      { min: 20,  max: 150, basis: 'Kinesis shard-hours without right-sizing or enhanced fan-out review',       category: 'waste',   confidence: 'low'    },
  // Azure equivalents
  azurerm_virtual_machine: { min: 20,  max: 150, basis: 'Azure VM on-demand vs reserved (35–55% savings)',                          category: 'savings', confidence: 'medium' },
  azurerm_mssql_database:  { min: 50,  max: 400, basis: 'Azure SQL on-demand vs reserved capacity',                                 category: 'savings', confidence: 'medium' },
  azurerm_storage_account: { min: 10,  max: 150, basis: 'Azure Blob storage without lifecycle management policy',                   category: 'waste',   confidence: 'medium' },
  // GCP equivalents
  google_compute_instance: { min: 20, max: 150, basis: 'GCP Compute Engine on-demand vs committed use discount (37–55%)',           category: 'savings', confidence: 'medium' },
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

const CATEGORY_META: Record<CostCategory, { label: string; color: string; bg: string; icon: string; desc: string; lightColor: string }> = {
  waste:   { label: 'Direct waste',             color: '#ff2a6d', bg: 'rgba(220,38,38,.08)',   icon: '🔥', desc: 'Resources incurring unnecessary spend right now', lightColor: '#dc2626' },
  savings: { label: 'Savings opportunity',      color: '#fbbf24', bg: 'rgba(217,119,6,.08)',   icon: '💰', desc: 'On-demand charges that reserved/committed pricing would reduce', lightColor: '#b45309' },
  risk:    { label: 'Financial governance risk', color: '#a78bfa', bg: 'rgba(124,58,237,.08)',  icon: '⚠️', desc: 'Controls that, when failing, create untracked or future cost risk', lightColor: '#7c3aed' },
}

const CONF_META: Record<string, { label: string; color: string }> = {
  high:   { label: 'High confidence',   color: '#00ff9d' },
  medium: { label: 'Medium confidence', color: '#fbbf24' },
  low:    { label: 'Estimate only',     color: 'var(--muted)' },
}

// ─── SVG icons ─────────────────────────────────────────────────────────────────

function IconWrapper({ children, size = 16 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}
function EuroIcon() { return <IconWrapper><path d="M4 10h12M4 14h9M19 6a7.7 7.7 0 0 0-5.5-2c-3.6 0-6.5 2.5-7.4 6M21 20a7.7 7.7 0 0 0-5.5 2c-3.6 0-6.5-2.5-7.4-6" /></IconWrapper> }
function ChartIcon() { return <IconWrapper><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></IconWrapper> }
function TrendDownIcon() { return <IconWrapper><path d="M22 17l-7.5-7.5-5 5L2 7" /><path d="M16 17h6v-6" /></IconWrapper> }
function FlameIcon() { return <IconWrapper><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.292-2.28.88-3.31" /></IconWrapper> }
function PiggyIcon() { return <IconWrapper><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.8-11 5 0 .7.1 1.4.3 2 0 .2-.2.6-.5.6-.6 0-1.1-.6-1.5-1-.5-.6-1.1-1-1.8-1H3c.8 2.3 2.4 3.8 4.4 4.3C8.6 21 10.5 22 12.8 22h.4c2.6 0 4.8-1.6 5.6-4 .8.2 1.6.3 2.4.3 1.7 0 3-1.3 3-3s-1.3-3-3-3z" /><path d="M16 9.5a1.5 1.5 0 0 1 1.5-1.5h.01" /></IconWrapper> }
function ShieldCostIcon() { return <IconWrapper><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></IconWrapper> }
function SearchIcon() { return <IconWrapper><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></IconWrapper> }
function FilterIcon() { return <IconWrapper><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></IconWrapper> }
function DownloadIcon() { return <IconWrapper><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></IconWrapper> }
function AlertIcon() { return <IconWrapper><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></IconWrapper> }
function GitHubIcon() { return <IconWrapper><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" /></IconWrapper> }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractResourceType(address: string): string {
  const parts = address.replace(/\[.*?\]/g, '').split('.')
  let i = 0
  while (i + 1 < parts.length && parts[i] === 'module') i += 2
  return parts[i] ?? ''
}

function getCostBand(finding: Finding): CostBand {
  const checkOverride = CHECK_COST[finding.check_id]
  if (checkOverride?.min !== undefined) {
    const base = CONTROL_COST[finding.control_id] ?? { min: 10, max: 50, basis: '', category: 'waste' as CostCategory, confidence: 'low' as const }
    return { ...base, ...checkOverride } as CostBand
  }
  if (finding.resource) {
    const rtype = extractResourceType(finding.resource)
    const rtCost = RESOURCE_TYPE_COST[rtype]
    if (rtCost) return rtCost
  }
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

function categoryColor(cat: CostCategory, isDark: boolean) {
  return isDark ? CATEGORY_META[cat].color : CATEGORY_META[cat].lightColor
}

// ─── Aggregated control item ──────────────────────────────────────────────────

interface ControlCostItem {
  controlId: string
  controlTitle: string
  findings: Finding[]
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

// ─── Stub functions for future Cost Explorer integration ───────────────────────

// STUB: replace with live AWS Cost Explorer call once backend supports it
function fetchHistoricalSpendStub(_run: RunDetail): { month: string; actual: number; projected: number }[] {
  return [
    { month: 'T-3', actual: 12400, projected: 12400 },
    { month: 'T-2', actual: 13100, projected: 12800 },
    { month: 'T-1', actual: 14200, projected: 13500 },
    { month: 'now', actual: 14800, projected: 14100 },
    { month: 'T+1', actual: 0,     projected: 12900 },
    { month: 'T+2', actual: 0,     projected: 11600 },
    { month: 'T+3', actual: 0,     projected: 10200 },
  ]
}

// STUB: replace with live budget / alert API once backend supports it
function fetchBudgetAlertsStub(_run: RunDetail): { label: string; severity: 'ok' | 'warn' | 'crit'; value: string }[] {
  return [
    { label: 'Monthly budget utilisation', severity: 'warn', value: '78%' },
    { label: 'Forecast overrun (30d)', severity: 'crit', value: '$1,400' },
    { label: 'Untagged spend', severity: 'ok', value: '12%' },
  ]
}

// ─── Horizontal bar chart ─────────────────────────────────────────────────────

function CostBar({ min, max, maxVal, isDark }: { min: number; max: number; maxVal: number; isDark: boolean }) {
  if (maxVal === 0) return null
  const cap = (v: number) => Math.min(100, Math.max(0, (v / maxVal) * 100))
  const startPct = cap(min)
  const endPct   = cap(max)
  const widthPct = Math.max(endPct - startPct, 0.5)
  const midPct   = cap((min + max) / 2)
  const color = isDark ? '#ff2a6d' : '#dc2626'
  return (
    <div className="coc-bar-bg">
      <div className="coc-bar-range" style={{ left: `${startPct}%`, width: `${widthPct}%`, background: `${color}45` }} />
      <div className="coc-bar-mid" style={{ left: `${midPct}%`, background: color }} />
    </div>
  )
}

// ─── Control card ─────────────────────────────────────────────────────────────

function ControlCostCard({ item, maxMax, isDark }: { item: ControlCostItem; maxMax: number; isDark: boolean }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const cat  = CATEGORY_META[item.dominantCategory]
  const conf = CONF_META[item.dominantConf]
  const hasEstimate = item.totalMid > 0
  const color = categoryColor(item.dominantCategory, isDark)

  return (
    <div className="coc-control-card" style={{ '--cat-color': color, '--cat-bg': isDark ? cat.bg : cat.bg.replace('rgba(220,38,38,.08)', 'rgba(220,38,38,.06)').replace('rgba(217,119,6,.08)', 'rgba(217,119,6,.06)').replace('rgba(124,58,237,.08)', 'rgba(124,58,237,.06)') } as React.CSSProperties}>
      <div className="coc-control-header" onClick={() => setOpen(o => !o)}>
        <span className="coc-control-icon">{cat.icon}</span>
        <div className="coc-control-meta">
          <div className="coc-control-title-row">
            <span className="coc-control-id">{item.controlId}</span>
            <span className="coc-control-title">{item.controlTitle}</span>
          </div>
          <div className="coc-control-tags">
            <span className="coc-tag" style={{ color, background: `${color}18`, borderColor: `${color}33` }}>{cat.label}</span>
            <span className="coc-tag coc-tag--conf" style={{ color: conf.color }}>{conf.label}</span>
            <span className="coc-resource-count">{item.resourceBands.length} resource{item.resourceBands.length !== 1 ? 's' : ''}</span>
            {hasEstimate && <CostBar min={item.totalMin} max={item.totalMax} maxVal={maxMax} isDark={isDark} />}
          </div>
        </div>
        <div className="coc-control-cost">
          {hasEstimate ? (
            <>
              <div className="coc-control-mid" style={{ color }}>~{fmtDollar(item.totalMid)}</div>
              <div className="coc-control-period">/month</div>
              <div className="coc-control-range">range: {fmtRange(item.totalMin, item.totalMax)}</div>
            </>
          ) : (
            <div className="coc-control-nodollar">{t('pages.costImpact.govRiskOnly').split('\n').map((line, i) => <span key={i}>{line}{i === 0 ? <br /> : ''}</span>)}</div>
          )}
          <div className="coc-control-toggle">{open ? '▲' : '▼'}</div>
        </div>
      </div>

      {open && (
        <div className="coc-control-body">
          <div className="coc-resource-table-wrap">
            <table className="coc-resource-table">
              <thead>
                <tr>
                  <th>Resource</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Est. $/mo</th>
                  <th>Basis</th>
                </tr>
              </thead>
              <tbody>
                {item.resourceBands.map(({ finding, band }, i) => {
                  const mid   = Math.round((band.min + band.max) / 2)
                  const rtype = finding.resource ? extractResourceType(finding.resource) : '—'
                  const cm    = CATEGORY_META[band.category]
                  const ccol = categoryColor(band.category, isDark)
                  return (
                    <tr key={i}>
                      <td title={finding.resource || ''}>{finding.resource || '—'}</td>
                      <td>{rtype}</td>
                      <td><span className="coc-tag" style={{ color: ccol, background: `${ccol}15`, borderColor: `${ccol}25` }}>{cm.icon} {cm.label}</span></td>
                      <td style={{ color: ccol }}>{band.min === 0 && band.max === 0 ? '—' : `~${fmtDollar(mid)}`}{band.min !== band.max && band.max > 0 && <div className="coc-resource-range">{fmtRange(band.min, band.max)}</div>}</td>
                      <td>{band.basis}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="coc-control-messages">
            {item.findings[0]?.message && (
              <div className="coc-message coc-message--finding"><strong>{t('pages.costImpact.findingLabel')}</strong> {item.findings[0].message}</div>
            )}
            {item.findings[0]?.remediation && (
              <div className="coc-message coc-message--fix"><strong>{t('pages.costImpact.fixLabel')}</strong> {item.findings[0].remediation}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CostImpactPage({ run }: Props) {
  const { t } = useI18n()
  const { themeName } = useTheme()
  const isDark = themeName === 'dark'
  const [catFilter, setCatFilter] = useState<CostCategory | 'all'>('all')
  const [search, setSearch] = useState('')

  const controlItems = useMemo(() => buildControlItems(run.findings), [run.findings])

  const filtered = useMemo(() => {
    let list = catFilter === 'all' ? controlItems : controlItems.filter(i => i.dominantCategory === catFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(i =>
        i.controlId.toLowerCase().includes(q) ||
        i.controlTitle.toLowerCase().includes(q) ||
        i.resourceBands.some(r => (r.finding.resource || '').toLowerCase().includes(q))
      )
    }
    return list
  }, [controlItems, catFilter, search])

  const maxMax = useMemo(() => Math.max(...controlItems.map(i => i.totalMax), 1), [controlItems])

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
  const history = useMemo(() => fetchHistoricalSpendStub(run), [run])
  const budgetAlerts = useMemo(() => fetchBudgetAlertsStub(run), [run])

  return (
    <div className="coc-root" data-coc-theme={isDark ? 'dark' : 'light'}>
      <style>{costOperationsCenterCss}</style>

      {/* Hero */}
      <div className="coc-hero">
        <div className="coc-hero__grid" />
        <div className="coc-hero__content">
          <div className="coc-hero__badge"><EuroIcon /> COST OPERATIONS CENTER</div>
          <h1 className="coc-hero__title">{t('pages.costImpact.title')}</h1>
          <p className="coc-hero__subtitle">Real-time financial exposure, savings runway, and burn-down projection across {run.findings.filter(f => f.pillar?.toLowerCase() === 'cost').length} cost checks.</p>
        </div>
        <div className="coc-hero__kpi">
          <div className="coc-hero__kpi-label">MONTHLY EXPOSURE</div>
          <div className="coc-hero__kpi-value" style={{ color: hasCostFindings ? (isDark ? '#ff2a6d' : '#dc2626') : (isDark ? '#00ff9d' : '#059669') }}>
            {hasCostFindings ? `~${fmtDollar(totals.allMid)}` : '$0'}
          </div>
          <div className="coc-hero__kpi-range">{hasCostFindings ? `${fmtRange(totals.allMin, totals.allMax)} range` : 'No failing cost controls'}</div>
        </div>
      </div>

      {/* Stubs notice */}
      <div className="coc-stub-banner">
        <div className="coc-stub-banner__icon"><GitHubIcon /></div>
        <div className="coc-stub-banner__text">
          <div className="coc-stub-banner__title">{t('pages.costImpact.stubsInProgress')}</div>
          <div className="coc-stub-banner__desc">{t('pages.costImpact.stubsVoteRfc')}</div>
        </div>
        <div className="coc-stub-banner__badge">RFC</div>
      </div>

      {/* KPI tiles */}
      <div className="coc-kpi-grid">
        <div className="coc-kpi coc-kpi--waste">
          <div className="coc-kpi__icon"><FlameIcon /></div>
          <div className="coc-kpi__meta">
            <div className="coc-kpi__label">DIRECT WASTE</div>
            <div className="coc-kpi__value" style={{ color: categoryColor('waste', isDark) }}>~{fmtDollar(totals.byCategory.waste)}</div>
            <div className="coc-kpi__desc">{t('pages.costImpact.directWaste')}</div>
          </div>
        </div>
        <div className="coc-kpi coc-kpi--savings">
          <div className="coc-kpi__icon"><PiggyIcon /></div>
          <div className="coc-kpi__meta">
            <div className="coc-kpi__label">SAVINGS OPPORTUNITY</div>
            <div className="coc-kpi__value" style={{ color: categoryColor('savings', isDark) }}>~{fmtDollar(totals.byCategory.savings)}</div>
            <div className="coc-kpi__desc">{t('pages.costImpact.savingsOpp')}</div>
          </div>
        </div>
        <div className="coc-kpi coc-kpi--risk">
          <div className="coc-kpi__icon"><ShieldCostIcon /></div>
          <div className="coc-kpi__meta">
            <div className="coc-kpi__label">GOVERNANCE RISK</div>
            <div className="coc-kpi__value" style={{ color: categoryColor('risk', isDark) }}>~{fmtDollar(totals.byCategory.risk)}</div>
            <div className="coc-kpi__desc">{t('pages.costImpact.govRisk')}</div>
          </div>
        </div>
        <div className="coc-kpi coc-kpi--resources">
          <div className="coc-kpi__icon"><ChartIcon /></div>
          <div className="coc-kpi__meta">
            <div className="coc-kpi__label">RESOURCES / CONTROLS</div>
            <div className="coc-kpi__value">{totals.failingResources}<span className="coc-kpi__unit">/{totals.failingControls}</span></div>
            <div className="coc-kpi__desc">Failing resources and controls</div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="coc-charts-row">
        <div className="coc-chart-card">
          <div className="coc-chart-card__header">
            <TrendDownIcon />
            <div>
              <div className="coc-chart-card__title">Burn-down projection</div>
              <div className="coc-chart-card__subtitle">Estimated monthly spend if all recommendations are applied on schedule</div>
            </div>
            <span className="coc-stub-pill">{t('pages.costImpact.stubBadge')}</span>
          </div>
          <div className="coc-chart-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cocActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isDark ? '#ff2a6d' : '#dc2626'} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={isDark ? '#ff2a6d' : '#dc2626'} stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="cocProjected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isDark ? '#00ff9d' : '#059669'} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={isDark ? '#00ff9d' : '#059669'} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--track)" strokeDasharray="3 3" />
                <XAxis dataKey="month" stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => fmtDollar(v as number)} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  itemStyle={{ fontSize: 12 }}
                  formatter={(value: number, name: string) => [fmtDollar(value), name]}
                />
                <Area type="monotone" dataKey="actual" name="Actual spend" stroke={isDark ? '#ff2a6d' : '#dc2626'} strokeWidth={2} fill="url(#cocActual)" />
                <Area type="monotone" dataKey="projected" name="Projected spend" stroke={isDark ? '#00ff9d' : '#059669'} strokeWidth={2} fill="url(#cocProjected)" strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="coc-alerts-card">
          <div className="coc-chart-card__header">
            <AlertIcon />
            <div>
              <div className="coc-chart-card__title">Budget & alerts</div>
              <div className="coc-chart-card__subtitle">Live thresholds once Cost Explorer is connected</div>
            </div>
            <span className="coc-stub-pill">{t('pages.costImpact.stubBadge')}</span>
          </div>
          <div className="coc-alerts-list">
            {budgetAlerts.map((a, i) => (
              <div key={i} className={`coc-alert coc-alert--${a.severity}`}>
                <div className="coc-alert__label">{a.label}</div>
                <div className="coc-alert__value">{a.value}</div>
              </div>
            ))}
          </div>
          <div className="coc-stub-note">
            <GitHubIcon /> Vote on the GitHub RFC to replace <code>fetchHistoricalSpendStub</code> and <code>fetchBudgetAlertsStub</code> with live APIs.
          </div>
        </div>
      </div>

      {!hasCostFindings ? (
        <div className="coc-empty">
          <div className="coc-empty__icon">✅</div>
          <div className="coc-empty__title">{t('pages.costImpact.noFailingCost')}</div>
          <div className="coc-empty__desc">{t('pages.costImpact.allPassing')}</div>
        </div>
      ) : (
        <>
          {/* Filter bar */}
          <div className="coc-filter-bar">
            <div className="coc-search">
              <SearchIcon />
              <input
                type="text"
                placeholder={t('pages.costImpact.searchPlaceholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="coc-filter-chips">
              <button onClick={() => setCatFilter('all')} className={`coc-filter-chip ${catFilter === 'all' ? 'coc-filter-chip--active' : ''}`}>
                {t('pages.costImpact.allFilter', { count: String(controlItems.length) })}
              </button>
              {(Object.keys(CATEGORY_META) as CostCategory[]).map(cat => {
                const count = controlItems.filter(i => i.dominantCategory === cat).length
                if (count === 0) return null
                const cm = CATEGORY_META[cat]
                return (
                  <button key={cat} onClick={() => setCatFilter(cat)} className={`coc-filter-chip ${catFilter === cat ? 'coc-filter-chip--active' : ''}`} style={{ '--chip-color': categoryColor(cat, isDark) } as React.CSSProperties}>
                    {cm.icon} {cm.label} ({count})
                  </button>
                )
              })}
            </div>
            <div className="coc-filter-actions">
              <button className="coc-btn-ghost" onClick={() => { setCatFilter('all'); setSearch('') }}><FilterIcon /> Reset</button>
              <button className="coc-btn-ghost" onClick={() => alert('Export is a demo feature — vote on the GitHub RFC to prioritize it.')}><DownloadIcon /> Export</button>
            </div>
          </div>

          {/* Top resources table */}
          <div className="coc-section-card">
            <div className="coc-section-card__header">
              <div className="coc-section-card__title">Top financial resources</div>
              <div className="coc-section-card__subtitle">Highest-impact failing resources by estimated monthly cost</div>
            </div>
            <div className="coc-resource-table-wrap">
              <table className="coc-resource-table coc-resource-table--top">
                <thead>
                  <tr>
                    <th>Resource</th>
                    <th>Control</th>
                    <th>Category</th>
                    <th>Est. $/mo</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.flatMap(item => item.resourceBands.map(rb => ({ item, rb })))
                    .sort((a, b) => ((a.rb.band.min + a.rb.band.max) / 2) - ((b.rb.band.min + b.rb.band.max) / 2))
                    .reverse()
                    .slice(0, 10)
                    .map(({ item, rb }, i) => {
                      const mid = Math.round((rb.band.min + rb.band.max) / 2)
                      const ccol = categoryColor(rb.band.category, isDark)
                      const cm = CATEGORY_META[rb.band.category]
                      return (
                        <tr key={`${item.controlId}-${i}`}>
                          <td title={rb.finding.resource || ''}>{rb.finding.resource || '—'}</td>
                          <td>{item.controlId}</td>
                          <td><span className="coc-tag" style={{ color: ccol, background: `${ccol}15`, borderColor: `${ccol}25` }}>{cm.icon} {cm.label}</span></td>
                          <td style={{ color: ccol, fontWeight: 700 }}>{rb.band.min === 0 && rb.band.max === 0 ? '—' : `~${fmtDollar(mid)}`}</td>
                          <td><span className="coc-tag coc-tag--conf" style={{ color: CONF_META[rb.band.confidence].color }}>{CONF_META[rb.band.confidence].label}</span></td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Control cards */}
          <div className="coc-section-card">
            <div className="coc-section-card__header">
              <div className="coc-section-card__title">Cost controls</div>
              <div className="coc-section-card__subtitle">{t('pages.costImpact.sortedByImpact')}</div>
            </div>
            {filtered.map(item => (
              <ControlCostCard key={item.controlId} item={item} maxMax={maxMax} isDark={isDark} />
            ))}
            {filtered.length === 0 && (
              <div className="coc-empty coc-empty--inline">
                <div className="coc-empty__desc">No controls match the current filter.</div>
              </div>
            )}
          </div>

          {/* Methodology */}
          <div className="coc-methodology">
            <strong>{t('pages.costImpact.methodology')}</strong>
            {t('pages.costImpact.methodologyText')}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Scoped styles ───────────────────────────────────────────────────────────

const costOperationsCenterCss = `
.coc-root {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-bottom: 2rem;
  animation: cocFadeIn 0.5s ease forwards;
}
@keyframes cocFadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Hero */
.coc-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  background:
    radial-gradient(circle at 15% 50%, rgba(255,42,109,0.10) 0%, transparent 40%),
    radial-gradient(circle at 85% 30%, rgba(251,191,36,0.08) 0%, transparent 35%),
    linear-gradient(135deg, var(--surface) 0%, var(--bg) 100%);
  border: 1px solid rgba(255,42,109,0.25);
  border-radius: 20px;
  padding: 1.5rem 1.75rem;
  box-shadow: 0 0 40px rgba(255,42,109,0.10), inset 0 1px 0 rgba(255,255,255,0.06);
  flex-wrap: wrap;
  position: relative;
  overflow: hidden;
}
[data-coc-theme="light"] .coc-hero {
  background:
    radial-gradient(circle at 15% 50%, rgba(220,38,38,0.06) 0%, transparent 40%),
    radial-gradient(circle at 85% 30%, rgba(217,119,6,0.04) 0%, transparent 35%),
    linear-gradient(135deg, rgba(241,245,249,0.95) 0%, rgba(255,255,255,0.98) 100%);
  border: 1px solid rgba(220,38,38,0.18);
  box-shadow: 0 0 40px rgba(220,38,38,0.06), inset 0 1px 0 rgba(255,255,255,0.6);
}
.coc-hero__grid {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(90deg, rgba(255,42,109,0.03) 1px, transparent 1px),
    linear-gradient(0deg, rgba(255,42,109,0.03) 1px, transparent 1px);
  background-size: 24px 24px;
  pointer-events: none;
}
[data-coc-theme="light"] .coc-hero__grid {
  background:
    linear-gradient(90deg, rgba(220,38,38,0.02) 1px, transparent 1px),
    linear-gradient(0deg, rgba(220,38,38,0.02) 1px, transparent 1px);
  background-size: 24px 24px;
}
.coc-hero__content {
  flex: 1;
  min-width: 0;
  position: relative;
  z-index: 1;
}
.coc-hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255,42,109,0.15);
  border: 1px solid rgba(255,42,109,0.35);
  border-radius: 4px;
  padding: 0.35rem 0.75rem;
  font-size: 0.65rem;
  font-weight: 800;
  color: #ff2a6d;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 0.85rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  box-shadow: 0 0 12px rgba(255,42,109,0.20);
}
[data-coc-theme="light"] .coc-hero__badge {
  background: rgba(220,38,38,0.08);
  border: 1px solid rgba(220,38,38,0.25);
  color: #dc2626;
  box-shadow: 0 0 12px rgba(220,38,38,0.10);
}
.coc-hero__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text);
  line-height: 1.15;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
[data-coc-theme="light"] .coc-hero__title {
  color: var(--text);
}
.coc-hero__subtitle {
  margin: 0.45rem 0 0;
  font-size: 0.82rem;
  color: var(--muted);
  max-width: 520px;
}
[data-coc-theme="light"] .coc-hero__subtitle {
  color: var(--muted);
}
.coc-hero__kpi {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  position: relative;
  z-index: 1;
  text-align: right;
}
.coc-hero__kpi-label {
  font-size: 0.58rem;
  color: var(--muted);
  font-weight: 700;
  letter-spacing: 0.1em;
}
.coc-hero__kpi-value {
  font-size: 2.2rem;
  font-weight: 800;
  line-height: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.coc-hero__kpi-range {
  font-size: 0.72rem;
  color: var(--muted);
}
[data-coc-theme="light"] .coc-hero__kpi-label,
[data-coc-theme="light"] .coc-hero__kpi-range {
  color: var(--muted);
}

/* KPI grid */
.coc-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}
.coc-kpi {
  background: var(--surface);
  border: 1px solid rgba(255,42,109,0.15);
  border-radius: 14px;
  padding: 1.1rem;
  display: flex;
  gap: 0.85rem;
  align-items: flex-start;
  position: relative;
  overflow: hidden;
  transition: transform 0.2s ease, border-color 0.2s ease;
  backdrop-filter: blur(6px);
}
[data-coc-theme="light"] .coc-kpi {
  background: rgba(255,255,255,0.85);
  border: 1px solid rgba(220,38,38,0.15);
  box-shadow: 0 2px 12px rgba(15,23,42,0.06);
}
.coc-kpi:hover {
  transform: translateY(-2px);
  border-color: rgba(255,42,109,0.35);
}
[data-coc-theme="light"] .coc-kpi:hover {
  border-color: rgba(220,38,38,0.3);
}
.coc-kpi::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
}
.coc-kpi--waste::before { background: #ff2a6d; box-shadow: 0 0 12px #ff2a6d; }
.coc-kpi--savings::before { background: #fbbf24; box-shadow: 0 0 12px #fbbf24; }
.coc-kpi--risk::before { background: #a78bfa; box-shadow: 0 0 12px #a78bfa; }
.coc-kpi--resources::before { background: #38bdf8; box-shadow: 0 0 12px #38bdf8; }
[data-coc-theme="light"] .coc-kpi--waste::before { background: #dc2626; box-shadow: 0 0 12px rgba(220,38,38,0.45); }
[data-coc-theme="light"] .coc-kpi--savings::before { background: #b45309; box-shadow: 0 0 12px rgba(180,83,9,0.45); }
[data-coc-theme="light"] .coc-kpi--risk::before { background: #7c3aed; box-shadow: 0 0 12px rgba(124,58,237,0.45); }
[data-coc-theme="light"] .coc-kpi--resources::before { background: #0284c7; box-shadow: 0 0 12px rgba(2,132,199,0.45); }
.coc-kpi__icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--bg);
  border: 1px solid rgba(148,163,184,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text);
  flex-shrink: 0;
}
[data-coc-theme="light"] .coc-kpi__icon {
  background: rgba(241,245,249,0.8);
  border: 1px solid rgba(15,23,42,0.1);
  color: var(--muted);
}
.coc-kpi__meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.coc-kpi__label {
  font-size: 0.58rem;
  color: var(--muted);
  font-weight: 700;
  letter-spacing: 0.1em;
}
.coc-kpi__value {
  font-size: 1.4rem;
  font-weight: 800;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  line-height: 1;
}
.coc-kpi__unit {
  font-size: 0.75rem;
  color: var(--muted);
  margin-left: 0.15rem;
}
.coc-kpi__desc {
  font-size: 0.65rem;
  color: var(--muted);
  line-height: 1.4;
}
[data-coc-theme="light"] .coc-kpi__label,
[data-coc-theme="light"] .coc-kpi__unit,
[data-coc-theme="light"] .coc-kpi__desc {
  color: var(--muted);
}

/* Charts row */
.coc-charts-row {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1rem;
}
.coc-chart-card,
.coc-alerts-card,
.coc-section-card {
  background: var(--surface);
  border: 1px solid rgba(255,42,109,0.12);
  border-radius: 16px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  backdrop-filter: blur(6px);
}
[data-coc-theme="light"] .coc-chart-card,
[data-coc-theme="light"] .coc-alerts-card,
[data-coc-theme="light"] .coc-section-card {
  background: rgba(255,255,255,0.85);
  border: 1px solid rgba(220,38,38,0.15);
  box-shadow: 0 2px 12px rgba(15,23,42,0.06);
}
.coc-chart-card__header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #ff2a6d;
}
[data-coc-theme="light"] .coc-chart-card__header {
  color: #dc2626;
}
.coc-chart-card__title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
[data-coc-theme="light"] .coc-chart-card__title {
  color: var(--text);
}
.coc-chart-card__subtitle {
  font-size: 0.72rem;
  color: var(--muted);
}
.coc-chart-wrap {
  flex: 1;
  min-height: 220px;
}
.coc-alerts-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.coc-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  border: 1px solid transparent;
  font-size: 0.8rem;
}
.coc-alert--ok    { background: rgba(0,255,157,0.10); border-color: rgba(0,255,157,0.25); color: #00ff9d; }
.coc-alert--warn  { background: rgba(251,191,36,0.10); border-color: rgba(251,191,36,0.25); color: #fbbf24; }
.coc-alert--crit  { background: rgba(255,42,109,0.12); border-color: rgba(255,42,109,0.30); color: #ff2a6d; }
[data-coc-theme="light"] .coc-alert--ok    { background: rgba(34,197,94,0.10); border-color: rgba(34,197,94,0.25); color: #059669; }
[data-coc-theme="light"] .coc-alert--warn  { background: rgba(234,179,8,0.10); border-color: rgba(234,179,8,0.25); color: #b45309; }
[data-coc-theme="light"] .coc-alert--crit  { background: rgba(220,38,38,0.10); border-color: rgba(220,38,38,0.25); color: #dc2626; }
.coc-alert__label { font-weight: 600; }
.coc-alert__value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; }
.coc-stub-note {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  background: var(--bg);
  border: 1px dashed rgba(148,163,184,0.25);
  color: var(--muted);
  font-size: 0.7rem;
}
[data-coc-theme="light"] .coc-stub-note {
  background: rgba(241,245,249,0.8);
  border: 1px dashed rgba(15,23,42,0.15);
  color: var(--muted);
}

.coc-stub-banner {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.9rem 1.25rem;
  border-radius: 14px;
  background: rgba(251,191,36,0.08);
  border: 1px solid rgba(251,191,36,0.30);
  box-shadow: 0 0 24px rgba(251,191,36,0.12);
}
[data-coc-theme="light"] .coc-stub-banner {
  background: rgba(234,179,8,0.08);
  border: 1px solid rgba(234,179,8,0.30);
  box-shadow: 0 0 20px rgba(234,179,8,0.10);
}
.coc-stub-banner__icon {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: rgba(251,191,36,0.15);
  border: 1px solid rgba(251,191,36,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fbbf24;
}
[data-coc-theme="light"] .coc-stub-banner__icon {
  background: rgba(234,179,8,0.12);
  border: 1px solid rgba(234,179,8,0.30);
  color: #b45309;
}
.coc-stub-banner__text {
  flex: 1;
  min-width: 0;
}
.coc-stub-banner__title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #fbbf24;
  margin-bottom: 0.15rem;
}
[data-coc-theme="light"] .coc-stub-banner__title {
  color: #b45309;
}
.coc-stub-banner__desc {
  font-size: 0.75rem;
  color: var(--muted);
  line-height: 1.45;
}
[data-coc-theme="light"] .coc-stub-banner__desc {
  color: var(--muted);
}
.coc-stub-banner__badge {
  flex-shrink: 0;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  background: rgba(251,191,36,0.15);
  border: 1px solid rgba(251,191,36,0.35);
  color: #fbbf24;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}
[data-coc-theme="light"] .coc-stub-banner__badge {
  background: rgba(234,179,8,0.12);
  border: 1px solid rgba(234,179,8,0.30);
  color: #b45309;
}
.coc-stub-pill {
  margin-left: auto;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: rgba(251,191,36,0.12);
  border: 1px solid rgba(251,191,36,0.30);
  color: #fbbf24;
  font-size: 0.58rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
[data-coc-theme="light"] .coc-stub-pill {
  background: rgba(234,179,8,0.10);
  border: 1px solid rgba(234,179,8,0.25);
  color: #b45309;
}

/* Filter bar */
.coc-filter-bar {
  background: var(--surface);
  border: 1px solid rgba(255,42,109,0.12);
  border-radius: 14px;
  padding: 0.85rem 1.1rem;
  display: flex;
  gap: 0.85rem;
  align-items: center;
  flex-wrap: wrap;
  backdrop-filter: blur(6px);
}
[data-coc-theme="light"] .coc-filter-bar {
  background: rgba(255,255,255,0.85);
  border: 1px solid rgba(220,38,38,0.15);
  box-shadow: 0 2px 12px rgba(15,23,42,0.06);
}
.coc-search {
  flex: 1 1 220px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.8rem;
  border-radius: 10px;
  border: 1px solid rgba(255,42,109,0.18);
  background: var(--bg);
  color: #ff2a6d;
  min-width: 0;
}
[data-coc-theme="light"] .coc-search {
  background: rgba(241,245,249,0.8);
  border: 1px solid rgba(220,38,38,0.18);
  color: #dc2626;
}
.coc-search input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 0.82rem;
  outline: none;
  min-width: 0;
}
[data-coc-theme="light"] .coc-search input {
  color: var(--text);
}
.coc-search input::placeholder { color: var(--muted); }
[data-coc-theme="light"] .coc-search input::placeholder { color: var(--muted); }
.coc-filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.coc-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.75rem;
  border-radius: 999px;
  border: 1px solid rgba(255,42,109,0.15);
  background: var(--bg);
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
[data-coc-theme="light"] .coc-filter-chip {
  background: rgba(241,245,249,0.8);
  border: 1px solid rgba(220,38,38,0.12);
  color: var(--muted);
}
.coc-filter-chip:hover {
  border-color: rgba(255,42,109,0.3);
  color: var(--text);
}
[data-coc-theme="light"] .coc-filter-chip:hover {
  border-color: rgba(220,38,38,0.25);
  color: var(--text);
}
.coc-filter-chip--active {
  border-color: var(--chip-color, rgba(255,42,109,0.45));
  background: color-mix(in srgb, var(--chip-color, #ff2a6d) 12%, transparent);
  color: var(--chip-color, #ff2a6d);
  box-shadow: 0 0 12px color-mix(in srgb, var(--chip-color, #ff2a6d) 12%, transparent);
}
.coc-filter-actions {
  display: flex;
  gap: 0.4rem;
  margin-left: auto;
}
.coc-btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.75rem;
  border-radius: 8px;
  border: 1px solid rgba(255,42,109,0.18);
  background: var(--bg);
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}
[data-coc-theme="light"] .coc-btn-ghost {
  background: rgba(241,245,249,0.8);
  border: 1px solid rgba(220,38,38,0.15);
  color: var(--muted);
}
.coc-btn-ghost:hover {
  color: var(--text);
  border-color: rgba(255,42,109,0.4);
  background: rgba(255,42,109,0.08);
}
[data-coc-theme="light"] .coc-btn-ghost:hover {
  color: var(--text);
  border-color: rgba(220,38,38,0.3);
  background: rgba(220,38,38,0.08);
}

/* Section cards */
.coc-section-card__header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.coc-section-card__title {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
[data-coc-theme="light"] .coc-section-card__title {
  color: var(--text);
}
.coc-section-card__subtitle {
  font-size: 0.72rem;
  color: var(--muted);
}

/* Control cards */
.coc-control-card {
  background: var(--cat-bg);
  border: 1px solid color-mix(in srgb, var(--cat-color) 22%, transparent);
  border-radius: 12px;
  margin-bottom: 0.65rem;
  overflow: hidden;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
[data-coc-theme="light"] .coc-control-card {
  background: color-mix(in srgb, var(--cat-color) 5%, rgba(255,255,255,0.85));
}
.coc-control-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(0,0,0,0.25), 0 0 18px color-mix(in srgb, var(--cat-color) 10%, transparent);
}
[data-coc-theme="light"] .coc-control-card:hover {
  box-shadow: 0 6px 20px rgba(15,23,42,0.10), 0 0 14px color-mix(in srgb, var(--cat-color) 8%, transparent);
}
.coc-control-header {
  padding: 0.85rem 1rem;
  cursor: pointer;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}
.coc-control-icon {
  font-size: 1.1rem;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 0.1rem;
}
.coc-control-meta {
  flex: 1;
  min-width: 0;
}
.coc-control-title-row {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.35rem;
}
.coc-control-id {
  font-size: 0.7rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 700;
  color: var(--muted);
}
.coc-control-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text);
}
[data-coc-theme="light"] .coc-control-title {
  color: var(--text);
}
.coc-control-tags {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  align-items: center;
}
.coc-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.18rem 0.5rem;
  border-radius: 4px;
  font-size: 0.6rem;
  font-weight: 700;
  border: 1px solid transparent;
}
.coc-tag--conf {
  background: var(--bg);
  border: 1px solid rgba(148,163,184,0.12);
}
[data-coc-theme="light"] .coc-tag--conf {
  background: rgba(241,245,249,0.8);
}
.coc-resource-count {
  font-size: 0.68rem;
  color: var(--muted);
}
[data-coc-theme="light"] .coc-resource-count {
  color: var(--muted);
}
.coc-control-cost {
  flex-shrink: 0;
  text-align: right;
  min-width: 90px;
}
.coc-control-mid {
  font-size: 1.35rem;
  font-weight: 800;
  line-height: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.coc-control-period {
  font-size: 0.6rem;
  color: var(--muted);
}
.coc-control-range {
  font-size: 0.6rem;
  color: var(--muted);
  margin-top: 0.1rem;
}
.coc-control-nodollar {
  font-size: 0.72rem;
  color: var(--muted);
  font-style: italic;
  line-height: 1.4;
}
.coc-control-toggle {
  color: var(--muted);
  font-size: 0.65rem;
  margin-top: 0.35rem;
  user-select: none;
}
.coc-control-body {
  border-top: 1px solid color-mix(in srgb, var(--cat-color) 14%, transparent);
}

/* Resource table */
.coc-resource-table-wrap {
  overflow-x: auto;
  padding: 0 1rem;
}
.coc-resource-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
  margin-top: 0.5rem;
}
.coc-resource-table th {
  padding: 0.5rem 0.6rem;
  text-align: left;
  font-size: 0.58rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
  background: var(--bg);
}
[data-coc-theme="light"] .coc-resource-table th {
  background: rgba(241,245,249,0.8);
}
.coc-resource-table td {
  padding: 0.5rem 0.6rem;
  border-top: 1px solid rgba(148,163,184,0.10);
  color: var(--muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 0;
}
[data-coc-theme="light"] .coc-resource-table td {
  color: var(--muted);
  border-top-color: rgba(15,23,42,0.08);
}
.coc-resource-table td:nth-child(2),
.coc-resource-table td:nth-child(3),
.coc-resource-table td:nth-child(5) {
  font-family: inherit;
}
.coc-resource-table td:nth-child(4) {
  font-weight: 700;
}
.coc-resource-table--top td:first-child {
  max-width: 280px;
}
.coc-resource-range {
  font-size: 0.6rem;
  font-weight: 400;
  color: var(--muted);
}

/* Bar */
.coc-bar-bg {
  position: relative;
  height: 6px;
  background: rgba(148,163,184,0.12);
  border-radius: 999px;
  overflow: hidden;
  width: 140px;
}
[data-coc-theme="light"] .coc-bar-bg {
  background: rgba(15,23,42,0.08);
}
.coc-bar-range {
  position: absolute;
  top: 0;
  height: 100%;
  border-radius: 999px;
}
.coc-bar-mid {
  position: absolute;
  top: 0;
  width: 2px;
  height: 100%;
}

/* Messages */
.coc-control-messages {
  padding: 0.6rem 1rem 1rem;
}
.coc-message {
  padding: 0.55rem 0.7rem;
  border-radius: 6px;
  font-size: 0.72rem;
  line-height: 1.5;
  margin-bottom: 0.4rem;
}
.coc-message--finding {
  background: rgba(0,0,0,.03);
  border: 1px solid rgba(148,163,184,0.15);
  color: var(--muted);
}
[data-coc-theme="light"] .coc-message--finding {
  background: rgba(241,245,249,0.6);
  border: 1px solid rgba(15,23,42,0.08);
}
.coc-message--fix {
  background: rgba(0,255,157,0.08);
  border: 1px solid rgba(0,255,157,0.18);
  color: var(--text);
}
[data-coc-theme="light"] .coc-message--fix {
  background: rgba(34,197,94,0.08);
  border: 1px solid rgba(34,197,94,0.18);
  color: var(--text);
}
.coc-message strong { color: var(--text); margin-right: 0.25rem; }
[data-coc-theme="light"] .coc-message strong { color: var(--text); }

/* Empty state */
.coc-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3.5rem 1.5rem;
  background: var(--surface);
  border: 1px solid rgba(0,255,157,0.15);
  border-radius: 16px;
}
[data-coc-theme="light"] .coc-empty {
  background: rgba(255,255,255,0.85);
  border: 1px solid rgba(34,197,94,0.2);
}
.coc-empty--inline {
  background: transparent;
  border: none;
  padding: 2rem;
}
.coc-empty__icon { font-size: 2rem; }
.coc-empty__title {
  font-size: 1rem;
  font-weight: 700;
  color: #00ff9d;
}
[data-coc-theme="light"] .coc-empty__title { color: #059669; }
.coc-empty__desc {
  font-size: 0.8rem;
  color: var(--muted);
  text-align: center;
}

/* Methodology */
.coc-methodology {
  margin-top: 0.5rem;
  padding: 1rem 1.1rem;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid rgba(148,163,184,0.12);
  font-size: 0.72rem;
  color: var(--muted);
  line-height: 1.7;
}
[data-coc-theme="light"] .coc-methodology {
  background: rgba(255,255,255,0.85);
  border: 1px solid rgba(15,23,42,0.08);
}
.coc-methodology strong {
  display: block;
  margin-bottom: 0.3rem;
  color: var(--text);
}
[data-coc-theme="light"] .coc-methodology strong { color: var(--text); }

@media (max-width: 1000px) {
  .coc-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .coc-charts-row { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .coc-hero { flex-direction: column; align-items: flex-start; }
  .coc-hero__kpi { text-align: left; }
  .coc-kpi-grid { grid-template-columns: 1fr; }
  .coc-filter-bar { flex-direction: column; align-items: stretch; }
  .coc-filter-actions { margin-left: 0; }
  .coc-control-cost { min-width: 70px; }
  .coc-resource-table th,
  .coc-resource-table td { padding: 0.4rem; }
}
`
