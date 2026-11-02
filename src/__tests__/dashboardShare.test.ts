import { describe, expect, it } from 'vitest'
import { decodeDashboard, encodeDashboard } from '../widgets/share'
import { INITIAL_DASHBOARD_WIDGETS } from '../widgets/types'

function rawPayload(payload: unknown): string {
  return btoa(JSON.stringify(payload))
}

describe('dashboard share payloads', () => {
  it('round-trips the recommended layout', () => {
    const encoded = encodeDashboard('Security board', INITIAL_DASHBOARD_WIDGETS)
    const decoded = decodeDashboard(encoded)
    expect(decoded).not.toBeNull()
    expect(decoded?.name).toBe('Security board')
    expect(decoded?.widgets.map(widget => [widget.type, widget.size])).toEqual(
      INITIAL_DASHBOARD_WIDGETS.map(widget => [widget.type, widget.size]),
    )
  })

  it('regenerates instance ids so imports never collide', () => {
    const decoded = decodeDashboard(encodeDashboard('Board', INITIAL_DASHBOARD_WIDGETS))
    expect(decoded?.widgets[0].id).not.toBe(INITIAL_DASHBOARD_WIDGETS[0].id)
    expect(new Set(decoded?.widgets.map(widget => widget.id)).size).toBe(decoded?.widgets.length)
  })

  it('rejects malformed or empty payloads', () => {
    expect(decodeDashboard('not-base64')).toBeNull()
    expect(decodeDashboard(rawPayload({ v: 2, w: [['score-gauge', 'small']] }))).toBeNull()
    expect(decodeDashboard(rawPayload({ v: 1, w: [] }))).toBeNull()
    expect(decodeDashboard(rawPayload({ v: 1, w: [['unknown-widget', 'small']] }))).toBeNull()
  })

  it('round-trips text and iframe content', () => {
    const decoded = decodeDashboard(encodeDashboard('Board', [
      { id: 'a', type: 'text', size: 'medium', config: { text: 'Hello\nworld' } },
      { id: 'b', type: 'iframe', size: 'large', config: { url: 'https://example.com/dash', title: 'Status' } },
    ]))
    expect(decoded?.widgets[0].config?.text).toBe('Hello\nworld')
    expect(decoded?.widgets[1].config).toEqual({ url: 'https://example.com/dash', title: 'Status' })
  })

  it('rejects unsafe embed URLs and excludes uploaded logos from share links', () => {
    const decoded = decodeDashboard(encodeDashboard('Board', [
      { id: 'a', type: 'iframe', size: 'large', config: { url: 'javascript:alert(1)' } },
      { id: 'b', type: 'logo', size: 'small', config: { src: 'data:image/png;base64,iVBORw0KGgo=', alt: 'Team' } },
    ]))
    expect(decoded?.widgets[0].config).toBeUndefined()
    expect(decoded?.widgets[1].config).toBeUndefined()
  })

  it('keeps valid widgets and drops unknown types or sizes', () => {
    const decoded = decodeDashboard(rawPayload({
      v: 1,
      n: 'Shared',
      w: [
        ['score-gauge', 'small'],
        ['unknown-widget', 'small'],
        ['pillar-health', 'huge'],
        ['recent-runs', 'large'],
      ],
    }))
    expect(decoded?.widgets.map(widget => widget.type)).toEqual(['score-gauge', 'recent-runs'])
  })
})
