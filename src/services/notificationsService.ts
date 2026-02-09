import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query'

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

export interface CreateNotificationPayload {
  userId: string
  title: string
  body: string
  link?: string | null
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

export async function createNotification(
  payload: CreateNotificationPayload,
): Promise<NotificationItem> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: payload.userId,
      title: payload.title,
      body: payload.body,
      link: payload.link ?? null,
      is_read: false,
    })
    .select('id, user_id, title, body, link, is_read, created_at, updated_at')
    .single<NotificationRow>()

  if (error) {
    throw new Error(error.message)
  }

  return mapNotification(data)
}

export async function createNotifications(
  payloads: CreateNotificationPayload[],
): Promise<void> {
  if (payloads.length === 0) {
    return
  }

  const { error } = await supabase.from('notifications').insert(
    payloads.map((payload) => ({
      user_id: payload.userId,
      title: payload.title,
      body: payload.body,
      link: payload.link ?? null,
      is_read: false,
    })),
  )

  if (error) {
    throw new Error(error.message)
  }
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

export function useMyNotificationsQuery(userId?: string | null) {
  return useQuery({
    queryKey: ['notifications', userId ?? null],
    queryFn: listMyNotifications,
    enabled: Boolean(userId),
  })
}

export function useMarkNotificationReadMutation(
  userId?: string | null,
  options?: UseMutationOptions<NotificationItem, Error, string>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['notifications', userId ?? null] })
      await options?.onSuccess?.(data, variables, onMutateResult, context)
    },
    ...options,
  })
}

export const notificationsService = {
  listMyNotifications,
  createNotification,
  createNotifications,
  markNotificationRead,
}

