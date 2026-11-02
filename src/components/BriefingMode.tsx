import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { RunDetail } from '../api'
import { PILLARS, pillarScore } from '../pillars'
import NineDotIcon from './NineDotIcon'
import { scoreColor as scoreColorToken } from '../severity';

interface BriefingModeProps {
  run: RunDetail
  onClose: () => void
}

const SEV_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

export default function BriefingMode({ run, onClose }: BriefingModeProps) {
  const [slide, setSlide] = useState(0)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const failed = run.findings.filter(f => f.status?.toUpperCase() === 'FAIL')
  const critical = failed.filter(f => f.severity?.toUpperCase() === 'CRITICAL').length
  const high = failed.filter(f => f.severity?.toUpperCase() === 'HIGH').length

  const topControls = (() => {
    const map = new Map<string, { id: string; title: string; count: number; severity: string }>()
    for (const finding of failed) {
      const entry = map.get(finding.control_id) ?? {
        id: finding.control_id,
        title: finding.check_title,
        count: 0,
        severity: finding.severity?.toUpperCase() ?? 'LOW',
      }
      entry.count += 1
      if ((SEV_ORDER[finding.severity?.toUpperCase()] ?? 9) < (SEV_ORDER[entry.severity] ?? 9)) entry.severity = finding.severity?.toUpperCase() ?? 'LOW'
      map.set(finding.control_id, entry)
    }
    return [...map.values()]
      .sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9) || b.count - a.count)
      .slice(0, 5)
  })()

  const slides = [
    { key: 'cover', label: 'Posture' },
    { key: 'pillars', label: 'Pillars' },
    { key: 'findings', label: 'Findings' },
    { key: 'priorities', label: 'Priorities' },
  ]
  const total = slides.length

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current() }
      else if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'PageDown') { event.preventDefault(); setSlide(v => Math.min(total - 1, v + 1)) }
      else if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); setSlide(v => Math.max(0, v - 1)) }
      else if (event.key === 'Home') { event.preventDefault(); setSlide(0) }
      else if (event.key === 'End') { event.preventDefault(); setSlide(total - 1) }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      previous?.focus?.()
    }
  }, [total])

  const scoreLabel = run.score >= 80 ? 'Strong posture' : run.score >= 60 ? 'Needs focused work' : 'High risk'
  const scoreColor = scoreColorToken(run.score)

  return createPortal(
    <div className="briefing-root" role="dialog" aria-modal="true" aria-label="Briefing mode">
      <div className="briefing-topbar">
        <div className="briefing-brand"><NineDotIcon size={18} /><span>WOMBATpass</span><span className="briefing-brand-sep">/</span><span>Briefing</span></div>
        <div className="briefing-top-actions">
          <span className="briefing-count">{slide + 1} / {total}</span>
          <button ref={closeRef} type="button" className="briefing-close" onClick={onClose} aria-label="Exit briefing">
            <svg width="17" height="17" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="briefing-stage">
        {slide === 0 && (
          <div className="briefing-slide briefing-cover">
            <div className="briefing-eyebrow">Infrastructure briefing · {new Date(run.created_at).toLocaleDateString()}</div>
            <h1>{run.project || 'Unnamed project'}</h1>
            <div className="briefing-meta">{run.branch || 'no branch'} · {run.iac_framework} · {run.controls_loaded} controls loaded</div>
            <div className="briefing-score-row">
              <div className="briefing-score" style={{ color: scoreColor }}>{run.score}<span>/100</span></div>
              <div className="briefing-score-copy">
                <strong style={{ color: scoreColor }}>{scoreLabel}</strong>
                <span>{failed.length} failed controls · {critical} critical · {high} high</span>
              </div>
            </div>
          </div>
        )}

        {slide === 1 && (
          <div className="briefing-slide">
            <div className="briefing-eyebrow">Pillar health</div>
            <h2>Where the posture stands</h2>
            <div className="briefing-pillars">
              {PILLARS.map(pillar => {
                const value = pillarScore(run.pillar_scores, pillar.key)
                return (
                  <div className="briefing-pillar" key={pillar.key}>
                    <span className="briefing-pillar-label">{pillar.label}</span>
                    <div className="briefing-pillar-track">
                      <span style={{ width: `${value ?? 0}%`, background: pillar.color }} />
                    </div>
                    <span className="briefing-pillar-value">{value ?? '—'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {slide === 2 && (
          <div className="briefing-slide">
            <div className="briefing-eyebrow">Findings</div>
            <h2>{failed.length} controls need attention</h2>
            <div className="briefing-kpis">
              <div><strong style={{ color: '#ef4444' }}>{failed.length}</strong><span>Failed controls</span></div>
              <div><strong style={{ color: '#f97316' }}>{critical + high}</strong><span>Critical + high</span></div>
              <div><strong style={{ color: '#eab308' }}>{new Set(failed.map(f => f.resource).filter(Boolean)).size}</strong><span>Resources at risk</span></div>
              <div><strong style={{ color: '#0094ff' }}>{new Set(failed.map(f => f.control_id)).size}</strong><span>Distinct controls</span></div>
            </div>
            <div className="briefing-list">
              {topControls.map(control => (
                <div className="briefing-list-row" key={control.id}>
                  <span className="briefing-sev" style={{ color: control.severity === 'CRITICAL' ? '#ef4444' : '#f97316' }}>{control.severity}</span>
                  <span className="briefing-list-id">{control.id}</span>
                  <span className="briefing-list-title">{control.title}</span>
                  <span className="briefing-list-count">{control.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {slide === 3 && (
          <div className="briefing-slide">
            <div className="briefing-eyebrow">Priorities</div>
            <h2>What to fix first</h2>
            <div className="briefing-priorities">
              {topControls.slice(0, 3).map((control, i) => (
                <div className="briefing-priority" key={control.id}>
                  <span className="briefing-priority-index">{i + 1}</span>
                  <div>
                    <div className="briefing-priority-title">{control.title}</div>
                    <div className="briefing-priority-meta">{control.id} · {control.count} finding{control.count === 1 ? '' : 's'} · {control.severity}</div>
                  </div>
                </div>
              ))}
              {topControls.length === 0 && <div className="briefing-empty">No failing controls in this run.</div>}
            </div>
            <div className="briefing-closing">Re-run the scan after remediation to measure the delta.</div>
          </div>
        )}
      </div>

      <div className="briefing-foot">
        <div className="briefing-dots" role="tablist" aria-label="Briefing slides">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={i === slide}
              aria-label={s.label}
              className={`briefing-dot${i === slide ? ' is-active' : ''}`}
              onClick={() => setSlide(i)}
            />
          ))}
        </div>
        <div className="briefing-nav">
          <button type="button" onClick={() => setSlide(v => Math.max(0, v - 1))} disabled={slide === 0}>←</button>
          <span>Arrow keys to move · Esc to exit</span>
          <button type="button" onClick={() => setSlide(v => Math.min(total - 1, v + 1))} disabled={slide === total - 1}>→</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
