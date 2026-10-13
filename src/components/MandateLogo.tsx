/**
 * MandateLogo — large logo tile with a generated monogram fallback.
 *
 * Shared between MandateManagementPage.tsx's card grid and
 * MandateEditModal.tsx's Branding tab (Phase 6a) — the current table had no
 * fallback at all for a mandate without a logo_url, a real gap for any
 * mandate that hasn't set one yet.
 */
import { useState } from 'react'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function colorForName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 55%, 42%)`
}

export default function MandateLogo({ name, logoUrl, size = 64 }: { name: string; logoUrl: string; size?: number }) {
  const [errored, setErrored] = useState(false)
  const radius = Math.round(size * 0.22)

  if (logoUrl && !errored) {
    // A white backdrop + object-fit: contain (not cover): most uploaded
    // brand logos are wide wordmarks or have a transparent background
    // designed against white, not square photos — `cover` was cropping a
    // wide logo down to just its center slice, and a transparent/dark-text
    // logo needs a light background to stay legible regardless of the
    // dashboard's own light/dark theme.
    return (
      <div style={{
        width: size, height: size, borderRadius: radius, flexShrink: 0,
        background: '#fff', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: Math.max(4, Math.round(size * 0.12)), boxSizing: 'border-box', overflow: 'hidden',
      }}>
        <img
          src={logoUrl}
          alt=""
          onError={() => setErrored(true)}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
    )
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.22),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: colorForName(name || '?'), color: '#fff', fontWeight: 800,
      fontSize: Math.round(size * 0.34), flexShrink: 0, userSelect: 'none',
    }}>
      {initials(name)}
    </div>
  )
}
