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
  actionFilter?: string
  targetEmployeeSearch?: string
  page?: number
  pageSize?: number
}

export interface AuditLogListResponse {
  items: AuditLogItem[]
  total: number
  page: number
  pageSize: number
}
