import React, { createContext, useContext, useMemo } from 'react'
import type { Translations, PartialTranslations } from './types'
import en from './locales/en'
import de from './locales/de'
import fr from './locales/fr'
import es from './locales/es'
import pt from './locales/pt'
import br from './locales/br'

export const LOCALES: Record<string, PartialTranslations> = { en, de, fr, es, pt, br }

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

function buildTranslations(langCode: string): Translations {
  const locale = LOCALES[langCode]
  if (!locale || langCode === 'en') return en as Translations
  return deepMerge(en as Translations, locale as Partial<Translations>)
}

type TFunction = (key: string, vars?: Record<string, string | number>) => string

function makeTFn(translations: Translations): TFunction {
  return (key: string, vars?: Record<string, string | number>): string => {
    const parts = key.split('.')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let node: any = translations
    for (const part of parts) {
      if (node == null || typeof node !== 'object') return key
      node = node[part]
    }
    if (typeof node !== 'string') return key
    if (!vars) return node
    return node.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? `{{${k}}}`))
  }
}

interface I18nContextValue {
  lang: string
  translations: Translations
  t: TFunction
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  translations: en as Translations,
  t: makeTFn(en as Translations),
})

interface I18nProviderProps {
  lang: string
  children: React.ReactNode
}

export function I18nProvider({ lang, children }: I18nProviderProps) {
  const value = useMemo(() => {
    const translations = buildTranslations(lang)
    return { lang, translations, t: makeTFn(translations) }
  }, [lang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}
