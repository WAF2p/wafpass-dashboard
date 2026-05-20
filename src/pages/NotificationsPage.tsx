import { useState } from 'react'
import { useNotifications } from '../notifications/context'
import { useI18n } from '../i18n'
import { NotificationCategory } from '../notifications/types'

const CATEGORY_STYLES: Record<NotificationCategory, { label: string; color: string; icon: string; bg: string }> = {
  info: { label: 'Info', color: '#0094ff', icon: 'i', bg: 'rgba(0,148,255,0.1)' },
  warning: { label: 'Warning', color: '#f59e0b', icon: '!', bg: 'rgba(245,158,11,0.1)' },
  urgent: { label: 'Urgent', color: '#dc2626', icon: '!', bg: 'rgba(220,38,38,0.1)' },
  success: { label: 'Success', color: '#22c55e', icon: 'v', bg: 'rgba(34,197,94,0.1)' },
}

export default function NotificationsPage() {
  const { t } = useI18n()
  const { notifications, markAsRead, markAllAsRead, triggerTest } = useNotifications()
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [creating, setCreating] = useState(false)
  const [testForm, setTestForm] = useState<{ title: string; message: string; category: NotificationCategory }>({
    title: '',
    message: '',
    category: 'info',
  })

  // Calculate counts for each filter tab independently
  const unreadCount = notifications.filter(n => !n.is_read).length
  const readCount = notifications.filter(n => n.is_read).length

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.is_read
    if (filter === 'read') return n.is_read
    return true
  })

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testForm.title || !testForm.message) return
    await triggerTest(testForm)
    setTestForm({ title: '', message: '', category: 'info' })
    setCreating(false)
  }

  const getCategoryStyle = (category: NotificationCategory) => CATEGORY_STYLES[category]

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h2
            style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '0.5rem',
            }}
          >
            {t('nav.items.notifications')}
          </h2>
          <div style={{ fontSize: '0.78rem', color: 'var(--text)' }}>
            {t('pages.notifications.pageDescription')}
          </div>
        </div>
        <button
          onClick={() => setCreating(!creating)}
          style={{
            background: 'var(--waf-brand)',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '0.5rem 1rem',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {creating ? t('pages.notifications.cancel') : t('pages.notifications.create')}
        </button>
      </div>

      {/* Create Test Form - Admin only */}
      {creating && (
        <div
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
          }}
        >
          <h3
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--waf-brand)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '1rem',
            }}
          >
            {t('pages.notifications.test')}
          </h3>
          <form onSubmit={handleTest} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'var(--muted)',
                  marginBottom: '0.4rem',
                }}
              >
                {t('pages.notifications.title')} <span style={{ color: 'var(--waf-brand)' }}>*</span>
              </label>
              <input
                type="text"
                value={testForm.title}
                onChange={(e) => setTestForm({ ...testForm, title: e.target.value })}
                placeholder={t('pages.notifications.titlePlaceholder') || 'Enter notification title'}
                style={{
                  width: '100%',
                  background: 'var(--input-bg)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.6rem',
                  fontSize: '0.8rem',
                  outline: 'none',
                }}
                autoFocus
              />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'var(--muted)',
                  marginBottom: '0.4rem',
                }}
              >
                {t('pages.notifications.message')} <span style={{ color: 'var(--waf-brand)' }}>*</span>
              </label>
              <textarea
                value={testForm.message}
                onChange={(e) => setTestForm({ ...testForm, message: e.target.value })}
                placeholder={t('pages.notifications.messagePlaceholder') || 'Enter notification message'}
                style={{
                  width: '100%',
                  background: 'var(--input-bg)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.6rem',
                  fontSize: '0.8rem',
                  outline: 'none',
                  minHeight: '80px',
                  resize: 'vertical',
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'var(--muted)',
                  marginBottom: '0.4rem',
                }}
              >
                {t('pages.notifications.category')}
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {(['info', 'warning', 'urgent', 'success'] as NotificationCategory[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setTestForm({ ...testForm, category: cat })}
                    style={{
                      padding: '0.45rem 0.9rem',
                      borderRadius: '999px',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      border: testForm.category === cat
                        ? `2px solid ${getCategoryStyle(cat).color}`
                        : '1px solid var(--border)',
                      background: testForm.category === cat ? getCategoryStyle(cat).bg : 'var(--bg)',
                      color: testForm.category === cat ? getCategoryStyle(cat).color : 'var(--text)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {CATEGORY_STYLES[cat].label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="submit"
                style={{
                  background: 'var(--waf-brand)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('pages.notifications.send')}
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                style={{
                  background: 'transparent',
                  color: 'var(--muted)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('pages.notifications.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1rem',
          padding: '0.5rem 0',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            color: 'var(--muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginRight: '1rem',
            whiteSpace: 'nowrap',
          }}
        >
          {t('pages.notifications.filterBy')}
        </div>
        {(['all', 'unread', 'read'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '0.35rem 0.9rem',
              borderRadius: '999px',
              fontSize: '0.76rem',
              fontWeight: 600,
              border: filter === f ? `2px solid var(--waf-brand)` : '1px solid var(--border)',
              background: filter === f ? 'var(--bg)' : 'transparent',
              color: filter === f ? 'var(--waf-brand)' : 'var(--muted)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {t(`pages.notifications.${f}` as any)}
            {f === 'unread' && unreadCount > 0 && `(${unreadCount})`}
            {f === 'read' && readCount > 0 && `(${readCount})`}
          </button>
        ))}
        {unreadCount > 0 && filter !== 'all' && (
          <button
            onClick={markAllAsRead}
            style={{
              marginLeft: 'auto',
              padding: '0.35rem 0.9rem',
              borderRadius: '999px',
              fontSize: '0.7rem',
              fontWeight: 600,
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.3)',
              color: '#22c55e',
              cursor: 'pointer',
            }}
          >
            {t('pages.notifications.markAllRead')}
          </button>
        )}
      </div>

      {/* Notifications list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filteredNotifications.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              color: 'var(--muted)',
              fontSize: '0.78rem',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '0.5rem', opacity: 0.3 }}>
              {filter === 'unread' ? '铃铃铃' : filter === 'read' ? '✓' : '铃铃铃'}
            </div>
            {filter === 'unread' && <div>{t('pages.notifications.noUnread')}</div>}
            {filter === 'read' && <div>{t('pages.notifications.noRead')}</div>}
            {filter === 'all' && <div>{t('pages.notifications.noNotifications')}</div>}
          </div>
        ) : (
          filteredNotifications.map((note) => {
            const style = getCategoryStyle(note.category)
            const isUrgent = note.category === 'urgent' || note.category === 'warning'
            return (
              <div
                key={note.id}
                style={{
                  display: 'flex',
                  gap: '1rem',
                  padding: '1rem',
                  borderRadius: '10px',
                  background: note.is_read ? 'var(--bg)' : `${style.bg}80`,
                  border: note.is_read
                    ? '1px solid var(--border)'
                    : `1px solid ${style.color}44`,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!note.is_read) {
                    e.currentTarget.style.background = `${style.bg}b3`
                    e.currentTarget.style.borderColor = style.color
                  }
                }}
                onMouseLeave={(e) => {
                  if (!note.is_read) {
                    e.currentTarget.style.background = `${style.bg}80`
                    e.currentTarget.style.borderColor = `${style.color}44`
                  }
                }}
              >
                {/* Category indicator */}
                <div
                  style={{
                    flexShrink: 0,
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: style.color,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                    fontWeight: 700,
                    boxShadow: `0 0 12px ${style.color}44`,
                  }}
                >
                  {style.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.35rem',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: note.is_read ? 500 : 600,
                        color: note.is_read ? 'var(--text)' : 'var(--sidebar-text)',
                      }}
                    >
                      {note.title}
                    </span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '999px',
                        background: 'var(--bg)',
                        color: isUrgent ? style.color : 'var(--muted)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {style.label}
                    </span>
                    {!note.is_read && (
                      <span
                        style={{
                          fontSize: '0.6rem',
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: '#dc2626',
                          marginLeft: 'auto',
                        }}
                      />
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--muted)',
                      lineHeight: 1.6,
                      wordBreak: 'break-word',
                      marginBottom: '0.75rem',
                    }}
                  >
                    {note.message}
                  </div>
                  <div
                    style={{
                      fontSize: '0.68rem',
                      color: 'var(--muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {new Date(note.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {note.expires_at && (
                      <span style={{ color: '#dc2626', fontWeight: 500 }}>
                        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginRight: '2px' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        {new Date(note.expires_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                    {note.is_read && (
                      <span
                        onClick={() => markAsRead(note.id)}
                        style={{
                          color: '#22c55e',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {t('pages.notifications.marked')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
