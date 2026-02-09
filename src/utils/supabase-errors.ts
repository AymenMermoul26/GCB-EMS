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
