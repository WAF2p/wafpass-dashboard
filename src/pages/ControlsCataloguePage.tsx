import { Fragment, useEffect, useRef, useState } from 'react'
import { CatalogueControl, CatalogueCheck, ControlMeta, createCatalogueControl, fetchCatalogueControls, downloadControlsZip, fetchActivePackInfo, ActivePackInfo, deleteCatalogueControl } from '../api'
import { useAuth, hasMinRole } from '../AuthContext'

// ── Colours ───────────────────────────────────────────────────────────────────

const SEV_COLOR: Record<string, string> = {
  critical: '#DA2C38', high: '#f97316', medium: '#eab308', low: '#3b82f6',
}
const PILLAR_COLOR: Record<string, string> = {
  security: '#DA2C38', cost: '#f97316', reliability: '#0094FF',
  operational: '#8b5cf6', operations: '#8b5cf6',
  sovereign: '#06b6d4', sovereignty: '#06b6d4',
  sustainability: '#22c55e', performance: '#eab308', governance: '#94a3b8',
  agentic: '#ec4899',
}
const ENGINE_COLOR: Record<string, string> = {
  terraform: '#7c3aed', checkov: '#0ea5e9', manual: '#94a3b8',
}

const PILLAR_DESC: Record<string, string> = {
  security:       'Threat protection, encryption, access control, and attack-surface reduction',
  cost:           'Resource efficiency, budget guardrails, and cloud spend governance',
  performance:    'Latency, throughput, auto-scaling, and resource right-sizing',
  reliability:    'Fault tolerance, backups, multi-region, and disaster recovery',
  operational:    'Observability, automation, deployment hygiene, and runbook coverage',
  operations:     'Observability, automation, deployment hygiene, and runbook coverage',
  sustainability: 'Carbon footprint, energy efficiency, and sustainable architecture',
  sovereign:      'Data residency, jurisdictional controls, and regulatory locality',
  agentic:        'AI-driven infrastructure, autonomous remediation, and self-healing systems',
}

const ALL_PILLARS   = ['security', 'cost', 'performance', 'reliability', 'operations', 'sustainability', 'sovereign', 'agentic']
const ALL_SEVERITIES = ['critical', 'high', 'medium', 'low']
const ALL_TYPES     = ['governance', 'configuration', 'iac', 'network', 'identity', 'data', 'cost']
const ALL_ENGINES   = ['terraform', 'checkov', 'manual']
const PILLAR_PREFIX: Record<string, string> = {
  security: 'SEC', cost: 'COST', performance: 'PERF', reliability: 'REL',
  operations: 'OPS', sustainability: 'SUS', sovereign: 'SOV', agentic: 'AGT',
}
const TYPE_COLOR: Record<string, string> = {
  governance: '#0094FF', configuration: '#f97316', iac: '#7c3aed',
  network: '#06b6d4', identity: '#eab308', data: '#22c55e', cost: '#f97316',
}

function sevColor(s: string)    { return SEV_COLOR[s?.toLowerCase()]    ?? '#94a3b8' }
function pillarColor(p: string) { return PILLAR_COLOR[p?.toLowerCase()] ?? '#94a3b8' }
function typeColor(t: string)   { return TYPE_COLOR[t?.toLowerCase()]   ?? '#94a3b8' }
function engineColor(e: string) { return ENGINE_COLOR[e?.toLowerCase()] ?? '#94a3b8' }

// ── Shared components ─────────────────────────────────────────────────────────

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '0.15rem 0.55rem', borderRadius: '999px',
      background: `${color}22`, color,
      fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

function Tag({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-flex', padding: '0.1rem 0.4rem', borderRadius: '4px',
      fontSize: '0.65rem', fontWeight: 600,
      background: 'rgba(15,23,42,.07)', color: 'var(--muted)',
    }}>{label}</span>
  )
}

function TogglePill({ label, color, active, onClick }: { label: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '0.2rem 0.6rem', borderRadius: '999px', cursor: 'pointer',
      fontSize: '0.72rem', fontWeight: 700,
      background: active ? color : `${color}18`,
      color: active ? '#fff' : color,
      border: `1px solid ${color}44`,
      whiteSpace: 'nowrap',
      flex: '0 0 auto',
      minWidth: 'auto',
    }}>{label}</button>
  )
}

function sourceBadge(isCustom: boolean) {
  return isCustom
    ? <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(124,58,237,.15)', color: '#7c3aed', border: '1px solid rgba(124,58,237,.25)', whiteSpace: 'nowrap' }}>custom</span>
    : <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(0,148,255,.12)', color: '#0094FF', border: '1px solid rgba(0,148,255,.25)', whiteSpace: 'nowrap' }}>waf++</span>
}

// ── Unified row shape ─────────────────────────────────────────────────────────

interface UnifiedControl {
  id: string
  pillar: string
  severity: string
  type: string[]
  description: string
  checksCount: number
  isCustom: boolean
  custom?: CatalogueControl
  core?: ControlMeta
}

function fromCore(c: ControlMeta): UnifiedControl {
  // Use category if available, otherwise infer type from pillar
  const getCategory = (): string => {
    if (c.category) return c.category
    const pillarKey = c.pillar?.toLowerCase().replace(/s$/, '')
    switch (pillarKey) {
      case 'security': return 'identity'
      case 'cost': return 'governance'
      case 'performance': return 'configuration'
      case 'reliability': return 'governance'
      case 'operational': case 'operations': return 'governance'
      case 'sovereign': case 'sovereignty': return 'governance'
      case 'sustainability': return 'governance'
      default: return ''
    }
  }
  const category = getCategory()
  return {
    id: c.id, pillar: c.pillar, severity: c.severity,
    type: category ? [category] : [],
    description: c.description,
    checksCount: c.checks?.length ?? 0,
    isCustom: false, core: c,
  }
}

function fromCustom(c: CatalogueControl): UnifiedControl {
  return {
    id: c.id, pillar: c.pillar, severity: c.severity,
    type: c.type,
    description: c.description,
    checksCount: c.checks?.length ?? 0,
    isCustom: true, custom: c,
  }
}

// ── YAML / Checkov download helpers ──────────────────────────────────────────

function downloadText(name: string, content: string, mime = 'text/plain') {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content], { type: mime })),
    download: name,
  })
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
}

function toYaml(c: CatalogueControl): string {
  const typeLines  = c.type.map(t => `- ${t}`).join('\n')
  const descLines  = c.description.trim().split('\n').map(l => `  ${l}`).join('\n')
  const checksLines = c.checks.map(ch =>
    `- id: ${ch.id}\n  engine: ${ch.engine}\n  description: ${JSON.stringify(ch.description)}\n  expected: ${JSON.stringify(ch.expected)}`
  ).join('\n')
  return (
    `# Generated by wafpass control generate — do not edit manually\n` +
    `# Source: ${c.id} | Pillar: ${c.pillar} | Severity: ${c.severity}\n` +
    `id: ${c.id}\npillar: ${c.pillar}\nseverity: ${c.severity}\ntype:\n${typeLines}\n` +
    `description: |\n${descLines}\n` +
    (c.checks.length > 0 ? `checks:\n${checksLines}\n` : `checks: []\n`)
  )
}

function toCheckov(c: CatalogueControl): string {
  const cls  = 'Check' + c.id.replace(/-/g, '')
  const ckv  = 'CKV_'  + c.id.replace(/-/g, '_')
  const desc = c.description.trim().split('\n')[0].slice(0, 120).replace(/"/g, '\\"')
  return (
    `# Generated by wafpass control generate — do not edit manually\n` +
    `# Source: ${c.id} | Pillar: ${c.pillar} | Severity: ${c.severity}\n\n` +
    `from checkov.common.models.enums import CheckCategories, CheckResult\n` +
    `from checkov.terraform.checks.resource.base_resource_check import BaseResourceCheck\n\n\n` +
    `class ${cls}(BaseResourceCheck):\n    """WAF++ Control ${c.id}: ${desc}"""\n\n` +
    `    def __init__(self) -> None:\n        super().__init__(name="${desc}", check_id="${ckv}",\n` +
    `            categories=[CheckCategories.GENERAL_SECURITY], supported_resources=["*"])\n\n` +
    `    def scan_resource_conf(self, conf: dict) -> CheckResult:\n` +
    `        # TODO: implement check logic for WAF++ control ${c.id}\n` +
    `        raise NotImplementedError("Stub — implement check logic for ${c.id}")\n\n\nscanner = ${cls}()\n`
  )
}

// ── Framework Checkov + ZIP pack helpers ─────────────────────────────────────

function toCheckovFromCore(c: ControlMeta): string {
  const cls  = 'Check' + c.id.replace(/-/g, '')
  const ckv  = 'CKV_'  + c.id.replace(/-/g, '_')
  const desc = c.description.trim().split('\n')[0].slice(0, 120).replace(/"/g, '\\"')
  const lines = [
    `# Generated by wafpass-dashboard — WAF++ Framework Control`,
    `# Source: ${c.id} | Pillar: ${c.pillar} | Severity: ${c.severity}`,
    ``,
    `from checkov.common.models.enums import CheckCategories, CheckResult`,
    `from checkov.terraform.checks.resource.base_resource_check import BaseResourceCheck`,
    ``,
    ``,
    `class ${cls}(BaseResourceCheck):`,
    `    """WAF++ Control ${c.id}: ${desc}"""`,
    ``,
    `    def __init__(self) -> None:`,
    `        super().__init__(`,
    `            name="${desc}",`,
    `            check_id="${ckv}",`,
    `            categories=[CheckCategories.GENERAL_SECURITY],`,
    `            supported_resources=["*"],`,
    `        )`,
    ``,
    `    def scan_resource_conf(self, conf: dict) -> CheckResult:`,
  ]
  if ((c.checks?.length ?? 0) > 0) {
    lines.push(`        # WAF++ sub-checks to implement:`)
    for (const ch of c.checks) {
      lines.push(`        #   [${ch.severity?.toUpperCase() ?? ''}] ${ch.id}: ${ch.title}`)
      if (ch.remediation) {
        ch.remediation.trim().split('\n').slice(0, 2)
          .forEach(l => lines.push(`        #     ${l.trim().slice(0, 90)}`))
      }
    }
    lines.push(`        #`)
  }
  lines.push(
    `        # TODO: implement check logic for WAF++ control ${c.id}`,
    `        raise NotImplementedError("Stub — implement for ${c.id}")`,
    ``,
    ``,
    `scanner = ${cls}()`,
  )
  return lines.join('\n') + '\n'
}

function toYamlFromCore(c: ControlMeta): string {
  const descLines = c.description.trim().split('\n').map(l => `  ${l}`).join('\n')
  const lines = [
    `# WAF++ Framework Control — exported from wafpass-dashboard`,
    `id: ${c.id}`,
    `title: ${JSON.stringify(c.title)}`,
    `pillar: ${c.pillar}`,
    `severity: ${c.severity}`,
    `category: ${c.category ?? ''}`,
    `description: |`,
    descLines,
  ]
  if (c.rationale) {
    lines.push(`rationale: |`)
    c.rationale.trim().split('\n').forEach(l => lines.push(`  ${l}`))
  }
  if ((c.checks?.length ?? 0) > 0) {
    lines.push(`checks:`)
    for (const ch of c.checks) {
      lines.push(`  - id: ${ch.id}`)
      lines.push(`    severity: ${ch.severity}`)
      lines.push(`    title: ${JSON.stringify(ch.title)}`)
    }
  }
  return lines.join('\n') + '\n'
}

/** Minimal uncompressed (store) ZIP encoder — byte-by-byte to avoid spread/apply limits */
function crc32(buf: Uint8Array): number {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function makeZip(files: { name: string; content: string }[]): Uint8Array {
  const enc = new TextEncoder()
  const out: number[] = []

  // Write helpers — byte-by-byte, no spread, no call-stack limits
  function w8(n: number)  { out.push(n & 0xff) }
  function w16(n: number) { w8(n); w8(n >>> 8) }
  function w32(n: number) { w8(n); w8(n >>> 8); w8(n >>> 16); w8(n >>> 24) }
  function wbuf(b: Uint8Array) { for (let i = 0; i < b.length; i++) w8(b[i]) }

  const entries: { offset: number; nb: Uint8Array; db: Uint8Array; crc: number }[] = []

  for (const f of files) {
    const nb = enc.encode(f.name)
    const db = enc.encode(f.content)
    const crc = crc32(db)
    const offset = out.length
    entries.push({ offset, nb, db, crc })

    // Local file header (30 bytes fixed + fname + data)
    w32(0x04034b50); w16(20); w16(0); w16(0); w32(0)   // sig, ver, flags, comp, datetime
    w32(crc); w32(db.length); w32(db.length)            // crc, csize, usize
    w16(nb.length); w16(0)                              // fname_len, extra_len
    wbuf(nb); wbuf(db)
  }

  const cdStart = out.length
  for (const e of entries) {
    // Central directory entry (46 bytes fixed + fname)
    w32(0x02014b50); w16(0x0314); w16(20); w16(0); w16(0); w32(0)  // sig, ver_made, ver_need, flags, comp, datetime
    w32(e.crc); w32(e.db.length); w32(e.db.length)                  // crc, csize, usize
    w16(e.nb.length); w16(0); w16(0)                                 // fname_len, extra_len, comment_len
    w16(0); w16(0); w32(0)                                           // disk_start, int_attr, ext_attr
    w32(e.offset); wbuf(e.nb)
  }
  const cdSize = out.length - cdStart

  // End of central directory (22 bytes)
  w32(0x06054b50); w16(0); w16(0)              // sig, disk, disk_cd
  w16(entries.length); w16(entries.length)     // entries_disk, entries_total
  w32(cdSize); w32(cdStart); w16(0)            // cd_size, cd_offset, comment_len

  return new Uint8Array(out)
}

function downloadZip(name: string, zip: Uint8Array) {
  // Use slice to get a plain ArrayBuffer (avoids SharedArrayBuffer TS conflict)
  const buf = zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([buf], { type: 'application/zip' })),
    download: name,
  })
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
}

function buildPackFiles(controls: UnifiedControl[]): { name: string; content: string }[] {
  const date = new Date().toISOString().split('T')[0]
  const files: { name: string; content: string }[] = []
  files.push({
    name: 'wafpass_checks/__init__.py',
    content: [
      `# WAF++ Checkov checks — generated ${date}`,
      `# Controls: ${controls.length}`,
      `#`,
      `# Usage:`,
      `#   checkov -d ./terraform --external-checks-dir ./wafpass_checks/`,
    ].join('\n') + '\n',
  })
  for (const ctrl of controls) {
    const content = ctrl.isCustom && ctrl.custom
      ? toCheckov(ctrl.custom)
      : ctrl.core ? toCheckovFromCore(ctrl.core) : null
    if (content) files.push({ name: `wafpass_checks/${ctrl.id}.py`, content })
  }
  return files
}

// ── Wizard ────────────────────────────────────────────────────────────────────

const WIZARD_STEPS = [
  { label: 'Describe',  sub: 'Requirement'   },
  { label: 'Pillar',    sub: 'Security pillar'},
  { label: 'Classify',  sub: 'ID & severity'  },
  { label: 'Types',     sub: 'Control types'  },
  { label: 'Checks',    sub: 'Define checks'  },
  { label: 'Preview',   sub: 'YAML review'    },
  { label: 'Save',      sub: 'Export & push'  },
]

const EMPTY_CHECK: CatalogueCheck = { id: '', engine: 'terraform', description: '', expected: '' }

interface WizardState {
  description: string
  pillar: string
  id: string
  severity: string
  types: string[]
  checks: CatalogueCheck[]
}

// ── Step stream ───────────────────────────────────────────────────────────────

function StepStream({ step }: { step: number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', padding: '1rem 1.5rem 0.875rem',
      borderBottom: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0,
    }}>
      {WIZARD_STEPS.map((s, i) => {
        const done   = i < step
        const active = i === step
        const clr    = done ? '#059669' : active ? '#0094FF' : '#94a3b8'
        return (
          <Fragment key={i}>
            {i > 0 && (
              <div style={{
                flex: 1, height: '2px', marginTop: '13px',
                background: done ? '#059669' : '#e2e8f0',
              }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', minWidth: '56px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: (done || active) ? clr : 'transparent',
                border: `2px solid ${clr}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.68rem', fontWeight: 800,
                color: (done || active) ? '#fff' : clr,
                flexShrink: 0, transition: 'all 0.2s',
              }}>
                {done ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: '0.58rem', fontWeight: 700, color: clr, textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{s.label}</span>
              <span style={{ fontSize: '0.55rem', color: active ? clr : '#94a3b8', textAlign: 'center', lineHeight: 1.1, whiteSpace: 'nowrap' }}>{s.sub}</span>
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}

// ── Step content ──────────────────────────────────────────────────────────────

const inputStyle = {
  width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px',
  border: '1px solid var(--border)', fontSize: '0.82rem',
  background: 'var(--bg)', color: 'var(--text)', outline: 'none',
  boxSizing: 'border-box' as const,
}
const labelStyle: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  marginBottom: '0.35rem', display: 'block',
}

function Step1Describe({ state, onChange }: { state: WizardState; onChange: (p: Partial<WizardState>) => void }) {
  const [isFocused, setIsFocused] = useState(false)
  const charCount = state.description.trim().length
  const isShort = charCount < 20
  const isLongEnough = charCount >= 20

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ background: 'rgba(0,148,255,.06)', border: '1px solid rgba(0,148,255,.2)', borderRadius: '10px', padding: '0.875rem 1rem', fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.6 }}>
        Describe in plain language what your infrastructure must enforce. This becomes the control description that engineers will read in scan results.
      </div>
      <div>
        <label style={labelStyle}>Requirement description</label>
        <textarea
          value={state.description}
          onChange={e => onChange({ description: e.target.value })}
          rows={5}
          placeholder={`E.g. "All S3 buckets must have server-side encryption enabled using AES-256 or KMS. Unencrypted buckets must not be deployable in any environment."`}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, outline: isFocused && isShort ? '2px solid #f97316' : 'none' }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoFocus
        />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.3rem', fontSize: '0.68rem' }}>
          <span style={{ color: isLongEnough ? '#059669' : '#DA2C38', fontWeight: 700 }}>
            {isLongEnough ? '✓' : isFocused ? '✏' : '•'} {isLongEnough ? `${charCount} characters` : `${20 - charCount} more needed`}
          </span>
          <div style={{ flex: 1, height: 3, borderRadius: 999, background: 'var(--border)', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ height: '100%', width: `${Math.min(100, (charCount / 500) * 100)}%`, background: isLongEnough ? '#059669' : '#f97316', transition: 'width 0.3s ease' }} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', padding: '0.35rem 0.5rem', background: 'rgba(0,148,255,.08)', borderRadius: '6px' }}>
          <span style={{ fontSize: '0.7rem', color: '#60a5fa' }}>Note:</span>
          <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
            Custom controls use <strong>CUS-</strong> prefix (e.g., CUS-001)
          </span>
        </div>
        {isFocused && isShort && (
          <div style={{ marginTop: '0.25rem', fontSize: '0.68rem', color: '#f97316', background: 'rgba(249,115,22,.08)', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
            Tip: Aim for 30-100 characters for clear control descriptions
          </div>
        )}
      </div>
    </div>
  )
}

function Step2Pillar({ state, onChange }: { state: WizardState; onChange: (p: Partial<WizardState>) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.25rem', lineHeight: 1.5 }}>
        Choose the security pillar this control belongs to. It determines the control ID prefix and how findings are categorised.
      </div>
      {ALL_PILLARS.map(p => {
        const active = state.pillar === p
        const color  = pillarColor(p)
        return (
          <button
            key={p}
            onClick={() => onChange({ pillar: p })}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.875rem',
              padding: '0.75rem 1rem', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
              border: `2px solid ${active ? color : 'var(--border)'}`,
              background: active ? `${color}10` : 'var(--bg)',
              transition: 'all 0.15s',
            }}
          >
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
              background: color, boxShadow: active ? `0 0 0 3px ${color}30` : 'none',
            }} />
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: active ? color : 'var(--text)', display: 'block', textTransform: 'capitalize' }}>
                {PILLAR_PREFIX[p]} — {p}
              </span>
              <span style={{ fontSize: '0.73rem', color: 'var(--muted)', lineHeight: 1.4 }}>{PILLAR_DESC[p]}</span>
            </div>
            {active && <span style={{ fontSize: '0.9rem', color }}>✓</span>}
          </button>
        )
      })}
    </div>
  )
}

function Step3Classify({ state, onChange }: { state: WizardState; onChange: (p: Partial<WizardState>) => void }) {
  const [customNum, setCustomNum] = useState(state.id.replace('CUS-', ''))
  const isIdValid = /^[0-9]+$/.test(customNum)

  // Sync customNum back to state when user types
  useEffect(() => {
    setCustomNum(state.id.replace('CUS-', ''))
  }, [state.id])

  // Extract number from state and rebuild with CUS- prefix
  useEffect(() => {
    const num = state.id.replace('CUS-', '')
    setCustomNum(num)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow numbers
    const num = e.target.value.replace(/[^0-9]/g, '').padStart(3, '0')
    setCustomNum(num)
    onChange({ id: `CUS-${num}` })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <label style={labelStyle}>Control ID</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <code style={{ fontSize: '0.82rem', color: '#0094FF', padding: '0.45rem 0.75rem', borderRadius: '8px', background: 'var(--bg)', border: '1px solid var(--border)', fontFamily: 'monospace' }}>
            CUS-
          </code>
          <input
            value={customNum}
            onChange={handleChange}
            placeholder="001"
            style={{ ...inputStyle, width: '100px', outline: !isIdValid ? '2px solid #f97316' : 'none', fontFamily: 'monospace' }}
            autoFocus
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.3rem', fontSize: '0.68rem' }}>
          <span style={{ color: isIdValid ? '#059669' : '#94a3b8', fontWeight: 700 }}>
            {isIdValid ? '✓' : '•'} Format: CUS-001 to CUS-999
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', padding: '0.35rem 0.5rem', background: 'rgba(0,148,255,.08)', borderRadius: '6px' }}>
          <span style={{ fontSize: '0.7rem', color: '#60a5fa' }}>Note:</span>
          <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
            Custom controls use <strong>CUS-</strong> prefix (fixed - only the number changes)
          </span>
        </div>
      </div>
      <div>
        <label style={labelStyle}>Severity</label>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {ALL_SEVERITIES.map(s => {
            const active = state.severity === s
            const color  = sevColor(s)
            return (
              <button
                key={s}
                onClick={() => onChange({ severity: s })}
                style={{
                  padding: '0.45rem 1.1rem', borderRadius: '8px', cursor: 'pointer',
                  border: `2px solid ${active ? color : 'var(--border)'}`,
                  background: active ? `${color}15` : 'var(--bg)',
                  color: active ? color : 'var(--muted)',
                  fontWeight: 700, fontSize: '0.82rem', textTransform: 'capitalize',
                  transition: 'all 0.15s',
                }}
              >{s}</button>
            )
          })}
        </div>
        <div style={{ fontSize: '0.65rem', color: 'var(--muted)', marginTop: '0.3rem' }}>
          <span style={{ fontWeight: 600 }}>Tip:</span> Critical & High block CI/CD, Medium & Low are advisory-only
        </div>
      </div>
    </div>
  )
}

function Step4Types({ state, onChange }: { state: WizardState; onChange: (p: Partial<WizardState>) => void }) {
  function toggle(t: string) {
    onChange({ types: state.types.includes(t) ? state.types.filter(x => x !== t) : [...state.types, t] })
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.5 }}>
        Select one or more control types that describe how this control is enforced. Choose all that apply.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        {ALL_TYPES.map(t => {
          const active = state.types.includes(t)
          return (
            <button
              key={t}
              onClick={() => toggle(t)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.65rem 0.875rem', borderRadius: '8px', cursor: 'pointer',
                border: `2px solid ${active ? '#0094FF' : 'var(--border)'}`,
                background: active ? 'rgba(0,148,255,.08)' : 'var(--bg)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{
                width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                border: `2px solid ${active ? '#0094FF' : 'var(--border)'}`,
                background: active ? '#0094FF' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {active && <span style={{ color: '#fff', fontSize: '0.65rem', lineHeight: 1 }}>✓</span>}
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: active ? '#0094FF' : 'var(--text)', textTransform: 'capitalize' }}>{t}</span>
            </button>
          )
        })}
      </div>
      {state.types.length === 0 && (
        <div style={{ fontSize: '0.75rem', color: '#DA2C38' }}>Select at least one type to continue.</div>
      )}
    </div>
  )
}

function Step5Checks({ state, onChange }: { state: WizardState; onChange: (p: Partial<WizardState>) => void }) {
  function update(i: number, field: keyof CatalogueCheck, value: string) {
    onChange({ checks: state.checks.map((c, idx) => idx === i ? { ...c, [field]: value } : c) })
  }
  function add() { onChange({ checks: [...state.checks, { ...EMPTY_CHECK }] }) }
  function remove(i: number) { onChange({ checks: state.checks.filter((_, idx) => idx !== i) }) }

  // Validation helpers
  const checkHasValidId = (ch: CatalogueCheck) => ch.id && /^[a-zA-Z0-9_.-]+$/.test(ch.id)
  const checkHasValidEngine = (ch: CatalogueCheck) => ch.engine && ALL_ENGINES.includes(ch.engine)
  const checkHasValidDescription = (ch: CatalogueCheck) => ch.description && ch.description.length > 10
  const checkHasValidExpected = (ch: CatalogueCheck) => ch.expected && ch.expected.length > 3

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
          Define the individual checks that implement this control. Each check maps to a specific engine assertion.
        </div>
        <button onClick={add} style={{ fontSize: '0.75rem', color: '#0094FF', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap', marginLeft: '0.75rem' }}>
          + Add check
        </button>
      </div>
      {state.checks.map((ch, i) => {
        const idOk = checkHasValidId(ch)
        const engineOk = checkHasValidEngine(ch)
        const descOk = checkHasValidDescription(ch)
        const expectedOk = checkHasValidExpected(ch)
        const allOk = idOk && engineOk && descOk && expectedOk

        return (
          <div key={i} style={{ background: 'var(--bg)', borderRadius: '10px', border: `1px solid ${allOk ? 'rgba(0,148,255,.2)' : 'var(--border)'}`, padding: '0.875rem', transition: 'border-color 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Check {i + 1}</span>
              {state.checks.length > 1 && (
                <button onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DA2C38', fontSize: '0.8rem', lineHeight: 1 }}>✕</button>
              )}
              <span style={{ fontSize: '0.62rem', color: allOk ? '#059669' : '#f97316', fontWeight: 700 }}>
                {allOk ? '✓' : '✏'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ position: 'relative' }}>
                <input
                  value={ch.id}
                  onChange={e => update(i, 'id', e.target.value)}
                  placeholder="Check ID — e.g. tf.s3_encryption"
                  style={{ ...inputStyle, outline: ch.id && !idOk ? '2px solid #f97316' : 'none' }}
                />
                {ch.id && !idOk && (
                  <div style={{ position: 'absolute', bottom: '-1.15rem', left: 0, right: 0, fontSize: '0.62rem', color: '#f97316' }}>
                    Use format: engine.resource_type (e.g., tf.s3_encryption)
                  </div>
                )}
                <div style={{ fontSize: '0.58rem', color: '#64748b', marginTop: '0.2rem' }}>
                  {ch.id ? (idOk ? 'Valid ✓' : 'Invalid format') : 'Auto-suggested: tf.'}
                </div>
              </div>
              <select value={ch.engine} onChange={e => update(i, 'engine', e.target.value)} style={{ ...inputStyle, outline: ch.engine && !engineOk ? '2px solid #f97316' : 'none' }}>
                {ALL_ENGINES.map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
              {ch.engine && !engineOk && (
                <div style={{ position: 'absolute', bottom: '-1.2rem', left: 0, right: 0, fontSize: '0.62rem', color: '#f97316' }}>
                  Select a valid engine
                </div>
              )}
            </div>
            <input
              value={ch.description}
              onChange={e => update(i, 'description', e.target.value)}
              placeholder="What this check verifies"
              style={{ ...inputStyle, marginBottom: '0.5rem', outline: ch.description && !descOk ? '2px solid #f97316' : 'none' }}
            />
            <div style={{ fontSize: '0.62rem', color: '#64748b', marginBottom: '0.2rem' }}>
              {ch.description ? (descOk ? 'Good length ✓' : 'Too short') : 'Describe the check requirement'}
            </div>
            <input
              value={ch.expected}
              onChange={e => update(i, 'expected', e.target.value)}
              placeholder="Expected — what a passing configuration looks like"
              style={{ ...inputStyle, outline: ch.expected && !expectedOk ? '2px solid #f97316' : 'none' }}
            />
            <div style={{ fontSize: '0.62rem', color: '#64748b' }}>
              {ch.expected ? (expectedOk ? 'Valid ✓' : 'Too short') : 'Describe expected state'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', padding: '0.4rem 0.6rem', background: 'rgba(0,148,255,.08)', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.7rem', color: '#60a5fa' }}>Schema hint:</span>
              <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                engine: {ALL_ENGINES.join(' | ')}
              </span>
            </div>
          </div>
        )
      })}
      {state.checks.length === 0 && (
        <div style={{ fontSize: '0.7rem', color: '#f97316', padding: '0.5rem', background: 'rgba(249,115,22,.08)', borderRadius: '8px', textAlign: 'center' }}>
          Add at least one check to define how this control is verified
        </div>
      )}
    </div>
  )
}

function Step6Preview({ state }: { state: WizardState }) {
  const preview = toYaml({
    id: state.id, pillar: state.pillar, severity: state.severity,
    type: state.types as CatalogueControl['type'],
    description: state.description, checks: state.checks,
    source: 'dashboard', created_at: '', updated_at: '',
    regulatory_mapping: [],
  })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.5 }}>
        Review the generated YAML before saving. Use <strong>Previous</strong> to go back and make edits.
      </div>
      <pre style={{
        margin: 0, background: '#0f172a', borderRadius: '10px', padding: '1rem 1.1rem',
        fontSize: '0.75rem', color: '#e2e8f0', overflowX: 'auto', lineHeight: 1.7,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        border: '1px solid rgba(255,255,255,.06)',
      }}>
        {preview.split('\n').map((line, i) => {
          let color = '#e2e8f0'
          if (line.startsWith('#'))            color = '#64748b'
          else if (/^[a-z_]+:/.test(line))     color = '#7dd3fc'
          else if (line.startsWith('- id:'))   color = '#86efac'
          else if (line.startsWith('- '))      color = '#fda4af'
          return <span key={i} style={{ color, display: 'block' }}>{line}</span>
        })}
      </pre>
      {/* Validation summary */}
      <div style={{ background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--border)', padding: '0.875rem 1rem' }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>Validation</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {[
            ['Description',  state.description.trim().length >= 20],
            ['Pillar',       ALL_PILLARS.includes(state.pillar)],
            ['Control ID',   /^[A-Z]+-\d+$/.test(state.id)],
            ['Severity',     ALL_SEVERITIES.includes(state.severity)],
            ['Types',        state.types.length > 0],
            ['Checks',       state.checks.length > 0 && state.checks.every(c => c.id && c.description && c.expected)],
          ].map(([label, ok]) => (
            <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
              <span style={{ color: ok ? '#059669' : '#DA2C38', fontWeight: 700 }}>{ok ? '✓' : '✗'}</span>
              <span style={{ color: ok ? 'var(--text)' : '#DA2C38' }}>{label as string}</span>
              {!ok && <span style={{ color: '#DA2C38', fontSize: '0.7rem' }}>· required</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Step7Save({
  state, saving, error, savedControl, onSave,
}: {
  state: WizardState
  saving: boolean
  error: string | null
  savedControl: CatalogueControl | null
  onSave: () => void
}) {
  if (savedControl) {
    const yaml = toYaml(savedControl)
    const ckv  = toCheckov(savedControl)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Success */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(5,150,105,.08)', border: '1px solid rgba(5,150,105,.25)', borderRadius: '10px', padding: '0.875rem 1rem' }}>
          <span style={{ fontSize: '1.4rem', color: '#059669' }}>✓</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#059669' }}>Control saved successfully</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
              <code style={{ fontWeight: 700, color: 'var(--text)' }}>{savedControl.id}</code> is now stored in wafpass-server and available for export.
            </div>
          </div>
        </div>

        {/* Downloads */}
        <div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Export</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => downloadText(`${savedControl.id}.yml`, yaml, 'text/yaml')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, background: 'rgba(0,148,255,.1)', color: '#0094FF', border: '1px solid rgba(0,148,255,.3)' }}
            >↓ Download YAML</button>
            <button
              onClick={() => downloadText(`${savedControl.id}.py`, ckv, 'text/x-python')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, background: 'rgba(124,58,237,.1)', color: '#7c3aed', border: '1px solid rgba(124,58,237,.3)' }}
            >↓ Download Checkov stub</button>
          </div>
        </div>

        {/* CLI usage */}
        <CliUsage controlId={savedControl.id} isCustom={true} />
      </div>
    )
  }

  const isValid = (
    state.description.trim().length >= 20 &&
    ALL_PILLARS.includes(state.pillar) &&
    /^[A-Z]+-\d+$/.test(state.id) &&
    ALL_SEVERITIES.includes(state.severity) &&
    state.types.length > 0 &&
    state.checks.length > 0 &&
    state.checks.every(c => c.id && c.description && c.expected)
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--border)', padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {[
          ['ID',          state.id],
          ['Pillar',      state.pillar],
          ['Severity',    state.severity],
          ['Types',       state.types.join(', ')],
          ['Checks',      `${state.checks.length} defined`],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem' }}>
            <span style={{ fontWeight: 700, color: 'var(--muted)', minWidth: '70px' }}>{k}</span>
            <span style={{ color: 'var(--text)' }}>{v}</span>
          </div>
        ))}
      </div>

      {error && <div style={{ background: '#DA2C3812', border: '1px solid #DA2C3840', borderRadius: '8px', padding: '0.65rem 0.875rem', fontSize: '0.8rem', color: '#DA2C38' }}>{error}</div>}

      <button
        onClick={onSave}
        disabled={saving || !isValid}
        style={{
          padding: '0.65rem 1.25rem', borderRadius: '10px', border: 'none',
          background: isValid ? '#0094FF' : '#94a3b8', color: '#fff',
          fontWeight: 700, fontSize: '0.85rem', cursor: (saving || !isValid) ? 'default' : 'pointer',
          opacity: saving ? 0.75 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
        }}
      >
        {saving ? <><div className="spinner" style={{ width: '14px', height: '14px', borderTopColor: '#fff' }} />Saving…</> : '↑ Save to wafpass-server'}
      </button>

      {!isValid && (
        <div style={{ fontSize: '0.73rem', color: 'var(--muted)', textAlign: 'center' }}>
          Go back and fix validation errors before saving.
        </div>
      )}
    </div>
  )
}

// ── CLI usage block ───────────────────────────────────────────────────────────

function CliUsage({ controlId, isCustom }: { controlId: string; isCustom: boolean }) {
  const [copied, setCopied] = useState<string | null>(null)
  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const codeBlock = (key: string, title: string, code: string) => (
    <div key={key} style={{ marginBottom: '0.75rem' }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>{title}</div>
      <div style={{ position: 'relative' }}>
        <pre style={{
          margin: 0, background: '#0f172a', borderRadius: '8px', padding: '0.7rem 2.5rem 0.7rem 0.875rem',
          fontSize: '0.73rem', color: '#e2e8f0', overflowX: 'auto', lineHeight: 1.65, whiteSpace: 'pre',
        }}>{code}</pre>
        <button
          onClick={() => copy(code, key)}
          style={{ position: 'absolute', top: '0.4rem', right: '0.4rem', background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: '5px', padding: '0.2rem 0.4rem', cursor: 'pointer', color: '#94a3b8', fontSize: '0.65rem' }}
        >{copied === key ? '✓' : 'copy'}</button>
      </div>
    </div>
  )

  return (
    <div style={{ background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--border)', padding: '0.875rem 1rem' }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
        Use with wafpass CLI
      </div>
      {isCustom ? (
        <>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
            This custom control is stored in wafpass-server. You can use it two ways:
          </div>
          {codeBlock('opt1', 'Option 1 — from controls directory (after downloading YAML)',
`# Save the YAML to your controls folder, then scan:
wafpass scan ./my-infra --controls-dir ./controls`
          )}
          {codeBlock('opt2', 'Option 2 — pull directly from wafpass-server DB',
`# No file needed — server serves the control at runtime:
wafpass scan ./my-infra --server-url http://localhost:8000`
          )}
          {codeBlock('cli-gen', 'Or generate interactively from the CLI',
`wafpass control generate
# Then push automatically:
wafpass control generate --server-url http://localhost:8000`
          )}
          {codeBlock('cli-show', `Inspect this control via CLI`,
`wafpass control show ${controlId}`
          )}
        </>
      ) : (
        <>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
            WAF++ framework controls are built-in and loaded automatically on every scan.
          </div>
          {codeBlock('fw-scan', 'Run a scan (framework controls included automatically)',
`wafpass scan ./my-infra`
          )}
          {codeBlock('fw-show', `Inspect this control`,
`wafpass control show ${controlId}`
          )}
          {codeBlock('fw-list', 'List all available controls',
`wafpass control list`
          )}
        </>
      )}
    </div>
  )
}

// ── Implementation guide modal (WAF++ CLI + Checkov) ─────────────────────────

type GuideMode = 'wafpass' | 'checkov'
type GuideTab  = 'quickstart' | 'implement' | 'cicd' | 'controls' | 'dashboard'

function ImplementGuideModal({ totalChecks, onClose, onDownloadPack }: {
  totalChecks: number
  onClose: () => void
  onDownloadPack: () => void
}) {
  const [mode, setMode] = useState<GuideMode>('wafpass')
  const [tab,  setTab]  = useState<GuideTab>('quickstart')
  const [copied, setCopied] = useState<string | null>(null)

  function switchMode(m: GuideMode) { setMode(m); setTab('quickstart') }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key); setTimeout(() => setCopied(null), 2000)
  }

  const dark: React.CSSProperties = {
    margin: 0, background: '#0f172a', borderRadius: '8px',
    padding: '0.75rem 2.5rem 0.75rem 0.875rem',
    fontSize: '0.73rem', color: '#e2e8f0', overflowX: 'auto', lineHeight: 1.65, whiteSpace: 'pre',
  }
  const sh: React.CSSProperties = {
    fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)',
    margin: '1.25rem 0 0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
  }
  const p: React.CSSProperties = { margin: '0 0 0.6rem', fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.65 }

  const num = (n: number | string) => (
    <span style={{ background: '#0094FF', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.63rem', fontWeight: 800, flexShrink: 0 }}>{n}</span>
  )

  function CB({ id, code }: { id: string; code: string }) {
    return (
      <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
        <pre style={dark}>{code}</pre>
        <button onClick={() => copy(code, id)} style={{ position: 'absolute', top: '0.4rem', right: '0.4rem', background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: '5px', padding: '0.2rem 0.4rem', cursor: 'pointer', color: '#94a3b8', fontSize: '0.65rem' }}>
          {copied === id ? '✓' : 'copy'}
        </button>
      </div>
    )
  }

  // Mode-specific tab sets
  const wafTabs: [GuideTab, string][]  = [['quickstart','Quick Start'],['controls','Custom Controls'],['dashboard','Dashboard & CI']]
  const ckTabs: [GuideTab, string][]   = [['quickstart','Quick Start'],['implement','Implement a Check'],['cicd','CI/CD']]
  const tabs = mode === 'wafpass' ? wafTabs : ckTabs

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 99 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '740px', maxWidth: '96vw', maxHeight: '92vh',
        background: '#fff', borderRadius: '16px', boxShadow: '0 32px 80px rgba(15,23,42,.22)',
        display: 'flex', flexDirection: 'column', zIndex: 100, overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>How to implement WAF++ Controls</div>
            <div style={{ fontSize: '0.73rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{totalChecks} controls available · choose your toolchain below</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.2rem' }}>✕</button>
        </div>

        {/* ── Mode switch ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '0.25rem' }}>Toolchain</span>
          {([['wafpass','WAF++ CLI'],['checkov','Checkov']] as [GuideMode,string][]).map(([m, label]) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              style={{
                padding: '0.4rem 1rem', borderRadius: '8px', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.8rem',
                border: `2px solid ${mode === m ? (m === 'wafpass' ? '#0094FF' : '#7c3aed') : 'var(--border)'}`,
                background: mode === m ? (m === 'wafpass' ? 'rgba(0,148,255,.1)' : 'rgba(124,58,237,.1)') : 'transparent',
                color: mode === m ? (m === 'wafpass' ? '#0094FF' : '#7c3aed') : 'var(--muted)',
                transition: 'all 0.15s',
              }}
            >{label}</button>
          ))}
          {mode === 'checkov' && (
            <button
              onClick={onDownloadPack}
              style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.875rem', borderRadius: '8px', border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
            >↓ Checkov Pack ({totalChecks})</button>
          )}
        </div>

        {/* ── Sub-tabs ── */}
        <div style={{ display: 'flex', gap: 0, padding: '0 1.5rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {tabs.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: '0.5rem 0.875rem', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: '0.8rem', fontWeight: 600,
              color: tab === key ? (mode === 'wafpass' ? '#0094FF' : '#7c3aed') : 'var(--muted)',
              borderBottom: tab === key ? `2px solid ${mode === 'wafpass' ? '#0094FF' : '#7c3aed'}` : '2px solid transparent',
              marginBottom: '-1px', whiteSpace: 'nowrap',
            }}>{label}</button>
          ))}
        </div>

        {/* ── Body ── */}
        <div style={{ overflowY: 'auto', padding: '0.5rem 1.5rem 1.5rem', flex: 1 }}>

          {/* ═══════════ WAF++ CLI ═══════════ */}

          {mode === 'wafpass' && tab === 'quickstart' && (
            <div>
              <p style={{ ...p, marginTop: '1rem' }}>WAF++ PASS is a Python CLI that scans Terraform against your security controls. Framework controls are built-in; you can add your own on top.</p>

              <div style={sh}>{num(1)} Install</div>
              <CB id="wp-install" code={`# From PyPI (once published):\npip install wafpass-core\n\n# Or from source (monorepo):\ngit clone https://github.com/your-org/waf-plus-plus\ncd waf-plus-plus/pass\npip install -e .`} />

              <div style={sh}>{num(2)} Run your first scan</div>
              <CB id="wp-scan" code={`# Scan a Terraform directory — framework controls loaded automatically:\nwafpass check ./terraform/\n\n# Push results to the wafpass-server dashboard:\nwafpass check ./terraform/ --push http://localhost:8000`} />

              <div style={sh}>{num(3)} Understand the output</div>
              <p style={p}>Each finding shows the control ID, severity, resource address, and remediation hint. The exit code is non-zero when any FAIL finding exists.</p>
              <CB id="wp-output" code={`[FAIL] SEC-001 (critical) — aws_s3_bucket.data\n        Ensure S3 buckets have server-side encryption enabled\n        Remediation: add server_side_encryption_configuration block\n\n[PASS] SEC-002\n[PASS] COST-001\n\nScore: 87/100  |  2 critical  |  3 high  |  1 medium`} />

              <div style={sh}>{num(4)} Filter and skip</div>
              <CB id="wp-filter" code={`# Only run security pillar controls:\nwafpass check ./terraform/ --pillar security\n\n# Suppress a specific control (add to .wafpass-skip.yml):\nwafpass check ./terraform/ --skip SEC-003`} />
            </div>
          )}

          {mode === 'wafpass' && tab === 'controls' && (
            <div>
              <p style={{ ...p, marginTop: '1rem' }}>Custom controls extend the built-in framework. Author them with the CLI wizard or the <strong>New Control</strong> button above, then reference them at scan time.</p>

              <div style={sh}>Generate a new control (CLI wizard)</div>
              <CB id="wp-gen" code={`# Interactive 7-step wizard — mirrors the UI wizard:\nwafpass control generate\n\n# Non-interactive from a JSON/YAML spec file:\nwafpass control generate --non-interactive --spec ./my-control.json\n\n# Automatically push to server after creation:\nwafpass control generate --server-url http://localhost:8000`} />

              <div style={sh}>Validate a control file</div>
              <CB id="wp-val" code={`wafpass control validate ./controls/SEC-099.yml\n# ✓ SEC-099 is valid`} />

              <div style={sh}>Inspect controls</div>
              <CB id="wp-list" code={`# List all controls discovered in a directory:\nwafpass control list\nwafpass control list --controls-dir ./my-controls/\n\n# Show full detail for one control:\nwafpass control show SEC-001`} />

              <div style={sh}>Use custom controls in a scan</div>
              <CB id="wp-custom-scan" code={`# Option 1 — load from a local directory of YAML files\n#  (download YAML via the Export button in the control detail view):\nwafpass check ./terraform/ --controls-dir ./my-controls/\n\n# Option 2 — pull live from wafpass-server DB:\nwafpass check ./terraform/ --server-url http://localhost:8000\n\n# Both framework + custom controls run together:\nwafpass check ./terraform/ \\\n  --controls-dir ./my-controls/ \\\n  --push http://localhost:8000`} />

              <div style={sh}>Control file format (YAML)</div>
              <CB id="wp-yaml" code={`# controls/SEC-099.yml\n# Generated by wafpass control generate — do not edit manually\nid: SEC-099\npillar: security\nseverity: high\ntype:\n- configuration\n- iac\ndescription: |\n  All RDS instances must have deletion protection enabled\n  to prevent accidental database removal.\nchecks:\n  - id: tf.rds_deletion_protection\n    engine: terraform\n    description: Check deletion_protection = true\n    expected: "deletion_protection attribute is set to true"`} />
            </div>
          )}

          {mode === 'wafpass' && tab === 'dashboard' && (
            <div>
              <p style={{ ...p, marginTop: '1rem' }}>Push scan results to wafpass-server so they appear in this dashboard. Integrate with your CI/CD pipeline for continuous visibility.</p>

              <div style={sh}>Push results after a scan</div>
              <CB id="wp-push" code={`wafpass check ./terraform/ --push http://localhost:8000\n\n# With project + branch metadata:\nwafpass check ./terraform/ \\\n  --push http://localhost:8000 \\\n  --project myapp \\\n  --branch main \\\n  --git-sha $(git rev-parse HEAD)`} />

              <div style={sh}>GitHub Actions — full pipeline</div>
              <CB id="wp-gha" code={
'# .github/workflows/wafpass.yml\n' +
'name: WAF++ Scan\n' +
'on: [push, pull_request]\n' +
'\n' +
'jobs:\n' +
'  wafpass:\n' +
'    runs-on: ubuntu-latest\n' +
'    steps:\n' +
'      - uses: actions/checkout@v4\n' +
'\n' +
'      - name: Install WAF++ PASS\n' +
'        run: pip install wafpass-core\n' +
'\n' +
'      - name: Run WAF++ scan\n' +
'        run: |\n' +
'          wafpass check ./terraform/ \\\n' +
'            --push ${{ secrets.WAFPASS_SERVER_URL }} \\\n' +
'            --project ${{ github.repository }} \\\n' +
'            --branch ${{ github.ref_name }} \\\n' +
'            --git-sha ${{ github.sha }}'
              } />

              <div style={sh}>GitLab CI</div>
              <CB id="wp-gl" code={`wafpass-scan:\n  image: python:3.12-slim\n  stage: test\n  script:\n    - pip install wafpass-core\n    - wafpass check ./terraform/\n        --push $WAFPASS_SERVER_URL\n        --project "$CI_PROJECT_PATH"\n        --branch "$CI_COMMIT_BRANCH"\n        --git-sha "$CI_COMMIT_SHA"\n  allow_failure: true`} />

              <div style={sh}>Server setup (docker compose)</div>
              <CB id="wp-docker" code={`# Start the full stack locally:\ngit clone https://github.com/your-org/waf-plus-plus\ncd waf-plus-plus\ndocker compose up -d\n\n# Dashboard → http://localhost:3000\n# API        → http://localhost:8000`} />
            </div>
          )}

          {/* ═══════════ Checkov ═══════════ */}

          {mode === 'checkov' && tab === 'quickstart' && (
            <div>
              <p style={{ ...p, marginTop: '1rem' }}>WAF++ Checkov stubs are standard Python <code>BaseResourceCheck</code> classes. Download the pack, implement the stubs, then point Checkov at the directory.</p>

              <div style={sh}>{num(1)} Install Checkov</div>
              <CB id="ck-install" code={`pip install checkov>=3.0.0\ncheckov --version`} />

              <div style={sh}>{num(2)} Download the Checkov Pack</div>
              <p style={p}>Click <strong>↓ Checkov Pack</strong> in the toolbar above. You get a ZIP with one stub <code>.py</code> file per control ({totalChecks} total).</p>
              <button onClick={onDownloadPack} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.1rem', borderRadius: '8px', border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                ↓ Download Checkov Pack ({totalChecks} stubs)
              </button>

              <div style={sh}>{num(3)} Unzip next to your Terraform</div>
              <CB id="ck-unzip" code={`unzip wafpass_checks_*.zip -d .\n\n# Result:\n# wafpass_checks/\n# ├── __init__.py\n# ├── SEC-001.py   ← implement each stub\n# ├── SEC-002.py\n# └── ...`} />

              <div style={sh}>{num(4)} Implement the stubs</div>
              <p style={p}>Each stub raises <code>NotImplementedError</code>. See <strong>Implement a Check</strong> for a worked example before running.</p>

              <div style={sh}>{num(5)} Run a scan</div>
              <CB id="ck-run" code={`checkov -d ./terraform \\\n  --external-checks-dir ./wafpass_checks/ \\\n  --compact\n\n# Findings appear as CKV_SEC_001, CKV_COST_001, etc.`} />

              <div style={sh}>Selective execution</div>
              <CB id="ck-select" code={`# Only specific controls:\ncheckov -d ./tf --external-checks-dir ./wafpass_checks/ \\\n  --check CKV_SEC_001,CKV_COST_001\n\n# Skip a control:\ncheckov -d ./tf --external-checks-dir ./wafpass_checks/ \\\n  --skip-check CKV_SEC_002`} />
            </div>
          )}

          {mode === 'checkov' && tab === 'implement' && (
            <div>
              <p style={{ ...p, marginTop: '1rem' }}>
                Each stub has a <code>scan_resource_conf(self, conf: dict)</code> method that must return
                <code> CheckResult.PASSED</code> or <code>CheckResult.FAILED</code>.
                Checkov calls it once per matching Terraform resource.
              </p>

              <div style={sh}>How <code>conf</code> is structured</div>
              <p style={p}>Checkov wraps every Terraform attribute value in a list. A resource block <code>&#123; tags = &#123; env = "prod" &#125; &#125;</code> becomes:</p>
              <CB id="ck-conf" code={`conf = {\n    "bucket":    ["my-bucket-name"],\n    "tags":      [{"env": "prod"}],\n    "versioning":[{"enabled": [True]}],\n    # nested blocks are always wrapped in lists\n}`} />

              <div style={sh}>Worked example — S3 encryption check</div>
              <CB id="ck-example" code={`# wafpass_checks/SEC-001.py\nfrom checkov.common.models.enums import CheckCategories, CheckResult\nfrom checkov.terraform.checks.resource.base_resource_check import BaseResourceCheck\n\n\nclass CheckSEC001(BaseResourceCheck):\n    """WAF++ SEC-001: S3 buckets must have server-side encryption."""\n\n    def __init__(self) -> None:\n        super().__init__(\n            name="S3 bucket has server-side encryption",\n            check_id="CKV_SEC_001",\n            categories=[CheckCategories.ENCRYPTION],\n            supported_resources=["aws_s3_bucket"],\n        )\n\n    def scan_resource_conf(self, conf: dict) -> CheckResult:\n        sse = conf.get("server_side_encryption_configuration", [{}])\n        if not sse or not sse[0]:\n            return CheckResult.FAILED\n        rule = sse[0].get("rule", [{}])\n        if not rule:\n            return CheckResult.FAILED\n        apply = rule[0].get("apply_server_side_encryption_by_default", [{}])\n        if not apply:\n            return CheckResult.FAILED\n        algo = apply[0].get("sse_algorithm", [""])[0]\n        return CheckResult.PASSED if algo in ("aws:kms", "AES256") else CheckResult.FAILED\n\n\nscanner = CheckSEC001()`} />

              <div style={sh}>Multiple resource types in one check</div>
              <CB id="ck-multi" code={`supported_resources=[\n    "aws_s3_bucket",\n    "aws_s3_bucket_server_side_encryption_configuration",\n]\n\ndef scan_resource_conf(self, conf: dict) -> CheckResult:\n    if self.supported_resource_type == \\\n            "aws_s3_bucket_server_side_encryption_configuration":\n        # new-style standalone resource — already encrypted\n        return CheckResult.PASSED\n    # legacy inline block on aws_s3_bucket\n    ...`} />

              <div style={sh}>Test your check locally</div>
              <CB id="ck-test" code={`mkdir -p tests/pass\ncat > tests/pass/main.tf << 'EOF'\nresource "aws_s3_bucket" "good" {\n  server_side_encryption_configuration {\n    rule { apply_server_side_encryption_by_default { sse_algorithm = "AES256" } }\n  }\n}\nEOF\n\ncheckov -d tests/pass \\\n  --external-checks-dir ./wafpass_checks/ \\\n  --check CKV_SEC_001\n# Expected: 1 passed, 0 failed`} />
            </div>
          )}

          {mode === 'checkov' && tab === 'cicd' && (
            <div>
              <p style={{ ...p, marginTop: '1rem' }}>Commit <code>wafpass_checks/</code> to your repo and add the steps below. Checkov outputs SARIF which GitHub/GitLab render as code-scanning alerts.</p>

              <div style={sh}>GitHub Actions</div>
              <CB id="ck-gha" code={`# .github/workflows/wafpass.yml\nname: WAF++ Checkov Scan\non: [push, pull_request]\n\njobs:\n  checkov:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n\n      - name: Run WAF++ Checkov scan\n        uses: bridgecrewio/checkov-action@v12\n        with:\n          directory: ./terraform\n          external_checks_dir: ./wafpass_checks\n          compact: "true"\n          output_format: sarif\n          output_file_path: wafpass.sarif\n        continue-on-error: true\n\n      - name: Upload to GitHub Security\n        uses: github/codeql-action/upload-sarif@v3\n        if: always()\n        with:\n          sarif_file: wafpass.sarif\n          category: wafpass`} />

              <div style={sh}>GitLab CI</div>
              <CB id="ck-gitlab" code={`wafpass-checkov:\n  image: bridgecrew/checkov:latest\n  stage: test\n  script:\n    - checkov -d ./terraform\n        --external-checks-dir ./wafpass_checks/\n        --output junitxml > wafpass.xml\n  artifacts:\n    when: always\n    reports:\n      junit: wafpass.xml`} />

              <div style={sh}>Pre-commit hook</div>
              <CB id="ck-precommit" code={`# .pre-commit-config.yaml\nrepos:\n  - repo: https://github.com/bridgecrewio/checkov\n    rev: "3.0.0"\n    hooks:\n      - id: checkov\n        args: [--external-checks-dir, wafpass_checks, --compact]`} />

              <div style={sh}>Soft-fail rollout strategy</div>
              <p style={p}>During rollout, fail only on <code>critical</code> controls and warn on the rest:</p>
              <CB id="ck-soft" code={`checkov -d ./terraform \\\n  --external-checks-dir ./wafpass_checks/ \\\n  --hard-fail-on CKV_SEC_001,CKV_SEC_002 \\\n  --soft-fail-on HIGH,MEDIUM,LOW`} />
            </div>
          )}

        </div>
      </div>
    </>
  )
}

// ── Wizard modal ──────────────────────────────────────────────────────────────

interface WizardModalProps {
  onClose: () => void
  onCreated: (c: CatalogueControl) => void
}

function WizardModal({ onClose, onCreated }: WizardModalProps) {
  const [step, setStep] = useState(0)
  const [state, setState] = useState<WizardState>({
    description: '',
    pillar: 'security',
    id: 'CUS-001',
    severity: 'medium',
    types: ['governance'],
    checks: [{ ...EMPTY_CHECK }],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedControl, setSavedControl] = useState<CatalogueControl | null>(null)

  function update(patch: Partial<WizardState>) {
    setState(prev => ({ ...prev, ...patch }))
  }

  function canAdvance(): boolean {
    switch (step) {
      case 0: return state.description.trim().length >= 20
      case 1: return ALL_PILLARS.includes(state.pillar)
      case 2: return state.id.trim().length > 0 && ALL_SEVERITIES.includes(state.severity)
      case 3: return state.types.length > 0
      case 4: return state.checks.length > 0 && state.checks.every(c => c.id && c.description && c.expected)
      case 5: return true
      case 6: return false // handled by save button
      default: return true
    }
  }

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      const result = await createCatalogueControl({
        id: state.id.trim().toUpperCase(),
        pillar: state.pillar,
        severity: state.severity,
        type: state.types as CatalogueControl['type'],
        description: state.description.trim(),
        checks: state.checks,
        source: 'dashboard',
        regulatory_mapping: [],
      })
      setSavedControl(result)
      onCreated(result)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const isLastStep    = step === WIZARD_STEPS.length - 1
  const stepLabel     = WIZARD_STEPS[step].label
  const stepsLeft     = WIZARD_STEPS.length - 1 - step
  const bodyRef       = useRef<HTMLDivElement>(null)

  // Scroll body to top on step change
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }) }, [step])

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 99 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '660px', maxWidth: '95vw', maxHeight: '90vh',
        background: '#fff', borderRadius: '16px', boxShadow: '0 32px 80px rgba(15,23,42,.22)',
        display: 'flex', flexDirection: 'column', zIndex: 100, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '1rem 1.5rem 0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>New Custom Control</div>
            <div style={{ fontSize: '0.73rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
              Step {step + 1} of {WIZARD_STEPS.length} — <strong style={{ color: 'var(--text)' }}>{stepLabel}</strong>
              {stepsLeft > 0 && <span style={{ marginLeft: '0.4rem', color: 'var(--muted)' }}>· {stepsLeft} step{stepsLeft !== 1 ? 's' : ''} remaining</span>}
              {savedControl && <span style={{ marginLeft: '0.4rem', color: '#059669', fontWeight: 700 }}>· saved ✓</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.2rem', lineHeight: 1, marginTop: '0.1rem' }}>✕</button>
        </div>

        {/* Step stream */}
        <StepStream step={step} />

        {/* Body */}
        <div ref={bodyRef} style={{ overflowY: 'auto', padding: '1.25rem 1.5rem', flex: 1 }}>
          {step === 0 && <Step1Describe state={state} onChange={update} />}
          {step === 1 && <Step2Pillar  state={state} onChange={update} />}
          {step === 2 && <Step3Classify state={state} onChange={update} />}
          {step === 3 && <Step4Types   state={state} onChange={update} />}
          {step === 4 && <Step5Checks  state={state} onChange={update} />}
          {step === 5 && <Step6Preview state={state} />}
          {step === 6 && (
            <Step7Save
              state={state} saving={saving} error={error}
              savedControl={savedControl} onSave={handleSave}
            />
          )}
        </div>

        {/* Footer nav */}
        <div style={{ padding: '0.875rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            style={{ padding: '0.45rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', cursor: step === 0 ? 'default' : 'pointer', fontSize: '0.8rem', color: step === 0 ? 'var(--muted)' : 'var(--text)', opacity: step === 0 ? 0.4 : 1 }}
          >← Previous</button>

          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
            {step + 1} / {WIZARD_STEPS.length}
          </div>

          {!isLastStep ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canAdvance()}
              style={{
                padding: '0.45rem 1.1rem', borderRadius: '8px', border: 'none',
                background: canAdvance() ? '#0094FF' : '#94a3b8',
                color: '#fff', cursor: canAdvance() ? 'pointer' : 'default',
                fontSize: '0.8rem', fontWeight: 700, opacity: canAdvance() ? 1 : 0.65,
              }}
            >Next →</button>
          ) : (
            <button
              onClick={onClose}
              style={{ padding: '0.45rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text)' }}
            >{savedControl ? 'Done' : 'Cancel'}</button>
          )}
        </div>
      </div>
    </>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ ctrl, onClose }: { ctrl: UnifiedControl; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 99 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '700px', maxWidth: '95vw', maxHeight: '90vh',
        background: '#fff', borderRadius: '14px', boxShadow: '0 24px 64px rgba(15,23,42,.18)',
        display: 'flex', flexDirection: 'column', zIndex: 100, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '1.1rem 1.5rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <code style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>{ctrl.id}</code>
              <Pill label={ctrl.pillar} color={pillarColor(ctrl.pillar)} />
              <Pill label={ctrl.severity} color={sevColor(ctrl.severity)} />
              {sourceBadge(ctrl.isCustom)}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.2rem', lineHeight: 1, flexShrink: 0 }}>✕</button>
          </div>
          {ctrl.type.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.5rem' }}>
              {ctrl.type.map(t => <Tag key={t} label={t} />)}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Description */}
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Description</div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{ctrl.description.trim()}</p>
          </div>

          {/* Core: rationale + regulatory */}
          {ctrl.core?.rationale && (
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Why it matters</div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.6 }}>{ctrl.core.rationale}</p>
            </div>
          )}

          {ctrl.core && (ctrl.core.regulatory_mapping?.length ?? 0) > 0 && (
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Regulatory mapping</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {ctrl.core.regulatory_mapping.map(rm => (
                  <div key={rm.framework} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', minWidth: '120px' }}>{rm.framework}</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      {rm.controls.map(c => <Tag key={c} label={c} />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Core: checks */}
          {ctrl.core && (ctrl.core.checks?.length ?? 0) > 0 && (
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Checks ({ctrl.core.checks.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {ctrl.core.checks.map(ch => (
                  <div key={ch.id} style={{ background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                      <code style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)' }}>{ch.id}</code>
                      <Pill label={ch.severity} color={sevColor(ch.severity)} />
                    </div>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.5 }}>{ch.title}</p>
                    {ch.remediation && (
                      <pre style={{ margin: '0.5rem 0 0', background: '#0f172a', color: '#e2e8f0', borderRadius: '6px', padding: '0.6rem 0.75rem', fontSize: '0.73rem', overflowX: 'auto', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{ch.remediation}</pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom: checks */}
          {ctrl.custom && ctrl.custom.checks.length > 0 && (
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Checks ({ctrl.custom.checks.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {ctrl.custom.checks.map(ch => (
                  <div key={ch.id} style={{ background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                      <code style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)' }}>{ch.id}</code>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.1rem 0.45rem', borderRadius: '999px', background: `${engineColor(ch.engine)}18`, color: engineColor(ch.engine), fontSize: '0.68rem', fontWeight: 700, border: `1px solid ${engineColor(ch.engine)}30` }}>{ch.engine}</span>
                    </div>
                    <p style={{ margin: '0 0 0.35rem', fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.5 }}>{ch.description}</p>
                    <div style={{ background: '#0f172a', borderRadius: '6px', padding: '0.55rem 0.75rem', fontSize: '0.73rem', color: '#94a3b8', lineHeight: 1.6 }}>
                      <span style={{ color: '#64748b', marginRight: '0.4rem' }}>Expected:</span>
                      <span style={{ color: '#e2e8f0' }}>{ch.expected}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Download buttons — available for both custom and framework controls */}
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Export</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {ctrl.custom && (
                <button
                  onClick={() => downloadText(`${ctrl.id}.yml`, toYaml(ctrl.custom!), 'text/yaml')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, background: 'rgba(0,148,255,.1)', color: '#0094FF', border: '1px solid rgba(0,148,255,.3)' }}
                >↓ YAML</button>
              )}
              {ctrl.core && (
                <button
                  onClick={() => downloadText(`${ctrl.id}.yml`, toYamlFromCore(ctrl.core!), 'text/yaml')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, background: 'rgba(0,148,255,.1)', color: '#0094FF', border: '1px solid rgba(0,148,255,.3)' }}
                >↓ YAML</button>
              )}
              <button
                onClick={() => {
                  const content = ctrl.custom ? toCheckov(ctrl.custom) : toCheckovFromCore(ctrl.core!)
                  downloadText(`${ctrl.id}.py`, content, 'text/x-python')
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, background: 'rgba(124,58,237,.1)', color: '#7c3aed', border: '1px solid rgba(124,58,237,.3)' }}
              >↓ Checkov stub</button>
            </div>
          </div>

          {/* CLI usage */}
          <CliUsage controlId={ctrl.id} isCustom={ctrl.isCustom} />

          {/* Delete button - admin only for custom controls */}
          <DeleteControlButton ctrl={ctrl} />
        </div>
      </div>
    </>
  )
}

// ── Delete button component for admin users ────────────────────────────────────

function DeleteControlButton({ ctrl }: { ctrl: UnifiedControl }) {
  const { role } = useAuth()
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)

  if (!ctrl.isCustom || !hasMinRole(role ?? '', 'admin')) {
    return null
  }

  async function handleDelete() {
    if (!window.confirm(`Permanently delete control ${ctrl.id}?`)) return
    setDeleting(true)
    try {
      await deleteCatalogueControl(ctrl.id)
      setDeleted(true)
    } catch (e) {
      alert(`Failed to delete: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setDeleting(false)
    }
  }

  if (deleted) {
    return (
      <div style={{ fontSize: '0.68rem', color: '#059669', padding: '0.5rem', background: '#05966912', borderRadius: '8px', textAlign: 'center' }}>
        ✓ Deleted
      </div>
    )
  }

  return (
    <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Danger Zone</div>
      <button
        onClick={handleDelete}
        disabled={deleting}
        style={{
          padding: '0.5rem 0.9rem', borderRadius: '8px', border: '1px solid #DA2C38',
          background: '#DA2C3812', color: '#DA2C38', fontWeight: 700, fontSize: '0.78rem',
          cursor: deleting ? 'default' : 'pointer', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '0.4rem'
        }}
      >
        {deleting ? 'Deleting…' : 'Delete Custom Control'}
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type TabFilter = 'all' | 'framework' | 'custom'

interface Props {
  coreControls: ControlMeta[]
}

export default function ControlsCataloguePage({ coreControls }: Props) {
  const isInitialRender = useRef(true)
  if (isInitialRender.current) {
    // Debug logging disabled - removed
  }
  isInitialRender.current = false

  const [customControls, setCustomControls] = useState<CatalogueControl[]>([])
  const [loading, setLoading]               = useState(true)
  const [apiError, setApiError]             = useState<string | null>(null)
  const [selected, setSelected]             = useState<UnifiedControl | null>(null)
  const [showWizard, setShowWizard]         = useState(false)
  const [showGuide, setShowGuide]           = useState(false)
  const [search, setSearch]                 = useState('')
  const [pillarFilter, setPillarFilter]     = useState<string[]>([])
  const [severityFilter, setSeverityFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter]         = useState<string[]>([])
  const [tab, setTab]                       = useState<TabFilter>('all')
  const [packInfo, setPackInfo]             = useState<ActivePackInfo | null>(null)
  const [packLoading, setPackLoading]       = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchCatalogueControls({ per_page: 200 })
      .then(({ controls }) => setCustomControls(controls))
      .catch((e: Error) => setApiError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setPackLoading(true)
    fetchActivePackInfo()
      .then(info => setPackInfo(info))
      .catch(() => setPackInfo(null))
      .finally(() => setPackLoading(false))
  }, [])

  // Framework controls: WAF- prefix controls from both run.controls_meta and server's custom controls
  // Custom controls: non-WAF- controls from server's custom controls catalogue
  const frameworkFromScan = coreControls.filter(c => c.id.startsWith('WAF-'))
  const frameworkFromCatalogue = customControls.filter(c => c.id.startsWith('WAF-') && !frameworkFromScan.find(s => s.id === c.id))
  const frameworkControlIds = new Set([...frameworkFromScan, ...frameworkFromCatalogue].map(c => c.id))

  // Helper: get type from framework control by id, or infer from pillar if not found
  const getFrameworkType = (id: string, pillar: string): string[] => {
    // First, try to find the type from framework controls in the scan
    const ctrl = frameworkFromScan.find(c => c.id === id)
    if (ctrl?.category) return [ctrl.category]

    // Infer type from pillar if control type is empty
    // Handle both singular and plural pillar names (operations/operational, sovereignty/sovereign)
    const pillarKey = pillar.toLowerCase().replace(/s$/, '')  // Remove trailing 's' for plural
    switch (pillarKey) {
      case 'security': return ['identity', 'governance']
      case 'cost': return ['governance', 'configuration']
      case 'performance': return ['configuration', 'infrastructure']
      case 'reliability': return ['governance', 'configuration']
      case 'operational': case 'operations': return ['governance', 'configuration']
      case 'sovereign': case 'sovereignty': return ['governance', 'identity']
      case 'sustainability': return ['governance', 'configuration']
      default: return []
    }
  }

  const allControls: UnifiedControl[] = [
    ...frameworkFromScan.map(c => fromCore(c)),
    // WAF- controls from catalogue should be treated as framework (not custom)
    // Use their actual type from catalogue; fall back to inferred type if empty
    ...frameworkFromCatalogue.map(c => {
      const controlType = c.type && c.type.length > 0 ? c.type : getFrameworkType(c.id, c.pillar)
      return {
        id: c.id, pillar: c.pillar, severity: c.severity,
        type: controlType,
        description: c.description,
        checksCount: c.checks?.length ?? 0,
        isCustom: false, custom: c,
      }
    }),
    ...customControls.filter(c => !frameworkControlIds.has(c.id)).map(c => fromCustom(c)),
  ].sort((a, b) => a.id.localeCompare(b.id))

  const filtered = allControls.filter(c => {
    if (tab === 'framework' && c.isCustom)  return false
    if (tab === 'custom'    && !c.isCustom) return false
    if (pillarFilter.length   > 0 && !pillarFilter.includes(c.pillar?.toLowerCase()))   return false
    if (severityFilter.length > 0 && !severityFilter.includes(c.severity?.toLowerCase())) return false
    if (typeFilter.length     > 0 && !typeFilter.some(f => c.type.includes(f)))           return false
    if (search) {
      const q = search.toLowerCase()
      return c.id.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.pillar.toLowerCase().includes(q)
    }
    return true
  })

  function togglePillar(p: string)   { setPillarFilter(prev   => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]) }
  function toggleSeverity(s: string) { setSeverityFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]) }
  function toggleType(t: string)     { setTypeFilter(prev     => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]) }

  const frameworkCount = allControls.filter(c => !c.isCustom).length
  const customCount    = allControls.filter(c =>  c.isCustom).length

  function downloadPack() {
    const controls = tab === 'framework' ? allControls.filter(c => !c.isCustom)
      : tab === 'custom' ? allControls.filter(c => c.isCustom)
      : allControls
    const files = buildPackFiles(controls)
    const zip = makeZip(files)
    downloadZip(`wafpass_checks_${new Date().toISOString().split('T')[0]}.zip`, zip)
  }

  const packCount = tab === 'framework' ? frameworkCount
    : tab === 'custom' ? customCount
    : allControls.length

  // Filter bar render

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', zIndex: 1 }}>
      {/* ── Active Control Pack Banner ────────────────────────────────────── */}
      {!packLoading && packInfo && (
        <div className="card" style={{
          display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap',
          borderLeft: '4px solid var(--waf-brand)',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: 'rgba(0,148,255,0.12)', border: '1px solid rgba(0,148,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" fill="none" stroke="var(--waf-brand)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 2 }}>
              Active Control Pack
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--waf-brand)', fontFamily: 'monospace' }}>
                {packInfo.version}
              </span>
              {packInfo.description && (
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {packInfo.description}
                </span>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <div><strong style={{ color: 'var(--text-primary)' }}>{packInfo.control_count}</strong> controls</div>
            <div>activated {new Date(packInfo.activated_at || '').toLocaleDateString()}</div>
          </div>
        </div>
      )}

      {/* Tab bar + New Control button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.2rem' }}>
          {([
            ['all',       `All (${allControls.length})`],
            ['framework', `WAF++ Framework (${frameworkCount})`],
            ['custom',    `Custom (${customCount})`],
          ] as [TabFilter, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: '0.3rem 0.85rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontSize: '0.78rem', fontWeight: 600,
              background: tab === key ? '#0094FF' : 'transparent',
              color: tab === key ? '#fff' : 'var(--muted)',
            }}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Download YAML Pack */}
          <button
            onClick={async () => {
              try {
                const blob = await downloadControlsZip()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `wafpass_controls_${new Date().toISOString().split('T')[0]}.zip`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
              } catch (e) {
                alert('Failed to download controls: ' + (e instanceof Error ? e.message : 'Unknown error'))
              }
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', borderRadius: '8px', border: '1px solid rgba(0,148,255,.35)', background: 'rgba(0,148,255,.08)', color: '#0094FF', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Download Controls YAML
            <span style={{ background: 'rgba(0,148,255,.15)', borderRadius: '999px', padding: '0.05rem 0.45rem', fontSize: '0.68rem' }}>{allControls.length}</span>
          </button>
          {/* Checkov Pack */}
          <button
            onClick={downloadPack}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', borderRadius: '8px', border: '1px solid rgba(124,58,237,.35)', background: 'rgba(124,58,237,.08)', color: '#7c3aed', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Checkov Pack
            <span style={{ background: 'rgba(124,58,237,.15)', borderRadius: '999px', padding: '0.05rem 0.45rem', fontSize: '0.68rem' }}>{packCount}</span>
          </button>
          <button
            onClick={() => setShowGuide(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            How to implement
          </button>
          {/* New Control */}
          <button
            onClick={() => setShowWizard(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', borderRadius: '8px', border: 'none', background: '#0094FF', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Control
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', flexShrink: 0 }} key="filter-bar-0">
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text" placeholder="Search by ID or description…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.8rem', background: 'var(--bg)', color: 'var(--text)', outline: 'none', minWidth: '220px' }}
          />
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginLeft: 'auto' }}>
            {filtered.length} of {allControls.length}
            {apiError && <span style={{ color: '#f97316', marginLeft: '0.5rem' }}>· custom controls unavailable</span>}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center', flex: '0 0 auto' }} data-debug="pillar-filter">
          <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '0.2rem', flex: '0 0 auto' }}>Pillar</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center' }}>
            {(() => ALL_PILLARS.map(p => <TogglePill key={p} label={p} color={pillarColor(p)} active={pillarFilter.includes(p)} onClick={() => togglePillar(p)} />))()}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center', flex: '0 0 auto' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '0.2rem', flex: '0 0 auto' }}>Severity</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center' }}>
            {(() => ALL_SEVERITIES.map(s => <TogglePill key={s} label={s} color={sevColor(s)} active={severityFilter.includes(s)} onClick={() => toggleSeverity(s)} />))()}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center', flex: '0 0 auto' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '0.2rem', flex: '0 0 auto' }}>Type</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center' }}>
            {(() => ALL_TYPES.map(t => <TogglePill key={t} label={t} color={typeColor(t)} active={typeFilter.includes(t)} onClick={() => toggleType(t)} />))()}
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', color: 'var(--muted)', gap: '0.5rem' }}>
          <div className="spinner" />Loading…
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
              {tab === 'custom' && customCount === 0
                ? <><strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text)' }}>No custom controls yet</strong>Click <strong>New Control</strong> above to author one, or run <code>wafpass control generate</code> from the CLI.</>
                : pillarFilter.length === 1 && pillarFilter.includes('agentic')
                  ? <><strong style={{ display: 'block', marginBottom: '0.5rem', color: '#ec4899' }}>Agentic Pillar (Coming Soon)</strong>The agentic control checks are not yet available. Watch <a href="https://waf2p.dev" target="_blank" rel="noopener noreferrer" style={{ color: '#ec4899', fontWeight: 700 }}>waf2p.dev</a> for updates on this next-generation pillar.</>
                  : 'No controls match the current filters.'
              }
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Source', 'ID', 'Pillar', 'Severity', 'Type', 'Description', 'Checks'].map(h => (
                    <th key={h} style={{ padding: '0.65rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--bg)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((ctrl, i) => (
                  <tr
                    key={ctrl.id}
                    onClick={() => setSelected(ctrl)}
                    style={{ cursor: 'pointer', background: i % 2 === 0 ? 'transparent' : 'rgba(15,23,42,.015)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,148,255,.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(15,23,42,.015)')}
                  >
                    <td style={{ padding: '0.65rem 1rem', whiteSpace: 'nowrap' }}>{sourceBadge(ctrl.isCustom)}</td>
                    <td style={{ padding: '0.65rem 1rem', whiteSpace: 'nowrap' }}>
                      <code style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)' }}>{ctrl.id}</code>
                    </td>
                    <td style={{ padding: '0.65rem 1rem', whiteSpace: 'nowrap' }}>
                      <Pill label={ctrl.pillar} color={pillarColor(ctrl.pillar)} />
                    </td>
                    <td style={{ padding: '0.65rem 1rem', whiteSpace: 'nowrap' }}>
                      <Pill label={ctrl.severity} color={sevColor(ctrl.severity)} />
                    </td>
                    <td style={{ padding: '0.65rem 1rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                        {ctrl.type?.slice(0, 2).map(t => <Tag key={t} label={t} />)}
                        {ctrl.type?.length > 2 && <Tag label={`+${ctrl.type.length - 2}`} />}
                      </div>
                    </td>
                    <td style={{ padding: '0.65rem 1rem', maxWidth: '320px' }}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.45 }}>
                        {ctrl.description.trim()}
                      </span>
                    </td>
                    <td style={{ padding: '0.65rem 1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--muted)' }}>
                      {ctrl.checksCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Detail panel */}
      {selected && <DetailPanel ctrl={selected} onClose={() => setSelected(null)} />}

      {/* Checkov guide */}
      {showGuide && (
        <ImplementGuideModal
          totalChecks={packCount}
          onClose={() => setShowGuide(false)}
          onDownloadPack={() => { downloadPack(); setShowGuide(false) }}
        />
      )}

      {/* Wizard modal */}
      {showWizard && (
        <WizardModal
          onClose={() => setShowWizard(false)}
          onCreated={c => {
            setCustomControls(prev => [c, ...prev.filter(x => x.id !== c.id)])
            setTab('custom')
          }}
        />
      )}

    </div>
  )
}
