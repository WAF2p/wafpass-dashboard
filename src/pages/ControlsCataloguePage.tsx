import { Fragment, useEffect, useRef, useState } from 'react'
import { CatalogueControl, CatalogueCheck, ControlMeta, createCatalogueControl, fetchCatalogueControls, downloadControlsZip, fetchActivePackInfo, ActivePackInfo, deleteCatalogueControl } from '../api'
import { useAuth, hasMinRole } from '../AuthContext'
import SavedViewsControl from '../components/SavedViewsControl'
import { parseHash } from '../routing'
import { severityColor } from '../severity'
import { useI18n } from '../i18n'
import { PAGE_TITLE } from '../routing'

// ── Colours ───────────────────────────────────────────────────────────────────

const PILLAR_COLOR: Record<string, string> = {
  security: 'var(--fail)', cost: 'var(--waf-warn)', reliability: 'var(--pass)',
  operational: 'var(--waived)', operations: 'var(--waived)',
  sovereign: 'var(--waf-brand)', sovereignty: 'var(--waf-brand)',
  sustainability: 'var(--score-high)', performance: 'var(--waf-warn)', governance: 'var(--skip)',
  agentic: 'var(--waf-info)',
}
const ENGINE_COLOR: Record<string, string> = {
  terraform: 'var(--waf-info)', checkov: 'var(--waf-brand)', manual: 'var(--skip)',
}

const PILLAR_DESC_KEY: Record<string, string> = {
  security:       'pillarDescSecurity',
  cost:           'pillarDescCost',
  performance:    'pillarDescPerformance',
  reliability:    'pillarDescReliability',
  operational:    'pillarDescOperational',
  operations:     'pillarDescOperations',
  sustainability: 'pillarDescSustainability',
  sovereign:      'pillarDescSovereign',
  agentic:        'pillarDescAgentic',
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
  governance: 'var(--waf-brand)', configuration: 'var(--waf-warn)', iac: 'var(--waf-info)',
  network: 'var(--waf-brand)', identity: 'var(--waf-warn)', data: 'var(--pass)', cost: 'var(--waf-warn)',
}

const sevColor = severityColor
function pillarColor(p: string) { return PILLAR_COLOR[p?.toLowerCase()] ?? 'var(--skip)' }
function typeColor(t: string)   { return TYPE_COLOR[t?.toLowerCase()]   ?? 'var(--skip)' }
function engineColor(e: string) { return ENGINE_COLOR[e?.toLowerCase()] ?? 'var(--skip)' }

// ── Shared components ─────────────────────────────────────────────────────────

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '0.15rem 0.55rem', borderRadius: '999px',
      background: `color-mix(in srgb, ${color} 13%, transparent)`, color,
      fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

function Tag({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-flex', padding: '0.1rem 0.4rem', borderRadius: '4px',
      fontSize: '0.7rem', fontWeight: 600,
      background: 'color-mix(in srgb, var(--text) 7%, transparent)', color: 'var(--muted)',
    }}>{label}</span>
  )
}

function TogglePill({ label, color, active, onClick }: { label: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '0.2rem 0.6rem', borderRadius: '999px', cursor: 'pointer',
      fontSize: '0.72rem', fontWeight: 700,
      background: active ? color : `color-mix(in srgb, ${color} 9%, transparent)`,
      color: active ? '#fff' : color,
      border: `1px solid color-mix(in srgb, ${color} 27%, transparent)`,
      whiteSpace: 'nowrap',
      flex: '0 0 auto',
      minWidth: 'auto',
    }}>{label}</button>
  )
}

function SourceBadge({ isCustom }: { isCustom: boolean }) {
  const { t } = useI18n()
  return isCustom
    ? <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'color-mix(in srgb, var(--waf-info) 15%, transparent)', color: 'var(--waf-info)', border: '1px solid color-mix(in srgb, var(--waf-info) 25%, transparent)', whiteSpace: 'nowrap' }}>{t('pages.phase3.catalogue.sourceCustom')}</span>
    : <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'color-mix(in srgb, var(--waf-brand) 12%, transparent)', color: 'var(--waf-brand-ink)', border: '1px solid color-mix(in srgb, var(--waf-brand) 25%, transparent)', whiteSpace: 'nowrap' }}>{t('pages.phase3.catalogue.sourceWombat')}</span>
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
    `# Generated by wombat control generate — do not edit manually\n` +
    `# Source: ${c.id} | Pillar: ${c.pillar} | Severity: ${c.severity}\n` +
    `id: ${c.id}\npillar: ${c.pillar}\nseverity: ${c.severity}\ntype:\n${typeLines}\n` +
    `description: |\n${descLines}\n` +
    (c.checks.length > 0 ? `checks:\n${checksLines}\n` : `checks: []\n`)
  )
}

function pyIdentifier(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_]/g, '_')
  return /^[A-Za-z_]/.test(cleaned) ? cleaned : `_${cleaned}`
}

function pyString(value: string): string {
  // JSON string escaping is a valid Python string literal for the characters
  // that can appear in a control description (quotes, backslashes, newlines).
  return JSON.stringify(value)
}

function commentSafe(value: unknown): string {
  return String(value ?? '').replace(/[\r\n]+/g, ' ')
}

function toCheckov(c: CatalogueControl): string {
  const safeId = pyIdentifier(c.id)
  const cls  = 'Check' + safeId.replace(/_/g, '')
  const ckv  = 'CKV_'  + safeId.replace(/_+/g, '_')
  const desc = pyString(c.description.trim().split('\n')[0].slice(0, 120))
  return (
    `# Generated by wombat control generate — do not edit manually\n` +
    `# Source: ${commentSafe(c.id)} | Pillar: ${commentSafe(c.pillar)} | Severity: ${commentSafe(c.severity)}\n\n` +
    `from checkov.common.models.enums import CheckCategories, CheckResult\n` +
    `from checkov.terraform.checks.resource.base_resource_check import BaseResourceCheck\n\n\n` +
    `class ${cls}(BaseResourceCheck):\n    """Wombat Control ${safeId}."""\n\n` +
    `    def __init__(self) -> None:\n        super().__init__(name=${desc}, check_id="${ckv}",\n` +
    `            categories=[CheckCategories.GENERAL_SECURITY], supported_resources=["*"])\n\n` +
    `    def scan_resource_conf(self, conf: dict) -> CheckResult:\n` +
    `        # TODO: implement check logic for Wombat control ${safeId}\n` +
    `        raise NotImplementedError("Stub — implement check logic for ${safeId}")\n\n\nscanner = ${cls}()\n`
  )
}

// ── Framework Checkov + ZIP pack helpers ─────────────────────────────────────

function toCheckovFromCore(c: ControlMeta): string {
  const safeId = pyIdentifier(c.id)
  const cls  = 'Check' + safeId.replace(/_/g, '')
  const ckv  = 'CKV_'  + safeId.replace(/_+/g, '_')
  const desc = pyString(c.description.trim().split('\n')[0].slice(0, 120))
  const lines = [
    `# Generated by wombat-dashboard — Wombat Framework Control`,
    `# Source: ${commentSafe(c.id)} | Pillar: ${commentSafe(c.pillar)} | Severity: ${commentSafe(c.severity)}`,
    ``,
    `from checkov.common.models.enums import CheckCategories, CheckResult`,
    `from checkov.terraform.checks.resource.base_resource_check import BaseResourceCheck`,
    ``,
    ``,
    `class ${cls}(BaseResourceCheck):`,
    `    """Wombat Control ${safeId}."""`,
    ``,
    `    def __init__(self) -> None:`,
    `        super().__init__(`,
    `            name=${desc},`,
    `            check_id="${ckv}",`,
    `            categories=[CheckCategories.GENERAL_SECURITY],`,
    `            supported_resources=["*"],`,
    `        )`,
    ``,
    `    def scan_resource_conf(self, conf: dict) -> CheckResult:`,
  ]
  if ((c.checks?.length ?? 0) > 0) {
    lines.push(`        # Wombat sub-checks to implement:`)
    for (const ch of c.checks) {
      lines.push(`        #   [${commentSafe(ch.severity?.toUpperCase() ?? '')}] ${commentSafe(ch.id)}: ${commentSafe(ch.title)}`)
      if (ch.remediation) {
        ch.remediation.trim().split('\n').slice(0, 2)
          .forEach(l => lines.push(`        #     ${commentSafe(l.trim().slice(0, 90))}`))
      }
    }
    lines.push(`        #`)
  }
  lines.push(
    `        # TODO: implement check logic for Wombat control ${safeId}`,
    `        raise NotImplementedError("Stub — implement for ${safeId}")`,
    ``,
    ``,
    `scanner = ${cls}()`,
  )
  return lines.join('\n') + '\n'
}

function toYamlFromCore(c: ControlMeta): string {
  const descLines = c.description.trim().split('\n').map(l => `  ${l}`).join('\n')
  const lines = [
    `# Wombat Framework Control — exported from wombat-dashboard`,
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
    name: 'wombat_checks/__init__.py',
    content: [
      `# Wombat Checkov checks — generated ${date}`,
      `# Controls: ${controls.length}`,
      `#`,
      `# Usage:`,
      `#   checkov -d ./terraform --external-checks-dir ./wombat_checks/`,
    ].join('\n') + '\n',
  })
  for (const ctrl of controls) {
    const content = ctrl.isCustom && ctrl.custom
      ? toCheckov(ctrl.custom)
      : ctrl.core ? toCheckovFromCore(ctrl.core) : null
    if (content) files.push({ name: `wombat_checks/${ctrl.id}.py`, content })
  }
  return files
}

// ── Wizard ────────────────────────────────────────────────────────────────────

const WIZARD_STEPS = [
  { labelKey: 'stepDescribe', subKey: 'stepDescribeSub' },
  { labelKey: 'stepPillar',   subKey: 'stepPillarSub'   },
  { labelKey: 'stepClassify', subKey: 'stepClassifySub' },
  { labelKey: 'stepTypes',    subKey: 'stepTypesSub'    },
  { labelKey: 'stepChecks',   subKey: 'stepChecksSub'   },
  { labelKey: 'stepPreview',  subKey: 'stepPreviewSub'  },
  { labelKey: 'stepSave',     subKey: 'stepSaveSub'     },
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
  const { t } = useI18n()
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', padding: '1rem 1.5rem 0.875rem',
      borderBottom: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0,
    }}>
      {WIZARD_STEPS.map((s, i) => {
        const done   = i < step
        const active = i === step
        const clr    = done ? 'var(--score-high)' : active ? 'var(--waf-brand-ink)' : 'var(--skip)'
        return (
          <Fragment key={i}>
            {i > 0 && (
              <div style={{
                flex: 1, height: '2px', marginTop: '13px',
                background: done ? 'var(--score-high)' : 'var(--border)',
              }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', minWidth: '56px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: done ? 'var(--score-high)' : active ? 'var(--waf-brand-btn)' : 'transparent',
                border: `2px solid ${clr}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: 800,
                color: (done || active) ? '#fff' : clr,
                flexShrink: 0, transition: 'background-color 0.2s, border-color 0.2s, color 0.2s',
              }}>
                {done ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: clr, textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{t(`pages.phase3.catalogue.${s.labelKey}`)}</span>
              <span style={{ fontSize: '0.7rem', color: active ? clr : 'var(--skip)', textAlign: 'center', lineHeight: 1.1, whiteSpace: 'nowrap' }}>{t(`pages.phase3.catalogue.${s.subKey}`)}</span>
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
  border: '1px solid var(--border)', fontSize: '0.85rem',
  background: 'var(--bg)', color: 'var(--text)', outline: 'none',
  boxSizing: 'border-box' as const,
}
const labelStyle: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  marginBottom: '0.35rem', display: 'block',
}

function Step1Describe({ state, onChange }: { state: WizardState; onChange: (p: Partial<WizardState>) => void }) {
  const { t } = useI18n()
  const [isFocused, setIsFocused] = useState(false)
  const charCount = state.description.trim().length
  const isShort = charCount < 20
  const isLongEnough = charCount >= 20

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ background: 'color-mix(in srgb, var(--waf-brand) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--waf-brand) 20%, transparent)', borderRadius: '10px', padding: '0.875rem 1rem', fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.6 }}>
        {t('pages.phase3.catalogue.step1Intro')}
      </div>
      <div>
        <label style={labelStyle}>{t('pages.phase3.catalogue.requirementDescription')}</label>
        <textarea
          value={state.description}
          onChange={e => onChange({ description: e.target.value })}
          rows={5}
          placeholder={t('pages.phase3.catalogue.descriptionPlaceholder')}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, outline: isFocused && isShort ? '2px solid var(--waf-warn)' : 'none' }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoFocus
        />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.3rem', fontSize: '0.7rem' }}>
          <span style={{ color: isLongEnough ? 'var(--score-high)' : 'var(--fail)', fontWeight: 700 }}>
            {isLongEnough ? '✓' : isFocused ? '✏' : '•'} {isLongEnough ? t('pages.phase3.catalogue.charactersCount', { count: charCount }) : t('pages.phase3.catalogue.moreNeeded', { count: 20 - charCount })}
          </span>
          <div style={{ flex: 1, height: 3, borderRadius: 999, background: 'var(--border)', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ height: '100%', width: `${Math.min(100, (charCount / 500) * 100)}%`, background: isLongEnough ? 'var(--score-high)' : 'var(--waf-warn)', transition: 'width 0.3s ease' }} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', padding: '0.35rem 0.5rem', background: 'color-mix(in srgb, var(--waf-brand) 8%, transparent)', borderRadius: '6px' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--waf-brand-ink)' }}>{t('pages.phase3.catalogue.noteLabel')}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--skip)' }}>
            {t('pages.phase3.catalogue.customControlsUse')} <strong>CUS-</strong> {t('pages.phase3.catalogue.cusPrefixNote')}
          </span>
        </div>
        {isFocused && isShort && (
          <div style={{ marginTop: '0.25rem', fontSize: '0.7rem', color: 'var(--waf-warn)', background: 'color-mix(in srgb, var(--waf-warn) 8%, transparent)', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
            {t('pages.phase3.catalogue.tipLength')}
          </div>
        )}
      </div>
    </div>
  )
}

function Step2Pillar({ state, onChange }: { state: WizardState; onChange: (p: Partial<WizardState>) => void }) {
  const { t } = useI18n()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.25rem', lineHeight: 1.5 }}>
        {t('pages.phase3.catalogue.step2Intro')}
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
              background: active ? `color-mix(in srgb, ${color} 6%, transparent)` : 'var(--bg)',
              transition: 'border-color 0.15s, background-color 0.15s, color 0.15s, box-shadow 0.15s',
            }}
          >
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
              background: color, boxShadow: active ? `0 0 0 3px color-mix(in srgb, ${color} 19%, transparent)` : 'none',
            }} />
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: active ? color : 'var(--text)', display: 'block', textTransform: 'capitalize' }}>
                {PILLAR_PREFIX[p]} — {p}
              </span>
              <span style={{ fontSize: '0.73rem', color: 'var(--muted)', lineHeight: 1.4 }}>{t(`pages.phase3.catalogue.${PILLAR_DESC_KEY[p]}`)}</span>
            </div>
            {active && <span style={{ fontSize: '0.9rem', color }}>✓</span>}
          </button>
        )
      })}
    </div>
  )
}

function Step3Classify({ state, onChange }: { state: WizardState; onChange: (p: Partial<WizardState>) => void }) {
  const { t } = useI18n()
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
        <label style={labelStyle}>{t('pages.phase3.catalogue.controlId')}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <code style={{ fontSize: '0.85rem', color: 'var(--waf-brand-ink)', padding: '0.45rem 0.75rem', borderRadius: '8px', background: 'var(--bg)', border: '1px solid var(--border)', fontFamily: 'monospace' }}>
            CUS-
          </code>
          <input
            value={customNum}
            onChange={handleChange}
            placeholder="001"
            style={{ ...inputStyle, width: '100px', outline: !isIdValid ? '2px solid var(--waf-warn)' : 'none', fontFamily: 'monospace' }}
            autoFocus
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.3rem', fontSize: '0.7rem' }}>
          <span style={{ color: isIdValid ? 'var(--score-high)' : 'var(--skip)', fontWeight: 700 }}>
            {isIdValid ? '✓' : '•'} {t('pages.phase3.catalogue.formatCus')}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', padding: '0.35rem 0.5rem', background: 'color-mix(in srgb, var(--waf-brand) 8%, transparent)', borderRadius: '6px' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--waf-brand-ink)' }}>{t('pages.phase3.catalogue.noteLabel')}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--skip)' }}>
            {t('pages.phase3.catalogue.customControlsUse')} <strong>CUS-</strong> {t('pages.phase3.catalogue.cusPrefixFixed')}
          </span>
        </div>
      </div>
      <div>
        <label style={labelStyle}>{t('pages.phase3.catalogue.severity')}</label>
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
                  background: active ? `color-mix(in srgb, ${color} 8%, transparent)` : 'var(--bg)',
                  color: active ? color : 'var(--muted)',
                  fontWeight: 700, fontSize: '0.85rem', textTransform: 'capitalize',
                  transition: 'border-color 0.15s, background-color 0.15s, color 0.15s, box-shadow 0.15s',
                }}
              >{s}</button>
            )
          })}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.3rem' }}>
          <span style={{ fontWeight: 600 }}>{t('pages.phase3.catalogue.tipLabel')}</span> {t('pages.phase3.catalogue.severityTip')}
        </div>
      </div>
    </div>
  )
}

function Step4Types({ state, onChange }: { state: WizardState; onChange: (p: Partial<WizardState>) => void }) {
  const { t } = useI18n()
  function toggle(t: string) {
    onChange({ types: state.types.includes(t) ? state.types.filter(x => x !== t) : [...state.types, t] })
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.5 }}>
        {t('pages.phase3.catalogue.step4Intro')}
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
                border: `2px solid ${active ? 'var(--waf-brand-ink)' : 'var(--border)'}`,
                background: active ? 'color-mix(in srgb, var(--waf-brand) 8%, transparent)' : 'var(--bg)',
                transition: 'border-color 0.15s, background-color 0.15s, color 0.15s, box-shadow 0.15s',
              }}
            >
              <div style={{
                width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                border: `2px solid ${active ? 'var(--waf-brand-ink)' : 'var(--border)'}`,
                background: active ? 'var(--waf-brand-btn)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {active && <span style={{ color: '#fff', fontSize: '0.7rem', lineHeight: 1 }}>✓</span>}
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: active ? 'var(--waf-brand-ink)' : 'var(--text)', textTransform: 'capitalize' }}>{t}</span>
            </button>
          )
        })}
      </div>
      {state.types.length === 0 && (
        <div style={{ fontSize: '0.75rem', color: 'var(--fail)' }}>{t('pages.phase3.catalogue.selectAtLeastOneType')}</div>
      )}
    </div>
  )
}

function Step5Checks({ state, onChange }: { state: WizardState; onChange: (p: Partial<WizardState>) => void }) {
  const { t } = useI18n()
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
          {t('pages.phase3.catalogue.step5Intro')}
        </div>
        <button onClick={add} style={{ fontSize: '0.75rem', color: 'var(--waf-brand-ink)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap', marginLeft: '0.75rem' }}>
          {t('pages.phase3.catalogue.addCheck')}
        </button>
      </div>
      {state.checks.map((ch, i) => {
        const idOk = checkHasValidId(ch)
        const engineOk = checkHasValidEngine(ch)
        const descOk = checkHasValidDescription(ch)
        const expectedOk = checkHasValidExpected(ch)
        const allOk = idOk && engineOk && descOk && expectedOk

        return (
          <div key={i} style={{ background: 'var(--bg)', borderRadius: '10px', border: `1px solid ${allOk ? 'color-mix(in srgb, var(--waf-brand) 20%, transparent)' : 'var(--border)'}`, padding: '0.875rem', transition: 'border-color 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('pages.phase3.catalogue.checkN', { n: i + 1 })}</span>
              {state.checks.length > 1 && (
                <button aria-label={t('pages.phase3.catalogue.removeCheck', { n: i + 1 })} onClick={() => remove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fail)', fontSize: '0.8rem', lineHeight: 1 }}>✕</button>
              )}
              <span style={{ fontSize: '0.7rem', color: allOk ? 'var(--score-high)' : 'var(--waf-warn)', fontWeight: 700 }}>
                {allOk ? '✓' : '✏'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ position: 'relative' }}>
                <input
                  value={ch.id}
                  onChange={e => update(i, 'id', e.target.value)}
                  placeholder={t('pages.phase3.catalogue.checkIdPlaceholder')}
                  style={{ ...inputStyle, outline: ch.id && !idOk ? '2px solid var(--waf-warn)' : 'none' }}
                />
                {ch.id && !idOk && (
                  <div style={{ position: 'absolute', bottom: '-1.15rem', left: 0, right: 0, fontSize: '0.7rem', color: 'var(--waf-warn)' }}>
                    {t('pages.phase3.catalogue.idFormatHelp')}
                  </div>
                )}
                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.2rem' }}>
                  {ch.id ? (idOk ? t('pages.phase3.catalogue.valid') : t('pages.phase3.catalogue.invalidFormat')) : t('pages.phase3.catalogue.autoSuggested')}
                </div>
              </div>
              <select value={ch.engine} onChange={e => update(i, 'engine', e.target.value)} style={{ ...inputStyle, outline: ch.engine && !engineOk ? '2px solid var(--waf-warn)' : 'none' }}>
                {ALL_ENGINES.map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
              {ch.engine && !engineOk && (
                <div style={{ position: 'absolute', bottom: '-1.2rem', left: 0, right: 0, fontSize: '0.7rem', color: 'var(--waf-warn)' }}>
                  {t('pages.phase3.catalogue.selectValidEngine')}
                </div>
              )}
            </div>
            <input
              value={ch.description}
              onChange={e => update(i, 'description', e.target.value)}
              placeholder={t('pages.phase3.catalogue.checkDescriptionPlaceholder')}
              style={{ ...inputStyle, marginBottom: '0.5rem', outline: ch.description && !descOk ? '2px solid var(--waf-warn)' : 'none' }}
            />
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '0.2rem' }}>
              {ch.description ? (descOk ? t('pages.phase3.catalogue.goodLength') : t('pages.phase3.catalogue.tooShort')) : t('pages.phase3.catalogue.describeCheckRequirement')}
            </div>
            <input
              value={ch.expected}
              onChange={e => update(i, 'expected', e.target.value)}
              placeholder={t('pages.phase3.catalogue.expectedPlaceholder')}
              style={{ ...inputStyle, outline: ch.expected && !expectedOk ? '2px solid var(--waf-warn)' : 'none' }}
            />
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
              {ch.expected ? (expectedOk ? t('pages.phase3.catalogue.valid') : t('pages.phase3.catalogue.tooShort')) : t('pages.phase3.catalogue.describeExpectedState')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', padding: '0.4rem 0.6rem', background: 'color-mix(in srgb, var(--waf-brand) 8%, transparent)', borderRadius: '6px' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--waf-brand-ink)' }}>{t('pages.phase3.catalogue.schemaHint')}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--skip)' }}>
                {t('pages.phase3.catalogue.engineHint', { engines: ALL_ENGINES.join(' | ') })}
              </span>
            </div>
          </div>
        )
      })}
      {state.checks.length === 0 && (
        <div style={{ fontSize: '0.7rem', color: 'var(--waf-warn)', padding: '0.5rem', background: 'color-mix(in srgb, var(--waf-warn) 8%, transparent)', borderRadius: '8px', textAlign: 'center' }}>
          {t('pages.phase3.catalogue.addAtLeastOneCheck')}
        </div>
      )}
    </div>
  )
}

function Step6Preview({ state }: { state: WizardState }) {
  const { t } = useI18n()
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
        {t('pages.phase3.catalogue.step6IntroBefore')} <strong>{t('pages.phase3.catalogue.previous')}</strong> {t('pages.phase3.catalogue.step6IntroAfter')}
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
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>{t('pages.phase3.catalogue.validation')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {[
            ['description', state.description.trim().length >= 20],
            ['pillar',      ALL_PILLARS.includes(state.pillar)],
            ['controlId',   /^[A-Z]+-\d+$/.test(state.id)],
            ['severity',    ALL_SEVERITIES.includes(state.severity)],
            ['types',       state.types.length > 0],
            ['checks',      state.checks.length > 0 && state.checks.every(c => c.id && c.description && c.expected)],
          ].map(([labelKey, ok]) => (
            <div key={labelKey as string} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
              <span style={{ color: ok ? 'var(--score-high)' : 'var(--fail)', fontWeight: 700 }}>{ok ? '✓' : '✗'}</span>
              <span style={{ color: ok ? 'var(--text)' : 'var(--fail)' }}>{t(`pages.phase3.catalogue.${labelKey as string}`)}</span>
              {!ok && <span style={{ color: 'var(--fail)', fontSize: '0.7rem' }}>{t('pages.phase3.catalogue.required')}</span>}
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
  const { t } = useI18n()
  if (savedControl) {
    const yaml = toYaml(savedControl)
    const ckv  = toCheckov(savedControl)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Success */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'color-mix(in srgb, var(--score-high) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--score-high) 25%, transparent)', borderRadius: '10px', padding: '0.875rem 1rem' }}>
          <span style={{ fontSize: '1.5rem', color: 'var(--score-high)' }}>✓</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--score-high)' }}>{t('pages.phase3.catalogue.controlSaved')}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
              <code style={{ fontWeight: 700, color: 'var(--text)' }}>{savedControl.id}</code> {t('pages.phase3.catalogue.storedInServerSuffix')}
            </div>
          </div>
        </div>

        {/* Downloads */}
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{t('pages.phase3.catalogue.export')}</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => downloadText(`${savedControl.id}.yml`, yaml, 'text/yaml')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, background: 'color-mix(in srgb, var(--waf-brand) 10%, transparent)', color: 'var(--waf-brand-ink)', border: '1px solid color-mix(in srgb, var(--waf-brand) 30%, transparent)' }}
            >{t('pages.phase3.catalogue.downloadYaml')}</button>
            <button
              onClick={() => downloadText(`${savedControl.id}.py`, ckv, 'text/x-python')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, background: 'color-mix(in srgb, var(--waf-info) 10%, transparent)', color: 'var(--waf-info)', border: '1px solid color-mix(in srgb, var(--waf-info) 30%, transparent)' }}
            >{t('pages.phase3.catalogue.downloadCheckovStub')}</button>
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
          ['colId',       state.id],
          ['pillar',      state.pillar],
          ['severity',    state.severity],
          ['types',       state.types.join(', ')],
          ['checks',      t('pages.phase3.catalogue.checksDefined', { count: state.checks.length })],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem' }}>
            <span style={{ fontWeight: 700, color: 'var(--muted)', minWidth: '70px' }}>{t(`pages.phase3.catalogue.${k}`)}</span>
            <span style={{ color: 'var(--text)' }}>{v}</span>
          </div>
        ))}
      </div>

      {error && <div style={{ background: 'color-mix(in srgb, var(--fail) 7.1%, transparent)', border: '1px solid color-mix(in srgb, var(--fail) 25.1%, transparent)', borderRadius: '8px', padding: '0.65rem 0.875rem', fontSize: '0.8rem', color: 'var(--fail)' }}>{error}</div>}

      <button
        onClick={onSave}
        disabled={saving || !isValid}
        style={{
          padding: '0.65rem 1.25rem', borderRadius: '10px', border: 'none',
          background: isValid ? 'var(--waf-brand-btn)' : 'var(--skip)', color: '#fff',
          fontWeight: 700, fontSize: '0.85rem', cursor: (saving || !isValid) ? 'default' : 'pointer',
          opacity: saving ? 0.75 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
        }}
      >
        {saving ? <><div className="spinner" style={{ width: '14px', height: '14px', borderTopColor: '#fff' }} />{t('pages.phase3.catalogue.saving')}</> : t('pages.phase3.catalogue.saveToServer')}
      </button>

      {!isValid && (
        <div style={{ fontSize: '0.73rem', color: 'var(--muted)', textAlign: 'center' }}>
          {t('pages.phase3.catalogue.fixValidationErrors')}
        </div>
      )}
    </div>
  )
}

// ── CLI usage block ───────────────────────────────────────────────────────────

function CliUsage({ controlId, isCustom }: { controlId: string; isCustom: boolean }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState<string | null>(null)
  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const codeBlock = (key: string, title: string, code: string) => (
    <div key={key} style={{ marginBottom: '0.75rem' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>{title}</div>
      <div style={{ position: 'relative' }}>
        <pre style={{
          margin: 0, background: '#0f172a', borderRadius: '8px', padding: '0.7rem 2.5rem 0.7rem 0.875rem',
          fontSize: '0.73rem', color: '#e2e8f0', overflowX: 'auto', lineHeight: 1.65, whiteSpace: 'pre',
        }}>{code}</pre>
        <button
          onClick={() => copy(code, key)}
          style={{ position: 'absolute', top: '0.4rem', right: '0.4rem', background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: '6px', padding: '0.2rem 0.4rem', cursor: 'pointer', color: 'var(--skip)', fontSize: '0.7rem' }}
        >{copied === key ? '✓' : t('pages.phase3.catalogue.copy')}</button>
      </div>
    </div>
  )

  return (
    <div style={{ background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--border)', padding: '0.875rem 1rem' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
        {t('pages.phase3.catalogue.useWithCli')}
      </div>
      {isCustom ? (
        <>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
            {t('pages.phase3.catalogue.customControlStored')}
          </div>
          {codeBlock('opt1', t('pages.phase3.catalogue.option1Title'),
`# Save the YAML to your controls folder, then scan:
wombat scan ./my-infra --controls-dir ./controls`
          )}
          {codeBlock('opt2', t('pages.phase3.catalogue.option2Title'),
`# No file needed — server serves the control at runtime:
wombat scan ./my-infra --server-url http://localhost:8000`
          )}
          {codeBlock('cli-gen', t('pages.phase3.catalogue.generateInteractively'),
`wombat control generate
# Then push automatically:
wombat control generate --server-url http://localhost:8000`
          )}
          {codeBlock('cli-show', t('pages.phase3.catalogue.inspectViaCli'),
`wombat control show ${controlId}`
          )}
        </>
      ) : (
        <>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
            {t('pages.phase3.catalogue.frameworkBuiltIn')}
          </div>
          {codeBlock('fw-scan', t('pages.phase3.catalogue.runScanFramework'),
`wombat scan ./my-infra`
          )}
          {codeBlock('fw-show', t('pages.phase3.catalogue.inspectThisControl'),
`wombat control show ${controlId}`
          )}
          {codeBlock('fw-list', t('pages.phase3.catalogue.listAllControls'),
`wombat control list`
          )}
        </>
      )}
    </div>
  )
}

// ── Implementation guide modal (WOMBATpass CLI + Checkov) ─────────────────────────

type GuideMode = 'wombat' | 'checkov'
type GuideTab  = 'quickstart' | 'implement' | 'cicd' | 'controls' | 'dashboard'

function ImplementGuideModal({ totalChecks, onClose, onDownloadPack }: {
  totalChecks: number
  onClose: () => void
  onDownloadPack: () => void
}) {
  const { t } = useI18n()
  const [mode, setMode] = useState<GuideMode>('wombat')
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
    <span style={{ background: 'var(--waf-brand-btn)', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, flexShrink: 0 }}>{n}</span>
  )

  function CB({ id, code }: { id: string; code: string }) {
    return (
      <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
        <pre style={dark}>{code}</pre>
        <button onClick={() => copy(code, id)} style={{ position: 'absolute', top: '0.4rem', right: '0.4rem', background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: '6px', padding: '0.2rem 0.4rem', cursor: 'pointer', color: 'var(--skip)', fontSize: '0.7rem' }}>
          {copied === id ? '✓' : t('pages.phase3.catalogue.copy')}
        </button>
      </div>
    )
  }

  // Mode-specific tab sets
  const wafTabs: [GuideTab, string][]  = [['quickstart', t('pages.phase3.catalogue.tabQuickStart')],['controls', t('pages.phase3.catalogue.tabCustomControls')],['dashboard', t('pages.phase3.catalogue.tabDashboardCi')]]
  const ckTabs: [GuideTab, string][]   = [['quickstart', t('pages.phase3.catalogue.tabQuickStart')],['implement', t('pages.phase3.catalogue.tabImplementCheck')],['cicd', t('pages.phase3.catalogue.tabCicd')]]
  const tabs = mode === 'wombat' ? wafTabs : ckTabs

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, #000000 40%, transparent)', zIndex: 99 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '740px', maxWidth: '96vw', maxHeight: '92vh',
        background: 'var(--surface)', borderRadius: '16px', boxShadow: '0 32px 80px rgba(15,23,42,.22)',
        display: 'flex', flexDirection: 'column', zIndex: 100, overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>{t('pages.phase3.catalogue.guideTitle')}</div>
            <div style={{ fontSize: '0.73rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{t('pages.phase3.catalogue.guideSubtitle', { count: totalChecks })}</div>
          </div>
          <button aria-label={t('pages.phase3.catalogue.closeGuideAria')} onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.2rem' }}>✕</button>
        </div>

        {/* ── Mode switch ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '0.25rem' }}>{t('pages.phase3.catalogue.toolchain')}</span>
          {([['wombat', t('pages.phase3.catalogue.toolchainWombat')],['checkov', t('pages.phase3.catalogue.toolchainCheckov')]] as [GuideMode,string][]).map(([m, label]) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              style={{
                padding: '0.4rem 1rem', borderRadius: '8px', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.8rem',
                border: `2px solid ${mode === m ? (m === 'wombat' ? 'var(--waf-brand-ink)' : 'var(--waf-info)') : 'var(--border)'}`,
                background: mode === m ? (m === 'wombat' ? 'color-mix(in srgb, var(--waf-brand) 10%, transparent)' : 'color-mix(in srgb, var(--waf-info) 10%, transparent)') : 'transparent',
                color: mode === m ? (m === 'wombat' ? 'var(--waf-brand-ink)' : 'var(--waf-info)') : 'var(--muted)',
                transition: 'border-color 0.15s, background-color 0.15s, color 0.15s, box-shadow 0.15s',
              }}
            >{label}</button>
          ))}
          {mode === 'checkov' && (
            <button
              onClick={onDownloadPack}
              style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.875rem', borderRadius: '8px', border: 'none', background: 'var(--waf-info)', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
            >{t('pages.phase3.catalogue.checkovPackCount', { count: totalChecks })}</button>
          )}
        </div>

        {/* ── Sub-tabs ── */}
        <div style={{ display: 'flex', gap: 0, padding: '0 1.5rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {tabs.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: '0.5rem 0.875rem', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: '0.8rem', fontWeight: 600,
              color: tab === key ? (mode === 'wombat' ? 'var(--waf-brand-ink)' : 'var(--waf-info)') : 'var(--muted)',
              borderBottom: tab === key ? `2px solid ${mode === 'wombat' ? 'var(--waf-brand-ink)' : 'var(--waf-info)'}` : '2px solid transparent',
              marginBottom: '-1px', whiteSpace: 'nowrap',
            }}>{label}</button>
          ))}
        </div>

        {/* ── Body ── */}
        <div style={{ overflowY: 'auto', padding: '0.5rem 1.5rem 1.5rem', flex: 1 }}>

          {/* ═══════════ WOMBATpass CLI ═══════════ */}

          {mode === 'wombat' && tab === 'quickstart' && (
            <div>
              <p style={{ ...p, marginTop: '1rem' }}>{t('pages.phase3.catalogue.paraWombatIntro')}</p>

              <div style={sh}>{num(1)} {t('pages.phase3.catalogue.install')}</div>
              <CB id="wp-install" code={`# From PyPI (once published):\npip install wombat-core\n\n# Or from source (monorepo):\ngit clone https://github.com/your-org/waf-plus-plus\ncd waf-plus-plus/pass\npip install -e .`} />

              <div style={sh}>{num(2)} {t('pages.phase3.catalogue.runFirstScan')}</div>
              <CB id="wp-scan" code={`# Scan a Terraform directory — framework controls loaded automatically:\nwombat check ./terraform/\n\n# Push results to the wombat-server dashboard:\nwombat check ./terraform/ --push http://localhost:8000`} />

              <div style={sh}>{num(3)} {t('pages.phase3.catalogue.understandOutput')}</div>
              <p style={p}>{t('pages.phase3.catalogue.outputExplanation')}</p>
              <CB id="wp-output" code={`[FAIL] SEC-001 (critical) — aws_s3_bucket.data\n        Ensure S3 buckets have server-side encryption enabled\n        Remediation: add server_side_encryption_configuration block\n\n[PASS] SEC-002\n[PASS] COST-001\n\nScore: 87/100  |  2 critical  |  3 high  |  1 medium`} />

              <div style={sh}>{num(4)} {t('pages.phase3.catalogue.filterAndSkip')}</div>
              <CB id="wp-filter" code={`# Only run security pillar controls:\nwombat check ./terraform/ --pillar security\n\n# Suppress a specific control (add to .wombat-skip.yml):\nwombat check ./terraform/ --skip SEC-003`} />
            </div>
          )}

          {mode === 'wombat' && tab === 'controls' && (
            <div>
              <p style={{ ...p, marginTop: '1rem' }}>{t('pages.phase3.catalogue.paraCustomControlsBefore')} <strong>{t('pages.phase3.catalogue.newControl')}</strong> {t('pages.phase3.catalogue.paraCustomControlsAfter')}</p>

              <div style={sh}>{t('pages.phase3.catalogue.generateNewControl')}</div>
              <CB id="wp-gen" code={`# Interactive 7-step wizard — mirrors the UI wizard:\nwombat control generate\n\n# Non-interactive from a JSON/YAML spec file:\nwombat control generate --non-interactive --spec ./my-control.json\n\n# Automatically push to server after creation:\nwombat control generate --server-url http://localhost:8000`} />

              <div style={sh}>{t('pages.phase3.catalogue.validateControlFile')}</div>
              <CB id="wp-val" code={`wombat control validate ./controls/SEC-099.yml\n# ✓ SEC-099 is valid`} />

              <div style={sh}>{t('pages.phase3.catalogue.inspectControls')}</div>
              <CB id="wp-list" code={`# List all controls discovered in a directory:\nwombat control list\nwombat control list --controls-dir ./my-controls/\n\n# Show full detail for one control:\nwombat control show SEC-001`} />

              <div style={sh}>{t('pages.phase3.catalogue.useCustomControlsInScan')}</div>
              <CB id="wp-custom-scan" code={`# Option 1 — load from a local directory of YAML files\n#  (download YAML via the Export button in the control detail view):\nwombat check ./terraform/ --controls-dir ./my-controls/\n\n# Option 2 — pull live from wombat-server DB:\nwombat check ./terraform/ --server-url http://localhost:8000\n\n# Both framework + custom controls run together:\nwombat check ./terraform/ \\\n  --controls-dir ./my-controls/ \\\n  --push http://localhost:8000`} />

              <div style={sh}>{t('pages.phase3.catalogue.controlFileFormat')}</div>
              <CB id="wp-yaml" code={`# controls/SEC-099.yml\n# Generated by wombat control generate — do not edit manually\nid: SEC-099\npillar: security\nseverity: high\ntype:\n- configuration\n- iac\ndescription: |\n  All RDS instances must have deletion protection enabled\n  to prevent accidental database removal.\nchecks:\n  - id: tf.rds_deletion_protection\n    engine: terraform\n    description: Check deletion_protection = true\n    expected: "deletion_protection attribute is set to true"`} />
            </div>
          )}

          {mode === 'wombat' && tab === 'dashboard' && (
            <div>
              <p style={{ ...p, marginTop: '1rem' }}>{t('pages.phase3.catalogue.paraDashboardIntro')}</p>

              <div style={sh}>{t('pages.phase3.catalogue.pushResultsAfterScan')}</div>
              <CB id="wp-push" code={`wombat check ./terraform/ --push http://localhost:8000\n\n# With project + branch metadata:\nwombat check ./terraform/ \\\n  --push http://localhost:8000 \\\n  --project myapp \\\n  --branch main \\\n  --git-sha $(git rev-parse HEAD)`} />

              <div style={sh}>{t('pages.phase3.catalogue.githubActionsFullPipeline')}</div>
              <CB id="wp-gha" code={
'# .github/workflows/wombat.yml\n' +
'name: WOMBATpass Scan\n' +
'on: [push, pull_request]\n' +
'\n' +
'jobs:\n' +
'  wombat:\n' +
'    runs-on: ubuntu-latest\n' +
'    steps:\n' +
'      - uses: actions/checkout@v4\n' +
'\n' +
'      - name: Install WOMBATpass\n' +
'        run: pip install wombat-core\n' +
'\n' +
'      - name: Run WOMBATpass scan\n' +
'        run: |\n' +
'          wombat check ./terraform/ \\\n' +
'            --push ${{ secrets.WOMBAT_SERVER_URL }} \\\n' +
'            --project ${{ github.repository }} \\\n' +
'            --branch ${{ github.ref_name }} \\\n' +
'            --git-sha ${{ github.sha }}'
              } />

              <div style={sh}>{t('pages.phase3.catalogue.gitlabCi')}</div>
              <CB id="wp-gl" code={`wombat-scan:\n  image: python:3.12-slim\n  stage: test\n  script:\n    - pip install wombat-core\n    - wombat check ./terraform/\n        --push $WOMBAT_SERVER_URL\n        --project "$CI_PROJECT_PATH"\n        --branch "$CI_COMMIT_BRANCH"\n        --git-sha "$CI_COMMIT_SHA"\n  allow_failure: true`} />

              <div style={sh}>{t('pages.phase3.catalogue.serverSetupDockerCompose')}</div>
              <CB id="wp-docker" code={`# Start the full stack locally:\ngit clone https://github.com/your-org/waf-plus-plus\ncd waf-plus-plus\ndocker compose up -d\n\n# Dashboard → http://localhost:3000\n# API        → http://localhost:8000`} />
            </div>
          )}

          {/* ═══════════ Checkov ═══════════ */}

          {mode === 'checkov' && tab === 'quickstart' && (
            <div>
              <p style={{ ...p, marginTop: '1rem' }}>{t('pages.phase3.catalogue.paraCheckovIntroBefore')} <code>BaseResourceCheck</code> {t('pages.phase3.catalogue.paraCheckovIntroAfter')}</p>

              <div style={sh}>{num(1)} {t('pages.phase3.catalogue.installCheckov')}</div>
              <CB id="ck-install" code={`pip install checkov>=3.0.0\ncheckov --version`} />

              <div style={sh}>{num(2)} {t('pages.phase3.catalogue.downloadCheckovPack')}</div>
              <p style={p}>{t('pages.phase3.catalogue.paraDownloadPackBefore')} <strong>{t('pages.phase3.catalogue.checkovPackBold')}</strong> {t('pages.phase3.catalogue.paraDownloadPackAfter')} <code>.py</code> {t('pages.phase3.catalogue.paraDownloadPackEnd', { count: totalChecks })}</p>
              <button onClick={onDownloadPack} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.1rem', borderRadius: '8px', border: 'none', background: 'var(--waf-info)', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                {t('pages.phase3.catalogue.downloadCheckovPackButton', { count: totalChecks })}
              </button>

              <div style={sh}>{num(3)} {t('pages.phase3.catalogue.unzipNextToTerraform')}</div>
              <CB id="ck-unzip" code={`unzip wombat_checks_*.zip -d .\n\n# Result:\n# wombat_checks/\n# ├── __init__.py\n# ├── SEC-001.py   ← implement each stub\n# ├── SEC-002.py\n# └── ...`} />

              <div style={sh}>{num(4)} {t('pages.phase3.catalogue.implementStubs')}</div>
              <p style={p}>{t('pages.phase3.catalogue.paraImplementStubsBefore')} <code>NotImplementedError</code>{t('pages.phase3.catalogue.paraImplementStubsMid')} <strong>{t('pages.phase3.catalogue.tabImplementCheck')}</strong> {t('pages.phase3.catalogue.paraImplementStubsAfter')}</p>

              <div style={sh}>{num(5)} {t('pages.phase3.catalogue.runScan')}</div>
              <CB id="ck-run" code={`checkov -d ./terraform \\\n  --external-checks-dir ./wombat_checks/ \\\n  --compact\n\n# Findings appear as CKV_SEC_001, CKV_COST_001, etc.`} />

              <div style={sh}>{t('pages.phase3.catalogue.selectiveExecution')}</div>
              <CB id="ck-select" code={`# Only specific controls:\ncheckov -d ./tf --external-checks-dir ./wombat_checks/ \\\n  --check CKV_SEC_001,CKV_COST_001\n\n# Skip a control:\ncheckov -d ./tf --external-checks-dir ./wombat_checks/ \\\n  --skip-check CKV_SEC_002`} />
            </div>
          )}

          {mode === 'checkov' && tab === 'implement' && (
            <div>
              <p style={{ ...p, marginTop: '1rem' }}>
                {t('pages.phase3.catalogue.paraImplementIntroBefore')} <code>scan_resource_conf(self, conf: dict)</code> {t('pages.phase3.catalogue.paraImplementIntroMid')}
                <code> CheckResult.PASSED</code> {t('pages.phase3.catalogue.paraImplementIntroOr')} <code>CheckResult.FAILED</code>{t('pages.phase3.catalogue.paraImplementIntroAfter')}
              </p>

              <div style={sh}>{t('pages.phase3.catalogue.howConfStructuredBefore')} <code>conf</code> {t('pages.phase3.catalogue.howConfStructuredAfter')}</div>
              <p style={p}>{t('pages.phase3.catalogue.paraConfBefore')} <code>&#123; tags = &#123; env = "prod" &#125; &#125;</code> {t('pages.phase3.catalogue.paraConfAfter')}</p>
              <CB id="ck-conf" code={`conf = {\n    "bucket":    ["my-bucket-name"],\n    "tags":      [{"env": "prod"}],\n    "versioning":[{"enabled": [True]}],\n    # nested blocks are always wrapped in lists\n}`} />

              <div style={sh}>{t('pages.phase3.catalogue.workedExample')}</div>
              <CB id="ck-example" code={`# wombat_checks/SEC-001.py\nfrom checkov.common.models.enums import CheckCategories, CheckResult\nfrom checkov.terraform.checks.resource.base_resource_check import BaseResourceCheck\n\n\nclass CheckSEC001(BaseResourceCheck):\n    """Wombat SEC-001: S3 buckets must have server-side encryption."""\n\n    def __init__(self) -> None:\n        super().__init__(\n            name="S3 bucket has server-side encryption",\n            check_id="CKV_SEC_001",\n            categories=[CheckCategories.ENCRYPTION],\n            supported_resources=["aws_s3_bucket"],\n        )\n\n    def scan_resource_conf(self, conf: dict) -> CheckResult:\n        sse = conf.get("server_side_encryption_configuration", [{}])\n        if not sse or not sse[0]:\n            return CheckResult.FAILED\n        rule = sse[0].get("rule", [{}])\n        if not rule:\n            return CheckResult.FAILED\n        apply = rule[0].get("apply_server_side_encryption_by_default", [{}])\n        if not apply:\n            return CheckResult.FAILED\n        algo = apply[0].get("sse_algorithm", [""])[0]\n        return CheckResult.PASSED if algo in ("aws:kms", "AES256") else CheckResult.FAILED\n\n\nscanner = CheckSEC001()`} />

              <div style={sh}>{t('pages.phase3.catalogue.multipleResourceTypes')}</div>
              <CB id="ck-multi" code={`supported_resources=[\n    "aws_s3_bucket",\n    "aws_s3_bucket_server_side_encryption_configuration",\n]\n\ndef scan_resource_conf(self, conf: dict) -> CheckResult:\n    if self.supported_resource_type == \\\n            "aws_s3_bucket_server_side_encryption_configuration":\n        # new-style standalone resource — already encrypted\n        return CheckResult.PASSED\n    # legacy inline block on aws_s3_bucket\n    ...`} />

              <div style={sh}>{t('pages.phase3.catalogue.testCheckLocally')}</div>
              <CB id="ck-test" code={`mkdir -p tests/pass\ncat > tests/pass/main.tf << 'EOF'\nresource "aws_s3_bucket" "good" {\n  server_side_encryption_configuration {\n    rule { apply_server_side_encryption_by_default { sse_algorithm = "AES256" } }\n  }\n}\nEOF\n\ncheckov -d tests/pass \\\n  --external-checks-dir ./wombat_checks/ \\\n  --check CKV_SEC_001\n# Expected: 1 passed, 0 failed`} />
            </div>
          )}

          {mode === 'checkov' && tab === 'cicd' && (
            <div>
              <p style={{ ...p, marginTop: '1rem' }}>{t('pages.phase3.catalogue.paraCicdBefore')} <code>wombat_checks/</code> {t('pages.phase3.catalogue.paraCicdAfter')}</p>

              <div style={sh}>{t('pages.phase3.catalogue.githubActions')}</div>
              <CB id="ck-gha" code={`# .github/workflows/wombat.yml\nname: Wombat Checkov Scan\non: [push, pull_request]\n\njobs:\n  checkov:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n\n      - name: Run Wombat Checkov scan\n        uses: bridgecrewio/checkov-action@v12\n        with:\n          directory: ./terraform\n          external_checks_dir: ./wombat_checks\n          compact: "true"\n          output_format: sarif\n          output_file_path: wombat.sarif\n        continue-on-error: true\n\n      - name: Upload to GitHub Security\n        uses: github/codeql-action/upload-sarif@v3\n        if: always()\n        with:\n          sarif_file: wombat.sarif\n          category: wombat`} />

              <div style={sh}>{t('pages.phase3.catalogue.gitlabCi')}</div>
              <CB id="ck-gitlab" code={`wombat-checkov:\n  image: bridgecrew/checkov:latest\n  stage: test\n  script:\n    - checkov -d ./terraform\n        --external-checks-dir ./wombat_checks/\n        --output junitxml > wombat.xml\n  artifacts:\n    when: always\n    reports:\n      junit: wombat.xml`} />

              <div style={sh}>{t('pages.phase3.catalogue.preCommitHook')}</div>
              <CB id="ck-precommit" code={`# .pre-commit-config.yaml\nrepos:\n  - repo: https://github.com/bridgecrewio/checkov\n    rev: "3.0.0"\n    hooks:\n      - id: checkov\n        args: [--external-checks-dir, wombat_checks, --compact]`} />

              <div style={sh}>{t('pages.phase3.catalogue.softFailRollout')}</div>
              <p style={p}>{t('pages.phase3.catalogue.paraSoftFailBefore')} <code>critical</code> {t('pages.phase3.catalogue.paraSoftFailAfter')}</p>
              <CB id="ck-soft" code={`checkov -d ./terraform \\\n  --external-checks-dir ./wombat_checks/ \\\n  --hard-fail-on CKV_SEC_001,CKV_SEC_002 \\\n  --soft-fail-on HIGH,MEDIUM,LOW`} />
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
  const { t } = useI18n()
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
      setError(e instanceof Error ? e.message : t('pages.phase3.catalogue.unknownError'))
    } finally {
      setSaving(false)
    }
  }

  const isLastStep    = step === WIZARD_STEPS.length - 1
  const stepLabel     = t(`pages.phase3.catalogue.${WIZARD_STEPS[step].labelKey}`)
  const stepsLeft     = WIZARD_STEPS.length - 1 - step
  const bodyRef       = useRef<HTMLDivElement>(null)

  // Scroll body to top on step change
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }) }, [step])

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, #000000 40%, transparent)', zIndex: 99 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '660px', maxWidth: '95vw', maxHeight: '90vh',
        background: 'var(--surface)', borderRadius: '16px', boxShadow: '0 32px 80px rgba(15,23,42,.22)',
        display: 'flex', flexDirection: 'column', zIndex: 100, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '1rem 1.5rem 0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>{t('pages.phase3.catalogue.newCustomControl')}</div>
            <div style={{ fontSize: '0.73rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
              {t('pages.phase3.catalogue.stepOf', { step: step + 1, total: WIZARD_STEPS.length })} <strong style={{ color: 'var(--text)' }}>{stepLabel}</strong>
              {stepsLeft > 0 && <span style={{ marginLeft: '0.4rem', color: 'var(--muted)' }}>{t('pages.phase3.catalogue.stepsRemaining', { count: stepsLeft, s: stepsLeft !== 1 ? 's' : '' })}</span>}
              {savedControl && <span style={{ marginLeft: '0.4rem', color: 'var(--score-high)', fontWeight: 700 }}>{t('pages.phase3.catalogue.savedCheck')}</span>}
            </div>
          </div>
          <button aria-label={t('pages.phase3.catalogue.closeWizardAria')} onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.2rem', lineHeight: 1, marginTop: '0.1rem' }}>✕</button>
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
          >{t('pages.phase3.catalogue.previousButton')}</button>

          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
            {step + 1} / {WIZARD_STEPS.length}
          </div>

          {!isLastStep ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canAdvance()}
              style={{
                padding: '0.45rem 1.1rem', borderRadius: '8px', border: 'none',
                background: canAdvance() ? 'var(--waf-brand-btn)' : 'var(--skip)',
                color: '#fff', cursor: canAdvance() ? 'pointer' : 'default',
                fontSize: '0.8rem', fontWeight: 700, opacity: canAdvance() ? 1 : 0.65,
              }}
            >{t('pages.phase3.catalogue.nextButton')}</button>
          ) : (
            <button
              onClick={onClose}
              style={{ padding: '0.45rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text)' }}
            >{savedControl ? t('pages.phase3.catalogue.done') : t('pages.phase3.catalogue.cancel')}</button>
          )}
        </div>
      </div>
    </>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ ctrl, onClose }: { ctrl: UnifiedControl; onClose: () => void }) {
  const { t } = useI18n()
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'color-mix(in srgb, #000000 20%, transparent)', zIndex: 99 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '700px', maxWidth: '95vw', maxHeight: '90vh',
        background: 'var(--surface)', borderRadius: '12px', boxShadow: '0 24px 64px rgba(15,23,42,.18)',
        display: 'flex', flexDirection: 'column', zIndex: 100, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '1.1rem 1.5rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <code style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)' }}>{ctrl.id}</code>
              <Pill label={ctrl.pillar} color={pillarColor(ctrl.pillar)} />
              <Pill label={ctrl.severity} color={sevColor(ctrl.severity)} />
              <SourceBadge isCustom={ctrl.isCustom} />
            </div>
            <button aria-label={t('pages.phase3.catalogue.closeDetailsAria')} onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.2rem', lineHeight: 1, flexShrink: 0 }}>✕</button>
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
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>{t('pages.phase3.catalogue.description')}</div>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{ctrl.description.trim()}</p>
          </div>

          {/* Core: rationale + regulatory */}
          {ctrl.core?.rationale && (
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>{t('pages.phase3.catalogue.whyItMatters')}</div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.6 }}>{ctrl.core.rationale}</p>
            </div>
          )}

          {ctrl.core && (ctrl.core.regulatory_mapping?.length ?? 0) > 0 && (
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>{t('pages.phase3.catalogue.regulatoryMapping')}</div>
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
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{t('pages.phase3.catalogue.checksCount', { count: ctrl.core.checks.length })}</div>
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
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{t('pages.phase3.catalogue.checksCount', { count: ctrl.custom.checks.length })}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {ctrl.custom.checks.map(ch => (
                  <div key={ch.id} style={{ background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border)', padding: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                      <code style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)' }}>{ch.id}</code>
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.1rem 0.45rem', borderRadius: '999px', background: `color-mix(in srgb, ${engineColor(ch.engine)} 9%, transparent)`, color: engineColor(ch.engine), fontSize: '0.7rem', fontWeight: 700, border: `1px solid color-mix(in srgb, ${engineColor(ch.engine)} 19%, transparent)` }}>{ch.engine}</span>
                    </div>
                    <p style={{ margin: '0 0 0.35rem', fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.5 }}>{ch.description}</p>
                    <div style={{ background: '#0f172a', borderRadius: '6px', padding: '0.55rem 0.75rem', fontSize: '0.73rem', color: 'var(--skip)', lineHeight: 1.6 }}>
                      <span style={{ color: '#64748b', marginRight: '0.4rem' }}>{t('pages.phase3.catalogue.expectedLabel')}</span>
                      <span style={{ color: '#e2e8f0' }}>{ch.expected}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Download buttons — available for both custom and framework controls */}
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{t('pages.phase3.catalogue.export')}</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {ctrl.custom && (
                <button
                  onClick={() => downloadText(`${ctrl.id}.yml`, toYaml(ctrl.custom!), 'text/yaml')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, background: 'color-mix(in srgb, var(--waf-brand) 10%, transparent)', color: 'var(--waf-brand-ink)', border: '1px solid color-mix(in srgb, var(--waf-brand) 30%, transparent)' }}
                >{t('pages.phase3.catalogue.downloadYamlShort')}</button>
              )}
              {ctrl.core && (
                <button
                  onClick={() => downloadText(`${ctrl.id}.yml`, toYamlFromCore(ctrl.core!), 'text/yaml')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, background: 'color-mix(in srgb, var(--waf-brand) 10%, transparent)', color: 'var(--waf-brand-ink)', border: '1px solid color-mix(in srgb, var(--waf-brand) 30%, transparent)' }}
                >{t('pages.phase3.catalogue.downloadYamlShort')}</button>
              )}
              <button
                onClick={() => {
                  const content = ctrl.custom ? toCheckov(ctrl.custom) : toCheckovFromCore(ctrl.core!)
                  downloadText(`${ctrl.id}.py`, content, 'text/x-python')
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, background: 'color-mix(in srgb, var(--waf-info) 10%, transparent)', color: 'var(--waf-info)', border: '1px solid color-mix(in srgb, var(--waf-info) 30%, transparent)' }}
              >{t('pages.phase3.catalogue.downloadCheckovStubShort')}</button>
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
  const { t } = useI18n()
  const { role } = useAuth()
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  if (!ctrl.isCustom || !hasMinRole(role ?? '', 'admin')) {
    return null
  }

  async function handleDelete() {
    setDeleteError(null)
    setDeleting(true)
    try {
      await deleteCatalogueControl(ctrl.id)
      setDeleted(true)
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : t('pages.phase3.catalogue.unknownError'))
    } finally {
      setDeleting(false)
      setConfirming(false)
    }
  }

  if (deleted) {
    return (
      <div style={{ fontSize: '0.7rem', color: 'var(--score-high)', padding: '0.5rem', background: 'color-mix(in srgb, var(--score-high) 7.1%, transparent)', borderRadius: '8px', textAlign: 'center' }}>
        {t('pages.phase3.catalogue.deleted')}
      </div>
    )
  }

  return (
    <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>{t('pages.phase3.catalogue.dangerZone')}</div>
      {confirming ? (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text)' }}>
            {t('pages.phase3.catalogue.deleteControlPromptBefore')} <strong>{ctrl.id}</strong>{t('pages.phase3.catalogue.deleteControlPromptAfter')}
          </span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              padding: '0.5rem 0.9rem', borderRadius: '8px', border: '1px solid var(--fail)',
              background: 'color-mix(in srgb, var(--fail) 7.1%, transparent)', color: 'var(--fail-ink)', fontWeight: 700, fontSize: '0.78rem',
              cursor: deleting ? 'default' : 'pointer', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '0.4rem'
            }}
          >
            {deleting ? t('pages.phase3.catalogue.deleting') : t('pages.phase3.catalogue.confirmDelete')}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={deleting}
            style={{
              padding: '0.5rem 0.9rem', borderRadius: '8px', border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--muted)', fontWeight: 600, fontSize: '0.78rem',
              cursor: deleting ? 'default' : 'pointer', flexShrink: 0,
            }}
          >
            {t('pages.phase3.catalogue.cancel')}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          style={{
            padding: '0.5rem 0.9rem', borderRadius: '8px', border: '1px solid var(--fail)',
            background: 'color-mix(in srgb, var(--fail) 7.1%, transparent)', color: 'var(--fail-ink)', fontWeight: 700, fontSize: '0.78rem',
            cursor: 'pointer', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '0.4rem'
          }}
        >
          {t('pages.phase3.catalogue.deleteCustomControl')}
        </button>
      )}
      {deleteError && (
        <div role="alert" style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--fail-ink)', background: 'color-mix(in srgb, var(--fail) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--fail) 25%, transparent)' }}>
          {t('pages.phase3.catalogue.failedToDelete', { message: deleteError })}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type TabFilter = 'all' | 'framework' | 'custom'

interface Props {
  coreControls: ControlMeta[]
}

export default function ControlsCataloguePage({ coreControls }: Props) {
  const { t } = useI18n()
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
  const [search, setSearch]                 = useState(() => parseHash().filters.search ?? '')
  const [pillarFilter, setPillarFilter]     = useState<string[]>([])
  const [severityFilter, setSeverityFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter]         = useState<string[]>([])
  const [tab, setTab]                       = useState<TabFilter>(() => {
    const initialTab = parseHash().filters.tab
    return initialTab === 'framework' || initialTab === 'custom' ? initialTab : 'all'
  })
  const [packInfo, setPackInfo]             = useState<ActivePackInfo | null>(null)
  const [packLoading, setPackLoading]       = useState(true)
  const [downloadError, setDownloadError]   = useState<string | null>(null)

  useEffect(() => {
    const onPaletteSearch = (event: Event) => {
      const id = (event as CustomEvent<string>).detail
      if (typeof id === 'string') setSearch(id)
    }
    window.addEventListener('wombat:catalogue-search', onPaletteSearch)
    return () => window.removeEventListener('wombat:catalogue-search', onPaletteSearch)
  }, [])

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
    downloadZip(`wombat_checks_${new Date().toISOString().split('T')[0]}.zip`, zip)
  }

  const packCount = tab === 'framework' ? frameworkCount
    : tab === 'custom' ? customCount
    : allControls.length

  // Filter bar render

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', zIndex: 1 }}>
      <h1 className="ui-sr-only">{PAGE_TITLE['catalogue']}</h1>
      {/* ── Active Control Pack Banner ────────────────────────────────────── */}
      {!packLoading && packInfo && (
        <div className="card" style={{
          display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap',
          borderLeft: '4px solid var(--waf-brand)',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: 'color-mix(in srgb, var(--waf-brand) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--waf-brand) 25%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" fill="none" stroke="var(--waf-brand)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 2 }}>
              {t('pages.phase3.catalogue.activeControlPack')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--waf-brand)', fontFamily: 'monospace' }}>
                {packInfo.version}
              </span>
              {packInfo.description && (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {packInfo.description}
                </span>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, fontSize: '0.78rem', color: 'var(--muted)' }}>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>
                {packInfo.catalogue_count ?? packInfo.control_count}
              </strong> {t('pages.phase3.catalogue.controlsInCatalogue')}
              {packInfo.catalogue_count != null && packInfo.catalogue_count !== packInfo.control_count && (
                <span style={{ fontSize: '0.7rem', marginLeft: 6, color: 'var(--text-secondary)' }}>
                  {t('pages.phase3.catalogue.packCount', { count: packInfo.control_count })}
                </span>
              )}
            </div>
            <div>{t('pages.phase3.catalogue.activated', { date: new Date(packInfo.activated_at || '').toLocaleDateString() })}</div>
          </div>
        </div>
      )}

      {/* Tab bar + New Control button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.2rem' }}>
          {([
            ['all',       t('pages.phase3.catalogue.tabAll', { count: allControls.length })],
            ['framework', t('pages.phase3.catalogue.tabFramework', { count: frameworkCount })],
            ['custom',    t('pages.phase3.catalogue.tabCustom', { count: customCount })],
          ] as [TabFilter, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: '0.3rem 0.85rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontSize: '0.78rem', fontWeight: 600,
              background: tab === key ? 'var(--waf-brand-btn)' : 'transparent',
              color: tab === key ? '#fff' : 'var(--muted)',
            }}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Download YAML Pack */}
          <button
            onClick={async () => {
              setDownloadError(null)
              try {
                const blob = await downloadControlsZip()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `wombat_controls_${new Date().toISOString().split('T')[0]}.zip`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
              } catch (e) {
                setDownloadError(t('pages.phase3.catalogue.failedDownloadControls', { message: e instanceof Error ? e.message : t('pages.phase3.catalogue.unknownError') }))
              }
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', borderRadius: '8px', border: '1px solid color-mix(in srgb, var(--waf-brand) 35%, transparent)', background: 'color-mix(in srgb, var(--waf-brand) 8%, transparent)', color: 'var(--waf-brand-ink)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            {t('pages.phase3.catalogue.downloadControlsYaml')}
            <span style={{ background: 'color-mix(in srgb, var(--waf-brand) 15%, transparent)', borderRadius: '999px', padding: '0.05rem 0.45rem', fontSize: '0.7rem' }}>{allControls.length}</span>
          </button>
          {/* Checkov Pack */}
          <button
            onClick={downloadPack}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', borderRadius: '8px', border: '1px solid color-mix(in srgb, var(--waf-info) 35%, transparent)', background: 'color-mix(in srgb, var(--waf-info) 8%, transparent)', color: 'var(--waf-info)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            {t('pages.phase3.catalogue.checkovPack')}
            <span style={{ background: 'color-mix(in srgb, var(--waf-info) 15%, transparent)', borderRadius: '999px', padding: '0.05rem 0.45rem', fontSize: '0.7rem' }}>{packCount}</span>
          </button>
          <button
            onClick={() => setShowGuide(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            {t('pages.phase3.catalogue.howToImplement')}
          </button>
          {/* New Control */}
          <button
            onClick={() => setShowWizard(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 1rem', borderRadius: '8px', border: 'none', background: 'var(--waf-brand-btn)', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('pages.phase3.catalogue.newControl')}
          </button>
        </div>
      </div>

      {downloadError && (
        <div role="alert" style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--fail-ink)', background: 'color-mix(in srgb, var(--fail) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--fail) 25%, transparent)' }}>
          {downloadError}
        </div>
      )}

      {/* Filter bar */}
      <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', flexShrink: 0 }} key="filter-bar-0">
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text" placeholder={t('pages.phase3.catalogue.searchPlaceholder')}
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.8rem', background: 'var(--bg)', color: 'var(--text)', outline: 'none', minWidth: '220px' }}
          />
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginLeft: 'auto' }}>
            {t('pages.phase3.catalogue.filteredOfTotal', { filtered: filtered.length, total: allControls.length })}
            {apiError && <span style={{ color: 'var(--waf-warn)', marginLeft: '0.5rem' }}>{t('pages.phase3.catalogue.customUnavailable')}</span>}
          </span>
          <SavedViewsControl
            page="catalogue"
            currentFilters={{ search, pillarFilter, severityFilter, typeFilter, tab }}
            onApply={filters => {
              setSearch(typeof filters.search === 'string' ? filters.search : '')
              const strings = (value: unknown) => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
              setPillarFilter(strings(filters.pillarFilter))
              setSeverityFilter(strings(filters.severityFilter))
              setTypeFilter(strings(filters.typeFilter))
              if (filters.tab === 'all' || filters.tab === 'framework' || filters.tab === 'custom') setTab(filters.tab)
            }}
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center', flex: '0 0 auto' }} data-debug="pillar-filter">
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '0.2rem', flex: '0 0 auto' }}>{t('pages.phase3.catalogue.pillar')}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center' }}>
            {(() => ALL_PILLARS.map(p => <TogglePill key={p} label={p} color={pillarColor(p)} active={pillarFilter.includes(p)} onClick={() => togglePillar(p)} />))()}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center', flex: '0 0 auto' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '0.2rem', flex: '0 0 auto' }}>{t('pages.phase3.catalogue.severity')}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center' }}>
            {(() => ALL_SEVERITIES.map(s => <TogglePill key={s} label={s} color={sevColor(s)} active={severityFilter.includes(s)} onClick={() => toggleSeverity(s)} />))()}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center', flex: '0 0 auto' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '0.2rem', flex: '0 0 auto' }}>{t('pages.phase3.catalogue.type')}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', alignItems: 'center' }}>
            {(() => ALL_TYPES.map(t => <TogglePill key={t} label={t} color={typeColor(t)} active={typeFilter.includes(t)} onClick={() => toggleType(t)} />))()}
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', color: 'var(--muted)', gap: '0.5rem' }}>
          <div className="spinner" />{t('pages.phase3.catalogue.loading')}
        </div>
      )}

      {/* Table */}
      {!loading && (
        <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
              {tab === 'custom' && customCount === 0
                ? <><strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text)' }}>{t('pages.phase3.catalogue.noCustomControls')}</strong>{t('pages.phase3.catalogue.noCustomControlsHintBefore')} <strong>{t('pages.phase3.catalogue.newControl')}</strong> {t('pages.phase3.catalogue.noCustomControlsHintAfter')} <code>wombat control generate</code> {t('pages.phase3.catalogue.noCustomControlsHintEnd')}</>
                : t('pages.phase3.catalogue.noControlsMatch')
              }
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['colSource', 'colId', 'colPillar', 'colSeverity', 'colType', 'colDescription', 'colChecks'].map(h => (
                    <th key={h} style={{ padding: '0.65rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--bg)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{t(`pages.phase3.catalogue.${h}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((ctrl, i) => (
                  <tr
                    key={ctrl.id}
                    onClick={() => setSelected(ctrl)}
                    style={{ cursor: 'pointer', background: i % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--text) 1.5%, transparent)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--row-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--text) 1.5%, transparent)')}
                  >
                    <td style={{ padding: '0.65rem 1rem', whiteSpace: 'nowrap' }}><SourceBadge isCustom={ctrl.isCustom} /></td>
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
