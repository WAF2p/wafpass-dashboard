# Design audit — WOMBATpass dashboard

Living audit of theme/design maturity across every routed page.
Source of truth for the standard: [`DESIGN.md`](./DESIGN.md).
Scope: pages under `src/pages` plus shared chrome in `src/components`.

**Last full audit:** 2026-11-04 · **Method:** static metrics per file (inline
styles, hardcoded hex, gradients/shadows, sub-11px text, i18n adoption,
tables, states, a11y) plus spot reads; not a screenshot review of every page.

---

## Maturity model

| Level | Meaning |
|---|---|
| **L1** | Ad hoc — inline styles, hardcoded hex, no tokens |
| **L2** | Tokenized — uses CSS vars, but page-local one-off patterns |
| **L3** | Consistent — tokens + module primitives, states covered |
| **L4** | Systematized — global primitives, rules enforced, both themes |
| **L5** | Governed — automated checks + visual regression in CI |

**Overall: L4.8 — governed, with chart-colour debt** (was L2.5 at the initial audit).

| Dimension | Score | Evidence |
|---|---|---|
| Token & colour system | 4/5 | Strong tokens; 70-entry legacy palette still in code |
| Typography | 2/5 | 167 instances below the 11px floor |
| Layout & responsive | 2/5 | 68 fixed pixel widths; 59% of pages have no `<h1>` |
| Component consistency | 1.5/5 | No global primitives (now addressed in Phase 0); 0 pages used `.data-table` |
| States | 2/5 | Only 2 pages had skeletons; 4 `window.alert/confirm` |
| Accessibility | 2/5 | 19 icon-only buttons without accessible names; 2 modals without dialog semantics |
| Motion & depth | 3/5 | 67× `transition: all`; residual lifts/glows |
| i18n & content | 3/5 | 190 hardcoded strings; 6 pages bypass i18n |
| Documentation | 4.5/5 | DESIGN.md is specific; code contradicted it (radius/cards) |

---

## Findings (by leverage)

1. **No component layer** — no shared PageHeader/Card/DataTable/EmptyState/Skeleton/Button/Modal. *Addressed in Phase 0.*
2. **Token drift** — `EvidencePage` 231 hex, `ControlsCatalogue` 161, `ReferenceArchitecture` 98, `AntiPatternMuseum` 109; 6 pages redeclare severity/pillar maps.
3. **Legibility floor** — 167 sub-11px styles; worst: ControlsCatalogue 19, PdfReport 13, UserManagement 12, ExploitPaths 11, ApiManagement 10, Settings 9.
4. **Layout system** — no `max-width` despite the documented 1680px (*fixed Phase 0*); 68 fixed widths 300–900px; only 41% of pages had an `<h1>`.
5. **Tables** — `.data-table` used by zero pages; every list reimplements density, hover, empty state.
6. **States** — only 2 pages with skeletons; mixed spinners; 4 blocking browser dialogs.
7. **Accessibility** — 19 unlabeled icon buttons; `FindingsPage` and `RunSelectorModal` lack `role="dialog"`; no global focus ring before the theme pass.
8. **Motion** — 67 `transition: all`; hover lifts and glows remain in PassportDashboard, ExploitPaths, RemediationSprint.
9. **i18n** — 190 literal strings; Evidence, ControlsCatalogue, AutoFix, ComplianceReadiness, Sandbox, Legal do not import `useI18n`.
10. **Doc ↔ code drift** — radius scale and card elevation disagreed with DESIGN.md. *Reconciled in Phase 0.*

---

## Definition of done (per page)

A page is "mature" when all of these hold:

- [ ] One `<h1>` via `ui/PageHeader`; sections use `ui/Card`
- [ ] No hardcoded hex, palette maps, gradients or coloured glows
- [ ] All functional text ≥11px, body ≥12px
- [ ] Lists use `ui/DataTable`; loading uses `ui/Skeleton`; empty uses `ui/EmptyState`
- [ ] No `window.alert/confirm/prompt`
- [ ] Every icon-only control has an accessible name; dialogs use `ui/Modal`
- [ ] No `transition: all`; motion only on `transform`/`opacity`/colour
- [ ] User-facing strings through `useI18n`
- [ ] Verified in light **and** dark mode, at 1440px and 390px

---

## Phase plan

| Phase | Scope | Status |
|---|---|---|
| **0 — Foundation** | `src/ui/*` primitives, max-width, doc reconciliation, design lint | **Done (2026-11-04)** |
| **1 — Legacy heavy** | 9 highest-debt pages | **Done (2026-11-04)** |
| **2 — Data surfaces** | all data/list pages (batches 1 + 2b) | **Done (2026-11-04)** |
| **3 — A11y & i18n** | page headings, labels, dialog semantics, six non-i18n pages, motion/typography sweep | **Done (2026-11-04)** |
| **4 — Polish** | hex triage, scrims, light/dark visual QA, CI gate | **Done (2026-11-04)** |

### Phase 1 — results

Nine pages migrated under one contract (tokens, legibility floor, explicit
transitions, inline errors instead of browser dialogs, labelled icon buttons,
dark-mode-safe surfaces). No logic, API, export or i18n changes.

| Metric (all files) | Before | After |
|---|---:|---:|
| Hardcoded hex colours | 1848 | **1351** |
| Font sizes below 11px | 167 | **101** |
| `transition: all` | 66 | **51** |
| `window.alert/confirm` | 4 | **3** |
| Unlabelled icon buttons | 19 | **7** |
| Pages without an `<h1>` | 38 | **37** |

Verified: `tsc` + Vite build pass; **117 tests across 13 files pass**.

**Documented exceptions (intentionally left):**
- `EvidencePage` — 188 hex remain inside the standalone, downloadable HTML report. It renders outside the SPA, so `var(--token)` cannot resolve; the live UI is tokenized.
- `ExploitPathsPage` — 41 hex in the zone/cloud-provider illustration palettes and the dark attack-graph canvas.
- `SettingsPage` — `MATURITY_META` colours come from `settingsUtils.ts` and are concatenated with alpha (`${meta.color}20`), so they remain hex.
- `ControlsCataloguePage` — ~30 literals for dark code blocks, syntax highlighting and white-on-brand text; no matching tokens exist.
- `RemediationSprintPage` — 2 hex in the always-dark impact-projection gradient.

### Phase 1 — page ledger

- [x] `ControlsCataloguePage` — hex 161→~30 (exceptions), sub-11px 19→0, `transition: all` 5→0, 3 native dialogs→inline confirm/alert, 4 aria-labels, dark-mode backgrounds fixed
- [x] `EvidencePage` — live UI tokenized; `--card` undefined token fixed→`--surface`; score colours→`src/severity.ts`; 5 aria-labels; hex 218→188 (printable report exception)
- [x] `ReferenceArchitecturePage` — hex 98→0; `PageHeader` adopted
- [x] `AntiPatternMuseumPage` — hex 109→0; `PageHeader` adopted
- [x] `UserManagementPage` — hex 60→16 (role identity palette), sub-11px 12→0, 3 dialogs→inline, accent stripe→dot, tests updated for inline confirm
- [x] `ExploitPathsPage` — status/severity→tokens, invalid `${var}22` alpha concatenations→`color-mix`, sub-11px 11→0, accent bars→tinted borders
- [x] `RemediationSprintPage` — hex 42→2, sub-11px 4→0, `alert`→inline status, 6 labels
- [x] `ApiManagementPage` — hex 27→0, sub-11px 10→0, `confirm/alert`→inline two-step, duplicate `scoreColor` removed
- [x] `SettingsPage` — hex 21→9, sub-11px 9→0, `PageHeader` adopted, save/status colours tokenized

### Phase 0 — completed

- [x] `src/ui/PageHeader.tsx` — single `<h1>` pattern
- [x] `src/ui/Card.tsx` — padded panel with title/subtitle/actions
- [x] `src/ui/DataTable.tsx` — columns, skeleton rows, empty state, scroll
- [x] `src/ui/EmptyState.tsx`
- [x] `src/ui/Skeleton.tsx` — `Skeleton`, `SkeletonText`, `SkeletonRows`
- [x] `src/ui/Button.tsx` — variants + `buttonClass` for links
- [x] `src/ui/Modal.tsx` — dialog semantics, focus trap, Escape, scroll lock
- [x] `.ui-*` styles in `src/index.css`
- [x] `max-width: 1680px` on `main`
- [x] DESIGN.md radius/elevation reconciled; primitives documented
- [x] `npm run design:lint` (dependency-free rule checker)
- [x] Pilot adoption: `SkippedControlsPage` (DataTable/Card/EmptyState), `ValidationCenterPage` (PageHeader/tabs/button)

### Phase 2 — results (batch 1, 12 pages)

Focus: consistent loading, empty and table states via `src/ui` primitives.
No data-fetching, API, state-logic or route changes.

| Metric (all files) | After Phase 1 | After Phase 2 |
|---|---:|---:|
| Hardcoded hex colours | 1351 | **1350** |
| Font sizes below 11px | 101 | **95** |
| `transition: all` | 51 | **38** |
| `window.alert/confirm` | 3 | **3** |
| Unlabelled icon buttons | 7 | **7** |
| Pages without an `<h1>` | 37 | **37** |

`DataTable` adopters: 4 pages (`SkippedControls`, `AuditLog`, `AdminLog`, `Changes`).
Verified: `tsc` + Vite build pass; **117 tests / 13 files pass**.

### Phase 2 — page ledger

- [x] `FindingsPage` — empty states for the findings table and comment thread; 2 icon buttons labelled. Table left raw (selection + bulk actions).
- [x] `RunsListPage` — four empty states (no runs, need two scans, filtered, project view); `transition: all` removed. Table left raw (bookmark action).
- [x] `ChangesPage` — plan table → `DataTable` with row-click; drift skeleton rows; four empty states; modal close labelled. Attribute-diff table left (per-cell tinting).
- [x] `ValidationsPage` — registry skeleton rows, selector/detail skeletons, three empty states, close labelled. Table left (per-row View).
- [x] `AuditLogPage` — first-seen table → `DataTable` (7 columns preserved); empty states; explicit transitions.
- [x] `AdminLogPage` — raw details table → `DataTable` (5 columns, `loading`); timeline skeleton; empty states; explicit transitions.
- [x] `ControlsPage` — empty states for the grid and three detail tabs; close button labelled; sub-11px fixed.
- [x] `ControlsPacksPage` — skeleton rows for pack history, framework references and active pack; empty state; 5 transitions fixed.
- [x] `WaiversPage` — card-shaped skeletons; `EmptyState` reusing existing keys.
- [x] `RiskAcceptancePage` — card-shaped skeletons; `EmptyState`.
- [x] `GroupMappingsPage` — page-shaped skeleton; `EmptyState`; sub-11px fixed.
- [x] `NotificationsPage` — card skeletons; `EmptyState` per filter; transitions and timestamp text fixed.

**Completed in Phase 2b (see next section).**

### Phase 2b — results (25 pages)

Focus: tokens, legibility, motion and states on the remaining data pages; plus
removal of every remaining native browser dialog.

| Metric (all files) | After Phase 2 batch 1 | After Phase 2b |
|---|---:|---:|
| Hardcoded hex colours | 1350 | **872** |
| Font sizes below 11px | 95 | **51** |
| `transition: all` | 38 | **22** |
| `window.alert/confirm/prompt` | 3 | **0** |
| Unlabelled icon buttons | 7 | **4** |
| Pages without an `<h1>` | 37 | **35** |

Verified: `tsc` + Vite build pass; **117 tests / 13 files pass**.

### Phase 2b — page ledger

- [x] `PassportDashboardPage` — hex 50→23, 11 icon buttons labelled, skeleton grid, 2 empty states, decorative shadows/lifts removed. **Theme v2 (credential document):** flat 14px cards, rubber-stamp circles replaced by flat stamp chips, always-dark MRZ band tokenised to `--input-bg`, row accent bar removed, flat dialogs and buttons
- [x] `DashboardPage` — 7 sub-11px fixed; card/masthead/gauge/tile shadows, hover lifts and glow washes removed
- [x] `ProjectOverviewPage` — `PageHeader` (first `<h1>`), four empty states, 8 sub-11px fixed
- [x] `ModuleScorePage` — hex 30→1, local palettes→tokens, 5 empty states
- [x] `FrameworkDetailPage` — empty states, undefined `var(--card)` fixed, gradients/glow removed; test 6/6
- [x] `CostImpactPage` — resources table→`DataTable`, `PageHeader`, 16 shadows and 3 gradients removed
- [x] `GapAnalysisPage` — hex 26→1, `PageHeader`, accent bar→tinted border, 14 rgba removed
- [x] `CompliancePage` — `PageHeader`, 17 shadows and hero gradients removed; data-bar glows kept as chart illustration
- [x] `ComplianceReadinessPage` — hex 40→0, `Card` adopted, skeletons + 4 empty states; test loading string preserved (4/4)
- [x] `SsoSettingsPage` — hex 23→4, form skeletons, inline remove confirmations
- [x] `SyslogConfigModal` — custom modal→`ui/Modal` (focus trap, Escape, scroll lock)
- [x] `AutoFixPage` — hex 35→10, `PageHeader`, 3 empty states, preview skeleton
- [x] `RunScanPage` — hex 22→2, `PageHeader`, status skeleton, gradient/glow removed
- [x] `ShipRunPage` — hex 22→0, `PageHeader`, runs skeleton + empty state
- [x] `RunDiffPage` — hex 35→0, 4 empty states, duplicate pillar palette removed
- [x] `DriftDetectionPage` — hex 42→0, **35 undefined `var(--text-muted)` fixed**, 7 sub-11px, 5 empty states
- [x] `DependencyGraphPage` — hex 21→0, invalid `${var}NN`→`color-mix`, empty state
- [x] `SandboxPage` — hex 18→2, skeleton + empty state, palettes tokenized
- [x] `ProjectGroupsPage` — 2 dialogs→inline confirm, hex 17→0, skeletons + 3 empty states
- [x] `BadgePage` — hex 18→9 (tier/code/SVG exceptions), skeleton + 2 empty states, real links styled
- [x] `SecretScanPage` — hex 49→1, invalid alpha concatenations fixed, 2 empty states, accent stripes removed
- [x] `BlastRadiusPage` — hex 5→0, inline empty state, shadow ring removed
- [x] `AccessRolesPage` — hex 25→0, identity palettes→tokens, dark-mode icon chips fixed
- [x] `LeaderboardPage` — tail table→`DataTable`, `PageHeader`, podium skeleton + 2 empty states
- [x] `FeedbackPage` — hex 26→0, input background now theme-aware, button glow removed
- [x] **Dialog cleanup** — 11 native dialogs removed across Passport, SSO, Validations, Mandate Management, Findings and Cost Impact (inline confirmations / `role="status"` / `role="alert"`)

### Phase 3 — results

| Metric | Before | After |
|---|---:|---:|
| Unlabelled icon buttons | 4 | **0** |
| Routed pages without an `<h1>` | 35 | **0** (3 embedded/modals allow-listed) |
| `transition: all` | 22 | **0** |
| Font sizes below 11px | 51 | **0** |
| Pages bypassing i18n | 6 | **0** |
| `design:lint` findings | 997 | **885** (hex only) |

**Accessibility**
- Every routed page now exposes exactly one heading. `NotificationsPage` uses `PageHeader`; the rest use sr-only `<h1>` with `PAGE_TITLE` or existing i18n keys. `AdminLogPage`, `SkippedControlsPage` and `SyslogConfigModal` are allow-listed as embedded views/modals.
- `RunSelectorModal`, `MandateEditModal` and `UserPreferencesModal` now have `role="dialog"`, `aria-modal`, labelled close buttons and a shared `useDialog` hook (focus entry, Tab trap, Escape, scroll lock, focus restore).
- All icon-only buttons have accessible names; the lint's icon-only rule now understands dynamic `{t(...)}` text.

**i18n**
- Six pages moved to `useI18n`: Evidence (76 strings), Legal (7), Controls Catalogue (209), Auto-Fix (69), Compliance Readiness (35), Sandbox (35) — **431 strings**.
- They live in isolated `pages.phase3.*` modules (`src/i18n/locales/phase3/`), merged into the English base, so every other locale falls back to English instead of showing keys.
- Deliberately left as content/data: generated HTML reports, code/YAML/HCL samples, legal prose, identifiers, server messages.
- Runtime smoke test on all six routes: no `pages.phase3.*` key leakage.

**Motion & typography**
- All 22 `transition: all` replaced with explicit properties; all 51 sub-11px sizes raised to ≥0.7rem (including PdfReport).
- Tests: 117/117 pass; `tsc`/Vite build clean.

### Phase 4 — results

| Measure | Before | After |
|---|---:|---:|
| Hardcoded hex (lint) | 885 | **317** |
| Documented hex exemptions | 0 | **284** (Evidence printable report 188, PdfReport 96) |
| Non-hex lint findings | 0 | **0** |
| Light/dark screenshots reviewed | — | **28** |

**Hex triage.** Semantic status colours were mapped to tokens, not just suppressed:
Changes 58→7, RunsList 48→15, GroupMappings 34→0, Findings 27→0, Risk Acceptance 26→0, Waivers 23→2, Controls 21→2, Validations 20→2, Controls Packs 17→0, Onboarding 26→1, Welcome Checklist 13→0. Alpha concatenations (`${var}22`) were replaced with `color-mix`. Remaining literals are documented exceptions: chart/identity palettes, always-dark code blocks, white-on-filled-button text, print output.

**Scrims.** Added `--scrim` (fixed dark in both themes). Replaced overlays that had been derived from `var(--text)` and incorrectly rendered light in dark mode.

**Visual QA.** Captured 14 routes in both themes (28 screenshots) via headless Chrome. Fixed a real regression found in review: the passport card's old banner CSS still absolutely positioned the seal and maturity chip, floating them over the metadata/MRZ. Both now use explicit static overrides.

**CI.** Added `.github/workflows/design.yml`: `npm ci` → `npm run design:lint -- --gate` → build → tests. The gate fails on accessibility/motion/dialog rules; hex stays advisory with inline `design-lint-disable` exemptions for generated/print output.

### Phase 4b — design system, translations, visual regression

**Design System 2.0 primitives.** Added `ui/Input`, `Select`, `Tabs`, `Toolbar`, `StatTile`, `ChartFrame` (+ chart palette/axis/tooltip/grid constants) with `.ui-*` styles and DESIGN.md entries.

**Adoption.** 4 static tables moved to `DataTable` (API key usage log, revoked keys, user audit trail, journey recent scans); 6 pages moved to `PageHeader` (About, Audit Log, Beta Features, My Dashboard, Regions, Validations). Complex tables (selection, expandable rows, per-row actions, diff-cell tinting, heatmaps) were deliberately left and documented. `Tabs` adopted in Validation Center, `Toolbar` in Regions.

**Translations.** All 431 Phase 3 keys translated into `de`, `fr`, `es`, `pt`, `br`, `el` (`src/i18n/locales/phase3/<lang>.ts`), merged per locale over the English base. Placeholder parity verified; brand names and code samples left untranslated.

**Visual regression.** `scripts/visual-regression.mjs` (pixelmatch + pngjs) captures 6 routes × 2 themes, waits for content to settle and for two identical frames, and compares against `visual-baselines/`. Commands: `npm run visual:baseline` / `npm run visual:check`. Diffs land in `.visual/diffs/` (gitignored).

**Secrets.** Root `.env` was migrated from `WAFPASS_*` to `WOMBAT_*` for every compose-consumed setting; JWT, API and internal signing secrets rotated. `.env.example` documents the internal key and sub-CA path.

### Phase 4c — full adoption, quality gates, remaining i18n

**Tables.** `DataTable` gained selection (`selectable`, `selectedKeys`, `onSelectionChange`), expansion (`renderExpanded`, `expandedKeys`), `rowClassName` and an actions column. Migrated the four complex tables: Findings (selection + detail row), Runs (bookmark + row click), User Management (expandable + per-row actions), Project Overview (row action). Remaining raw tables are diff/heatmap/code-report surfaces that need bespoke cells.

**Headers.** Five more pages adopted `PageHeader` (Architecture / Engineering / Maturity / Pipeline Operations Centers, Skipped Controls). Pages without a visible title keep their sr-only `<h1>`.

**Primitives adopted.** `Input`/`Select` in Settings, SSO Settings and User Preferences; `StatTile` on Compliance Readiness; `Toolbar` in Controls Packs; `Tabs` in Validation Center. `ChartFrame` and its palette remain available for chart migration.

**i18n.** Extracted a further **699 UI strings** into `pages.phase3.restA` / `restB` across 35 pages. Remaining English is content by design: code/YAML/HCL samples, generated HTML reports, legal prose, diagram labels, data values. `xx_TEMPLATE.ts` now includes every Phase 3 namespace (≈1,000 keys). The `t()` resolver now supports both nested and flat dotted keys (fixes the Evidence namespace).

**Quality gates.**
- `npm run a11y:check` — axe-core via CDP, WCAG 2.1 A/AA, 14 routes × light/dark. **0 serious/critical violations.**
- `npm run visual:check` — pixel diff at **1440/900/390** widths × light/dark, **36 baselines** committed; passes.
- `.github/workflows/quality.yml` — manual workflow against a reachable deployment, installs Chrome, runs axe + visual checks and uploads reports.
- `.github/workflows/design.yml` — install, design gate, build, tests on push/PR.

---

## Per-page checklist

### Cluster A — Operations Centers (reference quality, L4)

- [x] `GlobalDashboardPage` — L4 — theme pass done; airport media panel, flat cards. Remaining: 7 sub-11px labels, 77 inline styles.
- [ ] `ArchitectureOperationsCenter` — L4 — adopt `PageHeader`; no other debt.
- [ ] `MaturityOperationsCenter` — L4 — adopt `PageHeader`.
- [ ] `PipelineOperationsCenter` — L4 — adopt `PageHeader`; 1 hex colour.
- [ ] `EngineeringOperationsCenter` — L4 — adopt `PageHeader`.
- [ ] `MyDashboardPage` — L3 — widget board is token-only; add page header + empty state.

### Cluster B — Legacy heavy (Phase 1 — done, see ledger above)

- [x] `ControlsCataloguePage` — L2.5 (was L1.5)
- [x] `EvidencePage` — L2.5 (live UI); printable report is a documented exception
- [x] `ReferenceArchitecturePage` — L3
- [x] `AntiPatternMuseumPage` — L3
- [x] `UserManagementPage` — L3
- [x] `ExploitPathsPage` — L2.5 (illustration palette remains)
- [x] `RemediationSprintPage` — L3
- [x] `ApiManagementPage` — L3
- [x] `SettingsPage` — L3

### Cluster C — Data surfaces & lists (Phase 2 — done)

All data/list modules are migrated: batch 1 introduced shared loading/empty/table states on 12 pages; batch 2b covered tokens, legibility, motion and states on the remaining 25. See the Phase 2 and Phase 2b ledgers above for per-page detail.

### Cluster D — Admin & forms (L2.5, Phase 2–3)

- [ ] `SsoSettingsPage` — 23 hex, 7 fields with sub-11px labels
- [ ] `ApiManagementPage` — see Cluster B
- [ ] `UserPreferencesPage` — 6 sub-11px labels
- [ ] `MandateEditModal`, `UserPreferencesModal` — adopt `ui/Modal`

### Cluster E — Static & auth (L3, Phase 4)

- [ ] `LoginPage` — 4 hex; verify focus states
- [ ] `AboutPage` — clean; add `PageHeader`
- [ ] `LegalPage` — 1 hex; no i18n
- [ ] `BetaFeaturesPage` — token-only; adopt `PageHeader` + `Card`
- [ ] `ValidationCenterPage` — **Phase 0 pilot done**; remaining: teaser banner hardcoded amber
- [ ] `FeedbackPage` — 28 hex
- [ ] `RegionsPage` — 6 hex, 3 `transition: all`

### Shared chrome

- [x] `TopNavigation` — flat nav, no glow, labelled icon buttons partly fixed
- [x] `Footer` — rebuilt; dark band, grouped links, partner mark
- [ ] `MobileMenu` — one icon-only button without a label
- [ ] `NotificationBell` — adopt `ui/Modal` where applicable
- [ ] `OnboardingTour` — 28 hex, 45 inline
- [ ] `PdfReport` — 13 sub-11px (print-specific; document an exception or fix)
- [ ] `RunSelectorModal` — custom modal → `ui/Modal`
- [ ] `Sidebar` — legacy, unused? confirm and remove if dead

---

## Commands

The lint report is the authoritative live count; the figures in this document were captured in the initial audit and can differ by a few counts where the regexes differ.

```bash
npm run design:lint          # advisory report
npm run design:lint -- --strict   # exit 1 on any violation (CI gate)
npm run build                # tsc + vite
```
