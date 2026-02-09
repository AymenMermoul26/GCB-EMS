import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import type {
  DemandeStatut,
  ListMyRequestsParams,
  ListRequestsForAdminParams,
  ModificationRequest,
  ModificationRequestField,
  RequestDecisionPayload,
  RequestsListResponse,
  SubmitModificationRequestPayload,
} from '@/types/modification-request'

const REQUEST_SELECT =
  'id, employe_id, demandeur_user_id, champ_cible, ancienne_valeur, nouvelle_valeur, motif, statut_demande, traite_par_user_id, traite_at, commentaire_traitement, created_at, updated_at'

interface ModificationRequestRow {
  id: string
  employe_id: string
  demandeur_user_id: string | null
  champ_cible: ModificationRequestField
  ancienne_valeur: string | null
  nouvelle_valeur: string | null
  motif: string | null
  statut_demande: DemandeStatut
  traite_par_user_id: string | null
  traite_at: string | null
  commentaire_traitement: string | null
  created_at: string
  updated_at: string
}

interface EmployeeDirectoryRow {
  id: string
  nom: string
  prenom: string
  matricule: string
  departement_id: string
}

interface DepartmentDirectoryRow {
  id: string
  nom: string
}

function mapRequest(row: ModificationRequestRow): ModificationRequest {
  return {
    id: row.id,
    employeId: row.employe_id,
    demandeurUserId: row.demandeur_user_id,
    champCible: row.champ_cible,
    ancienneValeur: row.ancienne_valeur,
    nouvelleValeur: row.nouvelle_valeur,
    motif: row.motif,
    statutDemande: row.statut_demande,
    traiteParUserId: row.traite_par_user_id,
    traiteAt: row.traite_at,
    commentaireTraitement: row.commentaire_traitement,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    throw new Error(error.message)
  }

  return data.user?.id ?? null
}

async function resolveEmployeeIdsByDepartment(departementId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('Employe')
    .select('id')
    .eq('departement_id', departementId)
    .returns<Array<{ id: string }>>()

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((item) => item.id)
}

function paginate(page = 1, pageSize = 20) {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  return { page, pageSize, from, to }
}

async function enrichRequestsWithEmployeeInfo(
  requests: ModificationRequest[],
): Promise<ModificationRequest[]> {
  if (requests.length === 0) {
    return []
  }

  const uniqueEmployeeIds = [...new Set(requests.map((request) => request.employeId))]

  const { data: employeeRows, error: employeesError } = await supabase
    .from('Employe')
    .select('id, nom, prenom, matricule, departement_id')
    .in('id', uniqueEmployeeIds)
    .returns<EmployeeDirectoryRow[]>()

  if (employeesError) {
    throw new Error(employeesError.message)
  }

  const employeeMap = new Map((employeeRows ?? []).map((employee) => [employee.id, employee]))

  const uniqueDepartmentIds = [
    ...new Set((employeeRows ?? []).map((employee) => employee.departement_id)),
  ]

  const departmentMap = new Map<string, string>()

  if (uniqueDepartmentIds.length > 0) {
    const { data: departmentRows, error: departmentsError } = await supabase
      .from('Departement')
      .select('id, nom')
      .in('id', uniqueDepartmentIds)
      .returns<DepartmentDirectoryRow[]>()

    if (departmentsError) {
      throw new Error(departmentsError.message)
    }

    for (const department of departmentRows ?? []) {
      departmentMap.set(department.id, department.nom)
    }
  }

  return requests.map((request) => {
    const employee = employeeMap.get(request.employeId)
    if (!employee) {
      return request
    }

    return {
      ...request,
      employeNom: employee.nom,
      employePrenom: employee.prenom,
      employeMatricule: employee.matricule,
      employeDepartementId: employee.departement_id,
      employeDepartementNom: departmentMap.get(employee.departement_id) ?? null,
    }
  })
}

export async function submitModificationRequest(
  payload: SubmitModificationRequestPayload,
): Promise<ModificationRequest> {
  const userId = await currentUserId()
  const { data, error } = await supabase
    .from('DemandeModification')
    .insert({
      employe_id: payload.employeId,
      demandeur_user_id: userId,
      champ_cible: payload.champCible,
      ancienne_valeur: payload.ancienneValeur ?? null,
      nouvelle_valeur: payload.nouvelleValeur ?? null,
      motif: payload.motif ?? null,
      statut_demande: 'EN_ATTENTE',
    })
    .select(REQUEST_SELECT)
    .single<ModificationRequestRow>()

  if (error) {
    throw new Error(error.message)
  }

  return mapRequest(data)
}

export async function listMyRequests(
  params: ListMyRequestsParams,
): Promise<RequestsListResponse> {
  const { page, pageSize, from, to } = paginate(params.page, params.pageSize)

  const { data, count, error } = await supabase
    .from('DemandeModification')
    .select(REQUEST_SELECT, { count: 'exact' })
    .eq('employe_id', params.employeId)
    .order('created_at', { ascending: false })
    .range(from, to)
    .returns<ModificationRequestRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  const mapped = await enrichRequestsWithEmployeeInfo((data ?? []).map(mapRequest))

  return {
    items: mapped,
    total: count ?? 0,
    page,
    pageSize,
  }
}

export async function listRequestsForAdmin(
  filters: ListRequestsForAdminParams = {},
): Promise<RequestsListResponse> {
  const { page, pageSize, from, to } = paginate(filters.page, filters.pageSize)

  let scopedEmployeeIds: string[] | null = null

  if (filters.departementId) {
    scopedEmployeeIds = await resolveEmployeeIdsByDepartment(filters.departementId)
  }

  if (filters.employeId) {
    const manualScope = [filters.employeId]
    if (scopedEmployeeIds) {
      scopedEmployeeIds = scopedEmployeeIds.filter((id) => manualScope.includes(id))
    } else {
      scopedEmployeeIds = manualScope
    }
  }

  if (scopedEmployeeIds && scopedEmployeeIds.length === 0) {
    return {
      items: [],
      total: 0,
      page,
      pageSize,
    }
  }

  let query = supabase
    .from('DemandeModification')
    .select(REQUEST_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })

  if (filters.statut) {
    query = query.eq('statut_demande', filters.statut)
  }

  if (scopedEmployeeIds) {
    query = query.in('employe_id', scopedEmployeeIds)
  }

  const { data, count, error } = await query.range(from, to).returns<ModificationRequestRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  const mapped = await enrichRequestsWithEmployeeInfo((data ?? []).map(mapRequest))

  return {
    items: mapped,
    total: count ?? 0,
    page,
    pageSize,
  }
}

async function updateRequestDecision(
  id: string,
  statut: 'ACCEPTEE' | 'REJETEE',
  comment?: string,
): Promise<ModificationRequest> {
  const userId = await currentUserId()
  const { data, error } = await supabase
    .from('DemandeModification')
    .update({
      statut_demande: statut,
      commentaire_traitement: comment ?? null,
      traite_at: new Date().toISOString(),
      traite_par_user_id: userId,
    })
    .eq('id', id)
    .select(REQUEST_SELECT)
    .single<ModificationRequestRow>()

  if (error) {
    throw new Error(error.message)
  }

  return mapRequest(data)
}

export async function approveRequest(
  id: string,
  comment?: string,
): Promise<ModificationRequest> {
  return updateRequestDecision(id, 'ACCEPTEE', comment)
}

export async function rejectRequest(
  id: string,
  comment?: string,
): Promise<ModificationRequest> {
  return updateRequestDecision(id, 'REJETEE', comment)
}

export function useSubmitModificationRequestMutation(
  options?: UseMutationOptions<ModificationRequest, Error, SubmitModificationRequestPayload>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: submitModificationRequest,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['myRequests', variables.employeId] })
      await queryClient.invalidateQueries({ queryKey: ['adminRequests'] })
      await options?.onSuccess?.(data, variables, onMutateResult, context)
    },
    ...options,
  })
}

export function useMyRequestsQuery(employeId?: string | null, page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['myRequests', employeId ?? null, page, pageSize],
    queryFn: () => listMyRequests({ employeId: employeId as string, page, pageSize }),
    enabled: Boolean(employeId),
    placeholderData: keepPreviousData,
  })
}

export function useAdminRequestsQuery(filters: ListRequestsForAdminParams = {}) {
  return useQuery({
    queryKey: ['adminRequests', filters],
    queryFn: () => listRequestsForAdmin(filters),
    placeholderData: keepPreviousData,
  })
}

export function useApproveRequestMutation(
  options?: UseMutationOptions<ModificationRequest, Error, RequestDecisionPayload>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, comment }) => approveRequest(id, comment),
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['adminRequests'] })
      await queryClient.invalidateQueries({ queryKey: ['myRequests', data.employeId] })
      await options?.onSuccess?.(data, variables, onMutateResult, context)
    },
    ...options,
  })
}

export function useRejectRequestMutation(
  options?: UseMutationOptions<ModificationRequest, Error, RequestDecisionPayload>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, comment }) => rejectRequest(id, comment),
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['adminRequests'] })
      await queryClient.invalidateQueries({ queryKey: ['myRequests', data.employeId] })
      await options?.onSuccess?.(data, variables, onMutateResult, context)
    },
    ...options,
  })
}

export const requestsService = {
  submitModificationRequest,
  listMyRequests,
  listRequestsForAdmin,
  approveRequest,
  rejectRequest,
}

