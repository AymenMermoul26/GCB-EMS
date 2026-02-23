import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import type { NotificationItem, NotificationsFilter } from '@/types/notification'

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

export interface ListMyNotificationsOptions {
  filter?: NotificationsFilter
  limit?: number
}

export const QR_REFRESH_NOTIFICATION_TITLE = 'QR refresh required'

export interface NotifyAdminsQrRefreshPayload {
  employeId: string
  changedFields: Array<'poste' | 'email' | 'telephone' | 'photo_url'>
}

export interface NotifyAdminsQrRefreshResponse {
  ok: boolean
  admins_notified: number
  deduped: number
}

function getQrRefreshNotificationLink(employeId: string) {
  return `/admin/employees/${employeId}#qr`
}

async function currentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    throw new Error(error.message)
  }

  return data.user?.id ?? null
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

async function listMyNotificationsInternal(
  userId?: string | null,
  options: ListMyNotificationsOptions = {},
): Promise<NotificationItem[]> {
  const resolvedUserId = await currentUserId()

  if (!resolvedUserId) {
    return []
  }

  if (userId && userId !== resolvedUserId) {
    console.warn('notificationsService.listMyNotifications received mismatched user id input.')
  }

  let query = supabase
    .from('notifications')
    .select('id, user_id, title, body, link, is_read, created_at, updated_at')
    .eq('user_id', resolvedUserId)
    .order('created_at', { ascending: false })

  if (options.filter === 'unread') {
    query = query.eq('is_read', false)
  }

  if (typeof options.limit === 'number' && Number.isFinite(options.limit) && options.limit > 0) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query.returns<NotificationRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map(mapNotification)
}

export async function listMyNotifications(
  userId?: string | null,
  options: ListMyNotificationsOptions = {},
): Promise<NotificationItem[]> {
  return listMyNotificationsInternal(userId, options)
}

export async function countUnreadMyNotifications(userId?: string | null): Promise<number> {
  const resolvedUserId = await currentUserId()

  if (!resolvedUserId) {
    return 0
  }

  if (userId && userId !== resolvedUserId) {
    console.warn('notificationsService.countUnreadMyNotifications received mismatched user id input.')
  }

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', resolvedUserId)
    .eq('is_read', false)

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
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
  const userId = await currentUserId()

  if (!userId) {
    throw new Error('User is not authenticated.')
  }

  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', userId)
    .select('id, user_id, title, body, link, is_read, created_at, updated_at')
    .single<NotificationRow>()

  if (error) {
    throw new Error(error.message)
  }

  return mapNotification(data)
}

export async function markAllMyNotificationsRead(): Promise<number> {
  const userId = await currentUserId()

  if (!userId) {
    throw new Error('User is not authenticated.')
  }

  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
    .select('id')
    .returns<Array<{ id: string }>>()

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).length
}

export async function notifyAdminsQrRefreshRequired(
  payload: NotifyAdminsQrRefreshPayload,
): Promise<NotifyAdminsQrRefreshResponse> {
  const { data, error } = await supabase.functions.invoke<NotifyAdminsQrRefreshResponse>(
    'notify-admin-qr-regenerate',
    {
      body: {
        employe_id: payload.employeId,
        changed_fields: payload.changedFields,
      },
    },
  )

  if (error) {
    throw new Error(error.message)
  }

  if (!data?.ok) {
    throw new Error('Failed to notify admins for QR refresh.')
  }

  return data
}

export async function hasUnreadQrRefreshForEmployee(
  employeId: string,
  userId?: string | null,
): Promise<boolean> {
  const resolvedUserId = await currentUserId()

  if (!resolvedUserId) {
    return false
  }

  if (userId && userId !== resolvedUserId) {
    console.warn('notificationsService.hasUnreadQrRefreshForEmployee received mismatched user id input.')
  }

  const link = getQrRefreshNotificationLink(employeId)
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', resolvedUserId)
    .eq('title', QR_REFRESH_NOTIFICATION_TITLE)
    .eq('link', link)
    .eq('is_read', false)

  if (error) {
    throw new Error(error.message)
  }

  return (count ?? 0) > 0
}

export async function markUnreadQrRefreshForEmployeeRead(
  employeId: string,
  userId?: string | null,
): Promise<number> {
  const resolvedUserId = await currentUserId()

  if (!resolvedUserId) {
    return 0
  }

  if (userId && userId !== resolvedUserId) {
    console.warn('notificationsService.markUnreadQrRefreshForEmployeeRead received mismatched user id input.')
  }

  const link = getQrRefreshNotificationLink(employeId)
  const { data, error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', resolvedUserId)
    .eq('title', QR_REFRESH_NOTIFICATION_TITLE)
    .eq('link', link)
    .eq('is_read', false)
    .select('id')
    .returns<Array<{ id: string }>>()

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).length
}

export function useMyNotificationsQuery(
  userId?: string | null,
  options: ListMyNotificationsOptions = {},
) {
  const filter = options.filter ?? 'all'
  const limit = options.limit ?? null

  return useQuery({
    queryKey: ['notifications', userId ?? null, filter, limit],
    queryFn: () => listMyNotificationsInternal(userId, options),
    enabled: Boolean(userId),
    refetchInterval: 15000,
  })
}

export function useUnreadNotificationsCountQuery(userId?: string | null) {
  return useQuery({
    queryKey: ['notificationsUnreadCount', userId ?? null],
    queryFn: () => countUnreadMyNotifications(userId),
    enabled: Boolean(userId),
    refetchInterval: 15000,
  })
}

export function useHasUnreadQrRefreshForEmployeeQuery(
  employeId?: string | null,
  userId?: string | null,
) {
  return useQuery({
    queryKey: ['qrRefreshRequired', employeId ?? null, userId ?? null],
    queryFn: () => hasUnreadQrRefreshForEmployee(employeId as string, userId),
    enabled: Boolean(employeId && userId),
    refetchInterval: 15000,
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
      await queryClient.invalidateQueries({ queryKey: ['notificationsUnreadCount', userId ?? null] })
      await options?.onSuccess?.(data, variables, onMutateResult, context)
    },
    ...options,
  })
}

export function useMarkAllNotificationsReadMutation(
  userId?: string | null,
  options?: UseMutationOptions<number, Error, void>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markAllMyNotificationsRead,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['notifications', userId ?? null] })
      await queryClient.invalidateQueries({ queryKey: ['notificationsUnreadCount', userId ?? null] })
      await options?.onSuccess?.(data, variables, onMutateResult, context)
    },
    ...options,
  })
}

export const notificationsService = {
  listMyNotifications,
  countUnreadMyNotifications,
  createNotification,
  createNotifications,
  markNotificationRead,
  markAllMyNotificationsRead,
  notifyAdminsQrRefreshRequired,
  hasUnreadQrRefreshForEmployee,
  markUnreadQrRefreshForEmployeeRead,
}

