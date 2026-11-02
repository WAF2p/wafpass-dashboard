import {
  makeWidgetId,
  sanitizeConfig,
  WIDGET_SIZES,
  WIDGET_TYPES,
  type DashboardWidget,
  type WidgetSize,
  type WidgetType,
} from './types'

export interface SharedDashboard {
  name: string
  widgets: DashboardWidget[]
}

const VERSION = 1
const MAX_WIDGETS = 40
const MAX_NAME = 80

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

/** Encode only layout data — never run content, filters or user identity. */
export function encodeDashboard(name: string, widgets: DashboardWidget[]): string {
  const payload = {
    v: VERSION,
    n: name.slice(0, MAX_NAME),
    w: widgets.slice(0, MAX_WIDGETS).map(widget => {
      // Uploaded logos are data URLs and would bloat the link; share only
      // remote image URLs. Text and iframe content are included.
      const config = sanitizeConfig(widget.type, widget.config, false)
      return config ? [widget.type, widget.size, config] : [widget.type, widget.size]
    }),
  }
  return toBase64Url(JSON.stringify(payload))
}

/**
 * Decode a share payload defensively. Anything that does not match the
 * catalogue is dropped; a payload with no valid widgets is rejected.
 */
export function decodeDashboard(raw: string): SharedDashboard | null {
  try {
    const parsed = JSON.parse(fromBase64Url(raw)) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const payload = parsed as { v?: unknown; n?: unknown; w?: unknown }
    if (payload.v !== VERSION || !Array.isArray(payload.w)) return null

    const widgets: DashboardWidget[] = []
    for (const entry of payload.w.slice(0, MAX_WIDGETS)) {
      if (!Array.isArray(entry) || entry.length < 2) continue
      const [type, size] = entry
      if (typeof type !== 'string' || !WIDGET_TYPES.has(type as WidgetType)) continue
      if (typeof size !== 'string' || !WIDGET_SIZES.includes(size as WidgetSize)) continue
      const config = sanitizeConfig(type as WidgetType, entry[2] as Record<string, unknown> | undefined, false)
      widgets.push({ id: makeWidgetId(), type: type as WidgetType, size: size as WidgetSize, ...(config ? { config } : {}) })
    }

    if (widgets.length === 0) return null
    const name = typeof payload.n === 'string' && payload.n.trim() ? payload.n.trim().slice(0, MAX_NAME) : ''
    return { name, widgets }
  } catch {
    return null
  }
}

export function buildShareUrl(name: string, widgets: DashboardWidget[]): string {
  const payload = encodeDashboard(name, widgets)
  return `${window.location.origin}${window.location.pathname}#/mydashboard?share=${payload}`
}
