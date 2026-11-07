# Native review — WOMBATpass dashboard translations

**Prepared:** 2026-11-06 · **Status:** awaiting native review · **Machine verification:** complete

All six locales (`de`, `fr`, `es`, `pt`, `br`, `el`) contain every key: 2 401 base + 1 130 Phase 3
(431 six-namespace + 699 `restA`/`restB`) = **3 531 strings per locale**, 21 186 in total.
`npm run i18n:check -- --strict` exits 0, and `tsc`, `build` and the 117 tests pass.

This file is the handoff for the human review. It lists what to check, the terminology to confirm,
and the specific strings that need a judgement call. Machine checks cannot assess tone, grammar or
whether a term is the one your users actually use.

---

## How to run the checks

```bash
npm run i18n:check -- --strict          # must exit 0
npm run i18n:check -- --list-english de # keys still identical to English
npx tsc --noEmit
npm run build
npm test
```

If you fix a string, keep the key and every `{{placeholder}}` exactly as they are, then re-run
`i18n:check -- --strict`. For a terminology change, update
[`i18n-GLOSSARY.md`](./i18n-GLOSSARY.md) so the next batch stays consistent.

---

## Coverage

| Locale | Keys | Placeholder mismatches | Empty | English-identical (base) | Likely prose left |
|---|---:|---:|---:|---:|---|
| de | 3 531 | 0 | 0 | 102 | 1 (`Open Source`) |
| fr | 3 531 | 0 | 0 | 118 | 0 |
| es | 3 531 | 0 | 0 | 67 | 2 (`Maturity Gate` titles) |
| pt | 3 531 | 0 | 0 | 95 | 0 |
| br | 3 531 | 0 | 0 | 92 | 2 (`run(s)` loanword) |
| el | 3 531 | 0 | 0 | 79 | 3 (`Hall of Fame` ×2, `IdP SSO URL`) |

“English-identical” values were reviewed and are predominantly proper nouns, CLI commands, URLs,
emails, acronyms, enum/flag values and established loanwords. Use `--list-english <lang>` to audit
them again after any change.

The one empty value, es `catalogue.howConfStructuredAfter`, is intentional: the sentence is split
around a `<code>conf</code>` element (“Cómo se estructura el ” + `conf`). It is allowlisted in the
checker.

---

## Terminology to confirm

The canonical terms are in [`i18n-GLOSSARY.md`](./i18n-GLOSSARY.md). Please confirm or correct these
first — they cascade through hundreds of strings:

| English | de | fr | es | pt | br | el |
|---|---|---|---|---|---|---|
| mandate | Mandant | mandant | mandante | mandante | mandante | εντολέας |
| control | Kontrolle | contrôle | control | controle | controle | έλεγχος |
| finding | Befund | résultat | hallazgo | achado | achado | εύρημα |
| waiver | Ausnahme | dérogation | exención | isenção | isenção | εξαίρεση |
| remediation | Behebung | remédiation | remediación | remediação | remediação | αποκατάσταση |
| run | Lauf | exécution | ejecución | execução | execução | εκτέλεση |
| scan | Scan | scan | escaneo | escaneamento | escaneamento | σάρωση |
| passport | Projekt-Pass | passeport projet | pasaporte de proyecto | passaporte do projeto | passaporte do projeto | διαβατήριο έργου |

Proposed terms with no prior translation to copy (marked † in the glossary):
compliance readiness, gating, attestation, countersignature.

---

## Per-locale review focus

### German (`de`)

- Formal **Sie**, compound nouns, sentence length.
- Confirm the loanwords kept in English: Compliance, Sandbox, Badge, Triage, Engine, Best Practices,
  Legacy IaC, Scopes.
- `Operations-Center` is used for the `*Ops` page titles. Confirm this reads better than translating
  “Operations Center”.
- “Agentic” → „Agentisch“ was a judgement call.
- `Nachweis` is the canonical term for evidence; older keys still use `Beweis` (e.g. „Beweispaket“).
  Decide whether to normalise the legacy keys.
- Plural parentheticals (`Kontrolle(n)`, `Lauf(e)`) are a deliberate workaround for the English
  plural suffix; confirm they read acceptably.
- `about.openSourceTitle` remains „Open Source“.

### French (`fr`)

- **vous** form; French spacing before `:` `;` `!` `?` and inside « ».
- Apostrophe style is mixed: older strings use `’`, newer strings use straight `'`. Decide on one and
  note it; both render correctly.
- CISO → **RSSI**, C-Level → **Direction**, Sandbox → **bac à sable** (older keys say Sandbox),
  override → **surcharge** (dérogation is reserved for waiver).
- `Maturity Gate` badge titles remain English/branded.
- “Centre des opérations de vol Wombat” — confirm the product name treatment.

### Spanish (`es`)

- Formal **usted**, neutral international Spanish.
- `GitHub Actions — Maturity Gate` / `GitLab CI — Maturity Gate` are branded; confirm whether
  “Portón de madurez” should be used instead.
- `pasarela` for gateway, `refrendo` for countersignature were new choices.
- “deriva” is canonical for drift; some legacy keys say “drift de compliance”.
- Legacy `pages.evidencePage.title` = „Tronco de evidencia“ is a literal mistranslation; the glossary
  recommends “bóveda/caja fuerte de evidencias”.

### Portuguese (`pt`)

- **Policy decision needed:** the locale is flagged 🇵🇹 but 1 536 of 1 568 overlapping keys match
  `br.ts`, and new content follows the Brazilian-dominant vocabulary (`usuário`, `controle`,
  `execução`, `escaneamento`, `achado`). Either relabel it as Portuguese (Brazil) or plan a
  European-Portuguese pass; a half-and-half locale will drift.
- Older keys had Spanish `Hallazgos`; these are now `Achado(s)`.
- `run` remains an English loanword in two `{{s}}`-constrained keys; confirm or replace.

### Brazilian Portuguese (`br`)

- `achado/achados` is canonical for finding.
- `run` remains an English loanword in two `{{s}}`-constrained keys (`{{count}} run{{s}}`).
- Confirm `Registro de Validações`, `Centro de Operações`, `Campeão` (Champion), `Alto Desempenho`
  (High Performer).
- `badge`/`selo` was inconsistent; it is now consistently “badge”.

### Greek (`el`)

- Formal plural, full τόνοι.
- `Hall of Fame` is kept in English; confirm or translate (e.g. «Αίθουσα Διακρίσεων»).
- `IdP SSO URL (HTTP-Redirect)` is a protocol label and stays technical.
- Plural forms use slash notation (`έλεγχος/-οι`, `εύρημα/-ματα`) because English suffixes cannot be
  used. Confirm this reads acceptably in UI slots.
- Loanwords kept: Sprint, Sandbox, Branch, Stage, Framework, Endpoint, Badge, CISO.

---

## Sign-off

A native speaker should record their decision per locale. Machine verification is already green; this
table is the human approval.

| Locale | Reviewer | Date | Terminology confirmed | Grammar/tone checked | Remaining notes |
|---|---|---|---|---|---|
| de |  |  | ☐ | ☐ |  |
| fr |  |  | ☐ | ☐ |  |
| es |  |  | ☐ | ☐ |  |
| pt |  |  | ☐ | ☐ |  |
| br |  |  | ☐ | ☐ |  |
| el |  |  | ☐ | ☐ |  |

When all six are signed off, the translation work is complete. Any further string added to `en.ts`
should be translated in the same pass and checked with `--strict`.
