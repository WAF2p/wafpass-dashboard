import { useEffect, useState, useMemo } from 'react'
import { fetchProjectPassports, fetchProjectPassport, upsertProjectPassport, ProjectPassport, ProjectPassportUpsert, RunSummary } from '../api'
import { MATURITY_META } from './SettingsPage'

interface Props {
  runs: RunSummary[]
  role: string
  onOpenProject: (project: string) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MATURITY_THRESHOLDS: Record<number, number> = { 1: 0, 2: 40, 3: 60, 4: 75, 5: 90 }

const CRITICALITY_META: Record<string, { label: string; color: string; bg: string; code: string }> = {
  critical: { label: 'Critical', color: '#DA2C38', bg: 'rgba(218,44,56,0.12)',  code: 'C' },
  high:     { label: 'High',     color: '#f97316', bg: 'rgba(249,115,22,0.12)', code: 'H' },
  medium:   { label: 'Medium',   color: '#eab308', bg: 'rgba(234,179,8,0.12)',  code: 'M' },
  low:      { label: 'Low',      color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  code: 'L' },
}

const ENV_META: Record<string, { label: string; color: string }> = {
  production:  { label: 'Production',  color: '#DA2C38' },
  staging:     { label: 'Staging',     color: '#f97316' },
  development: { label: 'Development', color: '#22c55e' },
  mixed:       { label: 'Mixed',       color: '#8b5cf6' },
}

const CLOUD_META: Record<string, { label: string; color: string }> = {
  aws:   { label: 'AWS',         color: '#f97316' },
  azure: { label: 'Azure',       color: '#2b7fff' },
  gcp:   { label: 'GCP',         color: '#22c55e' },
  multi: { label: 'Multi-Cloud', color: '#8b5cf6' },
  other: { label: 'Other',       color: '#94a3b8' },
}

const EMPTY_PASSPORT: ProjectPassportUpsert = {
  display_name: '', owner: '', owner_team: '', contact_email: '',
  description: '', criticality: '', environment: '', cloud_provider: '',
  repository_url: '', documentation_url: '', tags: [], notes: '', image_url: '',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(s: number) { return s >= 80 ? '#059669' : s >= 60 ? '#d97706' : '#DA2C38' }

function getMaturityForScore(score: number) {
  return [...MATURITY_META].reverse().find(m => score >= MATURITY_THRESHOLDS[m.level]) ?? MATURITY_META[0]
}

function canEdit(role: string) { return role === 'admin' || role === 'architect' }

function mrzPad(str: string, len: number) {
  return str.toUpperCase().replace(/[^A-Z0-9]/g, '<').slice(0, len).padEnd(len, '<')
}

function detectRepoType(url: string): 'github' | 'gitlab' | 'bitbucket' | 'generic' {
  if (url.includes('github.com')) return 'github'
  if (url.includes('gitlab.com') || url.includes('gitlab.')) return 'gitlab'
  if (url.includes('bitbucket.')) return 'bitbucket'
  return 'generic'
}

function detectDocsType(url: string): 'confluence' | 'notion' | 'gitbook' | 'readme' | 'generic' {
  if (url.includes('atlassian.') || url.includes('confluence')) return 'confluence'
  if (url.includes('notion.so') || url.includes('notion.com')) return 'notion'
  if (url.includes('gitbook.io') || url.includes('gitbook.com')) return 'gitbook'
  if (url.includes('readme.io') || url.includes('readme.com')) return 'readme'
  return 'generic'
}

// ── Icon components ───────────────────────────────────────────────────────────

function LinkIconButton({ href, title, children }: { href: string; title: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      onClick={e => e.stopPropagation()}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '22px', height: '22px', borderRadius: '4px',
        background: 'rgba(0,50,80,0.07)', border: '1px solid rgba(0,50,80,0.15)',
        color: 'rgba(0,50,80,0.6)', textDecoration: 'none', flexShrink: 0,
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(0,50,80,0.14)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(0,50,80,0.07)' }}
    >
      {children}
    </a>
  )
}

function RepoIcon({ url }: { url: string }) {
  const type = detectRepoType(url)
  if (type === 'github') return (
    <LinkIconButton href={url} title="GitHub Repository">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
      </svg>
    </LinkIconButton>
  )
  if (type === 'gitlab') return (
    <LinkIconButton href={url} title="GitLab Repository">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51 1.22 3.78a.84.84 0 0 1-.3.92z" />
      </svg>
    </LinkIconButton>
  )
  if (type === 'bitbucket') return (
    <LinkIconButton href={url} title="Bitbucket Repository">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
        <path d="M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.515.868 1.022.868h15.387c.38 0 .71-.258.79-.63l3.263-19.845a.768.768 0 0 0-.768-.895zM14.78 15.959H9.234L7.616 8.04h8.777z" />
      </svg>
    </LinkIconButton>
  )
  return (
    <LinkIconButton href={url} title="Repository">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
      </svg>
    </LinkIconButton>
  )
}

function DocsIcon({ url }: { url: string }) {
  const type = detectDocsType(url)
  if (type === 'confluence') return (
    <LinkIconButton href={url} title="Confluence Documentation">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
        <path d="M.887 18.168c-.28.459-.523.852-.71 1.161-.41.687-.117 1.567.635 1.877l3.783 1.552c.737.302 1.579-.055 1.896-.786.177-.409.413-.905.686-1.44C9.26 17.252 11.374 16.05 14.745 16c3.473-.052 6.072 1.267 7.944 3.638.463.589 1.293.738 1.938.34l3.33-2.059a1.377 1.377 0 0 0 .39-1.924C25.494 12.44 21.417 9 14.793 9 8.248 9 3.535 12.63.887 18.168zm22.226-12.336c.28-.459.523-.852.71-1.161.41-.687.117-1.567-.635-1.877L19.405 1.242c-.737-.302-1.579.055-1.896.786-.177.409-.413.905-.686 1.44C14.74 6.748 12.626 7.95 9.255 8c-3.473.052-6.072-1.267-7.944-3.638A1.378 1.378 0 0 0-.627 4.022L-3.957 6.08a1.377 1.377 0 0 0-.39 1.924C-.494 11.56 3.583 15 10.207 15c6.545 0 11.258-3.63 13.906-9.168z" />
      </svg>
    </LinkIconButton>
  )
  if (type === 'notion') return (
    <LinkIconButton href={url} title="Notion Documentation">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.447-.093-1.961-.747l-3.13-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
      </svg>
    </LinkIconButton>
  )
  if (type === 'gitbook') return (
    <LinkIconButton href={url} title="GitBook Documentation">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
        <path d="M10.802 17.77a.703.703 0 1 1-.002 1.406.703.703 0 0 1 .002-1.406m11.024-4.347a.703.703 0 1 1 .001-1.406.703.703 0 0 1-.001 1.406M3.136 14.12a.703.703 0 1 1 .001-1.407.703.703 0 0 1-.001 1.407m17.323-9.91a2.11 2.11 0 1 0 .001 4.22 2.11 2.11 0 0 0 0-4.22m0 3.164a1.054 1.054 0 1 1 0-2.11 1.054 1.054 0 0 1 0 2.11m-14.86-3.164a2.11 2.11 0 1 0 0 4.22 2.11 2.11 0 0 0 0-4.22m0 3.164a1.054 1.054 0 1 1 0-2.11 1.054 1.054 0 0 1 0 2.11" />
      </svg>
    </LinkIconButton>
  )
  return (
    <LinkIconButton href={url} title="Documentation">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    </LinkIconButton>
  )
}

// ── Passport data field ───────────────────────────────────────────────────────

function PassportDataField({
  label, value, bold = false, valueColor, small = false,
}: {
  label: string; value: string; bold?: boolean; valueColor?: string; small?: boolean
}) {
  return (
    <div style={{ minWidth: 0, overflow: 'hidden' }}>
      <div style={{ fontSize: '0.42rem', color: 'rgba(0,40,70,0.45)', letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </div>
      <div style={{
        fontSize: small ? '0.6rem' : '0.72rem',
        fontWeight: bold ? 800 : 600,
        color: valueColor ?? 'rgba(0,20,50,0.85)',
        lineHeight: 1.25,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value}
      </div>
    </div>
  )
}

// ── Maturity seal ─────────────────────────────────────────────────────────────

function MaturitySeal({ level, color, textColor, size = 54 }: { level: number; color: string; textColor: string; size?: number }) {
  const cx = size / 2, cy = size / 2
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 15 - 90) * Math.PI / 180
    const r = i % 2 === 0 ? size * 0.46 : size * 0.37
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.18))' }}>
      <polygon points={rays} fill={color} opacity="0.85" />
      <circle cx={cx} cy={cy} r={size * 0.31} fill={color} />
      <circle cx={cx} cy={cy} r={size * 0.27} fill="rgba(255,255,255,0.22)" />
      <text x={cx} y={cy - 3} textAnchor="middle" dominantBaseline="central"
        fill={textColor} fontSize={size * 0.2} fontWeight="900"
        fontFamily="system-ui,-apple-system,sans-serif">L{level}</text>
      <text x={cx} y={cy + size * 0.12} textAnchor="middle" dominantBaseline="central"
        fill={textColor} fontSize={size * 0.1} fontWeight="700" opacity="0.8"
        fontFamily="system-ui,-apple-system,sans-serif">WAF++</text>
    </svg>
  )
}

// ── Stamp / achievement data ──────────────────────────────────────────────────

const STAMP_ROTATIONS = [-7, 5, -3, 8, -5, 4, -6, 3, -4, 7, -8, 5, -2, 6]

interface StampAchievement {
  id: string; title: string; desc: string
  category: 'coverage' | 'quality' | 'consistency' | 'depth'
  icon: string
  check: (rs: RunSummary[]) => boolean
}

const STAMP_ACHIEVEMENTS: StampAchievement[] = [
  { id: 'first_scan',  title: 'First Scan',        desc: 'Complete first scan',              category: 'coverage',    icon: 'M13 10V3L4 14h7v7l9-11h-7z',                                                                                                                                                                                                               check: rs => rs.length >= 1 },
  { id: 'score_60',    title: 'Above Average',      desc: 'Score 60 or higher',               category: 'quality',     icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',         check: rs => rs.some(r => r.score >= 60) },
  { id: 'score_80',    title: 'High Performer',     desc: 'Score 80 or higher',               category: 'quality',     icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z', check: rs => rs.some(r => r.score >= 80) },
  { id: 'score_90',    title: 'Champion',           desc: 'Score 90 or higher',               category: 'quality',     icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',                               check: rs => rs.some(r => r.score >= 90) },
  { id: 'five_scans',  title: 'Regular Cadence',    desc: '5 or more scans',                  category: 'consistency', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',                                                                                                                  check: rs => rs.length >= 5 },
  { id: 'ten_scans',   title: 'Consistent',         desc: '10 or more scans',                 category: 'consistency', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',                                                       check: rs => rs.length >= 10 },
  { id: 'improving',   title: 'On the Up',          desc: '3 consecutive improvements',       category: 'consistency', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',                                                                                                                                                                                              check: rs => { if (rs.length < 3) return false; const s = [...rs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); for (let i = s.length - 1; i >= 2; i--) { if (s[i].score > s[i-1].score && s[i-1].score > s[i-2].score) return true } return false } },
  { id: 'multi_branch',title: 'Branch Coverage',    desc: 'Scans across 3+ branches',         category: 'coverage',    icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',              check: rs => new Set(rs.map(r => r.branch).filter(Boolean)).size >= 3 },
  { id: 'multi_stage', title: 'Pipeline Pro',       desc: 'Scans across 3+ stages',           category: 'depth',       icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',                                                                                                                                                                           check: rs => new Set(rs.map(r => r.stage).filter(Boolean)).size >= 3 },
]

const STAMP_CATEGORY_COLOR: Record<string, string> = {
  coverage: '#0094FF', quality: '#22c55e', consistency: '#f97316', depth: '#8b5cf6',
}

// ── Passport stamp ────────────────────────────────────────────────────────────

function PassportStamp({ color, icon, title, subtitle, earned, rotation, size = 84 }: {
  color: string; icon: string; title: string; subtitle?: string
  earned: boolean; rotation: number; size?: number
}) {
  const r = size / 2
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem',
      transform: `rotate(${rotation}deg)`,
      opacity: earned ? 1 : 0.13,
      filter: earned ? 'none' : 'grayscale(1)',
      transition: 'opacity 0.3s',
      userSelect: 'none',
    }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        {/* Outer ring */}
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
          <circle cx={r} cy={r} r={r - 3} fill={`${color}12`} stroke={color} strokeWidth="2.5" />
          <circle cx={r} cy={r} r={r - 10} fill="none" stroke={color} strokeWidth="1" strokeDasharray="3 2" opacity="0.6" />
        </svg>
        {/* Icon */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width={size * 0.32} height={size * 0.32} fill="none" stroke={color} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={icon} />
          </svg>
        </div>
        {/* Earned checkmark */}
        {earned && (
          <div style={{
            position: 'absolute', bottom: 2, right: 2,
            width: 16, height: 16, borderRadius: '50%',
            background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}>
            <svg width="8" height="8" fill="none" stroke="#fff" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
      <div style={{ textAlign: 'center', maxWidth: size + 12 }}>
        <div style={{ fontSize: '0.62rem', fontWeight: 700, color: earned ? 'rgba(0,20,50,0.85)' : 'rgba(0,20,50,0.4)', lineHeight: 1.2, fontFamily: 'Arial, sans-serif' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '0.48rem', color: 'rgba(0,40,70,0.45)', marginTop: '0.1rem', lineHeight: 1.2 }}>{subtitle}</div>}
      </div>
    </div>
  )
}

// ── Achievements overlay ──────────────────────────────────────────────────────

function AchievementsOverlay({
  onClose, projectRuns, bestScore, displayName,
}: {
  onClose: () => void
  projectRuns: RunSummary[]
  bestScore: number
  displayName: string
}) {
  const [stampPage, setStampPage] = useState<0 | 1>(0)

  const maturityBadges = MATURITY_META.map(m => ({
    ...m, earned: bestScore >= (MATURITY_THRESHOLDS[m.level] ?? 0),
  }))
  const achievementBadges = STAMP_ACHIEVEMENTS.map(a => ({
    ...a, earned: a.check(projectRuns),
  }))

  const earnedMaturity     = maturityBadges.filter(b => b.earned).length
  const earnedAchievements = achievementBadges.filter(b => b.earned).length

  return (
    <>
      {/* Click-away backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 1999 }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2000, width: 'min(560px, 90vw)',
          background: '#f9f7f1', borderRadius: '8px', boxShadow: '0 12px 40px rgba(0,0,0,0.28)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          fontFamily: 'Arial, Helvetica, sans-serif',
          border: '1.5px solid rgba(0,50,80,0.18)',
          maxHeight: '480px',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Passport-style header */}
        <div style={{ position: 'relative', height: '64px', overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg, #b4dfe8, #8fc8d8)' }}>
          <svg viewBox="0 0 560 64" width="100%" height="64" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0 }}>
            {[16, 32, 48].map(y => <line key={y} x1="0" y1={y} x2="560" y2={y} stroke="rgba(255,255,255,0.22)" strokeWidth="0.6" />)}
            {[70, 140, 210, 280, 350, 420, 490].map(x => <line key={x} x1={x} y1="0" x2={x} y2="64" stroke="rgba(255,255,255,0.22)" strokeWidth="0.6" />)}
            <path d="M0,64 L80,30 L140,42 L220,18 L290,34 L360,22 L430,38 L500,26 L560,32 L560,64 Z" fill="rgba(255,255,255,0.1)" />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 1rem', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '0.52rem', fontWeight: 800, color: 'rgba(0,40,70,0.7)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                WAF++ · PROJECT PASSPORT · STAMP COLLECTION
              </div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'rgba(0,30,60,0.85)', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '340px' }}>
                {displayName}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', cursor: 'pointer', padding: '0.3rem', color: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Page tabs — styled like passport page dividers */}
        <div style={{ display: 'flex', borderBottom: '1.5px solid rgba(0,50,80,0.12)', background: 'rgba(0,40,70,0.03)', flexShrink: 0 }}>
          {[
            { label: `Maturity Levels`, sub: `${earnedMaturity} / ${MATURITY_META.length} earned`, index: 0 },
            { label: `Achievements`,    sub: `${earnedAchievements} / ${STAMP_ACHIEVEMENTS.length} earned`, index: 1 },
          ].map(tab => (
            <button
              key={tab.index}
              onClick={() => setStampPage(tab.index as 0 | 1)}
              style={{
                flex: 1, padding: '0.5rem 0.75rem', border: 'none', cursor: 'pointer',
                background: stampPage === tab.index ? '#f9f7f1' : 'transparent',
                borderBottom: stampPage === tab.index ? '2px solid rgba(0,80,140,0.6)' : '2px solid transparent',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ fontSize: '0.6rem', fontWeight: 800, color: stampPage === tab.index ? 'rgba(0,40,80,0.85)' : 'rgba(0,40,70,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {tab.label}
              </div>
              <div style={{ fontSize: '0.5rem', color: 'rgba(0,40,70,0.45)', marginTop: '0.1rem' }}>{tab.sub}</div>
            </button>
          ))}
        </div>

        {/* Stamp grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1.25rem 1.75rem' }}>
          {stampPage === 0 ? (
            /* ── Maturity stamps ── */
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', justifyContent: 'center' }}>
              {maturityBadges.map((m, i) => (
                <PassportStamp
                  key={m.level}
                  color={m.color}
                  icon={i === 0 ? 'M13 10V3L4 14h7v7l9-11h-7z'
                      : i === 1 ? 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10'
                      : i === 2 ? 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                      : i === 3 ? 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z'
                      : 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z'}
                  title={`L${m.level} · ${m.short}`}
                  subtitle={`Score ${MATURITY_THRESHOLDS[m.level]}+`}
                  earned={m.earned}
                  rotation={STAMP_ROTATIONS[i % STAMP_ROTATIONS.length]}
                  size={90}
                />
              ))}
            </div>
          ) : (
            /* ── Achievement stamps ── */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', justifyItems: 'center' }}>
              {achievementBadges.map((a, i) => (
                <PassportStamp
                  key={a.id}
                  color={STAMP_CATEGORY_COLOR[a.category]}
                  icon={a.icon}
                  title={a.title}
                  subtitle={a.desc}
                  earned={a.earned}
                  rotation={STAMP_ROTATIONS[(i + 3) % STAMP_ROTATIONS.length]}
                  size={84}
                />
              ))}
            </div>
          )}
        </div>

        {/* Passport-style MRZ footer */}
        <div style={{ borderTop: '1.5px solid rgba(0,50,80,0.1)', padding: '0.3rem 0.75rem', background: 'rgba(255,235,220,0.2)', fontFamily: '"Courier New", monospace', fontSize: '0.46rem', color: 'rgba(0,20,50,0.3)', letterSpacing: '0.05em', userSelect: 'none', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'clip' }}>
          {`PP<WAF${mrzPad(displayName, 18)}<<STAMP<COLLECTION<<<<<<<<<<<<<<<<<`.slice(0, 44).padEnd(44, '<')}
        </div>
      </div>
    </>
  )
}

// ── View mode ─────────────────────────────────────────────────────────────────

type ViewMode = 'grid' | 'wide' | 'list'

// ── Shared card data hook ─────────────────────────────────────────────────────

function usePassportCardData(project: string, passport: ProjectPassport | null, runs: RunSummary[]) {
  const projectRuns  = runs.filter(r => (r.project || '(unnamed)') === project)
  const latestRun    = [...projectRuns].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
  const bestScore    = projectRuns.reduce((m, r) => Math.max(m, r.score), 0)
  const maturity     = getMaturityForScore(bestScore)
  const criticality  = passport?.criticality ? CRITICALITY_META[passport.criticality] : null
  const env          = passport?.environment  ? ENV_META[passport.environment]          : null
  const cloud        = passport?.cloud_provider ? CLOUD_META[passport.cloud_provider]  : null
  const displayName  = passport?.display_name || project
  const achievementCount = [
    projectRuns.length >= 1,
    projectRuns.some(r => r.score >= 60),
    projectRuns.some(r => r.score >= 80),
    projectRuns.some(r => r.score >= 90),
    projectRuns.length >= 5,
    projectRuns.length >= 10,
  ].filter(Boolean).length
  const mrzSurname   = mrzPad(displayName, 18)
  const mrzGivenName = mrzPad(passport?.owner || project, 14)
  const mrzDocNum    = mrzPad(project.replace(/[^A-Z0-9]/gi, '').slice(0, 9), 9)
  const mrzCrit      = (passport?.criticality?.[0] ?? 'U').toUpperCase()
  const mrzEnv       = (passport?.environment?.[0] ?? 'U').toUpperCase()
  const mrzIssue     = passport?.created_at ? new Date(passport.created_at).toISOString().slice(2, 10).replace(/-/g, '') : '000000'
  const mrzScans     = String(projectRuns.length).padStart(3, '0')
  const mrz1 = `PP<WAF${mrzSurname}<<${mrzGivenName}`.slice(0, 44).padEnd(44, '<')
  const mrz2 = `${mrzDocNum}<WAF${mrzIssue}${mrzCrit}${mrzEnv}${mrzScans}<<<<<<<<<<<`.slice(0, 44).padEnd(44, '<')
  return { projectRuns, latestRun, bestScore, maturity, criticality, env, cloud, displayName, achievementCount, mrz1, mrz2 }
}

// ── Row view ──────────────────────────────────────────────────────────────────

function PassportRow({
  project, passport, runs, onClick,
}: {
  project: string
  passport: ProjectPassport | null
  runs: RunSummary[]
  onClick: () => void
}) {
  const { projectRuns, latestRun, bestScore, maturity, criticality, env, cloud, displayName, achievementCount, mrz1 } =
    usePassportCardData(project, passport, runs)

  const gradId = `pgr-${project.replace(/[^a-z0-9]/gi, '-')}`

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', flexDirection: 'column',
        background: '#f9f7f1', border: `1.5px solid rgba(0,50,80,0.15)`,
        borderRadius: '7px', overflow: 'hidden', cursor: 'pointer', textAlign: 'left',
        transition: 'box-shadow 0.15s, transform 0.15s',
        boxShadow: '0 1px 6px rgba(0,0,0,0.07)', fontFamily: 'Arial, Helvetica, sans-serif',
      }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 18px rgba(0,0,0,0.13)'
        ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 6px rgba(0,0,0,0.07)'
        ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
      }}
    >
      {/* ── Main row ── */}
      <div style={{ display: 'flex', alignItems: 'stretch', minHeight: '72px' }}>

        {/* Left accent + seal */}
        <div style={{ position: 'relative', width: '72px', flexShrink: 0, overflow: 'hidden' }}>
          <svg viewBox="0 0 72 72" width="72" height="72" preserveAspectRatio="xMidYMid slice"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#b4dfe8" />
                <stop offset="100%" stopColor="#8fc8d8" />
              </linearGradient>
            </defs>
            <rect width="72" height="72" fill={`url(#${gradId})`} />
            {[18, 36, 54].map(y => <line key={y} x1="0" y1={y} x2="72" y2={y} stroke="rgba(255,255,255,0.22)" strokeWidth="0.5" />)}
            {[24, 48].map(x => <line key={x} x1={x} y1="0" x2={x} y2="72" stroke="rgba(255,255,255,0.22)" strokeWidth="0.5" />)}
            <path d="M0,72 L15,42 L30,52 L45,30 L60,44 L72,36 L72,72 Z" fill="rgba(255,255,255,0.1)" />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {passport?.image_url ? (
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.8)', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
                <img src={passport.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ) : (
              <MaturitySeal level={maturity.level} color={maturity.color} textColor={maturity.textColor} size={38} />
            )}
          </div>
        </div>

        {/* Doc header line */}
        <div style={{ width: '1px', background: 'rgba(0,50,80,0.1)', flexShrink: 0 }} />

        {/* Name + description */}
        <div style={{ flex: '1.8', minWidth: 0, padding: '0.55rem 0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.18rem', borderRight: '1px solid rgba(0,50,80,0.07)' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'rgba(0,20,50,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayName}
          </div>
          {passport?.display_name && passport.display_name !== project && (
            <div style={{ fontSize: '0.6rem', color: 'rgba(0,40,70,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{project}</div>
          )}
          {passport?.description ? (
            <div style={{ fontSize: '0.65rem', color: 'rgba(0,40,70,0.55)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.35 }}>
              {passport.description}
            </div>
          ) : (
            <div style={{ fontSize: '0.6rem', color: 'rgba(0,40,70,0.25)', fontStyle: 'italic' }}>No description</div>
          )}
        </div>

        {/* Owner + team */}
        <div style={{ flex: '1.2', minWidth: 0, padding: '0.55rem 0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.2rem', borderRight: '1px solid rgba(0,50,80,0.07)' }}>
          {passport?.owner && (
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: '0.38rem', color: 'rgba(0,40,70,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Owner</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(0,20,50,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{passport.owner}</div>
            </div>
          )}
          {passport?.owner_team && (
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <div style={{ fontSize: '0.38rem', color: 'rgba(0,40,70,0.38)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Team</div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(0,40,70,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{passport.owner_team}</div>
            </div>
          )}
          {!passport?.owner && !passport?.owner_team && (
            <div style={{ fontSize: '0.62rem', color: 'rgba(0,40,70,0.25)', fontStyle: 'italic' }}>No owner</div>
          )}
        </div>

        {/* Criticality + env + cloud */}
        <div style={{ flex: '0 0 140px', padding: '0.55rem 0.6rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.22rem', borderRight: '1px solid rgba(0,50,80,0.07)' }}>
          {criticality && (
            <span style={{ fontSize: '0.58rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: '3px', background: criticality.bg, color: criticality.color, border: `1px solid ${criticality.color}33`, alignSelf: 'flex-start' }}>
              {criticality.label}
            </span>
          )}
          {env && (
            <span style={{ fontSize: '0.58rem', fontWeight: 600, padding: '0.1rem 0.45rem', borderRadius: '3px', background: `${env.color}10`, color: env.color, border: `1px solid ${env.color}30`, alignSelf: 'flex-start' }}>
              {env.label}
            </span>
          )}
          {cloud && (
            <span style={{ fontSize: '0.58rem', fontWeight: 600, padding: '0.1rem 0.45rem', borderRadius: '3px', background: `${cloud.color}10`, color: cloud.color, border: `1px solid ${cloud.color}30`, alignSelf: 'flex-start' }}>
              {cloud.label}
            </span>
          )}
          {!criticality && !env && !cloud && (
            <span style={{ fontSize: '0.6rem', color: 'rgba(0,40,70,0.25)', fontStyle: 'italic' }}>—</span>
          )}
        </div>

        {/* Score + stats */}
        <div style={{ flex: '0 0 90px', padding: '0.55rem 0.6rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.1rem', borderRight: '1px solid rgba(0,50,80,0.07)' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: scoreColor(bestScore), lineHeight: 1 }}>
            {bestScore > 0 ? bestScore : '—'}
          </div>
          <div style={{ fontSize: '0.42rem', color: 'rgba(0,40,70,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>/ 100</div>
          <div style={{ fontSize: '0.52rem', color: 'rgba(0,40,70,0.45)', marginTop: '0.15rem' }}>
            {projectRuns.length} scan{projectRuns.length !== 1 ? 's' : ''}
          </div>
          {achievementCount > 0 && (
            <div style={{ fontSize: '0.5rem', color: 'rgba(0,40,70,0.38)', display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="rgba(0,40,70,0.4)"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
              {achievementCount}
            </div>
          )}
        </div>

        {/* Links + last scan */}
        <div style={{ flex: '0 0 80px', padding: '0.55rem 0.6rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
          {(passport?.repository_url || passport?.documentation_url) && (
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              {passport?.repository_url && <RepoIcon url={passport.repository_url} />}
              {passport?.documentation_url && <DocsIcon url={passport.documentation_url} />}
            </div>
          )}
          {latestRun && (
            <div style={{ fontSize: '0.48rem', color: 'rgba(0,40,70,0.4)', textAlign: 'center', lineHeight: 1.3 }}>
              {new Date(latestRun.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
            </div>
          )}
          <svg width="14" height="14" fill="none" stroke="rgba(0,40,70,0.3)" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {/* ── MRZ strip ── */}
      <div style={{
        borderTop: '1px solid rgba(0,50,80,0.08)',
        padding: '0.18rem 0.75rem',
        background: 'rgba(255,235,220,0.15)',
        fontFamily: '"Courier New", monospace',
        fontSize: '0.44rem',
        color: 'rgba(0,20,50,0.38)',
        letterSpacing: '0.05em',
        overflow: 'hidden', textOverflow: 'clip', whiteSpace: 'nowrap',
        userSelect: 'none',
      }}>
        {mrz1}
      </div>
    </button>
  )
}

// ── Passport card ─────────────────────────────────────────────────────────────

function PassportCard({
  project, passport, runs, onClick, onOpenStamps,
}: {
  project: string
  passport: ProjectPassport | null
  runs: RunSummary[]
  onClick: () => void
  onOpenStamps: () => void
}) {
  const { latestRun, bestScore, maturity, criticality, env, cloud, displayName, achievementCount, mrz1, mrz2 } =
    usePassportCardData(project, passport, runs)

  // Unique gradient ID per card to avoid SVG collisions
  const gradId = `pg-${project.replace(/[^a-z0-9]/gi, '-')}`

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', minHeight: '370px',
        display: 'flex', flexDirection: 'column',
        background: '#f9f7f1',
        border: `1.5px solid rgba(0,50,80,0.18)`,
        borderRadius: '7px',
        overflow: 'hidden',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'box-shadow 0.18s, transform 0.18s',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        fontFamily: 'Arial, Helvetica, sans-serif',
        position: 'relative',
      }}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 28px rgba(0,0,0,0.18)'
        ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)'
        ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
      }}
    >
      {/* ── Decorative watermark / landscape zone ── */}
      <div style={{ position: 'relative', height: '110px', flexShrink: 0, overflow: 'hidden' }}>
        <svg viewBox="0 0 320 110" width="100%" height="110" preserveAspectRatio="xMidYMid slice"
          style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#b4dfe8" />
              <stop offset="45%"  stopColor="#9dd2e0" />
              <stop offset="100%" stopColor="#8fc8d8" />
            </linearGradient>
            <linearGradient id={`${gradId}-overlay`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="60%" stopColor="transparent" />
              <stop offset="100%" stopColor="rgba(249,247,241,0.5)" />
            </linearGradient>
          </defs>
          <rect width="320" height="110" fill={`url(#${gradId})`} />
          {/* Subtle grid */}
          {[22, 44, 66, 88].map(y => (
            <line key={y} x1="0" y1={y} x2="320" y2={y} stroke="rgba(255,255,255,0.25)" strokeWidth="0.6" />
          ))}
          {[40, 80, 120, 160, 200, 240, 280].map(x => (
            <line key={x} x1={x} y1="0" x2={x} y2="110" stroke="rgba(255,255,255,0.25)" strokeWidth="0.6" />
          ))}
          {/* Mountain silhouette back */}
          <path d="M0,110 L25,65 L50,78 L80,45 L110,62 L145,30 L175,52 L205,38 L235,58 L265,42 L295,60 L320,50 L320,110 Z"
            fill="rgba(255,255,255,0.13)" />
          {/* Mountain silhouette front */}
          <path d="M0,110 L40,78 L70,88 L100,62 L130,74 L165,55 L195,68 L225,57 L260,72 L290,62 L320,70 L320,110 Z"
            fill="rgba(255,255,255,0.09)" />
          {/* Fine diagonal lines for depth */}
          {Array.from({ length: 8 }, (_, i) => (
            <line key={i} x1={i * 44 - 10} y1="0" x2={i * 44 + 80} y2="110"
              stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
          ))}
          {/* Gradient fade at bottom */}
          <rect width="320" height="110" fill={`url(#${gradId}-overlay)`} />
        </svg>

        {/* Score badge — top right */}
        <div style={{ position: 'absolute', top: '0.5rem', right: '0.6rem', textAlign: 'right' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: scoreColor(bestScore), lineHeight: 1, textShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>
            {bestScore > 0 ? bestScore : '—'}
          </div>
          <div style={{ fontSize: '0.42rem', color: 'rgba(0,40,70,0.6)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>/ 100</div>
        </div>

        {/* Center seal */}
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -54%)' }}>
          {passport?.image_url ? (
            <div style={{
              width: '58px', height: '58px', borderRadius: '50%',
              overflow: 'hidden', border: '2.5px solid rgba(255,255,255,0.85)',
              background: 'rgba(255,255,255,0.9)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
            }}>
              <img src={passport.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ) : (
            <MaturitySeal level={maturity.level} color={maturity.color} textColor={maturity.textColor} size={58} />
          )}
        </div>

        {/* Maturity pill — bottom left, static */}
        <div style={{ position: 'absolute', bottom: '0.4rem', left: '0.5rem' }}>
          <span style={{
            fontSize: '0.45rem', fontWeight: 800, letterSpacing: '0.1em',
            padding: '0.12rem 0.45rem', borderRadius: '3px',
            background: maturity.color, color: '#fff',
          }}>
            {maturity.short?.toUpperCase() ?? `L${maturity.level}`}
          </span>
        </div>
        {/* Achievement count — bottom right, static */}
        {achievementCount > 0 && (
          <div style={{ position: 'absolute', bottom: '0.4rem', right: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(0,40,70,0.5)">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <span style={{ fontSize: '0.45rem', color: 'rgba(0,40,70,0.6)', fontWeight: 700 }}>{achievementCount}</span>
          </div>
        )}
      </div>

      {/* ── Document type header strip ── */}
      <div style={{
        background: 'rgba(0,40,70,0.05)',
        borderTop: '1px solid rgba(0,40,70,0.1)',
        borderBottom: '1px solid rgba(0,40,70,0.1)',
        padding: '0.22rem 0.75rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '0.48rem', fontWeight: 800, color: 'rgba(0,40,70,0.65)', letterSpacing: '0.1em' }}>
            PROJECT PASSPORT · PASSEPORT PROJET
          </div>
          <div style={{ fontSize: '0.4rem', color: 'rgba(0,40,70,0.4)', letterSpacing: '0.06em' }}>
            WAF++ SECURITY PLATFORM · SICHERHEITSPLATTFORM
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', textAlign: 'center', flexShrink: 0 }}>
          {[
            { label: 'Type', value: 'PP' },
            { label: 'Code', value: 'WAF' },
            { label: 'No.', value: project.replace(/[^A-Z0-9]/gi, '').slice(0, 7).toUpperCase() || '—' },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: '0.38rem', color: 'rgba(0,40,70,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{f.label}</div>
              <div style={{ fontSize: '0.6rem', fontWeight: 900, color: 'rgba(0,30,60,0.8)', fontFamily: 'monospace', letterSpacing: '0.02em' }}>{f.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Data zone ── */}
      <div style={{ flex: 1, padding: '0.55rem 0.75rem', display: 'flex', gap: '0.6rem' }}>

        {/* Photo box */}
        <div style={{ flexShrink: 0 }}>
          <div style={{
            width: '54px', height: '68px', borderRadius: '3px',
            border: '1px solid rgba(0,40,70,0.18)',
            background: 'rgba(0,40,70,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', position: 'relative',
          }}>
            {passport?.image_url ? (
              <img src={passport.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <svg viewBox="0 0 54 68" width="54" height="68">
                <rect width="54" height="68" fill="rgba(0,40,70,0.03)" />
                <text x="27" y="30" textAnchor="middle" dominantBaseline="central"
                  fontSize="22" fill="rgba(0,40,70,0.22)" fontFamily="Arial, sans-serif" fontWeight="700">
                  {displayName[0]?.toUpperCase() ?? '?'}
                </text>
                <text x="27" y="52" textAnchor="middle" dominantBaseline="central"
                  fontSize="8" fill="rgba(0,40,70,0.3)" fontFamily="monospace" fontWeight="700">
                  L{maturity.level}
                </text>
              </svg>
            )}
          </div>
        </div>

        {/* Fields */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.28rem', minWidth: 0 }}>
          <PassportDataField
            label="Name · Nom · Cognome · Surname"
            value={displayName} bold
          />
          {passport?.owner ? (
            <PassportDataField
              label="Owner · Propriétaire · Eigentümer"
              value={passport.owner}
            />
          ) : (
            <PassportDataField label="Owner · Propriétaire" value="—" />
          )}
          {passport?.owner_team && (
            <PassportDataField
              label="Team · Équipe · Organisation · Nationalité"
              value={passport.owner_team}
            />
          )}
          {passport?.contact_email && (
            <PassportDataField
              label="Contact · E-Mail · Kontakt"
              value={passport.contact_email} small
            />
          )}

          {/* Two-column row: criticality + environment */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: '0 0 48%', minWidth: 0 }}>
              <PassportDataField
                label="Criticality · Criticité · Kritikalität"
                value={criticality?.label ?? '—'}
                valueColor={criticality?.color}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <PassportDataField
                label="Environment · Env. · Umgebung"
                value={env?.label ?? '—'}
                valueColor={env?.color}
              />
            </div>
          </div>

          {/* Two-column row: cloud + issue date */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: '0 0 48%', minWidth: 0 }}>
              <PassportDataField
                label="Cloud · Nuage · Wolke"
                value={cloud?.label ?? '—'}
                valueColor={cloud?.color}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <PassportDataField
                label="Date of issue · Date d'émission"
                value={passport?.created_at
                  ? new Date(passport.created_at).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })
                  : latestRun
                    ? new Date(latestRun.created_at).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : '—'
                }
                small
              />
            </div>
          </div>

          {/* Two-column row: last scan + authority */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div style={{ flex: '0 0 48%', minWidth: 0 }}>
              <PassportDataField
                label="Last scan · Dernier scan · Letzter Scan"
                value={latestRun
                  ? new Date(latestRun.created_at).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' })
                  : '—'
                }
                small
              />
            </div>
            {/* Links as icons */}
            {(passport?.repository_url || passport?.documentation_url) && (
              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', paddingBottom: '1px' }}>
                {passport.repository_url && <RepoIcon url={passport.repository_url} />}
                {passport.documentation_url && <DocsIcon url={passport.documentation_url} />}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tags strip ── */}
      {passport?.tags && passport.tags.length > 0 && (
        <div style={{
          padding: '0.22rem 0.75rem',
          borderTop: '1px dashed rgba(0,40,70,0.1)',
          display: 'flex', gap: '0.2rem', flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.4rem', color: 'rgba(0,40,70,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: '0.15rem' }}>Tags</span>
          {passport.tags.slice(0, 4).map(tag => (
            <span key={tag} style={{
              fontSize: '0.5rem', padding: '0.08rem 0.3rem', borderRadius: '3px',
              background: 'rgba(0,80,160,0.07)', color: 'rgba(0,80,160,0.75)',
              border: '1px solid rgba(0,80,160,0.18)',
            }}>
              {tag}
            </span>
          ))}
          {passport.tags.length > 4 && (
            <span style={{ fontSize: '0.5rem', color: 'rgba(0,40,70,0.4)' }}>+{passport.tags.length - 4}</span>
          )}
        </div>
      )}

      {/* ── MRZ zone ── */}
      <div style={{
        background: 'rgba(255,235,220,0.25)',
        borderTop: '1.5px solid rgba(0,40,70,0.12)',
        padding: '0.28rem 0.6rem 0.3rem',
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        userSelect: 'none',
      }}>
        <div style={{ flex: 1, minWidth: 0, fontFamily: '"Courier New", "OCR-B", "Lucida Console", monospace', fontSize: '0.5rem', color: 'rgba(0,20,50,0.6)', letterSpacing: '0.06em', lineHeight: 1.7, overflow: 'hidden' }}>
          <div style={{ overflow: 'hidden', textOverflow: 'clip', whiteSpace: 'nowrap' }}>{mrz1}</div>
          <div style={{ overflow: 'hidden', textOverflow: 'clip', whiteSpace: 'nowrap' }}>{mrz2}</div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onOpenStamps() }}
          title="View stamps & achievements"
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.25rem',
            background: 'rgba(0,50,100,0.12)', border: '1px solid rgba(0,50,100,0.2)',
            borderRadius: '4px', padding: '0.22rem 0.45rem',
            cursor: 'pointer', transition: 'background 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,50,100,0.22)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,50,100,0.12)' }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(0,40,80,0.55)">
            <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
          <span style={{ fontSize: '0.42rem', fontWeight: 700, color: 'rgba(0,40,80,0.65)', letterSpacing: '0.05em' }}>STAMPS</span>
        </button>
      </div>
    </button>
  )
}

// ── Passport edit modal ───────────────────────────────────────────────────────

function PassportEditModal({
  project, initial, onSave, onClose,
}: {
  project: string
  initial: ProjectPassportUpsert
  onSave: (data: ProjectPassportUpsert) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState<ProjectPassportUpsert>(initial)
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageMode, setImageMode] = useState<'url' | 'upload'>(initial.image_url ? 'url' : 'url')

  function set(key: keyof ProjectPassportUpsert, value: string | string[]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true); setError(null)
    try { await onSave(form); onClose() }
    catch (e) { setError(e instanceof Error ? e.message : 'Save failed') }
    finally { setSaving(false) }
  }

  function addTag() {
    const t = tagInput.trim()
    if (t && !form.tags.includes(t)) set('tags', [...form.tags, t])
    setTagInput('')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{
        background: 'var(--surface)', borderRadius: '16px', border: '1px solid var(--border)',
        width: '100%', maxWidth: '640px', maxHeight: '90vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
      }}>
        {/* Header */}
        <div style={{ padding: '1.1rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)' }}>Edit Passport</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{project}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '0.25rem' }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <FormField label="Display Name" value={form.display_name} onChange={v => set('display_name', v)} placeholder={project} />
            <FormField label="Owner" value={form.owner} onChange={v => set('owner', v)} placeholder="Jane Smith" />
            <FormField label="Owner Team" value={form.owner_team} onChange={v => set('owner_team', v)} placeholder="Platform Engineering" />
            <FormField label="Contact Email" value={form.contact_email} onChange={v => set('contact_email', v)} placeholder="team@example.com" type="email" />
            <FormField label="Repository URL" value={form.repository_url} onChange={v => set('repository_url', v)} placeholder="https://github.com/org/repo" />
            <FormField label="Documentation URL" value={form.documentation_url} onChange={v => set('documentation_url', v)} placeholder="https://confluence.example.com/…" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.875rem' }}>
            <FormSelect label="Criticality" value={form.criticality} onChange={v => set('criticality', v)} options={[
              { value: '', label: '— Select —' },
              { value: 'critical', label: 'Critical' },
              { value: 'high',     label: 'High' },
              { value: 'medium',   label: 'Medium' },
              { value: 'low',      label: 'Low' },
            ]} />
            <FormSelect label="Environment" value={form.environment} onChange={v => set('environment', v)} options={[
              { value: '',            label: '— Select —' },
              { value: 'production',  label: 'Production' },
              { value: 'staging',     label: 'Staging' },
              { value: 'development', label: 'Development' },
              { value: 'mixed',       label: 'Mixed' },
            ]} />
            <FormSelect label="Cloud Provider" value={form.cloud_provider} onChange={v => set('cloud_provider', v)} options={[
              { value: '',      label: '— Select —' },
              { value: 'aws',   label: 'AWS' },
              { value: 'azure', label: 'Azure' },
              { value: 'gcp',   label: 'GCP' },
              { value: 'multi', label: 'Multi-Cloud' },
              { value: 'other', label: 'Other' },
            ]} />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Short description of this project…"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {/* Project Image */}
          <div>
            <label style={labelStyle}>Project Image</label>
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
              {(['url', 'upload'] as const).map(m => (
                <button key={m} onClick={() => setImageMode(m)} style={{
                  padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${imageMode === m ? 'var(--waf-brand)' : 'var(--border)'}`,
                  background: imageMode === m ? 'rgba(0,148,255,0.1)' : 'var(--bg)',
                  color: imageMode === m ? 'var(--waf-brand)' : 'var(--muted)',
                }}>
                  {m === 'url' ? 'URL' : 'Upload'}
                </button>
              ))}
              {form.image_url && (
                <button onClick={() => set('image_url', '')} style={{ marginLeft: 'auto', padding: '0.25rem 0.65rem', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(218,44,56,0.35)', background: 'rgba(218,44,56,0.07)', color: '#f87171' }}>
                  Clear
                </button>
              )}
            </div>
            {imageMode === 'url' ? (
              <input
                type="url"
                value={form.image_url}
                onChange={e => set('image_url', e.target.value)}
                placeholder="https://example.com/logo.png"
                style={inputStyle}
              />
            ) : (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                <div style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--muted)', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Choose file…
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                  {form.image_url && form.image_url.startsWith('data:') ? 'Image loaded' : 'PNG, JPG, SVG — max ~200 KB'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = ev => set('image_url', ev.target?.result as string ?? '')
                    reader.readAsDataURL(file)
                  }}
                />
              </label>
            )}
            {form.image_url && (
              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <img src={form.image_url} alt="preview" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)' }} />
                <span style={{ fontSize: '0.68rem', color: 'var(--muted)' }}>Preview</span>
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label style={labelStyle}>Tags</label>
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder="Add tag and press Enter"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={addTag} style={{ padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.78rem' }}>Add</button>
            </div>
            {form.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {form.tags.map(tag => (
                  <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '999px', background: 'rgba(0,148,255,0.08)', color: '#60a5fa', border: '1px solid rgba(0,148,255,0.2)' }}>
                    {tag}
                    <button onClick={() => set('tags', form.tags.filter(t => t !== tag))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', color: '#60a5fa', lineHeight: 1, fontSize: '0.8rem' }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Internal notes, links, context…"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {error && (
            <div style={{ fontSize: '0.78rem', color: '#f87171', padding: '0.5rem 0.75rem', background: 'rgba(218,44,56,0.08)', borderRadius: '8px', border: '1px solid rgba(218,44,56,0.25)' }}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.875rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1.1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ padding: '0.5rem 1.4rem', borderRadius: '8px', border: 'none', background: saving ? 'var(--border)' : 'var(--waf-brand)', color: '#fff', cursor: saving ? 'default' : 'pointer', fontSize: '0.82rem', fontWeight: 700 }}>
            {saving ? 'Saving…' : 'Save Passport'}
          </button>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.68rem', fontWeight: 600, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem',
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg)', color: 'var(--text)',
  border: '1px solid var(--border)', borderRadius: '8px',
  padding: '0.4rem 0.6rem', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box',
}

function FormField({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  )
}

function FormSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const VIEW_MODES: { id: ViewMode; label: string; icon: string }[] = [
  { id: 'grid', label: 'Compact grid',
    icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
  { id: 'wide', label: 'Wide cards',
    icon: 'M3 10h18M3 14h18M3 6h18M3 18h18' },
  { id: 'list', label: 'Row list',
    icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
]

export default function PassportDashboardPage({ runs, role, onOpenProject }: Props) {
  const [passports, setPassports] = useState<ProjectPassport[]>([])
  const [loading, setLoading] = useState(true)
  const [editingProject, setEditingProject] = useState<string | null>(null)
  const [stampsProject, setStampsProject] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('wafpass_passport_view')
    return (saved === 'grid' || saved === 'wide' || saved === 'list') ? saved : 'grid'
  })

  useEffect(() => {
    fetchProjectPassports()
      .then(setPassports)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const passportMap = useMemo(
    () => Object.fromEntries(passports.map(p => [p.project, p])),
    [passports],
  )

  const allProjects = useMemo(() => {
    const s = new Set<string>([
      ...runs.map(r => r.project || '(unnamed)'),
      ...passports.map(p => p.project),
    ])
    return Array.from(s).sort()
  }, [runs, passports])

  const filtered = useMemo(() => {
    if (!search.trim()) return allProjects
    const q = search.toLowerCase()
    return allProjects.filter(p => {
      const pp = passportMap[p]
      return p.toLowerCase().includes(q)
        || pp?.display_name.toLowerCase().includes(q)
        || pp?.owner.toLowerCase().includes(q)
        || pp?.owner_team.toLowerCase().includes(q)
        || pp?.tags.some(t => t.toLowerCase().includes(q))
    })
  }, [allProjects, passportMap, search])

  async function handleSave(project: string, data: ProjectPassportUpsert) {
    const saved = await upsertProjectPassport(project, data)
    setPassports(prev => {
      const idx = prev.findIndex(p => p.project === project)
      return idx >= 0 ? prev.map((p, i) => i === idx ? saved : p) : [...prev, saved]
    })
  }

  async function openEdit(project: string) {
    if (!passportMap[project]) {
      const existing = await fetchProjectPassport(project).catch(() => null)
      if (existing) setPassports(prev => [...prev.filter(p => p.project !== project), existing])
    }
    setEditingProject(project)
  }

  const editingPassport = editingProject ? passportMap[editingProject] : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 220px' }}>
          <svg width="14" height="14" fill="none" stroke="var(--muted)" viewBox="0 0 24 24" style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects, owners, tags…"
            style={{ width: '100%', paddingLeft: '2rem', padding: '0.4rem 0.75rem 0.4rem 2rem', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
          {filtered.length} project{filtered.length !== 1 ? 's' : ''}
        </div>
        {/* View toggle */}
        <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
          {VIEW_MODES.map(vm => (
            <button
              key={vm.id}
              title={vm.label}
              onClick={() => { setViewMode(vm.id); localStorage.setItem('wafpass_passport_view', vm.id) }}
              style={{
                padding: '0.35rem 0.55rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: viewMode === vm.id ? 'rgba(0,148,255,0.12)' : 'transparent',
                color: viewMode === vm.id ? 'var(--waf-brand)' : 'var(--muted)',
                borderRight: vm.id !== 'list' ? '1px solid var(--border)' : 'none',
                transition: 'background 0.12s, color 0.12s',
              }}
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={vm.icon} />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '4rem', fontSize: '0.85rem' }}>
          {search ? 'No projects match your search.' : 'No projects found. Push a scan to create the first project.'}
        </div>
      ) : viewMode === 'list' ? (
        /* ── Row list ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {filtered.map(project => (
            <div key={project} style={{ position: 'relative' }}>
              <PassportRow
                project={project}
                passport={passportMap[project] ?? null}
                runs={runs}
                onClick={() => onOpenProject(project)}
              />
              {canEdit(role) && (
                <button
                  onClick={e => { e.stopPropagation(); openEdit(project) }}
                  title="Edit passport"
                  style={{
                    position: 'absolute', top: '0.4rem', right: '0.4rem',
                    width: '24px', height: '24px', borderRadius: '5px',
                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* ── Card grid (compact or wide) ── */
        <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'wide' ? 'repeat(auto-fill, minmax(400px, 1fr))' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {filtered.map(project => {
            const pp = passportMap[project] ?? null
            const ppRuns = runs.filter(r => (r.project || '(unnamed)') === project)
            const bestScore = ppRuns.reduce((m, r) => Math.max(m, r.score), 0)
            const displayName = pp?.display_name || project
            return (
              <div key={project} style={{ position: 'relative' }}>
                <PassportCard
                  project={project}
                  passport={pp}
                  runs={runs}
                  onClick={() => { setStampsProject(null); onOpenProject(project) }}
                  onOpenStamps={() => setStampsProject(prev => prev === project ? null : project)}
                />
                {canEdit(role) && (
                  <button
                    onClick={e => { e.stopPropagation(); openEdit(project) }}
                    title="Edit passport"
                    style={{
                      position: 'absolute', top: '0.5rem', right: '0.5rem',
                      width: '26px', height: '26px', borderRadius: '6px',
                      background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
                {stampsProject === project && (
                  <AchievementsOverlay
                    onClose={() => setStampsProject(null)}
                    projectRuns={ppRuns}
                    bestScore={bestScore}
                    displayName={displayName}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Edit modal ── */}
      {editingProject && (
        <PassportEditModal
          project={editingProject}
          initial={editingPassport
            ? { display_name: editingPassport.display_name, owner: editingPassport.owner, owner_team: editingPassport.owner_team, contact_email: editingPassport.contact_email, description: editingPassport.description, criticality: editingPassport.criticality, environment: editingPassport.environment, cloud_provider: editingPassport.cloud_provider, repository_url: editingPassport.repository_url, documentation_url: editingPassport.documentation_url, tags: editingPassport.tags, notes: editingPassport.notes, image_url: editingPassport.image_url }
            : EMPTY_PASSPORT
          }
          onSave={data => handleSave(editingProject, data)}
          onClose={() => setEditingProject(null)}
        />
      )}
    </div>
  )
}
