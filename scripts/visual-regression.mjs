#!/usr/bin/env node
/**
 * Visual regression for the dashboard.
 *
 *   npm run visual:baseline   # (re)capture baselines into visual-baselines/
 *   npm run visual:check      # capture and compare against the baselines
 *
 * Requires a local Chrome/Chromium (CHROME_PATH overrides detection) and a
 * running stack. Baselines are environment-specific: update them deliberately
 * when a UI change is intended.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

const UPDATE = process.argv.includes('--update')
const API = process.env.WAF_API_URL ?? 'http://localhost:8000'
const WEB = process.env.WAF_WEB_URL ?? 'http://localhost:3000'
const USER = process.env.WAF_ADMIN_USER ?? 'admin'
const PASS = process.env.WAF_ADMIN_PASSWORD ?? 'admin'
const PORT = Number(process.env.CDP_PORT ?? 9333)
const ROUTES = (process.env.VISUAL_ROUTES ?? 'catalogue,settings,about,legal,compliance-readiness,evidence').split(',')
const THEMES = (process.env.VISUAL_THEMES ?? 'dark,light').split(',')
const VIEWPORTS = (process.env.VISUAL_VIEWPORTS ?? '1440x900,900x900,390x844')
  .split(',')
  .map(v => v.split('x').map(Number))
  .map(([width, height]) => ({ width, height }))
const THRESHOLD = Number(process.env.VISUAL_THRESHOLD ?? 0.1)
const BASELINE_DIR = 'visual-baselines'
const WORK_DIR = '.visual'

const CHROME = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean).find(p => existsSync(p))
if (!CHROME) {
  console.error('Chrome not found. Set CHROME_PATH.')
  process.exit(2)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function login() {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  })
  if (!res.ok) throw new Error(`login failed: ${res.status}`)
  return res.json()
}

function launchChrome() {
  const profile = join(tmpdir(), `waf-visual-${Date.now()}`)
  const child = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--disable-gpu',
    '--hide-scrollbars',
    '--window-size=1440,900',
    'about:blank',
  ], { stdio: 'ignore', detached: false })
  return { child, profile }
}

async function waitForChrome() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (res.ok) return
    } catch { /* retry */ }
    await sleep(200)
  }
  throw new Error('Chrome did not start')
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const pending = new Map()
    let id = 0
    ws.addEventListener('open', () => resolve({
      send: (method, params = {}) => new Promise(res => {
        const i = ++id
        pending.set(i, res)
        ws.send(JSON.stringify({ id: i, method, params }))
      }),
      close: () => ws.close(),
    }), { once: true })
    ws.addEventListener('error', reject, { once: true })
    ws.addEventListener('message', event => {
      const msg = JSON.parse(event.data)
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
    })
  })
}

function diff(aPath, bPath, outPath) {
  const a = PNG.sync.read(readFileSync(aPath))
  const b = PNG.sync.read(readFileSync(bPath))
  if (a.width !== b.width || a.height !== b.height) {
    return { changed: true, reason: `size ${a.width}x${a.height} → ${b.width}x${b.height}`, ratio: 1 }
  }
  const out = new PNG({ width: a.width, height: a.height })
  const bad = pixelmatch(a.data, b.data, out.data, a.width, a.height, { threshold: THRESHOLD })
  writeFileSync(outPath, PNG.sync.write(out))
  return { changed: bad > 0, reason: `${bad} px differ`, ratio: bad / (a.width * a.height) }
}

async function main() {
  const auth = await login()
  const { child, profile } = launchChrome()
  let page
  try {
    await waitForChrome()
    const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
    page = await connect((await res.json()).webSocketDebuggerUrl)
    await page.send('Page.enable')
    await page.send('Runtime.enable')
    const evaluate = async expr => {
      const out = await page.send('Runtime.evaluate', { expression: expr, returnByValue: true })
      return out.result?.result?.value
    }

    await page.send('Page.navigate', { url: WEB })
    await sleep(1500)
    await evaluate(`
      localStorage.setItem('wombat_access_token', ${JSON.stringify(auth.access_token)});
      localStorage.setItem('wombat_refresh_token', ${JSON.stringify(auth.refresh_token)});
      localStorage.setItem('wombat_auth_user', ${JSON.stringify(JSON.stringify(auth.user))});
      'ok'
    `)

    mkdirSync(BASELINE_DIR, { recursive: true })
    mkdirSync(join(WORK_DIR, 'current'), { recursive: true })
    mkdirSync(join(WORK_DIR, 'diffs'), { recursive: true })

    let failures = 0
    for (const theme of THEMES) {
      await evaluate(`localStorage.setItem('wombat_theme', ${JSON.stringify(theme)}); 'ok'`)
      for (const viewport of VIEWPORTS) {
      await page.send('Emulation.setDeviceMetricsOverride', {
        width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.width < 600,
      })
      await page.send('Page.reload')
      await sleep(1800)
      for (const route of ROUTES) {
        await page.send('Page.navigate', { url: `${WEB}/#/${route}` })
        // Wait for async content to settle: no skeletons and no loading text.
        let stable = 0
        for (let i = 0; i < 40 && stable < 3; i++) {
          await sleep(250)
          const ready = await evaluate(`(() => {
            const skeletons = document.querySelectorAll('.ui-skeleton, .pp-skeleton').length
            const text = document.body.innerText || ''
            const loading = /Loading|lädt|chargement|Cargando|Carregando|Φόρτωση/i.test(text)
            const pending = document.querySelectorAll('[aria-busy="true"]').length
            return skeletons === 0 && !loading && pending === 0
          })()`)
          stable = ready ? stable + 1 : 0
        }
        await evaluate(`(() => { const s=document.createElement('style'); s.textContent='*{animation:none!important;transition:none!important;caret-color:transparent!important}'; document.head.appendChild(s); return 'ok' })()`)
        // Capture until two consecutive frames are pixel-identical.
        let png = null
        for (let attempt = 0; attempt < 8; attempt++) {
          await sleep(600)
          const shot = await page.send('Page.captureScreenshot', { format: 'png' })
          const next = Buffer.from(shot.result.data, 'base64')
          if (png && next.equals(png)) break
          png = next
        }
        const name = `${theme}-${viewport.width}-${route}.png`
        const current = join(WORK_DIR, 'current', name)
        writeFileSync(current, png)
        const baseline = join(BASELINE_DIR, name)
        if (UPDATE || !existsSync(baseline)) {
          writeFileSync(baseline, readFileSync(current))
          console.log(`baseline  ${name}`)
        } else {
          const result = diff(baseline, current, join(WORK_DIR, 'diffs', name))
          const pct = (result.ratio * 100).toFixed(3)
          if (result.changed) {
            failures++
            console.log(`FAIL      ${name} — ${result.reason} (${pct}%)`)
          } else {
            console.log(`ok        ${name}`)
          }
        }
      }
      }
    }
    if (failures) {
      console.error(`\n${failures} visual difference(s). See ${WORK_DIR}/diffs/.`)
      process.exitCode = 1
    } else {
      console.log('\nNo visual differences.')
    }
  } finally {
    try { page?.close() } catch { /* ignore */ }
    child.kill('SIGTERM')
    await sleep(300)
    try { rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
  }
}

main().catch(err => { console.error(err); process.exit(1) })
