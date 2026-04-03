import { Download, FileText, Loader2, Mail, Printer, Send } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  EmployeeInformationSheetDocument,
  type EmployeeInformationSheetDocumentEmployee,
} from '@/components/admin/employee-information-sheet-document'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import { Skeleton } from '@/components/ui/skeleton'
import { usePrintDocument } from '@/hooks/use-print-document'
import {
  logEmployeeInformationSheetPreview,
  validateEmployeeInformationSheetRecipientEmail,
  useDownloadEmployeeInformationSheetPdfMutation,
  useLogEmployeeInformationSheetExportMutation,
  useSendEmployeeInformationSheetMutation,
} from '@/services/employeeDocumentsService'

interface EmployeeInformationSheetDialogProps {
  employee: EmployeeInformationSheetDocumentEmployee
  departmentName?: string | null
  isLoading?: boolean
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function EmployeeInformationSheetDialog({
  employee,
  departmentName,
  isLoading = false,
}: EmployeeInformationSheetDialogProps) {
  const [open, setOpen] = useState(false)
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false)
  const [generatedAt, setGeneratedAt] = useState(() => formatDateTime(new Date().toISOString()))
  const [recipientEmail, setRecipientEmail] = useState(employee.email ?? '')
  const [recipientEmailError, setRecipientEmailError] = useState<string | null>(null)
  const previewLoggedRef = useRef(false)

  const printableDocumentName = useMemo(
    () => `employee-sheet-${employee.matricule || employee.id}`,
    [employee.id, employee.matricule],
  )

  const { printDocument } = usePrintDocument({
    bodyClassName: 'employee-sheet-printing',
    defaultDocumentTitle: printableDocumentName,
  })

  const downloadPdfMutation = useDownloadEmployeeInformationSheetPdfMutation()
  const logPrintExportMutation = useLogEmployeeInformationSheetExportMutation()
  const sendDocumentMutation = useSendEmployeeInformationSheetMutation()

  useEffect(() => {
    if (!open) {
      previewLoggedRef.current = false
      return
    }

    if (isLoading || previewLoggedRef.current) {
      return
    }

    previewLoggedRef.current = true
    void logEmployeeInformationSheetPreview(employee).catch((error) => {
      console.error('Failed to log employee information sheet preview', error)
    })
  }, [employee, isLoading, open])

  const handlePrint = async () => {
    try {
      await logPrintExportMutation.mutateAsync({
        target: employee,
        channel: 'print_pdf',
        details: {
          format: 'print_pdf',
        },
      })
    } catch (error) {
      console.error('Failed to log employee information sheet print export', error)
    }

    printDocument(printableDocumentName)
  }

  const handleDownloadPdf = async () => {
    try {
      const result = await downloadPdfMutation.mutateAsync({
        employee,
        departmentName,
      })

      if (result.warning) {
        toast.error(result.warning)
        return
      }

      toast.success(`PDF downloaded as ${result.fileName}.`)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not download the employee information sheet PDF.',
      )
    }
  }

  const handleSendByEmail = async () => {
    const normalizedEmail = recipientEmail.trim().toLowerCase()

    const validationError = validateEmployeeInformationSheetRecipientEmail(normalizedEmail)
    if (validationError) {
      setRecipientEmailError(validationError)
      return
    }

    setRecipientEmailError(null)

    try {
      const result = await sendDocumentMutation.mutateAsync({
        employeId: employee.id,
        recipientEmail: normalizedEmail,
      })

      toast.success(`Employee information sheet sent to ${result.recipient_email}.`)
      if (result.warning) {
        toast.error(result.warning)
      }
      setIsSendDialogOpen(false)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Could not send the employee information sheet by email.',
      )
    }
  }

  return (
    <>
      <style>
        {`
          .employee-sheet-print-root {
            display: none;
          }

          @page {
            size: A4 portrait;
            margin: 0;
          }

          @media print {
            body.employee-sheet-printing > *:not(.employee-sheet-print-root) {
              display: none !important;
            }

            body.employee-sheet-printing .employee-sheet-print-root,
            body.employee-sheet-printing .employee-sheet-print-root * {
              visibility: visible !important;
            }

            body.employee-sheet-printing .employee-sheet-print-root {
              display: block !important;
              background: #ffffff;
              margin: 0;
              padding: 0;
            }

            body.employee-sheet-printing .employee-sheet-document {
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

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)

          if (nextOpen) {
            setGeneratedAt(formatDateTime(new Date().toISOString()))
            setRecipientEmail(employee.email ?? '')
            setRecipientEmailError(null)
          } else {
            setIsSendDialogOpen(false)
          }
        }}
      >
        <DialogTrigger asChild>
          <Button type="button" variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Information Sheet
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[92vh] w-[96vw] max-w-6xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Employee Information Sheet</DialogTitle>
              <DialogDescription>
              Preview the controlled employee document, print it, download a PDF copy, or send it
              by email through the backend delivery flow. Email delivery is restricted to Gmail
              recipients.
              </DialogDescription>
            </DialogHeader>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-[720px] w-full rounded-2xl" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <EmployeeInformationSheetDocument
                  employee={employee}
                  departmentName={departmentName}
                  generatedAt={generatedAt}
                  className="mx-auto w-full max-w-[794px] rounded-2xl border border-slate-200 shadow-sm"
                />
              </div>

              <Card className="rounded-2xl border border-slate-200/80 bg-slate-50/60 shadow-none">
                <div className="flex flex-col gap-4 p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-900">Document actions</p>
                    <p className="text-sm text-slate-500">
                      Print the sheet, download a direct PDF copy, or send the controlled document
                      by email through the server-side workflow. Gmail recipients only.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        void handlePrint()
                      }}
                      disabled={logPrintExportMutation.isPending}
                    >
                      {logPrintExportMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Printer className="mr-2 h-4 w-4" />
                      )}
                      {logPrintExportMutation.isPending
                        ? 'Preparing print...'
                        : 'Print / Save as PDF'}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        void handleDownloadPdf()
                      }}
                      disabled={downloadPdfMutation.isPending}
                    >
                      {downloadPdfMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      {downloadPdfMutation.isPending ? 'Preparing PDF...' : 'Download PDF'}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsSendDialogOpen(true)}
                      disabled={sendDocumentMutation.isPending}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Send by Email
                    </Button>
                  </div>
                </div>
              </Card>

              <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Send Employee Information Sheet</DialogTitle>
                    <DialogDescription>
                      The document email is generated and sent by the backend. This action is role-checked, restricted to Gmail recipients, and recorded in the audit log.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <Alert className="rounded-2xl border border-slate-200 bg-slate-50 text-slate-800">
                      <Send className="h-4 w-4" />
                    <AlertTitle>Controlled delivery</AlertTitle>
                      <AlertDescription>
                        Only the approved employee-sheet fields are included. Internal HR notes and unsupported sensitive fields remain excluded. Recipient addresses must end with @gmail.com. If compliant backend email delivery is not configured, the send attempt will fail clearly.
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                      <Label htmlFor="employee-sheet-recipient-email">Recipient email</Label>
                      <Input
                        id="employee-sheet-recipient-email"
                        type="email"
                        autoComplete="email"
                        placeholder="recipient@gmail.com"
                        value={recipientEmail}
                        onChange={(event) => {
                          setRecipientEmail(event.target.value)
                          if (recipientEmailError) {
                            setRecipientEmailError(null)
                          }
                        }}
                      />
                      {recipientEmailError ? (
                        <p className="text-sm text-destructive">{recipientEmailError}</p>
                      ) : null}
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsSendDialogOpen(false)}
                      disabled={sendDocumentMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm transition hover:opacity-95 hover:shadow-md"
                      onClick={() => {
                        void handleSendByEmail()
                      }}
                      disabled={sendDocumentMutation.isPending}
                    >
                      {sendDocumentMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      {sendDocumentMutation.isPending ? 'Sending...' : 'Send Email'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {typeof document !== 'undefined'
        ? createPortal(
            <div className="employee-sheet-print-root" aria-hidden="true">
              <EmployeeInformationSheetDocument
                employee={employee}
                departmentName={departmentName}
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
