import { FullScreenLoader } from '@/components/common/full-screen-loader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useEmployeeQuery } from '@/services/employeesService'
import { useRole } from '@/hooks/use-role'
import { DashboardLayout } from '@/layouts/dashboard-layout'

export function EmployeeProfilePage() {
  const { employeId } = useRole()
  const employeeQuery = useEmployeeQuery(employeId)

  return (
    <DashboardLayout
      title="My Profile"
      subtitle="Placeholder employee page wired to Supabase getEmployee()."
    >
      {employeeQuery.isPending ? <FullScreenLoader label="Loading your profile..." /> : null}

      {employeeQuery.error ? (
        <p className="text-sm text-destructive">{employeeQuery.error.message}</p>
      ) : null}

      {employeeQuery.data ? (
        <Card className="max-w-2xl">
          <CardHeader>
            {employeeQuery.data.photoUrl ? (
              <img
                src={employeeQuery.data.photoUrl}
                alt={`${employeeQuery.data.nom} ${employeeQuery.data.prenom}`}
                className="mb-4 h-24 w-24 rounded-full border object-cover"
              />
            ) : (
              <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full border bg-slate-100 text-xl font-semibold text-slate-500">
                {employeeQuery.data.prenom.charAt(0)}
                {employeeQuery.data.nom.charAt(0)}
              </div>
            )}
            <CardTitle>
              {employeeQuery.data.nom} {employeeQuery.data.prenom}
            </CardTitle>
            <CardDescription>Matricule: {employeeQuery.data.matricule}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="font-medium">Poste:</span>{' '}
              {employeeQuery.data.poste ?? 'Non renseigne'}
            </p>
            <p>
              <span className="font-medium">Email:</span>{' '}
              {employeeQuery.data.email ?? 'Non renseigne'}
            </p>
            <p>
              <span className="font-medium">Telephone:</span>{' '}
              {employeeQuery.data.telephone ?? 'Non renseigne'}
            </p>
            <Badge variant={employeeQuery.data.isActive ? 'secondary' : 'outline'}>
              {employeeQuery.data.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </CardContent>
        </Card>
      ) : null}
    </DashboardLayout>
  )
}
