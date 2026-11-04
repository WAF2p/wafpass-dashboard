#!/usr/bin/env node
/**
 * Automated accessibility check (axe-core) for the dashboard.
 *
 *   npm run a11y:check
 *
 * Requires a local Chrome (CHROME_PATH overrides detection) and a running
 * stack. Fails on any serious or critical axe violation; writes the full
 * report to .a11y/report.json.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const API = process.env.WAF_API_URL ?? 'http://localhost:8000'
const WEB = process.env.WAF_WEB_URL ?? 'http://localhost:3000'
const USER = process.env.WAF_ADMIN_USER ?? 'admin'
const PASS = process.env.WAF_ADMIN_PASSWORD ?? 'admin'
const PORT = Number(process.env.CDP_PORT ?? 9334)
const ROUTES = (process.env.A11Y_ROUTES ?? 'dashboard,globaldashboard,catalogue,findings,runs,passports,settings,compliance,evidence,autofix,compliance-readiness,sandbox,validations,legal').split(',')
const THEMES = (process.env.A11Y_THEMES ?? 'dark,light').split(',')
const AXE_SOURCE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')

const CHROME = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean).find(p => existsSync(p))
if (!CHROME) { console.error('Chrome not found. Set CHROME_PATH.'); process.exit(2) }

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function login() {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  })
  if (!res.ok) throw new Error(`login failed: ${res.status}`)
  return res.json()
}

function launch() {
  const profile = join(tmpdir(), `waf-a11y-${Date.now()}`)
  const child = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`, '--remote-allow-origins=*',
    `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu', '--window-size=1440,900', 'about:blank',
  ], { stdio: 'ignore' })
  return { child, profile }
}

async function waitChrome() {
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) return } catch { /* retry */ }
    await sleep(200)
  }
  throw new Error('Chrome did not start')
}

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url); const pending = new Map(); let id = 0
    ws.addEventListener('open', () => resolve({
      send: (method, params = {}) => new Promise(res => {
        const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params }))
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

async function main() {
  const auth = await login()
  const { child, profile } = launch()
  let page
  const report = {}
  try {
    await waitChrome()
    const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })
    page = await connect((await res.json()).webSocketDebuggerUrl)
    await page.send('Page.enable'); await page.send('Runtime.enable')
    const evaluate = async (expr, awaitPromise = false) => {
      const out = await page.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise })
      return out.result?.result?.value
    }
    await page.send('Page.navigate', { url: WEB }); await sleep(1500)
    await evaluate(`
      localStorage.setItem('wombat_access_token', ${JSON.stringify(auth.access_token)});
      localStorage.setItem('wombat_refresh_token', ${JSON.stringify(auth.refresh_token)});
      localStorage.setItem('wombat_auth_user', ${JSON.stringify(JSON.stringify(auth.user))});
      'ok'
    `)

    mkdirSync('.a11y', { recursive: true })
    let failures = 0
    for (const theme of THEMES) {
      await evaluate(`localStorage.setItem('wombat_theme', ${JSON.stringify(theme)}); 'ok'`)
      await page.send('Page.reload'); await sleep(1600)
      for (const route of ROUTES) {
        await page.send('Page.navigate', { url: `${WEB}/#/${route}` }); await sleep(2000)
        await evaluate(AXE_SOURCE)
        const result = await evaluate(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa'] } }).then(r => JSON.stringify(r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, targets: v.nodes.slice(0,3).map(n => n.target.join(' ')) })))))`, true)
        const violations = JSON.parse(result || '[]')
        const serious = violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
        report[`${theme}-${route}`] = violations
        if (serious.length) {
          failures++
          console.log(`FAIL ${theme}/${route} — ${serious.map(v => `${v.id}(${v.nodes})`).join(', ')}`)
        } else {
          console.log(`ok   ${theme}/${route}`)
        }
      }
    }
    writeFileSync('.a11y/report.json', JSON.stringify(report, null, 2))
    if (failures) { console.error(`\n${failures} route(s) with serious/critical violations. See .a11y/report.json`); process.exitCode = 1 }
    else console.log('\nNo serious/critical accessibility violations.')
  } finally {
    try { page?.close() } catch { /* ignore */ }
    child.kill('SIGTERM'); await sleep(300)
    try { rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
  }
}

main().catch(err => { console.error(err); process.exit(1) })
