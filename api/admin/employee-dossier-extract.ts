import { handleEmployeeDossierExtractRequest } from '../_lib/employee-dossier-import.js'

export const maxDuration = 60

export async function POST(request: Request) {
  return handleEmployeeDossierExtractRequest(request)
}


