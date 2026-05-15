import { useState } from 'react'
import { useI18n } from '../i18n'

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'Bug Report' | 'Feature Request' | 'General Feedback' | 'Security Issue' | 'Improvement'
type Priority  = 'Low' | 'Medium' | 'High' | 'Urgent'

// ─── Category icons (inline SVG) ─────────────────────────────────────────────

function BugIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2l1.5 1.5" /><path d="M15.5 3.5L17 2" />
      <path d="M9 9a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0V9z" />
      <path d="M6 13H3" /><path d="M21 13h-3" />
      <path d="M6 9l-2-2" /><path d="M18 9l2-2" />
      <path d="M9 20l-1 2" /><path d="M15 20l1 2" />
    </svg>
  )
}

function LightbulbIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6" /><path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 1 4 12.87V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.13A7 7 0 0 1 12 2z" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES: { label: Category; icon: JSX.Element; color: string; bg: string; border: string }[] = [
  {
    label: 'Bug Report',
    icon: <BugIcon />,
    color: '#dc2626',
    bg: 'rgba(220,38,38,0.07)',
    border: '#dc2626',
  },
  {
    label: 'Feature Request',
    icon: <LightbulbIcon />,
    color: '#0094FF',
    bg: 'rgba(0,148,255,0.07)',
    border: '#0094FF',
  },
  {
    label: 'General Feedback',
    icon: <ChatIcon />,
    color: '#059669',
    bg: 'rgba(5,150,105,0.07)',
    border: '#059669',
  },
  {
    label: 'Security Issue',
    icon: <ShieldIcon />,
    color: '#d97706',
    bg: 'rgba(217,119,6,0.07)',
    border: '#d97706',
  },
  {
    label: 'Improvement',
    icon: <SparkleIcon />,
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.07)',
    border: '#7c3aed',
  },
]

// ─── Priority config ──────────────────────────────────────────────────────────

const PRIORITIES: { label: Priority; color: string }[] = [
  { label: 'Low',    color: '#059669' },
  { label: 'Medium', color: '#0094FF' },
  { label: 'High',   color: '#d97706' },
  { label: 'Urgent', color: '#dc2626' },
]



const MAX_CHARS = 2000

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const { t } = useI18n()
  const [category, setCategory]     = useState<Category>('General Feedback')
  const [rating, setRating]         = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [priority, setPriority]     = useState<Priority>('Medium')

  const [name, setName]             = useState('')
  const [email, setEmail]           = useState('')
  const [company, setCompany]       = useState('')
  const [subject, setSubject]       = useState('')
  const [message, setMessage]       = useState('')
  const [allowContact, setAllowContact] = useState(false)

  const [errors, setErrors]         = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted]   = useState(false)

  // ── Helpers ────────────────────────────────────────────────────────────────

  const charCount = message.length
  const charColor = charCount >= 1950 ? '#dc2626' : charCount >= 1800 ? '#d97706' : 'var(--muted)'

  const displayRating = hoverRating || rating

  function validate(): boolean {
    const e: Record<string, boolean> = {}
    if (!name.trim())    e.name    = true
    if (!email.trim())   e.email   = true
    if (!subject.trim()) e.subject = true
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validate()) return

    const emailSubject = `[${category}] ${subject}`
    const body = [
      `From: ${name}${company ? ` (${company})` : ''}`,
      `Email: ${email}`,
      `Category: ${category}`,
      `Priority: ${priority}`,
      `Rating: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} (${rating}/5)`,
      '',
      '--- Message ---',
      message,
      '',
      '---',
      `WAF++ PASS Dashboard`,
      `Submitted: ${new Date().toLocaleString()}`,
      `Follow-up allowed: ${allowContact ? 'Yes' : 'No'}`,
    ].join('\n')

    window.location.href = `mailto:feedback@waf2p.dev?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(body)}`
    setSubmitted(true)
  }

  // ── Shared input style ─────────────────────────────────────────────────────

  function inputStyle(hasError?: boolean): React.CSSProperties {
    return {
      width: '100%',
      background: '#fff',
      color: 'var(--text)',
      border: `1px solid ${hasError ? '#dc2626' : 'var(--border)'}`,
      borderRadius: '8px',
      padding: '0.5rem 0.75rem',
      fontSize: '0.85rem',
      outline: 'none',
      boxShadow: hasError ? '0 0 0 2px rgba(220,38,38,0.12)' : undefined,
      fontFamily: 'inherit',
    }
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.72rem',
    fontWeight: 600,
    color: 'var(--muted)',
    marginBottom: '0.3rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const ratingLabel: Record<number, string> = {
    1: t('pages.feedbackPage.ratingPoor'),
    2: t('pages.feedbackPage.ratingFair'),
    3: t('pages.feedbackPage.ratingGood'),
    4: t('pages.feedbackPage.ratingVeryGood'),
    5: t('pages.feedbackPage.ratingExcellent'),
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '760px', margin: '0 auto' }}>

      {/* ── Info banner ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.875rem 1.1rem', borderRadius: '12px',
        background: 'rgba(0,148,255,0.07)', border: '1px solid rgba(0,148,255,0.25)',
        color: 'var(--text)',
      }}>
        <span style={{ color: '#0094FF', flexShrink: 0 }}><MailIcon /></span>
        <span style={{ fontSize: '0.85rem', lineHeight: 1.5 }}>
          {t('pages.feedbackPage.teamNote')}
        </span>
      </div>

      {/* ── Success banner ───────────────────────────────────────────────────── */}
      {submitted && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '0.875rem 1.1rem', borderRadius: '12px',
          background: 'rgba(5,150,105,0.09)', border: '1px solid rgba(5,150,105,0.3)',
          color: '#065f46', fontSize: '0.875rem', fontWeight: 600,
        }}>
          <span style={{ fontSize: '1rem' }}>✓</span>
          {t('pages.feedbackPage.emailClientOpened')}
        </div>
      )}

      {/* ── Category selector ────────────────────────────────────────────────── */}
      <div className="card">
        <div style={labelStyle}>{t('pages.feedbackPage.category')}</div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => {
            const active = category === cat.label
            return (
              <button
                key={cat.label}
                onClick={() => setCategory(cat.label)}
                style={{
                  flex: '1 1 120px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: '0.5rem', padding: '0.9rem 0.75rem',
                  borderRadius: '12px',
                  border: `2px solid ${active ? cat.border : 'var(--border)'}`,
                  background: active ? cat.bg : 'var(--bg)',
                  cursor: 'pointer',
                  color: active ? cat.color : 'var(--muted)',
                  transition: 'border-color 0.15s, background 0.15s, color 0.15s',
                  fontFamily: 'inherit',
                }}
              >
                {cat.icon}
                <span style={{ fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{cat.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Rating ──────────────────────────────────────────────────────────── */}
      <div className="card">
        <div style={labelStyle}>{t('pages.feedbackPage.rating')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onMouseEnter={() => setHoverRating(n)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(n)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '1.75rem', lineHeight: 1, padding: '0 0.05rem',
                color: n <= displayRating ? '#f59e0b' : '#cbd5e1',
                transition: 'color 0.1s',
              }}
              aria-label={`Rate ${n}`}
            >
              ★
            </button>
          ))}
          {displayRating > 0 && (
            <span style={{ fontSize: '0.82rem', color: 'var(--muted)', marginLeft: '0.25rem' }}>
              {ratingLabel[displayRating]}
            </span>
          )}
        </div>
      </div>

      {/* ── Priority ────────────────────────────────────────────────────────── */}
      <div className="card">
        <div style={labelStyle}>{t('pages.feedbackPage.priority')}</div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {PRIORITIES.map(p => {
            const active = priority === p.label
            return (
              <button
                key={p.label}
                onClick={() => setPriority(p.label)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.45rem 1rem', borderRadius: '8px',
                  border: `2px solid ${active ? p.color : 'var(--border)'}`,
                  background: active ? `${p.color}14` : 'var(--bg)',
                  color: active ? p.color : 'var(--text)',
                  fontWeight: active ? 700 : 500,
                  fontSize: '0.83rem', cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: p.color, flexShrink: 0,
                }} />
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Contact fields ───────────────────────────────────────────────────── */}
      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>{t('pages.feedbackPage.nameLabel')}</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); if (e.target.value.trim()) setErrors(prev => ({ ...prev, name: false })) }}
              placeholder="Your name"
              style={inputStyle(errors.name)}
            />
            {errors.name && <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '0.25rem' }}>{t('pages.feedbackPage.nameRequired')}</div>}
          </div>
          <div>
            <label style={labelStyle}>{t('pages.feedbackPage.emailLabel')}</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); if (e.target.value.trim()) setErrors(prev => ({ ...prev, email: false })) }}
              placeholder="you@company.com"
              style={inputStyle(errors.email)}
            />
            {errors.email && <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '0.25rem' }}>{t('pages.feedbackPage.emailRequired')}</div>}
          </div>
          <div>
            <label style={labelStyle}>{t('pages.feedbackPage.companyLabel')}</label>
            <input
              type="text"
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="Your organisation"
              style={inputStyle()}
            />
          </div>
          <div>
            <label style={labelStyle}>{t('pages.feedbackPage.subjectLabel')}</label>
            <input
              type="text"
              value={subject}
              onChange={e => { setSubject(e.target.value); if (e.target.value.trim()) setErrors(prev => ({ ...prev, subject: false })) }}
              placeholder="Short description"
              style={inputStyle(errors.subject)}
            />
            {errors.subject && <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '0.25rem' }}>{t('pages.feedbackPage.subjectRequired')}</div>}
          </div>
        </div>
      </div>

      {/* ── Message ──────────────────────────────────────────────────────────── */}
      <div className="card">
        <label style={labelStyle}>{t('pages.feedbackPage.messageLabel')}</label>
        <div style={{ position: 'relative' }}>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value.slice(0, MAX_CHARS))}
            placeholder="Describe your feedback in detail..."
            rows={7}
            style={{
              ...inputStyle(),
              resize: 'vertical',
              minHeight: '140px',
              lineHeight: 1.6,
              paddingBottom: '1.6rem',
            }}
          />
          <span style={{
            position: 'absolute', bottom: '0.5rem', right: '0.75rem',
            fontSize: '0.72rem', color: charColor, fontWeight: 600,
            pointerEvents: 'none', transition: 'color 0.2s',
          }}>
            {charCount} / {MAX_CHARS}
          </span>
        </div>
      </div>

      {/* ── Allow follow-up ──────────────────────────────────────────────────── */}
      <div className="card">
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={allowContact}
            onChange={e => setAllowContact(e.target.checked)}
            style={{ width: '16px', height: '16px', accentColor: 'var(--waf-brand)', cursor: 'pointer', flexShrink: 0 }}
          />
          <span style={{ fontSize: '0.85rem', color: 'var(--text)' }}>
            {t('pages.feedbackPage.contactConsent')}
          </span>
        </label>
      </div>

      {/* ── Submit ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1.5rem' }}>
        <button
          onClick={handleSubmit}
          style={{
            background: 'var(--waf-brand)', color: '#fff',
            border: 'none', borderRadius: '8px',
            padding: '0.65rem 1.75rem', fontSize: '0.875rem', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 16px rgba(0,148,255,0.25)',
          }}
        >
          {t('pages.feedbackPage.sendBtn')}
        </button>
        <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
          {t('pages.feedbackPage.emailClientHint')}
        </span>

      </div>

    </div>
  )
}
