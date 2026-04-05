import { useState } from 'react'
import { RunDetail, WaiverRecord, RiskRecord } from '../api'
import { loadAuditLog, loadFirstSeen, AuditEvent, FirstSeenEntry } from '../audit'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  run: RunDetail | null
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface EvidenceConfig {
  preparedBy: string
  organization: string
  period: string
  notes: string
  frameworks: string[]
  includeWaivers: boolean
  includeRisks: boolean
  includeAuditLog: boolean
  includeFailingControls: boolean
}

const ALL_FRAMEWORKS = ['SOC2', 'ISO 27001', 'PCI-DSS', 'NIST CSF', 'CIS', 'GDPR', 'HIPAA']

// ─── Download helpers ─────────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Load waivers/risks from localStorage ────────────────────────────────────

function loadLocalWaivers(): WaiverRecord[] {
  try {
    const raw = localStorage.getItem('wafpass_waivers')
    if (!raw) return []
    const map = JSON.parse(raw) as Record<string, WaiverRecord>
    return Object.values(map)
  } catch { return [] }
}

function loadLocalRisks(): RiskRecord[] {
  try {
    const raw = localStorage.getItem('wafpass_risk_acceptances')
    if (!raw) return []
    const map = JSON.parse(raw) as Record<string, RiskRecord>
    return Object.values(map)
  } catch { return [] }
}

// ─── Score colour helper (inline for HTML gen) ────────────────────────────────

function scoreHex(s: number): string {
  return s >= 80 ? '#059669' : s >= 60 ? '#d97706' : '#dc2626'
}

// ─── Regulatory mapping for a control ────────────────────────────────────────

function regulatoryBadges(ctrl: RunDetail['controls_meta'][number]): string {
  if (!ctrl.regulatory_mapping?.length) return '<span style="color:#94a3b8;font-size:11px">—</span>'
  return ctrl.regulatory_mapping
    .map(m => `<span style="display:inline-block;margin:1px 2px;padding:1px 5px;border-radius:3px;background:#1e40af22;color:#3b82f6;font-size:10px;font-weight:600">${m.framework}: ${m.controls.slice(0, 2).join(', ')}${m.controls.length > 2 ? '…' : ''}</span>`)
    .join('')
}

// ─── HTML Report Generator ────────────────────────────────────────────────────

function generateHtml(
  run: RunDetail,
  cfg: EvidenceConfig,
  waivers: WaiverRecord[],
  risks: RiskRecord[],
  auditEvents: AuditEvent[],
  firstSeen: Record<string, FirstSeenEntry>,
): string {
  const now = new Date()
  const exportedAt = now.toISOString()
  const exportedAtHuman = now.toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'long' })
  const runDate = new Date(run.created_at).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })

  const allFindings = run.findings
  const passing = allFindings.filter(f => f.status?.toUpperCase() === 'PASS')
  const failing = allFindings.filter(f => f.status?.toUpperCase() === 'FAIL')

  // Controls with ALL checks passing
  const passingControlIds = new Set(
    run.controls_meta
      .filter(ctrl => {
        const ctrlFindings = allFindings.filter(f => f.control_id === ctrl.id)
        return ctrlFindings.length > 0 && ctrlFindings.every(f => f.status?.toUpperCase() === 'PASS')
      })
      .map(c => c.id)
  )

  const passingControls = run.controls_meta.filter(c => passingControlIds.has(c.id))
  const failingControls = run.controls_meta.filter(c => !passingControlIds.has(c.id) &&
    allFindings.some(f => f.control_id === c.id && f.status?.toUpperCase() === 'FAIL'))

  const frameworksHtml = cfg.frameworks.length
    ? cfg.frameworks.map(f => `<span style="display:inline-block;margin:2px 3px;padding:3px 10px;border-radius:12px;background:#1e40af18;border:1px solid #3b82f630;color:#2563eb;font-size:11px;font-weight:700">${f}</span>`).join('')
    : '<span style="color:#94a3b8;font-size:12px">None specified</span>'

  const waiversHtml = waivers.length === 0
    ? '<tr><td colspan="5" style="padding:20px;text-align:center;color:#94a3b8;font-size:12px">No active waivers</td></tr>'
    : waivers.map(w => `
      <tr style="border-top:1px solid #f1f5f9">
        <td style="padding:8px 10px;font-size:12px;font-family:monospace;color:#2563eb">${escHtml(w.id)}</td>
        <td style="padding:8px 10px;font-size:12px;color:#1e293b">${escHtml(w.reason)}</td>
        <td style="padding:8px 10px;font-size:12px;color:#475569">${escHtml(w.owner)}</td>
        <td style="padding:8px 10px;font-size:12px;color:#475569">${w.expires ? escHtml(w.expires) : '—'}</td>
        <td style="padding:8px 10px;font-size:12px;color:#94a3b8">${new Date(w.created_at).toLocaleDateString('en-GB')}</td>
      </tr>`).join('')

  const risksHtml = risks.length === 0
    ? '<tr><td colspan="6" style="padding:20px;text-align:center;color:#94a3b8;font-size:12px">No active risk acceptances</td></tr>'
    : risks.map(r => `
      <tr style="border-top:1px solid #f1f5f9">
        <td style="padding:8px 10px;font-size:12px;font-family:monospace;color:#7c3aed">${escHtml(r.id)}</td>
        <td style="padding:8px 10px;font-size:12px;color:#1e293b">${escHtml(r.reason)}</td>
        <td style="padding:8px 10px;font-size:12px;color:#475569">${escHtml(r.approver)}</td>
        <td style="padding:8px 10px">
          <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px;background:${r.risk_level === 'critical' ? '#dc262618' : r.risk_level === 'high' ? '#d9770618' : '#1e40af18'};color:${r.risk_level === 'critical' ? '#dc2626' : r.risk_level === 'high' ? '#d97706' : '#2563eb'}">
            ${escHtml(r.risk_level || '—')}
          </span>
        </td>
        <td style="padding:8px 10px;font-size:12px;color:#475569">${r.expires ? escHtml(r.expires) : '—'}</td>
        <td style="padding:8px 10px;font-size:12px;color:#94a3b8">${r.rfc ? escHtml(r.rfc) : '—'}</td>
      </tr>`).join('')

  const passingControlsHtml = passingControls.length === 0
    ? '<tr><td colspan="5" style="padding:20px;text-align:center;color:#94a3b8;font-size:12px">No controls with all checks passing in this run</td></tr>'
    : passingControls.map(ctrl => `
      <tr style="border-top:1px solid #f1f5f9">
        <td style="padding:8px 10px">
          <div style="font-size:11px;font-family:monospace;color:#059669;font-weight:600">${escHtml(ctrl.id)}</div>
          <div style="font-size:12px;color:#1e293b;margin-top:2px">${escHtml(ctrl.title)}</div>
        </td>
        <td style="padding:8px 10px;font-size:11px">
          <span style="padding:2px 6px;border-radius:4px;background:#f0fdf4;color:#059669;font-weight:600">${escHtml(ctrl.pillar)}</span>
        </td>
        <td style="padding:8px 10px;font-size:11px">
          <span style="padding:2px 6px;border-radius:4px;background:${ctrl.severity === 'critical' ? '#fef2f2' : ctrl.severity === 'high' ? '#fffbeb' : '#eff6ff'};color:${ctrl.severity === 'critical' ? '#dc2626' : ctrl.severity === 'high' ? '#d97706' : '#2563eb'};font-weight:600">
            ${escHtml(ctrl.severity)}
          </span>
        </td>
        <td style="padding:8px 10px;font-size:11px;color:#64748b">${allFindings.filter(f => f.control_id === ctrl.id && f.status?.toUpperCase() === 'PASS').length} checks</td>
        <td style="padding:8px 10px">${regulatoryBadges(ctrl)}</td>
      </tr>`).join('')

  const failingControlsSection = cfg.includeFailingControls ? `
    <h2 style="font-size:16px;font-weight:700;color:#dc2626;margin:32px 0 12px;padding-bottom:8px;border-bottom:2px solid #fecaca">
      Failing Controls (${failingControls.length})
    </h2>
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:13px">
      <thead>
        <tr style="background:#fef2f2">
          <th style="padding:10px 10px;text-align:left;font-size:11px;color:#dc2626;font-weight:700;text-transform:uppercase">Control</th>
          <th style="padding:10px 10px;text-align:left;font-size:11px;color:#dc2626;font-weight:700;text-transform:uppercase">Pillar</th>
          <th style="padding:10px 10px;text-align:left;font-size:11px;color:#dc2626;font-weight:700;text-transform:uppercase">Severity</th>
          <th style="padding:10px 10px;text-align:left;font-size:11px;color:#dc2626;font-weight:700;text-transform:uppercase">Failed checks</th>
        </tr>
      </thead>
      <tbody>
        ${failingControls.length === 0
          ? '<tr><td colspan="4" style="padding:20px;text-align:center;color:#94a3b8;font-size:12px">No failing controls</td></tr>'
          : failingControls.map(ctrl => `
            <tr style="border-top:1px solid #f1f5f9">
              <td style="padding:8px 10px">
                <div style="font-size:11px;font-family:monospace;color:#dc2626;font-weight:600">${escHtml(ctrl.id)}</div>
                <div style="font-size:12px;color:#1e293b;margin-top:2px">${escHtml(ctrl.title)}</div>
              </td>
              <td style="padding:8px 10px;font-size:11px">
                <span style="padding:2px 6px;border-radius:4px;background:#fef2f2;color:#dc2626;font-weight:600">${escHtml(ctrl.pillar)}</span>
              </td>
              <td style="padding:8px 10px;font-size:11px">
                <span style="padding:2px 6px;border-radius:4px;background:${ctrl.severity === 'critical' ? '#fef2f2' : ctrl.severity === 'high' ? '#fffbeb' : '#eff6ff'};color:${ctrl.severity === 'critical' ? '#dc2626' : ctrl.severity === 'high' ? '#d97706' : '#2563eb'};font-weight:600">
                  ${escHtml(ctrl.severity)}
                </span>
              </td>
              <td style="padding:8px 10px;font-size:12px;color:#dc2626;font-weight:600">
                ${allFindings.filter(f => f.control_id === ctrl.id && f.status?.toUpperCase() === 'FAIL').length} failing
              </td>
            </tr>`).join('')
        }
      </tbody>
    </table>` : ''

  const auditSection = cfg.includeAuditLog ? `
    <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin:32px 0 12px;padding-bottom:8px;border-bottom:2px solid #e2e8f0">
      Audit Log (last ${Math.min(auditEvents.length, 50)} events)
    </h2>
    <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:13px">
      <thead>
        <tr style="background:#f8fafc">
          <th style="padding:10px;text-align:left;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase">Time</th>
          <th style="padding:10px;text-align:left;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase">Category</th>
          <th style="padding:10px;text-align:left;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase">Action</th>
          <th style="padding:10px;text-align:left;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase">Actor</th>
          <th style="padding:10px;text-align:left;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase">Summary</th>
        </tr>
      </thead>
      <tbody>
        ${auditEvents.slice(0, 50).map(e => `
          <tr style="border-top:1px solid #f1f5f9">
            <td style="padding:7px 10px;font-size:11px;color:#94a3b8;white-space:nowrap">${new Date(e.timestamp).toLocaleString('en-GB')}</td>
            <td style="padding:7px 10px;font-size:11px;font-weight:700;color:${e.category === 'waiver' ? '#2563eb' : e.category === 'risk' ? '#7c3aed' : e.category === 'scan' ? '#059669' : '#d97706'}">${e.category}</td>
            <td style="padding:7px 10px;font-size:11px;color:#475569">${escHtml(e.action)}</td>
            <td style="padding:7px 10px;font-size:11px;color:#475569">${escHtml(e.actor)}</td>
            <td style="padding:7px 10px;font-size:12px;color:#1e293b">${escHtml(e.summary)}</td>
          </tr>`).join('')}
      </tbody>
    </table>` : ''

  const pillarScores = Object.entries(run.pillar_scores ?? {})

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WAF++ PASS — Evidence Package · ${escHtml(run.project || 'Unnamed Project')}</title>
<style>
  @media print {
    body { margin: 0; font-size: 11px; }
    .no-print { display: none !important; }
    h2 { page-break-before: auto; }
    table { page-break-inside: avoid; }
  }
  body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; background: #f8fafc; margin: 0; padding: 0; }
  .page { max-width: 1100px; margin: 0 auto; padding: 40px 48px; background: #fff; min-height: 100vh; box-shadow: 0 0 0 1px #e2e8f0; }
  .print-btn { position: fixed; top: 24px; right: 24px; padding: 10px 20px; background: #0094ff; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 700; box-shadow: 0 4px 12px #0094ff44; z-index: 9999; }
  .print-btn:hover { background: #0077cc; }
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
<div class="page">

  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:24px;border-bottom:3px solid #0094ff;margin-bottom:28px">
    <div>
      <div style="font-size:22px;font-weight:800;color:#0094ff;letter-spacing:-0.5px">WAF++ PASS</div>
      <div style="font-size:13px;color:#64748b;margin-top:2px">Compliance Evidence Package</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;font-weight:600">Exported</div>
      <div style="font-size:13px;color:#475569;margin-top:2px">${exportedAtHuman}</div>
    </div>
  </div>

  <!-- Package metadata -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:28px">
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px">
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:10px">Package Details</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr><td style="padding:4px 0;color:#64748b;width:120px">Prepared by</td><td style="padding:4px 0;font-weight:600;color:#1e293b">${escHtml(cfg.preparedBy || '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b">Organization</td><td style="padding:4px 0;font-weight:600;color:#1e293b">${escHtml(cfg.organization || '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b">Audit period</td><td style="padding:4px 0;color:#1e293b">${escHtml(cfg.period || '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b">Frameworks</td><td style="padding:4px 0">${frameworksHtml}</td></tr>
        ${cfg.notes ? `<tr><td style="padding:4px 0;color:#64748b;vertical-align:top">Notes</td><td style="padding:4px 0;color:#475569;font-size:12px">${escHtml(cfg.notes)}</td></tr>` : ''}
      </table>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px">
      <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:10px">Scan Run</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr><td style="padding:4px 0;color:#64748b;width:120px">Project</td><td style="padding:4px 0;font-weight:600;color:#1e293b">${escHtml(run.project || '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b">Branch</td><td style="padding:4px 0;color:#1e293b">${escHtml(run.branch || '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b">Git SHA</td><td style="padding:4px 0;font-family:monospace;font-size:11px;color:#475569">${escHtml(run.git_sha || '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b">IaC</td><td style="padding:4px 0;color:#1e293b">${escHtml(run.iac_framework || '—')}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b">Scanned at</td><td style="padding:4px 0;color:#1e293b">${runDate}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b">Run ID</td><td style="padding:4px 0;font-family:monospace;font-size:10px;color:#94a3b8">${escHtml(run.id)}</td></tr>
      </table>
    </div>
  </div>

  <!-- Score summary -->
  <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:28px">
    <div style="padding:16px 24px;background:#f0fdf4;border:1px solid #86efac;border-radius:10px;text-align:center;min-width:110px">
      <div style="font-size:32px;font-weight:800;color:${scoreHex(run.score)}">${run.score}</div>
      <div style="font-size:11px;color:#64748b;margin-top:2px;text-transform:uppercase;letter-spacing:.05em;font-weight:600">Overall Score</div>
    </div>
    <div style="padding:16px 24px;background:#f0fdf4;border:1px solid #86efac;border-radius:10px;text-align:center;min-width:90px">
      <div style="font-size:28px;font-weight:800;color:#059669">${passing.length}</div>
      <div style="font-size:11px;color:#64748b;margin-top:2px;text-transform:uppercase;font-weight:600">Passing checks</div>
    </div>
    <div style="padding:16px 24px;background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;text-align:center;min-width:90px">
      <div style="font-size:28px;font-weight:800;color:#dc2626">${failing.length}</div>
      <div style="font-size:11px;color:#64748b;margin-top:2px;text-transform:uppercase;font-weight:600">Failing checks</div>
    </div>
    <div style="padding:16px 24px;background:#f0fdf4;border:1px solid #86efac;border-radius:10px;text-align:center;min-width:90px">
      <div style="font-size:28px;font-weight:800;color:#059669">${passingControls.length}</div>
      <div style="font-size:11px;color:#64748b;margin-top:2px;text-transform:uppercase;font-weight:600">Controls passing</div>
    </div>
    <div style="padding:16px 24px;background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;text-align:center;min-width:90px">
      <div style="font-size:28px;font-weight:800;color:#dc2626">${failingControls.length}</div>
      <div style="font-size:11px;color:#64748b;margin-top:2px;text-transform:uppercase;font-weight:600">Controls failing</div>
    </div>
    ${pillarScores.map(([pillar, score]) => `
    <div style="padding:16px 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;text-align:center;min-width:80px">
      <div style="font-size:22px;font-weight:800;color:${scoreHex(score)}">${score}</div>
      <div style="font-size:10px;color:#64748b;margin-top:2px;text-transform:uppercase;letter-spacing:.04em;font-weight:600">${escHtml(pillar)}</div>
    </div>`).join('')}
  </div>

  <!-- Passing controls -->
  <h2 style="font-size:16px;font-weight:700;color:#059669;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #bbf7d0">
    Passing Controls (${passingControls.length})
    <span style="font-size:12px;font-weight:400;color:#64748b;margin-left:8px">All checks green — eligible for evidence submission</span>
  </h2>
  <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:13px;margin-bottom:24px">
    <thead>
      <tr style="background:#f0fdf4">
        <th style="padding:10px 10px;text-align:left;font-size:11px;color:#059669;font-weight:700;text-transform:uppercase">Control</th>
        <th style="padding:10px 10px;text-align:left;font-size:11px;color:#059669;font-weight:700;text-transform:uppercase">Pillar</th>
        <th style="padding:10px 10px;text-align:left;font-size:11px;color:#059669;font-weight:700;text-transform:uppercase">Severity</th>
        <th style="padding:10px 10px;text-align:left;font-size:11px;color:#059669;font-weight:700;text-transform:uppercase">Passing checks</th>
        <th style="padding:10px 10px;text-align:left;font-size:11px;color:#059669;font-weight:700;text-transform:uppercase">Regulatory mapping</th>
      </tr>
    </thead>
    <tbody>
      ${passingControlsHtml}
    </tbody>
  </table>

  ${failingControlsSection}

  <!-- Waivers -->
  ${cfg.includeWaivers ? `
  <h2 style="font-size:16px;font-weight:700;color:#2563eb;margin:32px 0 12px;padding-bottom:8px;border-bottom:2px solid #bfdbfe">
    Active Waivers (${waivers.length})
    <span style="font-size:12px;font-weight:400;color:#64748b;margin-left:8px">Suppressed controls acknowledged and signed off</span>
  </h2>
  <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:13px;margin-bottom:24px">
    <thead>
      <tr style="background:#eff6ff">
        <th style="padding:10px;text-align:left;font-size:11px;color:#2563eb;font-weight:700;text-transform:uppercase">Control ID</th>
        <th style="padding:10px;text-align:left;font-size:11px;color:#2563eb;font-weight:700;text-transform:uppercase">Reason</th>
        <th style="padding:10px;text-align:left;font-size:11px;color:#2563eb;font-weight:700;text-transform:uppercase">Owner</th>
        <th style="padding:10px;text-align:left;font-size:11px;color:#2563eb;font-weight:700;text-transform:uppercase">Expires</th>
        <th style="padding:10px;text-align:left;font-size:11px;color:#2563eb;font-weight:700;text-transform:uppercase">Created</th>
      </tr>
    </thead>
    <tbody>${waiversHtml}</tbody>
  </table>` : ''}

  <!-- Risk Acceptances -->
  ${cfg.includeRisks ? `
  <h2 style="font-size:16px;font-weight:700;color:#7c3aed;margin:32px 0 12px;padding-bottom:8px;border-bottom:2px solid #ddd6fe">
    Risk Acceptances (${risks.length})
    <span style="font-size:12px;font-weight:400;color:#64748b;margin-left:8px">Formally accepted residual risks with approver sign-off</span>
  </h2>
  <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;font-size:13px;margin-bottom:24px">
    <thead>
      <tr style="background:#f5f3ff">
        <th style="padding:10px;text-align:left;font-size:11px;color:#7c3aed;font-weight:700;text-transform:uppercase">ID</th>
        <th style="padding:10px;text-align:left;font-size:11px;color:#7c3aed;font-weight:700;text-transform:uppercase">Reason</th>
        <th style="padding:10px;text-align:left;font-size:11px;color:#7c3aed;font-weight:700;text-transform:uppercase">Approver</th>
        <th style="padding:10px;text-align:left;font-size:11px;color:#7c3aed;font-weight:700;text-transform:uppercase">Risk level</th>
        <th style="padding:10px;text-align:left;font-size:11px;color:#7c3aed;font-weight:700;text-transform:uppercase">Expires</th>
        <th style="padding:10px;text-align:left;font-size:11px;color:#7c3aed;font-weight:700;text-transform:uppercase">RFC</th>
      </tr>
    </thead>
    <tbody>${risksHtml}</tbody>
  </table>` : ''}

  ${auditSection}

  <!-- Embedded JSON -->
  <h2 style="font-size:16px;font-weight:700;color:#1e293b;margin:32px 0 12px;padding-bottom:8px;border-bottom:2px solid #e2e8f0">
    Machine-Readable Data
  </h2>
  <details style="background:#0f172a;border-radius:8px;padding:16px;margin-bottom:24px">
    <summary style="color:#94a3b8;font-size:12px;cursor:pointer;font-weight:600;letter-spacing:.03em;text-transform:uppercase">Expand embedded JSON manifest</summary>
    <pre style="margin:12px 0 0;color:#e2e8f0;font-size:11px;overflow-x:auto;white-space:pre-wrap;word-break:break-all">${escHtml(JSON.stringify({
      wafpass_evidence_package: '1.0',
      exported_at: exportedAt,
      prepared_by: cfg.preparedBy,
      organization: cfg.organization,
      audit_period: cfg.period,
      frameworks: cfg.frameworks,
      notes: cfg.notes,
      run: {
        id: run.id,
        project: run.project,
        branch: run.branch,
        git_sha: run.git_sha,
        iac_framework: run.iac_framework,
        created_at: run.created_at,
        score: run.score,
        pillar_scores: run.pillar_scores,
        controls_loaded: run.controls_loaded,
        controls_run: run.controls_run,
        passing_checks: passing.length,
        failing_checks: failing.length,
        path: run.path,
        triggered_by: run.triggered_by,
      },
      passing_controls: passingControls.map(c => ({
        id: c.id,
        title: c.title,
        pillar: c.pillar,
        severity: c.severity,
        regulatory_mapping: c.regulatory_mapping,
      })),
      failing_controls: failingControls.map(c => ({
        id: c.id,
        title: c.title,
        pillar: c.pillar,
        severity: c.severity,
      })),
      waivers: cfg.includeWaivers ? waivers : undefined,
      risk_acceptances: cfg.includeRisks ? risks : undefined,
      audit_events: cfg.includeAuditLog ? auditEvents.slice(0, 50) : undefined,
      first_seen_failures: cfg.includeAuditLog ? Object.values(firstSeen) : undefined,
    }, null, 2))}</pre>
  </details>

  <!-- Footer -->
  <div style="border-top:1px solid #e2e8f0;padding-top:20px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
    <div style="font-size:11px;color:#94a3b8;line-height:1.6;max-width:600px">
      <strong style="color:#64748b">Disclaimer:</strong> This evidence package was generated automatically by WAF++ PASS from scan data recorded on ${runDate}. It reflects the compliance posture of the scanned infrastructure at the time of the scan. This document does not constitute a formal security audit or certification. Consult a qualified assessor for compliance decisions.
    </div>
    <div style="text-align:right;flex-shrink:0">
      <div style="font-size:11px;color:#94a3b8">Generated by</div>
      <div style="font-size:13px;font-weight:700;color:#0094ff">WAF++ PASS v0.4.0</div>
    </div>
  </div>

</div>
</body>
</html>`
}

function escHtml(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ─── Checkbox row ─────────────────────────────────────────────────────────────

function CheckRow({ label, sub, checked, onChange }: { label: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer', padding: '0.5rem 0' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ marginTop: '2px', accentColor: 'var(--waf-brand)', flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1px' }}>{sub}</div>
      </div>
    </label>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EvidencePage({ run }: Props) {
  const [cfg, setCfg] = useState<EvidenceConfig>({
    preparedBy: '',
    organization: '',
    period: '',
    notes: '',
    frameworks: ['SOC2', 'ISO 27001'],
    includeWaivers: true,
    includeRisks: true,
    includeAuditLog: true,
    includeFailingControls: true,
  })
  const [exported, setExported] = useState(false)

  const waivers = loadLocalWaivers()
  const risks = loadLocalRisks()
  const auditEvents = loadAuditLog()
  const firstSeen = loadFirstSeen()

  const passingFindings = run ? run.findings.filter(f => f.status?.toUpperCase() === 'PASS') : []
  const failingFindings = run ? run.findings.filter(f => f.status?.toUpperCase() === 'FAIL') : []
  const passingControlCount = run
    ? run.controls_meta.filter(ctrl => {
        const cf = run.findings.filter(f => f.control_id === ctrl.id)
        return cf.length > 0 && cf.every(f => f.status?.toUpperCase() === 'PASS')
      }).length
    : 0

  function toggleFramework(fw: string) {
    setCfg(c => ({
      ...c,
      frameworks: c.frameworks.includes(fw)
        ? c.frameworks.filter(f => f !== fw)
        : [...c.frameworks, fw],
    }))
  }

  function handleExport() {
    if (!run) return
    const html = generateHtml(run, cfg, waivers, risks, auditEvents, firstSeen)
    const slug = run.project ? run.project.replace(/[^a-z0-9]/gi, '-').toLowerCase() : 'project'
    const date = new Date().toISOString().slice(0, 10)
    downloadBlob(html, `wafpass-evidence-${slug}-${date}.html`, 'text/html')
    setExported(true)
    setTimeout(() => setExported(false), 3000)
  }

  function handleExportJson() {
    if (!run) return
    const payload = {
      wafpass_evidence_package: '1.0',
      exported_at: new Date().toISOString(),
      prepared_by: cfg.preparedBy,
      organization: cfg.organization,
      audit_period: cfg.period,
      frameworks: cfg.frameworks,
      notes: cfg.notes,
      run: {
        id: run.id, project: run.project, branch: run.branch, git_sha: run.git_sha,
        iac_framework: run.iac_framework, created_at: run.created_at, score: run.score,
        pillar_scores: run.pillar_scores, controls_loaded: run.controls_loaded,
        controls_run: run.controls_run, path: run.path, triggered_by: run.triggered_by,
      },
      passing_controls: run.controls_meta.filter(c => {
        const cf = run.findings.filter(f => f.control_id === c.id)
        return cf.length > 0 && cf.every(f => f.status?.toUpperCase() === 'PASS')
      }),
      passing_findings: passingFindings,
      failing_controls: run.controls_meta.filter(c =>
        run.findings.some(f => f.control_id === c.id && f.status?.toUpperCase() === 'FAIL')
      ),
      failing_findings: failingFindings,
      waivers: cfg.includeWaivers ? waivers : undefined,
      risk_acceptances: cfg.includeRisks ? risks : undefined,
      audit_events: cfg.includeAuditLog ? auditEvents : undefined,
      first_seen_failures: cfg.includeAuditLog ? Object.values(firstSeen) : undefined,
    }
    const slug = run.project ? run.project.replace(/[^a-z0-9]/gi, '-').toLowerCase() : 'project'
    const date = new Date().toISOString().slice(0, 10)
    downloadBlob(JSON.stringify(payload, null, 2), `wafpass-evidence-${slug}-${date}.json`, 'application/json')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px',
    border: '1px solid var(--card-border)', background: 'var(--bg)',
    color: 'var(--text-primary)', fontSize: '0.82rem',
    boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.72rem', fontWeight: 700,
    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem',
  }
  const cardStyle: React.CSSProperties = {
    background: 'var(--card-bg)', border: '1px solid var(--card-border)',
    borderRadius: '12px', padding: '1.25rem 1.5rem',
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Intro banner */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '1rem',
        padding: '1rem 1.25rem', borderRadius: '10px',
        background: 'linear-gradient(135deg,rgba(5,150,105,.06) 0%,rgba(0,148,255,.05) 100%)',
        border: '1px solid rgba(5,150,105,.2)',
      }}>
        <div style={{
          flexShrink: 0, width: 36, height: 36, borderRadius: 9,
          background: 'rgba(5,150,105,.12)', border: '1px solid rgba(5,150,105,.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" fill="none" stroke="#059669" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
            Evidence Package Export
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Generate a timestamped, auditor-ready HTML report of your compliance posture — passing controls, active waivers, risk acceptances, and audit events. Open the exported file in any browser and print to PDF for submission.
          </div>
        </div>
      </div>

      {!run && (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px' }}>
          Select a scan run first to generate an evidence package.
        </div>
      )}

      {run && (
        <>
          {/* Two-column layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

            {/* Left — config */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Sign-off details */}
              <div style={cardStyle}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Sign-off Details
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Prepared by</label>
                    <input style={inputStyle} value={cfg.preparedBy} onChange={e => setCfg(c => ({ ...c, preparedBy: e.target.value }))} placeholder="Full name / role" />
                  </div>
                  <div>
                    <label style={labelStyle}>Organization</label>
                    <input style={inputStyle} value={cfg.organization} onChange={e => setCfg(c => ({ ...c, organization: e.target.value }))} placeholder="Company or team name" />
                  </div>
                  <div>
                    <label style={labelStyle}>Audit period</label>
                    <input style={inputStyle} value={cfg.period} onChange={e => setCfg(c => ({ ...c, period: e.target.value }))} placeholder="e.g. Q1 2026 / Jan–Mar 2026" />
                  </div>
                  <div>
                    <label style={labelStyle}>Notes (optional)</label>
                    <textarea
                      style={{ ...inputStyle, resize: 'vertical', minHeight: '4rem' }}
                      value={cfg.notes}
                      onChange={e => setCfg(c => ({ ...c, notes: e.target.value }))}
                      placeholder="Additional context for the auditor…"
                    />
                  </div>
                </div>
              </div>

              {/* Frameworks */}
              <div style={cardStyle}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                  Regulatory Frameworks
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {ALL_FRAMEWORKS.map(fw => (
                    <button
                      key={fw}
                      onClick={() => toggleFramework(fw)}
                      style={{
                        padding: '0.3rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600,
                        cursor: 'pointer', border: '1px solid',
                        background: cfg.frameworks.includes(fw) ? 'rgba(37,99,235,.12)' : 'transparent',
                        borderColor: cfg.frameworks.includes(fw) ? 'rgba(37,99,235,.4)' : 'var(--card-border)',
                        color: cfg.frameworks.includes(fw) ? '#2563eb' : 'var(--text-muted)',
                      }}
                    >
                      {fw}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right — contents + preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Package contents */}
              <div style={cardStyle}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                  Package Contents
                </div>
                <CheckRow
                  label={`Passing controls (${passingControlCount})`}
                  sub="Controls with all checks green — the core compliance evidence"
                  checked={true}
                  onChange={() => {}}
                />
                <div style={{ marginLeft: '1.6rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--waf-brand)', fontWeight: 600 }}>Always included</span>
                </div>
                <CheckRow
                  label={`Failing controls (${run.controls_meta.filter(c => run.findings.some(f => f.control_id === c.id && f.status?.toUpperCase() === 'FAIL')).length})`}
                  sub="Shows gaps — auditors expect full disclosure"
                  checked={cfg.includeFailingControls}
                  onChange={v => setCfg(c => ({ ...c, includeFailingControls: v }))}
                />
                <CheckRow
                  label={`Active waivers (${waivers.length})`}
                  sub="Suppressed controls with owner and expiry sign-off"
                  checked={cfg.includeWaivers}
                  onChange={v => setCfg(c => ({ ...c, includeWaivers: v }))}
                />
                <CheckRow
                  label={`Risk acceptances (${risks.length})`}
                  sub="Formally accepted risks with approver and RFC"
                  checked={cfg.includeRisks}
                  onChange={v => setCfg(c => ({ ...c, includeRisks: v }))}
                />
                <CheckRow
                  label={`Audit log (${Math.min(auditEvents.length, 50)} events)`}
                  sub="Tamper-evident event timeline — waivers, scans, risk changes"
                  checked={cfg.includeAuditLog}
                  onChange={v => setCfg(c => ({ ...c, includeAuditLog: v }))}
                />
                <CheckRow
                  label="Embedded JSON manifest"
                  sub="Machine-readable version of all data in the same HTML file"
                  checked={true}
                  onChange={() => {}}
                />
                <div style={{ marginLeft: '1.6rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--waf-brand)', fontWeight: 600 }}>Always included</span>
                </div>
              </div>

              {/* Snapshot of run being exported */}
              <div style={{ ...cardStyle, background: 'rgba(5,150,105,.04)', borderColor: 'rgba(5,150,105,.2)' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
                  Run snapshot
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '0.2rem' }}>
                  {run.project || 'Unnamed project'} · {run.branch || 'unknown branch'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: '0.5rem' }}>
                  {run.git_sha ? run.git_sha.slice(0, 12) : '—'} · {new Date(run.created_at).toLocaleString()}
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {[
                    { label: 'Score', value: `${run.score}/100`, color: run.score >= 80 ? '#059669' : run.score >= 60 ? '#d97706' : '#dc2626' },
                    { label: 'Passing', value: `${passingFindings.length} checks`, color: '#059669' },
                    { label: 'Failing', value: `${failingFindings.length} checks`, color: '#dc2626' },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Export buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleExport}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.65rem 1.5rem', borderRadius: '10px', border: 'none',
                background: 'var(--waf-brand)', color: '#fff',
                fontWeight: 700, fontSize: '0.88rem', cursor: 'pointer',
                boxShadow: '0 2px 12px rgba(0,148,255,.35)',
                transition: 'opacity .15s',
              }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {exported
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                }
              </svg>
              {exported ? 'Downloaded!' : 'Export HTML Report'}
            </button>

            <button
              onClick={handleExportJson}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.65rem 1.25rem', borderRadius: '10px',
                border: '1px solid var(--card-border)', background: 'var(--card-bg)',
                color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export JSON
            </button>

            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              HTML report: open in browser → Print → Save as PDF
            </div>
          </div>
        </>
      )}
    </div>
  )
}
