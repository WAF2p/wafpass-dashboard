import { MATURITY_META } from './settingsUtils'

export interface JourneyStage {
  idx: number
  icon: string
  label: string
  shortLabel: string
  range: string
  min: number
  max: number
  color: string
  maturityLevel: number
  maturityLabel: string
}

export const JOURNEY_STAGES: JourneyStage[] = [
  { idx: 0, icon: '🏗', label: 'Hangar',           shortLabel: 'Hangar',     range: '0–19',   min: 0,  max: 19,  color: '#DA2C38', maturityLevel: 0, maturityLabel: 'Grounded' },
  { idx: 1, icon: '🔍', label: 'Pre-Flight',        shortLabel: 'Pre-Flight', range: '20–39',  min: 20, max: 39,  color: '#f97316', maturityLevel: 1, maturityLabel: 'Foundational' },
  { idx: 2, icon: '🚀', label: 'Boarding & Taxi',   shortLabel: 'Boarding',   range: '40–59',  min: 40, max: 59,  color: '#eab308', maturityLevel: 2, maturityLabel: 'Operational' },
  { idx: 3, icon: '✈',  label: 'Takeoff Roll',      shortLabel: 'Takeoff',    range: '60–74',  min: 60, max: 74,  color: '#0094FF', maturityLevel: 3, maturityLabel: 'Governed' },
  { idx: 4, icon: '🛫', label: 'Cruise Altitude',   shortLabel: 'Cruise',     range: '75–89',  min: 75, max: 89,  color: '#8b5cf6', maturityLevel: 4, maturityLabel: 'Optimized' },
  { idx: 5, icon: '🏁', label: 'Final Approach',    shortLabel: 'Final',      range: '90–100', min: 90, max: 100, color: '#059669', maturityLevel: 5, maturityLabel: 'Excellence' },
]

export function stageFor(score: number): JourneyStage {
  const s = Math.max(0, Math.min(100, score))
  return JOURNEY_STAGES.find(st => s >= st.min && s <= st.max) ?? JOURNEY_STAGES[0]
}

export function nextStage(score: number): JourneyStage | null {
  const current = stageFor(score)
  return JOURNEY_STAGES[current.idx + 1] ?? null
}

export function progressWithinStage(score: number): number {
  const st = stageFor(score)
  const span = st.max - st.min
  if (span <= 0) return 1
  return Math.min(1, Math.max(0, (score - st.min) / span))
}

export function pointsToNextStage(score: number): number {
  const next = nextStage(score)
  if (!next) return 0
  return Math.max(0, next.min - score)
}

export function maturityMetaForStage(stageIdx: number) {
  const level = JOURNEY_STAGES[stageIdx]?.maturityLevel ?? 1
  return MATURITY_META.find(m => m.level === Math.max(1, level)) ?? MATURITY_META[0]
}

export function aggregateScore(runs: { score: number }[]): number {
  if (!runs.length) return 0
  return Math.round(runs.reduce((sum, r) => sum + r.score, 0) / runs.length)
}

export function latestRunByProject(runs: import('../api').RunSummary[]): Record<string, import('../api').RunSummary> {
  const latest: Record<string, import('../api').RunSummary> = {}
  for (const r of runs) {
    const p = r.project || '(unnamed)'
    if (!latest[p] || new Date(r.created_at) > new Date(latest[p].created_at)) {
      latest[p] = r
    }
  }
  return latest
}

export function runsForProject(runs: import('../api').RunSummary[], project: string): import('../api').RunSummary[] {
  return [...runs.filter(r => (r.project || '(unnamed)') === project)]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
}

export function companyTrend(runs: import('../api').RunSummary[]): { date: string; score: number }[] {
  if (!runs.length) return []

  // Track the company average over time: for each date with activity, use the
  // latest run per project up to that date. This reflects real portfolio maturity
  // progression instead of noisy daily run averages.
  const sorted = [...runs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const latestByProject: Record<string, import('../api').RunSummary> = {}
  const points: { date: string; score: number }[] = []
  let lastDate: string | null = null

  for (const r of sorted) {
    const day = r.created_at.slice(0, 10)
    const p = r.project || '(unnamed)'
    const current = latestByProject[p]
    if (!current || new Date(r.created_at) > new Date(current.created_at)) {
      latestByProject[p] = r
    }
    if (day !== lastDate) {
      const values = Object.values(latestByProject).map(run => run.score)
      const score = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0
      points.push({ date: day, score })
      lastDate = day
    } else {
      // Same day: update the last point in case this later run on the same day improves the average
      const values = Object.values(latestByProject).map(run => run.score)
      points[points.length - 1].score = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0
    }
  }

  return points
}
