import { RunDetail } from '../api'
import { useI18n } from '../i18n'
import { Card, DataTable, EmptyState, type Column } from '../ui'
import PageHeader from '../ui/PageHeader'

interface Props { run: RunDetail | null }

interface SkipRow {
  id: string
  title: string
  type: string
  reason: string
  owner: string
  expiry: string | null
}

const TYPE_TONE: Record<string, { bg: string; fg: string }> = {
  Waiver: { bg: 'color-mix(in srgb, var(--waived) 15%, transparent)', fg: 'var(--waived)' },
  'Risk Acceptance': { bg: 'color-mix(in srgb, var(--waf-warn) 15%, transparent)', fg: 'var(--waf-warn)' },
}

export default function SkippedControlsPage({ run }: Props) {
  const { t } = useI18n()

  if (!run) {
    return <EmptyState title={t('pages.skippedControls.noRun')} />
  }

  const waivers = JSON.parse(localStorage.getItem('wombat_waivers') ?? '{}') as Record<string, any>
  const risks = JSON.parse(localStorage.getItem('wombat_risk_acceptances') ?? '{}') as Record<string, any>

  const findingsByControl = new Map<string, string[]>()
  for (const f of run.findings) {
    const statuses = findingsByControl.get(f.control_id) ?? []
    statuses.push(f.status?.toUpperCase() ?? '')
    findingsByControl.set(f.control_id, statuses)
  }

  const skippedControls = run.controls_meta.filter(ctrl => {
    const statuses = findingsByControl.get(ctrl.id)
    const isEngineSkip = !statuses || statuses.length === 0
    const isAllSkipped = statuses && statuses.length > 0 && statuses.every(s => s === 'SKIP' || s === 'WAIVED')
    const hasWaiver = !!waivers[ctrl.id]
    const hasRisk = !!risks[ctrl.id]
    return isEngineSkip || isAllSkipped || hasWaiver || hasRisk
  })

  const getSkipReason = (ctrlId: string) => {
    if (waivers[ctrlId]) return { type: 'Waiver', reason: waivers[ctrlId].reason, owner: waivers[ctrlId].owner, expiry: waivers[ctrlId].expires }
    if (risks[ctrlId]) return { type: 'Risk Acceptance', reason: risks[ctrlId].reason, owner: risks[ctrlId].owner, expiry: risks[ctrlId].expires }

    const statuses = findingsByControl.get(ctrlId)
    if (!statuses || statuses.length === 0) {
      return { type: 'Engine', reason: 'No matching resources found in Terraform configuration', owner: 'System', expiry: null }
    }
    const allMessages = run.findings.filter(f => f.control_id === ctrlId).map(f => f.message).filter(Boolean)
    return {
      type: 'Engine/Policy',
      reason: allMessages[0] || 'Control skipped by policy or unsupported operator',
      owner: 'System',
      expiry: null,
    }
  }

  const rows: SkipRow[] = skippedControls.map(ctrl => {
    const info = getSkipReason(ctrl.id)
    return {
      id: ctrl.id,
      title: ctrl.title,
      type: info.type,
      reason: info.reason,
      owner: info.owner,
      expiry: info.expiry ?? null,
    }
  })

  const columns: Column<SkipRow>[] = [
    { key: 'id', header: t('pages.skippedControls.colControl'), mono: true },
    { key: 'title', header: t('pages.skippedControls.colTitle') },
    {
      key: 'type',
      header: t('pages.skippedControls.colSkipType'),
      render: row => {
        const tone = TYPE_TONE[row.type]
        return (
          <span className="pill" style={{ background: tone?.bg ?? 'var(--bg)', color: tone?.fg ?? 'var(--muted)' }}>
            {row.type}
          </span>
        )
      },
    },
    { key: 'reason', header: t('pages.skippedControls.colReason') },
    { key: 'owner', header: t('pages.skippedControls.colOwner') },
    {
      key: 'expiry',
      header: t('pages.skippedControls.colExpiry'),
      render: row => row.expiry ?? '—',
    },
  ]

  return (
    <>
      <PageHeader
        title={t('pages.skippedControls.title')}
        description={t('pages.skippedControls.controlsOf', {
          skipped: String(skippedControls.length),
          total: String(run.controls_meta.length),
        })}
      />
      <Card padding="none">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={row => row.id}
          caption={t('pages.skippedControls.title')}
          empty={<EmptyState compact title={t('pages.skippedControls.noSkipped')} />}
        />
      </Card>
    </>
  )
}
