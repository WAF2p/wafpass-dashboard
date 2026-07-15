# WAF++ Reference Architecture

This document provides a comprehensive, end-to-end reference architecture for the WAF++ PASS system - showing how the **wafpass-core CLI**, **wafpass-server API**, and **wafpass-dashboard** work together as a unified compliance scanning platform.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   WAF++ PASS ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌─────────────────┐         ┌──────────────────┐         ┌─────────────────────────┐      │
│  │   wafpass-core  │         │  wafpass-server  │         │  wafpass-dashboard    │      │
│  │  (CLI / Engine) │◄───────►│   (FastAPI/DB)   │◄───────►│   (React SPA)         │      │
│  │                 │         │                  │         │                         │      │
│  │ - IaC Parsing   │  API    │ - RESTful API    │  HTTP   │ - Browser UI            │      │
│  │ - Control Eval  │  Calls  │ - PostgreSQL     │  Calls  │ - Real-time Updates   │      │
│  │ - Scan Results  │         │ - JWT Auth       │         │ - Deep Linking        │      │
│  └─────────────────┘         └──────────────────┘         └─────────────────────────┘      │
│                                       ▲           │                                         │
│                                       │           ▼                                         │
│                               ┌──────────────────┐                                         │
│                               │   PostgreSQL     │                                         │
│                               │   (Data Layer)   │                                         │
│                               │                  │                                         │
│                               │ - Users          │                                         │
│                               │ - Runs           │                                         │
│                               │ - Waivers        │                                         │
│                               │ - Risks          │                                         │
│                               │ - Evidence       │                                         │
│                               │ - Achievements   │                                         │
│                               └──────────────────┘                                         │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Roles

### wafpass-core (The Scanning Engine)

| Responsibility | Details |
|----------------|---------|
| **IaC Parsing** | Parses Terraform HCL, CloudFormation YAML, CDK TypeScript, Pulumi Python |
| **Control Evaluation** | Runs 73+ security controls against parsed infrastructure |
| **Finding Detection** | Identifies misconfigurations, security gaps, compliance issues |
| **Region Detection** | Discovers cloud regions from IaC resources |
| **Dependency Analysis** | Builds resource dependency graphs |
| **Blast Radius** | Calculates failure propagation paths |
| **Plan Changes** | Analyzes Terraform plan JSON for drift detection |

**Key Point:** wafpass-core is a **command-line tool** - it does NOT store data. It produces scan results that are pushed to wafpass-server.

### wafpass-server (The API & Persistence Layer)

| Responsibility | Details |
|----------------|---------|
| **Data Persistence** | Stores all scan results in PostgreSQL |
| **Authentication** | JWT tokens + refresh tokens + API keys |
| **SSO Integration** | OIDC and SAML2 providers |
| **Role-Based Access** | clevel, ciso, architect, engineer, admin |
| **Audit Logging** | Tracks all waiver/risk/scan events |
| **Evidence Locker** | Cryptographically-signed audit packages |
| **Achievements** | Tracks maturity tier milestones |
| **Control Catalogue** | Manages builtin + custom controls |

**Key Point:** wafpass-server is a **stateless API server** - all state is in PostgreSQL. It can be horizontally scaled.

### wafpass-dashboard (The UI Layer)

| Responsibility | Details |
|----------------|---------|
| **User Interface** | React SPA with hash-based routing |
| **Run Selection** | Deep-linkable URLs with run context |
| **Visualization** | Charts, maps, graphs via Recharts + Leaflet + D3 |
| **PDF Generation** | Print-optimized reports with dark mode |
| **Evidence Package** | Browser-side HTML generation + QR codes |
| **Real-time Sync** | localStorage + server sync for prefs |
| **i18n Support** | 6 languages with fallback to English |

**Key Point:** wafpass-dashboard is a **static SPA** - no server-side rendering. All data comes from wafpass-server.

---

## Detailed Architecture Flow

### 1. Scan Execution Flow

```
Developer/CI System
       │
       ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  wafpass check [flags]                                                      │
│  - Parse IaC files (Terraform HCL / CloudFormation YAML / CDK TS / Pulumi Python) │
│  - Load 73+ controls from controls/ directory                              │
│  - Evaluate each control against parsed state                              │
│  - Generate findings with severity, resource, remediation                  │
│  - Detect regions, build dependency graph, analyze plan changes           │
└───────────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  POST /runs (wafpass-server API)                                            │
│  - JSON payload: { project, branch, git_sha, findings, pillar_scores, ...} │
│  - Auth: Bearer JWT or X-Api-Key header                                    │
└───────────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  wafpass-server /runs Router                                                │
│  - Verify authentication                                                   │
│  - Validate input schema                                                   │
│  - Evaluate achievements (tier thresholds)                                 │
│  - Save to PostgreSQL runs table                                          │
│  - Generate response with run ID                                           │
└───────────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  PostgreSQL: runs table                                                     │
│  - id (UUID)                                                               │
│  - project, branch, git_sha                                                │
│  - score, pillar_scores (JSONB)                                            │
│  - findings (JSONB - list of FindingSchema)                               │
│  - controls_meta (JSONB)                                                   │
│  - detected_regions (JSONB)                                                │
│  - created_at (TIMESTAMPTZ)                                                │
└───────────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  Dashboard: Auto-refreshes runs list via GET /runs                         │
│  - New run appears in sidebar                                              │
│  - User can select run to view detailed results                           │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 2. Authentication Flow (Local Login)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  Browser: LoginPage.tsx                                                     │
│  User enters username/password                                              │
└───────────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  POST /auth/login (wafpass-server)                                          │
│  - wafpass_server/routers/auth.py                                          │
│  - auth/providers/local.py validates bcrypt password hash                  │
└───────────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  JWT Token Generation                                                       │
│  - wafpass_server/auth/jwt_utils.py                                        │
│  - create_access_token(): HS256 JWT, 15 min expiry                        │
│  - secrets.token_urlsafe(): opaque refresh token (stored hashed in DB)    │
│  - Response includes: access_token, refresh_token, user object            │
└───────────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  Browser: AuthContext.loginWithTokens()                                    │
│  localStorage.setItem('wafpass_access_token', access_token)                │
│  localStorage.setItem('wafpass_refresh_token', refresh_token)              │
│  localStorage.setItem('wafpass_auth_user', JSON.stringify(user))          │
└───────────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  Dashboard: App.tsx checks useAuth().user                                  │
│  - If user exists → render AuthenticatedApp                                │
│  - If no user → render LoginPage                                           │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 3. Session Restore Flow (On Mount)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  Browser: AuthProvider on mount                                            │
│  1. Check localStorage for wafpass_access_token                           │
│  2. Decode JWT payload (base64) and check 'exp' claim                     │
└───────────────────────────────────────────────────────────────────────────────┘
       │
       ├─ Token Still Valid?
       │       │
       │       ├─ YES → Restore session immediately (no network round-trip)
       │       │
       │       └─ NO → Check for wafpass_refresh_token
       │               │
       │               ├─ Has Refresh Token?
       │               │       │
       │               │       ├─ YES → POST /auth/refresh
       │               │       │    - Server verifies refresh token in DB
       │               │       │    - Issues new access token
       │               │       │    - Updates localStorage
       │               │       │
       │               │       └─ NO → Clear all tokens → Show LoginPage
       │
       └─ SSO Callback?
               │
               ├─ ?sso_ok=1&at=...&rt=...&u=BASE64
               │    - Extract tokens from URL
               │    - Store in localStorage
               │    - Clear URL via replaceState
               │
               └─ Normal flow continues...
```

### 4. API Client Pattern (api.ts)

```typescript
// Dynamic base URL with priority chain:
// 1. localStorage.wafpass_server_url (runtime override)
// 2. VITE_API_URL (build-time config)
// 3. Empty string (same origin, for Docker Compose)

export function getApiBase(): string {
  try {
    const stored = localStorage.getItem('wafpass_server_url')
    if (stored?.trim()) return stored.trim().replace(/\/$/, '')
  } catch {}
  return ENV_API_BASE
}

// Auth headers helper:
function _authHeaders(): Record<string, string> {
  const t = getAccessToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

// Example API call:
export async function fetchRuns(): Promise<RunPage> {
  const url = new URL(`${getApiBase()}/runs`, window.location.origin)
  const res = await fetch(url.toString(), { headers: _authHeaders() })
  if (!res.ok) throw new Error(`Failed to fetch runs: ${res.status}`)
  const json = await res.json() as ApiEnvelope<RunSummary[]>
  return { items: json.data, nextCursor: json.meta?.next_cursor ?? null }
}
```

### 5. Routing Architecture (No React Router)

```typescript
// Hash-based routing in App.tsx

// URL formats:
// #/dashboard              → no run context
// #/findings?run=abc123    → findings page, run abc123
// #/settings               → settings page

function parseHash(): { page: Page; runId: string | null } {
  const hash = window.location.hash || '#/dashboard'
  const [path, queryString] = hash.slice(2).split('?')
  const page = path as Page
  
  if (queryString) {
    const params = new URLSearchParams(queryString)
    return { page, runId: params.get('run') }
  }
  return { page, runId: null }
}

function buildHash(page: Page, runId: string | null): string {
  if (runId) return `#/${page}?run=${runId}`
  return `#/${page}`
}

// Page navigation:
function navigate(newPage: Page) {
  setPage(newPage)
  window.history.pushState(null, '', buildHash(newPage, selectedId))
}

// Run selection (no history entry):
function selectRun(runId: string) {
  setSelectedId(runId)
  window.history.replaceState(null, '', buildHash(page, runId))
}
```

### 6. State Management Pattern

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  App.tsx State (React Component State)                                     │
│  ├─ runs: RunSummary[]                  // All loaded runs                 │
│  ├─ selectedId: string | null           // Active run ID                   │
│  ├─ run: RunDetail | null               // Full detail for selected run     │
│  ├─ page: Page                          // Current page                     │
│  ├─ settings: Settings                  // Feature toggles                 │
│  ├─ maturityLevel: number               // Active level (1-5)              │
│  ├─ waiverCount: number                 // Sidebar badge                   │
│  └─ riskCount: number                   // Sidebar badge                   │
└───────────────────────────────────────────────────────────────────────────────┘
                     │                              │
         ┌───────────┴───────┐     ┌───────────────┴───────────┐
         │                   │     │                           │
         ▼                   ▼     ▼                           ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────────┐
│  localStorage    │  │   wafpass_server │  │      React Context           │
│                  │  │                  │  │                              │
│ - wafpass_auth   │  │ - PostgreSQL     │  │  AuthContext               │
│ - wafpass_settings│ │ - runs table     │  │  - user, role, accessToken   │
│ - wafpass_maturity│ │ - users table    │  │  - login(), logout()         │
│ - wafpass_waivers │ │ - waivers table  │  │                              │
│ - wafpass_risks   │ │ - risks table    │  │  AuthProvider                │
└──────────────────┘  └──────────────────┘  └──────────────────────────────┘
```

### 7. Role-Based Access Control (RBAC)

```typescript
// Role hierarchy (mirrors backend):
export const ROLE_HIERARCHY = ['clevel', 'ciso', 'architect', 'engineer', 'admin'] as const

export function hasMinRole(userRole: string, minimum: string): boolean {
  const roleIndex = (role: string) => ROLE_HIERARCHY.indexOf(role as Role)
  return roleIndex(userRole) >= roleIndex(minimum)
}

// Sidebar visibility:
const visibleSections = navSections.filter(s => 
  hasMinRole(role, s.id)
)

// Nav item gates (feature flags):
const visibleNavItems = settings.hideDisabledMenuItems
  ? navItems.filter(i => i.gate === undefined || i.gate)
  : navItems
```

| Role | Minimum Access | Key Capabilities |
|------|---------------|------------------|
| `clevel` | Read-only | Dashboard, compliance, cost, gap analysis |
| `ciso` | + Waivers/Risks | Audit log, evidence locker, risk acceptance |
| `architect` | + Controls | Catalogue, exploit paths, blast radius, sandbox |
| `engineer` | + Full Scan | Run scan, findings, secret scanner, user management |
| `admin` | + System | SSO settings, group mappings, API keys, all users |

### 8. Database Schema (PostgreSQL)

```sql
-- Users + Authentication
users                    -- User accounts with role, auth_provider
refresh_tokens           -- Refresh token rotation + family tracking
sso_configs              -- OIDC/SAML2 provider config (JSONB)
group_role_mappings      -- IdP group → WAF++ role mapping
api_keys                 -- CI/CD API keys
user_audit_logs          -- User action audit trail

-- Compliance Data
runs                     -- Scan results (findings, controls_meta as JSONB)
waivers                  -- Control waivers
risk_acceptances         -- Risk acceptances
control_packs            -- Versioned control catalogue

-- Audit & Evidence
compliance_audit_events  -- Server-side audit events
evidence                 -- Locked audit packages with QR codes
project_passports        -- Per-project metadata
project_achievements     -- Maturity tier milestones

-- Findings Comments
findings_comments        -- Comments on findings (normalized from runs)
secret_findings_comments -- Comments on secret findings
run_findings             -- Normalized findings for filtering
run_secret_findings      -- Normalized secret findings
```

### 9. JWT Token Structure

```json
// Access Token (HS256, 15 min expiry)
{
  "sub": "uuid:user-id",
  "username": "s.lewandowski",
  "role": "engineer",
  "type": "access",
  "iat": 1714732800,
  "exp": 1714733700
}

// Refresh Token (Opaque string, stored hashed in DB)
// - Random 32-char URL-safe string
// - SHA-256 hash stored in refresh_tokens table
// - Family ID for stolen token detection
// - Expiry: typically 30 days
```

### 10. SSO Flow (OIDC)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  Browser                                                                                    │
│  User clicks "Sign in with OIDC"                                                           │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│  GET /auth/oidc/authorize (wafpass-server)                                                   │
│  - Fetch IdP discovery doc                                                                  │
│  - Generate nonce=random_hex(16), state=HS256_JWT{nonce, exp}                             │
│  - 302 redirect: {idp_url}?client_id=...&state=...&nonce=...&redirect_uri=...             │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│  IdP Authentication Page                                                                      │
│  - User authenticates (password, MFA, etc.)                                                 │
│  - IdP binds nonce into id_token                                                            │
│  - 302 redirect back: {callback_url}?code=...&state=...                                   │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│  GET /auth/oidc/callback (wafpass-server)                                                    │
│  - Verify state JWT (WAFPASS_JWT_SECRET, 10 min TTL)                                       │
│  - POST token_endpoint with authorization_code                                             │
│  - Fetch JWKS from discovery["jwks_uri"]                                                   │
│  - Verify id_token signature (RS256/EC) using IdP public key                              │
│  - Validate aud == client_id and nonce matches state nonce                                │
│  - Provision/update User row (auth_provider="oidc")                                       │
│  - Issue WAF++ JWT + refresh token                                                         │
│  - 302 redirect: {frontend_url}?sso_ok=1&at=...&rt=...&u=BASE64(user)                    │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│  Browser: AuthContext detects sso_ok=1 on mount                                             │
│  - Extract at, rt, u from URLSearchParams                                                  │
│  - Decode user: JSON.parse(atob(u))                                                       │
│  - Store tokens in localStorage                                                             │
│  - Clear URL via replaceState (removes tokens from browser history)                       │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 11. Evidence Locker Flow

```
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│  Browser: EvidencePage.tsx                                                                   │
│  - Gather run, findings, waivers, risks, audit log                                         │
│  - Generate self-contained HTML string (no external dependencies)                         │
│  - Download as evidence.html (browser-side only, no server round-trip)                    │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│  POST /evidence (wafpass-server) - Optional "Lock on Server"                                │
│  - Server computes SHA-256(canonical_json(snapshot))                                       │
│  - Stores hash in evidence.hash_digest                                                     │
│  - Generates public_token (32-char URL-safe random)                                       │
│  - Returns: { id, hash_digest, public_token }                                             │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│  Dashboard: Display Evidence Locker UI                                                      │
│  - Show SHA-256 hash (copyable) for independent verification                              │
│  - Show public URL: /evidence/p/{token} (unauthenticated auditor access)                  │
│  - Generate QR code: /evidence/{id}/qr.svg (encodes public URL)                           │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│  Auditor: Scan QR Code with Phone                                                           │
│  - QR code encodes: /evidence/p/{token}                                                   │
│  - Opens in browser without login required                                                │
│  - Verified by checking hash_digest matches snapshot                                     │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 12. Findings Comments Collaboration Flow

```
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│  Frontend: FindingsPage.tsx                                                                  │
│  - User adds comment to finding                                                            │
│  - POST /findings/{id}/comments { message: "..." }                                        │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│  wafpass-server /findings-comments Router                                                    │
│  - auth/deps.py: get_current_user (verify JWT)                                            │
│  - Insert into findings_comments table:                                                    │
│    { finding_id, run_id, user_id, message, created_at }                                  │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│  PostgreSQL: findings_comments table                                                         │
│  - finding_id (UUID FK → run_findings)                                                    │
│  - run_id (UUID FK → runs)                                                                │
│  - user_id (UUID FK → users)                                                             │
│  - message (TEXT)                                                                         │
│  - created_at (TIMESTAMPTZ)                                                               │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│  Frontend: Real-time update                                                                 │
│  - Comment appears in UI immediately                                                       │
│  - Comment count badge updates                                                             │
│  - Other users see new comment (via re-render or polling)                                 │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Validation: Why This Works

### 1. Single Source of Truth

```
PostgreSQL (Database) is the authoritative source:

- All scan results → stored in runs table
- All user accounts → stored in users table
- All waivers/risks → stored in their respective tables
- All audit events → stored in compliance_audit_events table

The dashboard's localStorage is a CACHE, not the source of truth.
If localStorage is cleared, the dashboard re-fetches from the server.
```

### 2. Token Refresh Without Login

```
Flow: Access token expires → Use refresh token → Get new access token

Why this works:
1. Refresh tokens are stored hashed in DB (secure)
2. Each refresh has a "family_id" for stolen token detection
3. Dashboard can silently refresh before expiry
4. User stays logged in without re-entering credentials
5. If refresh fails → clear tokens → show login page
```

### 3. Deep Linking with Run Context

```
URL: #/findings?run=abc123def

Components that make this work:

1. parseHash() extracts page + runId from URL
2. selectedId state initialized from URL on mount
3. setSelectedId updates run + URL via replaceState (no history entry)
4. useEffect popstate handler restores state on back/forward
5. Run selector modal shows selected run's results

Result: User can bookmark, share, or navigate with run context preserved.
```

### 4. Role-Based Navigation

```
Sidebar Rendering Logic:

1. App.tsx reads user.role from AuthContext
2. Computes visibleSections = navSections.filter(s => hasMinRole(role, s.id))
3. hasMinRole('clevel', 'clevel') → true
4. hasMinRole('clevel', 'ciso') → false
5. hasMinRole('engineer', 'clevel') → true
6. hasMinRole('engineer', 'engineer') → true

Result: Users only see navigation items they have permission to access.
The server enforces the same checks via require_role().
```

### 5. Runtime Server URL Override

```
Priority chain for API base URL:

1. localStorage.wafpass_server_url (highest priority)
   Set via Settings → Connection & Real Engine
   Takes effect immediately (no reload needed)

2. VITE_API_URL (build-time)
   Set in .env.local for development
   Embedded in build at compile time

3. Empty string (same origin)
   Used in Docker Compose with nginx proxy
   Resolves to http://localhost:3000 (nginx) → wafpass-server:8000

Why this works:
- getApiBase() reads localStorage on every request
- No caching of base URL
- Settings UI updates localStorage → next API call uses new URL
```

### 6. Evidence Locker Integrity

```
Lock Process:
1. Dashboard sends snapshot to server
2. Server computes: SHA-256(JSON.stringify(snapshot, {sortKeys: true}))
3. Server stores hash_digest in evidence table
4. Server returns: { id, hash_digest, public_token }

Verification:
1. Auditor opens /evidence/p/{token}
2. Auditor downloads snapshot from /evidence/{id}/snapshot
3. Auditor computes SHA-256 of downloaded JSON
4. Auditor compares: computed_hash == stored_hash_digest

Result: Any modification to snapshot after locking is detectable.
The QR code provides easy access to the public verification URL.
```

### 7. TypeScript Type Safety End-to-End

```typescript
// api.ts defines exact API shapes:
export interface Finding {
  id: string
  check_id: string
  check_title: string
  control_id: string
  pillar: string
  severity: string
  status: string
  resource: string
  message: string
  remediation: string
  example?: Record<string, unknown> | null
  regulatory_mapping: { framework: string; controls: string[] }[]
  comment_count: number
}

// Server returns this shape, dashboard expects this shape
// TypeScript catches mismatches at compile time
```

### 8. Audit Trail Consistency

```
Two-tier audit system:

Dashboard-side (localStorage):
- Records: waiver created, risk accepted, scan received
- Purpose: Browser-local tracking for immediate feedback
- Limitation: Not shared across users

Server-side (compliance_audit_events table):
- Records: All waiver/risk/scan events
- Purpose: Team-wide audit trail
- Access: Via /audit/events with Bearer auth

Both systems work together:
1. Local events appear immediately in dashboard
2. Server syncs events for persistence
3. Audit log page shows merged view
```

---

## Architecture Diagrams

### Complete Request Lifecycle

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  HTTP Request (Browser → wafpass-dashboard)                                  │
│  e.g., GET /runs                                                             │
└───────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  Vite Dev Server (localhost:5173)                                            │
│  - Serves static assets (index.html, JS chunks)                             │
│  - Proxy configured in vite.config.ts:                                       │
│    '/runs' → target: 'http://localhost:8000'                                │
└───────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  wafpass-server (localhost:8000)                                             │
│  - FastAPI receives GET /runs                                                │
│  - CORS middleware checks origin                                             │
│  - HTTPBearer extracts Bearer token                                          │
│  - jwt_utils.decode_access_token() verifies signature                       │
│  - require_role() checks user role                                           │
│  - get_db() injects AsyncSession                                             │
│  - RunsRouter.list_runs() executes query                                    │
└───────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  PostgreSQL (runs table)                                                     │
│  - Query: SELECT * FROM runs ORDER BY created_at DESC LIMIT 50              │
│  - Returns: JSONB data (findings, pillar_scores, etc.)                      │
└───────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  Response Flow (Reverse)                                                     │
│  - Pydantic serializes RunPage model                                        │
│  - FastAPI returns JSON response                                             │
│  - Vite proxy forwards to browser                                           │
│  - API client parses response                                                │
│  - React state updates (useRunLoader)                                       │
└───────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  Browser UI Updates                                                          │
│  - RunsListPage re-renders with new runs                                    │
│  - RunSelectorModal updates available runs                                  │
│  - Header shows run count                                                    │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Docker Compose Architecture

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  Docker Network: wafpass_net                                                 │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────┐         ┌──────────────────┐        ┌───────────────┐ │
│  │   nginx:alpine   │◄────────┤ wafpass-server   │◄───────┤ PostgreSQL    │ │
│  │   (Port 3000)    │ HTTP    │   (Port 8000)    │   TCP   │   (Port 5432) │ │
│  │                  │ Requests│                  │  conn    │               │ │
│  │ - Serves dist/   │        │ - FastAPI app    │        │ - Data        │ │
│  │ - Proxies /runs  │        │ - JWT auth       │        │ - Runs        │ │
│  │   to server:8000 │        │ - PostgreSQL     │        │ - Users       │ │
│  │ - Proxies /auth  │        │   connections    │        │ - Waivers     │ │
│  │   to server:8000 │        │                  │        │ - Evidence    │ │
│  └──────────────────┘        └──────────────────┘        └───────────────┘ │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
                              ▲
                              │
                              │
                    ┌─────────┴─────────┐
                    │   Browser         │
                    │   (Port 3000)     │
                    └───────────────────┘
```

---

## Environment Configuration

### wafpass-server (.env.example)

```bash
# Database
DATABASE_URL=postgresql://postgres:password@postgres:5432/wafpass

# Environment
WAFPASS_ENV=local  # Change to "production" for enforced security

# JWT
WAFPASS_JWT_SECRET=your-secure-secret-key-here
WAFPASS_JWT_EXPIRE_MINUTES=15

# Encryption (required in non-local envs)
WAFPASS_ENCRYPTION_KEY=your-32-byte-base64-key

# Admin (seeded on first startup if empty)
WAFPASS_ADMIN_USERNAME=admin
WAFPASS_ADMIN_PASSWORD=secure-password
WAFPASS_ADMIN_ROLE=admin

# CORS (comma-separated list)
WAFPASS_CORS_ORIGINS=http://localhost:3000

# SSO (optional)
WAFPASS_OIDC_DISCOVERY_URL=https://accounts.google.com/.well-known/openid-configuration
WAFPASS_OIDC_CLIENT_ID=your-client-id
WAFPASS_OIDC_CLIENT_SECRET=your-client-secret

# Ports
WAFPASS_SERVER_PORT=8000
```

### wafpass-dashboard (.env.local)

```bash
# API Server URL
VITE_API_URL=http://localhost:8000

# Runtime override (stored in localStorage):
# Settings → Connection & Real Engine → "Backend Server URL"
# Takes precedence over VITE_API_URL
```

---

## Technical Stack Summary

| Layer | Technology | Version |
|-------|------------|---------|
| **CLI Engine** | wafpass-core | Rust + HCL parsing |
| **API Server** | FastAPI | Python 3.11+ |
| **Database** | PostgreSQL | 15+ with JSONB |
| **Authentication** | PyJWT | HS256 + Refresh tokens |
| **Migrations** | Alembic | Async-compatible |
| **Dashboard** | React | 18.2 |
| **Type System** | TypeScript | 5.3 |
| **Build Tool** | Vite | 5.1 |
| **Charts** | Recharts | 2.12 |
| **Maps** | Leaflet | 1.9.4 + react-leaflet 4.2.1 |
| **Graphs** | D3.js | Force-directed, dependency graphs |
| **Server (Production)** | nginx | alpine |

---

## Key Design Principles

### 1. Separation of Concerns

```
wafpass-core:  Scanning engine (no state)
wafpass-server: Stateful API layer
wafpass-dashboard: Stateless UI layer
```

### 2. Security by Default

- JWT tokens with short expiry (15 min)
- Refresh token rotation with family tracking
- Password hashing with bcrypt
- SSO verification via JWKS signature checking
- Encrypted secrets at rest (local Fernet or AWS KMS)
- CORS configured explicitly (not wildcard)
- Role-based access at both API and UI layers

### 3. Offline-First with Server Sync

- Dashboard stores data in localStorage
- Fetches from server on mount
- Server is source of truth (localStorage is cache)
- If server unreachable, stale data served from cache

### 4. Type Safety End-to-End

- TypeScript interfaces in api.ts match Pydantic models in server
- Compiler catches mismatches before runtime
- No `any` types in critical paths

### 5. Deep Linking Support

- Hash-based routing (works without server config)
- Run ID in query string (`?run=abc123`)
- Browser back/forward works correctly
- Bookmarks and shared URLs work identically

### 6. Zero Configuration for Docker

- Default `VITE_API_URL=""` → same-origin
- nginx proxies `/runs` → `wafpass-server:8000`
- No cross-origin issues in containerized setup

### 7. Audit Trail

- Server-side: `compliance_audit_events` table
- Client-side: `localStorage` audit log (max 2000 entries)
- Findings comments with user attribution
- API key usage logging

---

## Conclusion: Why This Architecture Works

1. **No Single Point of Failure**
   - Server can be horizontally scaled
   - Database has HA options (replication, failover)
   - Dashboard is static files (CDN-friendly)

2. **Clear Ownership Boundaries**
   - wafpass-core: Produces scan results
   - wafpass-server: Stores + exposes via API
   - wafpass-dashboard: Visualizes + interacts

3. **Scalable Data Flow**
   - PostgreSQL handles 10k+ runs efficiently
   - JSONB columns allow flexible schema evolution
   - Read replicas can handle dashboard traffic

4. **Secure Authentication**
   - JWT + refresh token pattern
   - SSO support via OIDC/SAML2
   - API keys for machine-to-machine

5. **Type-Safe End-to-End**
   - TypeScript interfaces match server models
   - Compiler enforces correctness
   - No runtime type errors in production

6. **Production-Ready**
   - Docker Compose works out of the box
   - nginx handles TLS termination
   - Logging and monitoring hooks included

7. **Developer Experience**
   - Hot reload with Vite dev server
   - Automatic API proxying
   - Clear error messages from both layers

---

*This reference architecture document was generated for WAF++ PASS v1.0.0*
