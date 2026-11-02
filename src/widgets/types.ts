/**
 * Widget catalogue for the per-user "My Dashboard" beta board.
 *
 * Only metadata lives here so both the page, the share encoder and the
 * preferences layer can validate widget types without importing React.
 */

export type WidgetType =
  | 'score-gauge'
  | 'severity-breakdown'
  | 'pillar-health'
  | 'top-controls'
  | 'score-trend'
  | 'recent-runs'
  | 'plan-changes'
  | 'control-coverage'
  | 'secrets-risk'
  | 'maturity'
  | 'compliance-readiness'
  | 'regions'
  | 'risk-hotspots'
  | 'iframe'
  | 'text'
  | 'logo'

export type WidgetSize = 'small' | 'medium' | 'large'
export type WidgetGroup = 'posture' | 'trends' | 'governance' | 'insights' | 'content'

/** User-authored content for the configurable widgets. */
export interface WidgetConfig {
  /** Plain text body (text widget). */
  text?: string
  /** Embed URL (iframe widget). */
  url?: string
  /** Accessible title for the iframe / alt text for the logo. */
  title?: string
  /** Image source — http(s) URL or an image data URL (logo widget). */
  src?: string
  /** Alt text for the logo. */
  alt?: string
}

export interface DashboardWidget {
  /** Per-user instance id. Type alone is not unique because the same widget can be added again later. */
  id: string
  type: WidgetType
  size: WidgetSize
  /** Content for iframe/text/logo widgets. */
  config?: WidgetConfig
}

export interface DashboardWidgetMeta {
  type: WidgetType
  group: WidgetGroup
  icon: string
  defaultSize: WidgetSize
  titleKey: string
  descriptionKey: string
}

function meta(
  type: WidgetType,
  group: WidgetGroup,
  icon: string,
  defaultSize: WidgetSize,
): DashboardWidgetMeta {
  return {
    type,
    group,
    icon,
    defaultSize,
    titleKey: `pages.myDashboard.widgets.${type.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())}.title`,
    descriptionKey: `pages.myDashboard.widgets.${type.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())}.desc`,
  }
}

export const WIDGET_META: DashboardWidgetMeta[] = [
  meta('score-gauge', 'posture', 'M12 21a9 9 0 100-18 9 9 0 000 18z M12 12l4-4', 'small'),
  meta('severity-breakdown', 'posture', 'M3 3v18h18 M7 16v-5 M12 16V8 M17 16v-8', 'medium'),
  meta('pillar-health', 'posture', 'M4 20V10 M9 20V4 M14 20v-8 M19 20V7', 'large'),
  meta('top-controls', 'posture', 'M4 6h16 M4 12h10 M4 18h7', 'medium'),
  meta('score-trend', 'trends', 'M3 17l6-6 4 4 7-8 M21 7v5h-5', 'large'),
  meta('recent-runs', 'trends', 'M12 8v5l3 2 M21 12a9 9 0 11-18 0 9 9 0 0118 0z', 'medium'),
  meta('plan-changes', 'trends', 'M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5', 'small'),
  meta('control-coverage', 'governance', 'M9 12l2 2 4-4 M21 12a9 9 0 11-18 0 9 9 0 0118 0z', 'medium'),
  meta('secrets-risk', 'governance', 'M7 11V7a5 5 0 0110 0v4 M5 11h14v10H5z', 'small'),
  meta('maturity', 'governance', 'M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z', 'medium'),
  meta('compliance-readiness', 'insights', 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4', 'medium'),
  meta('regions', 'insights', 'M12 21a9 9 0 100-18 9 9 0 000 18z M3 12h18 M12 3a15 15 0 010 18 M12 3a15 15 0 000 18', 'small'),
  meta('risk-hotspots', 'insights', 'M12 22c4 0 6-3 6-7 0-5-6-9-6-9s-6 4-6 9c0 4 2 7 6 7z', 'medium'),
  meta('iframe', 'content', 'M3 5h18v14H3z M3 9h18', 'large'),
  meta('text', 'content', 'M4 6h16 M4 12h16 M4 18h10', 'medium'),
  meta('logo', 'content', 'M3 5h18v14H3z M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z M21 15l-5-5L5 21', 'small'),
]

export const WIDGET_TYPES = new Set<WidgetType>(WIDGET_META.map(widget => widget.type))
export const WIDGET_SIZES: WidgetSize[] = ['small', 'medium', 'large']

export const CONFIGURABLE_TYPES = new Set<WidgetType>(['iframe', 'text', 'logo'])

export function isConfigurable(type: WidgetType): boolean {
  return CONFIGURABLE_TYPES.has(type)
}

const MAX_TEXT = 2000
const MAX_URL = 600
const MAX_TITLE = 100
const MAX_IMAGE_DATA = 250_000

function httpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  try {
    const parsed = new URL(value.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString().slice(0, MAX_URL) : undefined
  } catch {
    return undefined
  }
}

function imageSource(value: unknown, allowData: boolean): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (allowData && /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(trimmed)) {
    return trimmed.length <= MAX_IMAGE_DATA ? trimmed : undefined
  }
  return httpUrl(trimmed)
}

/**
 * Keep only the fields that belong to the widget type and clamp their size.
 * `allowData` is false when encoding a share link: uploaded logos would make
 * the URL impractically long, so sharing keeps remote image URLs only.
 */
export function sanitizeConfig(type: WidgetType, config: WidgetConfig | undefined, allowData = true): WidgetConfig | undefined {
  if (!config) return undefined
  if (type === 'text') {
    const text = typeof config.text === 'string' ? config.text.slice(0, MAX_TEXT) : undefined
    return text === undefined ? undefined : { text }
  }
  if (type === 'iframe') {
    const url = httpUrl(config.url)
    const title = typeof config.title === 'string' ? config.title.slice(0, MAX_TITLE) : undefined
    return url ? { url, ...(title ? { title } : {}) } : undefined
  }
  if (type === 'logo') {
    const src = imageSource(config.src, allowData)
    const alt = typeof config.alt === 'string' ? config.alt.slice(0, MAX_TITLE) : undefined
    return src ? { src, ...(alt ? { alt } : {}) } : undefined
  }
  return undefined
}

export function widgetMeta(type: WidgetType): DashboardWidgetMeta {
  return WIDGET_META.find(widget => widget.type === type) ?? WIDGET_META[0]
}

/** Fresh instance ids so shared layouts never collide with local ones. */
export function makeWidgetId(): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  return `wdg-${random}`
}

/**
 * The board a user sees before customising anything: the ten widgets the
 * first release recommends. The remaining three catalogue entries are one
 * click away in the picker.
 */
export const INITIAL_DASHBOARD_WIDGETS: DashboardWidget[] = [
  { id: 'default-score-gauge', type: 'score-gauge', size: 'small' },
  { id: 'default-severity-breakdown', type: 'severity-breakdown', size: 'medium' },
  { id: 'default-pillar-health', type: 'pillar-health', size: 'large' },
  { id: 'default-top-controls', type: 'top-controls', size: 'medium' },
  { id: 'default-score-trend', type: 'score-trend', size: 'large' },
  { id: 'default-recent-runs', type: 'recent-runs', size: 'medium' },
  { id: 'default-plan-changes', type: 'plan-changes', size: 'small' },
  { id: 'default-control-coverage', type: 'control-coverage', size: 'medium' },
  { id: 'default-secrets-risk', type: 'secrets-risk', size: 'small' },
  { id: 'default-compliance-readiness', type: 'compliance-readiness', size: 'medium' },
]

export function cloneDashboardWidgets(widgets: DashboardWidget[]): DashboardWidget[] {
  return widgets.map(widget => ({ ...widget, ...(widget.config ? { config: { ...widget.config } } : {}) }))
}
