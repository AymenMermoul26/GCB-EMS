import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import type { Department } from '@/types/department'

interface DepartmentRow {
  id: string
  nom: string
  code: string | null
  description: string | null
  created_at: string
  updated_at: string
}

function mapDepartment(row: DepartmentRow): Department {
  return {
    id: row.id,
    nom: row.nom,
    code: row.code,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listDepartments(): Promise<Department[]> {
  const { data, error } = await supabase
    .from('Departement')
    .select('id, nom, code, description, created_at, updated_at')
    .order('nom', { ascending: true })
    .returns<DepartmentRow[]>()

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map(mapDepartment)
}

export function useDepartmentsQuery() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: listDepartments,
  })
}

export const departmentsService = {
  listDepartments,
}
