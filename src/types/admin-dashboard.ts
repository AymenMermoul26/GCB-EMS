import type { AuditLogItem } from '@/types/audit-log'
import type { ModificationRequest } from '@/types/modification-request'

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

export interface DashboardRecentPayrollExport {
  id: string
  action: 'PAYROLL_EXPORT_GENERATED' | 'PAYROLL_EXPORT_PRINT_INITIATED'
  actorLabel: string
  employeeId: string | null
  employeeName: string | null
  rowCount: number | null
  format: string | null
  fileName: string | null
  scopeSummary: string
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
  recentPayrollExports?: string
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
  recentPayrollExports: DashboardRecentPayrollExport[]
  qrSummary: DashboardQrSummary
  alerts: DashboardAlertItem[]
  sectionErrors: AdminDashboardSectionErrors
}
