# Adding a new language to WAF++ Dashboard

The i18n system uses typed TypeScript locale files with English as the fallback.
Any string you leave untranslated automatically falls back to English — so a partial translation is perfectly valid and can be shipped incrementally.

---

## Quick start (5 steps)

### 1. Get the template

Copy the translation template to a new file named after the [ISO 639-1](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) two-letter code for your language:

```
src/i18n/locales/xx_TEMPLATE.ts  →  src/i18n/locales/pt.ts   (Portuguese)
src/i18n/locales/xx_TEMPLATE.ts  →  src/i18n/locales/ja.ts   (Japanese)
src/i18n/locales/xx_TEMPLATE.ts  →  src/i18n/locales/nl.ts   (Dutch)
```

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

Read the inline comments in the template — they explain what each string is used for and any constraints (placeholder variables, character limits, etc.).

### 4. Register the locale

Open `src/i18n/index.tsx` and add your locale to the `LOCALES` map:

```ts
import pt from './locales/pt'          // ← add import

export const LOCALES: Record<string, PartialTranslations> = {
  en, de, fr, es,
  pt,                                  // ← add entry
}
```

That's all. The language switcher in **My Preferences** and the **Default Interface Language** dropdown in **Settings** pick up new locales automatically.

### 5. Test it

1. Rebuild the dashboard: `npm run build` (or use the dev server: `npm run dev`)
2. Log in → open **My Preferences** → switch language to your new locale
3. Verify the sidebar, status labels, and settings page render correctly

---

## Existing languages

| Code | Language | Coverage |
|------|----------|----------|
| `en` | English  | 100% (base) |
| `de` | Deutsch  | 100% |
| `fr` | Français | 100% |
| `es` | Español  | 100% |
| `pt` | Português | 100% |
| `el` | Ελληνικά | 100% |

The `pt` locale includes translations for the findings comments section (`pages.findings.commentSection`, `pages.findings.commentBtn`, `pages.findings.commentAuthor`).

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

Placeholders like `{{count}}` and `{{level}}` are replaced at runtime. Keep the exact spelling and the double-braces. You may move them within the sentence but must not rename or remove them.

```ts
// English:
activeRegions: 'Active: {{count}} region(s)',

// Portuguese — placeholder moved to end, still valid:
activeRegions: '{{count}} região(s) ativa(s)',

// Wrong — placeholder renamed:
activeRegions: 'Ativas: {{quantidade}} região(s)',
```

### Keep emoji flags in `settings.presets`

The preset buttons include a flag emoji as part of the label. Translate only the country/region name:

```ts
// Correct
europe: '🇪🇺 Europa',

// Wrong — removed emoji
europe: 'Europa',
```

### Partial translations are fine

You do not have to translate every section. Any key you omit or delete falls back to English. This means you can ship a translation that covers only the navigation and status labels and expand it later.

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
├── index.tsx              — I18nProvider, useI18n() hook, LOCALES map
└── locales/
    ├── en.ts              — Complete English base (all keys required)
    ├── de.ts              — German
    ├── fr.ts              — French
    ├── es.ts              — Spanish
    └── xx_TEMPLATE.ts     — Blank template for new languages
```

`types.ts` is the canonical list of every translatable string. If a key appears there, it must exist in `en.ts`. All other locales are `DeepPartial<Translations>` — every key is optional.

---

## How the fallback works

At runtime the system deep-merges your locale over the English base:

```
English (complete) + Your locale (partial) = Final translation (complete)
```

Missing keys silently resolve to English. There are no runtime errors for missing keys.

---

## Adding a new translatable string (for developers)

1. Add the key to the `Translations` interface in `src/i18n/types.ts`
2. Add the English value to `src/i18n/locales/en.ts`
3. Add the key (with the English value as placeholder) to `src/i18n/locales/xx_TEMPLATE.ts`
4. Use it in components via `const { t } = useI18n()` → `t('section.key')`
5. Optionally update existing locale files (`de.ts`, `fr.ts`, `es.ts`) — they will fall back to English until translated

---

## Existing languages

| Code | Language | Coverage |
|------|----------|----------|
| `en` | English  | 100% (base) |
| `de` | Deutsch  | 100% |
| `fr` | Français | 100% |
| `es` | Español  | 100% |
| `pt` | Português | 100% |
| `el` | Ελληνικά | 100% |

The `pt` and `el` locales include translations for the findings comments section (`pages.findings.commentSection`, `pages.findings.commentBtn`, `pages.findings.commentAuthor`).

---

## Questions / submitting a translation

Open a pull request with your locale file and the updated `LOCALES` map in `index.tsx`.
The TypeScript compiler will catch any structural mistakes (wrong key names, wrong types) at build time.
