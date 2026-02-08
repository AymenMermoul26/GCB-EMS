import { useMutation, useQuery, useQueryClient, type UseMutationOptions } from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import type {
  DemandeStatut,
  ListRequestsForAdminParams,
  ModificationRequest,
  RequestsListResponse,
  SubmitModificationRequestPayload,
} from '@/types/modification-request'

const REQUEST_SELECT =
  'id, employe_id, demandeur_user_id, champ_cible, ancienne_valeur, nouvelle_valeur, motif, statut_demande, traite_par_user_id, traite_at, commentaire_traitement, created_at, updated_at'

interface ModificationRequestRow {
  id: string
  employe_id: string
  demandeur_user_id: string | null
  champ_cible: string
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

export async function listRequestsForAdmin(
  filters: ListRequestsForAdminParams = {},
): Promise<RequestsListResponse> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('DemandeModification')
    .select(REQUEST_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })

  if (filters.statut) {
    query = query.eq('statut_demande', filters.statut)
  }

  if (filters.employeId) {
    query = query.eq('employe_id', filters.employeId)
  }

  const { data, count, error } = await query.range(from, to).returns<ModificationRequestRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return {
    items: (data ?? []).map(mapRequest),
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
      await queryClient.invalidateQueries({ queryKey: ['requests'] })
      await options?.onSuccess?.(data, variables, onMutateResult, context)
    },
    ...options,
  })
}

export function useAdminRequestsQuery(filters: ListRequestsForAdminParams = {}) {
  return useQuery({
    queryKey: ['requests', 'admin', filters],
    queryFn: () => listRequestsForAdmin(filters),
  })
}

export function useApproveRequestMutation(
  options?: UseMutationOptions<
    ModificationRequest,
    Error,
    { id: string; comment?: string }
  >,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, comment }) => approveRequest(id, comment),
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['requests'] })
      await options?.onSuccess?.(data, variables, onMutateResult, context)
    },
    ...options,
  })
}

export function useRejectRequestMutation(
  options?: UseMutationOptions<
    ModificationRequest,
    Error,
    { id: string; comment?: string }
  >,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, comment }) => rejectRequest(id, comment),
    onSuccess: async (data, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['requests'] })
      await options?.onSuccess?.(data, variables, onMutateResult, context)
    },
    ...options,
  })
}

export const requestsService = {
  submitModificationRequest,
  listRequestsForAdmin,
  approveRequest,
  rejectRequest,
}
