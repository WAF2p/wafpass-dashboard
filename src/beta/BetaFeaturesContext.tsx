import { createContext, useContext, type ReactNode } from 'react'
import {
  isBetaFeatureEnabled,
  type BetaFeatureId,
  type UserPreferences,
} from '../pages/userPrefsUtils'

interface BetaFeaturesValue {
  prefs: UserPreferences
  isEnabled: (id: BetaFeatureId) => boolean
  update: (partial: Partial<UserPreferences>) => void
}

const BetaFeaturesContext = createContext<BetaFeaturesValue | null>(null)

export function BetaFeaturesProvider({
  prefs,
  onChange,
  children,
}: {
  prefs: UserPreferences
  onChange: (prefs: UserPreferences) => void
  children: ReactNode
}) {
  const value: BetaFeaturesValue = {
    prefs,
    isEnabled: id => isBetaFeatureEnabled(prefs, id),
    update: partial => onChange({ ...prefs, ...partial }),
  }
  return <BetaFeaturesContext.Provider value={value}>{children}</BetaFeaturesContext.Provider>
}

export function useBetaFeatures(): BetaFeaturesValue {
  const value = useContext(BetaFeaturesContext)
  if (!value) throw new Error('useBetaFeatures must be used inside BetaFeaturesProvider')
  return value
}
