export type EmployeeFieldAccessLevel = 'full' | 'partial' | 'hidden'

export type EmployeeDataSurface =
  | 'admin_internal'
  | 'employee_self'
  | 'payroll_list'
  | 'payroll_detail'
  | 'payroll_export'
  | 'public_qr'

export type EmployeeFieldGroup =
  | 'identity_basic'
  | 'organization'
  | 'employment'
  | 'contract'
  | 'contact'
  | 'government_official'
  | 'education_career'
  | 'sensitive_private'
  | 'internal_admin'
  | 'system_metadata'

export type GovernedEmployeeFieldKey =
  | 'id'
  | 'departementId'
  | 'matricule'
  | 'nom'
  | 'prenom'
  | 'photoUrl'
  | 'sexe'
  | 'dateNaissance'
  | 'lieuNaissance'
  | 'nationalite'
  | 'telephone'
  | 'email'
  | 'adresse'
  | 'poste'
  | 'categorieProfessionnelle'
  | 'typeContrat'
  | 'dateRecrutement'
  | 'isActive'
  | 'situationFamiliale'
  | 'nombreEnfants'
  | 'diplome'
  | 'specialite'
  | 'historiquePostes'
  | 'numeroSecuriteSociale'
  | 'observations'
  | 'createdAt'
  | 'updatedAt'

export interface EmployeeFieldGovernanceRule {
  key: GovernedEmployeeFieldKey
  label: string
  group: EmployeeFieldGroup
  access: Record<EmployeeDataSurface, EmployeeFieldAccessLevel>
}

export const EMPLOYEE_FIELD_GOVERNANCE_RULES: EmployeeFieldGovernanceRule[] = [
  {
    key: 'id',
    label: 'Record ID',
    group: 'system_metadata',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'full',
      payroll_detail: 'full',
      payroll_export: 'hidden',
      public_qr: 'hidden',
    },
  },
  {
    key: 'departementId',
    label: 'Department ID',
    group: 'organization',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'full',
      payroll_detail: 'full',
      payroll_export: 'hidden',
      public_qr: 'hidden',
    },
  },
  {
    key: 'matricule',
    label: 'Employee ID',
    group: 'identity_basic',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'full',
      payroll_detail: 'full',
      payroll_export: 'full',
      public_qr: 'partial',
    },
  },
  {
    key: 'nom',
    label: 'Last Name',
    group: 'identity_basic',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'full',
      payroll_detail: 'full',
      payroll_export: 'full',
      public_qr: 'partial',
    },
  },
  {
    key: 'prenom',
    label: 'First Name',
    group: 'identity_basic',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'full',
      payroll_detail: 'full',
      payroll_export: 'full',
      public_qr: 'partial',
    },
  },
  {
    key: 'photoUrl',
    label: 'Photo',
    group: 'identity_basic',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'hidden',
      payroll_detail: 'full',
      payroll_export: 'hidden',
      public_qr: 'partial',
    },
  },
  {
    key: 'sexe',
    label: 'Sex',
    group: 'identity_basic',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'hidden',
      payroll_detail: 'full',
      payroll_export: 'hidden',
      public_qr: 'hidden',
    },
  },
  {
    key: 'dateNaissance',
    label: 'Birth Date',
    group: 'identity_basic',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'hidden',
      payroll_detail: 'full',
      payroll_export: 'hidden',
      public_qr: 'hidden',
    },
  },
  {
    key: 'lieuNaissance',
    label: 'Birth Place',
    group: 'identity_basic',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'hidden',
      payroll_detail: 'full',
      payroll_export: 'hidden',
      public_qr: 'hidden',
    },
  },
  {
    key: 'nationalite',
    label: 'Nationality',
    group: 'identity_basic',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'hidden',
      payroll_detail: 'full',
      payroll_export: 'hidden',
      public_qr: 'hidden',
    },
  },
  {
    key: 'telephone',
    label: 'Phone',
    group: 'contact',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'hidden',
      payroll_detail: 'full',
      payroll_export: 'full',
      public_qr: 'partial',
    },
  },
  {
    key: 'email',
    label: 'Email',
    group: 'contact',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'hidden',
      payroll_detail: 'full',
      payroll_export: 'full',
      public_qr: 'partial',
    },
  },
  {
    key: 'adresse',
    label: 'Address',
    group: 'sensitive_private',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'hidden',
      payroll_detail: 'full',
      payroll_export: 'full',
      public_qr: 'hidden',
    },
  },
  {
    key: 'poste',
    label: 'Job Title',
    group: 'employment',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'full',
      payroll_detail: 'full',
      payroll_export: 'full',
      public_qr: 'partial',
    },
  },
  {
    key: 'categorieProfessionnelle',
    label: 'Professional Category',
    group: 'contract',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'full',
      payroll_detail: 'full',
      payroll_export: 'full',
      public_qr: 'hidden',
    },
  },
  {
    key: 'typeContrat',
    label: 'Contract Type',
    group: 'contract',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'full',
      payroll_detail: 'full',
      payroll_export: 'full',
      public_qr: 'hidden',
    },
  },
  {
    key: 'dateRecrutement',
    label: 'Hire Date',
    group: 'employment',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'hidden',
      payroll_detail: 'full',
      payroll_export: 'full',
      public_qr: 'hidden',
    },
  },
  {
    key: 'isActive',
    label: 'Status',
    group: 'employment',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'full',
      payroll_detail: 'full',
      payroll_export: 'full',
      public_qr: 'hidden',
    },
  },
  {
    key: 'situationFamiliale',
    label: 'Marital Status',
    group: 'sensitive_private',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'hidden',
      payroll_detail: 'full',
      payroll_export: 'full',
      public_qr: 'hidden',
    },
  },
  {
    key: 'nombreEnfants',
    label: 'Number of Children',
    group: 'sensitive_private',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'hidden',
      payroll_detail: 'full',
      payroll_export: 'full',
      public_qr: 'hidden',
    },
  },
  {
    key: 'diplome',
    label: 'Degree',
    group: 'education_career',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'hidden',
      payroll_detail: 'hidden',
      payroll_export: 'hidden',
      public_qr: 'hidden',
    },
  },
  {
    key: 'specialite',
    label: 'Specialization',
    group: 'education_career',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'hidden',
      payroll_detail: 'hidden',
      payroll_export: 'hidden',
      public_qr: 'hidden',
    },
  },
  {
    key: 'historiquePostes',
    label: 'Career History',
    group: 'education_career',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'hidden',
      payroll_detail: 'hidden',
      payroll_export: 'hidden',
      public_qr: 'hidden',
    },
  },
  {
    key: 'numeroSecuriteSociale',
    label: 'Social Security Number',
    group: 'government_official',
    access: {
      admin_internal: 'full',
      employee_self: 'hidden',
      payroll_list: 'hidden',
      payroll_detail: 'full',
      payroll_export: 'hidden',
      public_qr: 'hidden',
    },
  },
  {
    key: 'observations',
    label: 'Internal HR Notes',
    group: 'internal_admin',
    access: {
      admin_internal: 'full',
      employee_self: 'hidden',
      payroll_list: 'hidden',
      payroll_detail: 'hidden',
      payroll_export: 'hidden',
      public_qr: 'hidden',
    },
  },
  {
    key: 'createdAt',
    label: 'Created At',
    group: 'system_metadata',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'hidden',
      payroll_detail: 'hidden',
      payroll_export: 'hidden',
      public_qr: 'hidden',
    },
  },
  {
    key: 'updatedAt',
    label: 'Updated At',
    group: 'system_metadata',
    access: {
      admin_internal: 'full',
      employee_self: 'full',
      payroll_list: 'hidden',
      payroll_detail: 'hidden',
      payroll_export: 'hidden',
      public_qr: 'hidden',
    },
  },
] as const

export const PUBLIC_QR_VISIBILITY_FIELDS = [
  { key: 'nom', label: 'Last Name' },
  { key: 'prenom', label: 'First Name' },
  { key: 'poste', label: 'Job Title' },
  { key: 'email', label: 'Email' },
  { key: 'telephone', label: 'Phone' },
  { key: 'photo_url', label: 'Photo' },
  { key: 'departement', label: 'Department' },
  { key: 'matricule', label: 'Employee ID' },
] as const

export type PublicQrVisibilityFieldKey =
  (typeof PUBLIC_QR_VISIBILITY_FIELDS)[number]['key']

export const PUBLIC_QR_VISIBLE_FIELD_KEYS = PUBLIC_QR_VISIBILITY_FIELDS.map(
  (field) => field.key,
) as PublicQrVisibilityFieldKey[]

export const PUBLIC_QR_VISIBLE_FIELD_LABELS = Object.fromEntries(
  PUBLIC_QR_VISIBILITY_FIELDS.map((field) => [field.key, field.label]),
) as Record<PublicQrVisibilityFieldKey, string>

export const EMPLOYEE_SELF_VISIBLE_FIELD_KEYS = EMPLOYEE_FIELD_GOVERNANCE_RULES.filter(
  (rule) => rule.access.employee_self !== 'hidden',
).map((rule) => rule.key) as GovernedEmployeeFieldKey[]

export const PAYROLL_APPROVED_DETAIL_FIELD_KEYS = EMPLOYEE_FIELD_GOVERNANCE_RULES.filter(
  (rule) => rule.access.payroll_detail !== 'hidden',
).map((rule) => rule.key) as GovernedEmployeeFieldKey[]

export const PAYROLL_APPROVED_EXPORT_FIELD_KEYS = EMPLOYEE_FIELD_GOVERNANCE_RULES.filter(
  (rule) => rule.access.payroll_export !== 'hidden',
).map((rule) => rule.key) as GovernedEmployeeFieldKey[]

export function getEmployeeFieldGovernanceRule(
  key: GovernedEmployeeFieldKey,
): EmployeeFieldGovernanceRule {
  const rule = EMPLOYEE_FIELD_GOVERNANCE_RULES.find((item) => item.key === key)

  if (!rule) {
    throw new Error(`Unknown employee governance field: ${key}`)
  }

  return rule
}

export function isEmployeeFieldVisibleInSurface(
  key: GovernedEmployeeFieldKey,
  surface: EmployeeDataSurface,
): boolean {
  return getEmployeeFieldGovernanceRule(key).access[surface] !== 'hidden'
}
