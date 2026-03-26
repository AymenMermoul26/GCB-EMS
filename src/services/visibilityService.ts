import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import { getDepartmentDisplayName } from '@/types/department'
import type {
  AdminPublicProfileVisibilityRequestItem,
  CreatePublicProfileVisibilityRequestPayload,
  EmployeePublicProfileVisibilityRequestItem,
  EmployeeVisibility,
  EmployeeVisibilityFieldKey,
  ListAdminPublicProfileVisibilityRequestsParams,
  PublicProfileVisibilityRequestStatus,
  UpdatePublicProfileVisibilityRequestStatusPayload,
} from '@/types/visibility'
import {
  isEmployeeVisibilityFieldKey,
  sortVisibilityFieldKeys,
} from '@/types/visibility'

interface EmployeeVisibilityRow {
  id: string
  employe_id: string
  field_key: string
  is_public: boolean
  created_at: string
  updated_at: string
}

interface PublicProfileVisibilityRequestRow {
  id: string
  employe_id: string
  requested_by_user_id: string
  status: string
  current_field_keys: string[] | null
  requested_field_keys: string[] | null
  request_note: string | null
  review_note: string | null
  reviewed_by_user_id: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

interface AdminPublicProfileVisibilityRequestRow extends PublicProfileVisibilityRequestRow {
  employe_matricule: string
  employe_nom: string
  employe_prenom: string
  departement_id: string | null
  departement_nom: string | null
  live_field_keys: string[] | null
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : null
}

function normalizeFieldKeys(value: string[] | null | undefined): EmployeeVisibilityFieldKey[] {
  if (!Array.isArray(value)) {
    return []
  }

  return sortVisibilityFieldKeys(
    value.filter((fieldKey): fieldKey is EmployeeVisibilityFieldKey =>
      isEmployeeVisibilityFieldKey(fieldKey),
    ),
  )
}

function resolveRequestStatus(
  value: string | null | undefined,
): PublicProfileVisibilityRequestStatus {
  switch (value) {
    case 'IN_REVIEW':
    case 'APPROVED':
    case 'REJECTED':
      return value
    case 'PENDING':
    default:
      return 'PENDING'
  }
}

function mapVisibility(row: EmployeeVisibilityRow): EmployeeVisibility | null {
  if (!isEmployeeVisibilityFieldKey(row.field_key)) {
    console.warn('[visibilityService] Ignoring unsupported visibility field key', row.field_key)
    return null
  }

  return {
    id: row.id,
    employeId: row.employe_id,
    fieldKey: row.field_key as EmployeeVisibilityFieldKey,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapEmployeeVisibilityRequest(
  row: PublicProfileVisibilityRequestRow,
): EmployeePublicProfileVisibilityRequestItem {
  return {
    id: row.id,
    employeId: row.employe_id,
    requestedByUserId: row.requested_by_user_id,
    status: resolveRequestStatus(row.status),
    currentFieldKeys: normalizeFieldKeys(row.current_field_keys),
    requestedFieldKeys: normalizeFieldKeys(row.requested_field_keys),
    requestNote: normalizeOptionalText(row.request_note),
    reviewNote: normalizeOptionalText(row.review_note),
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapAdminVisibilityRequest(
  row: AdminPublicProfileVisibilityRequestRow,
): AdminPublicProfileVisibilityRequestItem {
  return {
    ...mapEmployeeVisibilityRequest(row),
    employeMatricule: row.employe_matricule,
    employeNom: row.employe_nom,
    employePrenom: row.employe_prenom,
    departementId: row.departement_id,
    departementNom: getDepartmentDisplayName(row.departement_nom),
    liveFieldKeys: normalizeFieldKeys(row.live_field_keys),
  }
}

async function getVisibility(employeId: string): Promise<EmployeeVisibility[]> {
  const { data, error } = await supabase
    .from('employee_visibility')
    .select('id, employe_id, field_key, is_public, created_at, updated_at')
    .eq('employe_id', employeId)
    .returns<EmployeeVisibilityRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? [])
    .map(mapVisibility)
    .filter((row): row is EmployeeVisibility => Boolean(row))
}

async function fetchVisibilityRequestById(
  id: string,
): Promise<EmployeePublicProfileVisibilityRequestItem> {
  const { data, error } = await supabase
    .from('PublicProfileVisibilityRequest')
    .select(
      'id, employe_id, requested_by_user_id, status, current_field_keys, requested_field_keys, request_note, review_note, reviewed_by_user_id, reviewed_at, created_at, updated_at',
    )
    .eq('id', id)
    .single<PublicProfileVisibilityRequestRow>()

  if (error) {
    throw new Error(error.message)
  }

  return mapEmployeeVisibilityRequest(data)
}

export async function getMyPublicProfileVisibilityRequests(): Promise<
  EmployeePublicProfileVisibilityRequestItem[]
> {
  const { data, error } = await supabase
    .rpc('get_my_public_profile_visibility_requests')
    .returns<PublicProfileVisibilityRequestRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  const rows = Array.isArray(data) ? data : []

  return rows.map(mapEmployeeVisibilityRequest)
}

export async function createPublicProfileVisibilityRequest(
  payload: CreatePublicProfileVisibilityRequestPayload,
): Promise<EmployeePublicProfileVisibilityRequestItem> {
  const { data, error } = await supabase.rpc('create_my_public_profile_visibility_request', {
    p_requested_field_keys: sortVisibilityFieldKeys(payload.requestedFieldKeys),
    p_request_note: normalizeOptionalText(payload.requestNote),
  })

  if (error) {
    throw new Error(error.message)
  }

  if (typeof data !== 'string' || data.trim().length === 0) {
    throw new Error('Unexpected response while creating the visibility request.')
  }

  return fetchVisibilityRequestById(data)
}

export async function getAdminPublicProfileVisibilityRequests(
  filters: ListAdminPublicProfileVisibilityRequestsParams = {},
): Promise<AdminPublicProfileVisibilityRequestItem[]> {
  const rpcStatus =
    filters.status && filters.status !== 'ALL' ? filters.status : null

  const { data, error } = await supabase.rpc('get_admin_public_profile_visibility_requests', {
    p_status: rpcStatus,
    p_search: normalizeOptionalText(filters.search),
    p_departement_id: filters.departementId ?? null,
    p_employe_id: filters.employeId ?? null,
  })

  if (error) {
    throw new Error(error.message)
  }

  const rows = Array.isArray(data) ? data : []

  return rows.map((row) =>
    mapAdminVisibilityRequest(row as AdminPublicProfileVisibilityRequestRow),
  )
}

export async function updatePublicProfileVisibilityRequestStatus(
  payload: UpdatePublicProfileVisibilityRequestStatusPayload,
): Promise<EmployeePublicProfileVisibilityRequestItem> {
  const { data, error } = await supabase.rpc('set_public_profile_visibility_request_status', {
    p_request_id: payload.requestId,
    p_status: payload.status,
    p_review_note: normalizeOptionalText(payload.reviewNote),
  })

  if (error) {
    throw new Error(error.message)
  }

  if (typeof data !== 'string' || data.trim().length === 0) {
    throw new Error('Unexpected response while updating the visibility request.')
  }

  return fetchVisibilityRequestById(data)
}

export async function countPendingPublicProfileVisibilityRequests(): Promise<number> {
  const { count, error } = await supabase
    .from('PublicProfileVisibilityRequest')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'PENDING')

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

export function useEmployeeVisibilityQuery(employeId?: string | null) {
  return useQuery({
    queryKey: ['employeeVisibility', employeId],
    queryFn: () => getVisibility(employeId as string),
    enabled: Boolean(employeId),
  })
}

export function useMyPublicProfileVisibilityRequestsQuery(employeId?: string | null) {
  return useQuery({
    queryKey: ['myPublicProfileVisibilityRequests', employeId ?? null],
    queryFn: getMyPublicProfileVisibilityRequests,
    enabled: Boolean(employeId),
  })
}

export function useCreatePublicProfileVisibilityRequestMutation(
  employeId?: string | null,
  options?: UseMutationOptions<
    EmployeePublicProfileVisibilityRequestItem,
    Error,
    CreatePublicProfileVisibilityRequestPayload
  >,
) {
  const queryClient = useQueryClient()
  const { onSuccess, ...restOptions } = options ?? {}

  return useMutation({
    mutationFn: createPublicProfileVisibilityRequest,
    ...restOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({
        queryKey: ['myPublicProfileVisibilityRequests', employeId ?? null],
      })
      await queryClient.invalidateQueries({
        queryKey: ['adminPublicProfileVisibilityRequests'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['pendingPublicProfileVisibilityRequestsCount'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['notifications'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['notificationsUnreadCount'],
      })
      await onSuccess?.(data, variables, onMutateResult, context)
    },
  })
}

export function useAdminPublicProfileVisibilityRequestsQuery(
  filters: ListAdminPublicProfileVisibilityRequestsParams = {},
) {
  return useQuery({
    queryKey: ['adminPublicProfileVisibilityRequests', filters],
    queryFn: () => getAdminPublicProfileVisibilityRequests(filters),
    placeholderData: keepPreviousData,
  })
}

export function useUpdatePublicProfileVisibilityRequestStatusMutation(
  options?: UseMutationOptions<
    EmployeePublicProfileVisibilityRequestItem,
    Error,
    UpdatePublicProfileVisibilityRequestStatusPayload
  >,
) {
  const queryClient = useQueryClient()
  const { onSuccess, ...restOptions } = options ?? {}

  return useMutation({
    mutationFn: updatePublicProfileVisibilityRequestStatus,
    ...restOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({
        queryKey: ['adminPublicProfileVisibilityRequests'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['myPublicProfileVisibilityRequests'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['pendingPublicProfileVisibilityRequestsCount'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['employeeVisibility', data.employeId],
      })
      await onSuccess?.(data, variables, onMutateResult, context)
    },
  })
}

export function usePendingPublicProfileVisibilityRequestsCountQuery(enabled = true) {
  return useQuery({
    queryKey: ['pendingPublicProfileVisibilityRequestsCount'],
    queryFn: countPendingPublicProfileVisibilityRequests,
    enabled,
  })
}

export const visibilityService = {
  getVisibility,
  getMyPublicProfileVisibilityRequests,
  createPublicProfileVisibilityRequest,
  getAdminPublicProfileVisibilityRequests,
  updatePublicProfileVisibilityRequestStatus,
  countPendingPublicProfileVisibilityRequests,
}
