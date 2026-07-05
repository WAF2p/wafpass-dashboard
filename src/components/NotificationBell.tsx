import { useState, useRef, useEffect, useMemo } from 'react'
import { useNotifications } from '../notifications/context'
import { Notification } from '../notifications/types'
import { useI18n } from '../i18n'
import { useAuth } from '../AuthContext'
import { Page } from '../routing'

const CATEGORY_STYLES: Record<Notification['category'], { bg: string; color: string; icon: string; label: string }> = {
  info: { bg: 'rgba(0,148,255,0.15)', color: '#0094ff', icon: 'i', label: 'Info' },
  warning: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', icon: '!', label: 'Warning' },
  urgent: { bg: 'rgba(220,38,38,0.15)', color: '#dc2626', icon: '!', label: 'Urgent' },
  success: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e', icon: 'v', label: 'Success' },
}

interface NotificationBellProps {
  navigate?: (page: Page) => void
}

export function NotificationBell({ navigate }: NotificationBellProps) {
  const { t } = useI18n()
  const { role } = useAuth()
  const { notifications, unreadCount, markAllAsRead, triggerTest } = useNotifications()
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const isAllowed = role === 'admin'

  // Filter notifications by role
  const filteredNotifications = useMemo(() => {
    if (role === 'admin') return notifications // admin sees all
    return notifications.filter(n => !n.target_role || n.target_role === 'all' || n.target_role === role)
  }, [notifications, role])

  const unreadCountFiltered = filteredNotifications.filter(n => !n.is_read).length
  const hasUnread = unreadCountFiltered > 0

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  const handleTest = async () => {
    if (!isAllowed) return
    await triggerTest({
      title: t('pages.notifications.testTitle'),
      message: t('pages.notifications.testMessage'),
      category: 'info' as const,
    })
    setShowMenu(false)
  }

  const handleMarkAllRead = async () => {
    await markAllAsRead()
  }

  const navigateToNotifications = () => {
    if (navigate) {
      navigate('notifications')
    } else {
      // Fallback if navigate is not provided (for future use)
      window.location.hash = '#/notifications'
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        title={t('nav.items.notifications') || 'Notifications'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: showMenu ? 'rgba(0,148,255,0.15)' : 'var(--nav-surf)',
          color: hasUnread ? '#dc2626' : 'var(--nav-muted)',
          border: hasUnread
            ? '2px solid #dc2626'
            : showMenu
            ? '2px solid var(--waf-brand)'
            : '1px solid var(--nav-border)',
          cursor: 'pointer',
          transition: 'all 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          if (!hasUnread) {
            e.currentTarget.style.background = 'var(--nav-bg)'
            e.currentTarget.style.transform = 'scale(1.05)'
          }
        }}
        onMouseLeave={(e) => {
          if (!hasUnread) {
            e.currentTarget.style.background = 'var(--nav-surf)'
            e.currentTarget.style.transform = 'scale(1)'
          }
        }}
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {hasUnread && (
          <span
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: '#dc2626',
              border: '2px solid var(--nav-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.55rem',
              fontWeight: 700,
              color: '#fff',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown menu */}
      {showMenu && (
        <div
          ref={menuRef}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '0.5rem',
            width: '360px',
            maxHeight: '500px',
            overflowY: 'auto',
            background: 'var(--nav-bg)',
            border: '1px solid var(--nav-border)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            zIndex: 100,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid var(--nav-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
            }}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--nav-text)' }}>
              {t('pages.notifications.title')} <span style={{ color: 'var(--waf-brand)' }}>{unreadCountFiltered}</span> {t('pages.notifications.unread')}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {unreadCountFiltered > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  style={{
                    fontSize: '0.68rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '6px',
                    background: 'rgba(34,197,94,0.1)',
                    border: '1px solid rgba(34,197,94,0.3)',
                    color: '#22c55e',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {t('pages.notifications.markAllRead')}
                </button>
              )}
              <button
                onClick={() => {
                  setShowMenu(false)
                  navigateToNotifications()
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--waf-brand)',
                  fontSize: '0.72rem',
                  padding: '0.25rem 0.5rem',
                  fontWeight: 600,
                  borderRadius: '4px',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0,148,255,0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none'
                }}
              >
                {t('pages.notifications.viewAll')}
              </button>
              <button
                onClick={() => setShowMenu(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--nav-muted)',
                  fontSize: '0.75rem',
                  padding: '0.25rem',
                }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Notifications list */}
          <div style={{ padding: '0.5rem' }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '2rem 1rem',
                  color: 'var(--muted)',
                  fontSize: '0.78rem',
                }}
              >
                {t('pages.notifications.noNotifications')}
              </div>
            ) : (
              notifications.map((note) => {
                const style = CATEGORY_STYLES[note.category]
                const isUrgent = note.category === 'urgent' || note.category === 'warning'
                return (
                  <div
                    key={note.id}
                    onClick={() => {
                      if (!note.is_read) markAllAsRead()
                    }}
                    style={{
                      display: 'flex',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: note.is_read ? 'rgba(0,0,0,0.03)' : style.bg,
                      border: note.is_read ? '1px solid transparent' : `1px solid ${style.color}44`,
                      cursor: note.is_read ? 'default' : 'pointer',
                      transition: 'all 0.15s',
                      marginBottom: '0.25rem',
                    }}
                    onMouseEnter={(e) => {
                      if (!note.is_read) {
                        e.currentTarget.style.background = style.bg.replace('0.15', '0.2')
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!note.is_read) {
                        e.currentTarget.style.background = style.bg
                      }
                    }}
                  >
                    <div
                      style={{
                        flexShrink: 0,
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: style.color,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                      }}
                    >
                      {style.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: note.is_read ? 400 : 600,
                          color: 'var(--nav-text)',
                          marginBottom: '0.2rem',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {note.title}
                        {note.is_read && (
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.68rem', color: 'var(--nav-muted)' }}>
                            {t('pages.notifications.read')}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--nav-muted)',
                          lineHeight: 1.4,
                          wordBreak: 'break-word',
                        }}
                      >
                        {note.message}
                      </div>
                      <div
                        style={{
                          fontSize: '0.62rem',
                          color: 'var(--nav-muted)',
                          marginTop: '0.35rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <span style={{ color: isUrgent ? style.color : 'var(--nav-muted)', fontWeight: 500 }}>
                          {style.label}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(note.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer - Admin test function */}
          {isAllowed && (
            <div
              style={{
                padding: '0.75rem',
                borderTop: '1px solid var(--nav-border)',
                background: 'rgba(0,0,0,0.02)',
              }}
            >
              <button
                onClick={handleTest}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem',
                  borderRadius: '8px',
                  background: 'var(--waf-brand)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {t('pages.notifications.test')}
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        .notification-menu {
          animation: fadeIn 0.15s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
