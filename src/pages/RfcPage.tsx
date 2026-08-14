import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import rfcData from '../data/rfcs.json'

// ─── Types ────────────────────────────────────────────────────────────────────

type RfcAuthor = {
  login: string
  avatarUrl: string
  url: string
}

type RfcLabel = {
  name: string
  color: string
}

type RfcComment = {
  id: number
  author: RfcAuthor
  createdAt: string
  updatedAt: string
  body: string
}

type RfcItem = {
  id: string
  repo: string
  repoFullName: string
  number: number
  title: string
  state: 'open' | 'closed'
  isPullRequest: boolean
  labels: RfcLabel[]
  author: RfcAuthor
  createdAt: string
  updatedAt: string
  url: string
  body: string
  comments: RfcComment[]
  commenters: RfcAuthor[]
}

type RfcData = {
  generatedAt: string
  source: string
  repos: string[]
  total: number
  open: number
  closed: number
  rfcs: RfcItem[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const data = rfcData as RfcData

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function statusColor(state: string) {
  return state === 'open' ? '#22c55e' : '#8b949e'
}

function statusBg(state: string) {
  return state === 'open' ? 'rgba(34,197,94,0.12)' : 'rgba(139,148,158,0.12)'
}

function avatarFallback(login: string) {
  return login.charAt(0).toUpperCase()
}

function truncate(text: string, max = 220) {
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

// ─── Icons ──────────────────────────────────────────────────────────────────────

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.21 2.91.83a2.2 2.2 0 0 1 .64-1.47C7.96 17.4 5.5 16.5 5.5 12.73c0-.95.34-1.72.9-2.32-.09-.22-.39-1.12.09-2.33 0 0 .73-.24 2.4.9a8.2 8.2 0 0 1 4.38 0c1.67-1.14 2.4-.9 2.4-.9.48 1.21.18 2.11.09 2.33.56.6.9 1.37.9 2.32 0 3.75-2.46 4.66-4.8 4.9a2.5 2.5 0 0 1 .7 1.93v2.9c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2Z" />
    </svg>
  )
}

function CommentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function RepoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22V4c0-1.1.9-2 2-2h12a2 2 0 0 1 2 2v18l-2.5-2.5L13 22l-2.5-2.5L8 22l-4-4z" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.67-8.69" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

// ─── Components ─────────────────────────────────────────────────────────────────

function Avatar({ user, size = 24 }: { user: RfcAuthor; size?: number }) {
  return (
    <a
      href={user.url}
      target="_blank"
      rel="noreferrer"
      title={user.login}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--input-bg)',
        border: '1px solid var(--border)',
        flexShrink: 0,
        textDecoration: 'none',
        color: 'var(--text)',
      }}
    >
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.login}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span style={{ fontSize: size * 0.45, fontWeight: 700 }}>{avatarFallback(user.login)}</span>
      )}
    </a>
  )
}

function RfcCard({ rfc }: { rfc: RfcItem }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: '12px',
        padding: '1.25rem',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <Avatar user={rfc.author} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                padding: '0.2rem 0.55rem',
                borderRadius: '999px',
                color: statusColor(rfc.state),
                background: statusBg(rfc.state),
              }}
            >
              {rfc.state}
            </span>
            {rfc.labels.map(label => (
              <span
                key={label.name}
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '999px',
                  background: `#${label.color}20`,
                  color: `#${label.color}`,
                  border: `1px solid #${label.color}40`,
                }}
              >
                {label.name}
              </span>
            ))}
          </div>

          <a
            href={rfc.url}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'block',
              marginTop: '0.5rem',
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--waf-brand)',
              textDecoration: 'none',
              lineHeight: 1.35,
            }}
          >
            {rfc.title}
          </a>

          <div
            style={{
              marginTop: '0.35rem',
              fontSize: '0.75rem',
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              flexWrap: 'wrap',
            }}
          >
            <RepoIcon />
            <span>{rfc.repoFullName}</span>
            <span>·</span>
            <span>#{rfc.number}</span>
            <span>·</span>
            <span>opened {formatDate(rfc.createdAt)} by <strong style={{ color: 'var(--text)' }}>{rfc.author.login}</strong></span>
            <span>·</span>
            <span>updated {formatDate(rfc.updatedAt)}</span>
          </div>

          <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.55, whiteSpace: 'pre-line' }}>
            {expanded ? rfc.body : truncate(rfc.body)}
          </div>

          {rfc.body.length > 220 && (
            <button
              onClick={() => setExpanded(v => !v)}
              style={{
                marginTop: '0.5rem',
                background: 'none',
                border: 'none',
                padding: 0,
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--waf-brand)',
                cursor: 'pointer',
              }}
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: '1rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
            <CommentIcon />
            <span>{rfc.comments.length} comment{rfc.comments.length === 1 ? '' : 's'}</span>
          </div>

          {rfc.commenters.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>Commenters:</span>
              <div style={{ display: 'flex', alignItems: 'center', marginLeft: '-0.25rem' }}>
                {rfc.commenters.map((user, idx) => (
                  <div key={user.login} style={{ marginLeft: idx === 0 ? 0 : '-0.4rem', zIndex: rfc.commenters.length - idx }}>
                    <Avatar user={user} size={24} />
                  </div>
                ))}
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                {rfc.commenters.map(u => u.login).join(', ')}
              </span>
            </div>
          )}
        </div>

        <a
          href={rfc.url}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text)',
            textDecoration: 'none',
            padding: '0.35rem 0.7rem',
            borderRadius: '6px',
            background: 'var(--input-bg)',
            border: '1px solid var(--border)',
          }}
        >
          <GitHubIcon />
          Open on GitHub
        </a>
      </div>

      {expanded && rfc.comments.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          {rfc.comments.map(comment => (
            <div
              key={comment.id}
              style={{
                display: 'flex',
                gap: '0.65rem',
                padding: '0.75rem 0',
                borderTop: '1px solid var(--border)',
              }}
            >
              <Avatar user={comment.author} size={28} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
                  <strong style={{ color: 'var(--text)' }}>{comment.author.login}</strong>
                  <span>·</span>
                  <span>{formatDate(comment.createdAt)}</span>
                </div>
                <div style={{ marginTop: '0.3rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                  {comment.body}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function RfcPage() {
  const { t } = useI18n()
  const [repoFilter, setRepoFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const repos = useMemo(() => {
    const set = new Set(data.rfcs.map(r => r.repo))
    return ['all', ...Array.from(set).sort()]
  }, [])

  const filtered = useMemo(() => {
    return data.rfcs.filter(rfc => {
      if (repoFilter !== 'all' && rfc.repo !== repoFilter) return false
      if (statusFilter !== 'all' && rfc.state !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          rfc.title.toLowerCase().includes(q) ||
          rfc.body.toLowerCase().includes(q) ||
          rfc.author.login.toLowerCase().includes(q) ||
          rfc.repo.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [repoFilter, statusFilter, search])

  return (
    <div style={{ padding: '1.5rem 1.75rem', maxWidth: '1100px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text)' }}>{t('pages.rfc.title')}</h1>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--muted)' }}>{t('pages.rfc.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
          <RefreshIcon />
          <span>{t('pages.rfc.generated')}: {formatDate(data.generatedAt)}</span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
          marginBottom: '1.25rem',
          padding: '0.9rem 1rem',
          background: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('common.total')}</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--waf-brand)' }}>{data.total}</span>
        </div>
        <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('pages.rfc.open')}</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#22c55e' }}>{data.open}</span>
        </div>
        <div style={{ width: '1px', height: '16px', background: 'var(--border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('pages.rfc.closed')}</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--muted)' }}>{data.closed}</span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
          marginBottom: '1.25rem',
        }}
      >
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('pages.rfc.searchPlaceholder')}
          style={{
            flex: 1,
            minWidth: '220px',
            padding: '0.55rem 0.8rem',
            fontSize: '0.85rem',
            borderRadius: '8px',
            border: '1px solid var(--input-border)',
            background: 'var(--input-bg)',
            color: 'var(--input-text)',
            outline: 'none',
          }}
        />

        <select
          value={repoFilter}
          onChange={e => setRepoFilter(e.target.value)}
          style={{
            padding: '0.55rem 0.8rem',
            fontSize: '0.85rem',
            borderRadius: '8px',
            border: '1px solid var(--input-border)',
            background: 'var(--input-bg)',
            color: 'var(--input-text)',
          }}
        >
          {repos.map(repo => (
            <option key={repo} value={repo}>
              {repo === 'all' ? t('pages.rfc.allRepos') : repo}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{
            padding: '0.55rem 0.8rem',
            fontSize: '0.85rem',
            borderRadius: '8px',
            border: '1px solid var(--input-border)',
            background: 'var(--input-bg)',
            color: 'var(--input-text)',
          }}
        >
          <option value="all">{t('pages.rfc.allStatuses')}</option>
          <option value="open">{t('pages.rfc.open')}</option>
          <option value="closed">{t('pages.rfc.closed')}</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.9rem' }}>
            {t('common.noData')}
          </div>
        ) : (
          filtered.map(rfc => <RfcCard key={rfc.id} rfc={rfc} />)
        )}
      </div>
    </div>
  )
}
