import {
  PUBLIC_QR_VISIBLE_FIELD_KEYS,
  PUBLIC_QR_VISIBLE_FIELD_LABELS,
  type PublicQrVisibilityFieldKey,
} from '@/types/employee-governance'

export const EMPLOYEE_VISIBILITY_FIELD_KEYS = [...PUBLIC_QR_VISIBLE_FIELD_KEYS]

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

export interface UpsertEmployeeVisibilityPayload {
  employeId: string
  fieldKey: EmployeeVisibilityFieldKey
  isPublic: boolean
}
