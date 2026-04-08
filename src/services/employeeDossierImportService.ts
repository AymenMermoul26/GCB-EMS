import {
  useMutation,
  type UseMutationOptions,
} from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import {
  EMPLOYEE_DOSSIER_MAX_FILE_SIZE_BYTES,
  EMPLOYEE_DOSSIER_MIME_TYPES,
  formatEmployeeDossierFileSize,
  type EmployeeDossierExtractionResponse,
} from '@/types/employee-dossier-import'

interface FunctionErrorBody {
  error?: string
  message?: string
}

function normalizeRecipientErrorMessage(status: number, body: FunctionErrorBody | null): string {
  const rawMessage = (body?.error ?? body?.message ?? '').trim()
  const normalizedMessage = rawMessage.toLowerCase()

  if (normalizedMessage.includes('invalid session token')) {
    return 'Session token is invalid. Please sign out and sign in again.'
  }

  if (status === 400) {
    return rawMessage || 'A dossier file is required before extraction can start.'
  }

  if (status === 401) {
    return 'Unauthorized. Please sign out and sign in again.'
  }

  if (status === 403) {
    return 'You do not have permission to import employee data from a dossier.'
  }

  if (status === 413) {
    return rawMessage || `Uploaded file is too large. Maximum size is ${formatEmployeeDossierFileSize(EMPLOYEE_DOSSIER_MAX_FILE_SIZE_BYTES)}.`
  }

  if (status === 415) {
    return rawMessage || 'Unsupported file type. Upload a PDF, JPG, JPEG, or PNG dossier.'
  }

  if (status === 504) {
    return rawMessage || 'Document extraction timed out. Try a smaller or clearer dossier.'
  }

  if (status === 404) {
    return 'Document extraction endpoint is unreachable. Ensure the Vercel OCR function is deployed.'
  }

  if (rawMessage.length > 0) {
    return rawMessage
  }

  return `Document extraction failed with status ${status}.`
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

export function validateEmployeeDossierFile(file: File | null | undefined): string | null {
  if (!file) {
    return 'Select a dossier file first.'
  }

  if (
    !EMPLOYEE_DOSSIER_MIME_TYPES.includes(
      file.type as (typeof EMPLOYEE_DOSSIER_MIME_TYPES)[number],
    )
  ) {
    return 'Unsupported file type. Upload a PDF, JPG, JPEG, or PNG dossier.'
  }

  if (file.size > EMPLOYEE_DOSSIER_MAX_FILE_SIZE_BYTES) {
    return `Uploaded file is too large. Maximum size is ${formatEmployeeDossierFileSize(EMPLOYEE_DOSSIER_MAX_FILE_SIZE_BYTES)}.`
  }

  return null
}

async function callEmployeeDossierExtractFunction(
  file: File,
  accessToken: string,
): Promise<
  | { ok: true; data: EmployeeDossierExtractionResponse }
  | { ok: false; error: Error }
> {
  try {
    const formData = new FormData()
    formData.set('file', file)

    const response = await fetch('/api/admin/employee-dossier-extract', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    })

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
          normalizeRecipientErrorMessage(
            response.status,
            parsedBody as FunctionErrorBody | null,
          ),
        ),
      }
    }

    const data = parsedBody as EmployeeDossierExtractionResponse | null
    if (!data?.provider || !data?.draft || !data?.fields) {
      return {
        ok: false,
        error: new Error('Document extraction returned an invalid response.'),
      }
    }

    return {
      ok: true,
      data,
    }
  } catch {
    return {
      ok: false,
      error: new Error(
        'Document extraction endpoint is unreachable. Ensure the Vercel OCR function is deployed.',
      ),
    }
  }
}

export async function importEmployeeFromDossier(
  file: File,
): Promise<EmployeeDossierExtractionResponse> {
  const validationError = validateEmployeeDossierFile(file)
  if (validationError) {
    throw new Error(validationError)
  }

  const accessToken = await getFreshAccessTokenOrThrow()
  const firstAttempt = await callEmployeeDossierExtractFunction(file, accessToken)

  if (firstAttempt.ok) {
    return firstAttempt.data
  }

  const normalizedMessage = firstAttempt.error.message.toLowerCase()
  const shouldRetryAfterRefresh =
    normalizedMessage.includes('invalid session token') ||
    normalizedMessage.includes('session expired')

  if (!shouldRetryAfterRefresh) {
    throw firstAttempt.error
  }

  const { data: refreshedSessionData, error: refreshError } = await supabase.auth.refreshSession()
  if (refreshError || !refreshedSessionData.session?.access_token) {
    throw new Error('Session token is invalid. Please sign out and sign in again.')
  }

  const secondAttempt = await callEmployeeDossierExtractFunction(
    file,
    refreshedSessionData.session.access_token,
  )

  if (secondAttempt.ok) {
    return secondAttempt.data
  }

  throw secondAttempt.error
}

export function useEmployeeDossierImportMutation(
  options?: UseMutationOptions<EmployeeDossierExtractionResponse, Error, File>,
) {
  return useMutation({
    mutationFn: importEmployeeFromDossier,
    ...options,
  })
}

export const employeeDossierImportService = {
  importEmployeeFromDossier,
  validateEmployeeDossierFile,
}

