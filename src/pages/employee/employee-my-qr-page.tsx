import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertCircle,
  Clock3,
  Info,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { MyQrCard } from '@/components/employee/MyQrCard'
import {
  EmptyState,
  ErrorState,
} from '@/components/common/page-state'
import { PageHeader, SURFACE_CARD_CLASS_NAME } from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useRole } from '@/hooks/use-role'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { cn } from '@/lib/utils'
import {
  publicProfileVisibilityRequestSchema,
  type PublicProfileVisibilityRequestValues,
} from '@/schemas/publicProfileVisibilityRequestSchema'
import {
  useCreatePublicProfileVisibilityRequestMutation,
  useEmployeeVisibilityQuery,
  useMyPublicProfileVisibilityRequestsQuery,
} from '@/services/visibilityService'
import {
  EMPLOYEE_VISIBILITY_FIELD_LABELS,
  PUBLIC_QR_VISIBILITY_FIELDS,
  areVisibilityFieldKeyArraysEqual,
  getPublicProfileVisibilityRequestStatusMeta,
  sortVisibilityFieldKeys,
  type EmployeePublicProfileVisibilityRequestItem,
  type EmployeeVisibilityFieldKey,
} from '@/types/visibility'

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return 'Not reviewed'
  }

  return new Date(value).toLocaleString()
}

function fieldLabel(fieldKey: EmployeeVisibilityFieldKey): string {
  return EMPLOYEE_VISIBILITY_FIELD_LABELS[fieldKey] ?? fieldKey
}

function formatFieldList(fieldKeys: EmployeeVisibilityFieldKey[]): string {
  if (fieldKeys.length === 0) {
    return 'No public fields selected'
  }

  return fieldKeys.map((fieldKey) => fieldLabel(fieldKey)).join(', ')
}

function findOpenRequest(
  items: EmployeePublicProfileVisibilityRequestItem[],
): EmployeePublicProfileVisibilityRequestItem | null {
  return (
    items.find(
      (item) => item.status === 'PENDING' || item.status === 'IN_REVIEW',
    ) ?? null
  )
}

function getVisibilityRequestSurfaceClass(
  status: EmployeePublicProfileVisibilityRequestItem['status'],
): string {
  if (status === 'APPROVED') {
    return 'border-emerald-200 bg-emerald-50/70'
  }

  if (status === 'REJECTED') {
    return 'border-rose-200 bg-rose-50/80'
  }

  return 'border-amber-200 bg-amber-50/90'
}

function PublishedVisibilityCard({
  publishedFieldKeys,
  isPending,
  isError,
  errorMessage,
  onRetry,
}: {
  publishedFieldKeys: EmployeeVisibilityFieldKey[]
  isPending: boolean
  isError: boolean
  errorMessage?: string
  onRetry: () => void
}) {
  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" />
          Current Published Fields
        </CardTitle>
        <CardDescription>
          These are the live public profile fields currently exposed through your QR link.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isPending ? (
          <>
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </>
        ) : null}

        {isError ? (
          <ErrorState
            surface="plain"
            title="Published visibility unavailable"
            description="We couldn't load your current public profile settings."
            message={errorMessage}
            onRetry={onRetry}
          />
        ) : null}

        {!isPending && !isError ? (
          <>
            {PUBLIC_QR_VISIBILITY_FIELDS.map((field) => {
              const isPublished = publishedFieldKeys.includes(field.key)

              return (
                <div
                  key={field.key}
                  className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5"
                >
                  <p className="text-sm text-slate-800">{field.label}</p>
                  <StatusBadge tone={isPublished ? 'success' : 'neutral'} emphasis="outline">
                    {isPublished ? 'Published' : 'Hidden'}
                  </StatusBadge>
                </div>
              )
            })}
            <p className="text-xs text-muted-foreground">
              Live public visibility changes only after HR approval.
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

function RequestHistoryCard({
  requests,
  isPending,
  isError,
  errorMessage,
  onRetry,
}: {
  requests: EmployeePublicProfileVisibilityRequestItem[]
  isPending: boolean
  isError: boolean
  errorMessage?: string
  onRetry: () => void
}) {
  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardHeader>
        <CardTitle className="text-base">Visibility Request History</CardTitle>
        <CardDescription>
          Track previously submitted public profile visibility requests and their outcomes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isPending ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : null}

        {isError ? (
          <ErrorState
            surface="plain"
            title="Could not load request history"
            description="We couldn't load your public profile visibility requests."
            message={errorMessage}
            onRetry={onRetry}
          />
        ) : null}

        {!isPending && !isError ? (
          requests.length === 0 ? (
            <EmptyState
              surface="plain"
              title="No visibility requests yet"
              description="Your future public profile visibility requests will appear here."
            />
          ) : (
            <div className="space-y-3">
              {requests.map((request) => {
                const statusMeta = getPublicProfileVisibilityRequestStatusMeta(request.status)

                return (
                  <div
                    key={request.id}
                    className={cn(
                      'rounded-2xl border p-4',
                      getVisibilityRequestSurfaceClass(request.status),
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={statusMeta.tone} emphasis="solid">
                        {statusMeta.label}
                      </StatusBadge>
                      <p className="text-xs text-slate-500">
                        Submitted {formatDateTime(request.createdAt)}
                      </p>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Published when requested
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          {formatFieldList(request.currentFieldKeys)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Requested visibility
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          {formatFieldList(request.requestedFieldKeys)}
                        </p>
                      </div>
                    </div>

                    {request.requestNote ? (
                      <p className="mt-3 text-sm text-slate-700">
                        <span className="font-medium">Employee note:</span> {request.requestNote}
                      </p>
                    ) : null}

                    {request.reviewNote ? (
                      <p className="mt-2 text-sm text-slate-700">
                        <span className="font-medium">HR review note:</span> {request.reviewNote}
                      </p>
                    ) : null}

                    <p className="mt-2 text-xs text-slate-500">
                      Reviewed {formatDateTime(request.reviewedAt)}
                    </p>
                  </div>
                )
              })}
            </div>
          )
        ) : null}
      </CardContent>
    </Card>
  )
}

export function EmployeeMyQrPage() {
  const { employeId } = useRole()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const visibilityQuery = useEmployeeVisibilityQuery(employeId)
  const requestsQuery = useMyPublicProfileVisibilityRequestsQuery(employeId)

  const publishedFieldKeys = useMemo(
    () =>
      sortVisibilityFieldKeys(
        (visibilityQuery.data ?? [])
          .filter((item) => item.isPublic)
          .map((item) => item.fieldKey),
      ),
    [visibilityQuery.data],
  )

  const requests = useMemo(() => requestsQuery.data ?? [], [requestsQuery.data])
  const openRequest = useMemo(() => findOpenRequest(requests), [requests])

  const requestForm = useForm<PublicProfileVisibilityRequestValues>({
    resolver: zodResolver(publicProfileVisibilityRequestSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      requestedFieldKeys: [],
      requestNote: '',
    },
  })

  const selectedFieldKeys = useWatch({
    control: requestForm.control,
    name: 'requestedFieldKeys',
  }) ?? []

  useEffect(() => {
    if (visibilityQuery.isPending || openRequest) {
      return
    }

    requestForm.reset({
      requestedFieldKeys: publishedFieldKeys,
      requestNote: '',
    })
  }, [openRequest, publishedFieldKeys, requestForm, visibilityQuery.isPending])

  const createRequestMutation = useCreatePublicProfileVisibilityRequestMutation(employeId, {
    onSuccess: async () => {
      toast.success('Public profile visibility request submitted.')
      setConfirmOpen(false)
      requestForm.reset({
        requestedFieldKeys: publishedFieldKeys,
        requestNote: '',
      })
      await requestsQuery.refetch()
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const hasSelectionChanges = !areVisibilityFieldKeyArraysEqual(
    selectedFieldKeys,
    publishedFieldKeys,
  )

  const handleOpenConfirm = async () => {
    const isValid = await requestForm.trigger()
    if (!isValid) {
      return
    }

    if (!hasSelectionChanges) {
      toast.error('Select a visibility configuration that differs from your current published profile.')
      return
    }

    setConfirmOpen(true)
  }

  const handleConfirmSubmit = async () => {
    const values = requestForm.getValues()
    await createRequestMutation.mutateAsync({
      requestedFieldKeys: sortVisibilityFieldKeys(values.requestedFieldKeys),
      requestNote: values.requestNote?.trim() || undefined,
    })
  }

  const selectedFieldSummary = formatFieldList(sortVisibilityFieldKeys(selectedFieldKeys))

  return (
    <DashboardLayout
      title="My QR Code"
      subtitle="Share your verified public profile securely and request visibility changes."
    >
      <PageHeader
        title="Public Profile QR"
        description="Preview your QR status, review current public visibility, and submit visibility changes for HR approval."
        className="mb-5"
      />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <MyQrCard
          employeId={employeId}
          className="mt-0 rounded-2xl border-slate-200/80 shadow-sm"
        />

        <div className="space-y-4">
          <PublishedVisibilityCard
            publishedFieldKeys={publishedFieldKeys}
            isPending={visibilityQuery.isPending}
            isError={visibilityQuery.isError}
            errorMessage={visibilityQuery.isError ? visibilityQuery.error.message : undefined}
            onRetry={() => void visibilityQuery.refetch()}
          />

          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle className="text-base">
                {openRequest ? 'Pending Visibility Request' : 'Request Visibility Changes'}
              </CardTitle>
              <CardDescription>
                {openRequest
                  ? 'Your live public profile remains unchanged until HR completes the review.'
                  : 'Select the public-safe fields you want HR to review for your public profile.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-slate-200 bg-slate-50">
                <Info className="h-4 w-4" />
                <AlertTitle>Public-safe sharing</AlertTitle>
                <AlertDescription>
                  Only approved public-safe fields can ever appear on your QR profile. Sensitive or private data cannot be requested here.
                </AlertDescription>
              </Alert>

              {requestsQuery.isError ? (
                <ErrorState
                  surface="plain"
                  title="Visibility workflow unavailable"
                  description="We couldn't load your public visibility request state."
                  message={requestsQuery.error.message}
                  onRetry={() => void requestsQuery.refetch()}
                />
              ) : null}

              {!requestsQuery.isError && openRequest ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      tone={getPublicProfileVisibilityRequestStatusMeta(openRequest.status).tone}
                      emphasis="solid"
                    >
                      {getPublicProfileVisibilityRequestStatusMeta(openRequest.status).label}
                    </StatusBadge>
                    <p className="text-xs text-slate-500">
                      Submitted {formatDateTime(openRequest.createdAt)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Requested public profile fields
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      {formatFieldList(openRequest.requestedFieldKeys)}
                    </p>
                  </div>

                  {openRequest.requestNote ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Your note
                      </p>
                      <p className="mt-2 text-sm text-slate-700">{openRequest.requestNote}</p>
                    </div>
                  ) : null}

                  <Alert className="border-amber-300 bg-amber-50 text-amber-900">
                    <Clock3 className="h-4 w-4" />
                    <AlertTitle>Review in progress</AlertTitle>
                    <AlertDescription>
                      Wait for HR to approve or reject this request before submitting another visibility change.
                    </AlertDescription>
                  </Alert>
                </>
              ) : null}

              {!requestsQuery.isError && !openRequest ? (
                <>
                  {visibilityQuery.isPending ? (
                    <>
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </>
                  ) : (
                    <>
                      <Controller
                        control={requestForm.control}
                        name="requestedFieldKeys"
                        render={({ field }) => (
                          <div className="space-y-3">
                            {PUBLIC_QR_VISIBILITY_FIELDS.map((visibilityField) => {
                              const checked = (field.value ?? []).includes(visibilityField.key)

                              return (
                                <div
                                  key={visibilityField.key}
                                  className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5"
                                >
                                  <div>
                                    <p className="text-sm font-medium text-slate-900">
                                      {visibilityField.label}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {publishedFieldKeys.includes(visibilityField.key)
                                        ? 'Currently published'
                                        : 'Currently hidden'}
                                    </p>
                                  </div>
                                  <Switch
                                    checked={checked}
                                    disabled={createRequestMutation.isPending}
                                    onCheckedChange={(nextChecked) => {
                                      const current = field.value ?? []
                                      const nextValue = nextChecked
                                        ? sortVisibilityFieldKeys([...current, visibilityField.key])
                                        : current.filter((item) => item !== visibilityField.key)

                                      field.onChange(nextValue)
                                    }}
                                  />
                                </div>
                              )
                            })}
                          </div>
                        )}
                      />

                      <div className="space-y-2">
                        <Label htmlFor="public-visibility-request-note">
                          Note for HR (optional)
                        </Label>
                        <Textarea
                          id="public-visibility-request-note"
                          rows={4}
                          placeholder="Add a short note if you need to explain the requested public profile change."
                          disabled={createRequestMutation.isPending}
                          {...requestForm.register('requestNote')}
                        />
                        {requestForm.formState.errors.requestNote?.message ? (
                          <p className="text-xs text-destructive">
                            {requestForm.formState.errors.requestNote.message}
                          </p>
                        ) : null}
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        <p className="font-medium text-slate-900">Review before submission</p>
                        <p className="mt-2">{selectedFieldSummary}</p>
                        {!hasSelectionChanges ? (
                          <p className="mt-2 text-xs text-slate-500">
                            Choose a configuration that differs from your current published profile to create a request.
                          </p>
                        ) : null}
                      </div>

                      <Button
                        type="button"
                        className="w-full bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white hover:brightness-95"
                        disabled={!hasSelectionChanges || createRequestMutation.isPending}
                        onClick={() => void handleOpenConfirm()}
                      >
                        Submit for Approval
                      </Button>
                    </>
                  )}
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle className="text-base">Usage Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <Alert className="border-amber-300 bg-amber-50 text-amber-900">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No active token?</AlertTitle>
                <AlertDescription>
                  If your QR token is missing, expired, or revoked, contact HR to regenerate it.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-4">
        <RequestHistoryCard
          requests={requests}
          isPending={requestsQuery.isPending}
          isError={requestsQuery.isError}
          errorMessage={requestsQuery.isError ? requestsQuery.error.message : undefined}
          onRetry={() => void requestsQuery.refetch()}
        />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit public visibility request?</AlertDialogTitle>
            <AlertDialogDescription>
              HR will review this request before any public profile visibility change is published.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Current published fields
              </p>
              <p className="mt-2 text-sm text-slate-700">
                {formatFieldList(publishedFieldKeys)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Requested published fields
              </p>
              <p className="mt-2 text-sm text-slate-700">{selectedFieldSummary}</p>
            </div>

            {requestForm.getValues('requestNote')?.trim() ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Note for HR
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  {requestForm.getValues('requestNote')?.trim()}
                </p>
              </div>
            ) : null}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={createRequestMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={createRequestMutation.isPending}
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmSubmit()
              }}
              className="border-0 bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white hover:opacity-95"
            >
              {createRequestMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {createRequestMutation.isPending ? 'Submitting...' : 'Confirm request'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
