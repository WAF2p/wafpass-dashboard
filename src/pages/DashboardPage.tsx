import { useState } from 'react'
import {
  Bar, BarChart, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Finding, RunDetail } from '../api'

interface Props {
  run: RunDetail
  onNav?: (page: string) => void
  waiverCount?: number
  riskCount?: number
  runCount?: number
}

// ── Colour helpers ────────────────────────────────────────────────────────────

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: '#DA2C38',
  HIGH:     '#f97316',
  MEDIUM:   '#eab308',
  LOW:      '#22c55e',
}

const PILLAR_COLOR: Record<string, string> = {
  security:      '#DA2C38',
  operations:    '#0094FF',
  cost:          '#22c55e',
  reliability:   '#7c3aed',
  performance:   '#eab308',
  sustainability:'#0d9488',
  sovereignty:   '#0ea5e9',
}

const PROVIDER_COLOR: Record<string, string> = {
  aws: '#f97316', azure: '#2b7fff', gcp: '#22c55e',
  oci: '#c74634', alicloud: '#ff6a00', yandex: '#fcdb03',
}

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

function scoreColor(s: number) {
  return s >= 80 ? '#059669' : s >= 60 ? '#d97706' : '#DA2C38'
}

function scoreLabel(s: number) {
  return s >= 80 ? 'Good posture' : s >= 60 ? 'Needs attention' : 'High risk'
}

function hex(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`
}

function dateFmt(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return iso }
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const R = 54, C = 2 * Math.PI * R
  const arc = (score / 100) * C
  const color = scoreColor(score)
  return (
    <svg width="130" height="130" viewBox="0 0 130 130">
      <circle cx="65" cy="65" r={R} fill="none" stroke="var(--border)" strokeWidth="12" />
      <circle cx="65" cy="65" r={R} fill="none" stroke={color} strokeWidth="12"
        strokeDasharray={`${arc} ${C}`} strokeLinecap="round"
        transform="rotate(-90 65 65)"
        style={{ transition: 'stroke-dasharray 0.7s ease' }} />
      <text x="65" y="61" textAnchor="middle" fill={color} fontSize="30" fontWeight="800">{score}</text>
      <text x="65" y="78" textAnchor="middle" fill="#94a3b8" fontSize="12">/100</text>
    </svg>
  )
}

function SevBadge({ sev }: { sev: string }) {
  const c = SEVERITY_COLOR[sev] ?? '#94a3b8'
  return <span style={{ padding: '0.1rem 0.45rem', borderRadius: '999px', background: hex(c, 0.14), color: c, fontSize: '0.62rem', fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>{sev}</span>
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>{children}</div>
}

// ── Nav tile ──────────────────────────────────────────────────────────────────

interface TileProps {
  icon: React.ReactNode
  title: string
  value?: string | number
  sub?: string
  accent?: string
  alert?: boolean
  onClick?: () => void
}

function Tile({ icon, title, value, sub, accent = '#0094FF', alert, onClick }: TileProps) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${hov ? hex(accent, 0.4) : 'var(--border)'}`,
        borderRadius: '10px',
        padding: '0.875rem 1rem',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: hov ? `0 4px 12px ${hex(accent, 0.12)}` : '0 1px 3px rgba(15,23,42,.04)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
      }}
    >
      <div style={{ width: '1.875rem', height: '1.875rem', borderRadius: '7px', background: hex(accent, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: accent }}>
        {icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--text)' }}>{title}</span>
          {alert && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#DA2C38', display: 'inline-block', flexShrink: 0 }} />}
          {value !== undefined && value !== 0 && value !== '0' && (
            <span style={{ marginLeft: 'auto', fontSize: '0.78rem', fontWeight: 800, color: accent, whiteSpace: 'nowrap' }}>{value}</span>
          )}
        </div>
        {sub && <div style={{ fontSize: '0.7rem', color: 'var(--muted)', lineHeight: 1.35, marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
      </div>
    </div>
  )
}

// ── Auto-fix modal ────────────────────────────────────────────────────────────

type FixKind = 'auto' | 'manual'
interface FixEntry { checkId: string; controlId: string; resource: string; reason?: string; kind: FixKind }

const MANUAL_PATTERNS: { test: (id: string) => boolean; reason: string }[] = [
  { test: id => /s3.encryption|rds.encryption/i.test(id),    reason: 'requires adding an encryption block (structural change)' },
  { test: id => /no.open.sg|security.group/i.test(id),       reason: 'negation rule — safe replacement cannot be inferred automatically' },
  { test: id => /scp|organizations/i.test(id),               reason: 'requires creating a separate resource block' },
]

function classifyFinding(f: Finding): FixKind {
  return MANUAL_PATTERNS.some(p => p.test(f.check_id ?? '')) ? 'manual' : 'auto'
}

function manualReason(id: string): string {
  return MANUAL_PATTERNS.find(p => p.test(id))?.reason ?? 'no auto-fix recipe available'
}

function CopyBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ position: 'relative', marginTop: '0.25rem' }}>
      <pre style={{ background: '#0f172a', color: '#e2e8f0', borderRadius: '8px', padding: '0.75rem 3rem 0.75rem 0.875rem', fontSize: '0.78rem', overflowX: 'auto', lineHeight: 1.7, margin: 0 }}>{code}</pre>
      <button onClick={() => navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })}
        style={{ position: 'absolute', top: '0.4rem', right: '0.4rem', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', borderRadius: '5px', color: copied ? '#22c55e' : '#94a3b8', fontSize: '0.65rem', padding: '0.15rem 0.45rem', cursor: 'pointer' }}>
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}

function AutoFixModal({ run, findings, scopeLabel, onClose }: { run: RunDetail; findings: Finding[]; scopeLabel: string; onClose: () => void }) {
  const iacPath = run.path || run.source_paths?.[0] || '/path/to/terraform'
  const iac = run.iac_framework && run.iac_framework !== 'terraform' ? run.iac_framework : null
  const entries: FixEntry[] = findings.map(f => ({ checkId: f.check_id, controlId: f.control_id, resource: f.resource, kind: classifyFinding(f), reason: classifyFinding(f) === 'manual' ? manualReason(f.check_id) : undefined }))
  const autoE = entries.filter(e => e.kind === 'auto')
  const manE  = entries.filter(e => e.kind === 'manual')
  const ctrlIds = Array.from(new Set(autoE.map(e => e.controlId).filter(Boolean)))
  const iacFlag = iac ? ` \\\n  --iac ${iac}` : ''
  const ctrlsFlag = ctrlIds.length > 0 && ctrlIds.length < findings.length ? ` \\\n  --controls "${ctrlIds.join(',')}"` : ''
  const dryRun = `wafpass fix${iacFlag} \\\n  ${iacPath}`
  const apply  = `wafpass fix${iacFlag}${ctrlsFlag} \\\n  --apply \\\n  ${iacPath}`
  const manByR = manE.reduce<Record<string, FixEntry[]>>((a, e) => { const k = e.reason ?? 'no recipe'; (a[k] ??= []).push(e); return a }, {})

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 99 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '720px', maxWidth: '94vw', maxHeight: '88vh', background: '#fff', borderRadius: '14px', boxShadow: '0 24px 64px rgba(15,23,42,.2)', display: 'flex', flexDirection: 'column', zIndex: 100, overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.25rem 1rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>Auto-Fix CLI Commands
                <span style={{ marginLeft: '0.5rem', background: 'rgba(234,88,12,.12)', color: '#c2410c', fontSize: '0.55rem', fontWeight: 800, padding: '0.1rem 0.35rem', borderRadius: '3px' }}>α</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '0.3rem' }}>
                Scope: <strong style={{ color: 'var(--text)' }}>{scopeLabel}</strong>
                {' · '}<span style={{ color: '#16a34a', fontWeight: 600 }}>{autoE.length} auto-fixable</span>
                {manE.length > 0 && <span style={{ color: 'var(--muted)' }}> · {manE.length} manual</span>}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.1rem', padding: '0.2rem' }}>✕</button>
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ background: 'rgba(0,148,255,.06)', border: '1px solid rgba(0,148,255,.2)', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.6 }}>
            Run the commands below where your IaC source lives. The dry-run shows a diff without touching files. Add <code style={{ color: 'var(--waf-brand)' }}>--apply</code> to write patches — a <code style={{ color: 'var(--waf-brand)' }}>.tf.bak</code> backup is created automatically.
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>1 · Preview (dry-run)</div>
            <CopyBlock code={dryRun} />
          </div>
          {autoE.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>2 · Apply patches</div>
              <CopyBlock code={apply} />
            </div>
          )}
          {autoE.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Auto-fixable ({autoE.length})</div>
              {autoE.map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.6rem', borderRadius: '7px', background: 'rgba(22,163,74,.05)', border: '1px solid rgba(22,163,74,.15)', marginBottom: '0.25rem' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--muted)', flexShrink: 0 }}>{e.controlId}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.resource}</span>
                </div>
              ))}
            </div>
          )}
          {manE.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>Manual review ({manE.length})</div>
              {Object.entries(manByR).map(([reason, items]) => (
                <div key={reason} style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#b45309', marginBottom: '0.3rem' }}>{reason}</div>
                  {items.map((e, i) => <div key={i} style={{ display: 'flex', gap: '0.6rem', fontSize: '0.72rem', paddingLeft: '1rem' }}><span style={{ fontFamily: 'monospace', color: 'var(--muted)', flexShrink: 0 }}>{e.controlId}</span><span style={{ fontFamily: 'monospace', color: 'var(--text)' }}>{e.resource}</span></div>)}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.45rem 1.1rem', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </>
  )
}

// ── SVG icons ─────────────────────────────────────────────────────────────────

const I: Record<string, React.ReactNode> = {
  shield:  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  list:    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  bolt:    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  check:   <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  globe:   <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 004 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" /></svg>,
  warning: <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  fire:    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>,
  key:     <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>,
  dollar:  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  history: <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  diff:    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>,
  log:     <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  play:    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  code:    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
  waiver:  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
  risk:    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  drift:   <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
  sprint:  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  module:  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
  blast:   <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></svg>,
  dep:     <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>,
  exploit: <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  gap:     <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  evidence:<svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V8.586a1 1 0 00-.293-.707l-4.586-4.586A1 1 0 0014.414 3H8zm6 0v4h4M10 12h4m-4 4h2" /></svg>,
  skip:    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>,
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function DashboardPage({ run, onNav, waiverCount = 0, riskCount = 0, runCount = 0 }: Props) {
  const findings = run.findings
  const [autoFix, setAutoFix] = useState<{ findings: Finding[]; scopeLabel: string } | null>(null)

  // ── Control-level aggregation ─────────────────────────────────────────────
  const controlIds = Array.from(new Set(findings.map(f => f.control_id).filter(Boolean)))
  let ctrlPass = 0, ctrlFail = 0, ctrlSkip = 0, ctrlWaived = 0
  for (const cid of controlIds) {
    const statuses = findings.filter(f => f.control_id === cid).map(f => f.status?.toUpperCase())
    if (statuses.some(s => s === 'WAIVED')) { ctrlWaived++; continue }
    if (statuses.some(s => s === 'FAIL'))   { ctrlFail++;   continue }
    if (statuses.every(s => s === 'PASS'))  { ctrlPass++;   continue }
    ctrlSkip++
  }

  const totalChecks   = findings.length
  const passChecks    = findings.filter(f => f.status?.toUpperCase() === 'PASS').length
  const passRate      = totalChecks > 0 ? Math.round((passChecks / totalChecks) * 100) : 0
  const resources     = new Set(findings.map(f => f.resource).filter(Boolean)).size
  const failResources = new Set(findings.filter(f => f.status?.toUpperCase() === 'FAIL').map(f => f.resource).filter(Boolean)).size

  const allFails      = findings.filter(f => f.status?.toUpperCase() === 'FAIL')
  const critFails     = allFails.filter(f => f.severity?.toUpperCase() === 'CRITICAL')
  const highFails     = allFails.filter(f => f.severity?.toUpperCase() === 'HIGH')
  const critHighFails = allFails.filter(f => ['CRITICAL', 'HIGH'].includes(f.severity?.toUpperCase())).slice(0, 5)

  const severityCounts = SEVERITIES
    .map(s => ({ name: s, value: allFails.filter(f => f.severity?.toUpperCase() === s).length }))
    .filter(d => d.value > 0)

  const pillarData = Object.entries(run.pillar_scores).map(([p, s]) => ({ pillar: p, score: s }))

  const detectedRegions = run.detected_regions ?? []
  const providerCounts  = detectedRegions.reduce<Record<string, number>>((acc, [, prov]) => {
    if (prov) acc[prov] = (acc[prov] ?? 0) + 1; return acc
  }, {})
  const providerNames = Object.keys(providerCounts)

  const secretFindings     = run.secret_findings ?? []
  const secretUnsuppressed = secretFindings.filter(s => !s.suppressed).length
  const secretCritical     = secretFindings.filter(s => s.severity === 'critical').length

  const planChanges = run.plan_changes
  const changeDelta = planChanges
    ? planChanges.summary.add + planChanges.summary.change + planChanges.summary.destroy + planChanges.summary.replace
    : 0

  // ── Regulatory readiness ─────────────────────────────────────────────────
  const fwMap = new Map<string, { pass: number; total: number }>()
  for (const ctrl of run.controls_meta) {
    const ctrlFindings = findings.filter(f => f.control_id === ctrl.id)
    if (!ctrlFindings.length) continue
    const ctrlPasses = ctrlFindings.every(f => f.status?.toUpperCase() === 'PASS')
    for (const rm of ctrl.regulatory_mapping) {
      const e = fwMap.get(rm.framework) ?? { pass: 0, total: 0 }
      e.total++
      if (ctrlPasses) e.pass++
      fwMap.set(rm.framework, e)
    }
  }
  const regulatoryAll = Array.from(fwMap.entries())
    .map(([fw, { pass, total }]) => ({ fw, pass, total, pct: total > 0 ? Math.round((pass / total) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct)
  const regulatoryTop = regulatoryAll.slice(0, 6)
  const avgCompliance  = regulatoryAll.length > 0
    ? Math.round(regulatoryAll.reduce((s, r) => s + r.pct, 0) / regulatoryAll.length)
    : 0

  // ── Pillar health ────────────────────────────────────────────────────────
  const pillarHealth = pillarData.map(({ pillar, score }) => {
    const pf    = findings.filter(f => f.pillar === pillar)
    const fails = pf.filter(f => f.status?.toUpperCase() === 'FAIL').length
    return { pillar, score, fails, total: pf.length }
  }).sort((a, b) => a.score - b.score)

  // ── Heatmap ─────────────────────────────────────────────────────────────
  const pillars = Array.from(new Set(findings.map(f => f.pillar).filter((p): p is string => Boolean(p)))).sort()
  const heatmap = pillars.flatMap(p => SEVERITIES.map(s => ({
    pillar: p, severity: s,
    count: allFails.filter(f => f.pillar === p && f.severity?.toUpperCase() === s).length,
  })))
  const heatMax = heatmap.reduce((m, c) => Math.max(m, c.count), 1)

  // ── Quick wins ───────────────────────────────────────────────────────────
  const SWEIGHT: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
  const quickWins = [...allFails]
    .sort((a, b) => (SWEIGHT[b.severity?.toUpperCase() ?? ''] ?? 0) - (SWEIGHT[a.severity?.toUpperCase() ?? ''] ?? 0))
    .slice(0, 6)

  // ── Navigation group helper ──────────────────────────────────────────────
  function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div>
        <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '0.5rem', paddingLeft: '0.1rem' }}>{label}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>{children}</div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ══════════════════════════════════════════════════════════════════
          1. HERO — score + metadata + 5 KPIs
      ══════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '1rem', alignItems: 'stretch' }}>

        {/* Score card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', minWidth: '160px', background: hex(scoreColor(run.score), 0.03), borderColor: hex(scoreColor(run.score), 0.2) }}>
          <ScoreGauge score={run.score} />
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: scoreColor(run.score) }}>{scoreLabel(run.score)}</div>
        </div>

        {/* Metadata + KPIs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Run metadata row */}
          <div className="card" style={{ padding: '0.875rem 1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.3rem' }}>
                  {run.project || 'Infrastructure Scan'}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center' }}>
                  {run.branch && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.28rem', padding: '0.15rem 0.5rem', borderRadius: '999px', background: 'rgba(0,148,255,.1)', color: 'var(--waf-brand)', fontSize: '0.7rem', fontWeight: 600 }}>
                      <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zm-12 0a3 3 0 100 6 3 3 0 000-6zm0 0h12" /></svg>
                      {run.branch}
                    </span>
                  )}
                  {run.iac_framework && <span style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', background: '#f1f5f9', color: 'var(--muted)', fontSize: '0.7rem', fontWeight: 600, textTransform: 'capitalize' }}>{run.iac_framework}</span>}
                  {run.created_at && <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{dateFmt(run.created_at)}</span>}
                  {run.controls_loaded > 0 && <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{run.controls_loaded} controls loaded</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {onNav && <>
                  <button onClick={() => onNav('findings')} style={{ padding: '0.38rem 0.875rem', borderRadius: '7px', border: '1px solid rgba(218,44,56,.35)', background: 'rgba(218,44,56,.07)', color: '#DA2C38', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}>View Findings</button>
                  <button onClick={() => onNav('runscan')} style={{ padding: '0.38rem 0.875rem', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}>New Scan</button>
                </>}
              </div>
            </div>
          </div>

          {/* 5 KPI chips */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
            {([
              { n: ctrlFail,                  label: 'Failed Controls',   c: '#DA2C38' },
              { n: critFails.length + highFails.length, label: 'Crit + High', c: '#f97316' },
              { n: failResources,             label: 'Resources at Risk', c: '#d97706' },
              { n: waiverCount,               label: 'Active Waivers',    c: '#7c3aed' },
              { n: `${avgCompliance}%`,       label: 'Avg Compliance',    c: '#059669' },
            ] as { n: string | number; label: string; c: string }[]).map(({ n, label, c }) => (
              <div key={label} className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0.75rem 0.5rem', background: hex(c, 0.05), borderColor: hex(c, 0.2) }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: c, lineHeight: 1 }}>{n}</div>
                <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--muted)', marginTop: '0.25rem', lineHeight: 1.3 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          2. IMMEDIATE ATTENTION — critical / high failures only
      ══════════════════════════════════════════════════════════════════ */}
      {critHighFails.length > 0 && (
        <div className="card" style={{ borderColor: 'rgba(218,44,56,.2)', background: 'rgba(218,44,56,.02)', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '7px', background: 'rgba(218,44,56,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DA2C38', flexShrink: 0 }}>{I.warning}</div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)' }}>Requires Immediate Attention</div>
                <div style={{ fontSize: '0.71rem', color: 'var(--muted)' }}>Critical &amp; high severity findings — address before next deployment</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setAutoFix({ findings: critHighFails, scopeLabel: 'critical & high failures' })}
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.32rem 0.7rem', borderRadius: '6px', border: '1px solid rgba(0,148,255,.3)', background: 'rgba(0,148,255,.07)', color: 'var(--waf-brand)', fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer' }}>
                {I.bolt} Auto-Fix
                <span style={{ background: 'rgba(234,88,12,.12)', color: '#c2410c', fontSize: '0.48rem', fontWeight: 800, padding: '0.05rem 0.28rem', borderRadius: '3px' }}>α</span>
              </button>
              {onNav && <button onClick={() => onNav('findings')} style={{ padding: '0.32rem 0.7rem', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '0.73rem', fontWeight: 600, cursor: 'pointer' }}>All findings →</button>}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {critHighFails.map((f, i) => {
              const sev = f.severity?.toUpperCase()
              return (
                <div key={i}
                  onClick={() => setAutoFix({ findings: findings.filter(x => x.control_id === f.control_id && x.status?.toUpperCase() === 'FAIL'), scopeLabel: f.control_id })}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.6rem 0.75rem', borderRadius: '8px', background: 'var(--surface)', border: '1px solid rgba(218,44,56,.1)', cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(218,44,56,.3)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(218,44,56,.1)' }}
                >
                  <SevBadge sev={sev} />
                  <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--muted)', flexShrink: 0 }}>{f.control_id}</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.check_title}</span>
                  {f.pillar && <span style={{ padding: '0.1rem 0.4rem', borderRadius: '999px', background: hex(PILLAR_COLOR[f.pillar] ?? '#888', 0.12), color: PILLAR_COLOR[f.pillar] ?? '#888', fontSize: '0.62rem', fontWeight: 600, textTransform: 'capitalize', flexShrink: 0 }}>{f.pillar}</span>}
                  <span style={{ fontSize: '0.68rem', color: 'var(--waf-brand)', fontWeight: 600, flexShrink: 0 }}>Fix →</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          3. NAVIGATION OVERVIEW — entry to every section
      ══════════════════════════════════════════════════════════════════ */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: '1.1rem' }}>Navigate the Dashboard</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          <NavGroup label="Analysis & Risk">
            <Tile icon={I.list}    title="Findings"         value={allFails.length > 0 ? allFails.length : undefined}  sub={`${passRate}% pass rate · ${totalChecks} checks`}                  accent="#DA2C38" alert={allFails.length > 0}                       onClick={() => onNav?.('findings')} />
            <Tile icon={I.check}   title="Compliance"       value={`${avgCompliance}%`}                                 sub={`${regulatoryAll.length} frameworks mapped`}                        accent="#0094FF"                                                   onClick={() => onNav?.('compliance')} />
            <Tile icon={I.gap}     title="Gap Analysis"     value={allFails.length > 0 ? `${new Set(allFails.map(f => f.control_id)).size} gaps` : undefined} sub="Controls ranked by effort-per-requirement"           accent="#7c3aed"                                                   onClick={() => onNav?.('gapanalysis')} />
            <Tile icon={I.exploit} title="Exploit Paths"    sub="Attack chain visualization"                            accent="#DA2C38"                                                                                                                           onClick={() => onNav?.('exploitpath')} />
            <Tile icon={I.blast}   title="Blast Radius"     value={failResources > 0 ? failResources : undefined}       sub="Structural impact of failing resources"                             accent="#f97316"                                                   onClick={() => onNav?.('blastradius')} />
            <Tile icon={I.dep}     title="Dep. Graph"        sub="Full resource dependency topology"                    accent="#0d9488"                                                                                                                           onClick={() => onNav?.('depgraph')} />
          </NavGroup>

          <NavGroup label="Infrastructure">
            <Tile icon={I.shield}  title="Controls Catalogue" value={run.controls_loaded || run.controls_meta?.length || 0} sub={`${pillarHealth.length} pillars covered`}                      accent="#0094FF"                                                   onClick={() => onNav?.('catalogue')} />
            <Tile icon={I.globe}   title="Deployed Regions"  value={detectedRegions.length > 0 ? `${detectedRegions.length} regions` : undefined} sub={detectedRegions.length > 0 ? providerNames.map(p => p.toUpperCase()).join(', ') : 'Cloud footprint map'}  accent="#0ea5e9"  onClick={() => onNav?.('regions')} />
            <Tile icon={I.key}     title="Secret Scanner"    value={secretUnsuppressed > 0 ? secretUnsuppressed : undefined} sub={secretFindings.length > 0 ? `${secretCritical} critical detected` : 'Detect hardcoded credentials'}  accent="#DA2C38" alert={secretCritical > 0}  onClick={() => onNav?.('secrets')} />
            <Tile icon={I.module}  title="Module Scores"     sub="Per-module compliance breakdown"                       accent="#7c3aed"                                                                                                                           onClick={() => onNav?.('modules')} />
            <Tile icon={I.dollar}  title="Cost Impact"       sub="Failing WAF-COST control estimates"                    accent="#22c55e"                                                                                                                           onClick={() => onNav?.('cost')} />
            <Tile icon={I.drift}   title="Changes & Drift"   value={changeDelta > 0 ? changeDelta : undefined}           sub="Plan changes and regression detection"                              accent="#f97316"                                                   onClick={() => onNav?.('changes')} />
          </NavGroup>

          <NavGroup label="Risk & Governance">
            <Tile icon={I.waiver}  title="Waivers"           value={waiverCount > 0 ? waiverCount : undefined}           sub="Active control waivers · export to YAML"                            accent="#7c3aed"                                                   onClick={() => onNav?.('waivers')} />
            <Tile icon={I.risk}    title="Risk Acceptance"   value={riskCount > 0 ? riskCount : undefined}               sub="Formal acceptances with approver trail"                             accent="#f97316"                                                   onClick={() => onNav?.('risk')} />
            <Tile icon={I.sprint}  title="Remediation Sprint" sub="Prioritized fix queue with effort estimate"            accent="#22c55e"                                                                                                                           onClick={() => onNav?.('remediation')} />
            <Tile icon={I.skip}    title="Skipped Controls"  value={ctrlSkip > 0 ? ctrlSkip : undefined}                 sub="Coverage gaps and exclusions"                                       accent="#64748b"                                                   onClick={() => onNav?.('skipped')} />
          </NavGroup>

          <NavGroup label="History, Audit & Tools">
            <Tile icon={I.history} title="Run History"       value={runCount > 0 ? `${runCount} runs` : undefined}       sub="Score trends over time"                                             accent="#0094FF"                                                   onClick={() => onNav?.('runs')} />
            <Tile icon={I.diff}    title="Run Comparison"    sub="Side-by-side diff of two scans"                        accent="#7c3aed"                                                                                                                           onClick={() => onNav?.('diff')} />
            <Tile icon={I.log}     title="Audit Log"         sub="Tamper-evident action record"                          accent="#64748b"                                                                                                                           onClick={() => onNav?.('audit')} />
            <Tile icon={I.evidence}title="Evidence Package"  sub="Auditor-ready export bundle"                           accent="#0094FF"                                                                                                                           onClick={() => onNav?.('evidence')} />
            <Tile icon={I.play}    title="Run Scan"          sub="Trigger a scan from the browser"                       accent="#22c55e"                                                                                                                           onClick={() => onNav?.('runscan')} />
            <Tile icon={I.code}    title="Sandbox"           sub="Evaluate Terraform snippets live"                      accent="#0094FF"                                                                                                                           onClick={() => onNav?.('sandbox')} />
          </NavGroup>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          4. PILLAR HEALTH — compact scoreboard
      ══════════════════════════════════════════════════════════════════ */}
      {pillarHealth.length > 0 && (
        <div className="card">
          <CardLabel>Pillar Health</CardLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: '0.6rem' }}>
            {pillarHealth.map(({ pillar, score, fails, total }) => {
              const pColor = PILLAR_COLOR[pillar] ?? '#888'
              const sColor = scoreColor(score)
              const pct    = total > 0 ? Math.round(((total - fails) / total) * 100) : 100
              return (
                <div key={pillar}
                  onClick={() => onNav?.('findings')}
                  style={{ padding: '0.75rem', borderRadius: '9px', border: `1px solid ${hex(pColor, 0.2)}`, background: hex(pColor, 0.03), cursor: onNav ? 'pointer' : 'default', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = hex(pColor, 0.4) }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = hex(pColor, 0.2) }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ padding: '0.12rem 0.45rem', borderRadius: '999px', background: hex(pColor, 0.14), color: pColor, fontSize: '0.65rem', fontWeight: 700, textTransform: 'capitalize' }}>{pillar}</span>
                    <span style={{ fontSize: '1.125rem', fontWeight: 800, color: sColor }}>{score}</span>
                  </div>
                  <div style={{ height: '5px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden', marginBottom: '0.4rem' }}>
                    <div style={{ height: '100%', borderRadius: '999px', background: sColor, width: `${pct}%`, transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ fontSize: '0.68rem', color: fails > 0 ? '#DA2C38' : '#059669', fontWeight: 600 }}>
                    {fails > 0 ? `${fails} failing` : 'All passing'}
                    <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{total > 0 ? ` of ${total} checks` : ''}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          5. CHARTS — severity + pillar scores
      ══════════════════════════════════════════════════════════════════ */}
      {(severityCounts.length > 0 || pillarData.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: severityCounts.length > 0 && pillarData.length > 0 ? '1fr 2fr' : '1fr', gap: '1rem' }}>

          {/* Severity pie */}
          {severityCounts.length > 0 && (
            <div className="card">
              <CardLabel>Failures by Severity</CardLabel>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={severityCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={36}>
                    {severityCounts.map(d => <Cell key={d.name} fill={SEVERITY_COLOR[d.name] ?? '#94a3b8'} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.78rem' }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                {severityCounts.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.7rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: SEVERITY_COLOR[d.name], flexShrink: 0 }} />
                    <span style={{ color: 'var(--muted)' }}>{d.name}</span>
                    <span style={{ fontWeight: 700, color: SEVERITY_COLOR[d.name] }}>{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pillar bar chart */}
          {pillarData.length > 0 && (
            <div className="card">
              <CardLabel>Score by Pillar</CardLabel>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={pillarData} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--muted)' }} />
                  <YAxis type="category" dataKey="pillar" width={95} tick={{ fontSize: 11, fill: 'var(--text)' }} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.78rem' }} />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                    {pillarData.map(d => <Cell key={d.pillar} fill={scoreColor(d.score)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          6. REGULATORY READINESS — top 6, link to full matrix
      ══════════════════════════════════════════════════════════════════ */}
      {regulatoryTop.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <CardLabel>Regulatory Readiness {regulatoryAll.length > 6 ? `(top 6 of ${regulatoryAll.length})` : ''}</CardLabel>
            {onNav && <button onClick={() => onNav('compliance')} style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--waf-brand)', background: 'none', border: 'none', cursor: 'pointer', marginTop: '-0.5rem' }}>Full matrix →</button>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem 2rem' }}>
            {regulatoryTop.map(({ fw, pass, total, pct }) => {
              const color     = pct >= 80 ? '#22c55e' : pct >= 60 ? '#facc15' : '#ef4444'
              const textColor = pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626'
              return (
                <div key={fw}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }} title={fw}>{fw}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{pass}/{total}</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, width: '2.4rem', textAlign: 'right', color: textColor }}>{pct}%</span>
                    </div>
                  </div>
                  <div style={{ height: '6px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '999px', background: color, width: `${pct}%`, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          7. ARCHITECTURAL DEBT HEATMAP
      ══════════════════════════════════════════════════════════════════ */}
      {pillars.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '7px', background: 'rgba(220,38,38,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' }}>{I.fire}</div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)' }}>Architectural Debt Heatmap</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Failing controls by pillar × severity</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.63rem', color: '#94a3b8' }}>
              <span>Low</span>
              {['#fee2e2', '#fca5a5', '#f87171', '#dc2626'].map(c => <div key={c} style={{ width: '0.7rem', height: '0.7rem', borderRadius: '2px', background: c }} />)}
              <span>High</span>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: '0.8rem', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ padding: '0.35rem 0.75rem', textAlign: 'left', color: 'var(--muted)', fontWeight: 600 }}>Pillar</th>
                  {SEVERITIES.map(s => <th key={s} style={{ padding: '0.35rem 0.75rem', textAlign: 'center', color: SEVERITY_COLOR[s], fontWeight: 700, fontSize: '0.68rem' }}>{s}</th>)}
                </tr>
              </thead>
              <tbody>
                {pillars.map(p => (
                  <tr key={p} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.45rem 0.75rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{p}</td>
                    {SEVERITIES.map(s => {
                      const count = heatmap.find(c => c.pillar === p && c.severity === s)?.count ?? 0
                      const intensity = count === 0 ? 0 : 0.15 + (count / heatMax) * 0.75
                      const col = SEVERITY_COLOR[s] ?? '#94a3b8'
                      return (
                        <td key={s} style={{ padding: '0.3rem 0.75rem', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '2.1rem', height: '1.875rem', borderRadius: '5px', background: count === 0 ? 'transparent' : hex(col, intensity), color: count === 0 ? '#cbd5e1' : col, fontWeight: count > 0 ? 700 : 400, transition: 'transform 0.1s', cursor: count > 0 ? 'default' : undefined }}
                            onMouseEnter={e => { if (count > 0) (e.currentTarget as HTMLElement).style.transform = 'scale(1.12)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = '' }}
                            title={count > 0 ? `${p} / ${s}: ${count} failing` : undefined}
                          >
                            {count === 0 ? '—' : count}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          8. CHECK-LEVEL KPIs — compact strip
      ══════════════════════════════════════════════════════════════════ */}
      {totalChecks > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
          {([
            { label: 'Checks Run',         value: totalChecks,       sub: 'individual checks',       color: 'var(--text)' },
            { label: 'Check Pass Rate',    value: `${passRate}%`,    sub: `${passChecks}/${totalChecks} passed`, color: passRate >= 80 ? '#16a34a' : passRate >= 60 ? '#d97706' : '#dc2626' },
            { label: 'Resources Scanned', value: resources,          sub: 'unique resources',         color: 'var(--waf-brand)' },
            { label: 'Resources Failing', value: failResources,      sub: 'with ≥1 failure',           color: failResources > 0 ? '#dc2626' : '#16a34a' },
          ] as { label: string; value: string | number; sub: string; color: string }[]).map(({ label, value, sub, color }) => (
            <div key={label} className="card" style={{ padding: '0.875rem 1rem' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', marginTop: '0.2rem' }}>{label}</div>
              <div style={{ fontSize: '0.66rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          9. QUICK WINS
      ══════════════════════════════════════════════════════════════════ */}
      {quickWins.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '7px', background: 'rgba(22,163,74,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>{I.bolt}</div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)' }}>Quick Wins</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Top failing controls prioritized by severity</div>
              </div>
            </div>
            <button onClick={() => setAutoFix({ findings: allFails, scopeLabel: 'all failing controls' })}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.32rem 0.7rem', borderRadius: '6px', border: '1px solid rgba(0,148,255,.3)', background: 'rgba(0,148,255,.07)', color: 'var(--waf-brand)', fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              {I.bolt} Auto-Fix
              <span style={{ background: 'rgba(234,88,12,.12)', color: '#c2410c', fontSize: '0.48rem', fontWeight: 800, padding: '0.05rem 0.28rem', borderRadius: '3px' }}>α</span>
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.55rem' }}>
            {quickWins.map((f, i) => {
              const sev = f.severity?.toUpperCase() ?? ''
              const sevColor = SEVERITY_COLOR[sev] ?? '#94a3b8'
              const pColor   = PILLAR_COLOR[f.pillar ?? ''] ?? '#888'
              return (
                <div key={i}
                  style={{ padding: '0.7rem', borderRadius: '9px', border: '1px solid var(--border)', cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--waf-brand)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
                  onClick={() => setAutoFix({ findings: findings.filter(x => x.control_id === f.control_id && x.status?.toUpperCase() === 'FAIL'), scopeLabel: f.control_id })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.67rem', color: 'var(--muted)' }}>{f.control_id}</span>
                    <SevBadge sev={sev} />
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.35, marginBottom: '0.3rem' }}>
                    {f.check_title || f.check_id}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {f.pillar && <span style={{ padding: '0.08rem 0.38rem', borderRadius: '999px', background: hex(pColor, 0.12), color: pColor, fontSize: '0.6rem', fontWeight: 600, textTransform: 'capitalize' }}>{f.pillar}</span>}
                    <span style={{ marginLeft: 'auto', fontSize: '0.63rem', color: sevColor, fontWeight: 600 }}>Fix →</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Cloud footprint — only if present */}
      {detectedRegions.length > 0 && (
        <div className="card" style={{ padding: '0.875rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ color: 'var(--waf-brand)' }}>{I.globe}</div>
              <span style={{ fontSize: '0.83rem', fontWeight: 700, color: 'var(--text)' }}>Cloud Footprint</span>
            </div>
            {onNav && <button onClick={() => onNav('regions')} style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--waf-brand)', background: 'none', border: 'none', cursor: 'pointer' }}>Full map →</button>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
            <div style={{ padding: '0.35rem 0.875rem', borderRadius: '8px', background: 'rgba(0,148,255,.07)', border: '1px solid rgba(0,148,255,.18)' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--waf-brand)' }}>{detectedRegions.length}</span>
              <span style={{ fontSize: '0.68rem', color: 'var(--muted)', marginLeft: '0.3rem' }}>regions</span>
            </div>
            {Object.entries(providerCounts).map(([prov, cnt]) => (
              <div key={prov} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.35rem 0.75rem', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: PROVIDER_COLOR[prov] ?? '#888', flexShrink: 0 }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase' }}>{prov}</span>
                <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>{cnt} region{cnt > 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {autoFix && (
        <AutoFixModal run={run} findings={autoFix.findings} scopeLabel={autoFix.scopeLabel} onClose={() => setAutoFix(null)} />
      )}

    </div>
  )
}
