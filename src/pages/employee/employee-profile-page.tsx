import { zodResolver } from '@hookform/resolvers/zod'
import { Bell, Loader2, PencilLine, PlusCircle, Save } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/use-auth'
import { useRole } from '@/hooks/use-role'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import {
  employeeSelfEditSchema,
  normalizeOptional,
  type EmployeeSelfEditValues,
} from '@/schemas/employeeSelfEditSchema'
import {
  modificationRequestSchema,
  type ModificationRequestValues,
} from '@/schemas/modification-request.schema'
import { auditService } from '@/services/auditService'
import { useDepartmentsQuery } from '@/services/departmentsService'
import { useEmployeeQuery, useUpdateEmployeeMutation } from '@/services/employeesService'
import {
  useMarkNotificationReadMutation,
  useMyNotificationsQuery,
  useUnreadNotificationsCountQuery,
} from '@/services/notificationsService'
import { useMyRequestsQuery, useSubmitModificationRequestMutation } from '@/services/requestsService'
import { MODIFICATION_REQUEST_FIELD_OPTIONS } from '@/types/modification-request'
import {
  REQUEST_FIELD_LABELS,
  getEmployeeFieldValue,
} from '@/utils/modification-requests'

function getStatusVariant(status: string): 'secondary' | 'outline' {
  if (status === 'ACCEPTEE') {
    return 'secondary'
  }

  return 'outline'
}

function getStatusClassName(status: string): string {
  return status === 'REJETEE' ? 'border-destructive text-destructive' : ''
}

function getInitials(prenom: string, nom: string) {
  return `${prenom.trim().charAt(0)}${nom.trim().charAt(0)}`.toUpperCase() || 'NA'
}

export function EmployeeProfilePage() {
  const { employeId } = useRole()
  const { user } = useAuth()
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false)

  const employeeQuery = useEmployeeQuery(employeId)
  const departmentsQuery = useDepartmentsQuery()
  const myRequestsQuery = useMyRequestsQuery(employeId, 1, 20)
  const notificationsQuery = useMyNotificationsQuery(user?.id)
  const unreadNotificationsCountQuery = useUnreadNotificationsCountQuery(user?.id)

  const departmentName = useMemo(() => {
    if (!employeeQuery.data || !departmentsQuery.data) {
      return null
    }

    return (
      departmentsQuery.data.find(
        (department) => department.id === employeeQuery.data?.departementId,
      )?.nom ?? null
    )
  }, [departmentsQuery.data, employeeQuery.data])

  const editForm = useForm<EmployeeSelfEditValues>({
    resolver: zodResolver(employeeSelfEditSchema),
    defaultValues: {
      poste: '',
      email: '',
      telephone: '',
      photoUrl: '',
    },
  })

  useEffect(() => {
    if (!employeeQuery.data) {
      return
    }

    editForm.reset({
      poste: employeeQuery.data.poste ?? '',
      email: employeeQuery.data.email ?? '',
      telephone: employeeQuery.data.telephone ?? '',
      photoUrl: employeeQuery.data.photoUrl ?? '',
    })
  }, [editForm, employeeQuery.data])

  const updateProfileMutation = useUpdateEmployeeMutation({
    onSuccess: async (updatedEmployee) => {
      toast.success('Profile updated successfully.')
      try {
        await auditService.insertAuditLog({
          action: 'EMPLOYEE_SELF_UPDATED',
          targetType: 'Employe',
          targetId: updatedEmployee.id,
          detailsJson: {
            fields: ['poste', 'email', 'telephone', 'photo_url'],
          },
        })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to write audit log')
      }
      await employeeQuery.refetch()
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const requestForm = useForm<ModificationRequestValues>({
    resolver: zodResolver(modificationRequestSchema),
    defaultValues: {
      champCible: 'poste',
      ancienneValeur: '',
      nouvelleValeur: '',
      motif: '',
    },
  })

  const selectedRequestField = useWatch({
    control: requestForm.control,
    name: 'champCible',
  })

  useEffect(() => {
    if (!employeeQuery.data || !selectedRequestField) {
      return
    }

    const currentValue = getEmployeeFieldValue(employeeQuery.data, selectedRequestField)
    requestForm.setValue('ancienneValeur', currentValue)
    requestForm.setValue('nouvelleValeur', '')
  }, [employeeQuery.data, requestForm, selectedRequestField])

  const submitRequestMutation = useSubmitModificationRequestMutation({
    onSuccess: async (createdRequest) => {
      toast.success('Request submitted.')
      requestForm.clearErrors()
      setIsRequestDialogOpen(false)
      requestForm.reset({
        champCible: 'poste',
        ancienneValeur: employeeQuery.data ? getEmployeeFieldValue(employeeQuery.data, 'poste') : '',
        nouvelleValeur: '',
        motif: '',
      })

      try {
        await auditService.insertAuditLog({
          action: 'REQUEST_SUBMITTED',
          targetType: 'DemandeModification',
          targetId: createdRequest.id,
          detailsJson: {
            champ_cible: createdRequest.champCible,
            ancienne_valeur: createdRequest.ancienneValeur,
            nouvelle_valeur: createdRequest.nouvelleValeur,
          },
        })
      } catch (error) {
        console.error('Failed to write request submission audit log', error)
      }

      await myRequestsQuery.refetch()
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const markNotificationReadMutation = useMarkNotificationReadMutation(user?.id, {
    onSuccess: async () => {
      await notificationsQuery.refetch()
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const onSubmitSelfEdit = editForm.handleSubmit(async (values) => {
    if (!employeId) {
      return
    }

    await updateProfileMutation.mutateAsync({
      id: employeId,
      payload: {
        poste: normalizeOptional(values.poste),
        email: normalizeOptional(values.email),
        telephone: normalizeOptional(values.telephone),
        photoUrl: normalizeOptional(values.photoUrl),
      },
    })
  })

  const onSubmitRequest = requestForm.handleSubmit(async (values) => {
    if (!employeId) {
      return
    }

    await submitRequestMutation.mutateAsync({
      employeId,
      champCible: values.champCible,
      ancienneValeur: (values.ancienneValeur ?? '').trim() || null,
      nouvelleValeur: values.nouvelleValeur.trim(),
      motif: values.motif?.trim() || null,
    })
  })

  if (employeeQuery.isPending) {
    return (
      <DashboardLayout title="My Profile" subtitle="Loading your profile...">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </DashboardLayout>
    )
  }

  if (employeeQuery.isError) {
    return (
      <DashboardLayout title="My Profile" subtitle="Could not load profile.">
        <Card>
          <CardContent className="space-y-3 p-6">
            <p className="text-sm text-destructive">{employeeQuery.error.message}</p>
            <Button variant="outline" onClick={() => void employeeQuery.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    )
  }

  if (!employeeQuery.data) {
    return (
      <DashboardLayout title="My Profile" subtitle="No employee profile linked.">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Unable to find your employee profile.
          </CardContent>
        </Card>
      </DashboardLayout>
    )
  }

  const employee = employeeQuery.data

  return (
    <DashboardLayout
      title="My Profile"
      subtitle="View your information and submit profile change requests."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              {employee.photoUrl ? (
                <img
                  src={employee.photoUrl}
                  alt={`${employee.prenom} ${employee.nom}`}
                  className="h-20 w-20 rounded-full border object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full border bg-slate-100 text-xl font-semibold text-slate-600">
                  {getInitials(employee.prenom, employee.nom)}
                </div>
              )}
              <div>
                <p className="text-lg font-semibold">
                  {employee.prenom} {employee.nom}
                </p>
                <p className="text-sm text-muted-foreground">Matricule: {employee.matricule}</p>
                <Badge variant={employee.isActive ? 'secondary' : 'outline'} className="mt-2">
                  {employee.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 text-sm">
              <InfoField label="Departement" value={departmentName ?? employee.departementId} />
              <InfoField label="Poste" value={employee.poste ?? 'Not set'} />
              <InfoField label="Email" value={employee.email ?? 'Not set'} />
              <InfoField label="Telephone" value={employee.telephone ?? 'Not set'} />
              <InfoField label="Nom" value={employee.nom} />
              <InfoField label="Prenom" value={employee.prenom} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Edit my profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={onSubmitSelfEdit}>
              <FormField label="Poste" error={editForm.formState.errors.poste?.message}>
                <Input {...editForm.register('poste')} disabled={updateProfileMutation.isPending} />
              </FormField>

              <FormField label="Email" error={editForm.formState.errors.email?.message}>
                <Input
                  type="email"
                  {...editForm.register('email')}
                  disabled={updateProfileMutation.isPending}
                />
              </FormField>

              <FormField
                label="Telephone"
                error={editForm.formState.errors.telephone?.message}
              >
                <Input
                  {...editForm.register('telephone')}
                  disabled={updateProfileMutation.isPending}
                />
              </FormField>

              <FormField label="Photo URL" error={editForm.formState.errors.photoUrl?.message}>
                <Input
                  {...editForm.register('photoUrl')}
                  disabled={updateProfileMutation.isPending}
                />
              </FormField>

              <Button type="submit" className="w-full" disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {updateProfileMutation.isPending ? 'Saving...' : 'Save profile'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Modification Requests</CardTitle>
          <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <PlusCircle className="mr-2 h-4 w-4" />
                Request a change
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Submit modification request</DialogTitle>
                <DialogDescription>
                  Send a request to Admin RH for fields requiring review.
                </DialogDescription>
              </DialogHeader>

              <form className="space-y-4" onSubmit={onSubmitRequest}>
                <FormField label="Field" error={requestForm.formState.errors.champCible?.message}>
                  <Controller
                    control={requestForm.control}
                    name="champCible"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          {MODIFICATION_REQUEST_FIELD_OPTIONS.map((option) => (
                            <SelectItem key={option.key} value={option.key}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>

                <FormField label="Current value">
                  <Input value={requestForm.getValues('ancienneValeur') ?? ''} disabled />
                </FormField>

                <FormField
                  label="New value"
                  error={requestForm.formState.errors.nouvelleValeur?.message}
                >
                  <Input {...requestForm.register('nouvelleValeur')} />
                </FormField>

                <FormField label="Reason (optional)">
                  <Textarea rows={3} {...requestForm.register('motif')} />
                </FormField>

                <DialogFooter>
                  <Button type="submit" disabled={submitRequestMutation.isPending}>
                    {submitRequestMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <PencilLine className="mr-2 h-4 w-4" />
                    )}
                    Submit request
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent>
          {myRequestsQuery.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}

          {myRequestsQuery.isError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {myRequestsQuery.error.message}
            </div>
          ) : null}

          {!myRequestsQuery.isPending && !myRequestsQuery.isError && myRequestsQuery.data ? (
            myRequestsQuery.data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requests submitted yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead>Old</TableHead>
                    <TableHead>New</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Admin comment</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myRequestsQuery.data.items.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>{REQUEST_FIELD_LABELS[request.champCible]}</TableCell>
                      <TableCell>{request.ancienneValeur ?? '-'}</TableCell>
                      <TableCell>{request.nouvelleValeur ?? '-'}</TableCell>
                      <TableCell>
                        <Badge
                          variant={getStatusVariant(request.statutDemande)}
                          className={getStatusClassName(request.statutDemande)}
                        >
                          {request.statutDemande}
                        </Badge>
                      </TableCell>
                      <TableCell>{request.commentaireTraitement ?? '-'}</TableCell>
                      <TableCell>{new Date(request.createdAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          ) : null}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Workflow Notifications
            {(unreadNotificationsCountQuery.data ?? 0) > 0 ? (
              <Badge className="border-transparent bg-red-600 text-white">
                {unreadNotificationsCountQuery.data}
              </Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {notificationsQuery.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}

          {notificationsQuery.isError ? (
            <p className="text-sm text-destructive">{notificationsQuery.error.message}</p>
          ) : null}

          {!notificationsQuery.isPending && !notificationsQuery.isError ? (
            notificationsQuery.data && notificationsQuery.data.length > 0 ? (
              <div className="space-y-2">
                {notificationsQuery.data.slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.body}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {!item.isRead ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={markNotificationReadMutation.isPending}
                          onClick={() => void markNotificationReadMutation.mutateAsync(item.id)}
                        >
                          Mark read
                        </Button>
                      ) : (
                        <Badge variant="secondary">Read</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No notifications yet.</p>
            )
          ) : null}
        </CardContent>
      </Card>
    </DashboardLayout>
  )
}

interface InfoFieldProps {
  label: string
  value: string
}

function InfoField({ label, value }: InfoFieldProps) {
  return (
    <p>
      <span className="font-medium">{label}:</span> {value}
    </p>
  )
}

interface FormFieldProps {
  label: string
  error?: string
  children: ReactNode
}

function FormField({ label, error, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

