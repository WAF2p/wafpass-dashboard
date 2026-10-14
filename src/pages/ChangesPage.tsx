import { useEffect, useMemo, useState } from 'react'
import { fetchRun, Finding, PlanChange, PlanChanges, RunDetail, RunSummary } from '../api'
import { useI18n } from '../i18n'
import {
  SocStyles, SectionCard, KpiTile, SegmentedTabs,
  ListIcon,
} from './shared/SocComponents'

interface Props { run: RunDetail; runs: RunSummary[] }

type Attrs = Record<string, unknown>

// ─── Shared constants ─────────────────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  create:  { label: 'Add',     color: '#16a34a', bg: 'rgba(22,163,74,.08)',   icon: '+' },
  update:  { label: 'Change',  color: '#d97706', bg: 'rgba(217,119,6,.08)',   icon: '~' },
  delete:  { label: 'Destroy', color: '#dc2626', bg: 'rgba(220,38,38,.08)',   icon: '−' },
  replace: { label: 'Replace', color: '#7c3aed', bg: 'rgba(124,58,237,.08)', icon: '⟳' },
  'no-op': { label: 'No-op',   color: '#94a3b8', bg: 'transparent',           icon: '·' },
}

function actionMeta(action: string) {
  return ACTION_META[action] ?? ACTION_META['no-op']
}

const SECURITY_ATTRS = new Set([
  'policy', 'assume_role_policy', 'inline_policy', 'permission_boundary',
  'ingress', 'egress', 'cidr_blocks', 'ipv6_cidr_blocks',
  'public_access_block_configuration', 'block_public_acls', 'block_public_policy',
  'restrict_public_buckets', 'ignore_public_acls',
  'encryption_configuration', 'server_side_encryption_configuration',
  'versioning', 'logging',
  'kms_key_id', 'kms_key_arn', 'kms_master_key_id',
  'deletion_window_in_days', 'enable_key_rotation',
  'acl', 'bucket_policy',
  'security_groups', 'source_security_group_id',
])

// ─── Tailbreak risk catalogue ─────────────────────────────────────────────────

const TAILBREAK_RISKS: Record<string, string[]> = {
  aws_vpc: [
    'All subnets, route tables, security groups, and internet gateways in this VPC will be destroyed.',
    'Any EC2 instances, RDS databases, or ECS services inside the VPC will lose network connectivity.',
  ],
  aws_subnet: ['EC2 instances, RDS databases, or other resources deployed in this subnet will lose network access.'],
  aws_security_group: [
    'Any resource (EC2, RDS, Lambda, etc.) referencing this security group will lose its firewall rules.',
    'Depending on remaining security groups, inbound/outbound traffic may be fully blocked.',
  ],
  aws_iam_role: [
    'Any AWS service that assumes this role (Lambda, EC2 instance profile, ECS task, etc.) will lose its permissions immediately.',
    'Failing permissions will typically surface as AccessDenied errors in your workloads.',
  ],
  aws_iam_policy: ['Any IAM role or user attached to this policy will lose the associated permissions.'],
  aws_s3_bucket: [
    'Any application or service reading from or writing to this bucket will start failing.',
    'All objects in the bucket will be permanently deleted unless the bucket has a deletion policy or versioning enabled.',
  ],
  aws_db_instance: [
    'Applications connecting to this database will lose connectivity immediately.',
    'All data will be permanently deleted unless a final snapshot is explicitly configured.',
  ],
  aws_rds_cluster: [
    'All cluster instances will be terminated. Applications connected to the cluster endpoint will fail.',
    'All data will be deleted unless a final snapshot is configured.',
  ],
  aws_elasticache_cluster: ['The cache will be permanently lost. Applications depending on it may experience latency spikes or errors.'],
  aws_eks_cluster: [
    'All Kubernetes workloads (pods, deployments, services) will be terminated.',
    'Any services exposed through this cluster will become unavailable.',
  ],
  aws_ecs_cluster: ['All ECS services and running tasks in this cluster will be stopped.'],
  aws_lb: ['Any DNS records or applications pointing to this load balancer will stop working.', 'Attached target groups will be orphaned.'],
  aws_alb: ['Any DNS records or applications pointing to this ALB will stop working.'],
  aws_route53_record: ['DNS resolution for this record will fail immediately, breaking any client that relies on this hostname.'],
  aws_route53_zone: ['All DNS records in this hosted zone will stop resolving. This is a high-blast-radius operation.'],
  aws_kms_key: [
    'Deletion is scheduled with a minimum 7-day window. Once deleted, all data encrypted with this key cannot be decrypted.',
    'S3 buckets, EBS volumes, and secrets encrypted with this key will lose access.',
  ],
  aws_secretsmanager_secret: ['Any application or Lambda function reading this secret will start failing immediately.'],
  aws_ssm_parameter: ['Any application, script, or automation that reads this parameter will start failing.'],
  google_compute_network: ['All subnetworks and VM instances in this network will be affected.'],
  google_compute_instance: ['The VM will be terminated and all ephemeral storage will be lost.'],
  azurerm_resource_group: ['ALL resources in this resource group will be deleted. This operation is irreversible.'],
  azurerm_virtual_network: ['All subnets and connected resources will lose network connectivity.'],
}

function getTailbreakRisks(type: string): string[] {
  return TAILBREAK_RISKS[type] ?? ['Deleting this resource may break dependent infrastructure or applications that rely on it.']
}

// ─── Plan Changes helpers ─────────────────────────────────────────────────────

function renderAttrValue(val: unknown, isUnknown?: boolean): React.ReactNode {
  if (isUnknown) return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>(computed at apply)</span>
  if (val === null || val === undefined) return <span style={{ color: '#94a3b8' }}>null</span>
  if (val === true)  return <span style={{ color: '#16a34a', fontWeight: 700 }}>true</span>
  if (val === false) return <span style={{ color: '#dc2626', fontWeight: 700 }}>false</span>
  if (typeof val === 'number') return <span style={{ color: '#0ea5e9' }}>{val}</span>
  if (typeof val === 'string') {
    if (val === '') return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>(empty)</span>
    const display = val.length > 160 ? val.slice(0, 160) + '…' : val
    return <span title={val.length > 160 ? val : undefined}>{display}</span>
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>(empty list)</span>
    if (val.length <= 5 && val.every(v => typeof v !== 'object' || v === null))
      return <span>{(val as unknown[]).map(v => v === null ? 'null' : String(v)).join(', ')}</span>
    const str = JSON.stringify(val, null, 2)
    const display = str.length > 300 ? str.slice(0, 300) + '\n…' : str
    return <span title={str.length > 300 ? str : undefined} style={{ whiteSpace: 'pre-wrap' }}>{display}</span>
  }
  if (typeof val === 'object') {
    const str = JSON.stringify(val, null, 2)
    const display = str.length > 300 ? str.slice(0, 300) + '\n…' : str
    return <span title={str.length > 300 ? str : undefined} style={{ whiteSpace: 'pre-wrap' }}>{display}</span>
  }
  return <span>{String(val)}</span>
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
      {children}
    </div>
  )
}

function DiffTable({ before, after, afterUnknown, beforeLabel = 'Before', afterLabel = 'After', diffOnly = true }: {
  before: Attrs | null | undefined
  after: Attrs | null | undefined
  afterUnknown?: Attrs | null
  beforeLabel?: string
  afterLabel?: string
  diffOnly?: boolean
}) {
  if (before == null && after == null) return (
    <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
      Attribute data not available — re-run wafpass with a plan file using the latest version to see attribute-level details.
    </div>
  )

  const allKeys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  const rows: Array<{ key: string; before: unknown; after: unknown; isUnknown: boolean; isSecurity: boolean }> = []
  for (const key of allKeys) {
    const isUnknown = afterUnknown?.[key] === true
    const b = (before ?? {})[key]
    const a = (after ?? {})[key]
    const differs = isUnknown || JSON.stringify(b) !== JSON.stringify(a)
    if (!diffOnly || differs) rows.push({ key, before: b, after: a, isUnknown, isSecurity: SECURITY_ATTRS.has(key) })
  }
  rows.sort((x, y) => {
    if (x.isSecurity && !y.isSecurity) return -1
    if (!x.isSecurity && y.isSecurity) return 1
    return x.key.localeCompare(y.key)
  })

  if (!rows.length) return <div style={{ fontSize: '0.8rem', color: '#16a34a' }}>No attribute differences detected.</div>

  const securityChanges = rows.filter(c => c.isSecurity && diffOnly)
  const beforeColor = before == null ? '#94a3b8' : '#dc2626'
  const afterColor  = after  == null ? '#94a3b8' : '#16a34a'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      {securityChanges.length > 0 && (
        <div style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', background: 'rgba(217,119,6,.08)', border: '1px solid rgba(217,119,6,.2)', fontSize: '0.77rem', color: '#92400e' }}>
          <strong>⚠ Security-sensitive attributes changing:</strong>{' '}{securityChanges.map(c => c.key).join(', ')}
        </div>
      )}
      <table className="changes-attr-table">
        <thead>
          <tr>
            <th>Attribute</th>
            <th style={{ color: beforeColor }}>{beforeLabel}</th>
            <th style={{ color: afterColor }}>{afterLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, before: b, after: a, isUnknown, isSecurity }) => (
            <tr key={key} style={{ background: isSecurity ? 'rgba(217,119,6,.04)' : undefined }}>
              <td style={{ color: isSecurity ? '#d97706' : 'var(--muted)' }}>
                {isSecurity && <span style={{ marginRight: '0.2rem' }}>⚠</span>}{key}
              </td>
              <td style={{ background: 'rgba(220,38,38,.04)', borderRight: '2px solid rgba(220,38,38,.12)' }}>
                {b !== undefined ? renderAttrValue(b) : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>—</span>}
              </td>
              <td style={{ background: 'rgba(22,163,74,.04)' }}>
                {a !== undefined ? renderAttrValue(a, isUnknown) : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TailbreakAlert({ type }: { type: string }) {
  const { t } = useI18n()
  const risks = getTailbreakRisks(type)
  return (
    <div className="changes-alert changes-alert--danger">
      <div className="changes-alert__title">{t('pages.changes.tailbreakAlert')}</div>
      <ul>
        {risks.map((r, i) => <li key={i}>{r}</li>)}
      </ul>
    </div>
  )
}

function CreateDetail({ after, afterUnknown }: { after: Attrs | null | undefined; afterUnknown?: Attrs | null }) {
  const { t } = useI18n()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="changes-alert changes-alert--success">
        This resource will be <strong>created</strong>. Attributes marked <em>({t('pages.changes.computedAtApply').replace('(', '').replace(')', '')})</em> will be assigned by the provider.
      </div>
      <div>
        <SectionLabel>{t('pages.changes.attrToBeCreated')}</SectionLabel>
        <DiffTable before={null} after={after} afterUnknown={afterUnknown} diffOnly={false} beforeLabel="Before (does not exist)" afterLabel="After (planned values)" />
      </div>
    </div>
  )
}

function UpdateDetail({ before, after, afterUnknown }: { before: Attrs | null | undefined; after: Attrs | null | undefined; afterUnknown?: Attrs | null }) {
  const { t } = useI18n()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="changes-alert changes-alert--warn">
        This resource will be <strong>updated in-place</strong> — no downtime from replacement. Only changed attributes are shown.
      </div>
      <div>
        <SectionLabel>{t('pages.changes.changedAttrs')}</SectionLabel>
        <DiffTable before={before} after={after} afterUnknown={afterUnknown} />
      </div>
    </div>
  )
}

function DeleteDetail({ before, type }: { before: Attrs | null | undefined; type: string }) {
  const { t } = useI18n()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <TailbreakAlert type={type} />
      <div>
        <SectionLabel>{t('pages.changes.currentState')}</SectionLabel>
        <DiffTable before={before} after={null} diffOnly={false} beforeLabel="Before (current values)" afterLabel="After (will be destroyed)" />
      </div>
    </div>
  )
}

function ReplaceDetail({ before, after, afterUnknown, type }: { before: Attrs | null | undefined; after: Attrs | null | undefined; afterUnknown?: Attrs | null; type: string }) {
  const { t } = useI18n()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="changes-alert changes-alert--info">
        <strong>Replace = Destroy + Create.</strong> The existing resource will be <strong>destroyed</strong> and a new one created in its place. This typically causes downtime.
      </div>
      <TailbreakAlert type={type} />
      <div>
        <SectionLabel>{t('pages.changes.changedAttrs')}</SectionLabel>
        <DiffTable before={before} after={after} afterUnknown={afterUnknown} />
      </div>
    </div>
  )
}

function ChangeDetailModal({ change, onClose }: { change: PlanChange; onClose: () => void }) {
  const { t } = useI18n()
  const { color, bg, label, icon } = actionMeta(change.action)
  const before = change.before as Attrs | null | undefined
  const after  = change.after  as Attrs | null | undefined
  const afterUnknown = change.after_unknown as Attrs | null | undefined

  return (
    <div className="changes-modal-portal">
      <div className="changes-modal-backdrop" onClick={onClose} />
      <div className="changes-modal">
        <div className="changes-modal__header">
          <div className="changes-modal__badge" style={{ background: bg, color }}>{icon}</div>
          <div className="changes-modal__title-block">
            <div className="changes-modal__address">{change.address}</div>
            <div className="changes-modal__meta">
              <span className="changes-badge" style={{ background: bg, color }}>{label}</span>
              <span className="changes-badge changes-badge--muted">{change.type}</span>
              {change.provider && <span className="changes-badge changes-badge--brand">{change.provider}</span>}
              {change.module_address && <span className="changes-badge changes-badge--muted">module: {change.module_address}</span>}
            </div>
          </div>
          <button className="changes-modal__close" onClick={onClose}>×</button>
        </div>
        <div className="changes-modal__body">
          {change.action === 'create'  && <CreateDetail  after={after} afterUnknown={afterUnknown} />}
          {change.action === 'update'  && <UpdateDetail  before={before} after={after} afterUnknown={afterUnknown} />}
          {change.action === 'delete'  && <DeleteDetail  before={before} type={change.type} />}
          {change.action === 'replace' && <ReplaceDetail before={before} after={after} afterUnknown={afterUnknown} type={change.type} />}
        </div>
        <div className="changes-modal__footer">
          <button className="scc-btn-ghost" onClick={onClose}>{t('pages.changes.close')}</button>
        </div>
      </div>
    </div>
  )
}

function ChangeRow({ change, onClick }: { change: PlanChange; onClick: () => void }) {
  const { color, bg, icon } = actionMeta(change.action)
  return (
    <tr onClick={onClick} className="changes-row">
      <td style={{ width: '2.25rem', textAlign: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1.5rem', height: '1.5rem', borderRadius: '5px', background: bg, color, fontFamily: 'monospace', fontWeight: 800, fontSize: '0.8rem' }}>{icon}</span>
      </td>
      <td>
        <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text)', fontWeight: 600 }}>{change.address}</div>
        {change.module_address && <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.1rem' }}>module: {change.module_address}</div>}
      </td>
      <td style={{ whiteSpace: 'nowrap' }}><span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--muted)' }}>{change.type}</span></td>
      <td style={{ whiteSpace: 'nowrap' }}>
        {change.provider && <span className="changes-badge changes-badge--brand">{change.provider}</span>}
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <span className="changes-badge" style={{ background: bg, color }}>{actionMeta(change.action).label}</span>
      </td>
    </tr>
  )
}

function NoChanges({ plan }: { plan: PlanChanges }) {
  const { t } = useI18n()
  return (
    <div className="changes-empty">
      <div className="changes-empty__icon">
        <svg style={{ width: '1.75rem', height: '1.75rem', color: '#16a34a' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <div className="changes-empty__title">{t('pages.changes.noPlanChanges')}</div>
        <div className="changes-empty__desc">{t('pages.changes.noPlanChangesDesc')}</div>
      </div>
      {plan.summary.no_op > 0 && <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{t('pages.changes.resourcesUpToDate', { count: String(plan.summary.no_op), s: plan.summary.no_op !== 1 ? 's' : '' })}</div>}
    </div>
  )
}

function NoPlanData({ run }: { run: RunDetail }) {
  const { t } = useI18n()
  const iacPath = run.path || run.source_paths?.[0] || '/path/to/iac'
  const pushUrl = window.location.origin
  const [copied, setCopied] = useState(false)
  const isTerraform = !run.iac_framework || run.iac_framework === 'terraform'
  const cmd = isTerraform
    ? `# Generate a Terraform plan JSON and push it with the scan\nterraform plan -out=tfplan\nterraform show -json tfplan > plan.json\nwafpass check --output json --push ${pushUrl}/runs --plan-file plan.json ${iacPath}`
    : `# Plan-file change overview is currently supported for Terraform runs.\nwafpass check --iac ${run.iac_framework} --output json --push ${pushUrl}/runs ${iacPath}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '680px' }}>
      <div className="changes-banner changes-banner--info">
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.25rem' }}>{t('pages.changes.noPlanData')}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.6 }}>
            {t('pages.changes.noPlanDataDesc')}
          </div>
        </div>
      </div>
      <div>
        <SectionLabel>{t('pages.changes.howToIncludePlan')}</SectionLabel>
        <div style={{ position: 'relative' }}>
          <pre className="changes-code">{cmd}</pre>
          <button onClick={() => navigator.clipboard.writeText(cmd).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })}
            className="changes-copy-btn">
            {copied ? t('common.copied') : t('common.copy')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Compliance Drift helpers ─────────────────────────────────────────────────

interface DriftItem {
  control_id: string; check_id: string; check_title: string
  pillar: string; severity: string; resource: string
  message: string; remediation: string
}

const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
const SEV_COLOR: Record<string, string> = { critical: '#dc2626', high: '#d97706', medium: '#2563eb', low: '#059669', info: '#94a3b8' }

function findingKey(f: Finding) { return `${f.control_id}||${f.check_id}||${f.resource}` }

function computeDrift(base: RunDetail, head: RunDetail) {
  const baseFails = new Map<string, Finding>()
  const headFails = new Map<string, Finding>()
  for (const f of base.findings) if (f.status?.toUpperCase() === 'FAIL') baseFails.set(findingKey(f), f)
  for (const f of head.findings) if (f.status?.toUpperCase() === 'FAIL') headFails.set(findingKey(f), f)

  const toItem = (f: Finding): DriftItem => ({
    control_id: f.control_id, check_id: f.check_id, check_title: f.check_title,
    pillar: f.pillar, severity: f.severity, resource: f.resource,
    message: f.message, remediation: f.remediation,
  })

  const regressed: DriftItem[] = [], recovered: DriftItem[] = []
  for (const [k, f] of headFails) if (!baseFails.has(k)) regressed.push(toItem(f))
  for (const [k, f] of baseFails) if (!headFails.has(k)) recovered.push(toItem(f))
  regressed.sort((a, b) => (SEV_ORDER[a.severity?.toLowerCase()] ?? 9) - (SEV_ORDER[b.severity?.toLowerCase()] ?? 9))
  recovered.sort((a, b) => (SEV_ORDER[a.severity?.toLowerCase()] ?? 9) - (SEV_ORDER[b.severity?.toLowerCase()] ?? 9))
  return { regressed, recovered }
}

function DriftCard({ item, direction }: { item: DriftItem; direction: 'regressed' | 'recovered' }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const color = direction === 'regressed' ? (SEV_COLOR[item.severity?.toLowerCase()] ?? '#94a3b8') : '#059669'
  return (
    <div className="changes-drift-card" style={{ borderColor: `${color}33`, background: `${color}08` }}>
      <div className="changes-drift-card__header" onClick={() => setOpen(o => !o)}>
        <span className="changes-sev-badge" style={{ color, borderColor: `${color}44`, background: `${color}22` }}>
          {item.severity}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="changes-drift-card__title">{item.check_title || item.control_id}</div>
          <div className="changes-drift-card__resource">{item.resource}</div>
        </div>
        <span className="changes-drift-card__chevron">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="changes-drift-card__body" style={{ borderTopColor: `${color}22` }}>
          <div className="changes-drift-card__message">{item.message}</div>
          {item.remediation && (
            <div className="changes-drift-card__remediation">
              <strong>{t('pages.changes.remediation')}</strong> {item.remediation}
            </div>
          )}
          <div className="changes-drift-card__tags">
            <span>{item.pillar}</span>
            <span style={{ fontFamily: 'monospace' }}>{item.check_id}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Score Trend Sparkline ────────────────────────────────────────────────────

function ScoreTrend({ projectRuns, currentId }: { projectRuns: RunSummary[]; currentId: string }) {
  const { t } = useI18n()
  const sorted = [...projectRuns]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(-12)

  if (sorted.length < 2) return (
    <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '16px 0' }}>
      {t('pages.changes.needMoreRuns')}
    </div>
  )

  const W = 240, H = 72, PAD = 8
  const scores = sorted.map(r => r.score)
  const min = Math.max(0, Math.min(...scores) - 5)
  const max = Math.min(100, Math.max(...scores) + 5)
  const px = (i: number) => PAD + (i / (sorted.length - 1)) * (W - PAD * 2)
  const py = (s: number) => H - PAD - ((s - min) / (max - min || 1)) * (H - PAD * 2)
  const points = sorted.map((r, i) => `${px(i)},${py(r.score)}`).join(' ')
  const fill = `${px(0)},${H} ` + points + ` ${px(sorted.length - 1)},${H}`

  return (
    <svg width={W} height={H} style={{ overflow: 'visible', display: 'block', margin: '0 auto' }}>
      <polygon points={fill} fill="rgba(37,99,235,.10)" />
      <polyline points={points} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" />
      {sorted.map((r, i) => {
        const isCur = r.id === currentId
        const c = r.score >= 80 ? '#059669' : r.score >= 60 ? '#d97706' : '#dc2626'
        return (
          <g key={r.id}>
            <circle cx={px(i)} cy={py(r.score)} r={isCur ? 5 : 3} fill={isCur ? c : 'var(--surface)'} stroke={c} strokeWidth={isCur ? 2 : 1.5} />
            {isCur && <text x={px(i)} y={py(r.score) - 8} textAnchor="middle" fontSize={9} fill={c} fontWeight={700}>{r.score}</text>}
          </g>
        )
      })}
      <text x={PAD} y={H} fontSize={8} fill="var(--muted)">{sorted[0].score}</text>
      <text x={W - PAD} y={H} fontSize={8} fill="var(--muted)" textAnchor="end">{sorted[sorted.length - 1].score}</text>
    </svg>
  )
}

// ─── Right Sidebar ────────────────────────────────────────────────────────────

function Sidebar({ run, runs, prevRun }: { run: RunDetail; runs: RunSummary[]; prevRun: RunDetail | null }) {
  const { t } = useI18n()
  const projectRuns = useMemo(() =>
    runs.filter(r => r.project === run.project)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [runs, run.project]
  )

  return (
    <div className="changes-sidebar">
      <SectionCard title={t('pages.changes.scoreTrend')} subtitle={`${run.project} · ${t('pages.changes.runsLabel', { count: String(projectRuns.length), s: projectRuns.length !== 1 ? 's' : '' })}`}>
        <ScoreTrend projectRuns={projectRuns} currentId={run.id} />
      </SectionCard>

      {prevRun && (
        <SectionCard title={t('pages.changes.pillarDelta')}>
          {Object.entries(run.pillar_scores).map(([pillar, score]) => {
            const prev = prevRun.pillar_scores[pillar] ?? score
            const delta = score - prev
            return (
              <div key={pillar} style={{ marginBottom: '0.55rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pillar}</span>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: delta > 0 ? '#059669' : delta < 0 ? '#dc2626' : 'var(--muted)' }}>
                      {delta > 0 ? '+' : ''}{delta !== 0 ? delta.toFixed(0) : '—'}
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', width: 24, textAlign: 'right' }}>{score.toFixed(0)}</span>
                  </div>
                </div>
                <div style={{ height: 4, background: 'var(--bg)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${score}%`, background: score >= 80 ? '#059669' : score >= 60 ? '#d97706' : '#dc2626', borderRadius: 2 }} />
                </div>
              </div>
            )
          })}
        </SectionCard>
      )}

      {run.plan_changes && (
        <SectionCard title={t('pages.changes.planSummary')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {(Object.entries(run.plan_changes.summary) as [string, number][]).filter(([, v]) => v > 0).map(([key, val]) => {
              const meta = actionMeta(key === 'add' ? 'create' : key === 'change' ? 'update' : key === 'destroy' ? 'delete' : key)
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.6rem', borderRadius: '6px', background: meta.bg, border: `1px solid ${meta.color}33` }}>
                  <span style={{ fontWeight: 700, color: meta.color, fontSize: '0.75rem', fontFamily: 'monospace' }}>{meta.icon}</span>
                  <span style={{ fontWeight: 700, color: meta.color, fontSize: '0.75rem' }}>{val}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--muted)', textTransform: 'capitalize' }}>{key}</span>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: '0.65rem', fontSize: '0.7rem', color: 'var(--muted)' }}>
            Terraform {run.plan_changes.terraform_version} · {new Date(run.plan_changes.scanned_at).toLocaleString()}
          </div>
        </SectionCard>
      )}

      {prevRun && (
        <SectionCard title={t('pages.changes.driftBaseline')}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text)', lineHeight: 1.7 }}>
            <div><strong>Branch:</strong> {prevRun.branch}</div>
            <div><strong>Score:</strong> {prevRun.score}</div>
            <div><strong>SHA:</strong> <span style={{ fontFamily: 'monospace' }}>{prevRun.git_sha?.slice(0, 8)}</span></div>
            <div><strong>Date:</strong> {new Date(prevRun.created_at).toLocaleString()}</div>
          </div>
        </SectionCard>
      )}
    </div>
  )
}

// ─── Plan Changes Tab ─────────────────────────────────────────────────────────

function PlanChangesTab({ run }: { run: RunDetail }) {
  const { t } = useI18n()
  const plan = run.plan_changes
  const [actionFilter, setActionFilter] = useState('')
  const [providerFilter, setProviderFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<PlanChange | null>(null)

  if (!plan) return <NoPlanData run={run} />

  const totalChanges = (plan.summary.add ?? 0) + (plan.summary.change ?? 0) + (plan.summary.destroy ?? 0) + (plan.summary.replace ?? 0)
  const providers = Array.from(new Set(plan.changes.map(c => c.provider).filter(Boolean))).sort()

  const filtered = plan.changes.filter(c => {
    if (actionFilter && c.action !== actionFilter) return false
    if (providerFilter && c.provider !== providerFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!c.address.toLowerCase().includes(q) && !c.type.toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div className="changes-tab-stack">
      {selected && <ChangeDetailModal change={selected} onClose={() => setSelected(null)} />}

      <div className="changes-banner changes-banner--brand">
        <div><span style={{ fontWeight: 700, color: 'var(--text)' }}>{t('pages.changes.terraform')}</span>{plan.terraform_version && <span style={{ marginLeft: '0.35rem', fontFamily: 'monospace' }}>v{plan.terraform_version}</span>}</div>
        {plan.scanned_at && <div>{t('pages.changes.planCaptured')} <span style={{ color: 'var(--text)' }}>{new Date(plan.scanned_at).toLocaleString()}</span></div>}
        <div style={{ marginLeft: 'auto', fontWeight: 700, color: totalChanges > 0 ? '#d97706' : '#16a34a' }}>
          {totalChanges === 0 ? t('pages.changes.noChanges') : t('pages.changes.resourceChanges', { count: String(totalChanges), s: totalChanges !== 1 ? 's' : '' })}
        </div>
      </div>

      {totalChanges === 0 ? (
        <SectionCard title={t('pages.changes.planChangesTitle')}>
          <NoChanges plan={plan} />
        </SectionCard>
      ) : (
        <>
          <SectionCard title={t('pages.changes.planChangesTitle')} subtitle={`${filtered.length} / ${plan.changes.length}`}>
            <div className="changes-toolbar">
              <input
                className="changes-input"
                placeholder={t('pages.changes.searchAddressOrType')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, minWidth: '200px' }}
              />
              <select className="scc-select" value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
                <option value="">{t('pages.changes.allActions')}</option>
                <option value="create">Add</option>
                <option value="update">Change</option>
                <option value="replace">Replace</option>
                <option value="delete">Destroy</option>
              </select>
              {providers.length > 1 && (
                <select className="scc-select" value={providerFilter} onChange={e => setProviderFilter(e.target.value)}>
                  <option value="">{t('pages.changes.allProviders')}</option>
                  {providers.map(p => <option key={p}>{p}</option>)}
                </select>
              )}
            </div>
            <div className="changes-table-wrap" style={{ marginTop: '0.75rem' }}>
              <table className="changes-table">
                <thead>
                  <tr>
                    <th style={{ width: '2.25rem' }} />
                    <th>{t('pages.changes.colResource')}</th>
                    <th>{t('pages.changes.colType')}</th>
                    <th>{t('pages.changes.colProvider')}</th>
                    <th>{t('pages.changes.colAction')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => <ChangeRow key={i} change={c} onClick={() => setSelected(c)} />)}
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>{t('pages.changes.noMatchFilter')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {filtered.length > 0 && <div className="changes-table-hint">{t('pages.changes.clickForDetail')}</div>}
          </SectionCard>

          {plan.changes.length > 0 && (() => {
            const byType = plan.changes.reduce<Record<string, { add: number; update: number; delete: number; replace: number }>>((acc, c) => {
              if (!acc[c.type]) acc[c.type] = { add: 0, update: 0, delete: 0, replace: 0 }
              if (c.action === 'create')  acc[c.type].add++
              if (c.action === 'update')  acc[c.type].update++
              if (c.action === 'delete')  acc[c.type].delete++
              if (c.action === 'replace') acc[c.type].replace++
              return acc
            }, {})
            const rows = Object.entries(byType).sort((a, b) => {
              const ta = a[1].add + a[1].update + a[1].delete + a[1].replace
              const tb = b[1].add + b[1].update + b[1].delete + b[1].replace
              return tb - ta
            })
            if (!rows.length) return null
            return (
              <SectionCard title={t('pages.changes.byResourceType')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {rows.map(([type, counts]) => {
                    const total = counts.add + counts.update + counts.delete + counts.replace
                    return (
                      <div key={type} className="changes-breakdown-row">
                        <span className="changes-breakdown-row__type">{type}</span>
                        <div className="changes-breakdown-row__badges">
                          {counts.add > 0     && <span className="changes-breakdown-row__badge changes-breakdown-row__badge--add">+{counts.add}</span>}
                          {counts.update > 0  && <span className="changes-breakdown-row__badge changes-breakdown-row__badge--change">~{counts.update}</span>}
                          {counts.replace > 0 && <span className="changes-breakdown-row__badge changes-breakdown-row__badge--replace">⟳{counts.replace}</span>}
                          {counts.delete > 0  && <span className="changes-breakdown-row__badge changes-breakdown-row__badge--delete">−{counts.delete}</span>}
                        </div>
                        <span className="changes-breakdown-row__total">{total}</span>
                      </div>
                    )
                  })}
                </div>
              </SectionCard>
            )
          })()}
        </>
      )}
    </div>
  )
}

// ─── Compliance Drift Tab ─────────────────────────────────────────────────────

function ComplianceDriftTab({ items, direction, loading, prevRun }: {
  items: DriftItem[]; direction: 'regressed' | 'recovered'
  loading: boolean; prevRun: RunDetail | null
}) {
  const { t } = useI18n()
  const [pillarFilter, setPillarFilter] = useState('')
  const [sevFilter, setSevFilter] = useState('')

  const pillars = useMemo(() => [...new Set(items.map(i => i.pillar).filter(Boolean))].sort(), [items])
  const filtered = useMemo(() => items.filter(i =>
    (!pillarFilter || i.pillar === pillarFilter) && (!sevFilter || i.severity?.toLowerCase() === sevFilter)
  ), [items, pillarFilter, sevFilter])

  const title = direction === 'regressed' ? t('pages.changes.regressed') : t('pages.changes.recovered')

  if (loading) return <SectionCard title={title}><div className="scc-empty">{t('pages.changes.loadingBaseline')}</div></SectionCard>

  if (!prevRun) return (
    <SectionCard title={title}>
      <div className="changes-empty" style={{ padding: '2.5rem 1rem' }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>🔍</div>
        <strong>{t('pages.changes.noPreviousRun')}</strong>
        <div style={{ marginTop: 6, fontSize: 12 }}>{t('pages.changes.needAtLeastTwo')}</div>
      </div>
    </SectionCard>
  )

  const emptyMsg = direction === 'regressed'
    ? t('pages.changes.noRegressions')
    : t('pages.changes.noRecovered')

  return (
    <SectionCard title={title} subtitle={items.length > 0
      ? (direction === 'regressed'
          ? t('pages.changes.driftSummaryRegressed', { count: String(filtered.length), s: filtered.length !== 1 ? 's' : '' })
          : t('pages.changes.driftSummaryRecovered', { count: String(filtered.length), s: filtered.length !== 1 ? 's' : '' }))
      : undefined}>
      {items.length > 0 && (
        <div className="changes-toolbar">
          <select className="scc-select" value={pillarFilter} onChange={e => setPillarFilter(e.target.value)}>
            <option value="">{t('pages.changes.allPillars')}</option>
            {pillars.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="scc-select" value={sevFilter} onChange={e => setSevFilter(e.target.value)}>
            <option value="">{t('pages.changes.allSeverities')}</option>
            {['critical', 'high', 'medium', 'low', 'info'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {(pillarFilter || sevFilter) && (
            <button className="scc-btn-ghost" onClick={() => { setPillarFilter(''); setSevFilter('') }}>
              {t('pages.changes.clear')}
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="changes-empty" style={{ border: '1px dashed var(--border)', borderRadius: 12, padding: '2rem 1rem' }}>
          {emptyMsg}
        </div>
      ) : (
        <div style={{ marginTop: '0.5rem' }}>
          {filtered.map((item, i) => <DriftCard key={i} item={item} direction={direction} />)}
        </div>
      )}
    </SectionCard>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChangesPage({ run, runs }: Props) {
  const { t } = useI18n()
  const [tab, setTab] = useState<'plan' | 'regressed' | 'recovered'>('plan')
  const [prevRun, setPrevRun] = useState<RunDetail | null>(null)
  const [prevLoading, setPrevLoading] = useState(false)

  const prevRunSummary = useMemo(() => {
    const curTime = new Date(run.created_at).getTime()
    return runs
      .filter(r => r.project === run.project)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .find(r => r.id !== run.id && new Date(r.created_at).getTime() < curTime) ?? null
  }, [runs, run])

  useEffect(() => {
    if (!prevRunSummary) { setPrevRun(null); return }
    setPrevLoading(true)
    fetchRun(prevRunSummary.id).then(setPrevRun).catch(() => setPrevRun(null)).finally(() => setPrevLoading(false))
  }, [prevRunSummary])

  const { regressed, recovered } = useMemo(() => {
    if (!prevRun) return { regressed: [] as DriftItem[], recovered: [] as DriftItem[] }
    return computeDrift(prevRun, run)
  }, [prevRun, run])

  const plan = run.plan_changes
  const add = plan?.summary.add ?? 0
  const change = plan?.summary.change ?? 0
  const replace = plan?.summary.replace ?? 0
  const destroy = plan?.summary.destroy ?? 0
  const noOp = plan?.summary.no_op ?? 0

  const tabs = [
    { key: 'plan' as const, label: t('pages.changes.tabPlanChanges', { count: String(add + change + replace + destroy) }) },
    { key: 'regressed' as const, label: t('pages.changes.tabRegressed', { count: String(regressed.length) }) },
    { key: 'recovered' as const, label: t('pages.changes.tabRecovered', { count: String(recovered.length) }) },
  ]

  return (
    <div className="changes-root">
      <SocStyles />
      <style>{changesPageCss}</style>

      <div className="changes-hero">
        <div className="changes-hero__main">
          <div className="changes-hero__badge"><ListIcon /> Changes & Drift</div>
          <h1 className="changes-hero__title">{t('pages.changes.title')}</h1>
          <p className="changes-hero__subtitle">{t('pages.changes.subtitle')}</p>
        </div>
      </div>

      <div className="scc-kpi-grid" style={{ marginBottom: '1.25rem' }}>
        <KpiTile label={t('pages.changes.kpiAdd')} value={add} color={actionMeta('create').color} />
        <KpiTile label={t('pages.changes.kpiChange')} value={change} color={actionMeta('update').color} />
        <KpiTile label={t('pages.changes.kpiReplace')} value={replace} color={actionMeta('replace').color} />
        <KpiTile label={t('pages.changes.kpiDestroy')} value={destroy} color={actionMeta('delete').color} />
        <KpiTile label={t('pages.changes.kpiUnchanged')} value={noOp} color={actionMeta('no-op').color} />
      </div>

      <div className="changes-layout">
        <div className="changes-main">
          <SegmentedTabs options={tabs} value={tab} onChange={setTab} />

          <div style={{ marginTop: '1rem' }}>
            {tab === 'plan'       && <PlanChangesTab run={run} />}
            {tab === 'regressed'  && <ComplianceDriftTab items={regressed} direction="regressed" loading={prevLoading} prevRun={prevRun} />}
            {tab === 'recovered'  && <ComplianceDriftTab items={recovered} direction="recovered" loading={prevLoading} prevRun={prevRun} />}
          </div>
        </div>

        <Sidebar run={run} runs={runs} prevRun={prevRun} />
      </div>
    </div>
  )
}

const changesPageCss = `
.changes-root {
  padding: 0 0 24px;
  max-width: 1280px;
  margin: 0 auto;
}

.changes-hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.25rem;
}
.changes-hero__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--waf-brand);
  text-transform: uppercase;
  background: color-mix(in srgb, var(--waf-brand) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--waf-brand) 20%, transparent);
  border-radius: 999px;
  padding: 0.25rem 0.65rem;
  margin-bottom: 0.5rem;
}
.changes-hero__title {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text);
  margin: 0;
}
.changes-hero__subtitle {
  font-size: 0.8rem;
  color: var(--muted);
  margin: 0.35rem 0 0;
  max-width: 680px;
}

.changes-layout {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
}
.changes-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.changes-sidebar {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.changes-tab-stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.changes-toolbar {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}
.changes-input {
  padding: 0.45rem 0.65rem;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--waf-brand) 15%, transparent);
  background: var(--bg);
  color: var(--text);
  font-size: 0.8rem;
  outline: none;
}
.changes-input:focus {
  border-color: color-mix(in srgb, var(--waf-brand) 40%, transparent);
}
.changes-count {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--muted);
}

.changes-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  font-size: 0.78rem;
  color: var(--muted);
}
.changes-banner--brand {
  background: color-mix(in srgb, var(--waf-brand) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--waf-brand) 15%, transparent);
}
.changes-banner--info {
  background: var(--surface);
  border: 1px solid var(--border);
}

.changes-table-wrap {
  overflow-x: auto;
  border-radius: 10px;
  border: 1px solid var(--border);
}
.changes-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}
.changes-table th {
  padding: 0.6rem 0.75rem;
  text-align: left;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--bg);
  white-space: nowrap;
}
.changes-table td {
  padding: 0.65rem 0.75rem;
  border-top: 1px solid var(--border);
  vertical-align: top;
}
.changes-row {
  cursor: pointer;
  transition: background 0.1s ease;
}
.changes-row:hover {
  background: var(--bg);
}
.changes-table-hint {
  padding: 0.5rem 0.75rem;
  border-top: 1px solid var(--border);
  font-size: 0.7rem;
  color: var(--muted);
}

.changes-attr-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.76rem;
}
.changes-attr-table th {
  padding: 0.3rem 0.6rem;
  text-align: left;
  color: var(--muted);
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
  width: 22%;
  background: var(--bg);
}
.changes-attr-table th:nth-child(2) { width: 39%; }
.changes-attr-table th:nth-child(3) { width: 39%; }
.changes-attr-table td {
  padding: 0.35rem 0.6rem;
  font-family: monospace;
  border-top: 1px solid var(--border);
  vertical-align: top;
  word-break: break-word;
}

.changes-alert {
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  font-size: 0.77rem;
  line-height: 1.55;
}
.changes-alert--success { background: rgba(22,163,74,.07); border: 1px solid rgba(22,163,74,.2); color: #14532d; }
.changes-alert--warn    { background: rgba(217,119,6,.07); border: 1px solid rgba(217,119,6,.2); color: #78350f; }
.changes-alert--danger  { background: rgba(220,38,38,.06); border: 1px solid rgba(220,38,38,.22); color: #7f1d1d; }
.changes-alert--info    { background: rgba(124,58,237,.07); border: 1px solid rgba(124,58,237,.2); color: #4c1d95; }
.changes-alert__title { font-weight: 700; margin-bottom: 0.35rem; }
.changes-alert ul { margin: 0; padding-left: 1.25rem; }
.changes-alert li { font-size: 0.76rem; line-height: 1.55; }

.changes-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  gap: 0.75rem;
  text-align: center;
  color: var(--muted);
  font-size: 0.85rem;
}
.changes-empty__icon {
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  background: rgba(22,163,74,.1);
  border: 2px solid rgba(22,163,74,.3);
  display: flex;
  align-items: center;
  justify-content: center;
}
.changes-empty__title {
  font-size: 1.1rem;
  font-weight: 800;
  color: #16a34a;
}
.changes-empty__desc {
  font-size: 0.82rem;
  color: var(--muted);
  margin-top: 0.35rem;
}

.changes-code {
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 8px;
  padding: 0.875rem 3rem 0.875rem 0.875rem;
  font-size: 0.78rem;
  overflow-x: auto;
  line-height: 1.8;
  margin: 0;
}
.changes-copy-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 5px;
  color: #94a3b8;
  font-size: 0.65rem;
  padding: 0.2rem 0.5rem;
  cursor: pointer;
}
.changes-copy-btn:hover { color: #e2e8f0; }

.changes-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-size: 0.64rem;
  font-weight: 700;
  text-transform: uppercase;
  line-height: 1.4;
}
.changes-badge--muted {
  background: var(--bg);
  color: var(--muted);
  text-transform: none;
  font-weight: 600;
}
.changes-badge--brand {
  background: rgba(0,148,255,.08);
  color: var(--waf-brand);
}

.changes-breakdown-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.8rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--border);
}
.changes-breakdown-row:last-child { border-bottom: none; }
.changes-breakdown-row__type {
  font-family: monospace;
  color: var(--text);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.changes-breakdown-row__badges {
  display: flex;
  gap: 0.3rem;
  flex-shrink: 0;
}
.changes-breakdown-row__badge {
  padding: 0.1rem 0.4rem;
  border-radius: 5px;
  font-size: 0.68rem;
  font-weight: 700;
}
.changes-breakdown-row__badge--add    { background: rgba(22,163,74,.1);   color: #16a34a; }
.changes-breakdown-row__badge--change { background: rgba(217,119,6,.1);  color: #d97706; }
.changes-breakdown-row__badge--replace{ background: rgba(124,58,237,.1); color: #7c3aed; }
.changes-breakdown-row__badge--delete { background: rgba(220,38,38,.1);  color: #dc2626; }
.changes-breakdown-row__total {
  color: var(--muted);
  font-size: 0.7rem;
  flex-shrink: 0;
  min-width: 1.5rem;
  text-align: right;
}

.changes-drift-card {
  border-radius: 12px;
  margin-bottom: 0.5rem;
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--border);
  transition: border-color 0.15s ease;
}
.changes-drift-card:hover { border-color: color-mix(in srgb, var(--waf-brand) 25%, transparent); }
.changes-drift-card__header {
  padding: 0.65rem 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
}
.changes-drift-card__title {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 0.1rem;
}
.changes-drift-card__resource {
  font-size: 0.72rem;
  color: var(--muted);
  font-family: monospace;
}
.changes-drift-card__chevron {
  font-size: 0.75rem;
  color: var(--muted);
  flex-shrink: 0;
}
.changes-drift-card__body {
  padding: 0 0.85rem 0.75rem;
  border-top: 1px solid var(--border);
}
.changes-drift-card__message {
  margin-top: 0.65rem;
  font-size: 0.78rem;
  color: var(--text);
  line-height: 1.5;
}
.changes-drift-card__remediation {
  margin-top: 0.5rem;
  padding: 0.6rem 0.75rem;
  background: var(--bg);
  border-radius: 8px;
  font-size: 0.72rem;
  color: var(--muted);
  line-height: 1.5;
}
.changes-drift-card__tags {
  margin-top: 0.5rem;
  display: flex;
  gap: 0.4rem;
}
.changes-drift-card__tags span {
  font-size: 0.7rem;
  color: var(--muted);
  background: var(--bg);
  border-radius: 4px;
  padding: 0.15rem 0.5rem;
}
.changes-sev-badge {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  border: 1px solid;
  border-radius: 5px;
  padding: 0.15rem 0.45rem;
  flex-shrink: 0;
  margin-top: 0.1rem;
}

.changes-modal-portal { position: fixed; inset: 0; z-index: 99; }
.changes-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); }
.changes-modal {
  position: fixed;
  top: 4rem;
  left: 50%;
  transform: translateX(-50%);
  width: min(1080px, 95vw);
  max-height: min(80vh, calc(100vh - 6rem));
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 24px 64px rgba(0,0,0,.4);
  display: flex;
  flex-direction: column;
  z-index: 100;
  overflow: hidden;
}
.changes-modal__header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}
.changes-modal__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 7px;
  font-family: monospace;
  font-weight: 800;
  font-size: 1.05rem;
  flex-shrink: 0;
}
.changes-modal__title-block {
  flex: 1;
  min-width: 0;
}
.changes-modal__address {
  font-family: monospace;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text);
  word-break: break-all;
  line-height: 1.35;
}
.changes-modal__meta {
  display: flex;
  gap: 0.4rem;
  margin-top: 0.4rem;
  flex-wrap: wrap;
  align-items: center;
}
.changes-modal__close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--muted);
  font-size: 1.4rem;
  padding: 0 0.15rem;
  line-height: 1;
  flex-shrink: 0;
}
.changes-modal__body {
  flex: 1;
  overflow: auto;
  padding: 1.25rem;
}
.changes-modal__footer {
  padding: 0.65rem 1.25rem;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 1100px) {
  .changes-layout { flex-direction: column; }
  .changes-sidebar { width: 100%; }
}
`
