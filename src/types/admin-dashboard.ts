import type { AuditLogItem } from '@/types/audit-log'
import type { ModificationRequest } from '@/types/modification-request'
import type { MonitoringTone } from '@/types/monitoring-dashboard'

export interface DashboardKpis {
  totalEmployees: number
  activeEmployees: number
  inactiveEmployees: number
  pendingRequests: number
  departmentsCount: number
  unreadNotifications: number
  invitesSentRecent: number
  inviteFailuresRecent: number
}

export interface DashboardDepartmentMetric {
  id: string
  name: string
  employeeCount: number
  activeCount: number
}

export interface DashboardRequestOverview {
  pending: number
  approved: number
  rejected: number
  total: number
}

export interface DashboardRecentEmployee {
  id: string
  fullName: string
  matricule: string
  poste: string | null
  departmentName: string
  createdAt: string
  isActive: boolean
}

export interface DashboardQrSummary {
  activeQrEmployees: number
  employeesWithoutActiveQr: number
  needsQrRefresh: number
  publicProfileViewsRecent: number
}

export interface DashboardRecentInvite {
  id: string
  employeeId: string | null
  employeeName: string
  recipientEmail: string
  status: 'sent' | 'failed' | 'accepted'
  triggerSource: 'invite' | 'resend_invite' | null
  createdAt: string
  failureReason?: string
}

export interface DashboardInviteLifecycleSummary {
  sent: number
  resend: number
  accepted: number
  failed: number
}

export interface DashboardRecentPayrollActivity {
  id: string
  action: string
  actionLabel: string
  tone: MonitoringTone
  actorLabel: string
  targetLabel: string
  employeeId: string | null
  employeeName: string | null
  rowCount: number | null
  format: string | null
  fileName: string | null
  summary: string
  createdAt: string
}

export interface DashboardAlertItem {
  id: string
  title: string
  description: string
  href?: string
  tone: 'warning' | 'info'
}

export interface AdminDashboardSectionErrors {
  overview?: string
  recentActivity?: string
  recentRequests?: string
  recentInvites?: string
  recentPayrollActivity?: string
}

export interface AdminDashboardData {
  kpis: DashboardKpis
  departmentDistribution: DashboardDepartmentMetric[]
  requestOverview: DashboardRequestOverview
  recentActivity: AuditLogItem[]
  recentRequests: ModificationRequest[]
  recentEmployees: DashboardRecentEmployee[]
  recentInvites: DashboardRecentInvite[]
  inviteLifecycleSummary: DashboardInviteLifecycleSummary
  recentPayrollActivity: DashboardRecentPayrollActivity[]
  qrSummary: DashboardQrSummary
  alerts: DashboardAlertItem[]
  sectionErrors: AdminDashboardSectionErrors
}
