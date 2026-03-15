export type AuditAction =
  | 'EMPLOYEE_ACTIVATED'
  | 'EMPLOYEE_CREATED'
  | 'EMPLOYEE_UPDATED'
  | 'EMPLOYEE_DEACTIVATED'
  | 'EMPLOYEE_INVITE_SENT'
  | 'EMPLOYEE_INVITE_FAILED'
  | 'EMPLOYEE_SELF_UPDATED'
  | 'EMPLOYEE_SHEET_SEND_FAILED'
  | 'REQUEST_SUBMITTED'
  | 'REQUEST_APPROVED'
  | 'REQUEST_REJECTED'
  | 'QR_GENERATED'
  | 'QR_REGENERATED'
  | 'QR_REVOKED'
  | 'QR_REFRESH_COMPLETED'
  | 'VISIBILITY_UPDATED'
  | 'QR_REFRESH_REQUIRED_CREATED'
  | 'EMPLOYEE_SHEET_SENT'

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
