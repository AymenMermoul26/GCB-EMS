import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query'

import { ROUTES } from '@/constants/routes'
import { supabase } from '@/lib/supabaseClient'
import type {
  NotificationItem,
  NotificationMetadata,
  NotificationsFilter,
} from '@/types/notification'

interface NotificationRow {
  id: string
  user_id: string
  title: string
  body: string
  link: string | null
  is_read: boolean
  created_at: string
  updated_at: string
  metadata_json: NotificationMetadata | null
}

export interface CreateNotificationPayload {
  userId: string
  title: string
  body: string
  link?: string | null
  metadataJson?: NotificationMetadata | null
}

export interface ListMyNotificationsOptions {
  filter?: NotificationsFilter
  limit?: number
  scope?: string
}

export const QR_REFRESH_NOTIFICATION_TITLE = 'QR refresh required'
export const EMPLOYEE_QR_NOTIFICATION_SCOPE = 'employee_qr_profile'
export const EMPLOYEE_PUBLIC_PROFILE_NOTIFICATION_SCOPE =
  'employee_public_profile_visibility_request'

export interface NotifyAdminsQrRefreshPayload {
  employeId: string
  changedFields: Array<'poste' | 'email' | 'telephone' | 'photo_url'>
}

export interface NotifyAdminsQrRefreshResponse {
  ok: boolean
  admins_notified: number
  deduped: number
}

export interface NotifyEmployeeQrLifecyclePayload {
  userId: string
  employeId: string
  tokenId: string
  event: 'generated' | 'updated'
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
    metadataJson: row.metadata_json ?? null,
  }
}

async function upsertUnreadScopedNotification(
  payload: CreateNotificationPayload & {
    scope: string
    dedupeKey: string
  },
): Promise<NotificationItem> {
  const metadataJson = {
    ...(payload.metadataJson ?? {}),
    scope: payload.scope,
    dedupe_key: payload.dedupeKey,
  } satisfies NotificationMetadata

  const { data: existingRows, error: existingError } = await supabase
    .from('notifications')
    .select('id, user_id, title, body, link, is_read, created_at, updated_at, metadata_json')
    .eq('user_id', payload.userId)
    .eq('is_read', false)
    .eq('metadata_json->>scope', payload.scope)
    .eq('metadata_json->>dedupe_key', payload.dedupeKey)
    .order('created_at', { ascending: false })
    .limit(1)
    .returns<NotificationRow[]>()

  if (existingError) {
    throw new Error(existingError.message)
  }

  const existing = existingRows?.[0]

  if (!existing) {
    return createNotification({
      userId: payload.userId,
      title: payload.title,
      body: payload.body,
      link: payload.link,
      metadataJson,
    })
  }

  const { data, error } = await supabase
    .from('notifications')
    .update({
      title: payload.title,
      body: payload.body,
      link: payload.link ?? null,
      metadata_json: metadataJson,
      is_read: false,
    })
    .eq('id', existing.id)
    .eq('user_id', payload.userId)
    .select('id, user_id, title, body, link, is_read, created_at, updated_at, metadata_json')
    .single<NotificationRow>()

  if (error) {
    throw new Error(error.message)
  }

  return mapNotification(data)
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
    .select('id, user_id, title, body, link, is_read, created_at, updated_at, metadata_json')
    .eq('user_id', resolvedUserId)
    .order('created_at', { ascending: false })

  if (options.filter === 'unread') {
    query = query.eq('is_read', false)
  }

  if (options.scope) {
    query = query.eq('metadata_json->>scope', options.scope)
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

export async function countUnreadMyNotifications(
  userId?: string | null,
  options: Pick<ListMyNotificationsOptions, 'scope'> = {},
): Promise<number> {
  const resolvedUserId = await currentUserId()

  if (!resolvedUserId) {
    return 0
  }

  if (userId && userId !== resolvedUserId) {
    console.warn('notificationsService.countUnreadMyNotifications received mismatched user id input.')
  }

  let query = supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', resolvedUserId)
    .eq('is_read', false)

  if (options.scope) {
    query = query.eq('metadata_json->>scope', options.scope)
  }

  const { count, error } = await query

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
      metadata_json: payload.metadataJson ?? {},
    })
    .select('id, user_id, title, body, link, is_read, created_at, updated_at, metadata_json')
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
      metadata_json: payload.metadataJson ?? {},
    })),
  )

  if (error) {
    throw new Error(error.message)
  }
}

export async function notifyEmployeeQrLifecycle(
  payload: NotifyEmployeeQrLifecyclePayload,
): Promise<NotificationItem> {
  const notificationCopy =
    payload.event === 'generated'
      ? {
          title: 'QR code generated',
          body: 'Your QR code has been generated and is ready to use.',
        }
      : {
          title: 'QR code updated',
          body: 'Your QR code has been updated. Use the latest QR code for your public profile.',
        }

  return upsertUnreadScopedNotification({
    userId: payload.userId,
    title: notificationCopy.title,
    body: notificationCopy.body,
    link: ROUTES.EMPLOYEE_MY_QR,
    scope: EMPLOYEE_QR_NOTIFICATION_SCOPE,
    dedupeKey: payload.employeId,
    metadataJson: {
      event_key: payload.event === 'generated' ? 'QR_GENERATED' : 'QR_UPDATED',
      employe_id: payload.employeId,
      token_id: payload.tokenId,
    },
  })
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
    .select('id, user_id, title, body, link, is_read, created_at, updated_at, metadata_json')
    .single<NotificationRow>()

  if (error) {
    throw new Error(error.message)
  }

  return mapNotification(data)
}

export async function markAllMyNotificationsRead(
  options: Pick<ListMyNotificationsOptions, 'scope'> = {},
): Promise<number> {
  const userId = await currentUserId()

  if (!userId) {
    throw new Error('User is not authenticated.')
  }

  let query = supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)

  if (options.scope) {
    query = query.eq('metadata_json->>scope', options.scope)
  }

  const { data, error } = await query.select('id').returns<Array<{ id: string }>>()

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
  const scope = options.scope ?? null

  return useQuery({
    queryKey: ['notifications', userId ?? null, filter, limit, scope],
    queryFn: () => listMyNotificationsInternal(userId, options),
    enabled: Boolean(userId),
    refetchInterval: 15000,
  })
}

export function useUnreadNotificationsCountQuery(
  userId?: string | null,
  options: Pick<ListMyNotificationsOptions, 'scope'> = {},
) {
  const scope = options.scope ?? null

  return useQuery({
    queryKey: ['notificationsUnreadCount', userId ?? null, scope],
    queryFn: () => countUnreadMyNotifications(userId, options),
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
    mutationFn: () => markAllMyNotificationsRead(),
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
  notifyEmployeeQrLifecycle,
  markNotificationRead,
  markAllMyNotificationsRead,
  notifyAdminsQrRefreshRequired,
  hasUnreadQrRefreshForEmployee,
  markUnreadQrRefreshForEmployeeRead,
}


