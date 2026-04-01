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
  payroll: {
    label: 'Payroll',
    color: '#8b5cf6',
    tone: 'slate',
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
  EMPLOYEE_INVITE_ACCEPTED: {
    label: 'Invite Accepted',
    categoryKey: 'email',
    tone: 'emerald',
  },
  EMPLOYEE_SHEET_PREVIEWED: {
    label: 'Sheet Previewed',
    categoryKey: 'employee',
    tone: 'slate',
  },
  EMPLOYEE_SHEET_EXPORTED: {
    label: 'Sheet Exported',
    categoryKey: 'employee',
    tone: 'sky',
  },
  EMPLOYEE_SHEET_EMAIL_SENT: {
    label: 'Sheet Email Sent',
    categoryKey: 'email',
    tone: 'orange',
  },
  EMPLOYEE_SHEET_EMAIL_FAILED: {
    label: 'Sheet Email Failed',
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
  PUBLIC_PROFILE_VISIBILITY_REQUEST_SUBMITTED: {
    label: 'Visibility Request Submitted',
    categoryKey: 'visibility',
    tone: 'amber',
  },
  PUBLIC_PROFILE_VISIBILITY_REQUEST_IN_REVIEW: {
    label: 'Visibility Request In Review',
    categoryKey: 'visibility',
    tone: 'slate',
  },
  PUBLIC_PROFILE_VISIBILITY_REQUEST_APPROVED: {
    label: 'Visibility Request Approved',
    categoryKey: 'visibility',
    tone: 'emerald',
  },
  PUBLIC_PROFILE_VISIBILITY_REQUEST_REJECTED: {
    label: 'Visibility Request Rejected',
    categoryKey: 'visibility',
    tone: 'rose',
    critical: true,
  },
  PAYROLL_EXPORT_REQUESTED: {
    label: 'Payroll Export Requested',
    categoryKey: 'payroll',
    tone: 'amber',
  },
  PAYROLL_EXPORT_GENERATED: {
    label: 'Payroll Export Generated',
    categoryKey: 'payroll',
    tone: 'sky',
  },
  PAYROLL_EXPORT_PRINT_INITIATED: {
    label: 'Payroll Sheet Print Initiated',
    categoryKey: 'payroll',
    tone: 'amber',
  },
  PAYROLL_PERIOD_CREATED: {
    label: 'Payroll Period Created',
    categoryKey: 'payroll',
    tone: 'sky',
  },
  PAYROLL_RUN_CREATED: {
    label: 'Payroll Run Created',
    categoryKey: 'payroll',
    tone: 'sky',
  },
  PAYROLL_CALCULATION_STARTED: {
    label: 'Payroll Calculation Started',
    categoryKey: 'payroll',
    tone: 'amber',
  },
  PAYROLL_CALCULATION_COMPLETED: {
    label: 'Payroll Calculation Completed',
    categoryKey: 'payroll',
    tone: 'emerald',
  },
  PAYROLL_CALCULATION_FAILED: {
    label: 'Payroll Calculation Failed',
    categoryKey: 'payroll',
    tone: 'rose',
    critical: true,
    failed: true,
  },
  PAYROLL_RUN_UPDATED: {
    label: 'Payroll Run Updated',
    categoryKey: 'payroll',
    tone: 'amber',
  },
  PAYROLL_RUN_FINALIZED: {
    label: 'Payroll Run Finalized',
    categoryKey: 'payroll',
    tone: 'emerald',
  },
  PAYROLL_PAYSLIP_PUBLISHED: {
    label: 'Payslip Published',
    categoryKey: 'payroll',
    tone: 'emerald',
  },
  PAYSLIP_REQUEST_CREATED: {
    label: 'Payslip Request Created',
    categoryKey: 'payroll',
    tone: 'amber',
  },
  PAYSLIP_REQUEST_STATUS_UPDATED: {
    label: 'Payslip Request Updated',
    categoryKey: 'payroll',
    tone: 'sky',
  },
  PAYSLIP_REQUEST_FULFILLED: {
    label: 'Payslip Request Fulfilled',
    categoryKey: 'payroll',
    tone: 'emerald',
  },
  PAYSLIP_DOCUMENT_PUBLISHED: {
    label: 'Payslip Document Published',
    categoryKey: 'payroll',
    tone: 'emerald',
  },
  PAYSLIP_DOCUMENT_VIEWED: {
    label: 'Payslip Document Viewed',
    categoryKey: 'payroll',
    tone: 'slate',
  },
  PAYSLIP_DOCUMENT_DOWNLOADED: {
    label: 'Payslip Document Downloaded',
    categoryKey: 'payroll',
    tone: 'sky',
  },
  PUBLIC_PROFILE_VIEWED: {
    label: 'Public Profile Viewed',
    categoryKey: 'qr',
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
