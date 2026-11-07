#!/usr/bin/env node
/**
 * Bundle budget gate.
 *
 *   npm run build && npm run build:budget
 *
 * Fails when the initial JS, any route chunk, or the CSS exceeds the budget.
 * Budgets are a ratchet: lower them as the bundle shrinks; never raise one to
 * make a red build green without documenting why.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const DIST = 'dist'
const ASSETS = join(DIST, 'assets')

// Budgets in bytes (gzip for JS/CSS). Ratchet down; do not raise one to make
// a red build green without documenting why.
const BUDGETS = {
  initialJs: 250 * 1024,
  routeChunk: 320 * 1024,
  css: 60 * 1024,
}

function gzipSize(path) {
  return gzipSync(readFileSync(path)).length
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`
}

const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf8')
const initialFiles = new Set(
  [...indexHtml.matchAll(/(?:src|href)="\/assets\/([^"]+\.js)"/g)].map(match => match[1]),
)

const jsFiles = readdirSync(ASSETS).filter(file => file.endsWith('.js'))
const cssFiles = readdirSync(ASSETS).filter(file => file.endsWith('.css'))

const sizes = jsFiles
  .map(file => ({ file, bytes: gzipSize(join(ASSETS, file)) }))
  .sort((a, b) => b.bytes - a.bytes)

const initialBytes = sizes
  .filter(entry => initialFiles.has(entry.file))
  .reduce((sum, entry) => sum + entry.bytes, 0)
const cssBytes = cssFiles.reduce((sum, file) => sum + gzipSize(join(ASSETS, file)), 0)

const failures = []
if (initialBytes > BUDGETS.initialJs) {
  failures.push(`initial JS ${kb(initialBytes)} > ${kb(BUDGETS.initialJs)}`)
}
if (cssBytes > BUDGETS.css) {
  failures.push(`CSS ${kb(cssBytes)} > ${kb(BUDGETS.css)}`)
}
for (const entry of sizes) {
  if (!entry.file.startsWith('index-') && entry.bytes > BUDGETS.routeChunk) {
    failures.push(`chunk ${entry.file} ${kb(entry.bytes)} > ${kb(BUDGETS.routeChunk)}`)
  }
}

console.log('Bundle budget')
console.log(`  initial JS : ${kb(initialBytes)} / ${kb(BUDGETS.initialJs)}`)
console.log(`  CSS        : ${kb(cssBytes)} / ${kb(BUDGETS.css)}`)
console.log(`  largest    : ${sizes[0] ? `${sizes[0].file} ${kb(sizes[0].bytes)}` : 'none'}`)
console.log(`  assets dir : ${statSync(ASSETS).isDirectory() ? 'ok' : 'missing'}`)

if (failures.length > 0) {
  console.error('\nBudget exceeded:')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log('\nWithin budget.')
