import { RunDetail } from '../api'
import { useI18n } from '../i18n'

interface Props { run: RunDetail | null }

export default function SkippedControlsPage({ run }: Props) {
  const { t } = useI18n()

  if (!run) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--muted)', fontSize: '0.85rem' }}>
        {t('pages.skippedControls.noRun')}
      </div>
    )
  }

  const waivers = JSON.parse(localStorage.getItem('wafpass_waivers') ?? '{}') as Record<string, any>
  const risks = JSON.parse(localStorage.getItem('wafpass_risk_acceptances') ?? '{}') as Record<string, any>

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
            {t('pages.skippedControls.title')}
            <span style={{ marginLeft: '0.75rem', fontWeight: 400, fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'none', letterSpacing: 0 }}>
              {t('pages.skippedControls.controlsOf', { skipped: String(skippedControls.length), total: String(run.controls_meta.length) })}
            </span>
          </h2>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {[
                  t('pages.skippedControls.colControl'),
                  t('pages.skippedControls.colTitle'),
                  t('pages.skippedControls.colSkipType'),
                  t('pages.skippedControls.colReason'),
                  t('pages.skippedControls.colOwner'),
                  t('pages.skippedControls.colExpiry'),
                ].map(h => (
                  <th key={h} style={{ padding: '0.65rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {skippedControls.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                    {t('pages.skippedControls.noSkipped')}
                  </td>
                </tr>
              ) : (
                skippedControls.map(ctrl => {
                  const info = getSkipReason(ctrl.id)
                  return (
                    <tr key={ctrl.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text)' }}>{ctrl.id}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text)' }}>{ctrl.title}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{
                          padding: '0.15rem 0.45rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700,
                          background: info.type === 'Waiver' ? 'rgba(167,139,250,0.15)' : info.type === 'Risk Acceptance' ? 'rgba(249,115,22,0.15)' : 'rgba(148,163,184,0.15)',
                          color: info.type === 'Waiver' ? '#a78bfa' : info.type === 'Risk Acceptance' ? '#f97316' : '#64748b',
                        }}>
                          {info.type}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text)' }}>{info.reason}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)' }}>{info.owner}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)' }}>{info.expiry || '—'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
