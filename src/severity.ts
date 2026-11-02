/**
 * Shared severity palette for the whole dashboard.
 *
 * The values are CSS custom properties defined in `index.css` for both
 * themes, so severity colours no longer drift between pages or break in
 * dark mode. Keys are uppercase; lookups are case-insensitive.
 */
export const SEVERITY_COLORS = {
  CRITICAL: 'var(--sev-critical)',
  HIGH: 'var(--sev-high)',
  MEDIUM: 'var(--sev-medium)',
  LOW: 'var(--sev-low)',
  INFO: 'var(--skip)',
} as const

export type SeverityKey = keyof typeof SEVERITY_COLORS

export function severityColor(severity: string | null | undefined): string {
  const key = (severity ?? '').toUpperCase() as SeverityKey
  return SEVERITY_COLORS[key] ?? SEVERITY_COLORS.INFO
}

/** Translucent severity background — replaces the old `${hex}22` pattern. */
export function severityBg(severity: string | null | undefined, percent = 13): string {
  return `color-mix(in srgb, ${severityColor(severity)} ${percent}%, transparent)`
}

/** Translucent severity border — replaces the old `${hex}30` pattern. */
export function severityBorder(severity: string | null | undefined, percent = 30): string {
  return `color-mix(in srgb, ${severityColor(severity)} ${percent}%, transparent)`
}

/** Shared score palette. Ink variants keep text >=4.5:1 in light mode. */
export function scoreColor(score: number): string {
  return score >= 80 ? 'var(--score-high-ink)' : score >= 60 ? 'var(--score-mid-ink)' : 'var(--score-low-ink)'
}

export function scoreBg(score: number, percent = 13): string {
  return `color-mix(in srgb, ${scoreColor(score)} ${percent}%, transparent)`
}

export function scoreBorder(score: number, percent = 30): string {
  return `color-mix(in srgb, ${scoreColor(score)} ${percent}%, transparent)`
}
