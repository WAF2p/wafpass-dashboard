import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Translations, PartialTranslations, TFunction } from './types'
import en from './locales/en'
import phase3 from './locales/phase3'

const EN = deepMerge(en as Translations, { pages: { phase3 } } as unknown as Partial<Translations>)

export interface LocaleMeta {
  code: string
  name: string
  flag: string
}

/**
 * Metadata is static (the language picker needs it immediately); the actual
 * locale payloads are loaded on demand so maplibre-era bundles do not carry
 * every translation for the first paint.
 */
export const LOCALES: Record<string, { meta: LocaleMeta }> = {
  en: { meta: { code: 'en', name: 'English', flag: '🇬🇧' } },
  de: { meta: { code: 'de', name: 'Deutsch', flag: '🇩🇪' } },
  fr: { meta: { code: 'fr', name: 'Français', flag: '🇫🇷' } },
  es: { meta: { code: 'es', name: 'Español', flag: '🇪🇸' } },
  pt: { meta: { code: 'pt', name: 'Português', flag: '🇵🇹' } },
  br: { meta: { code: 'br', name: 'Brasil', flag: '🇧🇷' } },
  el: { meta: { code: 'el', name: 'Ελληνικά', flag: '🇬🇷' } },
}

type LocaleModule = { default: PartialTranslations }
type Phase3Module = { default: unknown }
type LocaleLoader = () => Promise<[LocaleModule, Phase3Module]>

const LOADERS: Record<string, LocaleLoader> = {
  de: () => Promise.all([import('./locales/de'), import('./locales/phase3/de')]),
  fr: () => Promise.all([import('./locales/fr'), import('./locales/phase3/fr')]),
  es: () => Promise.all([import('./locales/es'), import('./locales/phase3/es')]),
  pt: () => Promise.all([import('./locales/pt'), import('./locales/phase3/pt')]),
  br: () => Promise.all([import('./locales/br'), import('./locales/phase3/br')]),
  el: () => Promise.all([import('./locales/el'), import('./locales/phase3/el')]),
}

const withPhase3 = (base: PartialTranslations, extra: unknown): PartialTranslations =>
  deepMerge(base as object, { pages: { phase3: extra } } as object) as PartialTranslations

function deepMerge<T extends object>(base: T, override: Partial<T>): T {
  const result = { ...base }
  for (const key in override) {
    const v = override[key]
    if (v !== undefined && v !== null) {
      if (typeof v === 'object' && !Array.isArray(v) && typeof base[key] === 'object') {
        result[key] = deepMerge(base[key] as object, v as object) as T[typeof key]
      } else {
        result[key] = v as T[typeof key]
      }
    }
  }
  return result
}

function buildTranslations(locale: PartialTranslations, phase3Extra: unknown): Translations {
  return deepMerge(EN as Translations, withPhase3(locale, phase3Extra) as Partial<Translations>)
}

// English plural suffixes are baked into source strings as {{s}}, {{es}} and
// {{suffix}}. German and Greek cannot form plurals with a Latin -s, and the
// English -es form is wrong in French, Spanish and Portuguese. Those locales
// carry the plural form in the noun itself ("Kontrolle(n)", "έλεγχος/-οι"),
// so the suffix resolves to nothing there.
const PLURAL_VARS = new Set(['s', 'es', 'suffix'])
const DROPS_LATIN_S = new Set(['de', 'el'])

function pluralSuffix(lang: string, name: string, value: string): string {
  if (!PLURAL_VARS.has(name)) return value
  if (name === 'es') return lang === 'en' ? value : ''
  if (name === 'suffix') return DROPS_LATIN_S.has(lang) ? '' : value
  return DROPS_LATIN_S.has(lang) ? '' : value // name === 's'
}

function makeTFn(translations: Translations, lang = 'en'): TFunction {
  return (key: string, vars?: Record<string, string | number>): string => {
    const parts = key.split('.')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let node: any = translations
    for (let i = 0; i < parts.length; i++) {
      if (node == null || typeof node !== 'object') return key
      // Support namespaces that store a dotted key flat, e.g.
      // { 'card.lockedBadge': '…' } alongside nested objects.
      if (node[parts[i]] === undefined) {
        const rest = parts.slice(i).join('.')
        if (typeof node[rest] === 'string') { node = node[rest]; break }
        return key
      }
      node = node[parts[i]]
    }
    if (typeof node !== 'string') return key
    if (!vars) return node
    return node.replace(/\{\{(\w+)\}\}/g, (_, k) =>
      k in vars ? pluralSuffix(lang, k, String(vars[k])) : `{{${k}}}`)
  }
}

interface I18nContextValue {
  lang: string
  translations: Translations
  t: TFunction
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  translations: EN as Translations,
  t: makeTFn(EN as Translations, 'en'),
})

interface I18nProviderProps {
  lang: string
  children: React.ReactNode
}

export function I18nProvider({ lang, children }: I18nProviderProps) {
  const [translations, setTranslations] = useState<Translations>(EN as Translations)

  useEffect(() => {
    if (lang === 'en') {
      setTranslations(EN as Translations)
      return
    }
    const loader = LOADERS[lang]
    if (!loader) {
      setTranslations(EN as Translations)
      return
    }
    let cancelled = false
    loader()
      .then(([locale, phase3Module]) => {
        if (!cancelled) setTranslations(buildTranslations(locale.default, phase3Module.default))
      })
      .catch(() => {
        if (!cancelled) setTranslations(EN as Translations)
      })
    return () => { cancelled = true }
  }, [lang])

  const value = useMemo(
    () => ({ lang, translations, t: makeTFn(translations, lang) }),
    [lang, translations],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}

// Re-export TFunction from types for convenience
export type { TFunction }
