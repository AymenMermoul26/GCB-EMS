export type NotificationMetadata = Record<string, unknown>

export interface NotificationItem {
  id: string
  userId: string
  title: string
  body: string
  link: string | null
  isRead: boolean
  createdAt: string
  updatedAt: string
  metadataJson: NotificationMetadata | null
}

export type NotificationsFilter = 'all' | 'unread'
