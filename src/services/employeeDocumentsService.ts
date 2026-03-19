import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query'

import type { EmployeeInformationSheetDocumentEmployee } from '@/components/admin/employee-information-sheet-document'
import { env } from '@/config/env'
import { supabase } from '@/lib/supabaseClient'
import { auditService } from '@/services/auditService'
import { exportEmployeeInformationSheetPdf } from '@/utils/pdf/exportEmployeeInformationSheetPdf'

type EmployeeInformationSheetAuditAction =
  | 'EMPLOYEE_SHEET_PREVIEWED'
  | 'EMPLOYEE_SHEET_EXPORTED'

interface FunctionErrorBody {
  error?: string
  message?: string
  warning?: string
}

export interface EmployeeInformationSheetAuditTarget {
  id: string
  matricule: string
  nom: string
  prenom: string
}

export interface DownloadEmployeeInformationSheetPdfParams {
  employee: EmployeeInformationSheetDocumentEmployee
  departmentName?: string | null
}

export interface DownloadEmployeeInformationSheetPdfResult {
  fileName: string
  warning?: string
}

export interface SendEmployeeInformationSheetPayload {
  employeId: string
  recipientEmail: string
}

export interface SendEmployeeInformationSheetResponse {
  employe_id: string
  recipient_email: string
  status: 'SENT'
  audit_logged?: boolean
  warning?: string
}

type ExportChannel = 'print_pdf' | 'pdf_download'

function buildEmployeeName(target: EmployeeInformationSheetAuditTarget): string {
  return `${target.prenom} ${target.nom}`.replace(/\s+/g, ' ').trim()
}

async function getFreshAccessTokenOrThrow(): Promise<string> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

  if (sessionError) {
    throw new Error(sessionError.message)
  }

  if (!sessionData.session?.access_token) {
    throw new Error('Session expired. Please sign out and sign in again.')
  }

  const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession()

  if (!refreshError && refreshedData.session?.access_token) {
    return refreshedData.session.access_token
  }

  return sessionData.session.access_token
}

function mapSendDocumentErrorMessage(status: number, body: FunctionErrorBody | null): string {
  const rawMessage = (body?.error ?? body?.message ?? '').trim()
  const normalized = rawMessage.toLowerCase()

  if (normalized.includes('invalid jwt')) {
    return 'Session token is invalid. Please sign out and sign in again.'
  }

  if (status === 401) {
    return 'Unauthorized. Please sign out and sign in again.'
  }

  if (status === 403) {
    return 'You do not have permission to send this document.'
  }

  if (status === 404) {
    return 'Document email service is unreachable. Ensure edge function "send-employee-information-sheet" is deployed.'
  }

  if (rawMessage.length > 0) {
    return rawMessage
  }

  return `Document email service failed with status ${status}.`
}

async function callSendEmployeeInformationSheetFunction(
  payload: SendEmployeeInformationSheetPayload,
  accessToken: string,
): Promise<{ ok: true; data: SendEmployeeInformationSheetResponse } | { ok: false; error: Error }> {
  try {
    const response = await fetch(
      `${env.VITE_SUPABASE_URL}/functions/v1/send-employee-information-sheet`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          employe_id: payload.employeId,
          recipient_email: payload.recipientEmail.trim().toLowerCase(),
        }),
      },
    )

    let parsedBody: unknown = null
    try {
      parsedBody = await response.json()
    } catch {
      parsedBody = null
    }

    if (!response.ok) {
      return {
        ok: false,
        error: new Error(
          mapSendDocumentErrorMessage(response.status, parsedBody as FunctionErrorBody | null),
        ),
      }
    }

    const data = parsedBody as SendEmployeeInformationSheetResponse | null
    if (!data?.employe_id || !data.recipient_email) {
      return {
        ok: false,
        error: new Error('Document email function returned an invalid response.'),
      }
    }

    if (data.warning) {
      console.warn(`[send-employee-information-sheet] ${data.warning}`)
    }

    return { ok: true, data }
  } catch {
    return {
      ok: false,
      error: new Error(
        'Document email service is unreachable. Ensure edge function "send-employee-information-sheet" is deployed.',
      ),
    }
  }
}

async function logEmployeeInformationSheetAudit(
  action: EmployeeInformationSheetAuditAction,
  target: EmployeeInformationSheetAuditTarget,
  detailsJson: Record<string, unknown>,
): Promise<void> {
  await auditService.insertAuditLog({
    action,
    targetType: 'Employe',
    targetId: target.id,
    detailsJson: {
      document_type: 'EMPLOYEE_INFORMATION_SHEET',
      employee_id: target.id,
      employee_name: buildEmployeeName(target),
      matricule: target.matricule,
      ...detailsJson,
    },
  })
}

export async function logEmployeeInformationSheetPreview(
  target: EmployeeInformationSheetAuditTarget,
): Promise<void> {
  await logEmployeeInformationSheetAudit('EMPLOYEE_SHEET_PREVIEWED', target, {
    channel: 'preview',
    status: 'previewed',
  })
}

export async function logEmployeeInformationSheetExport(
  target: EmployeeInformationSheetAuditTarget,
  channel: ExportChannel,
  details?: {
    fileName?: string | null
    format?: string | null
  },
): Promise<void> {
  await logEmployeeInformationSheetAudit('EMPLOYEE_SHEET_EXPORTED', target, {
    channel,
    status: 'exported',
    format: details?.format ?? (channel === 'pdf_download' ? 'pdf' : 'print_pdf'),
    file_name: details?.fileName ?? null,
  })
}

export async function downloadEmployeeInformationSheetPdf({
  employee,
  departmentName,
}: DownloadEmployeeInformationSheetPdfParams): Promise<DownloadEmployeeInformationSheetPdfResult> {
  const fileName = await exportEmployeeInformationSheetPdf({
    employee,
    departmentName,
  })

  try {
    await logEmployeeInformationSheetExport(employee, 'pdf_download', {
      fileName,
      format: 'pdf',
    })
  } catch (error) {
    console.error('Failed to log employee sheet PDF export', error)
    return {
      fileName,
      warning: 'PDF was downloaded, but activity logging could not be completed.',
    }
  }

  return { fileName }
}

export async function sendEmployeeInformationSheet(
  payload: SendEmployeeInformationSheetPayload,
): Promise<SendEmployeeInformationSheetResponse> {
  const accessToken = await getFreshAccessTokenOrThrow()
  const firstAttempt = await callSendEmployeeInformationSheetFunction(payload, accessToken)

  if (firstAttempt.ok) {
    return firstAttempt.data
  }

  const normalized = firstAttempt.error.message.toLowerCase()
  const shouldRetryAfterRefresh =
    normalized.includes('invalid jwt') ||
    normalized.includes('session token is invalid') ||
    normalized.includes('session expired')

  if (!shouldRetryAfterRefresh) {
    throw firstAttempt.error
  }

  const { data: refreshedSessionData, error: refreshError } = await supabase.auth.refreshSession()
  if (refreshError || !refreshedSessionData.session?.access_token) {
    throw new Error('Session token is invalid. Please sign out and sign in again.')
  }

  const secondAttempt = await callSendEmployeeInformationSheetFunction(
    payload,
    refreshedSessionData.session.access_token,
  )

  if (secondAttempt.ok) {
    return secondAttempt.data
  }

  throw secondAttempt.error
}

export function useDownloadEmployeeInformationSheetPdfMutation(
  options?: UseMutationOptions<
    DownloadEmployeeInformationSheetPdfResult,
    Error,
    DownloadEmployeeInformationSheetPdfParams
  >,
) {
  const queryClient = useQueryClient()
  const { onSuccess, onSettled, ...restOptions } = options ?? {}

  return useMutation({
    mutationFn: downloadEmployeeInformationSheetPdf,
    ...restOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await onSuccess?.(data, variables, onMutateResult, context)
    },
    onSettled: async (data, error, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['auditLog'] })
      await queryClient.invalidateQueries({ queryKey: ['adminDashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['adminMonitoringDashboard'] })
      await onSettled?.(data, error, variables, onMutateResult, context)
    },
  })
}

export function useLogEmployeeInformationSheetExportMutation(
  options?: UseMutationOptions<
    void,
    Error,
    {
      target: EmployeeInformationSheetAuditTarget
      channel: ExportChannel
      details?: {
        fileName?: string | null
        format?: string | null
      }
    }
  >,
) {
  const queryClient = useQueryClient()
  const { onSuccess, onSettled, ...restOptions } = options ?? {}

  return useMutation({
    mutationFn: ({ target, channel, details }) =>
      logEmployeeInformationSheetExport(target, channel, details),
    ...restOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await onSuccess?.(data, variables, onMutateResult, context)
    },
    onSettled: async (data, error, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['auditLog'] })
      await queryClient.invalidateQueries({ queryKey: ['adminDashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['adminMonitoringDashboard'] })
      await onSettled?.(data, error, variables, onMutateResult, context)
    },
  })
}

export function useSendEmployeeInformationSheetMutation(
  options?: UseMutationOptions<
    SendEmployeeInformationSheetResponse,
    Error,
    SendEmployeeInformationSheetPayload
  >,
) {
  const queryClient = useQueryClient()
  const { onSuccess, onSettled, ...restOptions } = options ?? {}

  return useMutation({
    mutationFn: sendEmployeeInformationSheet,
    ...restOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await onSuccess?.(data, variables, onMutateResult, context)
    },
    onSettled: async (data, error, variables, onMutateResult, context) => {
      await queryClient.invalidateQueries({ queryKey: ['auditLog'] })
      await queryClient.invalidateQueries({ queryKey: ['adminDashboard'] })
      await queryClient.invalidateQueries({ queryKey: ['adminMonitoringDashboard'] })
      await onSettled?.(data, error, variables, onMutateResult, context)
    },
  })
}

export const employeeDocumentsService = {
  logEmployeeInformationSheetPreview,
  logEmployeeInformationSheetExport,
  downloadEmployeeInformationSheetPdf,
  sendEmployeeInformationSheet,
}
