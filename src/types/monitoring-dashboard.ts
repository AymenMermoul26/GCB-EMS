import type { AuditLogItem } from '@/types/audit-log'

export type MonitoringPeriod = 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS'

export type MonitoringEventCategoryKey =
  | 'employee'
  | 'request'
  | 'qr'
  | 'email'
  | 'payroll'
  | 'security'
  | 'visibility'
  | 'system'

export type MonitoringCategory = 'ALL' | MonitoringEventCategoryKey

export type MonitoringTone =
  | 'slate'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'sky'
  | 'orange'

export interface MonitoringDashboardFilters {
  period?: MonitoringPeriod
  category?: MonitoringCategory
}

export interface MonitoringKpis {
  totalEvents: number
  qrEvents: number
  emailEvents: number
  payrollEvents: number
  securityEvents: number
  failedEvents: number
  criticalEvents: number
}

export interface MonitoringTimelinePoint {
  key: string
  label: string
  fullLabel: string
  total: number
  critical: number
  qr: number
  email: number
}

export interface MonitoringDistributionItem {
  key: MonitoringEventCategoryKey
  label: string
  value: number
  color: string
}

export interface MonitoringMetricItem {
  key: string
  label: string
  value: number
  helper: string
  tone: MonitoringTone
}

export interface MonitoringRecentEvent extends AuditLogItem {
  actionLabel: string
  categoryKey: MonitoringEventCategoryKey
  categoryLabel: string
  tone: MonitoringTone
  critical: boolean
}

export interface MonitoringRecentInviteItem {
  id: string
  employeeId: string | null
  employeeName: string
  recipientEmail: string
  status: 'sent' | 'failed' | 'accepted'
  triggerSource: 'invite' | 'resend_invite' | null
  createdAt: string
  failureReason?: string
}

export interface MonitoringRecentPayrollActivityItem {
  id: string
  action: string
  actionLabel: string
  tone: MonitoringTone
  actorLabel: string
  targetLabel: string
  employeeId: string | null
  employeeName: string | null
  rowCount: number | null
  fileName: string | null
  format: string | null
  summary: string
  createdAt: string
}

export interface MonitoringTopActionItem {
  action: string
  label: string
  categoryKey: MonitoringEventCategoryKey
  categoryLabel: string
  count: number
  tone: MonitoringTone
  critical: boolean
}

export interface MonitoringInsightItem {
  id: string
  title: string
  description: string
  count: number
  tone: 'info' | 'warning' | 'danger' | 'positive'
}

export interface MonitoringSectionErrors {
  recentCriticalEvents?: string
  recentPayrollActivity?: string
}

export interface MonitoringDashboardData {
  period: MonitoringPeriod
  categoryFilter: MonitoringCategory
  rangeLabel: string
  startAt: string
  endAt: string
  totalAvailableEvents: number
  filteredEvents: number
  hasSecuritySignals: boolean
  kpis: MonitoringKpis
  activityTimeline: MonitoringTimelinePoint[]
  categoryDistribution: MonitoringDistributionItem[]
  qrActivity: MonitoringMetricItem[]
  emailActivity: MonitoringMetricItem[]
  recentInviteEvents: MonitoringRecentInviteItem[]
  payrollActivity: MonitoringMetricItem[]
  recentPayrollActivity: MonitoringRecentPayrollActivityItem[]
  recentCriticalEvents: MonitoringRecentEvent[]
  topActions: MonitoringTopActionItem[]
  attentionItems: MonitoringInsightItem[]
  sectionErrors: MonitoringSectionErrors
}
