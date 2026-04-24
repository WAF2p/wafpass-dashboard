import { useEffect, useMemo, useState } from 'react'
import { fetchBadgeStatus, getApiBase, RunSummary } from '../api'

interface Props {
  runs: RunSummary[]
}

const TIER_COLORS: Record<number, string> = {
  1: '#d97706',
  2: '#0094FF',
  3: '#0891b2',
  4: '#7c3aed',
  5: '#059669',
}

const TIER_LABELS: Record<number, string> = {
  1: 'L1 · Foundational',
  2: 'L2 · Operational',
  3: 'L3 · Governed',
  4: 'L4 · Optimized',
  5: 'L5 · Excellence',
}

type SnippetFormat = 'markdown' | 'html' | 'asciidoc' | 'rst' | 'orgmode' | 'json'

const FORMAT_LABELS: Record<SnippetFormat, string> = {
  markdown: 'Markdown',
  html:     'HTML',
  asciidoc: 'AsciiDoc',
  rst:      'reStructuredText',
  orgmode:  'Org-mode',
  json:     'JSON API',
}

function CodeBlock({ code, lang = '' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }
  return (
    <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
      <pre style={{
        background: '#0b1220', border: '1px solid #1e293b', borderRadius: '8px',
        padding: '0.875rem 3rem 0.875rem 1rem',
        fontSize: '0.72rem', lineHeight: 1.7, color: '#e2e8f0',
        overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        margin: 0,
      }}>
        {lang && (
          <span style={{
            position: 'absolute', top: '0.4rem', left: '0.6rem',
            fontSize: '0.55rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700,
          }}>{lang}</span>
        )}
        <code>{code}</code>
      </pre>
      <button
        onClick={copy}
        title="Copy to clipboard"
        style={{
          position: 'absolute', top: '0.4rem', right: '0.4rem',
          background: copied ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${copied ? 'rgba(34,197,94,0.35)' : '#1e293b'}`,
          borderRadius: '5px', cursor: 'pointer', padding: '0.25rem 0.45rem',
          color: copied ? '#22c55e' : '#64748b',
          fontSize: '0.65rem', fontWeight: 700, transition: 'all 0.15s',
          display: 'flex', alignItems: 'center', gap: '0.25rem',
        }}
      >
        <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {copied
            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3" />
          }
        </svg>
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}

function InlineBadgeSvg({ tierLevel, tierLabel, color }: { tierLevel: number; tierLabel: string; color: string }) {
  const label = 'WAF++ PASS'
  const value = tierLevel > 0 ? `L${tierLevel} · ${tierLabel}` : 'No Data'
  const charW = 6.2
  const pad = 10
  const lw = Math.round(label.length * charW + pad * 2)
  const vw = Math.round(value.length * charW + pad * 2)
  const tw = lw + vw
  const lcx = Math.round(lw / 2)
  const vcx = Math.round(lw + vw / 2)

  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={tw} height={20} role="img">
      <linearGradient id="bs" x2="0" y2="100%">
        <stop offset="0" stopColor="#bbb" stopOpacity=".1" />
        <stop offset="1" stopOpacity=".1" />
      </linearGradient>
      <clipPath id="br"><rect width={tw} height={20} rx={3} fill="#fff" /></clipPath>
      <g clipPath="url(#br)">
        <rect width={lw} height={20} fill="#555" />
        <rect x={lw} width={vw} height={20} fill={color} />
        <rect width={tw} height={20} fill="url(#bs)" />
      </g>
      <g fill="#fff" textAnchor="middle" fontFamily="DejaVu Sans,Verdana,Geneva,sans-serif" fontSize={11}>
        <text x={lcx} y={15} fill="#010101" fillOpacity=".3">{label}</text>
        <text x={lcx} y={14}>{label}</text>
        <text x={vcx} y={15} fill="#010101" fillOpacity=".3">{value}</text>
        <text x={vcx} y={14}>{value}</text>
      </g>
    </svg>
  )
}

export default function BadgePage({ runs }: Props) {
  const projects = useMemo(
    () => Array.from(new Set(runs.map(r => r.project).filter(Boolean))).sort(),
    [runs],
  )

  const [project, setProject] = useState<string>(() => projects[0] ?? '')
  const [format, setFormat] = useState<SnippetFormat>('markdown')
  const [mode, setMode] = useState<'live' | 'offline'>('live')
  const [status, setStatus] = useState<{ level: number; label: string; color: string; score: number | null } | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)

  // sync project dropdown when runs load
  useEffect(() => {
    if (!project && projects.length > 0) setProject(projects[0])
  }, [projects]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!project) return
    setStatusLoading(true)
    fetchBadgeStatus(project)
      .then(s => {
        if (s) setStatus({ level: s.tier_level, label: s.tier_label, color: s.color, score: s.score })
        else setStatus(null)
      })
      .catch(() => setStatus(null))
      .finally(() => setStatusLoading(false))
  }, [project])

  const apiBase = getApiBase() || window.location.origin
  const badgeUrl   = `${apiBase}/public/badge/${encodeURIComponent(project)}.svg`
  const verifyBase = apiBase

  // ── Snippet generators ────────────────────────────────────────────────────

  function snippets(fmt: SnippetFormat): string {
    const img  = badgeUrl
    const link = `${verifyBase}/public/badge/${encodeURIComponent(project)}/json`
    const alt  = `WAF++ PASS – ${project}`

    switch (fmt) {
      case 'markdown':
        return mode === 'offline'
          ? `<!-- Download the badge SVG and commit it to your repo: -->\n<!-- ${apiBase}/public/badge/${encodeURIComponent(project)}/download -->\n\n![WAF++ PASS](./badge/wafpass-badge.svg)`
          : `[![WAF++ PASS](${img})](${verifyBase})\n\n<!-- Or link to a verified achievement: -->\n<!-- [![WAF++ PASS](${img})](${verifyBase}/public/achievements/{token}) -->`

      case 'html':
        return mode === 'offline'
          ? `<!-- Download: ${apiBase}/public/badge/${encodeURIComponent(project)}/download -->\n<img src="./badge/wafpass-badge.svg"\n     alt="${alt}"\n     title="${alt}"\n     style="height: 20px;" />`
          : `<a href="${verifyBase}" target="_blank" rel="noopener">\n  <img src="${img}"\n       alt="${alt}"\n       title="${alt}"\n       style="height: 20px;" />\n</a>`

      case 'asciidoc':
        return mode === 'offline'
          ? `// Download: ${apiBase}/public/badge/${encodeURIComponent(project)}/download\nimage::./badge/wafpass-badge.svg[${alt}]`
          : `image:${img}[${alt},link=${verifyBase}]`

      case 'rst':
        return mode === 'offline'
          ? `.. Download: ${apiBase}/public/badge/${encodeURIComponent(project)}/download\n\n.. image:: ./badge/wafpass-badge.svg\n   :alt: ${alt}`
          : `.. image:: ${img}\n   :target: ${verifyBase}\n   :alt: ${alt}`

      case 'orgmode':
        return mode === 'offline'
          ? `# Download: ${apiBase}/public/badge/${encodeURIComponent(project)}/download\n[[./badge/wafpass-badge.svg]]`
          : `[[${verifyBase}][${img}]]`

      case 'json':
        return `# JSON status endpoint — useful for CI scripts and custom badge renderers:\ncurl '${link}'\n\n# Example response:\n{\n  "project": "${project}",\n  "tier_level": ${status?.level ?? 5},\n  "tier_label": "${status?.label ?? 'Excellence'}",\n  "score": ${status?.score ?? 95},\n  "color": "${status?.color ?? '#059669'}",\n  "badge_url": "/public/badge/${encodeURIComponent(project)}.svg",\n  "updated_at": "2026-04-23T10:00:00+00:00"\n}\n\n# GitHub Actions — fail if below L3:\nSCORE=$(curl -s '${link}' | jq '.tier_level')\nif [ "$SCORE" -lt 3 ]; then\n  echo "WAF++ maturity gate failed (L$SCORE < L3)" && exit 1\nfi`

      default: return ''
    }
  }

  const currentLevel = status?.level ?? 0
  const currentColor = status?.color ?? '#64748b'
  const currentLabel = status?.label ?? 'No Data'

  if (runs.length === 0) {
    return (
      <div style={{ color: 'var(--muted)', textAlign: 'center', marginTop: '4rem', fontSize: '0.85rem' }}>
        No scan runs yet. Push your first wafpass result to generate a badge.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Project selector + live/offline toggle ───────────────────────────── */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>Project</div>
          <select
            value={project}
            onChange={e => setProject(e.target.value)}
            style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '8px', color: 'var(--text)', padding: '0.4rem 0.75rem',
              fontSize: '0.82rem', cursor: 'pointer',
            }}
          >
            {projects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>Deployment mode</div>
          <div style={{ display: 'flex', gap: 0, borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            {(['live', 'offline'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  padding: '0.4rem 1rem', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                  background: mode === m ? 'var(--waf-brand)' : 'var(--surface)',
                  color: mode === m ? '#fff' : 'var(--muted)',
                  border: 'none',
                }}
              >
                {m === 'live' ? 'Live (public server)' : 'Offline (download)'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Two-column layout ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'start' }}>
      {/* Left column: badge config */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── Mode explanation ─────────────────────────────────────────────────── */}
      {mode === 'offline' && (
        <div style={{
          display: 'flex', gap: '0.75rem', padding: '0.875rem 1.25rem', borderRadius: '10px',
          background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.3)',
        }}>
          <svg width="18" height="18" fill="none" stroke="#d97706" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: '1px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#d97706', marginBottom: '0.2rem' }}>
              Offline / Internal deployment mode
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              Your WAF++ server is not publicly accessible. Download the current badge SVG and commit it to your repository alongside your README. Re-download after each significant milestone to keep it fresh. Use the <strong style={{ color: 'var(--text)' }}>static tier badges</strong> below to always show a fixed level.
            </div>
          </div>
        </div>
      )}

      {/* ── Badge preview ────────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>Badge Preview</div>
          {statusLoading && <div className="spinner" style={{ width: '14px', height: '14px' }} />}
          {!statusLoading && status && (
            <span style={{
              fontSize: '0.68rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '999px',
              background: `${currentColor}14`, color: currentColor, border: `1px solid ${currentColor}30`,
            }}>
              Score {status.score} · {currentLabel}
            </span>
          )}
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: mode === 'live' ? '1fr 1px 1fr 1px 1fr' : '1fr 1px 1fr',
          alignItems: 'stretch',
        }}>
          {/* Rendered */}
          <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Rendered</div>
            <InlineBadgeSvg tierLevel={currentLevel} tierLabel={currentLabel} color={currentColor} />
            <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>In-browser preview of your badge</div>
          </div>

          <div style={{ background: 'var(--border)' }} />

          {mode === 'live' ? (
            <>
              {/* Live from server */}
              <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
                <div style={{ fontSize: '0.62rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Live from server</div>
                <img
                  src={badgeUrl}
                  alt={`WAF++ PASS – ${project}`}
                  style={{ height: '20px' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Actual badge served by your WAF++ server</div>
              </div>

              <div style={{ background: 'var(--border)' }} />

              {/* Action */}
              <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
                <div style={{ fontSize: '0.62rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Direct link</div>
                <a
                  href={badgeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem', alignSelf: 'flex-start',
                    padding: '0.45rem 0.875rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600,
                    background: 'var(--bg)', color: 'var(--waf-brand)',
                    border: '1px solid rgba(0,148,255,0.3)', textDecoration: 'none',
                  }}
                >
                  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Open live badge
                </a>
                <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Opens the SVG in a new tab</div>
              </div>
            </>
          ) : (
            /* Offline: download action */
            <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Download</div>
              <a
                href={`${apiBase}/public/badge/${encodeURIComponent(project)}/download`}
                download
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem', alignSelf: 'flex-start',
                  padding: '0.45rem 0.875rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600,
                  background: 'var(--waf-brand)', color: '#fff',
                  border: 'none', textDecoration: 'none', cursor: 'pointer',
                }}
              >
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download current badge
              </a>
              <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Commit to your repo alongside the README</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Embed code ───────────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.15rem' }}>Embed Code</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Copy the snippet for your documentation format</div>
        </div>

        {/* Format tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
          {(Object.keys(FORMAT_LABELS) as SnippetFormat[]).map(f => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              style={{
                padding: '0.55rem 1rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                background: 'none', border: 'none',
                borderBottom: format === f ? '2px solid var(--waf-brand)' : '2px solid transparent',
                color: format === f ? 'var(--waf-brand)' : 'var(--muted)',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s',
              }}
            >
              {FORMAT_LABELS[f]}
            </button>
          ))}
        </div>

        <div style={{ padding: '1.25rem' }}>
          {format === 'json' ? (
            <CodeBlock code={snippets('json')} lang="sh" />
          ) : (
            <CodeBlock code={snippets(format)} lang={format} />
          )}

          {/* Format-specific notes */}
          {format === 'markdown' && (
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              Works in GitHub, GitLab, Bitbucket, and any Markdown renderer that allows external images.
              {mode === 'live' && <> GitHub caches badge images via <code style={{ color: 'var(--text)' }}>camo</code>; the badge auto-refreshes every few minutes.</>}
            </div>
          )}
          {format === 'asciidoc' && (
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              AsciiDoc is used in GitLab wikis, Confluence, and Antora documentation sites.
              The inline <code style={{ color: 'var(--text)' }}>image:</code> macro renders in-line; use <code style={{ color: 'var(--text)' }}>image::</code> for a block.
            </div>
          )}
          {format === 'rst' && (
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              reStructuredText is the standard for Python projects (PyPI, Sphinx docs, ReadTheDocs).
              The <code style={{ color: 'var(--text)' }}>:target:</code> directive makes the image a clickable link.
            </div>
          )}
          {format === 'orgmode' && (
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              Org-mode links work in Emacs Org files and are rendered by GitHub's Org renderer.
              Export to HTML with <code style={{ color: 'var(--text)' }}>C-c C-e h h</code>.
            </div>
          )}
          {format === 'json' && (
            <div style={{ fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              Use the JSON endpoint to build custom badge renderers, CI gates, or Grafana annotations.
              No authentication required — fully public.
            </div>
          )}
        </div>
      </div>

      </div>{/* end left column */}

      {/* Right column: CI gate examples */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* ── GitHub Actions gate example ──────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.15rem' }}>GitHub Actions — Maturity Gate</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Block merges if the project drops below your required tier</div>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <CodeBlock lang="yaml" code={`name: WAF++ Maturity Gate

on: [pull_request]

jobs:
  maturity-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Check WAF++ maturity tier
        run: |
          TIER=$(curl -sf '${apiBase}/public/badge/${encodeURIComponent(project)}/json' | jq '.tier_level')
          echo "Current tier: L$TIER"
          if [ "$TIER" -lt 3 ]; then
            echo "::error::WAF++ maturity gate failed — current tier L$TIER is below required L3 (Governed)"
            exit 1
          fi
          echo "::notice::WAF++ maturity gate passed — L$TIER"`} />
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.6 }}>
            Add this workflow to <code style={{ color: 'var(--text)' }}>.github/workflows/wafpass-gate.yml</code>.
            Adjust the <code style={{ color: 'var(--text)' }}>-lt 3</code> threshold to enforce your team's minimum tier.
          </div>
        </div>
      </div>

      {/* ── GitLab CI gate ───────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.15rem' }}>GitLab CI — Maturity Gate</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Same logic, GitLab pipeline syntax</div>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <CodeBlock lang="yaml" code={`wafpass-maturity-gate:
  stage: quality
  image: alpine:latest
  before_script:
    - apk add --no-cache curl jq
  script:
    - |
      TIER=$(curl -sf '${apiBase}/public/badge/${encodeURIComponent(project)}/json' | jq '.tier_level')
      echo "WAF++ maturity tier: L$TIER"
      [ "$TIER" -ge 3 ] || (echo "Gate failed — tier L$TIER below L3" && exit 1)
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"`} />
        </div>
      </div>

      {/* ── Static tier badge downloads ──────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.15rem' }}>Static Tier Badges</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
            Pre-rendered, immutable badges by tier — ideal for air-gapped environments or committing alongside your README
          </div>
        </div>
        <div style={{ padding: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.875rem' }}>
          {[1, 2, 3, 4, 5].map(tier => {
            const label = TIER_LABELS[tier]
            const color = TIER_COLORS[tier]
            return (
              <div key={tier} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem',
                padding: '0.875rem 1rem', background: 'var(--bg)',
                borderRadius: '10px', border: `1px solid ${color}28`,
              }}>
                <InlineBadgeSvg tierLevel={tier} tierLabel={label.replace(`L${tier} · `, '')} color={color} />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <a
                    href={`${apiBase}/public/badge/static/${tier}.svg`}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={`wafpass-badge-l${tier}.svg`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                      padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 600,
                      background: `${color}12`, color, border: `1px solid ${color}30`, textDecoration: 'none',
                    }}
                  >
                    <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                  </a>
                </div>
                <div style={{ fontSize: '0.62rem', color: 'var(--muted)', fontFamily: 'monospace' }}>
                  {`![badge](./wafpass-badge-l${tier}.svg)`}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Shields.io compatible endpoint note ─────────────────────────────── */}
      <div style={{ background: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: '0.15rem' }}>Shields.io Dynamic Badge</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
            Use the JSON endpoint with shields.io's <code style={{ color: 'var(--text)' }}>endpoint</code> badge type for full customisation
          </div>
        </div>
        <div style={{ padding: '1.25rem' }}>
          <CodeBlock lang="markdown" code={`<!-- shields.io dynamic badge via the JSON endpoint -->\n![WAF++ PASS](https://img.shields.io/endpoint?url=${encodeURIComponent(`${apiBase}/public/badge/${encodeURIComponent(project)}/json`)}&style=flat-square&label=WAF%2B%2B+PASS)`} />
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', lineHeight: 1.6 }}>
            The JSON endpoint returns a <code style={{ color: 'var(--text)' }}>schemaVersion=1</code>-compatible payload automatically
            when shields.io's <code style={{ color: 'var(--text)' }}>endpoint</code> badge type is used — shields.io handles rendering,
            caching, and the dark/light theme variants.{' '}
            <strong style={{ color: 'var(--text)' }}>Best option when the WAF++ server is publicly accessible.</strong>
          </div>
        </div>
      </div>

      </div>{/* end right column */}
      </div>{/* end two-column grid */}

    </div>
  )
}
