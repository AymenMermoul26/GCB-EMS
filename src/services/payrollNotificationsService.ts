import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query'

import { getPayrollEmployeeRoute } from '@/constants/routes'
import {
  countUnreadMyNotifications,
  listMyNotifications,
  markAllMyNotificationsRead,
  markNotificationRead,
  notificationsService,
  type CreateNotificationPayload,
} from '@/services/notificationsService'
import { roleService } from '@/services/role.service'
import type { Employee } from '@/types/employee'
import type { NotificationItem } from '@/types/notification'
import type {
  PayrollChangeFieldKey,
  PayrollNotificationCategory,
  PayrollNotificationItem,
  PayrollNotificationsListOptions,
} from '@/types/payroll'

const PAYROLL_NOTIFICATION_SCOPE = 'payroll_change_signal'

const EMPLOYMENT_CHANGE_FIELDS = new Set<PayrollChangeFieldKey>([
  'categorieProfessionnelle',
  'typeContrat',
  'dateRecrutement',
])

const FAMILY_ADMIN_CHANGE_FIELDS = new Set<PayrollChangeFieldKey>([
  'situationFamiliale',
  'nombreEnfants',
  'adresse',
  'numeroSecuriteSociale',
])

export const PAYROLL_CHANGE_FIELD_LABELS: Record<PayrollChangeFieldKey, string> = {
  categorieProfessionnelle: 'Professional category',
  typeContrat: 'Contract type',
  dateRecrutement: 'Hire date',
  situationFamiliale: 'Marital status',
  nombreEnfants: 'Number of children',
  adresse: 'Address',
  numeroSecuriteSociale: 'Social security number',
  isActive: 'Status',
}

export const PAYROLL_NOTIFICATION_CATEGORY_META = {
  employment: {
    label: 'Employment',
    tone: 'brand',
  },
  family_admin: {
    label: 'Family/Admin',
    tone: 'warning',
  },
  status_change: {
    label: 'Status Change',
    tone: 'info',
  },
  new_employee: {
    label: 'New Employee',
    tone: 'success',
  },
} as const

type PayrollSignalEmployeeSnapshot = Pick<
  Employee,
  | 'id'
  | 'matricule'
  | 'nom'
  | 'prenom'
  | 'categorieProfessionnelle'
  | 'typeContrat'
  | 'dateRecrutement'
  | 'situationFamiliale'
  | 'nombreEnfants'
  | 'adresse'
  | 'numeroSecuriteSociale'
  | 'isActive'
>

interface PayrollSignalParams {
  employeeId: string | null
  employeeName: string | null
  matricule: string | null
  category: PayrollNotificationCategory
  title: string
  summary: string
  changedFields: PayrollChangeFieldKey[]
  source: string
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeStringValue(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : null
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => normalizeText(item))
    .filter((item): item is string => Boolean(item))
}

function isPayrollNotificationCategory(value: unknown): value is PayrollNotificationCategory {
  return (
    value === 'employment' ||
    value === 'family_admin' ||
    value === 'status_change' ||
    value === 'new_employee'
  )
}

function isPayrollChangeFieldKey(value: unknown): value is PayrollChangeFieldKey {
  return (
    value === 'categorieProfessionnelle' ||
    value === 'typeContrat' ||
    value === 'dateRecrutement' ||
    value === 'situationFamiliale' ||
    value === 'nombreEnfants' ||
    value === 'adresse' ||
    value === 'numeroSecuriteSociale' ||
    value === 'isActive'
  )
}

function buildEmployeeName(employee: Pick<Employee, 'nom' | 'prenom'>): string | null {
  const fullName = `${employee.prenom} ${employee.nom}`.replace(/\s+/g, ' ').trim()
  return fullName.length > 0 ? fullName : null
}

function formatEmployeeReference(employeeName: string | null, matricule: string | null): string {
  if (employeeName && matricule) {
    return `${employeeName} (${matricule})`
  }

  if (employeeName) {
    return employeeName
  }

  if (matricule) {
    return matricule
  }

  return 'this employee'
}

function formatChangedFieldLabel(field: PayrollChangeFieldKey): string {
  return PAYROLL_CHANGE_FIELD_LABELS[field]
}

function uniqueChangedFields(fields: PayrollChangeFieldKey[]): PayrollChangeFieldKey[] {
  return [...new Set(fields)]
}

function compareNullableString(
  previousValue: string | null | undefined,
  nextValue: string | null | undefined,
): boolean {
  return normalizeStringValue(previousValue) !== normalizeStringValue(nextValue)
}

function deriveUpdateCategory(
  changedFields: PayrollChangeFieldKey[],
): PayrollNotificationCategory {
  if (changedFields.some((field) => EMPLOYMENT_CHANGE_FIELDS.has(field))) {
    return 'employment'
  }

  if (changedFields.some((field) => FAMILY_ADMIN_CHANGE_FIELDS.has(field))) {
    return 'family_admin'
  }

  return 'employment'
}

function mapNotificationToPayrollNotification(
  notification: NotificationItem,
): PayrollNotificationItem {
  const metadataJson = notification.metadataJson ?? {}
  const rawCategory = metadataJson.category
  const category = isPayrollNotificationCategory(rawCategory) ? rawCategory : 'employment'
  const changedFields = readStringArray(metadataJson.changed_fields).filter(
    (field): field is PayrollChangeFieldKey => isPayrollChangeFieldKey(field),
  )
  const summary = normalizeText(metadataJson.summary) ?? notification.body

  return {
    id: notification.id,
    userId: notification.userId,
    title: notification.title,
    body: notification.body,
    link: notification.link,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
    category,
    employeeId: normalizeText(metadataJson.employee_id),
    employeeName: normalizeText(metadataJson.employee_name),
    matricule: normalizeText(metadataJson.matricule),
    changedFields,
    summary,
  }
}

async function createPayrollSignal({
  employeeId,
  employeeName,
  matricule,
  category,
  title,
  summary,
  changedFields,
  source,
}: PayrollSignalParams): Promise<number> {
  const payrollUserIds = await roleService.listPayrollUserIds()

  if (payrollUserIds.length === 0) {
    return 0
  }

  const payloads: CreateNotificationPayload[] = payrollUserIds.map((userId) => ({
    userId,
    title,
    body: summary,
    link: employeeId ? getPayrollEmployeeRoute(employeeId) : null,
    metadataJson: {
      scope: PAYROLL_NOTIFICATION_SCOPE,
      category,
      employee_id: employeeId,
      employee_name: employeeName,
      matricule,
      changed_fields: changedFields,
      summary,
      source,
    },
  }))

  await notificationsService.createNotifications(payloads)

  return payloads.length
}

export function getPayrollRelevantChangedFields(
  previousEmployee: PayrollSignalEmployeeSnapshot,
  nextEmployee: PayrollSignalEmployeeSnapshot,
): PayrollChangeFieldKey[] {
  const changedFields: PayrollChangeFieldKey[] = []

  if (
    compareNullableString(
      previousEmployee.categorieProfessionnelle,
      nextEmployee.categorieProfessionnelle,
    )
  ) {
    changedFields.push('categorieProfessionnelle')
  }

  if (compareNullableString(previousEmployee.typeContrat, nextEmployee.typeContrat)) {
    changedFields.push('typeContrat')
  }

  if (compareNullableString(previousEmployee.dateRecrutement, nextEmployee.dateRecrutement)) {
    changedFields.push('dateRecrutement')
  }

  if (
    compareNullableString(
      previousEmployee.situationFamiliale,
      nextEmployee.situationFamiliale,
    )
  ) {
    changedFields.push('situationFamiliale')
  }

  if (previousEmployee.nombreEnfants !== nextEmployee.nombreEnfants) {
    changedFields.push('nombreEnfants')
  }

  if (compareNullableString(previousEmployee.adresse, nextEmployee.adresse)) {
    changedFields.push('adresse')
  }

  if (
    compareNullableString(
      previousEmployee.numeroSecuriteSociale,
      nextEmployee.numeroSecuriteSociale,
    )
  ) {
    changedFields.push('numeroSecuriteSociale')
  }

  return uniqueChangedFields(changedFields)
}

export async function notifyPayrollUsersOfEmployeeUpdate(
  previousEmployee: PayrollSignalEmployeeSnapshot,
  nextEmployee: PayrollSignalEmployeeSnapshot,
): Promise<number> {
  const changedFields = getPayrollRelevantChangedFields(previousEmployee, nextEmployee)

  if (changedFields.length === 0) {
    return 0
  }

  const employeeName = buildEmployeeName(nextEmployee)
  const employeeReference = formatEmployeeReference(employeeName, nextEmployee.matricule)
  const category = deriveUpdateCategory(changedFields)
  const summary =
    changedFields.length === 1
      ? `${formatChangedFieldLabel(changedFields[0])} was updated for ${employeeReference}.`
      : `Payroll-relevant employee information was updated for ${employeeReference}.`

  return createPayrollSignal({
    employeeId: nextEmployee.id,
    employeeName,
    matricule: nextEmployee.matricule,
    category,
    title:
      category === 'family_admin'
        ? 'Administrative information updated'
        : 'Employment information updated',
    summary,
    changedFields,
    source: 'admin_employee_update',
  })
}

export async function notifyPayrollUsersOfEmployeeStatusChange(
  previousEmployee: PayrollSignalEmployeeSnapshot,
  nextEmployee: PayrollSignalEmployeeSnapshot,
): Promise<number> {
  if (previousEmployee.isActive === nextEmployee.isActive) {
    return 0
  }

  const employeeName = buildEmployeeName(nextEmployee)
  const employeeReference = formatEmployeeReference(employeeName, nextEmployee.matricule)
  const summary = nextEmployee.isActive
    ? `${employeeReference} was reactivated and is available for payroll follow-up.`
    : `${employeeReference} was marked inactive for payroll follow-up.`

  return createPayrollSignal({
    employeeId: nextEmployee.id,
    employeeName,
    matricule: nextEmployee.matricule,
    category: 'status_change',
    title: nextEmployee.isActive ? 'Employee reactivated' : 'Employee status changed',
    summary,
    changedFields: ['isActive'],
    source: 'employee_status_change',
  })
}

export async function notifyPayrollUsersOfNewEmployee(
  employee: Pick<Employee, 'id' | 'matricule' | 'nom' | 'prenom'>,
): Promise<number> {
  const employeeName = buildEmployeeName(employee)
  const employeeReference = formatEmployeeReference(employeeName, employee.matricule)

  return createPayrollSignal({
    employeeId: employee.id,
    employeeName,
    matricule: employee.matricule,
    category: 'new_employee',
    title: 'New employee available',
    summary: `A new employee record is now available for payroll consultation: ${employeeReference}.`,
    changedFields: [],
    source: 'employee_created',
  })
}

export async function listMyPayrollNotifications(
  userId?: string | null,
  options: PayrollNotificationsListOptions = {},
): Promise<PayrollNotificationItem[]> {
  const notifications = await listMyNotifications(userId, {
    ...options,
    scope: PAYROLL_NOTIFICATION_SCOPE,
  })

  return notifications.map(mapNotificationToPayrollNotification)
}

export async function countUnreadMyPayrollNotifications(
  userId?: string | null,
): Promise<number> {
  return countUnreadMyNotifications(userId, { scope: PAYROLL_NOTIFICATION_SCOPE })
}

export function formatPayrollChangedFieldsPreview(
  changedFields: PayrollChangeFieldKey[],
  maxItems = 3,
): string | null {
  if (changedFields.length === 0) {
    return null
  }

  const labels = changedFields.map(formatChangedFieldLabel)
  if (labels.length <= maxItems) {
    return labels.join(', ')
  }

  return `${labels.slice(0, maxItems).join(', ')} +${labels.length - maxItems} more`
}

export function getPayrollNotificationCategoryMeta(
  category: PayrollNotificationCategory,
) {
  return PAYROLL_NOTIFICATION_CATEGORY_META[category]
}

export function useMyPayrollNotificationsQuery(
  userId?: string | null,
  options: PayrollNotificationsListOptions = {},
) {
  const filter = options.filter ?? 'all'
  const limit = options.limit ?? null

  return useQuery({
    queryKey: ['payrollNotifications', userId ?? null, filter, limit],
    queryFn: () => listMyPayrollNotifications(userId, options),
    enabled: Boolean(userId),
    refetchInterval: 15000,
  })
}

export function useUnreadPayrollNotificationsCountQuery(userId?: string | null) {
  return useQuery({
    queryKey: ['payrollNotificationsUnreadCount', userId ?? null],
    queryFn: () => countUnreadMyPayrollNotifications(userId),
    enabled: Boolean(userId),
    refetchInterval: 15000,
  })
}

export function useMarkPayrollNotificationReadMutation(
  userId?: string | null,
  options?: UseMutationOptions<NotificationItem, Error, string>,
) {
  const queryClient = useQueryClient()
  const { onSuccess, ...restOptions } = options ?? {}

  return useMutation({
    mutationFn: markNotificationRead,
    ...restOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['notifications', userId ?? null] })
      await queryClient.invalidateQueries({ queryKey: ['notificationsUnreadCount', userId ?? null] })
      await queryClient.invalidateQueries({ queryKey: ['payrollNotifications', userId ?? null] })
      await queryClient.invalidateQueries({
        queryKey: ['payrollNotificationsUnreadCount', userId ?? null],
      })
      await onSuccess?.(data, variables, onMutateResult, context)
    },
  })
}

export function useMarkAllPayrollNotificationsReadMutation(
  userId?: string | null,
  options?: UseMutationOptions<number, Error, void>,
) {
  const queryClient = useQueryClient()
  const { onSuccess, ...restOptions } = options ?? {}

  return useMutation({
    mutationFn: () => markAllMyNotificationsRead({ scope: PAYROLL_NOTIFICATION_SCOPE }),
    ...restOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['notifications', userId ?? null] })
      await queryClient.invalidateQueries({ queryKey: ['notificationsUnreadCount', userId ?? null] })
      await queryClient.invalidateQueries({ queryKey: ['payrollNotifications', userId ?? null] })
      await queryClient.invalidateQueries({
        queryKey: ['payrollNotificationsUnreadCount', userId ?? null],
      })
      await onSuccess?.(data, variables, onMutateResult, context)
    },
  })
}

export const payrollNotificationsService = {
  listMyPayrollNotifications,
  countUnreadMyPayrollNotifications,
  notifyPayrollUsersOfEmployeeUpdate,
  notifyPayrollUsersOfEmployeeStatusChange,
  notifyPayrollUsersOfNewEmployee,
}
