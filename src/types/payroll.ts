import type { NotificationsFilter } from '@/types/notification'

export type PayrollEmployeeStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'

export type PayrollNotificationCategory =
  | 'employment'
  | 'family_admin'
  | 'status_change'
  | 'new_employee'

export type PayrollChangeFieldKey =
  | 'categorieProfessionnelle'
  | 'typeContrat'
  | 'dateRecrutement'
  | 'situationFamiliale'
  | 'nombreEnfants'
  | 'adresse'
  | 'numeroSecuriteSociale'
  | 'isActive'

export interface PayrollEmployeeListItem {
  id: string
  departementId: string | null
  departementNom: string | null
  matricule: string
  nom: string
  prenom: string
  poste: string | null
  categorieProfessionnelle: string | null
  typeContrat: string | null
  isActive: boolean
}

export interface PayrollEmployeeDetail {
  id: string
  departementId: string | null
  departementNom: string | null
  matricule: string
  nom: string
  prenom: string
  photoUrl: string | null
  poste: string | null
  categorieProfessionnelle: string | null
  typeContrat: string | null
  dateRecrutement: string | null
  email: string | null
  telephone: string | null
  sexe: string | null
  dateNaissance: string | null
  lieuNaissance: string | null
  nationalite: string | null
  situationFamiliale: string | null
  nombreEnfants: number | null
  adresse: string | null
  isActive: boolean
  numeroSecuriteSociale: string | null
}

export interface PayrollEmployeeListFilters {
  search?: string
  departementId?: string
  status?: PayrollEmployeeStatusFilter
  typeContrat?: string
}

export interface PayrollNotificationItem {
  id: string
  userId: string
  title: string
  body: string
  link: string | null
  isRead: boolean
  createdAt: string
  updatedAt: string
  category: PayrollNotificationCategory
  employeeId: string | null
  employeeName: string | null
  matricule: string | null
  changedFields: PayrollChangeFieldKey[]
  summary: string
}

export interface PayrollNotificationsListOptions {
  filter?: NotificationsFilter
  limit?: number
}

export type PayrollExportType =
  | 'PAYROLL_EMPLOYEE_DIRECTORY_CSV'
  | 'PAYROLL_EMPLOYEE_INFORMATION_SHEET'

export type PayrollExportAction =
  | 'PAYROLL_EXPORT_GENERATED'
  | 'PAYROLL_EXPORT_PRINT_INITIATED'

export interface PayrollEmployeeExportRow {
  id: string
  departementId: string | null
  departementNom: string | null
  matricule: string
  nom: string
  prenom: string
  poste: string | null
  categorieProfessionnelle: string | null
  typeContrat: string | null
  dateRecrutement: string | null
  email: string | null
  telephone: string | null
  adresse: string | null
  situationFamiliale: string | null
  nombreEnfants: number | null
  isActive: boolean
}

export interface PayrollExportHistoryItem {
  id: string
  action: PayrollExportAction
  exportType: PayrollExportType
  targetType: string
  targetId: string | null
  employeeId: string | null
  employeeName: string | null
  matricule: string | null
  rowCount: number | null
  fileName: string | null
  format: string | null
  search: string | null
  departmentId: string | null
  departmentName: string | null
  status: PayrollEmployeeStatusFilter
  typeContrat: string | null
  createdAt: string
}

export interface PayrollExportHistoryListOptions {
  limit?: number
}
