# Task — Complete the dashboard translations

> **Status: completed 2026-11-06.** All six locales (`de`, `fr`, `es`, `pt`, `br`, `el`) are fully
> translated and `npm run i18n:check -- --strict` exits 0. The executed plan, corrections and
> verification are in `PLAN-I18N-TRANSLATIONS.md`; the baseline numbers below are historical
> (recorded 2026-11-05). Native review is tracked in `NATIVE-REVIEW.md`.

**Created:** 2026-11-05 · **Repo:** `wafpass-dashboard` · **Owner:** you (run with any capable AI coding agent)

This is a self-contained task. Paste the prompt at the bottom into a new AI session; it can work from this file alone.

---

## Goal

Make the dashboard fully translated in **de, fr, es, pt, br, el**.

Two kinds of work remain:

1. **`restA` / `restB`** — 699 UI strings extracted on 2026-11-05, currently **English-only in every locale**.
2. **Base app gaps** — the original locale files were already partial and fall back to English.

## Current baseline (`npm run i18n:check`)

```
static t() keys            2828 used · 0 missing
Phase 3 parity             431 / 431 in every locale
restA + restB              699 keys · 0 translated in every locale
template                  1018 Phase 3 keys present
```

Base-app missing keys per locale:

| Locale | Base keys missing |
|---|---:|
| de | 492 |
| fr | 832 |
| es | 818 |
| pt | 821 |
| br | 833 |
| el | 834 |

Missing keys **fall back to English** — the app never shows raw keys, so work can land incrementally.

---

## How the i18n system works

```
src/i18n/locales/
  en.ts                      English base app (source of truth)
  de.ts fr.ts es.ts pt.ts br.ts el.ts   partial base translations
  xx_TEMPLATE.ts             translator template (already includes Phase 3)
  phase3/
    evidence.ts legal.ts catalogue.ts autofix.ts readiness.ts sandbox.ts
      restA.ts restB.ts       English Phase 3 UI strings (restA/B: 10 pages each group)
    en.ts                      aggregate { evidence, …, sandbox }
    de.ts fr.ts es.ts pt.ts br.ts el.ts
                              per-locale Phase 3 overrides, typed `typeof phase3En`
```

`src/i18n/index.tsx` merges: `EN base + pages.phase3 (English)` then per locale `deepMerge(baseLocale, phase3Locale)`.

- Translation keys are looked up with dot paths.
- `restA` and `restB` are nested by page: `pages.phase3.restA.changes.title`.
- Placeholders look like `{{count}}`, `{{name}}`, `{{pct}}`; keep them verbatim.
- Brand/product names, code/YAML/HCL samples, IDs, data values and legal prose stay untranslated.

---

## Work plan

### Batch 1 — restA / restB (699 keys per locale)

Translate the English values in:

- `src/i18n/locales/phase3/restA.ts` (260 keys, grouped by page)
- `src/i18n/locales/phase3/restB.ts` (439 keys, grouped by page)

into **all six** files:

- `src/i18n/locales/phase3/de.ts`
- `src/i18n/locales/phase3/fr.ts`
- `src/i18n/locales/phase3/es.ts`
- `src/i18n/locales/phase3/pt.ts`
- `src/i18n/locales/phase3/br.ts`
- `src/i18n/locales/phase3/el.ts`

Required shape (same as the English source):

```ts
const copy: typeof phase3En = {
  evidence: { /* existing */ },
  legal: { /* existing */ },
  catalogue: { /* existing */ },
  autofix: { /* existing */ },
  readiness: { /* existing */ },
  sandbox: { /* existing */ },
  restA: {
    changes: { title: '…', … },
    dashboard: { … },
    …
  },
  restB: {
    passportDashboard: { … },
    settings: { … },
    …
  },
}
export default copy
```

**Do not duplicate** existing keys; add `restA`/`restB` alongside them.

### Batch 2 — base-app gaps

For each locale, list missing keys:

```bash
npm run i18n:check -- --list-missing de
```

Add them to `src/i18n/locales/<lang>.ts` in the **same nested path** as `en.ts`. Work per locale; each file is independent, so six agents can run in parallel.

### Batch 3 — native review

Have a native speaker review each locale for:

- terminology consistency: *mandate*, *control*, *finding*, *waiver*, *remediation*, *run*, *scan*, *passport*, *compliance readiness*
- tone: concise, neutral, no marketing language
- pluralization and punctuation conventions
- placeholder position inside sentences
- German compound nouns and Greek/Latin-script conventions

Keep a short glossary in the task report.

---

## Rules

- Keep every key exactly; only change values.
- Keep `{{placeholders}}` byte-identical (you may move them in a sentence).
- Do not translate: brand names (WOMBAT, WOMBATpass, Checkov, Terraform, GitHub…), code/YAML/HCL/JSON samples, control IDs, severity values, provider names, URLs, data values.
- Do not modify pages, components, styles, tests or scripts.
- If a base key genuinely should not be translated, leave it out and note why; fallback is safe.
- Do not commit or push. Leave changes in the working tree.

---

## Verification

```bash
npm run i18n:check                 # must report: all static keys resolve, Phase 3 parity OK
npm run i18n:check -- --strict    # must exit 0 when restA/B + base gaps are complete
npx tsc --noEmit
npm run build
npm test                          # 117 tests
```

Optional runtime spot check: switch language in the top bar (flag menu) and confirm no raw `pages.*` keys appear.

### Acceptance criteria

- [ ] `i18n:check --strict` exits 0
- [ ] `tsc`, `build`, `test` pass
- [ ] no locale contains untranslated `restA`/`restB` values (English fallback count = 0)
- [ ] base-app missing count = 0 for de/fr/es/pt/br/el
- [ ] native review notes attached
- [ ] working tree left uncommitted

---

## Ready-to-paste AI prompt

> You are completing the internationalisation of the WOMBATpass dashboard in `/Volumes/Development/code/git/waf++/wafpass-dashboard`.
>
> Read `TASK-I18N-TRANSLATIONS.md` in that directory first — it defines the goal, file layout, batches, rules and acceptance criteria.
>
> Work in this order:
> 1. Translate `src/i18n/locales/phase3/restA.ts` and `restB.ts` into `phase3/de.ts`, `fr.ts`, `es.ts`, `pt.ts`, `br.ts`, `el.ts`, adding `restA`/`restB` objects alongside the existing namespaces. You may split the six locales across parallel agents (two locales each); each locale file is independent.
> 2. For each locale, run `npm run i18n:check -- --list-missing <lang>` and translate the missing base-app keys in `src/i18n/locales/<lang>.ts`.
> 3. Run `npm run i18n:check -- --strict`, `npx tsc --noEmit`, `npm run build` and `npm test`. Fix any failure.
> 4. Report per locale: keys translated, remaining gaps, and any terminology decisions. Do not commit.
>
> Rules: keep keys and `{{placeholders}}` exact; keep brand names and code samples untranslated; do not edit pages, styles, tests or scripts.

---

## Useful commands

```bash
npm run i18n:check
npm run i18n:check -- --strict
npm run i18n:check -- --list-missing de
npm run design:lint -- --gate
npm run a11y:check          # needs Chrome + running stack
npm run visual:check        # needs Chrome + running stack
```
