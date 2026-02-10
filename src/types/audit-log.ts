export type AuditAction =
  | 'EMPLOYEE_CREATED'
  | 'EMPLOYEE_UPDATED'
  | 'EMPLOYEE_DEACTIVATED'
  | 'EMPLOYEE_SELF_UPDATED'
  | 'REQUEST_SUBMITTED'
  | 'REQUEST_APPROVED'
  | 'REQUEST_REJECTED'
  | 'QR_REGENERATED'
  | 'QR_REVOKED'
  | 'VISIBILITY_UPDATED'

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
