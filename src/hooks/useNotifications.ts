// src/hooks/useNotifications.ts
// Realtime notifications via Supabase channel subscription

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Notification } from '@/types'

// ─── Fetch notifications ──────────────────────────────────────
export function useNotifications(userId: string) {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return data as Notification[]
    },
    enabled: !!userId,
  })

  // Realtime subscription
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notif = payload.new as Notification
          // Prepend new notification to cache
          qc.setQueryData(['notifications', userId], (old: Notification[] | undefined) => {
            return [notif, ...(old ?? [])]
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, qc])

  return query
}

// ─── Unread count ─────────────────────────────────────────────
export function useUnreadCount(userId: string) {
  return useQuery({
    queryKey: ['notifications-unread', userId],
    queryFn: async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false)
      return count ?? 0
    },
    enabled: !!userId,
    refetchInterval: 30000, // Refresh every 30s as backup
  })
}

// ─── Mark as read ─────────────────────────────────────────────
export function useMarkNotificationsRead() {
  const qc = useQueryClient()

  return useCallback(async (userId: string, notifId?: string) => {
    if (notifId) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notifId)
    } else {
      // Mark all as read
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
    }
    qc.invalidateQueries({ queryKey: ['notifications', userId] })
    qc.invalidateQueries({ queryKey: ['notifications-unread', userId] })
  }, [qc])
}

// ─── Register FCM push token ──────────────────────────────────
export async function registerPushToken(userId: string) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const registration = await navigator.serviceWorker.register('/sw.js')
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY

    if (!vapidKey) return

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: vapidKey,
    })

    // Save FCM/VAPID token to profile
    const token = JSON.stringify(subscription)
    await supabase
      .from('profiles')
      .update({ fcm_token: token })
      .eq('id', userId)

    console.log('Push notifications registered')
    return token
  } catch (err) {
    console.warn('Push registration failed:', err)
  }
}

// ─── Notification Bell Component helper ──────────────────────
// Returns data needed to render a bell icon with badge

export function useNotificationBell(userId: string) {
  const { data: notifications } = useNotifications(userId)
  const { data: unreadCount = 0 } = useUnreadCount(userId)
  const markRead = useMarkNotificationsRead()

  const markAllRead = useCallback(() => markRead(userId), [markRead, userId])
  const markOneRead = useCallback((id: string) => markRead(userId, id), [markRead, userId])

  return {
    notifications: notifications ?? [],
    unreadCount,
    markAllRead,
    markOneRead,
    hasUnread: unreadCount > 0,
  }
}
