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
# Copy and edit the environment file (Vite reads .env.local automatically)
cp .env.example .env.local
# Edit .env.local — set VITE_API_URL=http://localhost:8000 to point at a local wafpass-server

npm install
npm run dev
```

Opens at `http://localhost:5173`. In dev mode, Vite proxies `/runs`, `/controls`, `/waivers`, `/risks`, `/sandbox`, and `/health` to `http://localhost:8000`.

---

## Authentication

The dashboard requires login. On first visit you will be shown a sign-in form.

The **admin** account is seeded automatically by `wafpass-server` on its first startup — set `WAFPASS_ADMIN_PASSWORD` in the server's `.env` to enable this.

### Roles

| Role | Access |
|------|--------|
| `clevel` | Read-only: dashboard, compliance, cost, gap analysis |
| `ciso` | Above + waivers, risk acceptance, audit log, evidence |
| `architect` | Above + controls catalogue, exploit paths, blast radius, sandbox |
| `engineer` | Full access including run scan, findings, secret scanner, user management |

The sidebar automatically hides sections the signed-in user cannot access.

---

## Environment variables

Copy `.env.example` to `.env.local` for local development — Vite reads `.env.local` automatically and it is git-ignored by default.

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `""` (same origin) | Base URL of wafpass-server — no trailing slash, no `/runs` suffix, e.g. `http://localhost:8000` |

In Docker Compose the nginx reverse proxy routes API paths to `wafpass-server:8000` automatically, so `VITE_API_URL` is only needed for cross-origin or local dev setups.

**Runtime override:** You can also set the server URL at runtime in **Settings → Connection & Real Engine** without rebuilding the image. This is stored in `localStorage`, takes effect immediately, and takes precedence over `VITE_API_URL`. The default when nothing is configured is `http://localhost:8000`.

---

## Pages

| Page | Route | Min Role | Description |
|------|-------|----------|-------------|
| Executive Dashboard | `#/dashboard` | clevel | Score KPIs, pillar radar, trend chart |
| Project Overview | `#/projects` | clevel | Per-project passport cards with maturity tiers and badges |
| Project Passport | `#/passport` | clevel | Detailed passport view for a single project |
| Achievements & Badges | `#/badges` | clevel | Per-project maturity badge and shareable achievement cards |
| Leaderboard | `#/leaderboard` | clevel | Hall of Fame — top sovereign and most improved projects |
| Controls Catalogue | `#/catalogue` | architect | Browse all 73+ controls, author new ones |
| Scan Findings | `#/findings` | engineer | Filterable findings table with bulk actions |
| Compliance Matrix | `#/compliance` | clevel | Pillar coverage, pass rates, regulatory mapping |
| Gap Analysis | `#/gapanalysis` | clevel | Shortest path to framework compliance |
| Changes & Drift | `#/changes` | engineer | Terraform plan changes and compliance drift |
| Drift Detection | `#/drift` | engineer | Run-over-run control status drift |
| Skipped Controls | `#/skipped` | ciso | Controls skipped due to no matching IaC resources |
| Deployed Regions | `#/regions` | clevel | Cloud regions on an interactive map |
| Exploit Paths | `#/exploitpath` | architect | Attack chain visualization |
| Blast Radius | `#/blastradius` | architect | Failing resource propagation graph |
| Dependency Graph | `#/depgraph` | architect | Full resource dependency graph |
| Remediation Sprint | `#/remediation` | engineer | Prioritised fix queue with score projections |
| Secret Scanner | `#/secrets` | engineer | Hardcoded credential findings |
| Module Scores | `#/modules` | engineer | Per-Terraform-module pass rate |
| Cost Impact | `#/cost` | clevel | $/month impact of failing WAF-COST controls |
| Run History | `#/runs` | clevel | All scan runs with scores |
| Run Comparison | `#/diff` | engineer | Finding-level diff between two runs |
| Audit Log | `#/audit` | ciso | Waivers, risk, and scan event timeline |
| Evidence Package | `#/evidence` | ciso | Lock and export cryptographically-signed audit packages with QR codes |
| Run Scan | `#/runscan` | engineer | Trigger a scan or generate a CLI command |
| Architect Sandbox | `#/sandbox` | architect | Test HCL snippets against controls in real time |
| Waivers | `#/waivers` | ciso | Manage and export control waivers |
| Risk Acceptance | `#/risk` | ciso | Formally accept risks with approver sign-off |
| Access Roles | `#/roles` | engineer | View role hierarchy and permissions |
| SSO Settings | `#/sso` | admin | Configure OIDC / SAML2 providers and group mappings |
| Group Mappings | `#/groupmappings` | admin | Map IdP groups to WAF++ roles |
| API Management | `#/apikeys` | admin | Manage API keys for CI/CD pipelines |
| User Management | `#/users` | engineer | Create, update, and deactivate user accounts |
| Settings | `#/settings` | clevel | Maturity level, feature toggles, PDF config, server URL |
| Feedback | `#/feedback` | clevel | Send feedback to the WAF++ team |

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

### Achievements and Leaderboard

Projects earn cryptographically-signed maturity tier badges when they reach a compliance score threshold for the first time. Each achievement has a unique verification token that resolves to a public HTML page at `/public/achievements/{token}` — suitable for embedding in READMEs and external dashboards.

**Tier thresholds:** L1 Foundational (≥0), L2 Operational (≥40), L3 Governed (≥60), L4 Optimized (≥75), L5 Excellence (≥90).

The **Leaderboard** page shows two ranked lists: **Top Sovereign** (projects that have held Tier 5 longest) and **Most Improved** (projects gaining the most tiers in the last 30 days).

The **Badges** page generates ready-to-paste badge snippets in Markdown, HTML, AsciiDoc, reStructuredText, Org-mode, and JSON formats for any project.

### Project Passport

Each project can have a **passport** — a metadata card with display name, owner, team, contact email, criticality level, environment, cloud provider, repository URL, and tags. Passports are editable by architects and above. The Project Overview page renders all passports as cards with their current maturity tier.

### Evidence Locker (Cryptographic Evidence)

The Evidence page has two sections:

**Create & Export** — build a self-contained HTML evidence package locally in the browser, including timestamped run metadata, sign-off details, passing/failing controls with regulatory mapping (SOC2, ISO 27001, PCI-DSS, etc.), active waivers and risk acceptances, and an embedded JSON manifest. No server required; download and print to PDF.

**Evidence Locker** — lock the package server-side for tamper-proof audit handover:
1. Click **Lock on server** — the snapshot is frozen and a SHA-256 hash digest is computed from its canonical representation.
2. A unique **public token** is generated — auditors access the frozen HTML report at `/evidence/p/{token}` without needing a login.
3. A **QR code** is displayed (SVG, generated via the `segno` library) linking directly to the public auditor URL — scan with a phone to verify.
4. The SHA-256 hash appears in the evidence header and can be verified independently against the raw JSON snapshot at `/evidence/{id}/snapshot`.

Once locked, the snapshot is immutable. Deleting requires `admin` role.

### Findings bulk actions

In the Findings page, select multiple rows with checkboxes to:
- **Waive all selected** — creates a waiver for each unique control ID with a shared reason, owner, and expiry
- **Export selection as CSV** — download only the checked findings

A per-filtered-view CSV export button is always available in the filter bar.

### Architect Sandbox

The Sandbox page lets you paste Terraform HCL and evaluate it against WAF++ controls instantly. Two modes:
- **Mock engine** — browser-side regex evaluation, no server needed
- **Real engine** — POSTs to `/sandbox`, runs the actual wafpass-core evaluation pipeline

See Settings → Connection & Real Engine to enable and configure the real engine.

### Audit log

All waiver and risk acceptance create/update/delete events are logged locally in `localStorage` and displayed in the Audit Log page. Events can be exported as CSV or JSON. First-seen failure tracking identifies when each failing control first appeared.

### User and API key management

The **User Management** page (engineer+) supports creating, editing, and deactivating user accounts and setting roles. The **API Management** page (admin) manages named API keys for CI/CD pipelines — each key can be revoked independently.

### SSO and group mapping

The **SSO Settings** page (admin) configures OIDC and SAML2 providers without restarting the server. The **Group Mappings** page maps IdP group names to WAF++ roles, applied at login time.

**OIDC security:** The server verifies the `id_token` signature using the IdP's public JWKS (fetched from `jwks_uri` in the discovery document) and validates the `aud` claim and a per-request nonce before provisioning the user. Ensure your IdP exposes a `jwks_uri` in its OpenID Connect discovery document — all major providers (Keycloak, Entra ID, Okta, Auth0) do by default.

**SAML2 security:** The server validates the assertion XML signature against the configured IdP certificate via `python3-saml` (strict mode).

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
