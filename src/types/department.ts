export interface Department {
  id: string
  nom: string
  code: string | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface ListDepartmentsParams {
  search?: string
}

export interface UpsertDepartmentPayload {
  nom: string
  code?: string | null
  description?: string | null
}
