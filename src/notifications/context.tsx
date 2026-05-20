import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  Notification,
  fetchNotifications,
  markAsRead as markAsReadApi,
  triggerTestNotification,
  markAllAsRead as markAllAsReadApi,
  NotificationCreate,
  triggerNotification,
} from '../api'
import { NotificationTargetRole } from './types'

// ─── Context ──────────────────────────────────────────────────────────────────

interface NotificationContextValue {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  refreshNotifications: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  triggerTest: (payload: NotificationCreate) => Promise<void>
  triggerForRole: (role: NotificationTargetRole, payload: NotificationCreate) => Promise<void>
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>')
  return ctx
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)

  const refreshNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchNotifications()
      setNotifications(data)
    } catch {
      // Silently fail - notifications are not critical
    } finally {
      setLoading(false)
    }
  }, [])

  const markAsRead = useCallback(async (id: string) => {
    await markAsReadApi(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }, [])

  const markAllAsRead = useCallback(async () => {
    await markAllAsReadApi()
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }, [])

  const triggerTest = useCallback(async (payload: NotificationCreate) => {
    const notification = await triggerTestNotification(payload)
    setNotifications(prev => [notification, ...prev])
  }, [])

  const triggerForRole = useCallback(async (role: NotificationTargetRole, payload: NotificationCreate) => {
    const notification = await triggerNotification({ ...payload, target_role: role })
    setNotifications(prev => [notification, ...prev])
  }, [])

  // Refresh on mount
  useEffect(() => {
    refreshNotifications()
  }, [refreshNotifications])

  const value: NotificationContextValue = {
    notifications,
    unreadCount: notifications.filter(n => !n.is_read).length,
    loading,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    triggerTest,
    triggerForRole,
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}
