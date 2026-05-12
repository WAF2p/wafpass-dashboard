# wafpass-dashboard — Technical Reference

This document covers internal architecture, design decisions, technical debt, and contribution guidance for the React dashboard. For user-facing documentation see `README.md`.

---

## Stack

| Technology | Version | Role |
|------------|---------|------|
| React | 18.2 | UI framework |
| TypeScript | 5.3 | Type safety |
| Vite | 5.1 | Build tool + dev server |
| Recharts | 2.12 | Radar, bar, line charts |
| Leaflet + react-leaflet | 1.9.4 / 4.2.1 | Region map |
| nginx | alpine | Production static file server |

No state management library (no Redux, no Zustand). No CSS framework. No component library. All styling is inline `style` objects.

---

## Directory structure

```
src/
├── main.tsx                     # ReactDOM.createRoot, wraps App in <AuthProvider>
├── index.css                    # Global CSS custom properties + utility classes
├── App.tsx                      # Root: auth guard, routing, sidebar, header, page dispatch
├── AuthContext.tsx               # Token storage, login/logout/refresh, useAuth() hook
├── api.ts                       # All fetch() calls + TypeScript interfaces (auth-gated)
├── audit.ts                     # localStorage audit log + first-seen tracking
├── controls-data.ts             # Hardcoded metadata for all 73 controls
├── region-data.ts               # Cloud region coordinates and metadata
├── pages/
│   ├── LoginPage.tsx            # Login form + SSO redirect handling
│   ├── DashboardPage.tsx        # Executive KPIs, pillar radar, trend chart
│   ├── ProjectOverviewPage.tsx  # Project passport cards with maturity tiers
│   ├── PassportDashboardPage.tsx # Single-project passport detail view
│   ├── BadgePage.tsx            # Maturity badge + achievement verification snippets
│   ├── LeaderboardPage.tsx      # Top sovereign and most improved rankings
│   ├── ControlsCataloguePage.tsx # Browse and author controls
│   ├── ControlsPage.tsx         # Run-specific controls view
│   ├── FindingsPage.tsx         # Filterable findings table with bulk actions
│   ├── CompliancePage.tsx       # Pillar coverage, pass rates, regulatory mapping
│   ├── GapAnalysisPage.tsx      # Shortest path to framework compliance
│   ├── ChangesPage.tsx          # Terraform plan changes
│   ├── DriftDetectionPage.tsx   # Run-over-run control status drift
│   ├── SkippedControlsPage.tsx  # Controls skipped due to no matching IaC resources
│   ├── RegionsPage.tsx          # Cloud regions interactive map
│   ├── ExploitPathsPage.tsx     # Attack chain visualization
│   ├── BlastRadiusPage.tsx      # Failing resource propagation graph (D3)
│   ├── DependencyGraphPage.tsx  # Full resource dependency graph (D3)
│   ├── RemediationSprintPage.tsx # Prioritised fix queue with score projections
│   ├── SecretScanPage.tsx       # Hardcoded credential findings
│   ├── ModuleScorePage.tsx      # Per-Terraform-module pass rate
│   ├── CostImpactPage.tsx       # $/month impact of failing WAF-COST controls
│   ├── RunsListPage.tsx         # All scan runs with scores
│   ├── RunDiffPage.tsx          # Finding-level diff between two runs
│   ├── AuditLogPage.tsx         # Waivers, risk, and scan event timeline
│   ├── EvidencePage.tsx         # Evidence Locker — lock packages, display QR codes
│   ├── RunScanPage.tsx          # Trigger a scan or generate a CLI command
│   ├── SandboxPage.tsx          # Test HCL against controls (mock + real engine)
│   ├── WaiversPage.tsx          # Manage and export control waivers
│   ├── RiskAcceptancePage.tsx   # Formally accept risks with approver sign-off
│   ├── AccessRolesPage.tsx      # Role hierarchy and permission overview
│   ├── SsoSettingsPage.tsx      # Configure OIDC / SAML2 providers (admin)
│   ├── GroupMappingsPage.tsx    # Map IdP groups to WAF++ roles (admin)
│   ├── ApiManagementPage.tsx    # Manage API keys for CI/CD (admin)
│   ├── UserManagementPage.tsx   # Create, edit, deactivate users
│   ├── SettingsPage.tsx         # Maturity level, feature toggles, PDF config
│   ├── UserPreferencesPage.tsx  # Appearance, navigation defaults, date formats
│   ├── ReferenceArchitecturePage.tsx # WAF++ Reference Architecture documentation
│   └── FeedbackPage.tsx         # Send feedback to the WAF++ team
└── components/
    ├── RunSelectorModal.tsx     # Run picker modal
    └── PdfReport.tsx            # Print-to-PDF report layout with dark mode support
```

---

## Routing

No React Router. Custom hash-based routing is implemented directly in `App.tsx`.

### URL format

```
#/dashboard              → page "dashboard", no run
#/findings?run=abc123    → page "findings", run "abc123"
#/settings               → page "settings", no run required
#/userprefs              → page "userprefs", no run required (preferences page)
```

**Pages without run metadata in header:** `runs`, `diff`, `catalogue`, `settings`, `runscan`, `sandbox`, `waivers`, `risk`, `audit`, `evidence`, `feedback`, `projectoverview`, `passports`, `badge`, `leaderboard`, `journey`, `userprefs`.

These pages don't show the "Run X from Y" chip in the top header because they don't require or benefit from run context.

### Key functions

```typescript
function parseHash(): { page: Page; runId: string | null }
// Reads window.location.hash, validates page against PAGE_SET

function buildHash(page: Page, runId: string | null): string
// Produces "#/page" or "#/page?run=id"

function navigate(newPage: Page): void
// Sets React state + window.history.pushState (adds history entry)
```

### Run selection

Run ID changes use `history.replaceState` (not `pushState`) so that switching runs does not add browser history entries. Page changes use `pushState` so the back button works between pages.

### Popstate listener

A `popstate` listener in `useEffect` handles browser back/forward. It reads `parseHash()` and sets both `page` and `selectedId` in React state.

### Initial deep link

On mount, `parseHash().runId` is captured in `initialHashRunId` (a `useRef`). After the runs list loads, if that ID is found in the list it is pre-selected, enabling bookmark/share links to land directly on the right run.

---

## Authentication (`AuthContext.tsx`)

### Token flow — local login

```
LoginPage
    │  login(username, password)
    ▼
api.ts: POST /auth/login
    │
    │  {access_token, refresh_token, user}
    ▼
AuthContext
    ├─ localStorage.setItem('wafpass_access_token', ...)
    ├─ localStorage.setItem('wafpass_refresh_token', ...)
    ├─ localStorage.setItem('wafpass_auth_user', JSON.stringify(user))
    └─ setState({ user, accessToken, role })

App.tsx checks: if (!user) → <LoginPage />
               else       → <AuthenticatedApp />
```

### Token flow — SSO (OIDC / SAML2)

```
LoginPage
    │  user clicks "Sign in with OIDC / SAML2"
    ▼
window.location = /auth/oidc/authorize  (or /auth/saml/login)
    │
    ▼
Server performs IdP redirect → callback → JWKS signature verification
    │  (OIDC: id_token verified against IdP public key; nonce validated)
    │  302 redirect to dashboard
    │  ?sso_ok=1&at=<access_token>&rt=<refresh_token>&u=<base64_user>
    ▼
LoginPage (on mount, detects sso_ok=1 in URL params)
    ├─ extract at, rt, u from URLSearchParams
    ├─ decode user: JSON.parse(atob(u))
    ├─ AuthContext.loginWithTokens(at, rt, user)
    │   ├─ localStorage.setItem('wafpass_access_token', at)
    │   ├─ localStorage.setItem('wafpass_refresh_token', rt)
    │   └─ localStorage.setItem('wafpass_auth_user', JSON.stringify(user))
    └─ window.history.replaceState(null, '', pathname + '#/dashboard')
       (clears tokens from URL / browser history immediately)
```

The tokens arrive via URL query parameters, which is a standard OAuth 2.0 pattern for SPA redirects. The URL is cleaned up synchronously via `replaceState` before any navigation can leak them. The server ensures the tokens are only issued after full IdP verification — the dashboard trusts and stores what the server provides.

### On-mount session restore

1. Read `wafpass_access_token` from localStorage
2. Decode the JWT payload (`atob(token.split('.')[1])`) — check `exp`
3. If valid → restore session immediately (no network round-trip)
4. If expired but `wafpass_refresh_token` exists → `POST /auth/refresh` → store new access token
5. If refresh fails → clear all tokens → show LoginPage

### `useAuth()` hook

```typescript
const { user, role, accessToken, isLoading, login, logout } = useAuth()
```

### Role-filtered nav

`App.tsx` computes `visibleSections` by filtering `navSections` with:

```typescript
const visibleSections = navSections.filter(s => hasMinRole(role, s.id))
```

`hasMinRole(userRole, minimum)` returns true when `ROLE_HIERARCHY.indexOf(userRole) >= ROLE_HIERARCHY.indexOf(minimum)`. Section IDs (`clevel`, `ciso`, `architect`, `engineer`) map directly to the role names so no separate mapping is needed.

| User role | Visible sections |
|---|---|
| `clevel` | C-Level only |
| `ciso` | C-Level, CISO |
| `architect` | C-Level, CISO, Architect |
| `engineer` | All sections |

### Auth headers in api.ts

Every `fetch()` call in `api.ts` passes `_authHeaders()`:

```typescript
function _authHeaders(): Record<string, string> {
  const t = localStorage.getItem('wafpass_access_token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}
```

This reads directly from localStorage rather than React state so it works outside component render cycles (e.g. in event handlers and `useEffect`).

---

## State management

All state lives in `App.tsx` and is passed down as props. Auth state lives in `AuthContext` (React context).

### App-level state

| State | Type | Description |
|-------|------|-------------|
| `runs` | `RunSummary[]` | All loaded run summaries |
| `selectedId` | `string \| null` | Active run ID |
| `run` | `RunDetail \| null` | Full detail for selected run |
| `page` | `Page` | Current page |
| `settings` | `Settings` | Feature toggles, maturity level |
| `maturityLevel` | `number` | Active maturity level (1–5) |
| `waiverCount` | `number` | Count badge for sidebar |
| `riskCount` | `number` | Count badge for sidebar |

### localStorage

Several systems use `localStorage` for persistence:

| Key | Content | Owner |
|-----|---------|-------|
| `wafpass_settings` | Serialised `Settings` object | SettingsPage |
| `wafpass_maturity` | Maturity level integer | SettingsPage |
| `wafpass_audit_log` | Array of `AuditEvent` (max 2000) | audit.ts |
| `wafpass_first_seen_failures` | `Record<string, FirstSeenEntry>` | audit.ts |
| `wafpass_waivers` | `Record<id, WaiverRecord>` cache | WaiversPage |
| `wafpass_risk_acceptances` | `Record<id, RiskRecord>` cache | RiskAcceptancePage |
| `wafpass_server_url` | Custom backend URL string | SettingsPage / api.ts |

Waivers and risk acceptances use localStorage as an **offline cache**: on mount, the page fetches from the server and writes to localStorage; on mutation, it calls the server then updates localStorage. If the server is unreachable, the cache serves stale data.

---

## API client (`api.ts`)

All server communication goes through `api.ts`. Each function is a thin wrapper around `fetch()` — no HTTP client library.

### Dynamic base URL

```typescript
const ENV_API_BASE = import.meta.env.VITE_API_URL ?? ''

export function getApiBase(): string {
    const stored = localStorage.getItem('wafpass_server_url')
    if (stored?.trim()) return stored.trim().replace(/\/$/, '')
    return ENV_API_BASE   // falls back to Vite env var or same-origin
}
```

This is called on every request, so changing the server URL in Settings takes effect immediately without a page reload.

**Fallback chain (highest to lowest priority):**
1. `localStorage` key `wafpass_server_url` — set via Settings → Connection & Real Engine
2. `VITE_API_URL` build-time env var — set in `.env.local` (local dev) or Docker build args
3. Empty string — resolves to same origin (correct for Docker Compose with nginx proxy)

**`.env.example`** (in `wafpass-dashboard/`) documents `VITE_API_URL`. Copy to `.env.local` for local development:

```bash
cp .env.example .env.local
# VITE_API_URL=http://localhost:8000
```

Pages that need the server URL at render time (e.g. `RunScanPage`) call `getApiBase()` directly with a fallback to `http://localhost:8000` when the result is empty.

### Error handling convention

Functions throw `Error` on non-OK responses. They distinguish `TypeError` (network unreachable — fetch throws synchronously) from HTTP errors (server responded with 4xx/5xx) so pages can show appropriate messages:

```typescript
try {
    const data = await fetchWaivers()
} catch (e) {
    if (e instanceof TypeError) {
        // Network error — server unreachable
    } else {
        // HTTP error — server responded but returned an error
    }
}
```

### Findings comments API

The findings comments endpoints (`/findings-comments`, `/secret-findings-comments`) support:
- `fetchFindingComments(findingId)` — list comments for a finding
- `createFindingComment(findingId, message)` — add a comment
- `deleteFindingComment(commentId)` — remove a comment

All require Bearer JWT authentication (clevel+ role).

---

## Settings and maturity system

### Settings interface

```typescript
interface Settings {
    defaultIac: string          // "terraform" | "cdk" | ...
    failOn: string              // "fail" | "skip" | "never"
    defaultSeverity: string     // "" | "critical" | "high" | "medium"
    activePillars: string[]     // subset of 7 pillars
    secretScanner: boolean
    autoFix: boolean
    blastRadius: boolean
    driftDetection: boolean
    complianceGating: boolean
    riskScoring: boolean
    dependencyGraph: boolean
    carbonTracking: boolean
    evidenceCollection: boolean
    multiCloudNormalization: boolean
    pdfAutoOpen: boolean
    hideDisabledMenuItems: boolean  // hides gated sidebar entries
    reportSections: ReportSections
}
```

### Feature gates in sidebar

Each nav/tool item has an optional `gate?: boolean` field. When `settings.hideDisabledMenuItems` is true, items with `gate === false` are filtered from the sidebar:

```typescript
const visibleNavItems = settings.hideDisabledMenuItems
    ? navItems.filter(i => i.gate === undefined || i.gate)
    : navItems
```

Gate values are computed from `settings` at render time, so toggling a setting and saving immediately reflects in the sidebar.

| Sidebar item | Gate source |
|---|---|
| Changes & Drift | `settings.driftDetection` |
| Blast Radius | `settings.blastRadius` |
| Dependency Graph | `settings.dependencyGraph` |
| Secret Scanner | `settings.secretScanner` |
| Cost Impact | `settings.activePillars.includes('cost')` |
| Evidence Package | `settings.evidenceCollection` |

---

## Audit log (`audit.ts`)

The audit log is browser-local (localStorage). It records waiver creates/updates/deletes, risk acceptance events, and scan receives. Maximum 2000 events; oldest are dropped when the limit is exceeded.

```typescript
interface AuditEvent {
    id: string            // timestamp-random UUID-lite
    timestamp: string     // ISO 8601
    actor: string
    category: 'waiver' | 'risk' | 'scan' | 'finding'
    action: AuditAction
    subject_id: string
    subject_type: string
    summary: string
    before?: unknown
    after?: unknown
}
```

The first-seen failure index (`wafpass_first_seen_failures`) records the first run in which each control+resource combination appeared as failing. This powers the "oldest open failure" metric in the Audit Log page.

**Design limitation:** The audit log is per-browser. It cannot be shared across team members. The server does not persist audit events. This is the primary audit trail gap.

---

## PDF report

The PDF report (`components/PdfReport.tsx`) is a hidden `div` rendered at the bottom of the page and only visible during `window.print()`. It uses CSS `@media print` to show/hide the correct content.

```html
<!-- App.tsx -->
<div id="wafpass-pdf-root" style="display:none">
    <PdfReport run={run} settings={settings} maturityLevel={maturityLevel} />
</div>
```

```css
/* index.css */
@media print {
    body > *:not(#wafpass-pdf-root) { display: none; }
    #wafpass-pdf-root { display: block !important; }
}
```

Which sections appear in the PDF is controlled by `settings.reportSections`.

---

## Evidence package

`EvidencePage.tsx` generates a self-contained HTML string in the browser and downloads it. The HTML:
- Is a complete standalone document (no external dependencies)
- Includes a `Print / Save as PDF` button that calls `window.print()`
- Embeds all data as a JSON manifest in a `<details>` block
- Uses inline styles only (no CSS classes) for maximum portability

No server round-trip; no additional library. The entire HTML is built by string concatenation in `generateHtml()`.

---

## Architect Sandbox

`SandboxPage.tsx` has two evaluation modes:

| Mode | Implementation |
|------|---------------|
| Mock | Browser-side regex matching against control check descriptions |
| Real | `POST /sandbox` → server runs wafpass-core, returns actual findings |

`sandboxStatus()` is called on mount to check if the real engine is available. If unavailable, the Real button is disabled with an explanatory tooltip.

The `fromRealEngine()` function in `SandboxPage.tsx` adapts the `SandboxResponse` API shape to the `SandboxOutput` type used by the results rendering. This adapter exists because the mock and real engines were built at different times with slightly different result structures.

---

## Build and deployment

### Dev server

```bash
npm run dev   # Vite dev server on :5173
```

Vite's dev proxy (`vite.config.ts`) forwards `/runs`, `/controls`, `/waivers`, `/risks`, `/sandbox`, `/health` to `http://localhost:8000`.

### Production

```bash
npm run build   # tsc && vite build → dist/
```

TypeScript is checked first (`tsc`), then Vite builds the production bundle. The bundle is a single JS chunk (~1.3 MB minified, ~330 KB gzip). The chunk size warning (`> 500 KB`) fires but is acceptable for an internal tool.

**Technical debt:** Code splitting is not configured. All 27 pages and all dependencies are in a single chunk. Adding `build.rollupOptions.output.manualChunks` to `vite.config.ts` could reduce initial load time significantly.

### Docker

Multi-stage build:
1. `node:20-slim` — `npm install && npm run build` → `dist/`
2. `nginx:alpine` — copies `dist/` to `/usr/share/nginx/html`

The nginx config (`nginx.conf`) proxies API paths to `wafpass-server:8000` (Docker network hostname). If you run the server on a different hostname, update `nginx.conf` and rebuild.

---

## Evidence Locker architecture

`EvidencePage.tsx` has two rendering modes:

**Local (browser-only):** Generates a self-contained HTML string via `generateHtml()` and triggers a browser download. All data comes from `run`, `waivers`, `risks`, and `auditLog` already in React state — no server round-trip.

**Server-locked:** Calls `createEvidence()` in `api.ts` which POSTs to `/evidence`. The server:
1. Computes `SHA-256(canonical_json(snapshot))` and stores it in `hash_digest`.
2. Generates a `public_token` (32-char URL-safe random) for the unauthenticated auditor URL.
3. Returns `EvidenceOut` including `id`, `hash_digest`, `public_token`.

The dashboard then renders:
- The SHA-256 hash digest (copyable, for independent verification against `/evidence/{id}/snapshot`).
- The public auditor URL (`/evidence/p/{token}`) as a copyable link.
- A QR code image fetched from `/evidence/{id}/qr.svg` (SVG generated server-side by the `segno` library; falls back to a placeholder if not installed).

The QR code encodes the public URL so auditors can scan it with a phone to access the frozen HTML report without logging in.

## Achievement and Badge architecture

`BadgePage.tsx` calls `fetchBadgeStatus(project)` which reads `/public/badge/{project}/json` — a public, no-auth endpoint that returns the latest run's tier level, label, color, and score. The page generates ready-to-paste badge snippets for Markdown, HTML, AsciiDoc, reStructuredText, Org-mode, and JSON.

`LeaderboardPage.tsx` calls `GET /leaderboard` and renders two ranked tables. Both use `ProjectPassport` display names and owner metadata when available.

Achievement verification tokens are surfaced as `GET /public/achievements/{token}` — a fully rendered HTML page served directly by the server with no React dependency. The page shows the tier badge, score, pillar scores at achievement time, and the verification token in a monospace box.

---

## Technical debt

### 401 not automatically handled

When a server returns 401 (expired token, not refreshed), api.ts throws `Error('HTTP 401')`. The page shows an error message but doesn't redirect to login. A centralised 401 interceptor (e.g. `authedFetch()` wrapper that calls `AuthContext.logout()` on 401) would improve the UX, but requires injecting the React context into api.ts — deferred to Phase 2.

---

## Adding a new page

1. Create `src/pages/MyPage.tsx` (export default component)
2. Add `'mypage'` to `ALL_PAGES` in `App.tsx`
3. Add entries to `PAGE_TITLE` and `PAGE_SUBTITLE` in `App.tsx`
4. Add the import and a branch in the page dispatch JSX in `App.tsx`
5. Add a sidebar button (in `navItems` or `toolItems` or manually)
6. If the page needs a `gate`, add `gate: settings.myFeature` to the sidebar item

If the page does not require a selected run, add it to the exclusion list in the header's run-context span (the line starting with `run && page !== 'runs' && ...`).
