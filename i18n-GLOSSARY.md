# i18n Glossary — WOMBATpass dashboard

**Created:** 2026-11-06 · **Status:** seeded from the existing translations, pending native review
**Used by:** every translation batch in `PLAN-I18N-TRANSLATIONS.md`
**Rule:** new strings follow this glossary. If a string needs a different term, record the deviation
in the batch report; do not silently introduce a synonym.

The translations below were mined from keys that already exist in all six locales, so they describe
current usage rather than an idealised preference. Where current usage is inconsistent, the
**canonical** form is the first one listed and the drift is noted.

---

## Core terminology

| English | de | fr | es | pt | br | el |
|---|---|---|---|---|---|---|
| mandate | Mandant | mandant | mandante | mandante | mandante | εντολέας (pl. εντολείς) |
| mandate administration | Mandantenverwaltung | administration des mandants | administración de mandantes | administração de mandantes | administração de mandantes | διαχείριση εντολέων |
| control | Kontrolle | contrôle | control | controle | controle | έλεγχος |
| finding | Befund | résultat | hallazgo | achado | achado | εύρημα |
| waiver | Ausnahme | dérogation | exención | isenção | isenção | εξαίρεση |
| remediation | Behebung | remédiation | remediación | remediação | remediação | αποκατάσταση |
| run | Lauf | exécution | ejecución | execução | execução | εκτέλεση |
| scan | Scan | scan | escaneo | escaneamento | escaneamento | σάρωση |
| passport | Projekt-Pass | passeport projet | pasaporte de proyecto | passaporte do projeto | passaporte do projeto | διαβατήριο έργου |
| compliance readiness | Compliance-Bereitschaft † | préparation à la conformité † | preparación para el cumplimiento † | prontidão de conformidade † | prontidão de conformidade † | ετοιμότητα συμμόρφωσης † |
| gating | Gating / Steuerung † | blocage | bloqueo | bloqueio | bloqueio | αποκλεισμός |
| evidence | Nachweis | preuve | evidencia | evidência | evidência | τεκμήριο |
| evidence package | Nachweispaket | paquet de preuves | paquete de evidencias | pacote de evidências | pacote de evidências | πακέτο τεκμηρίωσης |
| drift | Drift | dérive | deriva | deriva | deriva | απόκλιση |
| blast radius | Schadensradius | rayon de souffle | radio de impacto | raio de impacto | raio de impacto | ακτίνα επιπτώσεων |
| attestation | Attestierung † | attestation † | atestación † | atestação † | atestação † | πιστοποίηση † |
| countersignature | Gegenzeichnung † | contreseing † | refrendo † | contra-assinatura † | contra-assinatura † | αντεπικύρωση † |
| sign-off | Freigabe | validation | aprobación | aprovação | aprovação | έγκριση |

† = proposed term, no existing translation to copy — the native reviewer must confirm it.
The first seven rows are backed by dozens of existing keys and should be treated as fixed.

### Result labels

| English | de | fr | es | pt | br | el |
|---|---|---|---|---|---|---|
| pass | Bestanden | Réussi | Aprobado | Aprovado | Aprovado | Επιτυχία |
| fail | Fehlgeschlagen | Échoué | Fallido | Falhou | Falhou | Αποτυχία |
| skip | Übersprungen | Ignoré | Omitido | Ignorado | Ignorado | Παράλειψη |
| critical | Kritisch | Critique | Crítico | Crítico | Crítico | Κρίσιμο |
| high | Hoch | Élevé | Alto | Alto | Alto | Υψηλό |
| medium | Mittel | Moyen | Medio | Médio | Médio | Μεσαίο |
| low | Niedrig | Faible | Bajo | Baixo | Baixo | Χαμηλό |

**Important:** the enum values themselves (`critical`, `high`, `pass`, `fail`, …) are data and stay
in English. Only user-facing labels use the table above.

---

## Terminological drift to reconcile (repair batch)

These exist today and will otherwise leak inconsistencies into the new strings:

| Locale | Inconsistency | Canonical |
|---|---|---|
| de | `nav.items.evidence` = „Beweispaket“, `pages.evidencePage.title` = „Beweis-Provider“, Phase 3 = „Nachweisarchiv“ | **Nachweis** |
| fr | `nav.items.waivers` = « Dérogations », waive modal = « exemption » | **dérogation** |
| fr | `nav.items.findings` = « Résultats » — verify it is not confused with generic results | **résultat** (context: finding) |
| es | „drift de compliance“ mixed with „deriva“ | **deriva** |
| pt / br | „run“ left untranslated in base strings while Phase 3 uses „execução“ | **execução** |
| es | `pages.evidencePage.title` = „Tronco de evidencia“ (literal trunk) | **caja fuerte de evidencias** or „bóveda de evidencias“ as used in Phase 3 |
| pt / br | existing base uses Spanish `Hallazgos` for findings | **achado / achados** (new content already corrected) |

Do not fix these in the middle of a translation batch; collect them for the repair pass so a locale
file is not edited by two agents.

---

## Grammar and placeholder rules

### `{{placeholders}}` are immutable

Every placeholder present in the English source must appear in the translation with the **same name**
and the **same multiplicity**; order may change. The checker enforces this under `--strict`.

### The `{{s}}` plural suffix

English strings such as `'{{count}} control{{s}}'` rely on a call site that passes
`s: n !== 1 ? 's' : ''`. Components may not be edited, so the placeholder must be preserved.

- **de / fr / es / pt / br:** append the suffix to a form that pluralises by adding a letter:
  `{{count}} Kontrolle{{s}}` (acceptable), `{{count}} contrôle{{s}}`, `{{count}} control{{s}}`,
  `{{count}} controle{{s}}`.
- **el:** Greek does not pluralise by appending a Latin `s`. Rewrite into suffix-free phrasing and
  keep `{{s}}` harmless, e.g. `Πλήθος ελέγχων: {{count}}` (the empty-string branch simply appends
  nothing; the `s` branch would too, but avoid a construction where it shows). Prefer
  `Σύνολο: {{count}}` constructions for these strings and note them in the batch report.
  **Do not copy the 14 existing el base keys that violate this** (e.g.
  `{{count}} έλεγχος{{s}}`, `{{count}} πόρος{{s}}`) — they are known defects for the repair batch.
  New strings must read correctly when the suffix is `''` and when it is `'s'`.

**Resolved in Wave 4.** `t()` in `src/i18n/index.tsx` is now locale-aware: `{{s}}` and `{{suffix}}`
resolve to `''` for de/el, and `{{es}}` resolves to `''` for every non-English locale. Translations
therefore carry the plural form themselves:

- de: `Kontrolle(n){{s}}`, `Ressource(n){{s}}`, `Lauf(e){{s}}`, `Region(en){{s}}` — the suffix renders
  empty, the parenthetical carries the plural.
- el: `έλεγχος/-οι{{s}}`, `πόρος/-οι{{s}}`, `εύρημα/-ματα{{s}}`, `πακέτο/-α{{suffix}}`.
- fr/es/pt/br: normal `{{s}}` where it is grammatical; `branche(s){{es}}` / `rama(s){{es}}` for
  branches; `pack{{suffix}}` / `paquete{{suffix}}` / `pacote{{suffix}}` for packs.
- English source strings are unchanged.

### Other placeholders

`{{count}}`, `{{name}}`, `{{score}}`, `{{label}}`, `{{status}}`, `{{id}}`, `{{date}}`, `{{total}}`,
`{{pass}}`, `{{critical}}`, `{{high}}`, `{{project}}`, `{{user}}`, `{{group}}`, `{{delta}}`, `{{pct}}`
and the rest of the set are substituted verbatim. Never translate the token, only the sentence
around it.

### Inline markup

Some values contain HTML: `<strong>…</strong>`, `<em>…</em>`, `<code>…</code>`. Keep the tags
byte-identical and translated text between them.

### Emoji

Flag emoji in `settings.presets.*` and `settings.regionPreset.*` are part of the label. Keep the
emoji, translate only the region name (`🇪🇺 Europe` → `🇪🇺 Europa`).

---

## Never translate

- Product and company names: WOMBAT, WOMBATpass, Wafpass, Checkov, Terraform, GitHub, GitLab,
  AWS, Azure, GCP, Keycloak, PostgreSQL, shields.io.
- Code, YAML/HCL/JSON snippets, CLI commands, file paths, environment variables.
- Control IDs, framework identifiers, CVE IDs, URLs, version numbers.
- Severity/result enum values, HTTP methods, log levels.
- Legal prose quoted verbatim from a licence or regulation.
- Branded feature names already used untranslated in the current locale (e.g. de/es keep
  „Maturity Gate“; do not retranslate it inline).

## Do translate

Navigation, page titles, empty states, helper text, tooltips, button labels, error messages,
settings descriptions, onboarding copy, dashboard cards and chart legends.

---

## Tone and style

| Locale | Address | Notes |
|---|---|---|
| de | formal **Sie** | Nouns capitalised; prefer compounds over prepositional phrases; keep sentences short. |
| fr | **vous** | Space before `:` `;` `!` `?` and inside « » per French typography; avoid anglicisms where a standard term exists. |
| es | formal **usted** (current files use it) | Neutral international Spanish; avoid regionalisms. |
| pt | formal | **Caveat:** `pt.ts` is flagged 🇵🇹 but its existing content is predominantly Brazilian — 1,536 of 1,568 overlapping keys are identical to `br.ts`, and it uses `usuário`/`controle` throughout. Only ~32 keys (mostly mandate administration) use European forms (`A visualizar`, `os seus dados`, `a nível da base de dados`). Follow the dominant existing vocabulary (`usuário`, `controle`, `execução`, `escaneamento`, `isenção`); do not introduce European-only forms (`utilizador`, `ficheiro`, `controlo`) unless the file already uses them in that context. |
| br | formal, Brazilian Portuguese | Use `tela`, `usuário`, `arquivo`; keep `você`. |
| el | formal plural | Full accents (τόνοι) required; keep Greek quotation marks « ». |

All locales: concise, neutral, no marketing language. Match the source's sentence length where
possible; do not add exclamation marks that are absent in English.

---

## Native-review checklist

- [ ] Core terminology table confirmed or corrected, with the reason for each correction.
- [ ] Proposed (†) terms decided.
- [ ] Drift list above resolved in the repair batch.
- [ ] `{{s}}` constructions read naturally in context, especially Greek.
- [ ] Placeholder audit (`npm run i18n:check -- --strict`) clean after review.
- [ ] No sentence exceeds its UI container noticeably more than the English source.
