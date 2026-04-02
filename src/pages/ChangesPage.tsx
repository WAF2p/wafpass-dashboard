import { useState } from 'react'
import { PlanChange, PlanChanges, RunDetail } from '../api'

interface Props { run: RunDetail }

type Attrs = Record<string, unknown>

// ─── Action metadata ─────────────────────────────────────────────────────────

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

// ─── Security-sensitive attribute names ──────────────────────────────────────

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
  aws_subnet: [
    'EC2 instances, RDS databases, or other resources deployed in this subnet will lose network access.',
  ],
  aws_security_group: [
    'Any resource (EC2, RDS, Lambda, etc.) referencing this security group will lose its firewall rules.',
    'Depending on remaining security groups, inbound/outbound traffic may be fully blocked.',
  ],
  aws_iam_role: [
    'Any AWS service that assumes this role (Lambda, EC2 instance profile, ECS task, etc.) will lose its permissions immediately.',
    'Failing permissions will typically surface as AccessDenied errors in your workloads.',
  ],
  aws_iam_policy: [
    'Any IAM role or user attached to this policy will lose the associated permissions.',
  ],
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
  aws_elasticache_cluster: [
    'The cache will be permanently lost. Applications depending on it may experience latency spikes or errors.',
  ],
  aws_eks_cluster: [
    'All Kubernetes workloads (pods, deployments, services) will be terminated.',
    'Any services exposed through this cluster will become unavailable.',
  ],
  aws_ecs_cluster: [
    'All ECS services and running tasks in this cluster will be stopped.',
  ],
  aws_lb: [
    'Any DNS records or applications pointing to this load balancer will stop working.',
    'Attached target groups will be orphaned.',
  ],
  aws_alb: [
    'Any DNS records or applications pointing to this ALB will stop working.',
  ],
  aws_route53_record: [
    'DNS resolution for this record will fail immediately, breaking any client that relies on this hostname.',
  ],
  aws_route53_zone: [
    'All DNS records in this hosted zone will stop resolving. This is a high-blast-radius operation.',
  ],
  aws_kms_key: [
    'Deletion is scheduled with a minimum 7-day window. Once deleted, all data encrypted with this key cannot be decrypted.',
    'S3 buckets, EBS volumes, and secrets encrypted with this key will lose access.',
  ],
  aws_secretsmanager_secret: [
    'Any application or Lambda function reading this secret will start failing immediately.',
  ],
  aws_ssm_parameter: [
    'Any application, script, or automation that reads this parameter will start failing.',
  ],
  google_compute_network: [
    'All subnetworks and VM instances in this network will be affected.',
  ],
  google_compute_instance: [
    'The VM will be terminated and all ephemeral storage will be lost.',
  ],
  azurerm_resource_group: [
    'ALL resources in this resource group will be deleted. This operation is irreversible.',
  ],
  azurerm_virtual_network: [
    'All subnets and connected resources will lose network connectivity.',
  ],
}

function getTailbreakRisks(type: string): string[] {
  return TAILBREAK_RISKS[type] ?? [
    'Deleting this resource may break dependent infrastructure or applications that rely on it.',
  ]
}

// ─── Value renderer ───────────────────────────────────────────────────────────

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
    if (val.length <= 5 && val.every(v => typeof v !== 'object' || v === null)) {
      return <span>{(val as unknown[]).map(v => v === null ? 'null' : String(v)).join(', ')}</span>
    }
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

// ─── Modal sub-components ─────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
      {children}
    </div>
  )
}

function NoAttrData() {
  return (
    <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
      Attribute data not available — re-run wafpass with a plan file using the latest version to see attribute-level details.
    </div>
  )
}

function AttrTable({ attrs, unknowns, skipNulls }: {
  attrs: Attrs | null | undefined
  unknowns?: Attrs | null
  skipNulls?: boolean
}) {
  if (attrs == null) return <NoAttrData />
  const entries = Object.entries(attrs)
    .filter(([, v]) => !skipNulls || v !== null)
    .sort(([a], [b]) => {
      const as = SECURITY_ATTRS.has(a), bs = SECURITY_ATTRS.has(b)
      if (as && !bs) return -1
      if (!as && bs) return 1
      return a.localeCompare(b)
    })
  if (!entries.length) return <div style={{ fontSize: '0.8rem', color: 'var(--muted)', fontStyle: 'italic' }}>No attributes to display.</div>
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
      <tbody>
        {entries.map(([key, val]) => (
          <tr key={key} style={{ borderTop: '1px solid var(--border)', background: SECURITY_ATTRS.has(key) ? 'rgba(217,119,6,.03)' : undefined }}>
            <td style={{ padding: '0.35rem 0.6rem', fontFamily: 'monospace', color: SECURITY_ATTRS.has(key) ? '#d97706' : 'var(--muted)', verticalAlign: 'top', whiteSpace: 'nowrap', width: '36%' }}>
              {SECURITY_ATTRS.has(key) && <span style={{ marginRight: '0.2rem' }}>⚠</span>}
              {key}
            </td>
            <td style={{ padding: '0.35rem 0.6rem', fontFamily: 'monospace', color: 'var(--text)', verticalAlign: 'top', wordBreak: 'break-word' }}>
              {renderAttrValue(val, unknowns?.[key] === true)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DiffTable({ before, after, afterUnknown }: {
  before: Attrs | null | undefined
  after: Attrs | null | undefined
  afterUnknown?: Attrs | null
}) {
  if (before == null && after == null) return <NoAttrData />

  const allKeys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  const changed: Array<{ key: string; before: unknown; after: unknown; isUnknown: boolean; isSecurity: boolean }> = []

  for (const key of allKeys) {
    const isUnknown = afterUnknown?.[key] === true
    const b = (before ?? {})[key]
    const a = (after ?? {})[key]
    if (isUnknown || JSON.stringify(b) !== JSON.stringify(a)) {
      changed.push({ key, before: b, after: a, isUnknown, isSecurity: SECURITY_ATTRS.has(key) })
    }
  }

  changed.sort((x, y) => {
    if (x.isSecurity && !y.isSecurity) return -1
    if (!x.isSecurity && y.isSecurity) return 1
    return x.key.localeCompare(y.key)
  })

  if (!changed.length) {
    return <div style={{ fontSize: '0.8rem', color: '#16a34a' }}>No attribute differences detected.</div>
  }

  const securityChanges = changed.filter(c => c.isSecurity)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      {securityChanges.length > 0 && (
        <div style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', background: 'rgba(217,119,6,.08)', border: '1px solid rgba(217,119,6,.2)', fontSize: '0.77rem', color: '#92400e' }}>
          <strong>⚠ Security-sensitive attributes changing:</strong>{' '}
          {securityChanges.map(c => c.key).join(', ')}
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
        <thead>
          <tr style={{ background: 'var(--bg)' }}>
            <th style={{ padding: '0.3rem 0.6rem', textAlign: 'left', color: 'var(--muted)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Attribute</th>
            <th style={{ padding: '0.3rem 0.6rem', textAlign: 'left', color: '#dc2626', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Before</th>
            <th style={{ padding: '0.3rem 0.6rem', textAlign: 'left', color: '#16a34a', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>After</th>
          </tr>
        </thead>
        <tbody>
          {changed.map(({ key, before: b, after: a, isUnknown, isSecurity }) => (
            <tr key={key} style={{ borderTop: '1px solid var(--border)', background: isSecurity ? 'rgba(217,119,6,.04)' : undefined }}>
              <td style={{ padding: '0.35rem 0.6rem', fontFamily: 'monospace', color: isSecurity ? '#d97706' : 'var(--muted)', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                {isSecurity && <span style={{ marginRight: '0.2rem' }}>⚠</span>}
                {key}
              </td>
              <td style={{ padding: '0.35rem 0.6rem', fontFamily: 'monospace', verticalAlign: 'top', wordBreak: 'break-word', background: 'rgba(220,38,38,.04)', borderRight: '2px solid rgba(220,38,38,.12)' }}>
                {renderAttrValue(b)}
              </td>
              <td style={{ padding: '0.35rem 0.6rem', fontFamily: 'monospace', verticalAlign: 'top', wordBreak: 'break-word', background: 'rgba(22,163,74,.04)' }}>
                {renderAttrValue(a, isUnknown)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TailbreakAlert({ type }: { type: string }) {
  const risks = getTailbreakRisks(type)
  return (
    <div style={{ padding: '0.7rem 0.85rem', borderRadius: '8px', background: 'rgba(220,38,38,.06)', border: '1px solid rgba(220,38,38,.22)', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#dc2626' }}>⚠ Potential tailbreaks</div>
      <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {risks.map((r, i) => (
          <li key={i} style={{ fontSize: '0.77rem', color: '#7f1d1d', lineHeight: 1.55 }}>{r}</li>
        ))}
      </ul>
    </div>
  )
}

// ─── Per-action detail panels ─────────────────────────────────────────────────

function CreateDetail({ after, afterUnknown }: { after: Attrs | null | undefined; afterUnknown?: Attrs | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', background: 'rgba(22,163,74,.07)', border: '1px solid rgba(22,163,74,.2)', fontSize: '0.77rem', color: '#14532d' }}>
        This resource will be <strong>created</strong>. The values below are what Terraform will apply. Attributes marked <em>(computed at apply)</em> will be assigned by the provider.
      </div>
      <div>
        <SectionLabel>Attributes to be created</SectionLabel>
        <AttrTable attrs={after} unknowns={afterUnknown} skipNulls />
      </div>
    </div>
  )
}

function UpdateDetail({ before, after, afterUnknown }: { before: Attrs | null | undefined; after: Attrs | null | undefined; afterUnknown?: Attrs | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', background: 'rgba(217,119,6,.07)', border: '1px solid rgba(217,119,6,.2)', fontSize: '0.77rem', color: '#78350f' }}>
        This resource will be <strong>updated in-place</strong> — no downtime from replacement. Only changed attributes are shown below.
      </div>
      <div>
        <SectionLabel>Changed attributes</SectionLabel>
        <DiffTable before={before} after={after} afterUnknown={afterUnknown} />
      </div>
    </div>
  )
}

function DeleteDetail({ before, type }: { before: Attrs | null | undefined; type: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <TailbreakAlert type={type} />
      <div>
        <SectionLabel>Current state (will be destroyed)</SectionLabel>
        {before !== undefined
          ? <AttrTable attrs={before} skipNulls />
          : <NoAttrData />
        }
      </div>
    </div>
  )
}

function ReplaceDetail({ before, after, afterUnknown, type }: { before: Attrs | null | undefined; after: Attrs | null | undefined; afterUnknown?: Attrs | null; type: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ padding: '0.55rem 0.75rem', borderRadius: '8px', background: 'rgba(124,58,237,.07)', border: '1px solid rgba(124,58,237,.2)', fontSize: '0.77rem', color: '#4c1d95' }}>
        <strong>Replace = Destroy + Create.</strong> The existing resource will be <strong>destroyed</strong> and a brand-new one created in its place. This typically causes downtime.
      </div>
      <TailbreakAlert type={type} />
      <div>
        <SectionLabel>Changed attributes</SectionLabel>
        <DiffTable before={before} after={after} afterUnknown={afterUnknown} />
      </div>
    </div>
  )
}

// ─── Change detail modal ──────────────────────────────────────────────────────

function ChangeDetailModal({ change, onClose }: { change: PlanChange; onClose: () => void }) {
  const { color, bg, label, icon } = actionMeta(change.action)
  const before = change.before as Attrs | null | undefined
  const after  = change.after  as Attrs | null | undefined
  const afterUnknown = change.after_unknown as Attrs | null | undefined

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 99 }}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '1560px', maxWidth: '95vw', maxHeight: '86vh',
        background: '#fff', borderRadius: '14px',
        boxShadow: '0 24px 64px rgba(15,23,42,.22)',
        display: 'flex', flexDirection: 'column', zIndex: 100, overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '2.1rem', height: '2.1rem', borderRadius: '7px',
            background: bg, color, fontFamily: 'monospace', fontWeight: 800, fontSize: '1.05rem', flexShrink: 0,
          }}>{icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'monospace', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)', wordBreak: 'break-all', lineHeight: 1.35 }}>
              {change.address}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ padding: '0.1rem 0.45rem', borderRadius: '999px', background: bg, color, fontSize: '0.64rem', fontWeight: 700 }}>{label}</span>
              <span style={{ padding: '0.1rem 0.45rem', borderRadius: '999px', background: 'var(--bg)', color: 'var(--muted)', fontSize: '0.64rem', fontWeight: 600, fontFamily: 'monospace' }}>{change.type}</span>
              {change.provider && (
                <span style={{ padding: '0.1rem 0.45rem', borderRadius: '999px', background: 'rgba(0,148,255,.08)', color: 'var(--waf-brand)', fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase' }}>{change.provider}</span>
              )}
              {change.module_address && (
                <span style={{ padding: '0.1rem 0.45rem', borderRadius: '999px', background: 'var(--bg)', color: 'var(--muted)', fontSize: '0.64rem', fontFamily: 'monospace' }}>module: {change.module_address}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.4rem', padding: '0 0.15rem', lineHeight: 1, flexShrink: 0 }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1.25rem' }}>
          {change.action === 'create'  && <CreateDetail  after={after} afterUnknown={afterUnknown} />}
          {change.action === 'update'  && <UpdateDetail  before={before} after={after} afterUnknown={afterUnknown} />}
          {change.action === 'delete'  && <DeleteDetail  before={before} type={change.type} />}
          {change.action === 'replace' && <ReplaceDetail before={before} after={after} afterUnknown={afterUnknown} type={change.type} />}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.65rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '0.4rem 1.1rem', borderRadius: '7px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
          >Close</button>
        </div>
      </div>
    </>
  )
}

// ─── Table row (now clickable) ────────────────────────────────────────────────

function ChangeRow({ change, onClick }: { change: PlanChange; onClick: () => void }) {
  const { color, bg, icon } = actionMeta(change.action)
  const hasModule = Boolean(change.module_address)

  return (
    <tr
      onClick={onClick}
      style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
    >
      <td style={{ padding: '0.65rem 0.75rem', width: '2.25rem', textAlign: 'center' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '1.5rem', height: '1.5rem', borderRadius: '5px',
          background: bg, color, fontFamily: 'monospace', fontWeight: 800, fontSize: '0.8rem',
        }}>
          {icon}
        </span>
      </td>
      <td style={{ padding: '0.65rem 0.5rem' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text)', fontWeight: 600 }}>
          {change.address}
        </div>
        {hasModule && (
          <div style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
            module: {change.module_address}
          </div>
        )}
      </td>
      <td style={{ padding: '0.65rem 0.5rem', whiteSpace: 'nowrap' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--muted)' }}>
          {change.type}
        </span>
      </td>
      <td style={{ padding: '0.65rem 0.5rem', whiteSpace: 'nowrap' }}>
        {change.provider && (
          <span style={{
            padding: '0.1rem 0.4rem', borderRadius: '999px',
            background: 'rgba(0,148,255,.08)', color: 'var(--waf-brand)',
            fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
          }}>
            {change.provider}
          </span>
        )}
      </td>
      <td style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap' }}>
        <span style={{
          padding: '0.15rem 0.5rem', borderRadius: '999px',
          background: bg, color, fontSize: '0.68rem', fontWeight: 700,
        }}>
          {actionMeta(change.action).label}
        </span>
      </td>
    </tr>
  )
}

// ─── Summary pill ─────────────────────────────────────────────────────────────

function SummaryPill({ count, action }: { count: number; action: string }) {
  const { label, color, bg, icon } = actionMeta(action)
  if (count === 0) return null
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '0.75rem 1.25rem', borderRadius: '12px',
      background: bg, border: `1px solid ${color}33`,
      minWidth: '90px',
    }}>
      <div style={{ fontSize: '1.875rem', fontWeight: 800, color, lineHeight: 1 }}>{count}</div>
      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginTop: '0.2rem' }}>
        <span style={{ marginRight: '0.25rem', fontFamily: 'monospace', fontWeight: 800 }}>{icon}</span>
        {label}
      </div>
    </div>
  )
}

// ─── Empty / no-data states ───────────────────────────────────────────────────

function NoChanges({ plan }: { plan: PlanChanges }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '3.5rem 2rem', gap: '1rem', textAlign: 'center',
    }}>
      <div style={{
        width: '3.5rem', height: '3.5rem', borderRadius: '50%',
        background: 'rgba(22,163,74,.1)', border: '2px solid rgba(22,163,74,.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg style={{ width: '1.75rem', height: '1.75rem', color: '#16a34a' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#16a34a' }}>No Infrastructure Changes</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginTop: '0.35rem' }}>
          This plan contains no resource additions, modifications, replacements, or deletions.
        </div>
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
        {plan.summary.no_op > 0 && (
          <span>{plan.summary.no_op} resource{plan.summary.no_op !== 1 ? 's' : ''} in state — all up to date</span>
        )}
      </div>
    </div>
  )
}

function NoPlanData({ run }: { run: RunDetail }) {
  const iacPath = run.path || run.source_paths?.[0] || '/path/to/terraform'
  const iac = run.iac_framework && run.iac_framework !== 'terraform' ? ` --iac ${run.iac_framework}` : ''
  const pushUrl = `${window.location.origin}`
  const [copied, setCopied] = useState(false)
  const cmd = `terraform plan -out=tfplan\nterraform show -json tfplan > plan.json\nwafpass check${iac} --output json --push ${pushUrl}/runs --plan-file plan.json ${iacPath}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '680px' }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
        padding: '1rem 1.1rem', borderRadius: '10px',
        background: 'rgba(148,163,184,.08)', border: '1px solid rgba(148,163,184,.2)',
      }}>
        <svg style={{ width: '1.1rem', height: '1.1rem', color: 'var(--muted)', flexShrink: 0, marginTop: '0.1rem' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.25rem' }}>
            No plan data for this run
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.6 }}>
            This run was submitted without a <code style={{ color: 'var(--text)' }}>--plan-file</code>.
            Re-run with a Terraform plan JSON to see resource change analysis here.
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
          How to include plan data
        </div>
        <div style={{ position: 'relative' }}>
          <pre style={{
            background: '#0f172a', color: '#e2e8f0', borderRadius: '8px',
            padding: '0.875rem 3rem 0.875rem 0.875rem', fontSize: '0.78rem',
            overflowX: 'auto', lineHeight: 1.8, margin: 0,
          }}>
            {cmd}
          </pre>
          <button
            onClick={() => navigator.clipboard.writeText(cmd).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })}
            style={{
              position: 'absolute', top: '0.5rem', right: '0.5rem',
              background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)',
              borderRadius: '5px', color: copied ? '#22c55e' : '#94a3b8',
              fontSize: '0.65rem', padding: '0.2rem 0.5rem', cursor: 'pointer',
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.7 }}>
        The plan file is produced by <code style={{ color: 'var(--text)' }}>terraform show -json</code>.
        It contains a machine-readable description of every resource that Terraform intends to add,
        change, replace, or destroy. WAF++ embeds this in the push payload so the dashboard can
        display a <strong style={{ color: 'var(--text)' }}>Change Overview</strong> alongside compliance findings.
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChangesPage({ run }: Props) {
  const plan = run.plan_changes

  const [actionFilter, setActionFilter]   = useState('')
  const [providerFilter, setProviderFilter] = useState('')
  const [search, setSearch]               = useState('')
  const [selected, setSelected]           = useState<PlanChange | null>(null)

  if (!plan) return (
    <div style={{ maxWidth: '780px', margin: '0 auto' }}>
      <NoPlanData run={run} />
    </div>
  )

  const totalChanges = (plan.summary.add ?? 0) + (plan.summary.change ?? 0)
    + (plan.summary.destroy ?? 0) + (plan.summary.replace ?? 0)

  const providers = Array.from(new Set(plan.changes.map(c => c.provider).filter(Boolean))).sort()

  const filtered = plan.changes.filter(c => {
    const actionMapped: Record<string, string> = { create: 'create', update: 'update', delete: 'delete', replace: 'replace' }
    if (actionFilter && actionMapped[c.action] !== actionFilter) return false
    if (providerFilter && c.provider !== providerFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!c.address.toLowerCase().includes(q) && !c.type.toLowerCase().includes(q)) return false
    }
    return true
  })

  const selectStyle = {
    background: '#fff', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.8rem', outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Modal */}
      {selected && <ChangeDetailModal change={selected} onClose={() => setSelected(null)} />}

      {/* Meta banner */}
      <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(0,148,255,.05)', border: '1px solid rgba(0,148,255,.15)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
        <div>
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>Terraform</span>
          {plan.terraform_version && <span style={{ marginLeft: '0.35rem', fontFamily: 'monospace' }}>v{plan.terraform_version}</span>}
        </div>
        {plan.scanned_at && (
          <div>Plan captured: <span style={{ color: 'var(--text)' }}>{new Date(plan.scanned_at).toLocaleString()}</span></div>
        )}
        <div style={{ marginLeft: 'auto', fontWeight: 600, color: totalChanges > 0 ? '#d97706' : '#16a34a' }}>
          {totalChanges === 0 ? 'No changes' : `${totalChanges} resource change${totalChanges !== 1 ? 's' : ''}`}
        </div>
      </div>

      {/* Summary strip */}
      {totalChanges === 0 ? (
        <div className="card" style={{ padding: 0 }}>
          <NoChanges plan={plan} />
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <SummaryPill count={plan.summary.add}     action="create"  />
            <SummaryPill count={plan.summary.change}  action="update"  />
            <SummaryPill count={plan.summary.replace} action="replace" />
            <SummaryPill count={plan.summary.destroy} action="delete"  />
            {plan.summary.no_op > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0.5rem 0.75rem', borderRadius: '10px', background: 'var(--bg)', border: '1px solid var(--border)', fontSize: '0.72rem', color: 'var(--muted)' }}>
                <span style={{ fontWeight: 700, color: 'var(--text)' }}>{plan.summary.no_op}</span>
                <span>unchanged</span>
              </div>
            )}
          </div>

          {/* Filter bar */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              placeholder="Search address or type…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ ...selectStyle, flex: '1', minWidth: '200px' }}
            />
            <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={selectStyle}>
              <option value="">All actions</option>
              <option value="create">Add</option>
              <option value="update">Change</option>
              <option value="replace">Replace</option>
              <option value="delete">Destroy</option>
            </select>
            {providers.length > 1 && (
              <select value={providerFilter} onChange={e => setProviderFilter(e.target.value)} style={selectStyle}>
                <option value="">All providers</option>
                {providers.map(p => <option key={p}>{p}</option>)}
              </select>
            )}
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
              {filtered.length} / {plan.changes.length}
            </span>
          </div>

          {/* Changes table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    <th style={{ padding: '0.6rem 0.75rem', width: '2.25rem' }} />
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Address</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type</th>
                    <th style={{ padding: '0.6rem 0.5rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Provider</th>
                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <ChangeRow key={i} change={c} onClick={() => setSelected(c)} />
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
                        No changes match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {filtered.length > 0 && (
              <div style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border)', fontSize: '0.7rem', color: 'var(--muted)' }}>
                Click any row to view detailed change information
              </div>
            )}
          </div>

          {/* Breakdown by type */}
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
                <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.875rem' }}>
                  Breakdown by Resource Type
                </h2>
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
