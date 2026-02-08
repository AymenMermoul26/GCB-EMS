import { useMutation, useQuery, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import type { NotificationItem } from '@/types/notification'

interface NotificationRow {
  id: string
  user_id: string
  title: string
  body: string
  link: string | null
  is_read: boolean
  created_at: string
  updated_at: string
}

function mapNotification(row: NotificationRow): NotificationItem {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    body: row.body,
    link: row.link,
    isRead: row.is_read,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listMyNotifications(): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, title, body, link, is_read, created_at, updated_at')
    .order('created_at', { ascending: false })
    .returns<NotificationRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map(mapNotification)
}

export async function markNotificationRead(id: string): Promise<NotificationItem> {
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .select('id, user_id, title, body, link, is_read, created_at, updated_at')
    .single<NotificationRow>()

  if (error) {
    throw new Error(error.message)
  }

  return mapNotification(data)
}

export function useMyNotificationsQuery() {
  return useQuery({
    queryKey: ['notifications', 'me'],
    queryFn: listMyNotifications,
  })
}

export function useMarkNotificationReadMutation(
  options?: UseMutationOptions<NotificationItem, Error, string>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['notifications', 'me'] })
      await options?.onSuccess?.(data, variables, onMutateResult, context)
    },
    ...options,
  })
}

export const notificationsService = {
  listMyNotifications,
  markNotificationRead,
}
