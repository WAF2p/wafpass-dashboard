/**
 * One-time migration of WAFpass-era browser storage.
 *
 * localStorage keys were prefixed ``wafpass_`` before the WAF++ → Wombat
 * rebrand. New code reads ``wombat_*``; copy any existing legacy values across
 * once so users keep their session, preferences and cached data. Legacy keys
 * are left in place, so downgrading to an older build still works.
 */
const LEGACY_PREFIX = 'wafpass_'
const NEW_PREFIX = 'wombat_'

export function migrateLegacyStorage(): void {
  try {
    const legacyKeys: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key && key.startsWith(LEGACY_PREFIX)) legacyKeys.push(key)
    }

    for (const key of legacyKeys) {
      const newKey = NEW_PREFIX + key.slice(LEGACY_PREFIX.length)
      const value = localStorage.getItem(key)
      if (value !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, value)
      }
    }
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). The app
    // falls back to in-memory defaults, so nothing else is required here.
  }
}
