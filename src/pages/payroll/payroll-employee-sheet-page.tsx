import { ChevronLeft, Printer } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { PayrollEmployeeInformationSheet } from '@/components/payroll/payroll-employee-information-sheet'
import { EmptyState, ErrorState } from '@/components/common/page-state'
import { BRAND_BUTTON_CLASS_NAME, PageHeader } from '@/components/common/page-header'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ROUTES, getPayrollEmployeeRoute } from '@/constants/routes'
import { useAuth } from '@/hooks/use-auth'
import { usePrintDocument } from '@/hooks/use-print-document'
import { PayrollLayout } from '@/layouts/payroll-layout'
import { useLogPayrollEmployeeSheetExportMutation } from '@/services/payrollExportsService'
import { usePayrollEmployeeQuery } from '@/services/payrollEmployeesService'

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function PayrollEmployeeSheetSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
        <CardContent className="space-y-4 p-5">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-44" />
            <Skeleton className="h-10 w-44" />
          </div>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="mx-auto w-full max-w-[794px] rounded-2xl border border-slate-200 bg-white shadow-sm">
          <Skeleton className="h-1.5 w-full rounded-none" />
          <div className="space-y-6 p-8">
            <Skeleton className="h-16 w-full" />
            <div className="grid gap-6 lg:grid-cols-[190px_minmax(0,1fr)]">
              <Skeleton className="h-[220px] w-full rounded-2xl" />
              <div className="space-y-4">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-5 w-48" />
                <div className="grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={`sheet-summary-${index}`} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              </div>
            </div>
            {Array.from({ length: 3 }).map((_, sectionIndex) => (
              <div key={`sheet-section-${sectionIndex}`} className="space-y-4">
                <Skeleton className="h-6 w-56" />
                <div className="grid gap-3 md:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, rowIndex) => (
                    <Skeleton
                      key={`sheet-row-${sectionIndex}-${rowIndex}`}
                      className="h-16 w-full rounded-xl"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function PayrollEmployeeSheetPage() {
  const { id } = useParams<{ id: string }>()
  const { signOut, user } = useAuth()
  const employeeQuery = usePayrollEmployeeQuery(id)
  const logSheetExportMutation = useLogPayrollEmployeeSheetExportMutation(user?.id)
  const employeeIdForMemo = employeeQuery.data?.id ?? ''
  const employeeMatriculeForMemo = employeeQuery.data?.matricule ?? ''
  const generatedAt = useMemo(() => {
    if (employeeIdForMemo) {
      return formatDateTime(new Date().toISOString())
    }

    return formatDateTime(new Date().toISOString())
  }, [employeeIdForMemo])

  const printableDocumentName = useMemo(() => {
    if (!employeeIdForMemo) {
      return 'payroll-employee-sheet'
    }

    return `payroll-employee-sheet-${employeeMatriculeForMemo || employeeIdForMemo}`
  }, [employeeIdForMemo, employeeMatriculeForMemo])

  const { printDocument } = usePrintDocument({
    bodyClassName: 'payroll-sheet-printing',
    defaultDocumentTitle: printableDocumentName,
  })

  const handlePrint = async () => {
    if (!employeeQuery.data) {
      return
    }

    try {
      await logSheetExportMutation.mutateAsync(employeeQuery.data)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not start the payroll information sheet export.',
      )
      return
    }

    printDocument(printableDocumentName)
  }

  if (employeeQuery.isPending) {
    return (
      <PayrollLayout
        title="Employee Information Sheet"
        subtitle="Payroll-safe printable employee information sheet."
        onSignOut={signOut}
        userEmail={user?.email ?? null}
      >
        <PayrollEmployeeSheetSkeleton />
      </PayrollLayout>
    )
  }

  if (employeeQuery.isError) {
    return (
      <PayrollLayout
        title="Employee Information Sheet"
        subtitle="Payroll-safe printable employee information sheet."
        onSignOut={signOut}
        userEmail={user?.email ?? null}
      >
        <ErrorState
          title="Could not load employee information sheet"
          description="We couldn't load this payroll-safe information sheet right now."
          message={employeeQuery.error.message}
          onRetry={() => void employeeQuery.refetch()}
        />
      </PayrollLayout>
    )
  }

  if (!employeeQuery.data) {
    return (
      <PayrollLayout
        title="Employee Information Sheet"
        subtitle="Payroll-safe printable employee information sheet."
        onSignOut={signOut}
        userEmail={user?.email ?? null}
      >
        <EmptyState
          title="Employee sheet unavailable"
          description="This payroll-safe employee sheet is unavailable or outside the accessible payroll scope."
          actions={
            <Button asChild variant="outline">
              <Link to={ROUTES.PAYROLL_EMPLOYEES}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to employees
              </Link>
            </Button>
          }
        />
      </PayrollLayout>
    )
  }

  const employee = employeeQuery.data
  const fullName = `${employee.prenom} ${employee.nom}`.replace(/\s+/g, ' ').trim()

  return (
    <>
      <style>
        {`
          .payroll-sheet-print-root {
            display: none;
          }

          @page {
            size: A4 portrait;
            margin: 0;
          }

          @media print {
            body.payroll-sheet-printing > *:not(.payroll-sheet-print-root) {
              display: none !important;
            }

            body.payroll-sheet-printing .payroll-sheet-print-root,
            body.payroll-sheet-printing .payroll-sheet-print-root * {
              visibility: visible !important;
            }

            body.payroll-sheet-printing .payroll-sheet-print-root {
              display: block !important;
              background: #ffffff;
              margin: 0;
              padding: 0;
            }

            body.payroll-sheet-printing .payroll-employee-sheet {
              width: 210mm !important;
              min-height: 297mm !important;
              margin: 0 auto !important;
              border: 0 !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        `}
      </style>

      <PayrollLayout
        title="Employee Information Sheet"
        subtitle="Payroll-safe printable employee information sheet."
        onSignOut={signOut}
        userEmail={user?.email ?? null}
      >
        <PageHeader
          title="Employee Information Sheet"
          description={`Preview the payroll-safe information sheet for ${fullName} and use your browser print dialog to print or save it as PDF.`}
          className="mb-6"
          backAction={
            <Button asChild variant="outline" size="sm">
              <Link to={getPayrollEmployeeRoute(employee.id)}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back to employee
              </Link>
            </Button>
          }
          badges={
            <>
              <StatusBadge tone={employee.isActive ? 'success' : 'neutral'}>
                {employee.isActive ? 'Active' : 'Inactive'}
              </StatusBadge>
              <StatusBadge tone="neutral" emphasis="outline">
                Print-ready
              </StatusBadge>
            </>
          }
          actions={
            <Button
              type="button"
              className={BRAND_BUTTON_CLASS_NAME}
              onClick={() => {
                void handlePrint()
              }}
              disabled={logSheetExportMutation.isPending}
            >
              <Printer className="mr-2 h-4 w-4" />
              {logSheetExportMutation.isPending ? 'Preparing print...' : 'Print / Save as PDF'}
            </Button>
          }
        />

        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <PayrollEmployeeInformationSheet
              employee={employee}
              generatedAt={generatedAt}
              className="mx-auto w-full max-w-[794px] rounded-2xl border border-slate-200 shadow-sm"
            />
          </div>

          <Card className="rounded-2xl border border-slate-200/80 bg-slate-50/60 shadow-none">
            <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">Export options</p>
                <p className="text-sm text-slate-500">
                  Use your browser print dialog to print the sheet or save a PDF copy for payroll
                  operations. Email sending and admin actions are intentionally unavailable here.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void handlePrint()
                }}
                disabled={logSheetExportMutation.isPending}
              >
                <Printer className="mr-2 h-4 w-4" />
                {logSheetExportMutation.isPending ? 'Preparing print...' : 'Print / Save as PDF'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </PayrollLayout>

      {typeof document !== 'undefined'
        ? createPortal(
            <div className="payroll-sheet-print-root" aria-hidden="true">
              <PayrollEmployeeInformationSheet
                employee={employee}
                generatedAt={generatedAt}
                className="shadow-none"
              />
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

