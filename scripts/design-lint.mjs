#!/usr/bin/env node
/**
 * Dependency-free design lint. Encodes the mechanical rules from DESIGN.md
 * so drift is visible without adding an ESLint/stylelint toolchain.
 *
 *   node scripts/design-lint.mjs           # report only
 *   node scripts/design-lint.mjs --strict  # exit 1 when anything is found
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const strict = process.argv.includes('--strict')
const gate = process.argv.includes('--gate')

// Files may opt out of one rule with e.g.
//   // design-lint-disable hardcoded-hex — generated report
function disabledRules(text) {
  const match = text.match(/design-lint-disable\s+([^\n*]+)/)
  return match ? match[1].split(/[,\s]+/).filter(Boolean) : []
}

function filesIn(dir) {
  try {
    return readdirSync(join(root, dir))
      .filter(name => name.endsWith('.tsx'))
      .map(name => join(root, dir, name))
  } catch {
    return []
  }
}

const files = [...filesIn('src/pages'), ...filesIn('src/components')]

// Modules rendered inside another page or as a modal — they must not add an <h1>.
const SUBVIEW_PAGES = new Set(['AdminLogPage.tsx', 'SkippedControlsPage.tsx', 'SyslogConfigModal.tsx'])
const sources = files.map(path => ({ path, rel: relative(root, path), text: readFileSync(path, 'utf8') }))

const count = (text, re) => (text.match(re) ?? []).length

const rules = [
  {
    id: 'hardcoded-hex',
    label: 'hardcoded hex colours',
    hint: 'Use var(--token) from src/index.css.',
    scan: text => count(text, /#[0-9a-fA-F]{6}\b/g),
  },
  {
    id: 'tiny-text',
    label: 'font sizes below 11px',
    hint: 'Legibility floor: 11px functional, 12px body.',
    scan: text => {
      let hits = 0
      for (const match of text.matchAll(/fontSize:\s*'?([\d.]+)(rem|px)'?/g)) {
        const px = match[2] === 'rem' ? Number(match[1]) * 16 : Number(match[1])
        if (Number.isFinite(px) && px < 11) hits++
      }
      return hits
    },
  },
  {
    id: 'transition-all',
    label: '"transition: all" declarations',
    hint: 'Transition transform, opacity or colour explicitly.',
    scan: text => count(text, /transition:\s*['"]?all\b/g),
  },
  {
    id: 'browser-dialog',
    label: 'window.alert/confirm/prompt',
    hint: 'Use inline errors or ui/Modal.',
    scan: text => count(text, /(?<![\w.])(alert|confirm|prompt)\s*\(/g),
  },
  {
    id: 'icon-button-label',
    label: 'icon-only buttons without a label',
    hint: 'Add aria-label or title.',
    scan: text => {
      let hits = 0
      for (const match of text.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
        const attrs = match[1]
        const inner = match[2]
        // Only icon-only buttons need a name; visible text already provides one.
        if (!/^\s*<(svg|img)\b/.test(inner)) continue
        // Dynamic expressions ({t('…')}, {count}) are visible text too.
        if (inner.includes('{')) continue
        const visibleText = inner.replace(/<[^>]*>/g, '').trim()
        if (visibleText.length > 0) continue
        if (!attrs.includes('aria-label') && !attrs.includes('title=')) hits++
      }
      return hits
    },
  },
  {
    id: 'page-h1',
    label: 'pages without an <h1>',
    hint: 'Render ui/PageHeader once per routed page.',
    pagesOnly: true,
    scan: text => (count(text, /<h1\b/) === 0 && !text.includes('<PageHeader') ? 1 : 0),
  },
]

const results = rules.map(rule => {
  const offenders = sources
    .filter(file => !rule.pagesOnly || (file.rel.startsWith('src/pages/') && !SUBVIEW_PAGES.has(file.rel.split('/').pop())))
    .filter(file => !disabledRules(file.text).includes(rule.id))
    .map(file => ({ rel: file.rel, hits: rule.scan(file.text) }))
    .filter(entry => entry.hits > 0)
    .sort((a, b) => b.hits - a.hits)
  return { rule, total: offenders.reduce((sum, entry) => sum + entry.hits, 0), offenders }
})

const grandTotal = results.reduce((sum, entry) => sum + entry.total, 0)

console.log(`\nDesign lint — ${sources.length} files\n`)
for (const { rule, total, offenders } of results) {
  const top = offenders.slice(0, 3).map(o => `${o.rel.split('/').pop()} (${o.hits})`).join(', ')
  console.log(`  ${total === 0 ? '✓' : '•'} ${rule.label.padEnd(38)} ${String(total).padStart(4)}  ${top}`)
  if (total > 0) console.log(`      ${rule.hint}`)
}
console.log(`\nTotal: ${grandTotal} findings across ${results.filter(r => r.total > 0).length} rules.`)
console.log('See DESIGN-AUDIT.md for the per-page plan.\n')

// --gate fails on every rule except hardcoded-hex (tracked separately, with
// documented exemptions for generated/print output).
if (strict && grandTotal > 0) process.exit(1)
if (gate && results.some(entry => entry.rule.id !== 'hardcoded-hex' && entry.total > 0)) process.exit(1)
