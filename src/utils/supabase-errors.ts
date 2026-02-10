export function mapEmployeeWriteError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Unexpected error. Please try again.'
  }

  const message = error.message.toLowerCase()
  const isUniqueViolation =
    message.includes('duplicate key value') || message.includes('unique constraint')

  if (isUniqueViolation && message.includes('matricule')) {
    return 'This matricule already exists. Please use a different matricule.'
  }

  return error.message
}

function hasPostgresCode(error: unknown, code: string): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const candidate = (error as Error & { code?: string }).code
  return candidate === code
}

export function mapDepartmentWriteError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Unexpected error. Please try again.'
  }

  const message = error.message.toLowerCase()
  const isUniqueViolation =
    hasPostgresCode(error, '23505') ||
    message.includes('duplicate key value') ||
    message.includes('unique constraint')

  if (isUniqueViolation) {
    if (message.includes('uq_departement_nom') || message.includes('nom')) {
      return 'A department with this name already exists.'
    }

    if (message.includes('uq_departement_code') || message.includes('code')) {
      return 'A department with this code already exists.'
    }

    return 'Department name or code already exists.'
  }

  return error.message
}

export function mapDepartmentDeleteError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Unexpected error. Please try again.'
  }

  const message = error.message.toLowerCase()
  const isForeignKeyViolation =
    hasPostgresCode(error, '23503') ||
    message.includes('foreign key') ||
    message.includes('violates foreign key constraint')

  if (isForeignKeyViolation) {
    return 'Cannot delete department because employees are assigned to it.'
  }

  return error.message
}
