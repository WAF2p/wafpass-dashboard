# wafpass-dashboard

React SPA for visualising WAF++ PASS compliance scan results. Part of the [WAF++ framework](https://waf2p.dev) monorepo.

| Component | Role |
|-----------|------|
| `pass/` · `wafpass-core` | Compliance engine, CLI, IaC parsers |
| `wafpass-server/` · FastAPI | REST API · PostgreSQL persistence |
| `wafpass-dashboard/` · **this package** | Browser dashboard · fetches from server |

No Python dependency. No local scan access. All data comes from `wafpass-server`.

---

## Quick start

### Docker Compose (recommended)

From the **repo root**:

```bash
cp .env.example .env
docker compose up --build
```

Dashboard at `http://localhost:3000`, API at `http://localhost:8000`.

### Development server

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. In dev mode, Vite proxies `/runs`, `/controls`, `/waivers`, `/risks`, `/sandbox`, and `/health` to `http://localhost:8000`.

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `""` (same origin) | Base URL of wafpass-server, e.g. `http://localhost:8000` |

In Docker Compose the nginx reverse proxy routes API paths to `wafpass-server:8000` automatically, so `VITE_API_URL` is only needed for cross-origin setups.

**Runtime override:** You can also set the server URL at runtime in **Settings → Connection & Real Engine** without rebuilding the image. This is stored in `localStorage` and takes effect immediately.

---

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Executive Dashboard | `#/dashboard` | Score KPIs, pillar radar, trend chart |
| Controls Catalogue | `#/catalogue` | Browse all 73+ controls, author new ones |
| Scan Findings | `#/findings` | Filterable findings table with bulk actions |
| Compliance Matrix | `#/compliance` | Pillar coverage, pass rates, regulatory mapping |
| Gap Analysis | `#/gapanalysis` | Shortest path to framework compliance |
| Changes & Drift | `#/changes` | Terraform plan changes and compliance drift |
| Deployed Regions | `#/regions` | Cloud regions on an interactive map |
| Exploit Paths | `#/exploitpath` | Attack chain visualization |
| Blast Radius | `#/blastradius` | Failing resource propagation graph |
| Dependency Graph | `#/depgraph` | Full resource dependency graph |
| Remediation Sprint | `#/remediation` | Prioritised fix queue with score projections |
| Secret Scanner | `#/secrets` | Hardcoded credential findings |
| Module Scores | `#/modules` | Per-Terraform-module pass rate |
| Cost Impact | `#/cost` | $/month impact of failing WAF-COST controls |
| Run History | `#/runs` | All scan runs with scores |
| Run Comparison | `#/diff` | Finding-level diff between two runs |
| Audit Log | `#/audit` | Waivers, risk, and scan event timeline |
| Evidence Package | `#/evidence` | Generate timestamped audit-ready HTML/JSON export |
| Run Scan | `#/runscan` | Trigger a scan or generate a CLI command |
| Architect Sandbox | `#/sandbox` | Test HCL snippets against controls in real time |
| Waivers | `#/waivers` | Manage and export control waivers |
| Risk Acceptance | `#/risk` | Formally accept risks with approver sign-off |
| Settings | `#/settings` | Maturity level, feature toggles, PDF config, server URL |
| Feedback | `#/feedback` | Send feedback to the WAF++ team |

### Deep links

Every page and run combination has a shareable URL:

```
http://localhost:3000/#/findings?run=abc-123-def
http://localhost:3000/#/compliance?run=abc-123-def
```

Use the **Copy link** button in the header to copy the current deep link.

---

## Features

### Maturity levels

Settings has five maturity presets (L1–L5) that configure which controls, pillars, and features are active:

| Level | Name | Focus |
|-------|------|-------|
| L1 | Foundational | Critical-only security, no automation |
| L2 | Operational | Security + cost, secret scanning |
| L3 | Governed | Multi-pillar, CI gating, risk scoring |
| L4 | Optimized | All controls, drift detection, evidence collection |
| L5 | Excellence | All 73 controls, carbon tracking, full intelligence |

### Findings bulk actions

In the Findings page, select multiple rows with checkboxes to:
- **Waive all selected** — creates a waiver for each unique control ID with a shared reason, owner, and expiry
- **Export selection as CSV** — download only the checked findings

A per-filtered-view CSV export button is always available in the filter bar.

### Evidence packages

The Evidence page generates a self-contained HTML report for auditors, including:
- Timestamped run metadata and sign-off details
- Passing controls with regulatory mapping (SOC2, ISO 27001, PCI-DSS, etc.)
- Active waivers and risk acceptances
- Audit event log
- Embedded JSON manifest for machine processing

Open in any browser and print to PDF for submission.

### Architect Sandbox

The Sandbox page lets you paste Terraform HCL and evaluate it against WAF++ controls instantly. Two modes:
- **Mock engine** — browser-side regex evaluation, no server needed
- **Real engine** — POSTs to `/sandbox`, runs the actual wafpass-core evaluation pipeline

See Settings → Connection & Real Engine to enable and configure the real engine.

### Audit log

All waiver and risk acceptance create/update/delete events are logged locally in `localStorage` and displayed in the Audit Log page. Events can be exported as CSV or JSON. First-seen failure tracking identifies when each failing control first appeared.

---

## Production build

```bash
npm run build   # TypeScript check + Vite build → dist/
```

## Docker

```bash
docker build -t wafpass-dashboard .
docker run -p 3000:80 wafpass-dashboard
```

The image is nginx serving the static build. The nginx config proxies API paths (`/runs`, `/controls`, `/waivers`, `/risks`, `/sandbox`, `/health`) to `wafpass-server:8000`.

---

See `TECH.md` for architecture details, routing implementation, and contribution guidance.
