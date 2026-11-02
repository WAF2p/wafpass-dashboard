import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Finding } from '../api'

interface FindingsTriageProps {
  findings: Finding[]
  startIndex?: number
  onClose: () => void
  onWaive: (finding: Finding) => void
  onFix: (finding: Finding) => void
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: 'var(--fail)', HIGH: 'var(--orange, #f97316)', MEDIUM: 'var(--score-mid)', LOW: 'var(--pass)',
}
const STATUS_COLOR: Record<string, string> = {
  FAIL: 'var(--fail)', PASS: 'var(--pass)', SKIP: 'var(--waived)', WAIVED: 'var(--waf-brand)',
}

/** Full-screen, keyboard-first review of the current Findings view. */
export default function FindingsTriage({ findings, startIndex = 0, onClose, onWaive, onFix }: FindingsTriageProps) {
  const [index, setIndex] = useState(() => Math.min(Math.max(0, startIndex), Math.max(0, findings.length - 1)))
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = previousOverflow
      previous?.focus?.()
    }
  }, [])

  useEffect(() => {
    if (index > findings.length - 1) setIndex(Math.max(0, findings.length - 1))
  }, [findings.length, index])

  const current = findings[index]
  const total = findings.length

  function step(delta: number) {
    setIndex(value => Math.min(Math.max(0, value + delta), Math.max(0, total - 1)))
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current() }
      else if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'j') { event.preventDefault(); step(1) }
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'k') { event.preventDefault(); step(-1) }
      else if ((event.key === 'w' || event.key === 'W') && current) { event.preventDefault(); onWaive(current) }
      else if ((event.key === 'f' || event.key === 'F') && current) { event.preventDefault(); onFix(current) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [current, onWaive, onFix, total])

  return createPortal(
    <div className="triage-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="triage-panel" role="dialog" aria-modal="true" aria-label="Findings triage">
        <div className="triage-head">
          <div>
            <div className="triage-kicker">Findings triage</div>
            <div className="triage-progress-text">{total > 0 ? `${index + 1} of ${total}` : 'No findings in this view'}</div>
          </div>
          <div className="triage-head-actions">
            <span className="triage-kbd-hint"><kbd>w</kbd> waive · <kbd>f</kbd> fix · <kbd>←</kbd><kbd>→</kbd> move</span>
            <button ref={closeRef} type="button" className="triage-close" aria-label="Close triage" onClick={onClose}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="triage-progress" aria-hidden="true">
          <span style={{ width: total > 0 ? `${((index + 1) / total) * 100}%` : '0%' }} />
        </div>

        {!current ? (
          <div className="triage-empty">
            Nothing to triage in the current filter. Adjust the filters in Findings and reopen triage.
          </div>
        ) : (
          <>
            <div className="triage-body">
              <div className="triage-main">
                <div className="triage-badges">
                  <span className="triage-pill" style={{ color: SEV_COLOR[current.severity?.toUpperCase()] ?? 'var(--muted)', background: `color-mix(in srgb, ${SEV_COLOR[current.severity?.toUpperCase()] ?? 'var(--muted)'} 12%, transparent)` }}>
                    {current.severity?.toUpperCase()}
                  </span>
                  <span className="triage-pill" style={{ color: STATUS_COLOR[current.status?.toUpperCase()] ?? 'var(--muted)', background: `color-mix(in srgb, ${STATUS_COLOR[current.status?.toUpperCase()] ?? 'var(--muted)'} 12%, transparent)` }}>
                    {current.status?.toUpperCase()}
                  </span>
                  {current.pillar && <span className="triage-pill is-neutral">{current.pillar}</span>}
                </div>

                <div className="triage-control-id">{current.check_id}</div>
                <h2 className="triage-title">{current.check_title}</h2>
                <div className="triage-resource">{current.resource || '(no resource)'}</div>

                <p className="triage-message">{current.message || 'No finding message was recorded for this check.'}</p>

                {current.remediation && (
                  <div className="triage-remediation">
                    <div className="triage-remediation-label">Remediation</div>
                    <p>{current.remediation.replace(/\\n/g, ' ').trim()}</p>
                  </div>
                )}
              </div>

              <aside className="triage-side">
                <div className="triage-side-row"><span>Control</span><strong>{current.control_id || '—'}</strong></div>
                <div className="triage-side-row"><span>Pillar</span><strong>{current.pillar || '—'}</strong></div>
                <div className="triage-side-row"><span>Resource</span><strong title={current.resource}>{current.resource || '—'}</strong></div>
                <div className="triage-side-row"><span>Comments</span><strong>{current.comment_count ?? 0}</strong></div>
                {current.regulatory_mapping?.length > 0 && (
                  <div className="triage-mappings">
                    <div className="triage-remediation-label">Frameworks</div>
                    <div className="triage-fw-list">
                      {current.regulatory_mapping.map(mapping => (
                        <span key={mapping.framework} className="triage-fw">{mapping.framework}</span>
                      ))}
                    </div>
                  </div>
                )}
              </aside>
            </div>

            <div className="triage-foot">
              <button type="button" className="triage-btn" onClick={() => step(-1)} disabled={index === 0}>
                ← Previous
              </button>
              <div className="triage-foot-main">
                <button type="button" className="triage-btn is-waive" onClick={() => onWaive(current)}>
                  Waive control <kbd>w</kbd>
                </button>
                <button type="button" className="triage-btn is-primary" onClick={() => onFix(current)}>
                  Open Auto-Fix <kbd>f</kbd>
                </button>
              </div>
              <button type="button" className="triage-btn" onClick={() => step(1)} disabled={index >= total - 1}>
                Next →
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
