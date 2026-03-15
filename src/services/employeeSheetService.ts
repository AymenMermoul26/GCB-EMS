import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query'
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/functions-js'

import { supabase } from '@/lib/supabaseClient'

export interface SendEmployeeInformationSheetPayload {
  employeId: string
  recipientEmail: string
  subject?: string
  customMessage?: string
  appBaseUrl?: string
}

export interface SendEmployeeInformationSheetResponse {
  ok: true
  employee_id: string
  recipient_email: string
  subject: string
  link: string
  audit_logged: boolean
  warning?: string
}

interface FunctionErrorBody {
  code?: string
  error?: string
  message?: string
  details?: string
}

function normalizeOptionalInput(value?: string): string | undefined {
  const normalized = value?.trim()
  return normalized && normalized.length > 0 ? normalized : undefined
}

function mapEmployeeSheetHttpError(status: number, body: FunctionErrorBody | null): string {
  const code = (body?.code ?? '').trim()
  const rawMessage = (body?.error ?? body?.message ?? '').trim()
  const normalized = rawMessage.toLowerCase()

  if (status === 404) {
    return 'Email service is not deployed. Deploy edge function "send-employee-information-sheet" first.'
  }

  if (normalized.includes('invalid jwt')) {
    return 'Session token is invalid. Please sign out and sign in again.'
  }

  if (status === 401) {
    return rawMessage || 'Unauthorized. Please sign out and sign in again.'
  }

  if (status === 403) {
    return rawMessage || 'Only administrators can send employee information sheets.'
  }

  if (code === 'EMAIL_CONFIG_MISSING') {
    return rawMessage || 'Email service is not configured.'
  }

  if (code === 'EMAIL_PROVIDER_FAILURE') {
    if (normalized.includes('domain') && normalized.includes('verify')) {
      return 'Email provider rejected the configured sender domain. Verify gcb.com in Resend or update RESEND_FROM_EMAIL to a verified sender address.'
    }

    return rawMessage || 'Email provider rejected the request.'
  }

  if (rawMessage.length > 0) {
    return rawMessage
  }

  return `Employee information sheet email failed with status ${status}.`
}

async function parseInvokeError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
    return new Error('Email service is unreachable. Check your network connection and function deployment.')
  }

  if (error instanceof FunctionsHttpError) {
    const response = error.context as Response
    let body: FunctionErrorBody | null = null

    try {
      body = (await response.clone().json()) as FunctionErrorBody
    } catch {
      body = null
    }

    return new Error(mapEmployeeSheetHttpError(response.status, body))
  }

  if (error instanceof Error) {
    return error
  }

  return new Error('Employee information sheet email failed.')
}

async function invokeSendEmployeeInformationSheet(
  payload: SendEmployeeInformationSheetPayload,
): Promise<SendEmployeeInformationSheetResponse> {
  const { data, error } = await supabase.functions.invoke<SendEmployeeInformationSheetResponse>(
    'send-employee-information-sheet',
    {
      body: {
        employe_id: payload.employeId,
        recipient_email: payload.recipientEmail.trim().toLowerCase(),
        subject: normalizeOptionalInput(payload.subject),
        custom_message: normalizeOptionalInput(payload.customMessage),
        app_base_url: normalizeOptionalInput(payload.appBaseUrl),
      },
    },
  )

  if (error) {
    throw await parseInvokeError(error)
  }

  if (!data?.ok) {
    throw new Error('Employee information sheet email failed.')
  }

  if (data.warning) {
    console.warn(`[send-employee-information-sheet] ${data.warning}`)
  }

  return data
}

export async function sendEmployeeInformationSheet(
  payload: SendEmployeeInformationSheetPayload,
): Promise<SendEmployeeInformationSheetResponse> {
  try {
    return await invokeSendEmployeeInformationSheet(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    const shouldRetryAfterRefresh =
      message.includes('invalid jwt') ||
      message.includes('session token is invalid') ||
      message.includes('session expired') ||
      message.includes('unauthorized')

    if (!shouldRetryAfterRefresh) {
      throw error instanceof Error ? error : new Error('Employee information sheet email failed.')
    }

    const { data: refreshedSessionData, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError || !refreshedSessionData.session?.access_token) {
      throw new Error('Session token is invalid. Please sign out and sign in again.')
    }

    return invokeSendEmployeeInformationSheet(payload)
  }
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
      await onSettled?.(data, error, variables, onMutateResult, context)
    },
  })
}

export const employeeSheetService = {
  sendEmployeeInformationSheet,
}
