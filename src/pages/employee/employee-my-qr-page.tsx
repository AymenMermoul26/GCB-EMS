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
import { useI18n } from '@/hooks/use-i18n'
import { useRole } from '@/hooks/use-role'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { cn } from '@/lib/utils'
import {
  createPublicProfileVisibilityRequestSchema,
  type PublicProfileVisibilityRequestValues,
} from '@/schemas/publicProfileVisibilityRequestSchema'
import {
  useCreatePublicProfileVisibilityRequestMutation,
  useEmployeeVisibilityQuery,
  useMyPublicProfileVisibilityRequestsQuery,
} from '@/services/visibilityService'
import {
  PUBLIC_QR_VISIBILITY_FIELDS,
  areVisibilityFieldKeyArraysEqual,
  getEmployeeVisibilityFieldLabel,
  getPublicProfileVisibilityRequestStatusMeta,
  sortVisibilityFieldKeys,
  type EmployeePublicProfileVisibilityRequestItem,
  type EmployeeVisibilityFieldKey,
} from '@/types/visibility'

function formatDateTime(
  value: string | null | undefined,
  locale: string,
  emptyValue: string,
): string {
  if (!value) {
    return emptyValue
  }

  return new Date(value).toLocaleString(locale)
}

function formatFieldList(
  fieldKeys: EmployeeVisibilityFieldKey[],
  t: ReturnType<typeof useI18n>['t'],
): string {
  if (fieldKeys.length === 0) {
    return t('employee.qr.noPublicFields')
  }

  return fieldKeys.map((fieldKey) => getEmployeeVisibilityFieldLabel(fieldKey, t)).join(', ')
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
  t,
}: {
  publishedFieldKeys: EmployeeVisibilityFieldKey[]
  isPending: boolean
  isError: boolean
  errorMessage?: string
  onRetry: () => void
  t: ReturnType<typeof useI18n>['t']
}) {
  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" />
          {t('employee.qr.currentPublishedTitle')}
        </CardTitle>
        <CardDescription>
          {t('employee.qr.currentPublishedDescription')}
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
            title={t('employee.qr.publishedVisibilityUnavailableTitle')}
            description={t('employee.qr.publishedVisibilityUnavailableDescription')}
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
                  <p className="text-sm text-slate-800">
                    {getEmployeeVisibilityFieldLabel(field.key, t)}
                  </p>
                  <StatusBadge tone={isPublished ? 'success' : 'neutral'} emphasis="outline">
                    {isPublished ? t('status.common.published') : t('status.common.hidden')}
                  </StatusBadge>
                </div>
              )
            })}
            <p className="text-xs text-muted-foreground">
              {t('employee.qr.liveChangesAfterApproval')}
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
  t,
  locale,
}: {
  requests: EmployeePublicProfileVisibilityRequestItem[]
  isPending: boolean
  isError: boolean
  errorMessage?: string
  onRetry: () => void
  t: ReturnType<typeof useI18n>['t']
  locale: string
}) {
  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardHeader>
        <CardTitle className="text-base">{t('employee.qr.historyTitle')}</CardTitle>
        <CardDescription>
          {t('employee.qr.historyDescription')}
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
            title={t('employee.qr.historyLoadErrorTitle')}
            description={t('employee.qr.historyLoadErrorDescription')}
            message={errorMessage}
            onRetry={onRetry}
          />
        ) : null}

        {!isPending && !isError ? (
          requests.length === 0 ? (
            <EmptyState
              surface="plain"
              title={t('employee.qr.historyEmptyTitle')}
              description={t('employee.qr.historyEmptyDescription')}
            />
          ) : (
            <div className="space-y-3">
              {requests.map((request) => {
                const statusMeta = getPublicProfileVisibilityRequestStatusMeta(request.status, t)

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
                        {t('employee.requests.submitted')} {formatDateTime(request.createdAt, locale, t('common.notReviewed'))}
                      </p>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          {t('employee.qr.publishedWhenRequested')}
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          {formatFieldList(request.currentFieldKeys, t)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          {t('employee.qr.requestedVisibility')}
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          {formatFieldList(request.requestedFieldKeys, t)}
                        </p>
                      </div>
                    </div>

                    {request.requestNote ? (
                      <p className="mt-3 text-sm text-slate-700">
                        <span className="font-medium">{t('employee.qr.employeeNote')}:</span> {request.requestNote}
                      </p>
                    ) : null}

                    {request.reviewNote ? (
                      <p className="mt-2 text-sm text-slate-700">
                        <span className="font-medium">{t('employee.qr.hrReviewNote')}:</span> {request.reviewNote}
                      </p>
                    ) : null}

                    <p className="mt-2 text-xs text-slate-500">
                      {t('employee.qr.reviewed')} {formatDateTime(request.reviewedAt, locale, t('common.notReviewed'))}
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
  const { t, locale, isRTL } = useI18n()
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

  const requestSchema = useMemo(() => createPublicProfileVisibilityRequestSchema(t), [t])

  const requestForm = useForm<PublicProfileVisibilityRequestValues>({
    resolver: zodResolver(requestSchema),
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
      toast.success(t('employee.qr.submitSuccess'))
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
      toast.error(t('employee.qr.selectionDifferentError'))
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

  const selectedFieldSummary = formatFieldList(sortVisibilityFieldKeys(selectedFieldKeys), t)

  return (
    <DashboardLayout
      title={t('employee.qr.title')}
      subtitle={t('employee.qr.subtitle')}
    >
      <PageHeader
        title={t('employee.qr.headerTitle')}
        description={t('employee.qr.headerDescription')}
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
            t={t}
          />

          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle className="text-base">
                {openRequest ? t('employee.qr.pendingTitle') : t('employee.qr.requestChangesTitle')}
              </CardTitle>
              <CardDescription>
                {openRequest
                  ? t('employee.qr.pendingDescription')
                  : t('employee.qr.requestDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-slate-200 bg-slate-50">
                <Info className="h-4 w-4" />
                <AlertTitle>{t('employee.qr.publicSafeTitle')}</AlertTitle>
                <AlertDescription>
                  {t('employee.qr.publicSafeDescription')}
                </AlertDescription>
              </Alert>

              {requestsQuery.isError ? (
                <ErrorState
                  surface="plain"
                  title={t('employee.qr.workflowUnavailableTitle')}
                  description={t('employee.qr.workflowUnavailableDescription')}
                  message={requestsQuery.error.message}
                  onRetry={() => void requestsQuery.refetch()}
                />
              ) : null}

              {!requestsQuery.isError && openRequest ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      tone={getPublicProfileVisibilityRequestStatusMeta(openRequest.status, t).tone}
                      emphasis="solid"
                    >
                      {getPublicProfileVisibilityRequestStatusMeta(openRequest.status, t).label}
                    </StatusBadge>
                    <p className="text-xs text-slate-500">
                      {t('employee.requests.submitted')} {formatDateTime(openRequest.createdAt, locale, t('common.notReviewed'))}
                    </p>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {t('employee.qr.requestedFields')}
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      {formatFieldList(openRequest.requestedFieldKeys, t)}
                    </p>
                  </div>

                  {openRequest.requestNote ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {t('employee.qr.yourNote')}
                      </p>
                      <p className="mt-2 text-sm text-slate-700">{openRequest.requestNote}</p>
                    </div>
                  ) : null}

                  <Alert className="border-amber-300 bg-amber-50 text-amber-900">
                    <Clock3 className="h-4 w-4" />
                    <AlertTitle>{t('employee.qr.reviewInProgressTitle')}</AlertTitle>
                    <AlertDescription>
                      {t('employee.qr.reviewInProgressDescription')}
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
                                      {getEmployeeVisibilityFieldLabel(visibilityField.key, t)}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {publishedFieldKeys.includes(visibilityField.key)
                                        ? t('employee.qr.currentlyPublished')
                                        : t('employee.qr.currentlyHidden')}
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
                          {t('employee.qr.noteForHr')}
                        </Label>
                        <Textarea
                          id="public-visibility-request-note"
                          rows={4}
                          placeholder={t('employee.qr.notePlaceholder')}
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
                        <p className="font-medium text-slate-900">{t('employee.qr.reviewBeforeSubmission')}</p>
                        <p className="mt-2">{selectedFieldSummary}</p>
                        {!hasSelectionChanges ? (
                          <p className="mt-2 text-xs text-slate-500">
                            {t('employee.qr.selectionMustDiffer')}
                          </p>
                        ) : null}
                      </div>

                      <Button
                        type="button"
                        className="w-full bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white hover:brightness-95"
                        disabled={!hasSelectionChanges || createRequestMutation.isPending}
                        onClick={() => void handleOpenConfirm()}
                      >
                        {t('actions.submitForApproval')}
                      </Button>
                    </>
                  )}
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardHeader>
              <CardTitle className="text-base">{t('employee.qr.usageNotes')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <Alert className="border-amber-300 bg-amber-50 text-amber-900">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t('employee.qr.noActiveTokenTitle')}</AlertTitle>
                <AlertDescription>
                  {t('employee.qr.noActiveTokenDescription')}
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
          t={t}
          locale={locale}
        />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('employee.qr.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('employee.qr.confirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t('employee.qr.currentPublishedFields')}
              </p>
              <p className="mt-2 text-sm text-slate-700">
                {formatFieldList(publishedFieldKeys, t)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {t('employee.qr.requestedPublishedFields')}
              </p>
              <p className="mt-2 text-sm text-slate-700">{selectedFieldSummary}</p>
            </div>

            {requestForm.getValues('requestNote')?.trim() ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {t('employee.qr.noteForHr')}
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  {requestForm.getValues('requestNote')?.trim()}
                </p>
              </div>
            ) : null}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={createRequestMutation.isPending}>
              {t('actions.cancel')}
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
                <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
              ) : null}
              {createRequestMutation.isPending
                ? t('employee.qr.submitting')
                : t('employee.qr.confirmRequest')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
