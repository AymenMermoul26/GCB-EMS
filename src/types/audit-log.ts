export type AuditAction =
  | 'EMPLOYEE_ACTIVATED'
  | 'EMPLOYEE_CREATED'
  | 'EMPLOYEE_UPDATED'
  | 'EMPLOYEE_DEACTIVATED'
  | 'EMPLOYEE_INVITE_SENT'
  | 'EMPLOYEE_INVITE_FAILED'
  | 'EMPLOYEE_INVITE_ACCEPTED'
  | 'EMPLOYEE_SHEET_PREVIEWED'
  | 'EMPLOYEE_SHEET_EXPORTED'
  | 'EMPLOYEE_SHEET_EMAIL_SENT'
  | 'EMPLOYEE_SHEET_EMAIL_FAILED'
  | 'EMPLOYEE_SELF_UPDATED'
  | 'REQUEST_SUBMITTED'
  | 'REQUEST_APPROVED'
  | 'REQUEST_REJECTED'
  | 'QR_GENERATED'
  | 'QR_REGENERATED'
  | 'QR_REVOKED'
  | 'QR_REFRESH_COMPLETED'
  | 'VISIBILITY_UPDATED'
  | 'PAYROLL_EXPORT_GENERATED'
  | 'PAYROLL_EXPORT_PRINT_INITIATED'
  | 'PUBLIC_PROFILE_VIEWED'
  | 'QR_REFRESH_REQUIRED_CREATED'

export interface AuditLogItem {
  id: string
  actorUserId: string | null
  actorLabel: string
  action: string
  targetType: string
  targetId: string | null
  targetLabel: string
  detailsJson: Record<string, unknown>
  detailsPreview: string
  createdAt: string
}

export interface ListAuditLogsParams {
  action?: AuditAction | 'ALL'
  targetEmployeeSearch?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export interface AuditLogListResponse {
  items: AuditLogItem[]
  total: number
  page: number
  pageSize: number
}
