import type {
  MonitoringEventCategoryKey,
  MonitoringTone,
} from '@/types/monitoring-dashboard'

interface MonitoringCategoryMeta {
  label: string
  color: string
  tone: MonitoringTone
}

interface MonitoringActionMeta {
  label: string
  categoryKey: MonitoringEventCategoryKey
  tone: MonitoringTone
  critical?: boolean
  failed?: boolean
}

const CATEGORY_META: Record<MonitoringEventCategoryKey, MonitoringCategoryMeta> = {
  employee: {
    label: 'Employee',
    color: '#2563eb',
    tone: 'sky',
  },
  request: {
    label: 'Requests',
    color: '#f59e0b',
    tone: 'amber',
  },
  qr: {
    label: 'QR',
    color: '#0ea5e9',
    tone: 'sky',
  },
  email: {
    label: 'Email',
    color: '#f97316',
    tone: 'orange',
  },
  security: {
    label: 'Security / Auth',
    color: '#ef4444',
    tone: 'rose',
  },
  visibility: {
    label: 'Visibility',
    color: '#10b981',
    tone: 'emerald',
  },
  system: {
    label: 'System',
    color: '#64748b',
    tone: 'slate',
  },
}

const ACTION_META: Record<string, MonitoringActionMeta> = {
  EMPLOYEE_ACTIVATED: {
    label: 'Employee Activated',
    categoryKey: 'employee',
    tone: 'emerald',
  },
  EMPLOYEE_CREATED: {
    label: 'Employee Created',
    categoryKey: 'employee',
    tone: 'sky',
  },
  EMPLOYEE_UPDATED: {
    label: 'Employee Updated',
    categoryKey: 'employee',
    tone: 'slate',
  },
  EMPLOYEE_DEACTIVATED: {
    label: 'Employee Deactivated',
    categoryKey: 'employee',
    tone: 'rose',
    critical: true,
  },
  EMPLOYEE_SELF_UPDATED: {
    label: 'Employee Self Updated',
    categoryKey: 'employee',
    tone: 'amber',
  },
  REQUEST_SUBMITTED: {
    label: 'Request Submitted',
    categoryKey: 'request',
    tone: 'amber',
  },
  REQUEST_APPROVED: {
    label: 'Request Approved',
    categoryKey: 'request',
    tone: 'emerald',
  },
  REQUEST_REJECTED: {
    label: 'Request Rejected',
    categoryKey: 'request',
    tone: 'rose',
    critical: true,
  },
  QR_GENERATED: {
    label: 'QR Generated',
    categoryKey: 'qr',
    tone: 'sky',
  },
  QR_REGENERATED: {
    label: 'QR Regenerated',
    categoryKey: 'qr',
    tone: 'sky',
  },
  QR_REVOKED: {
    label: 'QR Revoked',
    categoryKey: 'qr',
    tone: 'rose',
    critical: true,
  },
  QR_REFRESH_REQUIRED_CREATED: {
    label: 'QR Refresh Required',
    categoryKey: 'qr',
    tone: 'amber',
    critical: true,
  },
  QR_REFRESH_COMPLETED: {
    label: 'QR Refresh Completed',
    categoryKey: 'qr',
    tone: 'emerald',
  },
  EMPLOYEE_INVITE_SENT: {
    label: 'Invite Email Sent',
    categoryKey: 'email',
    tone: 'orange',
  },
  EMPLOYEE_INVITE_FAILED: {
    label: 'Invite Email Failed',
    categoryKey: 'email',
    tone: 'rose',
    critical: true,
    failed: true,
  },
  EMPLOYEE_SHEET_SENT: {
    label: 'Information Sheet Sent',
    categoryKey: 'email',
    tone: 'orange',
  },
  EMPLOYEE_SHEET_SEND_FAILED: {
    label: 'Information Sheet Failed',
    categoryKey: 'email',
    tone: 'rose',
    critical: true,
    failed: true,
  },
  VISIBILITY_UPDATED: {
    label: 'Visibility Updated',
    categoryKey: 'visibility',
    tone: 'emerald',
  },
}

function prettifyAction(action: string): string {
  return action
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .replace(/\bQr\b/g, 'QR')
}

export function getMonitoringCategoryMeta(
  categoryKey: MonitoringEventCategoryKey,
): MonitoringCategoryMeta {
  return CATEGORY_META[categoryKey]
}

export function categorizeAuditAction(action: string): MonitoringEventCategoryKey {
  const actionMeta = ACTION_META[action]
  if (actionMeta) {
    return actionMeta.categoryKey
  }

  if (/(AUTH|LOGIN|PASSWORD|SECURITY)/.test(action)) {
    return 'security'
  }

  return 'system'
}

export function getAuditActionMeta(action: string): MonitoringActionMeta {
  const actionMeta = ACTION_META[action]
  if (actionMeta) {
    return actionMeta
  }

  const categoryKey = categorizeAuditAction(action)
  const categoryMeta = getMonitoringCategoryMeta(categoryKey)

  return {
    label: prettifyAction(action),
    categoryKey,
    tone: categoryMeta.tone,
    critical: isCriticalAuditAction(action),
    failed: isFailedAuditAction(action),
  }
}

export function isFailedAuditAction(action: string): boolean {
  const actionMeta = ACTION_META[action]
  if (actionMeta?.failed !== undefined) {
    return actionMeta.failed
  }

  return /(FAILED|ERROR)/.test(action)
}

export function isCriticalAuditAction(action: string): boolean {
  const actionMeta = ACTION_META[action]
  if (actionMeta?.critical !== undefined) {
    return actionMeta.critical
  }

  return /(FAILED|ERROR|REVOKED|REJECTED|DEACTIVATED|REFRESH_REQUIRED|SECURITY_ALERT)/.test(
    action,
  )
}
