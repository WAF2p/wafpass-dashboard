# Adding a new language to WOMBATpass Dashboard

The i18n system uses typed TypeScript locale files with English as the fallback.
Any string you leave untranslated automatically falls back to English — so a partial translation is perfectly valid and can be shipped incrementally.

---

## Quick start (5 steps)

### 1. Get a starting file

Copy the translation template to a new file named after the [ISO 639-1](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) two-letter code for your language:

```
src/i18n/locales/xx_TEMPLATE.ts  →  src/i18n/locales/pt.ts   (Portuguese)
src/i18n/locales/xx_TEMPLATE.ts  →  src/i18n/locales/ja.ts   (Japanese)
src/i18n/locales/xx_TEMPLATE.ts  →  src/i18n/locales/nl.ts   (Dutch)
```

> **Template status (2026-11-06):** `xx_TEMPLATE.ts` is **not complete**. It covers 2 635 keys
> (1 617 base + 1 018 Phase 3) but is missing 784 base keys and 112 Phase 3 keys (1 `restA`,
> 111 `restB`) — 896 in total.
> Before using it for a new language, regenerate it from `en.ts` + `src/i18n/locales/phase3/index.ts`,
> or copy an existing complete locale (e.g. `de.ts`) and replace the values. The checker will list
> anything missing.

### 2. Fill in the `meta` block

At the top of your file, update the three metadata fields:

```ts
meta: { code: 'pt', name: 'Português', flag: '🇧🇷' },
```

| Field  | What to put                                             | Example         |
|--------|---------------------------------------------------------|-----------------|
| `code` | ISO 639-1 two-letter code                              | `'pt'`          |
| `name` | The language name **written in that language**          | `'Português'`   |
| `flag` | Emoji flag of the primary country for the language     | `'🇧🇷'`         |

### 3. Translate the strings

Replace every English value on the right-hand side of each key with your translation.
The keys themselves must not change.

```ts
// Before (template):
save: 'Save',

// After (Portuguese):
save: 'Salvar',
```

Read the inline comments in the template — they explain what each string is used for and any constraints (placeholder variables, character limits, etc.). For terminology, follow [`i18n-GLOSSARY.md`](./i18n-GLOSSARY.md).

### 4. Register the locale

Open `src/i18n/index.tsx` and add your locale to the `LOCALES` map:

```ts
import ja from './locales/ja'          // ← add import

export const LOCALES: Record<string, PartialTranslations> = {
  en, de, fr, es, pt, br, el,
  ja,                                  // ← add entry
}
```

If your language has Phase 3 pages, also add a `src/i18n/locales/phase3/ja.ts` and wire it with
`withPhase3(ja, p3ja)`. The existing Phase 3 files are the model to copy.

That's all. The language switcher in **My Preferences** and the **Default Interface Language**
dropdown in **Settings** pick up new locales automatically.

### 5. Test it

1. Rebuild the dashboard: `npm run build` (or use the dev server: `npm run dev`)
2. Log in → open **My Preferences** → switch language to your new locale
3. Verify the sidebar, status labels, and settings page render correctly
4. Run the checks in **Verification** below

---

## Existing languages

Measured 2026-11-06. Coverage is **key presence**: every key in `en.ts` and the Phase 3
`restA`/`restB` batches has a value, so nothing falls back to English. Some values are intentionally
identical to English — product names, CLI commands, URLs, acronyms and enum values.

| Code | Language | Coverage | Keys |
|------|----------|----------|-----:|
| `en` | English | 100 % (source) | 3 531 |
| `de` | Deutsch | 100 % | 3 531 |
| `fr` | Français | 100 % | 3 531 |
| `es` | Español | 100 % | 3 531 |
| `pt` | Português | 100 % | 3 531 |
| `br` | Português (Brasil) | 100 % | 3 531 |
| `el` | Ελληνικά | 100 % | 3 531 |

Each complete locale contains 2 401 base keys plus 1 130 Phase 3 keys (431 in the six Phase 3
namespaces + 699 in `restA`/`restB`). Run `npm run i18n:check` for the live numbers.

**Portuguese note:** `pt` is flagged 🇵🇹 but its content is predominantly Brazilian (1 536 of 1 568
overlapping keys match `br.ts`). See the glossary before adding strings.

---

## Translation rules

### Keys are fixed — only translate values

```ts
// Correct
findings: 'Resultados',

// Wrong — do not rename keys
resultados: 'Resultados',
```

### Keep `{{variable}}` placeholders verbatim

Placeholders like `{{count}}`, `{{level}}`, `{{name}}` are replaced at runtime. Keep the exact
spelling and the double braces. You may move them within the sentence but must not rename or remove
them.

```ts
// English:
activeRegions: 'Active: {{count}} region(s)',

// Portuguese — placeholder moved to end, still valid:
activeRegions: '{{count}} região(ões) ativa(s)',

// Wrong — placeholder renamed:
activeRegions: 'Ativas: {{quantidade}} região(ões)',
```

### Plural suffixes are locale-aware

Some English strings contain `{{s}}`, `{{es}}` or `{{suffix}}` — an English plural suffix supplied by
the call site. `t()` in `src/i18n/index.tsx` resolves these per locale:

| Variable | en | de / el | fr / es / pt / br |
|---|---|---|---|
| `{{s}}` | as passed | `''` | as passed |
| `{{suffix}}` | as passed | `''` | as passed |
| `{{es}}` | as passed | `''` | `''` |

German and Greek cannot pluralise with a Latin `-s`, and `-es` is wrong outside English. Their
translations therefore carry the plural form themselves and keep the placeholder only to satisfy
parity:

```ts
// German: the suffix renders empty; "(n)" carries the plural
controlCount: '{{count}} Kontrolle(n){{s}}',

// Greek
controlCount: '{{count}} έλεγχος/-οι{{s}}',
```

For French, Spanish and Portuguese, `{{s}}` and `{{suffix}}` work normally:
`{{count}} contrôle{{s}}`, `{{count}} pacote{{suffix}}`. For `branches`, which uses `{{es}}`, use a
parenthetical form: `{{count}} branche(s){{es}}`.

### Keep emoji flags in `settings.presets`

The preset buttons include a flag emoji as part of the label. Translate only the country/region name:

```ts
// Correct
europe: '🇪🇺 Europa',

// Wrong — removed emoji
europe: 'Europa',
```

### Keep inline markup

Some values contain `<strong>…</strong>`, `<em>…</em>` or `<code>…</code>`. Keep the tags
byte-identical and translate only the text between them.

### Partial translations are fine

You do not have to translate every section. Any key you omit or delete falls back to English. This
means you can ship a translation that covers only the navigation and status labels and expand it
later.

```ts
// Minimal valid translation — covers nav only:
const pt: PartialTranslations = {
  meta: { code: 'pt', name: 'Português', flag: '🇧🇷' },
  nav: {
    sections: { ... },
    items: { ... },
  },
}
```

---

## File structure

```
src/i18n/
├── types.ts               — Full Translations interface (source of truth for all keys)
├── index.tsx              — I18nProvider, useI18n() hook, LOCALES map, plural-aware t()
└── locales/
    ├── en.ts              — Complete English base (all keys required)
    ├── de.ts fr.ts es.ts pt.ts br.ts el.ts — base translations
    ├── xx_TEMPLATE.ts     — Translation template (incomplete; see note above)
    └── phase3/
        ├── evidence.ts legal.ts catalogue.ts autofix.ts readiness.ts sandbox.ts
        ├── restA.ts restB.ts  — English Phase 3 UI strings
        ├── en.ts              — aggregate of the six namespaces
        └── de.ts fr.ts es.ts pt.ts br.ts el.ts — per-locale Phase 3 overrides
```

`types.ts` is the canonical list of every translatable base string. If a key appears there, it must
exist in `en.ts`. All other locales are `DeepPartial<Translations>` — every key is optional.

`src/i18n/index.tsx` merges `EN base + phase3 (English)` and then `deepMerge(baseLocale,
phase3Locale)` for each language.

---

## How the fallback works

At runtime the system deep-merges your locale over the English base:

```
English (complete) + Your locale (partial) = Final translation (complete)
```

Missing keys silently resolve to English. There are no runtime errors for missing keys.

---

## Verification

```bash
npm run i18n:check                     # report; fails on unresolved keys or parity breaks
npm run i18n:check -- --strict        # fails on missing keys, placeholder mismatches or empty values
npm run i18n:check -- --list-missing de
npm run i18n:check -- --list-english de
npx tsc --noEmit
npm run build
npm test
```

`--list-missing` prints every untranslated key for a locale. `--list-english` prints keys whose
value is still byte-identical to English, so you can review whether that is deliberate (brand, code,
acronym) or a missed translation.

---

## Adding a new translatable string (for developers)

1. Add the key to the `Translations` interface in `src/i18n/types.ts`
2. Add the English value to `src/i18n/locales/en.ts`
3. Add the key (with the English value as placeholder) to `src/i18n/locales/xx_TEMPLATE.ts`
4. Use it in components via `const { t } = useI18n()` → `t('section.key')`
5. Run `npm run i18n:check -- --strict`; translate the new key in the six locales (they fall back to
   English until translated)

---

## Native review

Coverage is machine-verified, but tone, terminology and grammar need a native speaker. See
[`NATIVE-REVIEW.md`](./NATIVE-REVIEW.md) for the per-locale checklist, the glossary to confirm, and
the sign-off table.

## Questions / submitting a translation

Open a pull request with your locale file and the updated `LOCALES` map in `index.tsx`.
The TypeScript compiler will catch structural mistakes (wrong key names, wrong types) at build time,
and `npm run i18n:check -- --strict` catches placeholder and coverage problems.
