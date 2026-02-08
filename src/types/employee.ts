export interface Employee {
  id: string
  departementId: string
  matricule: string
  nom: string
  prenom: string
  poste: string | null
  email: string | null
  telephone: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface EmployeeSortOption {
  field: 'nom' | 'prenom' | 'matricule' | 'created_at' | 'updated_at'
  direction: 'asc' | 'desc'
}

export interface EmployeesListParams {
  search?: string
  departementId?: string
  isActive?: boolean
  page?: number
  pageSize?: number
  sort?: EmployeeSortOption
}

export interface EmployeesListResponse {
  items: Employee[]
  total: number
  page: number
  pageSize: number
}

export interface CreateEmployeePayload {
  departementId: string
  matricule: string
  nom: string
  prenom: string
  poste?: string | null
  email?: string | null
  telephone?: string | null
  isActive?: boolean
}

export type UpdateEmployeePayload = Partial<CreateEmployeePayload>
