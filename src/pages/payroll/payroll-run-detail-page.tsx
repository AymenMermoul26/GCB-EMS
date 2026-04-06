import {
  Activity,
  ArrowRight,
  Calculator,
  ChevronLeft,
  Clock3,
  ExternalLink,
  FileDown,
  Loader2,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import {
  EmptyState,
  ErrorState,
  PageStateSkeleton,
  SectionSkeleton,
} from '@/components/common/page-state'
import { PageHeader, SURFACE_CARD_CLASS_NAME } from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PayslipWorkflowTimeline } from '@/components/payroll/payslip-workflow-timeline'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ROUTES } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { useI18n } from '@/hooks/use-i18n'
import { PayrollLayout } from '@/layouts/payroll-layout'
import { cn } from '@/lib/utils'
import {
  createPayrollRunEmployeePayslipAccessDescriptor,
  downloadPayslipDocument,
  openPayslipDocument,
} from '@/services/payslipRequestsService'
import {
  useCalculatePayrollRunMutation,
  usePayrollRunActivityQuery,
  usePayrollRunEmployeeEntriesQuery,
  usePayrollRunQuery,
  useUpdatePayrollRunStatusMutation,
} from '@/services/payrollProcessingService'
import type {
  PayrollProcessingActivityItem,
  PayrollProcessingStatus,
  PayrollRunDetail,
  PayrollRunEmployeeEntry,
} from '@/types/payroll'
import {
  buildPublishedPayslipTimelineSource,
  getPayslipDocumentRepresentationModeLabel,
  getPayslipDocumentGenerationStatusLabel,
  getPayrollCalculationStatusMeta,
  getPayrollProcessingStatusMeta,
  getPayrollRunTypeLabel,
} from '@/types/payroll'

function formatTimestamp(value: string | null | undefined, locale: string): string {
  if (!value) {
    return '\u2014'
  }

  return new Date(value).toLocaleString(locale)
}

function formatDateRange(start: string, end: string, locale: string): string {
  return `${new Date(`${start}T00:00:00`).toLocaleDateString(locale)} - ${new Date(`${end}T00:00:00`).toLocaleDateString(locale)}`
}

function formatAmount(value: number | null | undefined, locale: string): string {
  if (value === null || value === undefined) {
    return '\u2014'
  }

  return value.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatFileSize(value: number | null | undefined): string {
  if (value === null || value === undefined || value <= 0) {
    return '\u2014'
  }

  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(2)} MB`
  }

  if (value >= 1024) {
    return `${(value / 1024).toFixed(1)} KB`
  }

  return `${value} B`
}

function buildNextRunAction(
  status: PayrollProcessingStatus,
  t: (key: string) => string,
): { label: string; nextStatus: PayrollProcessingStatus } | null {
  switch (status) {
    case 'DRAFT':
      return { label: t('payroll.processing.runActions.calculate'), nextStatus: 'CALCULATED' }
    case 'CALCULATED':
      return { label: t('payroll.processing.runActions.review'), nextStatus: 'UNDER_REVIEW' }
    case 'UNDER_REVIEW':
      return { label: t('payroll.processing.runActions.finalize'), nextStatus: 'FINALIZED' }
    case 'FINALIZED':
      return { label: t('payroll.processing.runActions.publish'), nextStatus: 'PUBLISHED' }
    case 'PUBLISHED':
      return { label: t('payroll.processing.runActions.archive'), nextStatus: 'ARCHIVED' }
    default:
      return null
  }
}

function getPayslipGenerationTone(status: PayrollRunEmployeeEntry['payslipGenerationStatus']) {
  switch (status) {
    case 'FAILED':
      return 'danger'
    case 'GENERATED':
      return 'success'
    case 'PENDING':
    default:
      return 'info'
  }
}

function getRunEntryDocumentAvailabilityCopy(
  entry: PayrollRunEmployeeEntry,
  t: (key: string) => string,
): {
  tone: 'neutral' | 'warning' | 'danger' | 'info'
  message: string
} {
  if (entry.calculationStatus === 'EXCLUDED') {
    return {
      tone: 'warning',
      message: t('payroll.runDetail.entries.excludedMessage'),
    }
  }

  if (entry.calculationStatus === 'FAILED') {
    return {
      tone: 'danger',
      message: t('payroll.runDetail.entries.calculationFailedMessage'),
    }
  }

  if (!entry.payslipStatus) {
    return {
      tone: 'neutral',
      message: t('payroll.runDetail.entries.publishRunMessage'),
    }
  }

  if (entry.payslipGenerationStatus === 'FAILED') {
    return {
      tone: 'danger',
      message: t('payroll.runDetail.entries.generationFailedMessage'),
    }
  }

  if (entry.payslipGenerationStatus === 'PENDING' || !entry.payslipDocumentReady) {
    return {
      tone: 'info',
      message: t('payroll.runDetail.entries.generationPendingMessage'),
    }
  }

  return {
    tone: 'neutral',
    message: t('payroll.runDetail.entries.metadataUnavailableMessage'),
  }
}

function SummaryCard({
  title,
  value,
  helper,
}: {
  title: string
  value: string
  helper: string
}) {
  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium text-slate-600">{title}</p>
        <p className="text-lg font-semibold text-slate-950">{value}</p>
        <p className="text-sm leading-6 text-slate-600">{helper}</p>
      </CardContent>
    </Card>
  )
}

function RunMetadataCard({ run }: { run: PayrollRunDetail }) {
  const { t, locale } = useI18n()

  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
          <ShieldCheck className="h-4 w-4 text-slate-600" />
          {t('payroll.runDetail.metadataTitle')}
        </CardTitle>
        <CardDescription>
          {t('payroll.runDetail.metadataDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-slate-600">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{t('common.created')}</p>
            <p className="mt-1 font-medium text-slate-900">{formatTimestamp(run.createdAt, locale)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{t('payroll.runDetail.metadata.calculated')}</p>
            <p className="mt-1 font-medium text-slate-900">{formatTimestamp(run.calculatedAt, locale)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{t('common.reviewed')}</p>
            <p className="mt-1 font-medium text-slate-900">{formatTimestamp(run.reviewedAt, locale)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{t('payroll.runDetail.metadata.finalized')}</p>
            <p className="mt-1 font-medium text-slate-900">{formatTimestamp(run.finalizedAt, locale)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{t('common.published')}</p>
            <p className="mt-1 font-medium text-slate-900">{formatTimestamp(run.publishedAt, locale)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{t('payroll.runDetail.metadata.archived')}</p>
            <p className="mt-1 font-medium text-slate-900">{formatTimestamp(run.archivedAt, locale)}</p>
          </div>
        </div>

        {run.notes ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{t('payroll.runDetail.metadata.notes')}</p>
            <p className="mt-2 leading-6 text-slate-700">{run.notes}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function EmployeeEntriesCard({
  run,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  entries,
  activeDocumentActionKey,
  onOpenWorkflow,
  onOpenPayslipDocument,
  onDownloadPayslipDocument,
}: {
  run: PayrollRunDetail
  isLoading: boolean
  isError: boolean
  errorMessage?: string
  onRetry: () => void
  entries: PayrollRunEmployeeEntry[]
  activeDocumentActionKey: string | null
  onOpenWorkflow: (entry: PayrollRunEmployeeEntry) => void
  onOpenPayslipDocument: (entry: PayrollRunEmployeeEntry) => Promise<void>
  onDownloadPayslipDocument: (entry: PayrollRunEmployeeEntry) => Promise<void>
}) {
  const { t, locale, isRTL } = useI18n()

  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
          <Users className="h-4 w-4 text-slate-600" />
          {t('payroll.runDetail.entries.title')}
        </CardTitle>
        <CardDescription>
          {t('payroll.runDetail.entries.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <SectionSkeleton lines={6} />
        ) : isError ? (
          <ErrorState
            surface="plain"
            align="left"
            title={t('payroll.runDetail.entries.loadErrorTitle')}
            description={t('payroll.runDetail.entries.loadErrorDescription')}
            message={errorMessage}
            onRetry={onRetry}
          />
        ) : entries.length === 0 ? (
          <EmptyState
            surface="plain"
            align="left"
            title={t('payroll.runDetail.entries.emptyTitle')}
            description={t('payroll.runDetail.entries.emptyDescription')}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">{t('payroll.runDetail.entries.table.employee')}</TableHead>
                  <TableHead className="min-w-[180px]">{t('payroll.runDetail.entries.table.calculationStatus')}</TableHead>
                  <TableHead className="min-w-[140px]">{t('payroll.runDetail.entries.table.baseSalary')}</TableHead>
                  <TableHead className="min-w-[140px]">{t('payroll.runDetail.entries.table.allowances')}</TableHead>
                  <TableHead className="min-w-[140px]">{t('payroll.runDetail.entries.table.deductions')}</TableHead>
                  <TableHead className="min-w-[140px]">{t('payroll.runDetail.entries.table.gross')}</TableHead>
                  <TableHead className="min-w-[140px]">{t('payroll.runDetail.entries.table.net')}</TableHead>
                  <TableHead className="min-w-[280px]">{t('payroll.runDetail.entries.table.reviewNotes')}</TableHead>
                  <TableHead className="min-w-[160px]">{t('payroll.runDetail.entries.table.payslip')}</TableHead>
                  <TableHead className="min-w-[180px]">{t('payroll.runDetail.entries.table.documentActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const calculationMeta = getPayrollCalculationStatusMeta(entry.calculationStatus, t)
                  const payslipMeta = entry.payslipStatus
                    ? getPayrollProcessingStatusMeta(entry.payslipStatus, t)
                    : null
                  const representationModeLabel = entry.payslipDocumentRepresentationMode
                    ? getPayslipDocumentRepresentationModeLabel(
                        entry.payslipDocumentRepresentationMode,
                        t,
                      )
                    : null
                  const generationStatusLabel = entry.payslipGenerationStatus
                    ? getPayslipDocumentGenerationStatusLabel(entry.payslipGenerationStatus, t)
                    : null
                  const documentDescriptor = createPayrollRunEmployeePayslipAccessDescriptor(
                    run,
                    entry,
                  )
                  const documentAvailabilityCopy = getRunEntryDocumentAvailabilityCopy(entry, t)
                  const canInspectWorkflow =
                    entry.calculationStatus === 'CALCULATED' ||
                    entry.hasPayslip ||
                    Boolean(entry.payslipPublishedAt) ||
                    Boolean(entry.payslipGenerationStatus)
                  const isOpening = activeDocumentActionKey === `${entry.id}:open`
                  const isDownloading = activeDocumentActionKey === `${entry.id}:download`

                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-900">
                            {entry.prenom} {entry.nom}
                          </p>
                          <p className="text-xs text-slate-500">{entry.matricule}</p>
                          <p className="text-xs text-slate-500">
                            {entry.departementNom ?? '\u2014'} | {entry.poste ?? '\u2014'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <StatusBadge tone={calculationMeta.tone}>{calculationMeta.label}</StatusBadge>
                          <StatusBadge tone="neutral" emphasis="outline">
                            {getPayrollProcessingStatusMeta(entry.status, t).label}
                          </StatusBadge>
                          {entry.exclusionReason ? (
                            <p className="text-xs text-slate-500">{entry.exclusionReason}</p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {formatAmount(entry.baseSalaryAmount, locale)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {formatAmount(entry.totalAllowancesAmount, locale)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {formatAmount(entry.totalDeductionsAmount, locale)}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {formatAmount(entry.grossPayAmount, locale)}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-slate-900">
                        {formatAmount(entry.netPayAmount, locale)}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm text-slate-600">
                            {entry.calculationNotes ?? t('payroll.runDetail.entries.noCalculationNotes')}
                          </p>
                          {entry.issueFlags.length > 0 ? (
                            <p className="text-xs text-amber-700">
                              {t('payroll.runDetail.entries.flags', {
                                value: entry.issueFlags.join(', '),
                              })}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {payslipMeta ? (
                          <div className="space-y-1">
                            <StatusBadge tone={payslipMeta.tone}>{payslipMeta.label}</StatusBadge>
                            <p className="text-xs text-slate-500">
                              {formatTimestamp(entry.payslipPublishedAt, locale)}
                            </p>
                            {generationStatusLabel ? (
                              <StatusBadge
                                tone={getPayslipGenerationTone(entry.payslipGenerationStatus)}
                                emphasis="outline"
                              >
                                {generationStatusLabel}
                              </StatusBadge>
                            ) : null}
                            <p className="text-xs text-slate-500">
                              {entry.payslipDocumentReady
                                ? representationModeLabel ?? t('payroll.runDetail.entries.documentAttached')
                                : entry.payslipGenerationStatus === 'FAILED'
                                  ? t('payroll.runDetail.entries.generationFailedDescription')
                                  : t('payroll.runDetail.entries.generationPendingDescription')}
                            </p>
                            {entry.payslipGenerationError ? (
                              <p className="text-xs text-rose-600">{entry.payslipGenerationError}</p>
                            ) : null}
                            {canInspectWorkflow ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={() => onOpenWorkflow(entry)}
                              >
                                <Clock3 className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                                {t('actions.viewWorkflow')}
                              </Button>
                            ) : null}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <span className="text-sm text-slate-500">{t('payroll.runDetail.entries.notPublished')}</span>
                            {canInspectWorkflow ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => onOpenWorkflow(entry)}
                              >
                                <Clock3 className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                                {t('actions.viewWorkflow')}
                              </Button>
                            ) : null}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {documentDescriptor ? (
                          <div className="space-y-2">
                            <p className="text-xs text-slate-500">
                              {entry.payslipFileName ?? '\u2014'}
                            </p>
                            <p className="text-xs text-slate-500">
                              {entry.payslipContentType ?? 'application/pdf'} |{' '}
                              {formatFileSize(entry.payslipFileSizeBytes)}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={Boolean(activeDocumentActionKey)}
                                onClick={() => void onOpenPayslipDocument(entry)}
                              >
                                {isOpening ? (
                                  <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                                ) : (
                                  <ExternalLink className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                                )}
                                {t('actions.open')}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                disabled={Boolean(activeDocumentActionKey)}
                                onClick={() => void onDownloadPayslipDocument(entry)}
                              >
                                {isDownloading ? (
                                  <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                                ) : (
                                  <FileDown className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                                )}
                                {t('actions.download')}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <StatusBadge
                              tone={documentAvailabilityCopy.tone}
                              emphasis="outline"
                            >
                              {t('payroll.runDetail.entries.documentUnavailable')}
                            </StatusBadge>
                            <p className="text-xs leading-5 text-slate-500">
                              {documentAvailabilityCopy.message}
                            </p>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PayslipWorkflowDialog({
  run,
  entry,
  isOpen,
  onOpenChange,
  activeDocumentActionKey,
  onOpenPayslipDocument,
  onDownloadPayslipDocument,
}: {
  run: PayrollRunDetail
  entry: PayrollRunEmployeeEntry | null
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  activeDocumentActionKey: string | null
  onOpenPayslipDocument: (entry: PayrollRunEmployeeEntry) => Promise<void>
  onDownloadPayslipDocument: (entry: PayrollRunEmployeeEntry) => Promise<void>
}) {
  const { t, locale, isRTL } = useI18n()

  if (!entry) {
    return null
  }

  const descriptor = createPayrollRunEmployeePayslipAccessDescriptor(run, entry)
  const generationStatusLabel = entry.payslipGenerationStatus
    ? getPayslipDocumentGenerationStatusLabel(entry.payslipGenerationStatus, t)
    : null
  const representationModeLabel = entry.payslipDocumentRepresentationMode
    ? getPayslipDocumentRepresentationModeLabel(entry.payslipDocumentRepresentationMode, t)
    : null
  const isOpening = activeDocumentActionKey === `${entry.id}:open`
  const isDownloading = activeDocumentActionKey === `${entry.id}:download`

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {t('payroll.runDetail.workflowDialog.title', {
              employee: `${entry.prenom} ${entry.nom}`.trim(),
            })}
          </DialogTitle>
          <DialogDescription>
            {t('payroll.runDetail.workflowDialog.description', {
              period: run.periodLabel,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
            <p className="text-sm font-semibold text-slate-950">{t('common.workflowTimeline')}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {t('payroll.runDetail.workflowDialog.timelineDescription')}
            </p>
            <PayslipWorkflowTimeline
              className="mt-4"
              source={buildPublishedPayslipTimelineSource({
                status: entry.payslipStatus,
                publishedAt: entry.payslipPublishedAt,
                documentReady: entry.payslipDocumentReady,
                documentGeneratedAt: entry.payslipGeneratedAt,
              })}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-700">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('payroll.runDetail.workflowDialog.employeeResultTitle')}</p>
              <p>
                {entry.prenom} {entry.nom}
              </p>
              <p>{t('employee.profile.fields.employeeId')}: {entry.matricule}</p>
              <p>{t('common.department')}: {entry.departementNom ?? '\u2014'}</p>
              <p>{t('common.jobTitle')}: {entry.poste ?? '\u2014'}</p>
              <p>{t('payroll.runDetail.entries.table.net')}: {formatAmount(entry.netPayAmount, locale)}</p>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-700">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t('payroll.runDetail.workflowDialog.documentStateTitle')}</p>
              <p>{t('common.published')}: {formatTimestamp(entry.payslipPublishedAt, locale)}</p>
              <p>{t('common.generated')}: {formatTimestamp(entry.payslipGeneratedAt, locale)}</p>
              <p>{t('common.status')}: {generationStatusLabel ?? t('payroll.runDetail.workflowDialog.pendingStatus')}</p>
              <p>{t('common.representation')}: {representationModeLabel ?? t('payroll.runDetail.workflowDialog.noDocumentRepresentation')}</p>
              <p>{t('common.file')}: {entry.payslipFileName ?? '\u2014'}</p>
              <p>{t('common.size')}: {formatFileSize(entry.payslipFileSizeBytes)}</p>
              {entry.payslipGenerationError ? (
                <p className="text-rose-600">{entry.payslipGenerationError}</p>
              ) : null}
            </div>
          </div>

          {descriptor ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={Boolean(activeDocumentActionKey)}
                onClick={() => void onOpenPayslipDocument(entry)}
              >
                {isOpening ? (
                  <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                ) : (
                  <ExternalLink className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                )}
                {t('actions.open')}
              </Button>
              <Button
                type="button"
                disabled={Boolean(activeDocumentActionKey)}
                onClick={() => void onDownloadPayslipDocument(entry)}
              >
                {isDownloading ? (
                  <Loader2 className={cn('h-4 w-4 animate-spin', isRTL ? 'ml-2' : 'mr-2')} />
                ) : (
                  <FileDown className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                )}
                {t('actions.download')}
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ActivityCard({ items }: { items: PayrollProcessingActivityItem[] }) {
  const { t, locale } = useI18n()

  return (
    <Card className={SURFACE_CARD_CLASS_NAME}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
          <Activity className="h-4 w-4 text-slate-600" />
          {t('payroll.runDetail.activity.title')}
        </CardTitle>
        <CardDescription>
          {t('payroll.runDetail.activity.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            surface="plain"
            align="left"
            title={t('payroll.runDetail.activity.emptyTitle')}
            description={t('payroll.runDetail.activity.emptyDescription')}
          />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                <p className="text-sm font-semibold text-slate-950">{item.summary}</p>
                <p className="mt-2 text-xs text-slate-500">{formatTimestamp(item.createdAt, locale)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function PayrollRunDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { signOut, user } = useAuth()
  const { t, locale, isRTL } = useI18n()
  const runQuery = usePayrollRunQuery(id)
  const entriesQuery = usePayrollRunEmployeeEntriesQuery(id)
  const activityQuery = usePayrollRunActivityQuery(id, { limit: 50 })
  const [activeDocumentActionKey, setActiveDocumentActionKey] = useState<string | null>(null)
  const [selectedWorkflowEntry, setSelectedWorkflowEntry] = useState<PayrollRunEmployeeEntry | null>(
    null,
  )
  const updateRunStatusMutation = useUpdatePayrollRunStatusMutation(user?.id, {
    onSuccess: (_, variables) => {
      toast.success(t('payroll.runDetail.feedback.moveRunSuccess', {
        status: getPayrollProcessingStatusMeta(variables.status, t).label,
      }))
    },
  })
  const calculateRunMutation = useCalculatePayrollRunMutation(user?.id, {
    onSuccess: (result) => {
      toast.success(
        t('payroll.runDetail.feedback.calculationSuccess', {
          calculated: result.calculatedEmployeeCount,
          excluded: result.excludedEmployeeCount,
        }),
      )
    },
  })

  const run = runQuery.data
  const entries = entriesQuery.data ?? []
  const activity = useMemo(() => activityQuery.data ?? [], [activityQuery.data])
  const nextAction = run ? buildNextRunAction(run.status, t) : null

  const handleAdvanceRun = async () => {
    if (!run || !nextAction) {
      return
    }

    try {
      if (nextAction.nextStatus === 'CALCULATED') {
        await calculateRunMutation.mutateAsync(run.id)
        return
      }

      await updateRunStatusMutation.mutateAsync({
        runId: run.id,
        status: nextAction.nextStatus,
      })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : nextAction.nextStatus === 'CALCULATED'
            ? t('payroll.runDetail.feedback.calculateError')
            : t('payroll.runDetail.feedback.updateError'),
      )
    }
  }

  const handleRecalculateRun = async () => {
    if (!run) {
      return
    }

    try {
      await calculateRunMutation.mutateAsync(run.id)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('payroll.runDetail.feedback.recalculateError'))
    }
  }

  const handleOpenPayslipDocument = async (entry: PayrollRunEmployeeEntry) => {
    if (!run) {
      return
    }

    const descriptor = createPayrollRunEmployeePayslipAccessDescriptor(run, entry)

    if (!descriptor) {
      toast.error(t('payroll.runDetail.feedback.documentUnavailable'))
      return
    }

    setActiveDocumentActionKey(`${entry.id}:open`)

    try {
      await openPayslipDocument(descriptor)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('payroll.runDetail.feedback.openDocumentError'))
    } finally {
      setActiveDocumentActionKey(null)
    }
  }

  const handleDownloadPayslipDocument = async (entry: PayrollRunEmployeeEntry) => {
    if (!run) {
      return
    }

    const descriptor = createPayrollRunEmployeePayslipAccessDescriptor(run, entry)

    if (!descriptor) {
      toast.error(t('payroll.runDetail.feedback.documentUnavailable'))
      return
    }

    setActiveDocumentActionKey(`${entry.id}:download`)

    try {
      await downloadPayslipDocument(descriptor)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('payroll.runDetail.feedback.downloadDocumentError'))
    } finally {
      setActiveDocumentActionKey(null)
    }
  }

  if (runQuery.isPending && !runQuery.data) {
    return (
      <PayrollLayout
        title={t('payroll.runDetail.title')}
        subtitle={t('payroll.runDetail.subtitle')}
        onSignOut={signOut}
        userEmail={user?.email ?? null}
      >
        <PageStateSkeleton variant="detail" />
      </PayrollLayout>
    )
  }

  if (runQuery.isError) {
    return (
      <PayrollLayout
        title={t('payroll.runDetail.title')}
        subtitle={t('payroll.runDetail.subtitle')}
        onSignOut={signOut}
        userEmail={user?.email ?? null}
      >
        <ErrorState
          title={t('payroll.runDetail.emptyTitle')}
          description={t('payroll.runDetail.emptyDescription')}
          message={runQuery.error.message}
          onRetry={() => void runQuery.refetch()}
        />
      </PayrollLayout>
    )
  }

  if (!run) {
    return (
      <PayrollLayout
        title={t('payroll.runDetail.title')}
        subtitle={t('payroll.runDetail.subtitle')}
        onSignOut={signOut}
        userEmail={user?.email ?? null}
      >
        <EmptyState
          title={t('payroll.runDetail.emptyTitle')}
          description={t('payroll.runDetail.emptyDescription')}
          actions={
            <Button asChild variant="outline">
              <Link to={ROUTES.PAYROLL_PROCESSING}>
                <ChevronLeft className={cn('h-4 w-4', isRTL ? 'ml-2 rotate-180' : 'mr-2')} />
                {t('actions.backToProcessing')}
              </Link>
            </Button>
          }
        />
      </PayrollLayout>
    )
  }

  const statusMeta = getPayrollProcessingStatusMeta(run.status, t)

  return (
    <PayrollLayout
      title={t('payroll.runDetail.title')}
      subtitle={t('payroll.runDetail.subtitle')}
      onSignOut={signOut}
      userEmail={user?.email ?? null}
    >
      <PageHeader
        title={run.code}
        description={t('payroll.runDetail.headerDescription')}
        className="mb-6"
        backAction={
          <Button asChild variant="outline" size="sm">
            <Link to={ROUTES.PAYROLL_PROCESSING}>
              <ChevronLeft className={cn('h-4 w-4', isRTL ? 'ml-2 rotate-180' : 'mr-2')} />
              {t('actions.backToProcessing')}
            </Link>
          </Button>
        }
        badges={
          <>
            <StatusBadge tone={statusMeta.tone}>{statusMeta.label}</StatusBadge>
            <StatusBadge tone="neutral" emphasis="outline">
              {getPayrollRunTypeLabel(run.runType, t)}
            </StatusBadge>
            <StatusBadge tone="neutral" emphasis="outline">
              {run.periodCode}
            </StatusBadge>
          </>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={ROUTES.PAYROLL_COMPENSATION}>
                {t('payroll.processing.configureCompensation')}
                <ArrowRight className={cn('h-4 w-4', isRTL ? 'mr-2 rotate-180' : 'ml-2')} />
              </Link>
            </Button>
            {run.status === 'CALCULATED' ? (
              <Button
                type="button"
                variant="outline"
                disabled={calculateRunMutation.isPending}
                onClick={() => void handleRecalculateRun()}
              >
                {calculateRunMutation.isPending
                  ? t('payroll.runDetail.feedback.recalculating')
                  : t('payroll.runDetail.feedback.recalculate')}
              </Button>
            ) : null}
            {nextAction ? (
              <Button type="button" onClick={() => void handleAdvanceRun()}>
                {nextAction.nextStatus === 'CALCULATED' && calculateRunMutation.isPending
                  ? t('payroll.runDetail.feedback.calculating')
                  : updateRunStatusMutation.isPending
                    ? t('payroll.runDetail.feedback.updating')
                    : nextAction.label}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title={t('payroll.runDetail.summaries.payrollPeriodTitle')}
          value={run.periodLabel}
          helper={formatDateRange(run.periodStart, run.periodEnd, locale)}
        />
        <SummaryCard
          title={t('payroll.runDetail.summaries.includedEmployeesTitle')}
          value={String(run.calculatedEmployeeCount)}
          helper={t('payroll.runDetail.summaries.includedEmployeesHelper')}
        />
        <SummaryCard
          title={t('payroll.runDetail.summaries.excludedEmployeesTitle')}
          value={String(run.excludedEmployeeCount)}
          helper={t('payroll.runDetail.summaries.excludedEmployeesHelper')}
        />
        <SummaryCard
          title={t('payroll.runDetail.summaries.totalGrossTitle')}
          value={formatAmount(run.totalGrossPay, locale)}
          helper={t('payroll.runDetail.summaries.totalGrossHelper')}
        />
        <SummaryCard
          title={t('payroll.runDetail.summaries.totalDeductionsTitle')}
          value={formatAmount(run.totalDeductionsAmount, locale)}
          helper={t('payroll.runDetail.summaries.totalDeductionsHelper')}
        />
        <SummaryCard
          title={t('payroll.runDetail.summaries.totalNetTitle')}
          value={formatAmount(run.totalNetPay, locale)}
          helper={t('payroll.runDetail.summaries.totalNetHelper')}
        />
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
        <RunMetadataCard run={run} />

        <Card className={SURFACE_CARD_CLASS_NAME}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <Calculator className="h-4 w-4 text-slate-600" />
              {t('payroll.runDetail.notesCard.title')}
            </CardTitle>
            <CardDescription>
              {t('payroll.runDetail.notesCard.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
              {t('payroll.runDetail.notesCard.itemOne')}
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
              {t('payroll.runDetail.notesCard.itemTwo')}
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
              {t('payroll.runDetail.notesCard.itemThree')}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
          <EmployeeEntriesCard
            run={run}
            isLoading={entriesQuery.isPending && !entriesQuery.data}
            isError={entriesQuery.isError}
            errorMessage={entriesQuery.isError ? entriesQuery.error.message : undefined}
            onRetry={() => void entriesQuery.refetch()}
            entries={entries}
            activeDocumentActionKey={activeDocumentActionKey}
            onOpenWorkflow={setSelectedWorkflowEntry}
            onOpenPayslipDocument={handleOpenPayslipDocument}
            onDownloadPayslipDocument={handleDownloadPayslipDocument}
          />

        {activityQuery.isPending && !activityQuery.data ? (
          <Card className={SURFACE_CARD_CLASS_NAME}>
            <CardContent className="p-6">
              <SectionSkeleton lines={4} />
            </CardContent>
          </Card>
        ) : activityQuery.isError ? (
          <ErrorState
            title={t('payroll.runDetail.activity.loadErrorTitle')}
            description={t('payroll.runDetail.activity.loadErrorDescription')}
            message={activityQuery.error.message}
            onRetry={() => void activityQuery.refetch()}
          />
        ) : (
          <ActivityCard items={activity} />
          )}
        </div>

      <PayslipWorkflowDialog
        run={run}
        entry={selectedWorkflowEntry}
        isOpen={Boolean(selectedWorkflowEntry)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedWorkflowEntry(null)
          }
        }}
        activeDocumentActionKey={activeDocumentActionKey}
        onOpenPayslipDocument={handleOpenPayslipDocument}
        onDownloadPayslipDocument={handleDownloadPayslipDocument}
      />
    </PayrollLayout>
  )
}
