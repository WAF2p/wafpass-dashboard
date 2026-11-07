# Implementation Plan — Complete the dashboard translations

**Derived from:** `TASK-I18N-TRANSLATIONS.md`
**Verified:** 2026-11-06 against the working tree in `wafpass-dashboard`
**Status:** Waves 0–5 complete (2026-11-06) · all locales fully translated, `i18n:check --strict` passes · only human native review remains

This plan keeps the task file's goal and rules, corrects three verified inaccuracies, and adds the
prerequisites that block the work as written.

---

## 0. Verified baseline

Measured on 2026-11-06, not copied from the task file:

| Check | Result |
|---|---|
| `npm run i18n:check` | 2828 static keys · 0 missing · Phase 3 parity 431/431 × 6 ✅ |
| `npx tsc --noEmit` | exit 0 ✅ |
| `npx vitest run` | 117/117 passing (13 files) ✅ |
| `restA` / `restB` | 260 / 439 keys = **699**, 0 translated in all 6 locales |
| Template `xx_TEMPLATE.ts` | 2635 keys — includes 1018 Phase 3 keys but **misses 784 base + 112 Phase 3 keys** (1 restA, 111 restB → 896 total) |
| Working tree | dirty before we start: `package.json`, `package-lock.json`, `src/i18n/locales/en.ts`, `src/i18n/types.ts`, `src/components/WelcomeChecklist.tsx`; untracked `scripts/i18n-check.mjs`, `TASK-I18N-TRANSLATIONS.md` |

Base-app gaps (key presence):

| Locale | Missing | Largest gaps |
|---|---:|---|
| de | 492 | pages 336 · onboarding 52 · welcome 35 · about 29 · frameworkDetail 23 |
| fr | 832 | pages 637 (myDashboard 144, betaFeatures 87) · onboarding 52 · nav 47 |
| es | 818 | pages 628 · onboarding 52 · nav 44 |
| pt | 821 | pages 629 · onboarding 52 · nav 44 |
| br | 833 | pages 641 · onboarding 52 · nav 44 |
| el | 834 | pages 642 · onboarding 52 · nav 44 |

**Three corrections to the task file**

1. **The completion metric is key-presence only.** There are already **737 keys present but still holding English values** (de 136, fr 149, es 101, pt 120, br 119, el 112) and **43 keys whose `{{placeholders}}` are broken** — see §1.3. `--strict` would pass while both remain. The plan adds a value audit.
2. **`LANGUAGE.md` claims 100 % coverage for all six locales.** The real numbers are above. Update it at the end (§5).
3. **The template is not a complete English copy.** If new languages are meant to start from it, it needs the 896 missing keys; otherwise say so explicitly in `LANGUAGE.md` (§5, optional).

---

## 1. Blocking prerequisites — do before any translation

### 1.1 Widen the per-locale type (hard blocker)

Every Phase 3 locale file starts with:

```ts
import type phase3En from './en'
const copy: typeof phase3En = { evidence: {…}, legal: {…}, … }
```

`phase3/en.ts` exports only the six namespaces, so adding `restA`/`restB` to that object literal is an
**excess-property error (TS2353)** — the task file's "required shape" as written will not compile.

**Recommended fix** — leave `phase3/en.ts` untouched, add two imports and an intersection with optional
rest namespaces in each of the six locale files:

```ts
import type phase3En from './en'
import type restAEn from './restA'
import type restBEn from './restB'

const copy: typeof phase3En & {
  restA?: typeof restAEn
  restB?: typeof restBEn
} = { evidence: {…}, …, restA: {…}, restB: {…} }
```

Optional keeps the files valid while partial. The checker (not the compiler) enforces key coverage,
because `restA`/`restB` are typed as `Record<string, Record<string, string>>`.

Alternative (not recommended): add `restA`/`restB` to `phase3/en.ts`; then they become *required* in
every locale unless the annotation becomes `DeepPartial<typeof phase3En>`, which also weakens the
compiler guarantees for the existing six namespaces.

### 1.2 Fix a false failure in `scripts/i18n-check.mjs`

Line 112 computes locale parity from **all** flattened Phase 3 keys, while `expected` only covers the
six namespaces (line 111). The moment a translator adds `restA.*` or `restB.*`, those keys are counted
as `extra` and `npm run i18n:check` FAILs — contradicting the task's verification step.

Patch: build the parity set from the six namespaces only.

```js
const actualP3 = new Set(
  [...localeP3[lang]].filter(k => P3_NAMESPACES.some(ns => k.startsWith(`${ns}.`)))
)
const absent = [...expected].filter(key => !actualP3.has(key))
const extra  = [...actualP3].filter(key => !expected.has(key))
```

Coverage math (lines 131–135) already counts `restA`/`restB` correctly and needs no change.

### 1.3 Add value-level audits to the checker

Extend `scripts/i18n-check.mjs` with three checks, then wire them into `--strict`:

| Check | Rule | Gate |
|---|---|---|
| Placeholder parity | Multiset of `{{x}}` in translation === English (order irrelevant) | **hard** |
| Empty value | `''`, `null`, `undefined` in a present key | **hard** |
| English-identical | value byte-equal to English and contains ≥2 letters | **report** — proper nouns and code samples are legitimate |

Also add `--list-english <lang>` (mirrors `--list-missing`), so the repair pass can enumerate them.

**43 placeholder bugs exist today** and should be fixed in the repair pass, not by loosening the gate:

- **de (16)** — all use `{{n}}` instead of `{{s}}`: `pages.changes.driftSummaryRegressed`,
  `driftSummaryRecovered`, `resourcesUpToDate`, `runsLabel`, `pages.driftDetection.regressionSummary`,
  `recoveredSummary`, `stateDriftSummary`, `runsLabel`, `pages.exploitPaths.failingChecks`,
  `chainFindings`, `chainCount`, `pages.projectOverview.milestonesRecorded`, `pages.audit.tabEvents`,
  `tabExposure`, `pages.gapanalysis.requirementsMet`, `pages.controlspacks.pack`
- **fr (6)**, **es (9)**, **pt (4)**, **br (4)**, **el (4)** — same four recurring keys plus
  `pages.changes.resourceChanges`, `pages.projectOverview.branches`,
  `pages.exploitPaths.chainFindings`/`chainCount`

At runtime `{{n}}` is not substituted (the call sites pass `s` and `count`), so these are **visible
bugs**: German users currently see `5 Kontrolle{{n}}`.

### 1.4 Translation glossary (per locale, before mass translation)

Six agents translating ~9 500 strings will drift without one. Create `i18n-GLOSSARY.md` at the repo
root with a column per locale for:

> mandate · control · finding · waiver · remediation · run · scan · passport · compliance readiness ·
> gate/gating · attestation · evidence · drift · blast radius · severity (critical/high/medium/low)

Seed each column by mining the existing translated files (the terms already appear hundreds of
times), then have the native reviewer confirm. Every agent prompt references this file.

### 1.5 Plural constraint — decide once, document it

13 English strings use a suffix placeholder, e.g. `'{{count}} control{{s}}'`; call sites pass
`s: n !== 1 ? 's' : ''`. Rules forbid editing components, so **every translation must keep `{{s}}`**.

- French/Spanish/Portuguese/Brazilian: `{{count}} contrôle{{s}}` works naturally.
- **Greek does not inflect this way** (`έλεγχος` → `έλεγχοι`). Rewrite those strings into
  suffix-free phrasing, e.g. `Πλήθος ελέγχων: {{count}}`, keeping `{{count}}` and either `{{s}}`
  unused or the sentence restructured so the suffix is harmless. Document the choice in the glossary.

---

## 2. Work breakdown

| Batch | Scope | Strings | Parallelism |
|---|---|---:|---|
| **B1** | `restA` (260) + `restB` (439) into six `phase3/<lang>.ts` | 4 194 | 6 agents, one locale each |
| **B2** | Base gaps in six `locales/<lang>.ts` | 4 630 | 6 agents, one locale each; split the two largest |
| **B3** | Repair pass: 43 placeholder bugs + triage 737 English-valued keys | ~780 | 2–3 agents, one locale group each |
| **B4** | Docs + template sync (optional) | — | 1 agent |

Suggested waves (each wave ends green):

1. **Wave 0** — §1.1–1.4 tooling, types, glossary; commit-free, verify `i18n:check` still passes.
2. **Wave 1** — B1 for de/fr/es; **Wave 2** — B1 for pt/br/el. (Or one agent per locale concurrently;
   the files are disjoint, so contention is zero. Two waves keeps review load sane.)
3. **Wave 3** — B2, split per locale into **B2a shared sections** (`onboarding` 52, `welcome` 35,
   `about` 29, `frameworkDetail` 23, plus `nav`/`common`/`prefs`) and **B2b `pages.*`**. For fr and
   de, B2b is itself large (`myDashboard` 144, `betaFeatures` 87, `adminLogs` 61) — split by page.
4. **Wave 4** — B3 repair + native review.
5. **Wave 5** — B4 docs/template, final verification.

Ordering rationale: `restA`/`restB` first because they are 100 % untranslated and user-visible behind
the flag menu; then new base sections shared by every locale; then the long tail of `pages.*`.

---

## 3. Execution protocol (per agent)

1. **One file per agent.** Never edit a file another agent owns in the same wave.
2. **Edit incrementally, one page group at a time**, using `Edit` on the source section — never
   rewrite a 100 KB locale file wholesale. This avoids truncation and keeps diffs reviewable.
3. After each page group: `npx tsc --noEmit` (fast, catches syntax and type errors) and
   `npm run i18n:check` (confirms the translated count rose by exactly the group size).
4. **Preserve, byte for byte:** every key, object nesting/page grouping, `{{placeholders}}`,
   emoji flags in `settings.presets` and `regionPreset.*`, trailing punctuation conventions.
5. **Do not translate:** WOMBAT/WOMBATpass, Checkov, Terraform, GitHub, provider names, control IDs,
   severity enum values, URLs, code/YAML/HCL/JSON snippets, data values, legal prose quoted verbatim.
6. **Quoting:** source uses single-quoted TS strings; escape embedded apostrophes (`\'`) or use
   double quotes where the source does. Do not introduce template literals or comments.
7. **Do not commit, push, reformat, or reorder keys.** Keep the source order so diff review is linear.
8. Report back per page group: keys done, placeholder check result, terminology choices that differ
   from the glossary.

### Copy-paste prompt for a B1 agent (one locale)

> You are translating the WOMBATpass dashboard (`/Volumes/Development/code/git/waf++/wafpass-dashboard`).
> Read `PLAN-I18N-TRANSLATIONS.md` §1 and §3, and `i18n-GLOSSARY.md`, first.
> Your locale: **<lang>**. Owner file: `src/i18n/locales/phase3/<lang>.ts`.
> Add `restA` and `restB` objects (copy the page grouping and key order from
> `src/i18n/locales/phase3/restA.ts` and `restB.ts`, 260 + 439 keys) alongside the existing six
> namespaces. First apply the type annotation from plan §1.1. Work page group by page group; after
> each run `npx tsc --noEmit` and `npm run i18n:check`. Keep keys and `{{placeholders}}` exact;
> keep `{{s}}`; leave brand names and code samples untranslated. Do not edit any other file and do
> not commit. Finish with a short report: keys translated, placeholder mismatches, glossary deltas.

### Copy-paste prompt for a B2 agent (one locale)

> Same repo and rules. Your locale: **<lang>**. Owner file: `src/i18n/locales/<lang>.ts`.
> Run `npm run i18n:check -- --list-missing <lang>` and translate the missing keys into the **same
> nested path** as `src/i18n/locales/en.ts`. Start with `onboarding`, `welcome`, `about`,
> `frameworkDetail`, `nav`, `common`, `prefs`; then work through `pages.*` subsection by subsection.
> Add keys only in the position matching `en.ts`; never duplicate an existing key. Verify after each
> subsection with `npx tsc --noEmit` and `npm run i18n:check`. Do not edit other files, do not commit.

---

## 4. Verification gates

Run centrally after each wave (not inside every agent):

```bash
npm run i18n:check                    # must stay OK; parity must stay 431 × 6
npm run i18n:check -- --strict       # exit 0 only at the end
npm run i18n:check -- --list-missing de  # base gaps must shrink monotonically
npm run i18n:check -- --list-english de  # new audit; drives the repair pass
npx tsc --noEmit
npm run build
npm test                             # 117 tests
```

Expected progression:

| After | rest missing (per locale) | base missing de … el |
|---|---|---|
| Wave 1–2 | 0 | unchanged (492 / 832 / 818 / 821 / 833 / 834) |
| Wave 3 | 0 | 0 for all six |
| Wave 4 | 0 | 0; placeholder audit clean; English-identical reduced to allowlisted proper nouns |
| Wave 5 | 0 | 0; `--strict` exits 0 |

Optional runtime spot check: `npm run dev`, switch language via the flag menu, open
Settings → Run Scan → Changes → Dashboard and confirm no raw `pages.*` keys and no literal
`{{…}}` tokens.

---

## 5. Docs and template (after translations land)

1. **`LANGUAGE.md`** — replace the false "100 %" table with measured coverage, add `br` to the
   existing-languages table (currently missing), and document the `{{s}}` plural limitation.
2. **`xx_TEMPLATE.ts`** (optional but recommended) — sync from `en.ts` + `phase3` aggregate so a new
   language starts complete: 2401 base + 1130 Phase 3 (431 six-namespace + 699 rest) = 3531 keys. The
   current template has 2635 and is missing 896. If skipped, state in
   `LANGUAGE.md` that the template is Phase 3-only and must be extended before use.
3. **`TASK-I18N-TRANSLATIONS.md`** — mark completed, or archive; it contains the two incorrect
   statements above and should not remain the operative instruction.
4. Leave `en.ts.bak` alone unless the owner asks; it is a stale 2026-09 backup.

---

## 6. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| TS2353 from the task's required shape | Every locale file fails `tsc` on first edit | §1.1 before any translation |
| Parity check counts rest keys as `extra` | `i18n:check` fails as soon as work starts | §1.2 patch before any translation |
| Key-presence metric hides English text | "Done" with 737 untranslated values | §1.3 audit + §2 B3 |
| `{{n}}` / `{{s}}` plural handling | Visible raw placeholders | Hard placeholder gate; Greek wording strategy in §1.5 |
| Six agents drift in terminology | Inconsistent product language | Glossary in §1.4, referenced by every prompt |
| Giant file edits truncated | Corrupt locale file | Incremental `Edit` per page group + `tsc` after each |
| Agent edits cross file boundaries | Merge noise / lost work | One owner file per agent; other files read-only |
| Machine translation quality | Awkward or wrong tone | Native review per locale (task Batch 3) with glossary checklist |
| Build/test run per agent | Wasted time, flaky contention | Centralised per wave |

**Effort estimate:** ~9 500 strings across six locales. At ~6–10 strings per 100 output tokens that is
roughly 0.5–0.8 M output tokens total. B1 is ~45 % of the volume; B2 depends heavily on locale
(de smallest at 492, el largest at 834). Expect 3–4 execution waves and 1 native-review round.

---

## 7. Definition of done (revised)

- [ ] `npm run i18n:check -- --strict` exits 0
- [ ] Phase 3 parity still 431/431 for all six locales
- [ ] restA/restB translated: 699/699 per locale
- [ ] base missing 0 per locale
- [ ] placeholder audit: 0 mismatches (43 existing fixed)
- [ ] English-identical audit: only allowlisted proper nouns/code remain, listed in the report
- [ ] `npx tsc --noEmit`, `npm run build`, `npm test` (117) pass
- [ ] native review notes + confirmed glossary attached
- [ ] `LANGUAGE.md` coverage table corrected
- [ ] working tree left uncommitted

---

## 8. Progress log

### Wave 0 — complete, 2026-11-06

- **§1.1** widened the type annotation in all six `src/i18n/locales/phase3/<lang>.ts` files to
  `typeof phase3En & { restA?: …; restB?: … }`; `restA`/`restB` can now be added incrementally and
  still compile.
- **§1.2** parity in `scripts/i18n-check.mjs` now compares only the six Phase 3 namespaces, so
  `restA.*`/`restB.*` keys count as coverage rather than "extra". Verified: parity still 431 × 6,
  default check exits 0.
- **§1.3** added value audits to the checker: `{{placeholder}}` parity, empty values, and an
  English-identical count per locale, plus `npm run i18n:check -- --list-english <lang>`.
  Placeholder and empty-value findings fail under `--strict` (default stays green while work is
  in progress). Current findings: **43 placeholder mismatches, 1 empty value (es)** — repair batch.
- **§1.4/§1.5** created `i18n-GLOSSARY.md`: canonical terms per locale mined from existing keys,
  proposed terms marked †, drift list, `{{s}}` plural strategy (including Greek), and
  do-not-translate rules.
- **Verification:** `npx tsc --noEmit` ✅ · `npm run i18n:check` exit 0, parity 431 × 6 ✅ ·
  `npm test` 117/117 ✅ · `npm run build` exit 0 ✅.
- **No translation content changed yet.** Working tree remains uncommitted.

### Wave 1 — complete, 2026-11-06

`restA` (260) + `restB` (439) translated into **de**, **fr**, **es** — 699 keys each.

| Locale | Keys | Missing/extra | Placeholder mismatches in new keys | Key order | English-identical (rest only) |
|---|---:|---|---:|---|---:|
| de | 699 | 0 / 0 | 0 | identical | 33 |
| fr | 699 | 0 / 0 | 0 | identical | 45 |
| es | 699 | 0 / 0 | 0 | identical | 19 |

- Diffs are additive: +773 / −1 lines per file (the −1 is the Wave 0 type header). No existing
  namespace was modified.
- Pre-existing placeholder counts unchanged: de 16, fr 6, es 9. No new empty values.
- The English-identical values were reviewed individually and are all cognates, brands, identifiers
  or flag values (`Score`, `Description`, `stable`, `scan`, `critical | high | medium | low`,
  `.wombat-skip.yml`); a stopword scan found **zero** English sentences.
- **Gates:** `npx tsc --noEmit` ✅ · `npm run i18n:check` exit 0, parity 431 × 6, rest missing 0 for
  de/fr/es ✅ · `npm test` 117/117 ✅ · `npm run build` exit 0 ✅.
- Notes for native review: fr new strings use straight apostrophes while older fr strings use `’`;
  de keeps established loanwords (Compliance, Sandbox, Badge, Triage) and renders “Agentic” as
  „Agentisch“.

### Wave 2 — complete, 2026-11-06

`restA` + `restB` translated into **pt**, **br**, **el** — 699 keys each. Batch 1 is now complete
for all six locales.

| Locale | Keys | Missing/extra | Placeholder mismatches (new) | Key order | English-identical (rest only) |
|---|---:|---|---:|---|---:|
| pt | 699 | 0 / 0 | 0 | identical | 22 |
| br | 699 | 0 / 0 | 0 | identical | 23 |
| el | 699 | 0 / 0 | 0 | identical | 16 |

- Diffs additive (+775 / +790 / +773, one deleted line each: the Wave 0 type header). No existing
  namespace modified.
- Pre-existing placeholder counts unchanged: pt 4, br 4, el 4. Empty values 0. English-identical
  values reviewed: brands, identifiers and flag enums only; stopword scan found no English prose.
- **Gates:** `npx tsc --noEmit` ✅ · `npm run i18n:check` exit 0, parity 431 × 6, **rest missing 0 in
  all six locales** ✅ · `npm test` 117/117 ✅ · `npm run build` ✅.
- Glossary corrected during the wave: `finding` for pt/br is **achado**, not `hallazgo` (the existing
  base files contain Spanish leakage; new content is clean).
- `pt` vs `br` differ on 202 of 699 new strings, mostly orthographic/stylistic. Both use “badge”
  predominantly but each has a few “selo” — reconcile in native review.

**Plural-suffix residual defects (repair batch):**

| Key | de | el | Issue |
|---|---|---|---|
| `dashboard.regionCount` | `{{count}} Region{{s}}` | `Περιοχές: {{count}}{{s}}` | de gives “Regions” (should be Regionen); el gives “5s” |
| `globalDashboard.projectsAtL4L5` | `{{count}} Projekt{{s}} auf L4/L5` | `Έργα στο L4/L5: {{count}}{{s}}` | de gives “Projekts” (should be Projekte); el gives “3s” |

pt/br solved it by choosing plural-safe nouns (`zona{{s}}`, `projeto{{s}}`). The durable fix is a
locale-aware plural helper at the call sites (or dropping the suffix for locales that don't use it);
per-string wording cannot fully solve Greek. Note this in the repair batch plan.

### Wave 3 — complete, 2026-11-06

Base-app gaps filled in all six locales: **4,630 keys** (de 492, fr 832, es 818, pt 821, br 833, el 834).
Every locale file now contains exactly **2,401 base keys — 0 missing, 0 extra**.

| Locale | Base keys | Missing | Extra | Placeholder mismatches | Empty | English-identical (base) | Likely prose left |
|---|---:|---:|---:|---:|---:|---:|---:|
| de | 2401 | 0 | 0 | 16 | 0 | 102 | 1 (`Open Source`) |
| fr | 2401 | 0 | 0 | 6 | 0 | 117 | 0 |
| es | 2401 | 0 | 0 | 9 | 1 | 67 | 2 (`Maturity Gate` titles) |
| pt | 2401 | 0 | 0 | 4 | 0 | 96 | 0 |
| br | 2401 | 0 | 0 | 4 | 0 | 93 | 2 (`run{{s}}` loanwords) |
| el | 2401 | 0 | 0 | 4 | 0 | 82 | 5 (`Hall of Fame` ×2, `IdP SSO URL`, `run{{s}}` ×2) |

All “likely prose” flags were reviewed and accepted as branded labels, protocol names, established
loanwords, or `{{s}}`-constrained strings. All other English-identical values are proper nouns, CLI
commands, URLs/emails, acronyms and flags.

- **Quality issue caught by the audit:** the first pass on de/fr/pt/br/el added some keys with their
  English values — most notably whole `engineeringOps`/`architectureOps`/`maturityOps`/`pipelineOps`
  subtitles, `passports.bulk*`, and `dashboard.trendStub*`. Key-presence would have called this done.
  Each locale received a targeted correction list; final prose count is the column above.
- **Gates:** `npx tsc --noEmit` ✅ · `npm run i18n:check` exit 0, parity 431 × 6, **base missing 0 and
  rest missing 0 in all six** ✅ · `npm test` 117/117 ✅ · `npm run build` exit 0 ✅.
- Pre-existing defects intentionally untouched (repair batch): 43 placeholder mismatches total,
  1 empty value (es `catalogue.howConfStructuredAfter`).

### Wave 4 — complete, 2026-11-06

Repair batch finished. **`npm run i18n:check -- --strict` exits 0.**

- **43 placeholder mismatches → 0** in all six locales.
- **Root cause fixed properly:** English plural suffixes (`{{s}}`, `{{es}}`, `{{suffix}}`) were baked
  into source strings, which German/Greek cannot use and French/Spanish/Portuguese cannot use for
  `{{es}}`. `src/i18n/index.tsx` now makes suffix substitution locale-aware: `s` and `suffix` resolve
  to `''` for de/el; `es` resolves to `''` for every non-English locale. English behaviour is
  unchanged and no call sites were touched.
- Translations were rewritten to carry the plural form themselves: de/el use parenthetical/slash
  forms (`Kontrolle(n)`, `έλεγχος/-οι`), and fr/es/pt/br use `branche(s){{es}}`, `pacote{{suffix}}`.
- **Literal-placeholder bugs fixed:** `audit.tabEvents` / `tabExposure` (12 strings were rendering
  `({{count}})` with no variable passed), `gapanalysis.requirementsMet` (6 strings), `controlspacks.pack`
  (`{{s}}` vs the passed `suffix`), `projectOverview.branches` (`{{s}}` vs the passed `es`).
- **Empty value:** es `catalogue.howConfStructuredAfter` is intentionally empty — the sentence is
  split around a `<code>conf</code>` element. Allowlisted in the checker with a comment; not filled
  with redundant text.
- **Legacy `Hallazgos`:** replaced with `achado/achados` (including the capitalised singular
  `Hallazgo:`) in pt/br. `badge`/`selo` was already consistent by this point (0 `selo` left).
- **Gates:** `npx tsc --noEmit` ✅ · `i18n:check --strict` exit 0 · `npm test` 117/117 ✅ ·
  `npm run build` ✅.
- English source strings were **not** changed.

### Wave 5 — complete, 2026-11-06

- **`LANGUAGE.md` rewritten.** Correct coverage table (3 531 keys per locale: 2 401 base + 1 130
  Phase 3), `br` added, the old duplicate “Existing languages” section removed, the locale-aware
  plural rule documented, checker commands (`--strict`, `--list-missing`, `--list-english`) added,
  and the template's incompleteness stated explicitly.
- **`NATIVE-REVIEW.md` created.** Per-locale focus areas, the terminology to confirm, the specific
  judgement calls (German loanwords, French apostrophe style, Spanish `Maturity Gate`, Portuguese
  pt-vs-br policy, Greek `Hall of Fame`, plural parentheticals), and a sign-off table. This is the
  only remaining acceptance item and requires a human native speaker.
- **`TASK-I18N-TRANSLATIONS.md` marked completed** and pointed at this plan; its historical baseline
  is retained.
- **Template sync consciously skipped.** `xx_TEMPLATE.ts` is a 2 969-line commented file covering
  2 635 keys; it is missing 784 base + 112 Phase 3 keys (896 total). Regenerating it from `en.ts` would destroy the
  inline translator comments, so `LANGUAGE.md` documents the gap and tells contributors to
  regenerate or start from a complete locale. This matches the plan's “optional but recommended”
  status.
- No app code changed in this wave. `i18n:check --strict`, `tsc`, tests and build remain green.
