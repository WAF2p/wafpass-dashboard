import type { Page } from '../routing'
import type { PersonaHomeId } from './userPrefsUtils'

export interface PersonaPreset {
  id: PersonaHomeId
  page: Page
  /** KPI block ids on that page, in the order the preset shows them. */
  kpiOrder: string[]
}

export const PERSONA_PRESETS: Record<PersonaHomeId, PersonaPreset> = {
  ciso: {
    id: 'ciso',
    page: 'compliance',
    kpiOrder: ['critical', 'failed', 'passing', 'frameworks'],
  },
  architect: {
    id: 'architect',
    page: 'architecture',
    kpiOrder: ['attackPaths', 'criticalFindings', 'failingModules', 'controls'],
  },
  engineer: {
    id: 'engineer',
    page: 'engineering',
    kpiOrder: ['openFindings', 'secretHits', 'planChanges', 'sprintGain'],
  },
}

export function getPersonaPreset(id: PersonaHomeId | ''): PersonaPreset | null {
  return id ? PERSONA_PRESETS[id] ?? null : null
}

/** Human-readable KPI block names used by the Beta Features preview. */
export const PERSONA_KPI_LABELS: Record<string, string> = {
  passing: 'Passing checks',
  failed: 'Failed checks',
  critical: 'Critical findings',
  frameworks: 'Frameworks tracked',
  controls: 'Controls loaded',
  failingModules: 'Failing modules',
  criticalFindings: 'Critical findings',
  attackPaths: 'Attack paths',
  sandboxDrafts: 'Sandbox drafts',
  openFindings: 'Open findings',
  secretHits: 'Secret hits',
  planChanges: 'Plan changes',
  sprintGain: 'Sprint gain',
  mttr: 'MTTR',
}
