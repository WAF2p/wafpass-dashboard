import { useEffect, useMemo, useState } from 'react'
import { fetchRun, Finding, PlanChange, PlanChanges, RunDetail, RunSummary } from '../api'
import { useI18n } from '../i18n'

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
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
        <thead>
          <tr style={{ background: 'var(--bg)' }}>
            <th style={{ padding: '0.3rem 0.6rem', textAlign: 'left', color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, width: '22%' }}>Attribute</th>
            <th style={{ padding: '0.3rem 0.6rem', textAlign: 'left', color: beforeColor, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, width: '39%' }}>{beforeLabel}</th>
            <th style={{ padding: '0.3rem 0.6rem', textAlign: 'left', color: afterColor,  fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, width: '39%' }}>{afterLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, before: b, after: a, isUnknown, isSecurity }) => (
            <tr key={key} style={{ borderTop: '1px solid var(--border)', background: isSecurity ? 'rgba(217,119,6,.04)' : undefined }}>
              <td style={{ padding: '0.35rem 0.6rem', fontFamily: 'monospace', color: isSecurity ? '#d97706' : 'var(--muted)', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                {isSecurity && <span style={{ marginRight: '0.2rem' }}>⚠</span>}{key}
              </td>
              <td style={{ padding: '0.35rem 0.6rem', fontFamily: 'monospace', verticalAlign: 'top', wordBreak: 'break-word', background: 'rgba(220,38,38,.04)', borderRight: '2px solid rgba(220,38,38,.12)' }}>
                {b !== undefined ? renderAttrValue(b) : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>—</span>}
              </td>
              <td style={{ padding: '0.35rem 0.6rem', fontFamily: 'monospace', verticalAlign: 'top', wordBreak: 'break-word', background: 'rgba(22,163,74,.04)' }}>
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
    <div style={{ padding: '0.7rem 0.85rem', borderRadius: '8px', background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.22)', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#dc2626' }}>{t('pages.changes.tailbreakAlert')}</div>
      <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {risks.map((r, i) => <li key={i} style={{ fontSize: '0.77rem', color: '#7f1d1d', lineHeight: 1.55 }}>{r}</li>)}
      </ul>
    </div>
  )
}

function CreateDetail({ after, afterUnknown }: { after: Attrs | null | undefined; afterUnknown?: Attrs | null }) {
  const { t } = useI18n()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', background: 'rgba(22,163,74,.07)', border: '1px solid rgba(22,163,74,.2)', fontSize: '0.77rem', color: '#14532d' }}>
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
      <div style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', background: 'rgba(217,119,6,.07)', border: '1px solid rgba(217,119,6,.2)', fontSize: '0.77rem', color: '#78350f' }}>
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
      <div style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', background: 'rgba(124,58,237,.07)', border: '1px solid rgba(124,58,237,.2)', fontSize: '0.77rem', color: '#4c1d95' }}>
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
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 99 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '1560px', maxWidth: '95vw', maxHeight: '86vh',
        background: 'var(--card-bg)', borderRadius: '14px',
        boxShadow: '0 24px 64px rgba(0,0,0,.4)',
        display: 'flex', flexDirection: 'column', zIndex: 100, overflow: 'hidden',
      }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '2.1rem', height: '2.1rem', borderRadius: '7px', background: bg, color, fontFamily: 'monospace', fontWeight: 800, fontSize: '1.05rem', flexShrink: 0 }}>{icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'monospace', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', wordBreak: 'break-all', lineHeight: 1.35 }}>{change.address}</div>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ padding: '0.1rem 0.45rem', borderRadius: '999px', background: bg, color, fontSize: '0.64rem', fontWeight: 700 }}>{label}</span>
              <span style={{ padding: '0.1rem 0.45rem', borderRadius: '999px', background: 'var(--bg)', color: 'var(--muted)', fontSize: '0.64rem', fontWeight: 600, fontFamily: 'monospace' }}>{change.type}</span>
              {change.provider && <span style={{ padding: '0.1rem 0.45rem', borderRadius: '999px', background: 'rgba(0,148,255,.08)', color: 'var(--waf-brand)', fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase' }}>{change.provider}</span>}
              {change.module_address && <span style={{ padding: '0.1rem 0.45rem', borderRadius: '999px', background: 'var(--bg)', color: 'var(--muted)', fontSize: '0.64rem', fontFamily: 'monospace' }}>module: {change.module_address}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.4rem', padding: '0 0.15rem', lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '1.25rem' }}>
          {change.action === 'create'  && <CreateDetail  after={after} afterUnknown={afterUnknown} />}
          {change.action === 'update'  && <UpdateDetail  before={before} after={after} afterUnknown={afterUnknown} />}
          {change.action === 'delete'  && <DeleteDetail  before={before} type={change.type} />}
          {change.action === 'replace' && <ReplaceDetail before={before} after={after} afterUnknown={afterUnknown} type={change.type} />}
        </div>
        <div style={{ padding: '0.65rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.4rem 1.1rem', borderRadius: '7px', border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>{t('pages.changes.close')}</button>
        </div>
      </div>
    </>
  )
}

function ChangeRow({ change, onClick }: { change: PlanChange; onClick: () => void }) {
  const { color, bg, icon } = actionMeta(change.action)
  return (
    <tr onClick={onClick} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}>
      <td style={{ padding: '0.65rem 0.75rem', width: '2.25rem', textAlign: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1.5rem', height: '1.5rem', borderRadius: '5px', background: bg, color, fontFamily: 'monospace', fontWeight: 800, fontSize: '0.8rem' }}>{icon}</span>
      </td>
      <td style={{ padding: '0.65rem 0.5rem' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text)', fontWeight: 600 }}>{change.address}</div>
        {change.module_address && <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.1rem' }}>module: {change.module_address}</div>}
      </td>
      <td style={{ padding: '0.65rem 0.5rem', whiteSpace: 'nowrap' }}><span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--muted)' }}>{change.type}</span></td>
      <td style={{ padding: '0.65rem 0.5rem', whiteSpace: 'nowrap' }}>
        {change.provider && <span style={{ padding: '0.1rem 0.4rem', borderRadius: '999px', background: 'rgba(0,148,255,.08)', color: 'var(--waf-brand)', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase' }}>{change.provider}</span>}
      </td>
      <td style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap' }}>
        <span style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', background: bg, color, fontSize: '0.68rem', fontWeight: 700 }}>{actionMeta(change.action).label}</span>
      </td>
    </tr>
  )
}

function SummaryPill({ count, action }: { count: number; action: string }) {
  const { label, color, bg, icon } = actionMeta(action)
  if (count === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.75rem 1.25rem', borderRadius: '12px', background: bg, border: `1px solid ${color}33`, minWidth: '90px' }}>
      <div style={{ fontSize: '1.875rem', fontWeight: 800, color, lineHeight: 1 }}>{count}</div>
      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginTop: '0.2rem' }}>
        <span style={{ marginRight: '0.25rem', fontFamily: 'monospace', fontWeight: 800 }}>{icon}</span>{label}
      </div>
    </div>
  )
}

function NoChanges({ plan }: { plan: PlanChanges }) {
  const { t } = useI18n()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3.5rem 2rem', gap: '1rem', textAlign: 'center' }}>
      <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '50%', background: 'rgba(22,163,74,.1)', border: '2px solid rgba(22,163,74,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg style={{ width: '1.75rem', height: '1.75rem', color: '#16a34a' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#16a34a' }}>{t('pages.changes.noPlanChanges')}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '0.35rem' }}>{t('pages.changes.noPlanChangesDesc')}</div>
      </div>
      {plan.summary.no_op > 0 && <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{t('pages.changes.resourcesUpToDate', { count: String(plan.summary.no_op), s: plan.summary.no_op !== 1 ? 's' : '' })}</div>}
    </div>
  )
}

function NoPlanData({ run }: { run: RunDetail }) {
  const { t } = useI18n()
  const iacPath = run.path || run.source_paths?.[0] || '/path/to/terraform'
  const iac = run.iac_framework && run.iac_framework !== 'terraform' ? ` --iac ${run.iac_framework}` : ''
  const pushUrl = window.location.origin
  const [copied, setCopied] = useState(false)
  const cmd = `terraform plan -out=tfplan\nterraform show -json tfplan > plan.json\nwafpass check${iac} --output json --push ${pushUrl}/runs --plan-file plan.json ${iacPath}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '680px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '1rem 1.1rem', borderRadius: '10px', background: 'rgba(148,163,184,.08)', border: '1px solid rgba(148,163,184,.2)' }}>
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.25rem' }}>{t('pages.changes.noPlanData')}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.6 }}>
            {t('pages.changes.noPlanDataDesc')}
          </div>
        </div>
      </div>
      <div>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>{t('pages.changes.howToIncludePlan')}</div>
        <div style={{ position: 'relative' }}>
          <pre style={{ background: '#0f172a', color: '#e2e8f0', borderRadius: '8px', padding: '0.875rem 3rem 0.875rem 0.875rem', fontSize: '0.78rem', overflowX: 'auto', lineHeight: 1.8, margin: 0 }}>{cmd}</pre>
          <button onClick={() => navigator.clipboard.writeText(cmd).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })}
            style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', borderRadius: '5px', color: copied ? '#22c55e' : '#94a3b8', fontSize: '0.65rem', padding: '0.2rem 0.5rem', cursor: 'pointer' }}>
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
    <div style={{ border: `1px solid ${color}33`, borderRadius: 8, marginBottom: 8, overflow: 'hidden', background: `${color}08` }}>
      <div style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10 }} onClick={() => setOpen(o => !o)}>
        <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}22`, border: `1px solid ${color}44`, borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase', flexShrink: 0, marginTop: 1 }}>
          {item.severity}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{item.check_title || item.control_id}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{item.resource}</div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ padding: '0 14px 12px', borderTop: `1px solid ${color}22` }}>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.message}</div>
          {item.remediation && (
            <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--bg-secondary)', borderRadius: 6, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--text-secondary)' }}>{t('pages.changes.remediation')}</strong> {item.remediation}
            </div>
          )}
          <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 4, padding: '2px 6px' }}>{item.pillar}</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: 4, padding: '2px 6px', fontFamily: 'monospace' }}>{item.check_id}</span>
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
    <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
      {t('pages.changes.needMoreRuns')}
    </div>
  )

  const W = 280, H = 72, PAD = 8
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
            <circle cx={px(i)} cy={py(r.score)} r={isCur ? 5 : 3} fill={isCur ? c : 'var(--card-bg)'} stroke={c} strokeWidth={isCur ? 2 : 1.5} />
            {isCur && <text x={px(i)} y={py(r.score) - 8} textAnchor="middle" fontSize={9} fill={c} fontWeight={700}>{r.score}</text>}
          </g>
        )
      })}
      <text x={PAD} y={H} fontSize={8} fill="var(--text-muted)">{sorted[0].score}</text>
      <text x={W - PAD} y={H} fontSize={8} fill="var(--text-muted)" textAnchor="end">{sorted[sorted.length - 1].score}</text>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: 300, flexShrink: 0 }}>

      {/* Score trend */}
      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>{t('pages.changes.scoreTrend')} · {run.project}</div>
        <ScoreTrend projectRuns={projectRuns} currentId={run.id} />
        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
          <span>{t('pages.changes.oldest')}</span><span>{t('pages.changes.runsLabel', { count: String(projectRuns.length), s: projectRuns.length !== 1 ? 's' : '' })}</span><span>{t('pages.changes.latest')}</span>
        </div>
      </div>

      {/* Pillar delta */}
      {prevRun && (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>{t('pages.changes.pillarDelta')}</div>
          {Object.entries(run.pillar_scores).map(([pillar, score]) => {
            const prev = prevRun.pillar_scores[pillar] ?? score
            const delta = score - prev
            return (
              <div key={pillar} style={{ marginBottom: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pillar}</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: delta > 0 ? '#059669' : delta < 0 ? '#dc2626' : 'var(--text-muted)' }}>
                      {delta > 0 ? '+' : ''}{delta !== 0 ? delta.toFixed(0) : '—'}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', width: 26, textAlign: 'right' }}>{score.toFixed(0)}</span>
                  </div>
                </div>
                <div style={{ height: 4, background: 'var(--bg-secondary)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${score}%`, background: score >= 80 ? '#059669' : score >= 60 ? '#d97706' : '#dc2626', borderRadius: 2 }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Plan summary */}
      {run.plan_changes && (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>{t('pages.changes.planSummary')}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(Object.entries(run.plan_changes.summary) as [string, number][]).filter(([, v]) => v > 0).map(([key, val]) => {
              const meta = actionMeta(key === 'add' ? 'create' : key === 'change' ? 'update' : key === 'destroy' ? 'delete' : key)
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 6, background: meta.bg, border: `1px solid ${meta.color}33` }}>
                  <span style={{ fontWeight: 700, color: meta.color, fontSize: 14 }}>{meta.icon}</span>
                  <span style={{ fontWeight: 700, color: meta.color, fontSize: 13 }}>{val}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{key}</span>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>
            Terraform {run.plan_changes.terraform_version} · {new Date(run.plan_changes.scanned_at).toLocaleString()}
          </div>
        </div>
      )}

      {/* Baseline run */}
      {prevRun && (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{t('pages.changes.driftBaseline')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <div><strong>Branch:</strong> {prevRun.branch}</div>
            <div><strong>Score:</strong> {prevRun.score}</div>
            <div><strong>SHA:</strong> <span style={{ fontFamily: 'monospace' }}>{prevRun.git_sha?.slice(0, 8)}</span></div>
            <div><strong>Date:</strong> {new Date(prevRun.created_at).toLocaleString()}</div>
          </div>
        </div>
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

  const selectStyle = { background: 'var(--card-bg)', color: 'var(--text-primary)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.8rem', outline: 'none' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {selected && <ChangeDetailModal change={selected} onClose={() => setSelected(null)} />}

      <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(0,148,255,.05)', border: '1px solid rgba(0,148,255,.15)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
        <div><span style={{ fontWeight: 600, color: 'var(--text)' }}>{t('pages.changes.terraform')}</span>{plan.terraform_version && <span style={{ marginLeft: '0.35rem', fontFamily: 'monospace' }}>v{plan.terraform_version}</span>}</div>
        {plan.scanned_at && <div>{t('pages.changes.planCaptured')} <span style={{ color: 'var(--text)' }}>{new Date(plan.scanned_at).toLocaleString()}</span></div>}
        <div style={{ marginLeft: 'auto', fontWeight: 600, color: totalChanges > 0 ? '#d97706' : '#16a34a' }}>
          {totalChanges === 0 ? t('pages.changes.noChanges') : t('pages.changes.resourceChanges', { count: String(totalChanges), s: totalChanges !== 1 ? 's' : '' })}
        </div>
      </div>

      {totalChanges === 0 ? (
        <div className="card" style={{ padding: 0 }}><NoChanges plan={plan} /></div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <SummaryPill count={plan.summary.add}     action="create"  />
            <SummaryPill count={plan.summary.change}  action="update"  />
            <SummaryPill count={plan.summary.replace} action="replace" />
            <SummaryPill count={plan.summary.destroy} action="delete"  />
            {plan.summary.no_op > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0.5rem 0.75rem', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)', fontSize: '0.72rem', color: 'var(--muted)' }}>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{plan.summary.no_op}</span><span>{t('pages.changes.unchanged')}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input placeholder={t('pages.changes.searchAddressOrType')} value={search} onChange={e => setSearch(e.target.value)} style={{ ...selectStyle, flex: '1', minWidth: '200px' }} />
            <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={selectStyle}>
              <option value="">{t('pages.changes.allActions')}</option>
              <option value="create">Add</option>
              <option value="update">Change</option>
              <option value="replace">Replace</option>
              <option value="delete">Destroy</option>
            </select>
            {providers.length > 1 && (
              <select value={providerFilter} onChange={e => setProviderFilter(e.target.value)} style={selectStyle}>
                <option value="">{t('pages.changes.allProviders')}</option>
                {providers.map(p => <option key={p}>{p}</option>)}
              </select>
            )}
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{filtered.length} / {plan.changes.length}</span>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    <th style={{ padding: '0.6rem 0.75rem', width: '2.25rem' }} />
                    {(['Address', 'Type', 'Provider', 'Action'] as const).map(h => (
                      <th key={h} style={{ padding: '0.6rem 0.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
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
            {filtered.length > 0 && <div style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border)', fontSize: '0.7rem', color: 'var(--muted)' }}>{t('pages.changes.clickForDetail')}</div>}
          </div>

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
              <div className="card">
                <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.875rem' }}>{t('pages.changes.byResourceType')}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {rows.map(([type, counts]) => {
                    const total = counts.add + counts.update + counts.delete + counts.replace
                    return (
                      <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem' }}>
                        <span style={{ fontFamily: 'monospace', color: 'var(--text)', flex: '1', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{type}</span>
                        <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                          {counts.add > 0     && <span style={{ padding: '0.1rem 0.4rem', borderRadius: '5px', background: 'rgba(22,163,74,.1)',   color: '#16a34a', fontSize: '0.68rem', fontWeight: 700 }}>+{counts.add}</span>}
                          {counts.update > 0  && <span style={{ padding: '0.1rem 0.4rem', borderRadius: '5px', background: 'rgba(217,119,6,.1)',  color: '#d97706', fontSize: '0.68rem', fontWeight: 700 }}>~{counts.update}</span>}
                          {counts.replace > 0 && <span style={{ padding: '0.1rem 0.4rem', borderRadius: '5px', background: 'rgba(124,58,237,.1)', color: '#7c3aed', fontSize: '0.68rem', fontWeight: 700 }}>⟳{counts.replace}</span>}
                          {counts.delete > 0  && <span style={{ padding: '0.1rem 0.4rem', borderRadius: '5px', background: 'rgba(220,38,38,.1)',  color: '#dc2626', fontSize: '0.68rem', fontWeight: 700 }}>−{counts.delete}</span>}
                        </div>
                        <span style={{ color: 'var(--muted)', fontSize: '0.7rem', flexShrink: 0, minWidth: '1.5rem', textAlign: 'right' }}>{total}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
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

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>{t('pages.changes.loadingBaseline')}</div>

  if (!prevRun) return (
    <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px dashed var(--card-border)', borderRadius: 10, color: 'var(--text-muted)', fontSize: 14 }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>🔍</div>
      <strong>{t('pages.changes.noPreviousRun')}</strong>
      <div style={{ marginTop: 6, fontSize: 12 }}>{t('pages.changes.needAtLeastTwo')}</div>
    </div>
  )

  const emptyMsg = direction === 'regressed'
    ? t('pages.changes.noRegressions')
    : t('pages.changes.noRecovered')

  return (
    <div>
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <select value={pillarFilter} onChange={e => setPillarFilter(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 12 }}>
            <option value="">{t('pages.changes.allPillars')}</option>
            {pillars.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={sevFilter} onChange={e => setSevFilter(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', fontSize: 12 }}>
            <option value="">{t('pages.changes.allSeverities')}</option>
            {['critical', 'high', 'medium', 'low', 'info'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {(pillarFilter || sevFilter) && (
            <button onClick={() => { setPillarFilter(''); setSevFilter('') }}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--card-border)', background: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
              {t('pages.changes.clear')}
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, border: '1px dashed var(--card-border)', borderRadius: 10, color: direction === 'regressed' ? '#059669' : 'var(--text-muted)', fontSize: 14 }}>
          {emptyMsg}
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--text-muted)' }}>
            {direction === 'regressed'
              ? t('pages.changes.driftSummaryRegressed', { count: String(filtered.length), s: filtered.length !== 1 ? 's' : '' })
              : t('pages.changes.driftSummaryRecovered', { count: String(filtered.length), s: filtered.length !== 1 ? 's' : '' })}
          </div>
          {filtered.map((item, i) => <DriftCard key={i} item={item} direction={direction} />)}
        </>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChangesPage({ run, runs }: Props) {
  const { t } = useI18n()
  const [tab, setTab] = useState<'plan' | 'regressed' | 'recovered'>('plan')
  const [prevRun, setPrevRun] = useState<RunDetail | null>(null)
  const [prevLoading, setPrevLoading] = useState(false)

  // Previous run for same project
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

  const planTotal = run.plan_changes
    ? (run.plan_changes.summary.add ?? 0) + (run.plan_changes.summary.change ?? 0)
      + (run.plan_changes.summary.destroy ?? 0) + (run.plan_changes.summary.replace ?? 0)
    : 0

  const scoreDelta = prevRun ? run.score - prevRun.score : null

  const tabs: [typeof tab, string, string][] = [
    ['plan',       t('pages.changes.tabPlanChanges', { count: String(planTotal) }),       '#2563eb'],
    ['regressed',  t('pages.changes.tabRegressed',   { count: String(regressed.length) }), '#dc2626'],
    ['recovered',  t('pages.changes.tabRecovered',   { count: String(recovered.length) }), '#059669'],
  ]

  return (
    <div style={{ padding: '0 0 24px', maxWidth: 1280, margin: '0 auto' }}>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {scoreDelta !== null && (
          <div style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid var(--card-border)', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: scoreDelta > 0 ? '#059669' : scoreDelta < 0 ? '#dc2626' : 'var(--text-muted)' }}>
              {scoreDelta > 0 ? '+' : ''}{scoreDelta}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('pages.changes.scoreDelta')}</div>
          </div>
        )}
        {planTotal > 0 && (
          <div style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid var(--card-border)', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#d97706' }}>{planTotal}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t('pages.changes.infraChanges')}</div>
          </div>
        )}
        {regressed.length > 0 && (
          <div style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.2)', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626' }}>{regressed.length}</div>
            <div style={{ fontSize: 10, color: '#dc2626' }}>{t('pages.changes.regressionsLabel')}</div>
          </div>
        )}
        {recovered.length > 0 && (
          <div style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(5,150,105,.06)', border: '1px solid rgba(5,150,105,.2)', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#059669' }}>{recovered.length}</div>
            <div style={{ fontSize: 10, color: '#059669' }}>{t('pages.changes.recoveredLabel')}</div>
          </div>
        )}
      </div>

      {/* Layout */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* Main area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, marginBottom: 18, borderBottom: '1px solid var(--card-border)' }}>
            {tabs.map(([key, label, color]) => (
              <button key={key} onClick={() => setTab(key as typeof tab)} style={{
                padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: 'none',
                borderBottom: tab === key ? `2px solid ${color}` : '2px solid transparent',
                color: tab === key ? color : 'var(--text-muted)', marginBottom: -1,
              }}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'plan'       && <PlanChangesTab run={run} />}
          {tab === 'regressed'  && <ComplianceDriftTab items={regressed} direction="regressed" loading={prevLoading} prevRun={prevRun} />}
          {tab === 'recovered'  && <ComplianceDriftTab items={recovered} direction="recovered" loading={prevLoading} prevRun={prevRun} />}
        </div>

        {/* Sidebar */}
        <Sidebar run={run} runs={runs} prevRun={prevRun} />
      </div>
    </div>
  )
}
