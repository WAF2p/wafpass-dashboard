import { useEffect, useState, useMemo } from 'react'
import { fetchProjectPassports, fetchProjectPassport, getApiBase, upsertProjectPassport, deleteProject, ProjectPassport, ProjectPassportUpsert, RunSummary } from '../api'
import { MATURITY_META } from './settingsUtils'

interface Props {
  runs: RunSummary[]
  role: string
  onOpenProject: (project: string) => void
  onRefetchRuns?: () => void
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
  aws:      { label: 'AWS',         color: '#f97316' },
  azure:    { label: 'Azure',       color: '#2b7fff' },
  gcp:      { label: 'GCP',         color: '#22c55e' },
  alicloud: { label: 'Alibaba Cloud', color: '#ff6a00' },
  yandex:   { label: 'Yandex Cloud',  color: '#fcdb03' },
  oci:      { label: 'OCI',           color: '#c74634' },
  ovh:      { label: 'OVH',           color: '#0046a3' },
  hetzner:  { label: 'Hetzner',       color: '#ff0000' },
  stackit:  { label: 'STACKIT',       color: '#242424' },
  multi:    { label: 'Multi-Cloud',   color: '#8b5cf6' },
  other:    { label: 'Other',         color: '#94a3b8' },
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
      className="pp-link-btn"
    >
      {children}
    </a>
  )
}

function RepoIcon({ url }: { url: string }) {
  const type = detectRepoType(url)
  if (type === 'github') return (
    <LinkIconButton href={url} title="GitHub Repository">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
      </svg>
    </LinkIconButton>
  )
  if (type === 'gitlab') return (
    <LinkIconButton href={url} title="GitLab Repository">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51 1.22 3.78a.84.84 0 0 1-.3.92z" />
      </svg>
    </LinkIconButton>
  )
  if (type === 'bitbucket') return (
    <LinkIconButton href={url} title="Bitbucket Repository">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.515.868 1.022.868h15.387c.38 0 .71-.258.79-.63l3.263-19.845a.768.768 0 0 0-.768-.895zM14.78 15.959H9.234L7.616 8.04h8.777z" />
      </svg>
    </LinkIconButton>
  )
  return (
    <LinkIconButton href={url} title="Repository">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
      </svg>
    </LinkIconButton>
  )
}

function DocsIcon({ url }: { url: string }) {
  const type = detectDocsType(url)
  if (type === 'confluence') return (
    <LinkIconButton href={url} title="Confluence Documentation">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M.887 18.168c-.28.459-.523.852-.71 1.161-.41.687-.117 1.567.635 1.877l3.783 1.552c.737.302 1.579-.055 1.896-.786.177-.409.413-.905.686-1.44C9.26 17.252 11.374 16.05 14.745 16c3.473-.052 6.072 1.267 7.944 3.638.463.589 1.293.738 1.938.34l3.33-2.059a1.377 1.377 0 0 0 .39-1.924C25.494 12.44 21.417 9 14.793 9 8.248 9 3.535 12.63.887 18.168zm22.226-12.336c.28-.459.523-.852.71-1.161.41-.687.117-1.567-.635-1.877L19.405 1.242c-.737-.302-1.579.055-1.896.786-.177.409-.413.905-.686 1.44C14.74 6.748 12.626 7.95 9.255 8c-3.473.052-6.072-1.267-7.944-3.638A1.378 1.378 0 0 0-.627 4.022L-3.957 6.08a1.377 1.377 0 0 0-.39 1.924C-.494 11.56 3.583 15 10.207 15c6.545 0 11.258-3.63 13.906-9.168z" />
      </svg>
    </LinkIconButton>
  )
  if (type === 'notion') return (
    <LinkIconButton href={url} title="Notion Documentation">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.447-.093-1.961-.747l-3.13-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
      </svg>
    </LinkIconButton>
  )
  if (type === 'gitbook') return (
    <LinkIconButton href={url} title="GitBook Documentation">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M10.802 17.77a.703.703 0 1 1-.002 1.406.703.703 0 0 1 .002-1.406m11.024-4.347a.703.703 0 1 1 .001-1.406.703.703 0 0 1-.001 1.406M3.136 14.12a.703.703 0 1 1 .001-1.407.703.703 0 0 1-.001 1.407m17.323-9.91a2.11 2.11 0 1 0 .001 4.22 2.11 2.11 0 0 0 0-4.22m0 3.164a1.054 1.054 0 1 1 0-2.11 1.054 1.054 0 0 1 0 2.11m-14.86-3.164a2.11 2.11 0 1 0 0 4.22 2.11 2.11 0 0 0 0-4.22m0 3.164a1.054 1.054 0 1 1 0-2.11 1.054 1.054 0 0 1 0 2.11" />
      </svg>
    </LinkIconButton>
  )
  return (
    <LinkIconButton href={url} title="Documentation">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    </LinkIconButton>
  )
}

// ── Passport data field ─────────────────────────────────────────────────────────

function PassportDataField({
  label, value, bold = false, valueColor, small = false,
}: {
  label: string; value: string; bold?: boolean; valueColor?: string; small?: boolean
}) {
  return (
    <div className="pp-field">
      <div className="pp-field-label">{label}</div>
      <div
        className="pp-field-value"
        style={{
          fontSize: small ? '0.72rem' : '0.82rem',
          fontWeight: bold ? 800 : 700,
          color: valueColor ?? 'var(--text)',
        }}
      >
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
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="pp-seal">
      <polygon points={rays} fill={color} opacity="0.9" />
      <circle cx={cx} cy={cy} r={size * 0.31} fill={color} />
      <circle cx={cx} cy={cy} r={size * 0.27} fill="rgba(255,255,255,0.25)" />
      <text x={cx} y={cy - 3} textAnchor="middle" dominantBaseline="central"
        fill={textColor} fontSize={size * 0.2} fontWeight="900"
        fontFamily="system-ui,-apple-system,sans-serif">L{level}</text>
      <text x={cx} y={cy + size * 0.12} textAnchor="middle" dominantBaseline="central"
        fill={textColor} fontSize={size * 0.1} fontWeight="700" opacity="0.9"
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
    <div
      className="pp-stamp"
      style={{
        transform: `rotate(${rotation}deg)`,
        opacity: earned ? 1 : 0.14,
      }}
    >
      <div className="pp-stamp-ring" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
          <circle cx={r} cy={r} r={r - 3} fill={`${color}12`} stroke={color} strokeWidth="2.5" />
          <circle cx={r} cy={r} r={r - 10} fill="none" stroke={color} strokeWidth="1" strokeDasharray="3 2" opacity="0.6" />
        </svg>
        <div className="pp-stamp-icon">
          <svg width={size * 0.32} height={size * 0.32} fill="none" stroke={color} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={icon} />
          </svg>
        </div>
        {earned && (
          <div className="pp-stamp-check" style={{ background: color }}>
            <svg width="8" height="8" fill="none" stroke="#fff" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
      <div className="pp-stamp-text" style={{ maxWidth: size + 12 }}>
        <div className="pp-stamp-title" style={{ color: earned ? 'var(--text)' : 'var(--muted)' }}>{title}</div>
        {subtitle && <div className="pp-stamp-sub">{subtitle}</div>}
      </div>
    </div>
  )
}

// ── Access denied overlay ─────────────────────────────────────────────────────

function AccessDeniedOverlay({
  onClose, project,
}: {
  onClose: () => void
  project: string
}) {
  return (
    <div className="pp-overlay-backdrop" onClick={onClose}>
      <div className="pp-modal pp-modal--access" onClick={e => e.stopPropagation()}>
        <div className="pp-modal-header pp-modal-header--danger">
          <div>
            <div className="pp-modal-kicker">WAF++ · PROJECT PASSPORT</div>
            <div className="pp-modal-title" style={{ maxWidth: 280 }}>{project}</div>
          </div>
          <button className="pp-modal-close" onClick={onClose}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="pp-modal-body pp-modal-body--center">
          <div className="pp-access-icon">
            <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="pp-access-title">Access Denied</div>
          <div className="pp-access-text">
            You do not have access to this project. Contact your administrator to request access.
          </div>
        </div>
        <div className="pp-modal-mrz">
          {`PP<NO ACCESS FOR<PROJECT`.padEnd(44, '<')}
        </div>
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
    <div className="pp-overlay-backdrop" onClick={onClose}>
      <div className="pp-modal pp-modal--stamps" onClick={e => e.stopPropagation()}>
        <div className="pp-modal-header pp-modal-header--brand">
          <div>
            <div className="pp-modal-kicker">WAF++ · STAMP COLLECTION</div>
            <div className="pp-modal-title" style={{ maxWidth: 340 }}>{displayName}</div>
          </div>
          <button className="pp-modal-close" onClick={onClose}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="pp-modal-tabs">
          {[
            { label: `Maturity Levels`, sub: `${earnedMaturity} / ${MATURITY_META.length} earned`, index: 0 },
            { label: `Achievements`,    sub: `${earnedAchievements} / ${STAMP_ACHIEVEMENTS.length} earned`, index: 1 },
          ].map(tab => (
            <button
              key={tab.index}
              onClick={() => setStampPage(tab.index as 0 | 1)}
              className={`pp-modal-tab ${stampPage === tab.index ? 'active' : ''}`}
            >
              <div className="pp-modal-tab-label">{tab.label}</div>
              <div className="pp-modal-tab-sub">{tab.sub}</div>
            </button>
          ))}
        </div>

        <div className="pp-modal-body">
          {stampPage === 0 ? (
            <div className="pp-stamp-grid">
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
            <div className="pp-stamp-grid pp-stamp-grid--achievements">
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

        <div className="pp-modal-mrz">
          {`PP<WAF${mrzPad(displayName, 18)}<<STAMP<COLLECTION<<<<<<<<<<<<<<<<<`.slice(0, 44).padEnd(44, '<')}
        </div>
      </div>
    </div>
  )
}

// ── View mode ─────────────────────────────────────────────────────────────────

type ViewMode = 'grid' | 'wide' | 'list'

// ── Shared card data hook ─────────────────────────────────────────────────────

function usePassportCardData(project: string, passport: ProjectPassport | null, runs: RunSummary[]) {
  const projectRuns  = runs.filter(r => (r.project || '(unnamed)') === project)
  const sortedRuns   = [...projectRuns].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const latestRun    = sortedRuns[sortedRuns.length - 1]
  const bestScore    = projectRuns.reduce((m, r) => Math.max(m, r.score), 0)
  const latestScore  = latestRun?.score ?? 0
  const prevScore    = sortedRuns[sortedRuns.length - 2]?.score ?? latestScore
  const scoreDelta   = projectRuns.length >= 2 ? latestScore - prevScore : null
  const avgScore     = projectRuns.length > 0 ? Math.round(projectRuns.reduce((s, r) => s + r.score, 0) / projectRuns.length) : 0
  const sparkRuns    = sortedRuns.slice(-8)
  const latestControls = latestRun ? { run: latestRun.controls_run, loaded: latestRun.controls_loaded } : null
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
  return { projectRuns, latestRun, bestScore, latestScore, prevScore, scoreDelta, avgScore, sparkRuns, latestControls, maturity, criticality, env, cloud, displayName, achievementCount, mrz1, mrz2 }
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

  return (
    <button onClick={onClick} className="pp-row">
      <div className="pp-row-main">
        <div className="pp-row-accent" style={{ background: maturity.color }} />
        <div className="pp-row-seal">
          {passport?.image_url ? (
            <img src={passport.image_url} alt="" />
          ) : (
            <MaturitySeal level={maturity.level} color={maturity.color} textColor={maturity.textColor} size={40} />
          )}
        </div>

        <div className="pp-row-info">
          <div className="pp-row-name">{displayName}</div>
          {passport?.display_name && passport.display_name !== project && (
            <div className="pp-row-id">{project}</div>
          )}
          {passport?.description ? (
            <div className="pp-row-desc">{passport.description}</div>
          ) : (
            <div className="pp-row-desc pp-row-desc--empty">No description</div>
          )}
        </div>

        <div className="pp-row-owner">
          {passport?.owner ? (
            <div className="pp-field">
              <div className="pp-field-label">Owner</div>
              <div className="pp-field-value">{passport.owner}</div>
            </div>
          ) : (
            <div className="pp-row-desc--empty">No owner</div>
          )}
          {passport?.owner_team && (
            <div className="pp-field">
              <div className="pp-field-label">Team</div>
              <div className="pp-field-value" style={{ fontWeight: 600, color: 'var(--muted)' }}>{passport.owner_team}</div>
            </div>
          )}
        </div>

        <div className="pp-row-badges">
          {criticality && <span className="pp-pill" style={{ background: criticality.bg, color: criticality.color, borderColor: `${criticality.color}33` }}>{criticality.label}</span>}
          {env && <span className="pp-pill" style={{ background: `${env.color}10`, color: env.color, borderColor: `${env.color}30` }}>{env.label}</span>}
          {cloud && <span className="pp-pill" style={{ background: `${cloud.color}10`, color: cloud.color, borderColor: `${cloud.color}30` }}>{cloud.label}</span>}
          {!criticality && !env && !cloud && <span className="pp-row-desc--empty">—</span>}
        </div>

        <div className="pp-row-score">
          <div className="pp-score-big" style={{ color: scoreColor(bestScore) }}>{bestScore > 0 ? bestScore : '—'}</div>
          <div className="pp-score-label">/ 100</div>
          <div className="pp-row-meta">{projectRuns.length} scan{projectRuns.length !== 1 ? 's' : ''}</div>
          {achievementCount > 0 && (
            <div className="pp-row-achievements">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
              {achievementCount}
            </div>
          )}
        </div>

        <div className="pp-row-actions">
          {(passport?.repository_url || passport?.documentation_url) && (
            <div className="pp-row-links">
              {passport?.repository_url && <RepoIcon url={passport.repository_url} />}
              {passport?.documentation_url && <DocsIcon url={passport.documentation_url} />}
            </div>
          )}
          {latestRun && (
            <div className="pp-row-meta">{new Date(latestRun.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}</div>
          )}
          <a
            href={`${getApiBase() || ''}/public/badge/${encodeURIComponent(project)}/download`}
            download={`wafpass-badge-${project}.svg`}
            onClick={e => e.stopPropagation()}
            title="Download SVG badge"
            className="pp-row-badge"
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Badge</span>
          </a>
        </div>
      </div>
      <div className="pp-row-mrz">{mrz1}</div>
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
  const { projectRuns, latestRun, bestScore, latestScore, scoreDelta, avgScore, sparkRuns, latestControls, maturity, criticality, env, cloud, displayName, achievementCount, mrz1, mrz2 } =
    usePassportCardData(project, passport, runs)

  return (
    <button onClick={onClick} className="pp-card">
      <div className="pp-card-banner" style={{ background: `linear-gradient(135deg, ${maturity.color}22 0%, ${maturity.color}08 100%)` }}>
        <div className="pp-card-score">
          <div className="pp-score-big" style={{ color: scoreColor(bestScore) }}>{bestScore > 0 ? bestScore : '—'}</div>
          <div className="pp-score-label">/ 100</div>
        </div>
        <div className="pp-card-seal">
          {passport?.image_url ? (
            <img src={passport.image_url} alt="" />
          ) : (
            <MaturitySeal level={maturity.level} color={maturity.color} textColor={maturity.textColor} size={58} />
          )}
        </div>
        <div className="pp-card-maturity" style={{ background: maturity.color, color: '#fff' }}>
          {maturity.short?.toUpperCase() ?? `L${maturity.level}`}
        </div>
        {achievementCount > 0 && (
          <div className="pp-card-achievements">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
            {achievementCount}
          </div>
        )}
      </div>

      <div className="pp-card-doc-header">
        <div>
          <div className="pp-card-doc-title">PROJECT PASSPORT</div>
          <div className="pp-card-doc-sub">WAF++ SECURITY PLATFORM</div>
        </div>
        <div className="pp-card-doc-fields">
          {[{ label: 'Type', value: 'PP' }, { label: 'Code', value: 'WAF' }, { label: 'No.', value: project.replace(/[^A-Z0-9]/gi, '').slice(0, 7).toUpperCase() || '—' }].map(f => (
            <div key={f.label}>
              <div className="pp-card-doc-label">{f.label}</div>
              <div className="pp-card-doc-value">{f.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="pp-card-body">
        <div className="pp-card-photo">
          {passport?.image_url ? (
            <img src={passport.image_url} alt="" />
          ) : (
            <div className="pp-card-photo-placeholder">
              <span>{displayName[0]?.toUpperCase() ?? '?'}</span>
              <small>L{maturity.level}</small>
            </div>
          )}
        </div>
        <div className="pp-card-fields">
          <PassportDataField label="Project / Name" value={displayName} bold />
          <PassportDataField label="Owner" value={passport?.owner ?? '—'} />
          {passport?.owner_team && <PassportDataField label="Team" value={passport.owner_team} />}
          {passport?.contact_email && <PassportDataField label="Contact" value={passport.contact_email} small />}
          <div className="pp-card-field-row">
            <PassportDataField label="Criticality" value={criticality?.label ?? '—'} valueColor={criticality?.color} />
            <PassportDataField label="Environment" value={env?.label ?? '—'} valueColor={env?.color} />
          </div>
          <div className="pp-card-field-row">
            <PassportDataField label="Cloud" value={cloud?.label ?? '—'} valueColor={cloud?.color} />
            <PassportDataField
              label="Issued"
              value={passport?.created_at
                ? new Date(passport.created_at).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })
                : latestRun
                  ? new Date(latestRun.created_at).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })
                  : '—'
              }
              small
            />
          </div>
          <div className="pp-card-field-row pp-card-field-row--end">
            <PassportDataField
              label="Last scan"
              value={latestRun
                ? new Date(latestRun.created_at).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: '2-digit' })
                : '—'
              }
              small
            />
            {(passport?.repository_url || passport?.documentation_url) && (
              <div className="pp-card-links">
                {passport.repository_url && <RepoIcon url={passport.repository_url} />}
                {passport.documentation_url && <DocsIcon url={passport.documentation_url} />}
              </div>
            )}
          </div>
        </div>
      </div>

      {projectRuns.length > 0 && (
        <div className="pp-card-performance">
          {sparkRuns.length > 1 && (
            <svg width={sparkRuns.length * 8} height="24" className="pp-sparkline">
              {sparkRuns.map((r, i) => {
                const h = Math.max(3, Math.round((r.score / 100) * 18))
                return <rect key={r.id} x={i * 8} y={24 - h} width="6" height={h} rx="2" fill={scoreColor(r.score)} />
              })}
            </svg>
          )}
          <div className="pp-card-latest">
            <span className="pp-score-mid" style={{ color: scoreColor(latestScore) }}>{latestScore > 0 ? latestScore : '—'}</span>
            <span className="pp-score-label">latest</span>
            {scoreDelta !== null && scoreDelta !== 0 && (
              <span className="pp-card-delta" style={{ color: scoreDelta > 0 ? '#16a34a' : '#dc2626' }}>
                {scoreDelta > 0 ? `↑${scoreDelta}` : `↓${Math.abs(scoreDelta)}`}
              </span>
            )}
          </div>
          <div className="pp-card-divider" />
          <div className="pp-card-stats">
            {[
              { label: 'avg', value: avgScore > 0 ? String(avgScore) : '—' },
              { label: 'scans', value: String(projectRuns.length) },
              ...(latestControls && latestControls.loaded > 0 ? [{ label: 'coverage', value: `${Math.round((latestControls.run / latestControls.loaded) * 100)}%` }] : []),
            ].map(s => (
              <div key={s.label} className="pp-mini-stat">
                <span className="pp-mini-stat-value">{s.value}</span>
                <span className="pp-mini-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {passport?.tags && passport.tags.length > 0 && (
        <div className="pp-card-tags">
          <span className="pp-card-tags-label">Tags</span>
          {passport.tags.slice(0, 4).map(tag => (
            <span key={tag} className="pp-tag">{tag}</span>
          ))}
          {passport.tags.length > 4 && <span className="pp-card-tags-more">+{passport.tags.length - 4}</span>}
        </div>
      )}

      <div className="pp-card-footer">
        <div className="pp-card-mrz">
          <div>{mrz1}</div>
          <div>{mrz2}</div>
        </div>
        <div className="pp-card-footer-actions">
          <a
            href={`${getApiBase() || ''}/public/badge/${encodeURIComponent(project)}/download`}
            download={`wafpass-badge-${project}.svg`}
            onClick={e => e.stopPropagation()}
            title="Download SVG badge"
            className="pp-btn-ghost pp-btn-ghost--sm"
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Badge</span>
          </a>
          <button
            onClick={e => { e.stopPropagation(); onOpenStamps() }}
            title="View stamps & achievements"
            className="pp-btn-ghost pp-btn-ghost--sm"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            <span>Stamps</span>
          </button>
        </div>
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
    <div className="pp-modal-backdrop">
      <div className="pp-modal pp-modal--edit">
        <div className="pp-modal-header">
          <div>
            <div className="pp-modal-title">Edit Passport</div>
            <div className="pp-modal-subtitle">{project}</div>
          </div>
          <button className="pp-modal-close" onClick={onClose}>
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="pp-modal-body pp-modal-body--form">
          <div className="pp-form-grid pp-form-grid--2">
            <FormField label="Display Name" value={form.display_name} onChange={v => set('display_name', v)} placeholder={project} />
            <FormField label="Owner" value={form.owner} onChange={v => set('owner', v)} placeholder="Jane Smith" />
            <FormField label="Owner Team" value={form.owner_team} onChange={v => set('owner_team', v)} placeholder="Platform Engineering" />
            <FormField label="Contact Email" value={form.contact_email} onChange={v => set('contact_email', v)} placeholder="team@example.com" type="email" />
            <FormField label="Repository URL" value={form.repository_url} onChange={v => set('repository_url', v)} placeholder="https://github.com/org/repo" />
            <FormField label="Documentation URL" value={form.documentation_url} onChange={v => set('documentation_url', v)} placeholder="https://confluence.example.com/…" />
          </div>

          <div className="pp-form-grid pp-form-grid--3">
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
              { value: '',       label: '— Select —' },
              { value: 'aws',    label: 'AWS' },
              { value: 'azure',  label: 'Azure' },
              { value: 'gcp',    label: 'GCP' },
              { value: 'alicloud', label: 'Alibaba Cloud' },
              { value: 'yandex',   label: 'Yandex Cloud' },
              { value: 'oci',      label: 'OCI' },
              { value: 'ovh',      label: 'OVH' },
              { value: 'hetzner',  label: 'Hetzner' },
              { value: 'stackit',  label: 'STACKIT' },
              { value: 'multi',    label: 'Multi-Cloud' },
              { value: 'other',    label: 'Other' },
            ]} />
          </div>

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

          <div>
            <label style={labelStyle}>Project Image</label>
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
              {(['url', 'upload'] as const).map(m => (
                <button key={m} onClick={() => setImageMode(m)} className={`pp-image-toggle ${imageMode === m ? 'active' : ''}`}>
                  {m === 'url' ? 'URL' : 'Upload'}
                </button>
              ))}
              {form.image_url && (
                <button onClick={() => set('image_url', '')} className="pp-image-clear">Clear</button>
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
              <label className="pp-file-upload">
                <div className="pp-file-btn">Choose file…</div>
                <span>{form.image_url && form.image_url.startsWith('data:') ? 'Image loaded' : 'PNG, JPG, SVG — max ~200 KB'}</span>
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
              <div className="pp-image-preview">
                <img src={form.image_url} alt="preview" />
                <span>Preview</span>
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Tags</label>
            <div className="pp-tag-input">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder="Add tag and press Enter"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={addTag} className="pp-btn-secondary">Add</button>
            </div>
            {form.tags.length > 0 && (
              <div className="pp-tag-list">
                {form.tags.map(tag => (
                  <span key={tag} className="pp-tag-chip">
                    {tag}
                    <button onClick={() => set('tags', form.tags.filter(t => t !== tag))}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

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
            <div className="pp-form-error">{error}</div>
          )}
        </div>

        <div className="pp-modal-footer">
          <button onClick={onClose} className="pp-btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="pp-btn-primary">
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
  padding: '0.45rem 0.65rem', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box',
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

function getAccessibleProjectsFromRuns(runs: RunSummary[], role: string): Set<string> {
  if (role === 'admin') {
    return new Set<string>()
  }
  return new Set(runs.map(r => r.project || '(unnamed)').filter(Boolean))
}

export default function PassportDashboardPage({ runs, role, onOpenProject, onRefetchRuns }: Props) {
  const [passports, setPassports] = useState<ProjectPassport[]>([])
  const [loading, setLoading] = useState(true)
  const [editingProject, setEditingProject] = useState<string | null>(null)
  const [stampsProject, setStampsProject] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('wafpass_passport_view')
    return (saved === 'grid' || saved === 'wide' || saved === 'list') ? saved : 'grid'
  })
  const [accessDeniedProject, setAccessDeniedProject] = useState<string | null>(null)

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

  const accessibleProjects = useMemo(() => {
    return getAccessibleProjectsFromRuns(runs, role)
  }, [runs, role])

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

  const accessibleFilteredProjects = useMemo(() => {
    if (role === 'admin') return filtered
    return filtered.filter(p => accessibleProjects.has(p))
  }, [filtered, accessibleProjects, role])

  const inaccessibleProjects = useMemo(() => {
    if (role === 'admin') return []
    return allProjects.filter(p => !accessibleProjects.has(p))
  }, [allProjects, accessibleProjects, role])

  async function handleSave(project: string, data: ProjectPassportUpsert) {
    const saved = await upsertProjectPassport(project, data)
    setPassports(prev => {
      const idx = prev.findIndex(p => p.project === project)
      return idx >= 0 ? prev.map((p, i) => i === idx ? saved : p) : [...prev, saved]
    })
  }

  async function handleDelete(project: string) {
    const projectRuns = runs.filter(r => r.project === project)
    if (!confirm(`Delete project "${project}" and all ${projectRuns.length} run(s)? This action cannot be undone.`)) return
    try {
      await deleteProject(project)
      await fetchProjectPassports().then(setPassports).catch(() => {})
      onRefetchRuns?.()
    } catch (err) {
      console.error('Failed to delete project:', err)
      alert(`Failed to delete project: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
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
    <div className="pp-root">
      <style>{passportCss}</style>

      <div className="pp-toolbar">
        <div className="pp-search">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search projects, owners, tags…"
          />
        </div>
        <div className="pp-count">
          {accessibleFilteredProjects.length} project{accessibleFilteredProjects.length !== 1 ? 's' : ''} visible
          {inaccessibleProjects.length > 0 && role !== 'admin' && (
            <span className="pp-count-hidden">{inaccessibleProjects.length} hidden</span>
          )}
        </div>
        <div className="pp-segment">
          {VIEW_MODES.map(vm => (
            <button
              key={vm.id}
              title={vm.label}
              onClick={() => { setViewMode(vm.id); localStorage.setItem('wafpass_passport_view', vm.id) }}
              className={viewMode === vm.id ? 'active' : ''}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={vm.icon} />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="pp-skeleton-grid">
          <div className="pp-skeleton" />
          <div className="pp-skeleton" />
          <div className="pp-skeleton" />
          <div className="pp-skeleton" />
          <div className="pp-skeleton wide" />
          <div className="pp-skeleton wide" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="pp-empty">
          <div className="pp-empty-icon">
            <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4h16v16H4z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 9h6v6H9z" />
            </svg>
          </div>
          <div className="pp-empty-title">{search ? 'No projects match your search.' : 'No projects found'}</div>
          <div className="pp-empty-text">
            {search ? 'Try a different keyword or clear the filter.' : 'Push a scan to create the first project passport.'}
          </div>
        </div>
      ) : viewMode === 'list' ? (
        <>
          <div className="pp-list">
            {accessibleFilteredProjects.map(project => (
              <div key={project} className="pp-list-item">
                <PassportRow
                  project={project}
                  passport={passportMap[project] ?? null}
                  runs={runs}
                  onClick={() => onOpenProject(project)}
                />
                {canEdit(role) && (
                  <div className="pp-item-actions">
                    <button onClick={e => { e.stopPropagation(); openEdit(project) }} title="Edit passport" className="pp-action-edit">
                      <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(project) }} title="Delete project" className="pp-action-delete">
                      <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {!canEdit(role) && inaccessibleProjects.length > 0 && (
            <div className="pp-list">
              {inaccessibleProjects.map(project => (
                <div key={project} className="pp-list-item pp-list-item--locked">
                  <PassportRow
                    project={project}
                    passport={passportMap[project] ?? null}
                    runs={runs}
                    onClick={() => setAccessDeniedProject(project)}
                  />
                  <div
                    className="pp-lock-overlay"
                    onClick={e => { e.stopPropagation(); setAccessDeniedProject(project) }}
                    title="You don't have access to this project"
                  >
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V9a3 3 0 00-6 0v4h6z" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className={viewMode === 'wide' ? 'pp-grid pp-grid--wide' : 'pp-grid'}>
            {accessibleFilteredProjects.map(project => {
              const pp = passportMap[project] ?? null
              const ppRuns = runs.filter(r => (r.project || '(unnamed)') === project)
              const bestScore = ppRuns.reduce((m, r) => Math.max(m, r.score), 0)
              const displayName = pp?.display_name || project
              return (
                <div key={project} className="pp-grid-item">
                  <PassportCard
                    project={project}
                    passport={pp}
                    runs={runs}
                    onClick={() => { setStampsProject(null); onOpenProject(project) }}
                    onOpenStamps={() => setStampsProject(prev => prev === project ? null : project)}
                  />
                  {canEdit(role) && (
                    <div className="pp-item-actions pp-item-actions--card">
                      <button onClick={e => { e.stopPropagation(); openEdit(project) }} title="Edit passport" className="pp-action-edit">
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button onClick={e => { e.stopPropagation(); handleDelete(project) }} title="Delete project" className="pp-action-delete">
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
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
          {!canEdit(role) && inaccessibleProjects.length > 0 && (
            <div className={viewMode === 'wide' ? 'pp-grid pp-grid--wide' : 'pp-grid'}>
              {inaccessibleProjects.map(project => {
                const pp = passportMap[project] ?? null
                const ppRuns = runs.filter(r => (r.project || '(unnamed)') === project)
                const bestScore = ppRuns.reduce((m, r) => Math.max(m, r.score), 0)
                const displayName = pp?.display_name || project
                return (
                  <div key={project} className="pp-grid-item pp-grid-item--locked">
                    <PassportCard
                      project={project}
                      passport={pp}
                      runs={runs}
                      onClick={() => { setStampsProject(null); setAccessDeniedProject(project) }}
                      onOpenStamps={() => setStampsProject(prev => prev === project ? null : project)}
                    />
                    <div
                      className="pp-lock-overlay"
                      onClick={e => { e.stopPropagation(); setAccessDeniedProject(project) }}
                      title="You don't have access to this project"
                    >
                      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V9a3 3 0 00-6 0v4h6z" />
                      </svg>
                    </div>
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
        </>
      )}

      {accessDeniedProject && (
        <AccessDeniedOverlay
          onClose={() => setAccessDeniedProject(null)}
          project={accessDeniedProject}
        />
      )}

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

const passportCss = `
.pp-root {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  animation: ppFadeIn 0.4s ease forwards;
}
@keyframes ppFadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Toolbar */
.pp-toolbar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.pp-search {
  position: relative;
  flex: 1 1 240px;
  min-width: 180px;
}
.pp-search svg {
  position: absolute;
  left: 0.85rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted);
  pointer-events: none;
}
.pp-search input {
  width: 100%;
  padding: 0.55rem 0.85rem 0.55rem 2.4rem;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 12px;
  font-size: 0.85rem;
  outline: none;
  box-shadow: var(--shadow-sm);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.pp-search input:focus {
  border-color: var(--waf-brand);
  box-shadow: 0 0 0 3px rgba(0,148,255,0.12);
}
.pp-count {
  font-size: 0.78rem;
  color: var(--muted);
  white-space: nowrap;
}
.pp-count-hidden {
  margin-left: 0.5rem;
  color: var(--waf-brand);
  font-weight: 700;
}
.pp-segment {
  display: flex;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}
.pp-segment button {
  padding: 0.45rem 0.65rem;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--muted);
  border-right: 1px solid var(--border);
  transition: background 0.12s, color 0.12s;
}
.pp-segment button:last-child { border-right: none; }
.pp-segment button.active {
  background: rgba(0,148,255,0.12);
  color: var(--waf-brand);
}
.pp-segment button:hover:not(.active) {
  background: var(--bg);
}

/* Link button */
.pp-link-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--muted);
  text-decoration: none;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.pp-link-btn:hover {
  background: rgba(0,148,255,0.08);
  border-color: rgba(0,148,255,0.25);
  color: var(--waf-brand);
}

/* Field */
.pp-field { min-width: 0; overflow: hidden; }
.pp-field-label {
  font-size: 0.58rem;
  color: var(--muted);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 0.12rem;
}
.pp-field-value {
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Score tokens */
.pp-score-big {
  font-size: 1.85rem;
  font-weight: 900;
  line-height: 1;
}
.pp-score-mid {
  font-size: 1.1rem;
  font-weight: 800;
  line-height: 1;
}
.pp-score-label {
  font-size: 0.55rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Pills */
.pp-pill {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.18rem 0.55rem;
  border-radius: 999px;
  border: 1px solid;
  align-self: flex-start;
  white-space: nowrap;
}

/* Grid */
.pp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 1.25rem;
}
.pp-grid--wide {
  grid-template-columns: repeat(auto-fill, minmax(540px, 1fr));
}
.pp-grid-item {
  position: relative;
}
.pp-grid-item--locked .pp-card {
  opacity: 0.55;
  filter: grayscale(0.6);
}
.pp-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.pp-list-item {
  position: relative;
}
.pp-list-item--locked .pp-row {
  opacity: 0.55;
  filter: grayscale(0.6);
}

/* Item actions */
.pp-item-actions {
  position: absolute;
  top: 0.45rem;
  right: 0.45rem;
  display: flex;
  gap: 0.35rem;
  z-index: 5;
}
.pp-item-actions--card {
  top: 0.55rem;
  right: 0.55rem;
}
.pp-action-edit,
.pp-action-delete {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: 1px solid rgba(255,255,255,0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #fff;
  backdrop-filter: blur(4px);
  transition: transform 0.12s, background 0.12s;
}
.pp-action-edit {
  background: rgba(15,23,42,0.45);
}
.pp-action-delete {
  background: rgba(218,44,56,0.5);
}
.pp-action-edit:hover,
.pp-action-delete:hover {
  transform: scale(1.05);
}

/* Lock overlay */
.pp-lock-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 0.75rem;
  border-radius: 999px;
  background: rgba(15,23,42,0.75);
  border: 1px solid rgba(255,255,255,0.2);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: transform 0.15s, background 0.15s;
}
.pp-lock-overlay:hover {
  transform: translate(-50%, -50%) scale(1.05);
  background: rgba(15,23,42,0.9);
}

/* Card */
.pp-card {
  width: 100%;
  min-height: 380px;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 18px;
  overflow: hidden;
  cursor: pointer;
  text-align: left;
  box-shadow: var(--shadow-sm);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  position: relative;
}
.pp-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-md);
}
.pp-card-banner {
  position: relative;
  height: 110px;
  flex-shrink: 0;
  overflow: hidden;
  border-bottom: 1px solid var(--border);
}
.pp-card-score {
  position: absolute;
  top: 0.65rem;
  right: 0.75rem;
  text-align: right;
}
.pp-card-seal {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -55%);
}
.pp-card-seal img {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid var(--surface);
  background: var(--surface);
  box-shadow: 0 4px 14px rgba(0,0,0,0.12);
}
.pp-card-maturity {
  position: absolute;
  bottom: 0.5rem;
  left: 0.7rem;
  font-size: 0.55rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  padding: 0.15rem 0.55rem;
  border-radius: 6px;
}
.pp-card-achievements {
  position: absolute;
  bottom: 0.5rem;
  right: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--muted);
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: rgba(255,255,255,0.75);
  border: 1px solid var(--border);
  backdrop-filter: blur(4px);
}
.pp-card-doc-header {
  background: var(--bg);
  border-bottom: 1px solid var(--border);
  padding: 0.45rem 0.85rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
.pp-card-doc-title {
  font-size: 0.55rem;
  font-weight: 800;
  color: var(--muted);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.pp-card-doc-sub {
  font-size: 0.48rem;
  color: var(--muted);
  letter-spacing: 0.04em;
  margin-top: 0.08rem;
}
.pp-card-doc-fields {
  display: flex;
  gap: 0.85rem;
  text-align: center;
  flex-shrink: 0;
}
.pp-card-doc-label {
  font-size: 0.45rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.pp-card-doc-value {
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--text);
  font-family: ui-monospace, monospace;
}
.pp-card-body {
  flex: 1;
  padding: 0.85rem;
  display: flex;
  gap: 0.85rem;
}
.pp-card-photo {
  flex-shrink: 0;
  width: 64px;
  height: 80px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.pp-card-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pp-card-photo-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--muted);
}
.pp-card-photo-placeholder span {
  font-size: 1.5rem;
  font-weight: 800;
}
.pp-card-photo-placeholder small {
  font-size: 0.55rem;
  font-weight: 700;
  margin-top: 0.2rem;
}
.pp-card-fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}
.pp-card-field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem;
}
.pp-card-field-row--end {
  align-items: end;
}
.pp-card-links {
  display: flex;
  gap: 0.3rem;
  align-items: center;
}

/* Performance strip */
.pp-card-performance {
  border-top: 1px solid var(--border);
  padding: 0.45rem 0.85rem;
  background: var(--bg);
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.pp-sparkline {
  flex-shrink: 0;
}
.pp-card-latest {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  flex-shrink: 0;
}
.pp-card-delta {
  font-size: 0.7rem;
  font-weight: 700;
}
.pp-card-divider {
  width: 1px;
  height: 16px;
  background: var(--border);
  flex-shrink: 0;
}
.pp-card-stats {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}
.pp-mini-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}
.pp-mini-stat-value {
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--text);
  line-height: 1;
}
.pp-mini-stat-label {
  font-size: 0.48rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Tags */
.pp-card-tags {
  padding: 0.35rem 0.85rem;
  border-top: 1px dashed var(--border);
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
  align-items: center;
}
.pp-card-tags-label {
  font-size: 0.55rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-right: 0.15rem;
}
.pp-tag {
  font-size: 0.65rem;
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
  background: rgba(0,148,255,0.08);
  color: var(--waf-brand);
  border: 1px solid rgba(0,148,255,0.18);
  font-weight: 600;
}
.pp-card-tags-more {
  font-size: 0.65rem;
  color: var(--muted);
}

/* Card footer / MRZ */
.pp-card-footer {
  background: #0b1220;
  border-top: 1px solid var(--border);
  padding: 0.35rem 0.7rem;
  display: flex;
  align-items: center;
  gap: 0.55rem;
}
.pp-card-mrz {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, 'Courier New', monospace;
  font-size: 0.54rem;
  color: rgba(255,255,255,0.65);
  letter-spacing: 0.06em;
  line-height: 1.7;
  overflow: hidden;
}
.pp-card-mrz > div {
  overflow: hidden;
  text-overflow: clip;
  white-space: nowrap;
}
.pp-card-footer-actions {
  display: flex;
  gap: 0.3rem;
  flex-shrink: 0;
}

/* Ghost button */
.pp-btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 6px;
  padding: 0.25rem 0.55rem;
  cursor: pointer;
  text-decoration: none;
  color: rgba(255,255,255,0.8);
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: background 0.15s, color 0.15s;
}
.pp-btn-ghost:hover {
  background: rgba(255,255,255,0.2);
  color: #fff;
}

/* Row */
.pp-row {
  width: 100%;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  text-align: left;
  box-shadow: var(--shadow-sm);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  position: relative;
}
.pp-row:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
.pp-row-main {
  display: flex;
  align-items: stretch;
  min-height: 80px;
  padding: 0.6rem 0.85rem;
  gap: 0.85rem;
}
.pp-row-accent {
  width: 5px;
  flex-shrink: 0;
  border-radius: 999px;
  align-self: stretch;
}
.pp-row-seal {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pp-row-seal img {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--border);
  background: var(--surface);
}
.pp-row-info {
  flex: 1.6;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.15rem;
}
.pp-row-name {
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pp-row-id {
  font-size: 0.62rem;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, monospace;
}
.pp-row-desc {
  font-size: 0.72rem;
  color: var(--muted);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.4;
}
.pp-row-desc--empty {
  font-style: italic;
  opacity: 0.7;
}
.pp-row-owner {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.25rem;
}
.pp-row-badges {
  flex: 0 0 150px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.25rem;
}
.pp-row-score {
  flex: 0 0 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.08rem;
  border-left: 1px solid var(--border);
  padding-left: 0.75rem;
}
.pp-row-meta {
  font-size: 0.62rem;
  color: var(--muted);
}
.pp-row-achievements {
  font-size: 0.6rem;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 0.2rem;
}
.pp-row-actions {
  flex: 0 0 110px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 0.35rem;
  border-left: 1px solid var(--border);
  padding-left: 0.75rem;
}
.pp-row-links {
  display: flex;
  gap: 0.3rem;
}
.pp-row-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  text-decoration: none;
  color: var(--muted);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: background 0.15s, color 0.15s;
}
.pp-row-badge:hover {
  background: var(--row-hover);
  color: var(--text);
}
.pp-row-mrz {
  border-top: 1px solid var(--border);
  padding: 0.22rem 0.85rem;
  background: #0b1220;
  font-family: ui-monospace, 'Courier New', monospace;
  font-size: 0.54rem;
  color: rgba(255,255,255,0.55);
  letter-spacing: 0.05em;
  overflow: hidden;
  text-overflow: clip;
  white-space: nowrap;
  user-select: none;
}

/* Seal */
.pp-seal { filter: drop-shadow(0 2px 6px rgba(0,0,0,0.15)); }

/* Stamp */
.pp-stamp {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  transition: opacity 0.3s;
  user-select: none;
}
.pp-stamp-ring {
  position: relative;
}
.pp-stamp-icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pp-stamp-check {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.pp-stamp-text { text-align: center; }
.pp-stamp-title {
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.2;
}
.pp-stamp-sub {
  font-size: 0.55rem;
  color: var(--muted);
  margin-top: 0.1rem;
  line-height: 1.2;
}

/* Modal */
.pp-overlay-backdrop,
.pp-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1499;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: 16rem;
}
.pp-modal-backdrop {
  z-index: 1000;
  padding: 1rem;
}
.pp-modal {
  width: min(560px, calc(100vw - 18rem));
  max-height: 86vh;
  background: var(--surface);
  border-radius: 20px;
  border: 1px solid var(--border);
  box-shadow: 0 20px 60px rgba(0,0,0,0.35);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  animation: ppModalIn 0.25s ease;
}
.pp-modal--edit {
  width: 100%;
  max-width: 640px;
}
.pp-modal--access {
  width: min(480px, calc(100vw - 18rem));
}
.pp-modal--stamps {
  width: min(620px, calc(100vw - 18rem));
}
@keyframes ppModalIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
.pp-modal-header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-shrink: 0;
}
.pp-modal-header--brand {
  background: linear-gradient(135deg, rgba(0,148,255,0.12) 0%, rgba(0,148,255,0.04) 100%);
}
.pp-modal-header--danger {
  background: linear-gradient(135deg, rgba(218,44,56,0.12) 0%, rgba(218,44,56,0.04) 100%);
}
.pp-modal-kicker {
  font-size: 0.58rem;
  font-weight: 800;
  color: var(--muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.pp-modal-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pp-modal-subtitle {
  font-size: 0.75rem;
  color: var(--muted);
  margin-top: 0.15rem;
}
.pp-modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.12s, color 0.12s;
}
.pp-modal-close:hover {
  background: var(--row-hover);
  color: var(--text);
}
.pp-modal-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  flex-shrink: 0;
}
.pp-modal-tab {
  flex: 1;
  padding: 0.55rem 0.75rem;
  border: none;
  cursor: pointer;
  background: transparent;
  border-bottom: 2px solid transparent;
  transition: background 0.12s;
}
.pp-modal-tab.active {
  background: var(--surface);
  border-bottom-color: var(--waf-brand);
}
.pp-modal-tab-label {
  font-size: 0.68rem;
  font-weight: 800;
  color: var(--muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.pp-modal-tab.active .pp-modal-tab-label {
  color: var(--text);
}
.pp-modal-tab-sub {
  font-size: 0.58rem;
  color: var(--muted);
  margin-top: 0.1rem;
}
.pp-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
}
.pp-modal-body--center {
  text-align: center;
}
.pp-modal-body--form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.pp-modal-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  flex-shrink: 0;
}
.pp-modal-mrz {
  border-top: 1px solid var(--border);
  padding: 0.3rem 0.85rem;
  background: #0b1220;
  font-family: ui-monospace, 'Courier New', monospace;
  font-size: 0.52rem;
  color: rgba(255,255,255,0.55);
  letter-spacing: 0.05em;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: clip;
  user-select: none;
}

/* Access denied */
.pp-access-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 1rem;
  border-radius: 50%;
  background: rgba(218,44,56,0.1);
  color: var(--waf-danger);
  display: flex;
  align-items: center;
  justify-content: center;
}
.pp-access-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 0.5rem;
}
.pp-access-text {
  font-size: 0.82rem;
  color: var(--muted);
  line-height: 1.5;
  max-width: 360px;
  margin: 0 auto;
}

/* Stamp grid inside modal */
.pp-stamp-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  justify-content: center;
}
.pp-stamp-grid--achievements {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.25rem;
  justify-items: center;
}

/* Form */
.pp-form-grid { display: grid; gap: 0.875rem; }
.pp-form-grid--2 { grid-template-columns: 1fr 1fr; }
.pp-form-grid--3 { grid-template-columns: 1fr 1fr 1fr; }
.pp-image-toggle,
.pp-image-clear,
.pp-btn-secondary,
.pp-btn-primary {
  padding: 0.4rem 0.85rem;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s, transform 0.1s;
}
.pp-image-toggle {
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--muted);
}
.pp-image-toggle.active {
  border-color: var(--waf-brand);
  background: rgba(0,148,255,0.1);
  color: var(--waf-brand);
}
.pp-image-clear {
  margin-left: auto;
  border: 1px solid rgba(218,44,56,0.35);
  background: rgba(218,44,56,0.07);
  color: #f87171;
}
.pp-file-upload {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
}
.pp-file-btn {
  padding: 0.45rem 0.85rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
}
.pp-file-upload span {
  font-size: 0.74rem;
  color: var(--muted);
}
.pp-image-preview {
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.pp-image-preview img {
  width: 52px;
  height: 52px;
  object-fit: cover;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg);
}
.pp-image-preview span {
  font-size: 0.72rem;
  color: var(--muted);
}
.pp-tag-input {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
}
.pp-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.pp-tag-chip {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.74rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: rgba(0,148,255,0.08);
  color: var(--waf-brand);
  border: 1px solid rgba(0,148,255,0.2);
  font-weight: 600;
}
.pp-tag-chip button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  color: var(--waf-brand);
  line-height: 1;
  font-size: 0.9rem;
}
.pp-form-error {
  font-size: 0.78rem;
  color: #f87171;
  padding: 0.5rem 0.75rem;
  background: rgba(218,44,56,0.08);
  border-radius: 8px;
  border: 1px solid rgba(218,44,56,0.25);
}
.pp-btn-secondary {
  border: 1px solid var(--border);
  background: none;
  color: var(--muted);
}
.pp-btn-secondary:hover {
  background: var(--bg);
  color: var(--text);
}
.pp-btn-primary {
  border: none;
  background: var(--waf-brand);
  color: #fff;
}
.pp-btn-primary:hover:not(:disabled) {
  background: var(--waf-brand-h);
  transform: translateY(-1px);
}
.pp-btn-primary:active:not(:disabled) {
  transform: scale(0.98);
}
.pp-btn-primary:disabled {
  opacity: 0.6;
  cursor: default;
}

/* Empty state */
.pp-empty {
  text-align: center;
  padding: 4rem 1rem;
  color: var(--muted);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  box-shadow: var(--shadow-sm);
}
.pp-empty-icon {
  color: var(--waf-brand);
  opacity: 0.35;
  margin-bottom: 1rem;
}
.pp-empty-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 0.4rem;
}
.pp-empty-text {
  font-size: 0.82rem;
  color: var(--muted);
}

/* Skeleton */
.pp-skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 1.25rem;
  animation: ppFadeIn 0.3s ease;
}
.pp-skeleton {
  height: 380px;
  border-radius: 18px;
  background: linear-gradient(90deg, var(--surface) 25%, var(--bg) 50%, var(--surface) 75%);
  background-size: 200% 100%;
  animation: ppShimmer 1.4s infinite;
  border: 1px solid var(--border);
}
.pp-skeleton.wide {
  grid-column: span 2;
}
@keyframes ppShimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Responsive */
@media (max-width: 1200px) {
  .pp-grid,
  .pp-grid--wide { grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); }
}
@media (max-width: 900px) {
  .pp-row-main { flex-wrap: wrap; }
  .pp-row-owner,
  .pp-row-badges,
  .pp-row-score,
  .pp-row-actions {
    flex: 1 1 auto;
    border-left: none;
    padding-left: 0;
    align-items: flex-start;
  }
  .pp-row-score { flex-direction: row; gap: 0.4rem; align-items: center; }
  .pp-row-actions { align-items: flex-start; }
}
@media (max-width: 640px) {
  .pp-grid,
  .pp-grid--wide,
  .pp-skeleton-grid { grid-template-columns: 1fr; }
  .pp-skeleton.wide { grid-column: span 1; }
  .pp-form-grid--2,
  .pp-form-grid--3 { grid-template-columns: 1fr; }
  .pp-stamp-grid--achievements { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pp-overlay-backdrop,
  .pp-modal-backdrop { padding-left: 0; }
  .pp-modal { width: calc(100vw - 2rem); }
}
`
