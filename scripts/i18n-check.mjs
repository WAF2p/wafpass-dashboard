#!/usr/bin/env node
/**
 * i18n verification.
 *
 *   npm run i18n:check                     # report; fails on broken keys/parity
 *   npm run i18n:check -- --strict        # also fails on incomplete or broken values
 *   npm run i18n:check -- --list-missing de
 *   npm run i18n:check -- --list-english de
 *
 * Checks:
 *   1. every static t('key') in src resolves in the English source;
 *   2. each locale's Phase 3 six-namespace key set matches English exactly
 *      (restA/restB are excluded from parity and reported as coverage instead);
 *   3. reports translation coverage for restA/restB and the base app;
 *   4. audits values for {{placeholder}} parity, empty strings and English-identical text;
 *   5. reports xx_TEMPLATE coverage.
 */
import { build } from 'esbuild'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { globSync } from 'node:fs'

const strict = process.argv.includes('--strict')
const listIndex = process.argv.indexOf('--list-missing')
const listLocale = listIndex !== -1 ? process.argv[listIndex + 1] : null
const englishIndex = process.argv.indexOf('--list-english')
const englishLocale = englishIndex !== -1 ? process.argv[englishIndex + 1] : null
const BASE_LOCALES = ['de', 'fr', 'es', 'pt', 'br', 'el']
const P3_NAMESPACES = ['evidence', 'legal', 'catalogue', 'autofix', 'readiness', 'sandbox']

const flatten = (object, prefix = '') =>
  Object.entries(object).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return value && typeof value === 'object' && !Array.isArray(value)
      ? flatten(value, path)
      : [[path, value]]
  })

// Legitimately empty: the Spanish sentence is split around a <code>conf</code>
// element ("Cómo se estructura el " + conf), so the trailing fragment is empty.
const EMPTY_ALLOWED = new Set(['catalogue.howConfStructuredAfter'])

const placeholderSignature = value =>
  typeof value === 'string' ? (value.match(/\{\{\w+\}\}/g) || []).sort().join('|') : ''
const hasLetters = value => typeof value === 'string' && /\p{L}{2,}/u.test(value)

const work = mkdtempSync(join(tmpdir(), 'waf-i18n-'))
async function bundle(entry) {
  const outfile = join(work, `${entry.replace(/[^a-z0-9]+/gi, '_')}.mjs`)
  await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'error' })
  return import(`${outfile}?t=${Date.now()}`)
}

async function main() {
  const en = (await bundle('src/i18n/locales/en.ts')).default
  const enFlat = Object.fromEntries(flatten(en))
  const enKeys = new Set(Object.keys(enFlat))

  // English Phase 3 values, both per-namespace sets (for parity/static keys)
  // and as one prefixed map (for value audits).
  const phase3En = {}
  const phase3EnValues = {}
  for (const ns of [...P3_NAMESPACES, 'restA', 'restB']) {
    const mod = (await bundle(`src/i18n/locales/phase3/${ns}.ts`)).default
    const map = Object.fromEntries(flatten(mod))
    phase3EnValues[ns] = map
    phase3En[ns] = new Set(Object.keys(map))
  }
  const phase3EnAll = Object.fromEntries(
    Object.entries(phase3EnValues).flatMap(([ns, map]) =>
      Object.entries(map).map(([key, value]) => [`${ns}.${key}`, value])),
  )

  const localeP3 = {}
  const localeP3Values = {}
  for (const lang of BASE_LOCALES) {
    const map = Object.fromEntries(flatten((await bundle(`src/i18n/locales/phase3/${lang}.ts`)).default))
    localeP3Values[lang] = map
    localeP3[lang] = new Set(Object.keys(map))
  }

  // ── 1. static t() keys ────────────────────────────────────────────────
  const files = globSync('src/**/*.{ts,tsx}', { exclude: ['src/__tests__/**'] })
  const used = new Set()
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(/(?<![A-Za-z0-9_$.])t\(\s*'([^']+)'/g)) {
      const key = match[1]
      if (key.includes('${') || key.includes(' ') || key.includes('/')) continue
      used.add(key)
    }
  }

  const missing = []
  for (const key of used) {
    if (key.startsWith('pages.phase3.')) {
      const [, , ns, ...rest] = key.split('.')
      const tail = rest.join('.')
      const keys = phase3En[ns]
      const found = keys && (keys.has(tail) || [...keys].some(k => k === tail || k.endsWith(`.${tail}`)))
      if (!found) missing.push(key)
    } else if (!enKeys.has(key)) {
      missing.push(key)
    }
  }

  // ── list modes ────────────────────────────────────────────────────────
  if (listLocale || englishLocale) {
    const requested = listLocale || englishLocale
    if (!BASE_LOCALES.includes(requested)) {
      console.error(`Unknown locale "${requested}". Use one of: ${BASE_LOCALES.join(', ')}`)
      process.exit(2)
    }
    const base = (await bundle(`src/i18n/locales/${requested}.ts`)).default
    const baseFlat = Object.fromEntries(flatten(base))
    const baseKeys = new Set(Object.keys(baseFlat))

    if (listLocale) {
      const baseMissing = [...enKeys].filter(key => !baseKeys.has(key)).sort()
      const restTotal = [...phase3En.restA, ...phase3En.restB].map(key => key)
      const translatedRest = new Set([...localeP3[requested]].filter(key => key.startsWith('restA.') || key.startsWith('restB.')))
      console.log(`# Missing keys for ${requested}\n`)
      console.log(`## Base app (${baseMissing.length})`)
      for (const key of baseMissing) console.log(key)
      console.log(`\n## restA/restB (${restTotal.length - translatedRest.size})`)
      for (const key of restTotal.sort()) {
        if (!translatedRest.has(`restA.${key}`) && !translatedRest.has(`restB.${key}`)) console.log(key)
      }
    } else {
      const baseEnglish = Object.entries(baseFlat)
        .filter(([key, value]) => key in enFlat && value === enFlat[key] && hasLetters(value))
        .map(([key]) => key)
        .sort()
      const p3English = Object.entries(localeP3Values[requested])
        .filter(([key, value]) => key in phase3EnAll && value === phase3EnAll[key] && hasLetters(value))
        .map(([key]) => key)
        .sort()
      console.log(`# Keys still holding English text for ${requested}\n`)
      console.log(`## Base app (${baseEnglish.length})`)
      for (const key of baseEnglish) console.log(key)
      console.log(`\n## Phase 3 (${p3English.length})`)
      for (const key of p3English) console.log(key)
      console.log('\n# Proper nouns, code samples and acronyms may legitimately stay in English.')
    }
    process.exit(0)
  }

  console.log(`\ni18n check — ${used.size} static keys, ${enKeys.size} English base keys\n`)
  if (missing.length) {
    console.log(`  ✗ ${missing.length} missing static key(s):`)
    for (const key of missing.sort()) console.log(`      ${key}`)
  } else {
    console.log('  ✓ all static t() keys resolve')
  }

  // ── 2. Phase 3 parity per locale ──────────────────────────────────────
  // restA/restB are excluded: they are counted separately as coverage so that
  // partial translation work never turns into a false "extra key" failure.
  const expected = new Set(P3_NAMESPACES.flatMap(ns => [...phase3En[ns]].map(key => `${ns}.${key}`)))
  let parityBroken = 0
  for (const lang of BASE_LOCALES) {
    const actual = new Set(
      [...localeP3[lang]].filter(key => P3_NAMESPACES.some(ns => key.startsWith(`${ns}.`))),
    )
    const absent = [...expected].filter(key => !actual.has(key))
    const extra = [...actual].filter(key => !expected.has(key))
    if (absent.length || extra.length) {
      parityBroken++
      console.log(`  ✗ ${lang}: ${absent.length} missing, ${extra.length} extra in Phase 3 namespaces`)
      for (const key of absent.slice(0, 5)) console.log(`      missing ${key}`)
    } else {
      console.log(`  ✓ ${lang}: Phase 3 parity (${expected.size} keys)`)
    }
  }

  // ── 3. Translation coverage + value audit ─────────────────────────────
  console.log('\n  Translation coverage (missing keys fall back to English):')
  let incomplete = 0
  let totalPlaceholders = 0
  let totalEmpty = 0
  for (const lang of BASE_LOCALES) {
    const base = (await bundle(`src/i18n/locales/${lang}.ts`)).default
    const baseFlat = Object.fromEntries(flatten(base))
    const baseKeys = new Set(Object.keys(baseFlat))
    const baseMissing = [...enKeys].filter(key => !baseKeys.has(key)).length
    const restTotal = phase3En.restA.size + phase3En.restB.size
    const restTranslated = [...localeP3[lang]].filter(key => key.startsWith('restA.') || key.startsWith('restB.')).length
    const restMissing = restTotal - restTranslated

    const placeholderProblems = []
    const emptyValues = []
    let englishValued = 0
    for (const [key, value] of [...Object.entries(baseFlat), ...Object.entries(localeP3Values[lang])]) {
      const source = key in enFlat ? enFlat[key] : phase3EnAll[key]
      if (source === undefined) continue
      if ((value === '' || value == null) && !EMPTY_ALLOWED.has(key)) emptyValues.push(key)
      if (placeholderSignature(value) !== placeholderSignature(source)) placeholderProblems.push(key)
      if (value === source && hasLetters(value)) englishValued++
    }

    totalPlaceholders += placeholderProblems.length
    totalEmpty += emptyValues.length
    if (baseMissing || restMissing) incomplete++
    console.log(
      `    ${lang.padEnd(2)}  base missing ${String(baseMissing).padStart(4)}` +
      `  ·  rest missing ${String(Math.max(0, restMissing)).padStart(3)} (of ${restTotal})` +
      `  ·  {{…}} ${String(placeholderProblems.length).padStart(3)}` +
      `  ·  English text ${String(englishValued).padStart(4)}` +
      `  ·  empty ${emptyValues.length}`,
    )
    if (placeholderProblems.length) {
      console.log(`        ⚠ placeholder mismatch: ${placeholderProblems.slice(0, 6).join(', ')}${placeholderProblems.length > 6 ? ', …' : ''}`)
    }
    if (emptyValues.length) {
      console.log(`        ⚠ empty value: ${emptyValues.join(', ')}`)
    }
  }
  if (totalPlaceholders || totalEmpty) {
    console.log('\n  Placeholder and empty-value findings are hard failures under --strict; run')
    console.log('  `npm run i18n:check -- --list-english <lang>` for the English-identical report.')
  }

  // ── 4. Template coverage ──────────────────────────────────────────────
  const template = (await bundle('src/i18n/locales/xx_TEMPLATE.ts')).default
  const templateKeys = new Set(flatten(template).map(([key]) => key))
  console.log(`\n  Template: ${templateKeys.size} keys (${[...templateKeys].filter(k => k.startsWith('pages.phase3.')).length} Phase 3)`)

  const strictFailed = strict && (incomplete > 0 || totalPlaceholders > 0 || totalEmpty > 0)
  const failed = missing.length > 0 || parityBroken > 0 || strictFailed
  if (failed) {
    console.log(`\nFAIL${strict ? ' (strict)' : ''}\n`)
    process.exitCode = 1
  } else {
    console.log('\nOK\n')
  }
}

main()
  .catch(error => { console.error(error); process.exitCode = 1 })
  .finally(() => rmSync(work, { recursive: true, force: true }))
