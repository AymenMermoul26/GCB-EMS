export interface NotificationItem {
  id: string
  userId: string
  title: string
  body: string
  link: string | null
  isRead: boolean
  createdAt: string
  updatedAt: string
}

export type NotificationsFilter = 'all' | 'unread'
