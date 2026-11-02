import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { RunSummary } from '../api'
import { useBetaFeatures } from '../beta/BetaFeaturesContext'
import { PILLARS, pillarScore } from '../pillars'

interface RunTrendOverlayProps {
  runs: RunSummary[]
  onClose: () => void
  onSelectRun: (id: string) => void
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export default function RunTrendOverlay({ runs, onClose, onSelectRun }: RunTrendOverlayProps) {
  const { prefs, update } = useBetaFeatures()
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      previous?.focus?.()
    }
  }, [])

  const ordered = [...runs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const data = ordered.map(run => {
    const point: Record<string, string | number> = {
      label: fmt(run.created_at),
      overall: run.score,
      project: run.project || '—',
    }
    for (const pillar of PILLARS) {
      const value = pillarScore(run.pillar_scores, pillar.key)
      if (value !== null) point[pillar.key] = value
    }
    return point
  })

  function remove(id: string) {
    update({ bookmarkedRuns: (prefs.bookmarkedRuns ?? []).filter(runId => runId !== id) })
  }

  return createPortal(
    <div className="trend-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="trend-panel" role="dialog" aria-modal="true" aria-label="Bookmarked run trend">
        <div className="trend-head">
          <div>
            <div className="trend-kicker">Run bookmarks</div>
            <h2>Pillar trend across bookmarked runs</h2>
            <p>Overall score and pillar scores, oldest to newest. Up to five runs.</p>
          </div>
          <button ref={closeRef} type="button" className="trend-close" aria-label="Close trend" onClick={onClose}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {ordered.length < 2 ? (
          <div className="trend-empty">
            Bookmark at least two runs in Run History to compare their pillar trend.
          </div>
        ) : (
          <>
            <div className="trend-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 18, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="overall" name="Overall" stroke="var(--text)" strokeWidth={2.5} dot={{ r: 3 }} />
                  {PILLARS.map(pillar => (
                    <Line
                      key={pillar.key}
                      type="monotone"
                      dataKey={pillar.key}
                      name={pillar.label}
                      stroke={pillar.color}
                      strokeWidth={1.6}
                      dot={{ r: 2 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="trend-runs">
              {ordered.map(run => (
                <div className="trend-run" key={run.id}>
                  <button type="button" className="trend-run-open" onClick={() => onSelectRun(run.id)}>
                    <span className="trend-run-project">{run.project || '—'}</span>
                    <span className="trend-run-meta">{fmt(run.created_at)} · {run.branch || 'no branch'}</span>
                    <span className="trend-run-score" style={{ color: run.score >= 80 ? 'var(--pass)' : run.score >= 60 ? 'var(--score-mid)' : 'var(--fail)' }}>{run.score}</span>
                  </button>
                  <button type="button" className="trend-run-remove" aria-label="Remove bookmark" title="Remove bookmark" onClick={() => remove(run.id)}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 7h12M9 7V5h6v2m-8 0l1 13h8l1-13M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
