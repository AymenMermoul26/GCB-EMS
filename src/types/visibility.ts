export const EMPLOYEE_VISIBILITY_FIELD_KEYS = [
  'nom',
  'prenom',
  'poste',
  'email',
  'telephone',
  'photo_url',
  'departement',
  'matricule',
] as const

export type EmployeeVisibilityFieldKey =
  (typeof EMPLOYEE_VISIBILITY_FIELD_KEYS)[number]

export interface EmployeeVisibility {
  id: string
  employeId: string
  fieldKey: string
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

export interface UpsertEmployeeVisibilityPayload {
  employeId: string
  fieldKey: string
  isPublic: boolean
}
