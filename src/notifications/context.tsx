import { createContext, useCallback, useContext } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  fetchNotifications,
  markAllAsRead as markAllAsReadApi,
  markAsRead as markAsReadApi,
  triggerNotification,
  triggerTestNotification,
  type Notification,
  type NotificationCreate,
} from '../api'
import { qk } from '../lib/queryKeys'
import type { NotificationTargetRole } from './types'

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

/**
 * Server state for the notification bell. TanStack Query owns fetching,
 * caching, polling, and invalidation; mutations update the cache optimistically
 * and reconcile on settle.
 */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: qk.notifications,
    queryFn: fetchNotifications,
    refetchInterval: 60_000,
  })

  const notifications = data ?? []

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => markAsReadApi(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: qk.notifications })
      const previous = queryClient.getQueryData<Notification[]>(qk.notifications)
      queryClient.setQueryData<Notification[]>(qk.notifications, old =>
        old?.map(n => (n.id === id ? { ...n, is_read: true } : n)) ?? [],
      )
      return { previous }
    },
    onError: (_error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(qk.notifications, context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.notifications })
    },
  })

  const markAllAsReadMutation = useMutation({
    mutationFn: markAllAsReadApi,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: qk.notifications })
      const previous = queryClient.getQueryData<Notification[]>(qk.notifications)
      queryClient.setQueryData<Notification[]>(qk.notifications, old =>
        old?.map(n => ({ ...n, is_read: true })) ?? [],
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(qk.notifications, context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: qk.notifications })
    },
  })

  const triggerTestMutation = useMutation({
    mutationFn: (payload: NotificationCreate) => triggerTestNotification(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.notifications })
    },
  })

  const triggerForRoleMutation = useMutation({
    mutationFn: ({ role, payload }: { role: NotificationTargetRole; payload: NotificationCreate }) =>
      triggerNotification({ ...payload, target_role: role }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.notifications })
    },
  })

  const refreshNotifications = useCallback(async () => {
    await refetch()
  }, [refetch])

  const value: NotificationContextValue = {
    notifications,
    unreadCount: notifications.filter(n => !n.is_read).length,
    loading: isLoading || isFetching,
    refreshNotifications,
    markAsRead: async (id: string) => {
      await markAsReadMutation.mutateAsync(id)
    },
    markAllAsRead: async () => {
      await markAllAsReadMutation.mutateAsync()
    },
    triggerTest: async (payload: NotificationCreate) => {
      await triggerTestMutation.mutateAsync(payload)
    },
    triggerForRole: async (role: NotificationTargetRole, payload: NotificationCreate) => {
      await triggerForRoleMutation.mutateAsync({ role, payload })
    },
  }

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}
