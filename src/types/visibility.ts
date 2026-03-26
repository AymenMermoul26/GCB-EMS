import {
  PUBLIC_QR_VISIBLE_FIELD_KEYS,
  PUBLIC_QR_VISIBLE_FIELD_LABELS,
  PUBLIC_QR_VISIBILITY_FIELDS as GOVERNED_PUBLIC_QR_VISIBILITY_FIELDS,
  type PublicQrVisibilityFieldKey,
} from '@/types/employee-governance'

export const EMPLOYEE_VISIBILITY_FIELD_KEYS = [...PUBLIC_QR_VISIBLE_FIELD_KEYS]
export const PUBLIC_QR_VISIBILITY_FIELDS = [...GOVERNED_PUBLIC_QR_VISIBILITY_FIELDS]

export type EmployeeVisibilityFieldKey = PublicQrVisibilityFieldKey

export const EMPLOYEE_VISIBILITY_FIELD_LABELS = {
  ...PUBLIC_QR_VISIBLE_FIELD_LABELS,
} as Record<EmployeeVisibilityFieldKey, string>

export function isEmployeeVisibilityFieldKey(
  value: string,
): value is EmployeeVisibilityFieldKey {
  return EMPLOYEE_VISIBILITY_FIELD_KEYS.includes(value as EmployeeVisibilityFieldKey)
}

export interface EmployeeVisibility {
  id: string
  employeId: string
  fieldKey: EmployeeVisibilityFieldKey
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

export type PublicProfileVisibilityRequestStatus =
  | 'PENDING'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'

export type PublicProfileVisibilityRequestStatusFilter =
  | 'ALL'
  | PublicProfileVisibilityRequestStatus

export interface EmployeePublicProfileVisibilityRequestItem {
  id: string
  employeId: string
  requestedByUserId: string
  status: PublicProfileVisibilityRequestStatus
  currentFieldKeys: EmployeeVisibilityFieldKey[]
  requestedFieldKeys: EmployeeVisibilityFieldKey[]
  requestNote: string | null
  reviewNote: string | null
  reviewedByUserId: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminPublicProfileVisibilityRequestItem
  extends EmployeePublicProfileVisibilityRequestItem {
  employeMatricule: string
  employeNom: string
  employePrenom: string
  departementId: string | null
  departementNom: string | null
  liveFieldKeys: EmployeeVisibilityFieldKey[]
}

export interface CreatePublicProfileVisibilityRequestPayload {
  requestedFieldKeys: EmployeeVisibilityFieldKey[]
  requestNote?: string
}

export interface UpdatePublicProfileVisibilityRequestStatusPayload {
  requestId: string
  status: Extract<PublicProfileVisibilityRequestStatus, 'IN_REVIEW' | 'APPROVED' | 'REJECTED'>
  reviewNote?: string
}

export interface ListAdminPublicProfileVisibilityRequestsParams {
  search?: string
  departementId?: string
  status?: PublicProfileVisibilityRequestStatusFilter
  employeId?: string
}

export function sortVisibilityFieldKeys(
  fieldKeys: EmployeeVisibilityFieldKey[],
): EmployeeVisibilityFieldKey[] {
  const seen = new Set<EmployeeVisibilityFieldKey>()

  return [...fieldKeys]
    .filter((fieldKey) => {
      if (!isEmployeeVisibilityFieldKey(fieldKey) || seen.has(fieldKey)) {
        return false
      }

      seen.add(fieldKey)
      return true
    })
    .sort(
      (left, right) =>
        EMPLOYEE_VISIBILITY_FIELD_KEYS.indexOf(left) - EMPLOYEE_VISIBILITY_FIELD_KEYS.indexOf(right),
    )
}

export function areVisibilityFieldKeyArraysEqual(
  left: EmployeeVisibilityFieldKey[],
  right: EmployeeVisibilityFieldKey[],
): boolean {
  const normalizedLeft = sortVisibilityFieldKeys(left)
  const normalizedRight = sortVisibilityFieldKeys(right)

  if (normalizedLeft.length !== normalizedRight.length) {
    return false
  }

  return normalizedLeft.every((value, index) => value === normalizedRight[index])
}

export function getPublicProfileVisibilityRequestStatusMeta(
  status: PublicProfileVisibilityRequestStatus,
): {
  label: string
  tone: 'warning' | 'success' | 'danger' | 'neutral'
} {
  if (status === 'APPROVED') {
    return {
      label: 'Approved',
      tone: 'success',
    }
  }

  if (status === 'REJECTED') {
    return {
      label: 'Rejected',
      tone: 'danger',
    }
  }

  if (status === 'IN_REVIEW') {
    return {
      label: 'In review',
      tone: 'warning',
    }
  }

  return {
    label: 'Pending',
    tone: 'warning',
  }
}
