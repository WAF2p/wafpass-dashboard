export const PILLARS: { key: string; label: string; color: string }[] = [
  { key: 'security', label: 'Security', color: 'var(--fail)' },
  { key: 'cost', label: 'Cost', color: 'var(--waf-brand)' },
  { key: 'operations', label: 'Operations', color: 'var(--waived)' },
  { key: 'performance', label: 'Performance', color: 'var(--waf-warn)' },
  { key: 'reliability', label: 'Reliability', color: 'var(--pass)' },
  { key: 'sovereign', label: 'Sovereignty', color: 'var(--waf-warn)' },
  { key: 'sustainability', label: 'Sustainability', color: 'var(--score-high)' },
  { key: 'agentic', label: 'Agentic', color: 'var(--waived)' },
]

export function pillarScore(scores: Record<string, number> | undefined, key: string): number | null {
  if (!scores) return null
  const direct = scores[key]
  if (direct !== undefined) return direct
  if (key === 'operations' && scores.operational !== undefined) return scores.operational
  return null
}
