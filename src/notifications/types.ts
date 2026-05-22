export type NotificationCategory = 'info' | 'warning' | 'urgent' | 'success'
export type NotificationReadStatus = 'read' | 'unread'
export type NotificationTargetRole = 'admin' | 'clevel' | 'architect' | 'engineer' | 'all'

export interface Notification {
  id: string
  title: string
  message: string
  category: NotificationCategory
  is_read: boolean
  created_at: string
  expires_at?: string
  triggered_by: string
  target_role?: NotificationTargetRole
}

export interface NotificationCreate {
  title: string
  message: string
  category: NotificationCategory
  expires_at?: string
  target_role?: NotificationTargetRole
}

export interface NotificationUpdate {
  title?: string
  message?: string
  category?: NotificationCategory
  is_read?: boolean
}
