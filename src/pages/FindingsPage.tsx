import { useState, useMemo, useEffect, useRef } from 'react'
import { Finding, RunDetail, upsertWaiver, fetchFindingComments, createFindingComment, deleteFindingComment, FindingComment } from '../api'
import { appendAuditEvent } from '../audit'
import { useI18n, type TFunction } from '../i18n'
import { useAuth } from '../AuthContext'
import { buildHash, parseHash, FilterState, Page } from '../routing'
import SavedViewsControl from '../components/SavedViewsControl'
import FindingsTriage from '../components/FindingsTriage'
import { useBetaFeatures } from '../beta/BetaFeaturesContext'
import { BETA_FINDINGS_TRIAGE } from './userPrefsUtils'
import { severityColor } from '../severity'
import { safeImageUrl } from '../safeUrl'
import { DataTable, EmptyState, type Column } from '../ui'
import { PAGE_TITLE } from '../routing'

interface Props { run: RunDetail; onNavigate?: (page: Page) => void }

const STATUS_COLOR: Record<string, string> = {
  PASS:   'var(--pass)',
  FAIL:   'var(--fail)',
  SKIP:   'var(--skip)',
  WAIVED: 'var(--waived)',
  ERROR:  'var(--waf-warn)',
}

function rowKey(f: Finding) { return `${f.check_id}||${f.resource}` }

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '0.15rem 0.55rem', borderRadius: '999px',
      background: `color-mix(in srgb, ${color} 13%, transparent)`, color, fontSize: '0.72rem', fontWeight: 700,
    }}>
      {label}
    </span>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

interface CommentInputProps {
  onSubmit: (message: string) => Promise<void>
  user: { username: string; display_name: string } | null
  t: (k: string, vars?: Record<string, string | number>) => string
}

function CommentInput({ onSubmit, user, t }: CommentInputProps) {
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit() {
    if (!message.trim()) return
    setStatus('saving')
    setErrorMsg('')
    try {
      await onSubmit(message.trim())
      setMessage('')
      setStatus('done')
      setTimeout(() => setStatus('idle'), 1500)
    } catch (e) {
      setStatus('error')
      setErrorMsg(e instanceof Error ? e.message : t('pages.phase3.restA.findings.unknownError'))
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.5rem 0.7rem', borderRadius: '8px',
    border: '1px solid var(--border)', background: 'var(--input-bg)',
    color: 'var(--text)', fontSize: '0.85rem', resize: 'none', minHeight: '60px',
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
        {t('pages.findings.commentSection')}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={user ? t('pages.phase3.restA.findings.writeCommentAs', { name: user.display_name || user.username }) : t('pages.phase3.restA.findings.signInToComment')}
            rows={3}
            disabled={!user}
            style={{ ...inputStyle, opacity: !user ? 0.6 : 1 }}
          />
          {status === 'error' && (
            <div style={{ fontSize: '0.7rem', color: 'var(--fail-ink)', marginTop: '0.25rem' }}>{errorMsg}</div>
          )}
          {status === 'done' && (
            <div style={{ fontSize: '0.7rem', color: 'var(--pass-ink)', marginTop: '0.25rem' }}>{t('pages.phase3.restA.findings.commentAdded')}</div>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={!message.trim() || !user || status === 'saving'}
          style={{
            padding: '0.5rem 0.9rem', border: 'none', borderRadius: '8px',
            background: !message.trim() || !user || status === 'saving' ? 'var(--skip)' : 'var(--waf-brand)',
            color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: !message.trim() || !user ? 'default' : 'pointer',
            flexShrink: 0,
          }}
        >
          {status === 'saving' ? '...' : t('pages.findings.commentBtn')}
        </button>
      </div>
      {!user && <div style={{ fontSize: '0.7rem', color: 'var(--skip)', marginTop: '0.25rem' }}>{t('pages.phase3.restA.findings.signInToParticipate')}</div>}
    </div>
  )
}

interface CommentThreadProps {
  comments: FindingComment[]
  onDelete: (commentId: string) => Promise<void>
  user: { username: string; display_name: string } | null
  t: (k: string, vars?: Record<string, string | number>) => string
}

function CommentThread({ comments, onDelete, user, t }: CommentThreadProps) {
  const [deleting, setDeleting] = useState<Set<string>>(new Set())
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  async function handleDelete(commentId: string) {
    setConfirmDeleteId(null)
    setDeleting(prev => new Set(prev).add(commentId))
    try {
      await onDelete(commentId)
    } finally {
      setDeleting(prev => {
        const next = new Set(prev)
        next.delete(commentId)
        return next
      })
    }
  }

  const currentUser = user

  return (
    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>
        {t('pages.findings.commentThread', { count: comments.length })}
      </div>
      {comments.length === 0 ? (
        <EmptyState compact title={t('pages.findings.noComments')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {comments.map(comment => (
            <div key={comment.id} style={{
              display: 'flex', gap: '0.75rem', padding: '0.75rem', borderRadius: '8px',
              background: 'color-mix(in srgb, var(--waf-brand) 3%, var(--surface))', border: '1px solid color-mix(in srgb, var(--waf-brand) 8%, transparent)',
            }}>
              {/* Debug: console.log(comment) */}
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: safeImageUrl(comment.image_url) ? 'transparent' : 'var(--waf-brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: safeImageUrl(comment.image_url) ? '0' : '0.75rem', fontWeight: 700, flexShrink: 0,
                overflow: 'hidden',
              }}>
                {safeImageUrl(comment.image_url) ? (
                  <img src={safeImageUrl(comment.image_url) ?? undefined} alt={comment.display_name || comment.username} style={{
                    width: '100%', height: '100%', objectFit: 'cover',
                  }} />
                ) : (
                  (comment.display_name || comment.username || '?').charAt(0).toUpperCase()
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text)' }}>
                    {comment.display_name || comment.username}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                    {new Date(comment.created_at).toLocaleString()}
                  </span>
                  {currentUser && currentUser.username === comment.username && (
                    <button
                      onClick={() => setConfirmDeleteId(comment.id)}
                      disabled={deleting.has(comment.id)}
                      style={{
                        marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--fail-ink)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: '0.15rem 0.4rem', borderRadius: '4px',
                      }}
                    >
                      {deleting.has(comment.id) ? '...' : t('pages.findings.deleteComment')}
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {comment.message}
                </div>
                {confirmDeleteId === comment.id && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap',
                    marginTop: '0.5rem', padding: '0.4rem 0.6rem', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--text)',
                    background: 'color-mix(in srgb, var(--fail) 6%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--fail) 18%, transparent)',
                  }}>
                    <span style={{ flex: 1 }}>{t('pages.findings.confirmDeleteComment')}</span>
                    <button onClick={() => handleDelete(comment.id)} disabled={deleting.has(comment.id)} style={{ padding: '0.25rem 0.7rem', borderRadius: '8px', background: 'var(--fail)', color: '#fff', border: 'none', cursor: deleting.has(comment.id) ? 'wait' : 'pointer', fontWeight: 600, fontSize: '0.75rem' }}>
                      {t('common.delete')}
                    </button>
                    <button onClick={() => setConfirmDeleteId(null)} style={{ padding: '0.25rem 0.6rem', borderRadius: '8px', background: 'none', color: 'var(--muted)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}>
                      {t('common.cancel')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DetailPanel({ finding, onClose, t }: { finding: Finding; onClose: () => void; t: TFunction }) {
  const { user } = useAuth()
  const [comments, setComments] = useState<FindingComment[]>([])
  const [error, setError] = useState<string | null>(null)

  // Use a composite key as finding identifier (check_id + resource)
  const findingKey = useMemo(() => `${finding.check_id}||${finding.resource}`, [finding])

  useEffect(() => {
    async function loadComments() {
      if (!finding.id) {
        setComments([])
        return
      }
      try {
        const fetchedComments = await fetchFindingComments(finding.id)
        setComments(fetchedComments)
        setError(null)
      } catch (err) {
        console.error('Failed to load comments:', err)
        setError(t('pages.phase3.restA.findings.failedLoadComments'))
        setComments([])
      }
    }
    loadComments()
  }, [findingKey, finding.id])

  async function handleAddComment(message: string) {
    if (!finding.id || !user) return
    try {
      const newComment = await createFindingComment(finding.id, { message })
      setComments(prev => [...prev, newComment])
    } catch (err) {
      console.error('Failed to create comment:', err)
      setError(t('pages.phase3.restA.findings.failedCreateComment'))
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!finding.id) return
    try {
      await deleteFindingComment(finding.id, commentId)
      setComments(prev => prev.filter(c => c.id !== commentId))
    } catch (err) {
      console.error('Failed to delete comment:', err)
      setError(t('pages.phase3.restA.findings.failedDeleteComment'))
    }
  }

  return (
    <div style={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      width: '600px', maxWidth: '92vw', maxHeight: '90vh',
      background: 'var(--surface)', borderRadius: '12px',
      boxShadow: '0 24px 64px rgba(15,23,42,.18)',
      display: 'flex', flexDirection: 'column', zIndex: 100,
      overflowY: 'auto',
    }}>
      <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{finding.check_title || finding.check_id}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.2rem', fontFamily: 'monospace' }}>{finding.check_id}</div>
        </div>
        <button onClick={onClose} aria-label={t('common.close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '0.25rem', flexShrink: 0, fontSize: '1.2rem' }}>✕</button>
      </div>
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Pill label={finding.status} color={STATUS_COLOR[finding.status] ?? 'var(--skip)'} />
          <Pill label={finding.severity.toUpperCase()} color={severityColor(finding.severity)} />
          {finding.pillar && <Pill label={finding.pillar} color="var(--waf-brand)" />}
        </div>
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>{t('pages.findings.detailResource')}</div>
          <code style={{ fontSize: '0.8rem', color: 'var(--text)', wordBreak: 'break-all' }}>{finding.resource}</code>
        </div>
        {finding.message && (
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>{t('pages.findings.detailMessage')}</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>{finding.message}</p>
          </div>
        )}
        {finding.remediation && (
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>{t('pages.findings.detailRemediation')}</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>{finding.remediation}</p>
          </div>
        )}
        {finding.example && (
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>{t('pages.findings.detailExample')}</div>
            <pre style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.75rem', overflowX: 'auto', margin: 0, color: 'var(--text)', lineHeight: 1.6 }}>
              {JSON.stringify(finding.example, null, 2)}
            </pre>
          </div>
        )}
        {finding.control_id && (
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem' }}>{t('pages.findings.detailControlId')}</div>
            <code style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{finding.control_id}</code>
          </div>
        )}

        {/* Anti-Pattern Museum link */}
        <div style={{ padding: '0.75rem', background: 'color-mix(in srgb, var(--waf-warn) 8%, var(--surface))', border: '1px solid color-mix(in srgb, var(--waf-warn) 25%, transparent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text)' }}>
            <div style={{ fontWeight: 700, color: 'var(--score-mid-ink)', marginBottom: '0.15rem' }}>{t('pages.antipattern.bestpractices')}</div>
            <div style={{ color: 'var(--muted)' }}>
              {finding.status === 'FAIL'
                ? t('pages.antipattern.failingInfo', { pillar: finding.pillar || '' })
                : t('pages.antipattern.subtitle')}
            </div>
          </div>
          {finding.pillar && (
            <a
              href={`#/antipattern?pillar=${finding.pillar.toLowerCase()}`}
              onClick={(e) => {
                e.preventDefault()
                window.location.href = `#/antipattern?pillar=${finding.pillar?.toLowerCase()}`
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.4rem 0.8rem',
                background: 'var(--waf-brand)',
                color: '#fff',
                borderRadius: 7,
                fontSize: '0.75rem',
                fontWeight: 700,
                textDecoration: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a16.041 16.041 0 00-4.243-4.243l4.243 4.243M10.172 13.828a16.041 16.041 0 01-4.243-4.243l4.243 4.243M15.45 7.276a9.95 9.95 0 014.243 4.243M7.276 15.45a9.95 9.95 0 00-4.243 4.243m0-4.243a9.95 9.95 0 014.243-4.243" />
              </svg>
              {t('pages.antipattern.viewBestPractices')}
            </a>
          )}
        </div>

        {/* Comments section */}
        {error && (
          <div style={{ padding: '0.75rem', background: 'color-mix(in srgb, var(--fail) 8%, var(--surface))', border: '1px solid color-mix(in srgb, var(--fail) 25%, transparent)', borderRadius: 7, fontSize: '0.8rem', color: 'var(--fail-ink)' }}>
            {error}
          </div>
        )}
        <CommentInput onSubmit={handleAddComment} user={user} t={t} />
        <CommentThread comments={comments} onDelete={handleDeleteComment} user={user} t={t} />
      </div>
    </div>
  )
}

// ─── Waive modal ──────────────────────────────────────────────────────────────

interface WaiveModalProps {
  controlIds: string[]
  project: string
  onClose: () => void
  onDone: () => void
  t: (k: string, vars?: Record<string, string | number>) => string
}

function WaiveModal({ controlIds, project, onClose, onDone, t }: WaiveModalProps) {
  const [reason, setReason] = useState('')
  const [owner, setOwner] = useState('')
  const [expires, setExpires] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function submit() {
    if (!reason.trim()) return
    setStatus('saving')
    try {
      for (const id of controlIds) {
        await upsertWaiver(id, { reason: reason.trim(), owner: owner.trim(), expires: expires.trim(), project })
        appendAuditEvent({
          actor: owner.trim() || 'user',
          category: 'waiver',
          action: 'waiver_created',
          subject_id: id,
          subject_type: 'waiver',
          summary: `Bulk waiver: ${reason.trim()}`,
          after: { id, reason, owner, expires, project },
        })
      }
      // keep localStorage in sync
      try {
        const stored = JSON.parse(localStorage.getItem('wombat_waivers') ?? '{}') as Record<string, unknown>
        for (const id of controlIds) stored[id] = { id, reason: reason.trim(), owner: owner.trim(), expires: expires.trim(), project }
        localStorage.setItem('wombat_waivers', JSON.stringify(stored))
      } catch {}
      setStatus('done')
      setTimeout(onDone, 900)
    } catch (e) {
      setStatus('error')
      setErrorMsg(e instanceof Error ? e.message : t('pages.phase3.restA.findings.unknownError'))
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.45rem 0.7rem', borderRadius: '8px',
    border: '1px solid var(--border)', background: 'var(--input-bg)',
    color: 'var(--text)', fontSize: '0.85rem', boxSizing: 'border-box',
  }

  return (
    <div style={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
      width: 480, maxWidth: '92vw', background: 'var(--surface)', borderRadius: '12px',
      boxShadow: '0 24px 64px rgba(15,23,42,.2)', zIndex: 200,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '1.1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>
            {t('pages.findings.waiveModalTitle', { count: controlIds.length })}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.1rem' }}>
            {t('pages.findings.waiveModalSubtitle')}
          </div>
        </div>
        <button onClick={onClose} aria-label={t('common.close')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.2rem', padding: '0.25rem' }}>✕</button>
      </div>

      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

        {/* Affected controls preview */}
        <div style={{ maxHeight: 80, overflowY: 'auto', background: 'var(--bg)', borderRadius: 7, padding: '0.5rem 0.75rem', border: '1px solid var(--border)' }}>
          {controlIds.map(id => (
            <div key={id} style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--muted)', lineHeight: 1.8 }}>{id}</div>
          ))}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
            {t('pages.findings.waiveReason')} <span style={{ color: 'var(--fail-ink)' }}>*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={t('pages.phase3.restA.findings.waiveReasonPlaceholder')}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>{t('pages.findings.waiveOwner')}</label>
            <input value={owner} onChange={e => setOwner(e.target.value)} placeholder={t('pages.phase3.restA.findings.waiveOwnerPlaceholder')} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>{t('pages.findings.waiveExpires')}</label>
            <input type="date" value={expires} onChange={e => setExpires(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {status === 'error' && (
          <div style={{ padding: '0.5rem 0.75rem', background: 'color-mix(in srgb, var(--fail) 8%, var(--surface))', border: '1px solid color-mix(in srgb, var(--fail) 25%, transparent)', borderRadius: 7, fontSize: '0.8rem', color: 'var(--fail-ink)' }}>
            {errorMsg}
          </div>
        )}

        {status === 'done' && (
          <div style={{ padding: '0.5rem 0.75rem', background: 'color-mix(in srgb, var(--pass) 8%, var(--surface))', border: '1px solid color-mix(in srgb, var(--pass) 25%, transparent)', borderRadius: 7, fontSize: '0.8rem', color: 'var(--pass-ink)', fontWeight: 600 }}>
            ✓ {t('pages.findings.wavingDone', { count: controlIds.length })}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', color: 'var(--muted)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}>
            {t('common.cancel')}
          </button>
          <button
            onClick={submit}
            disabled={!reason.trim() || status === 'saving' || status === 'done'}
            style={{
              padding: '0.5rem 1.25rem', border: 'none', borderRadius: 8,
              background: !reason.trim() || status === 'saving' || status === 'done' ? 'var(--skip)' : 'var(--waf-brand)',
              color: '#fff', fontSize: '0.85rem', cursor: !reason.trim() || status !== 'idle' ? 'default' : 'pointer', fontWeight: 700,
            }}
          >
            {status === 'saving' ? t('pages.findings.wavingSaving') : t('pages.findings.waiveBtn', { count: controlIds.length })}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCsv(findings: Finding[], filename: string) {
  const esc = (v: string | undefined) => `"${(v ?? '').replace(/"/g, '""')}"`
  const header = ['check_id', 'check_title', 'control_id', 'pillar', 'severity', 'status', 'resource', 'message', 'remediation'].join(',')
  const rows = findings.map(f =>
    [f.check_id, f.check_title, f.control_id, f.pillar, f.severity, f.status, f.resource, f.message, f.remediation]
      .map(v => esc(v ?? '')).join(',')
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FindingsPage({ run, onNavigate }: Props) {
  const { t } = useI18n()
  const findings = run.findings

  // Debug: log severity values to console
  useEffect(() => {
    const severities = findings.map(f => f.severity)
    const uniqueSeverities = Array.from(new Set(severities))
    console.log('FindingsPage - severity values:', uniqueSeverities)
    console.log('FindingsPage - sample findings:', findings.slice(0, 3).map(f => ({ id: f.check_id, severity: f.severity, status: f.status })))
  }, [findings])

  // Initialize filters from URL on mount
  const initialFilters = useMemo(() => {
    const { filters } = parseHash()
    return {
      search: filters.search ?? '',
      statusFilter: filters.statusFilter ?? '',
      severityFilter: filters.severityFilter ?? '',
      pillarFilter: filters.pillarFilter ?? '',
    }
  }, [])

  const [statusFilter, setStatusFilter]     = useState(initialFilters.statusFilter)
  const [severityFilter, setSeverityFilter] = useState(initialFilters.severityFilter)
  const [pillarFilter, setPillarFilter]     = useState(initialFilters.pillarFilter)
  const [search, setSearch]                 = useState(initialFilters.search)
  const [detail, setDetail]                 = useState<Finding | null>(null)
  const [checked, setChecked]               = useState<Set<string>>(new Set())
  const [showWaiveModal, setShowWaiveModal] = useState(false)
  const [showTriage, setShowTriage] = useState(false)
  const { isEnabled } = useBetaFeatures()

  // Sync filters to URL on change (but not on initial mount - that would be redundant)
  const isInitialMount = useRef(true)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    const filters: FilterState = {
      search: search || undefined,
      statusFilter: statusFilter || undefined,
      severityFilter: severityFilter || undefined,
      pillarFilter: pillarFilter || undefined,
    }
    // Get current runId from URL if present
    const { runId } = parseHash()
    window.history.pushState(null, '', buildHash('findings', runId, filters))
  }, [search, statusFilter, severityFilter, pillarFilter])

  const pillars = useMemo(() => Array.from(new Set(findings.map(f => f.pillar).filter(Boolean))).sort(), [findings])

  const filtered = useMemo(() => findings.filter(f =>
    (!statusFilter   || f.status.toUpperCase()   === statusFilter) &&
    (!severityFilter || f.severity.toUpperCase() === severityFilter) &&
    (!pillarFilter   || f.pillar === pillarFilter) &&
    (!search         || f.check_title?.toLowerCase().includes(search.toLowerCase()) ||
                        f.check_id?.toLowerCase().includes(search.toLowerCase()) ||
                        f.resource?.toLowerCase().includes(search.toLowerCase()))
  ), [findings, statusFilter, severityFilter, pillarFilter, search])

  // Debug: show all severity values in the filtered list
  useEffect(() => {
    if (filtered.length > 0) {
      const severityCounts: Record<string, number> = {}
      filtered.forEach(f => {
        const sev = f.severity
        severityCounts[sev] = (severityCounts[sev] || 0) + 1
      })
      console.log('FindingsPage - filtered severity counts:', severityCounts)
    }
  }, [filtered])

  const checkedInView   = useMemo(() => filtered.filter(f => checked.has(rowKey(f))), [filtered, checked])
  const someSelected    = checkedInView.length > 0

  // Unique control ids for selected rows (waivers are per-control)
  const selectedControlIds = useMemo(() =>
    Array.from(new Set(checkedInView.map(f => f.control_id).filter(Boolean))),
    [checkedInView]
  )

  function clearSelection() { setChecked(new Set()) }

  const columns: Column<Finding>[] = [
    {
      key: 'check',
      header: t('pages.findings.colCheck'),
      render: f => (
        <>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{f.check_id}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
            {f.check_title}
            {(f.comment_count ?? 0) > 0 && (
              <span style={{
                marginLeft: '0.5rem',
                fontSize: '0.7rem',
                fontWeight: 700,
                borderRadius: '999px',
                padding: '0.05rem 0.4rem',
                background: 'color-mix(in srgb, var(--waf-brand) 15%, transparent)',
                color: 'var(--waf-brand-ink)',
              }}>
                {(f.comment_count ?? 0)} {(f.comment_count ?? 0) === 1 ? t('pages.phase3.restA.findings.commentSingular') : t('pages.phase3.restA.findings.commentPlural')}
              </span>
            )}
          </div>
        </>
      ),
    },
    {
      key: 'resource',
      header: t('pages.findings.colResource'),
      mono: true,
      render: f => (
        <span style={{ fontSize: '0.78rem', color: 'var(--muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
          {f.resource}
        </span>
      ),
    },
    {
      key: 'pillar',
      header: t('pages.findings.colPillar'),
      render: f => f.pillar ? <Pill label={f.pillar} color="var(--waf-brand)" /> : null,
    },
    {
      key: 'severity',
      header: t('pages.findings.colSeverity'),
      render: f => <Pill label={f.severity.toUpperCase()} color={severityColor(f.severity)} />,
    },
    {
      key: 'status',
      header: t('pages.findings.colStatus'),
      render: f => <Pill label={f.status} color={STATUS_COLOR[f.status] ?? 'var(--skip)'} />,
    },
  ]

  const selectStyle = {
    background: 'var(--input-bg)', color: 'var(--text)', border: '1px solid var(--border)',
    borderRadius: '8px', padding: '0.4rem 0.6rem', fontSize: '0.8rem', outline: 'none',
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <h1 className="ui-sr-only">{PAGE_TITLE['findings']}</h1>

        {/* ── Filter bar ────────────────────────────────────────────────────── */}
        <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            placeholder={t('pages.findings.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...selectStyle, flex: '1', minWidth: '180px' }}
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
            <option value="">{t('pages.findings.allStatuses')}</option>
            {['PASS', 'FAIL', 'SKIP', 'WAIVED', 'ERROR'].map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} style={selectStyle}>
            <option value="">{t('pages.findings.allSeverities')}</option>
            {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(s => <option key={s}>{s}</option>)}
          </select>
          {pillars.length > 0 && (
            <select value={pillarFilter} onChange={e => setPillarFilter(e.target.value)} style={selectStyle}>
              <option value="">{t('pages.findings.allPillars')}</option>
              {pillars.map(p => <option key={p}>{p}</option>)}
            </select>
          )}
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
            {filtered.length} / {findings.length}
          </span>
          <SavedViewsControl
            page="findings"
            currentFilters={{ search, statusFilter, severityFilter, pillarFilter }}
            onApply={filters => {
              setSearch(typeof filters.search === 'string' ? filters.search : '')
              setStatusFilter(typeof filters.statusFilter === 'string' ? filters.statusFilter : '')
              setSeverityFilter(typeof filters.severityFilter === 'string' ? filters.severityFilter : '')
              setPillarFilter(typeof filters.pillarFilter === 'string' ? filters.pillarFilter : '')
            }}
          />
          {isEnabled(BETA_FINDINGS_TRIAGE) && (
            <button type="button" className="triage-trigger" onClick={() => setShowTriage(true)} disabled={filtered.length === 0}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {t('pages.phase3.restA.findings.triage')}
              <span className="triage-trigger-count">{filtered.length}</span>
            </button>
          )}

          {/* Export with filter option */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <select
              className="select-plain"
              value="visible"
              onChange={(e) => {
                if (e.target.value === 'all') {
                  exportCsv(findings, `findings-all-${run.project || 'run'}-${today}.csv`)
                } else {
                  exportCsv(filtered, `findings-${run.project || 'run'}-${today}.csv`)
                }
              }}
              style={{ ...selectStyle, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--pass-ink)', borderColor: 'color-mix(in srgb, var(--pass) 35%, transparent)', padding: '0.35rem 2.25rem 0.35rem 0.6rem', appearance: 'none' }}
            >
              <option value="visible">{t('pages.findings.exportVisibleFilters')}</option>
              <option value="all">{t('pages.findings.exportAllFindings')}</option>
            </select>
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--pass-ink)' }}>
              <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* ── Bulk action bar — shown when rows are checked ─────────────────── */}
        {someSelected && (
          <div style={{
            padding: '0.6rem 1.25rem',
            background: 'color-mix(in srgb, var(--waf-brand) 6%, var(--surface))', borderBottom: '1px solid color-mix(in srgb, var(--waf-brand) 20%, transparent)',
            display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--waf-brand)' }}>
              {t('pages.findings.selected', { count: checkedInView.length })}
              {selectedControlIds.length !== checkedInView.length && (
                <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: '0.4rem' }}>
                  · {t('pages.findings.uniqueControls', { count: selectedControlIds.length })}
                </span>
              )}
            </span>

            <button
              onClick={() => setShowWaiveModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.35rem 0.85rem', borderRadius: '8px', border: 'none',
                background: 'var(--waf-brand)', color: '#fff',
                fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              {t('pages.findings.waiveControls', { count: selectedControlIds.length })}
            </button>

            <button
              onClick={() => exportCsv(checkedInView, `findings-selected-${today}.csv`)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.35rem 0.85rem', borderRadius: '8px',
                border: '1px solid color-mix(in srgb, var(--pass) 35%, transparent)', background: 'color-mix(in srgb, var(--pass) 6%, var(--surface))',
                color: 'var(--pass-ink)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
              }}
            >
              {t('pages.findings.exportSelection')}
            </button>

            <button
              onClick={clearSelection}
              style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              {t('pages.findings.clearSelection')}
            </button>
          </div>
        )}

        {/* ── Table ─────────────────────────────────────────────────────────── */}
        <DataTable<Finding>
          columns={columns}
          rows={filtered}
          rowKey={rowKey}
          selectable
          selectedKeys={Array.from(checked)}
          onSelectionChange={keys => setChecked(new Set(keys))}
          onRowClick={f => setDetail(prev => (prev && rowKey(prev) === rowKey(f) ? null : f))}
          rowClassName={f => (detail && rowKey(detail) === rowKey(f) ? 'ui-table-row-detail' : undefined)}
          empty={<EmptyState compact title={t('pages.findings.noFindings')} />}
        />
      </div>

      {/* Detail panel overlay */}
      {detail && (
        <>
          <div onClick={() => setDetail(null)} style={{ position: 'fixed', inset: 0, background: 'var(--scrim)', zIndex: 99 }} />
          <DetailPanel finding={detail} onClose={() => setDetail(null)} t={t} />
        </>
      )}

      {showTriage && (
        <FindingsTriage
          findings={filtered}
          onClose={() => setShowTriage(false)}
          onWaive={finding => {
            setChecked(new Set([rowKey(finding)]))
            setShowTriage(false)
            setShowWaiveModal(true)
          }}
          onFix={() => {
            setShowTriage(false)
            onNavigate?.('autofix')
          }}
        />
      )}

      {/* Waive modal overlay */}
      {showWaiveModal && (
        <>
          <div onClick={() => setShowWaiveModal(false)} style={{ position: 'fixed', inset: 0, background: 'var(--scrim)', zIndex: 199 }} />
          <WaiveModal
            controlIds={selectedControlIds}
            project={run.project ?? ''}
            onClose={() => setShowWaiveModal(false)}
            onDone={() => { setShowWaiveModal(false); clearSelection() }}
            t={t}
          />
        </>
      )}

    </>
  )
}
