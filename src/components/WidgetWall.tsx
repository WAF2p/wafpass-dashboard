import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { RunDetail, RunSummary } from '../api'
import { PILLARS, pillarScore } from '../pillars'
import NineDotIcon from './NineDotIcon'
import { scoreColor as scoreColorToken } from '../severity';

interface WidgetWallProps {
  run: RunDetail
  runs: RunSummary[]
  onClose: () => void
}

const SEV_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
const SLIDE_MS = 12000

export default function WidgetWall({ run, runs, onClose }: WidgetWallProps) {
  const [slide, setSlide] = useState(0)
  const [playing, setPlaying] = useState(() => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const [clock, setClock] = useState(() => new Date())
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const failed = run.findings.filter(f => f.status?.toUpperCase() === 'FAIL')
  const critical = failed.filter(f => f.severity?.toUpperCase() === 'CRITICAL').length
  const high = failed.filter(f => f.severity?.toUpperCase() === 'HIGH').length
  const resources = new Set(failed.map(f => f.resource).filter(Boolean)).size
  const secretHits = run.secret_findings?.length ?? 0
  const plan = run.plan_changes?.summary
  const planTotal = plan ? (plan.add ?? 0) + (plan.change ?? 0) + (plan.destroy ?? 0) + (plan.replace ?? 0) : 0

  const topControls = useMemo(() => {
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
      .slice(0, 6)
  }, [run])

  const recentRuns = useMemo(
    () => [...runs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 6),
    [runs],
  )

  const slides = ['Posture', 'Pillars', 'Controls', 'Risk', 'Recent runs']
  const total = slides.length

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current() }
      else if (event.key === 'ArrowRight') { event.preventDefault(); setSlide(v => (v + 1) % total) }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); setSlide(v => (v - 1 + total) % total) }
      else if (event.key === ' ') { event.preventDefault(); setPlaying(v => !v) }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      previous?.focus?.()
    }
  }, [total])

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => setSlide(v => (v + 1) % total), SLIDE_MS)
    return () => window.clearInterval(timer)
  }, [playing, total])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const scoreColor = scoreColorToken(run.score)

  return createPortal(
    <div className={`wall-root${playing ? ' is-playing' : ''}`} role="dialog" aria-modal="true" aria-label="Widget wall">
      <div className="wall-topbar">
        <div className="wall-brand"><NineDotIcon size={18} /><span>WOMBATpass</span><span className="wall-brand-sep">·</span><span>Wall</span></div>
        <div className="wall-top-actions">
          <span className="wall-clock">{clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <button type="button" className="wall-ctrl" onClick={() => setPlaying(v => !v)} aria-label={playing ? 'Pause rotation' : 'Resume rotation'}>
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <button ref={closeRef} type="button" className="wall-ctrl" onClick={onClose} aria-label="Exit wall mode">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="wall-stage">
        {slide === 0 && (
          <div className="wall-slide wall-posture">
            <div className="wall-eyebrow">{run.project || 'Unnamed project'} · {run.branch || 'no branch'}</div>
            <div className="wall-score" style={{ color: scoreColor }}>{run.score}<span>/100</span></div>
            <div className="wall-score-label">{run.score >= 80 ? 'Strong posture' : run.score >= 60 ? 'Needs focused work' : 'High risk'}</div>
            <div className="wall-kpis">
              <div><strong style={{ color: '#ef4444' }}>{failed.length}</strong><span>Failed controls</span></div>
              <div><strong style={{ color: '#f97316' }}>{critical + high}</strong><span>Critical + high</span></div>
              <div><strong style={{ color: '#eab308' }}>{resources}</strong><span>Resources at risk</span></div>
              <div><strong style={{ color: '#0094ff' }}>{run.controls_loaded}</strong><span>Controls loaded</span></div>
            </div>
          </div>
        )}

        {slide === 1 && (
          <div className="wall-slide">
            <div className="wall-eyebrow">Pillar health</div>
            <h2 className="wall-title">Eight pillars, one posture</h2>
            <div className="wall-pillars">
              {PILLARS.map(pillar => {
                const value = pillarScore(run.pillar_scores, pillar.key)
                return (
                  <div className="wall-pillar" key={pillar.key}>
                    <span className="wall-pillar-label">{pillar.label}</span>
                    <div className="wall-pillar-track"><span style={{ width: `${value ?? 0}%`, background: pillar.color }} /></div>
                    <span className="wall-pillar-value">{value ?? '—'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {slide === 2 && (
          <div className="wall-slide">
            <div className="wall-eyebrow">Top failing controls</div>
            <h2 className="wall-title">Where to focus</h2>
            <div className="wall-list">
              {topControls.map(control => (
                <div className="wall-list-row" key={control.id}>
                  <span className="wall-sev" style={{ color: control.severity === 'CRITICAL' ? '#ef4444' : '#f97316' }}>{control.severity}</span>
                  <span className="wall-list-id">{control.id}</span>
                  <span className="wall-list-title">{control.title}</span>
                  <span className="wall-list-count">{control.count}</span>
                </div>
              ))}
              {topControls.length === 0 && <div className="wall-empty">No failing controls.</div>}
            </div>
          </div>
        )}

        {slide === 3 && (
          <div className="wall-slide">
            <div className="wall-eyebrow">Risk concentration</div>
            <h2 className="wall-title">Exposure at a glance</h2>
            <div className="wall-kpis is-large">
              <div><strong style={{ color: '#ef4444' }}>{critical}</strong><span>Critical findings</span></div>
              <div><strong style={{ color: '#f97316' }}>{high}</strong><span>High findings</span></div>
              <div><strong style={{ color: '#a855f7' }}>{secretHits}</strong><span>Secret hits</span></div>
              <div><strong style={{ color: '#0094ff' }}>{planTotal}</strong><span>Plan changes</span></div>
            </div>
          </div>
        )}

        {slide === 4 && (
          <div className="wall-slide">
            <div className="wall-eyebrow">Recent runs</div>
            <h2 className="wall-title">Latest activity</h2>
            <div className="wall-runs">
              {recentRuns.map(r => (
                <div className="wall-run" key={r.id}>
                  <div>
                    <div className="wall-run-project">{r.project || '—'}</div>
                    <div className="wall-run-meta">{r.branch || 'no branch'} · {new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                  <span className="wall-run-score" style={{ color: r.score >= 80 ? '#22c55e' : r.score >= 60 ? '#eab308' : '#ef4444' }}>{r.score}</span>
                </div>
              ))}
              {recentRuns.length === 0 && <div className="wall-empty">No runs yet.</div>}
            </div>
          </div>
        )}
      </div>

      <div className="wall-foot">
        <div className="wall-dots" role="tablist" aria-label="Wall slides">
          {slides.map((label, i) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={i === slide}
              aria-label={label}
              className={`wall-dot${i === slide ? ' is-active' : ''}`}
              onClick={() => setSlide(i)}
            />
          ))}
        </div>
        <span className="wall-hint">Space pause · ← → slides · Esc exit</span>
      </div>
    </div>,
    document.body,
  )
}
