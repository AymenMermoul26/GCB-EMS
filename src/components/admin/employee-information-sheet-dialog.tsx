import { zodResolver } from '@hookform/resolvers/zod'
import { FileText, Loader2, Mail, Printer, Send } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import gcbLogo from '@/assets/brand/gcb-logo.svg'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
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
import { Textarea } from '@/components/ui/textarea'
import { useSendEmployeeInformationSheetMutation } from '@/services/employeeSheetService'

const COMPANY_NAME = 'LA SOCI\u00C9T\u00C9 NATIONALE DE G\u00C9NIE-CIVIL & B\u00C2TIMENT'
const APP_NAME = 'GCB Employee Management System'

const sendSheetSchema = z.object({
  recipientEmail: z.string().trim().email('Enter a valid recipient email address.'),
  subject: z.string().trim().max(200, 'Subject must be 200 characters or fewer.'),
  customMessage: z.string().trim().max(1000, 'Message must be 1000 characters or fewer.'),
})

type SendSheetFormValues = z.infer<typeof sendSheetSchema>

interface EmployeeInformationSheetDialogProps {
  employee: {
    id: string
    matricule: string
    nom: string
    prenom: string
    poste: string | null
    email: string | null
    telephone: string | null
    photoUrl: string | null
    isActive: boolean
    createdAt: string
    updatedAt: string
  }
  departmentName?: string | null
  accountRole?: string | null
  isAccountLinked?: boolean
  isLoading?: boolean
}

interface InformationSheetDocumentProps {
  employee: EmployeeInformationSheetDialogProps['employee']
  departmentName?: string | null
  accountRole?: string | null
  isAccountLinked?: boolean
  generatedAt: string
  className?: string
}

function formatDisplayValue(value: string | null | undefined, fallback = 'Not set'): string {
  if (!value || value.trim().length === 0) {
    return fallback
  }

  return value
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function getInitials(prenom: string, nom: string): string {
  const first = prenom.trim().charAt(0)
  const second = nom.trim().charAt(0)
  return `${first}${second}`.toUpperCase() || 'NA'
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  )
}

function InformationSheetDocument({
  employee,
  departmentName,
  accountRole,
  isAccountLinked,
  generatedAt,
  className,
}: InformationSheetDocumentProps) {
  const fullName = `${employee.prenom} ${employee.nom}`.replace(/\s+/g, ' ').trim()
  const accountStatus = isAccountLinked ? 'Linked account' : 'Not linked'
  const safeDepartment = formatDisplayValue(departmentName, 'Department not assigned')

  return (
    <div className={`employee-sheet-document bg-white text-slate-900 ${className ?? ''}`.trim()}>
      <div className="h-1.5 w-full bg-gradient-to-br from-[#ff6b35] to-[#ffc947]" />

      <div className="space-y-8 p-10">
        <header className="flex items-start justify-between gap-6 border-b border-slate-200 pb-6">
          <div className="flex min-w-0 items-center gap-4">
            <img
              src={gcbLogo}
              alt="GCB company logo"
              className="h-20 w-20 flex-shrink-0 object-contain"
            />
            <div className="min-w-0 space-y-2">
              <p className="text-base font-semibold uppercase tracking-[0.08em] text-slate-900">
                {COMPANY_NAME}
              </p>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                  Employee Information Sheet
                </h1>
                <p className="mt-1 text-sm text-slate-500">Generated on {generatedAt}</p>
              </div>
            </div>
          </div>

          <Badge className="border-transparent bg-slate-100 text-slate-700">
            Internal administrative use
          </Badge>
        </header>

        <section className="grid gap-8 lg:grid-cols-[180px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
            {employee.photoUrl ? (
              <img src={employee.photoUrl} alt={fullName} className="h-[220px] w-full object-cover" />
            ) : (
              <div className="flex h-[220px] items-center justify-center bg-slate-100 text-5xl font-semibold text-slate-500">
                {getInitials(employee.prenom, employee.nom)}
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                Employee identity
              </p>
              <h2 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
                {fullName}
              </h2>
              <p className="mt-2 text-lg text-slate-600">
                {formatDisplayValue(employee.poste, 'Position not set')}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="Employee ID" value={employee.matricule} />
              <InfoRow label="Department" value={safeDepartment} />
              <InfoRow label="Professional email" value={formatDisplayValue(employee.email)} />
              <InfoRow label="Professional phone" value={formatDisplayValue(employee.telephone)} />
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <InfoRow label="Employee status" value={employee.isActive ? 'Active' : 'Inactive'} />
          <InfoRow label="Account status" value={accountStatus} />
          <InfoRow label="Account role" value={formatDisplayValue(accountRole, 'Not assigned')} />
          <InfoRow label="Record created" value={formatDateTime(employee.createdAt)} />
          <InfoRow label="Last updated" value={formatDateTime(employee.updatedAt)} />
          <InfoRow label="Generated by" value={APP_NAME} />
        </section>

        <footer className="border-t border-slate-200 pt-5 text-sm text-slate-500">
          Generated by GCB Employee Management System
        </footer>
      </div>
    </div>
  )
}

export function EmployeeInformationSheetDialog({
  employee,
  departmentName,
  accountRole,
  isAccountLinked,
  isLoading = false,
}: EmployeeInformationSheetDialogProps) {
  const [open, setOpen] = useState(false)
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false)
  const [generatedAt, setGeneratedAt] = useState(() => formatDateTime(new Date().toISOString()))

  const fullName = useMemo(
    () => `${employee.prenom} ${employee.nom}`.replace(/\s+/g, ' ').trim(),
    [employee.nom, employee.prenom],
  )

  const defaultSubject = useMemo(() => `Employee Information Sheet - ${fullName}`, [fullName])

  const defaultMessage = useMemo(
    () =>
      `Please find below the employee information summary for ${fullName}. Use the secure application link in this message to review the full internal record.`,
    [fullName],
  )

  const form = useForm<SendSheetFormValues>({
    resolver: zodResolver(sendSheetSchema),
    defaultValues: {
      recipientEmail: '',
      subject: defaultSubject,
      customMessage: defaultMessage,
    },
  })

  useEffect(() => {
    form.reset({
      recipientEmail: '',
      subject: defaultSubject,
      customMessage: defaultMessage,
    })
  }, [defaultMessage, defaultSubject, form])

  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove('employee-sheet-printing')
    }

    window.addEventListener('afterprint', handleAfterPrint)

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint)
      document.body.classList.remove('employee-sheet-printing')
    }
  }, [])

  const sendSheetMutation = useSendEmployeeInformationSheetMutation({
    onSuccess: (data) => {
      if (data.warning) {
        toast.warning(data.warning)
      }

      toast.success('Employee information sheet sent.')
      setIsEmailDialogOpen(false)
      sendSheetMutation.reset()
      form.reset({
        recipientEmail: '',
        subject: defaultSubject,
        customMessage: defaultMessage,
      })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const handlePrint = () => {
    const previousTitle = document.title
    document.title = `employee-sheet-${employee.matricule || employee.id}`
    document.body.classList.add('employee-sheet-printing')

    window.requestAnimationFrame(() => {
      window.print()
      window.setTimeout(() => {
        document.title = previousTitle
        document.body.classList.remove('employee-sheet-printing')
      }, 200)
    })
  }

  const onSubmit = form.handleSubmit(async (values) => {
    await sendSheetMutation.mutateAsync({
      employeId: employee.id,
      recipientEmail: values.recipientEmail,
      subject: values.subject,
      customMessage: values.customMessage,
      appBaseUrl: window.location.origin,
    })
  })

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
              Preview the internal employee sheet, print it, or send a structured summary by email.
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
                <InformationSheetDocument
                  employee={employee}
                  departmentName={departmentName}
                  accountRole={accountRole}
                  isAccountLinked={isAccountLinked}
                  generatedAt={generatedAt}
                  className="mx-auto w-full max-w-[794px] rounded-2xl border border-slate-200 shadow-sm"
                />
              </div>

              <Card className="rounded-2xl border border-slate-200/80 bg-slate-50/60 shadow-none">
                <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-900">Version A delivery</p>
                    <p className="text-sm text-slate-500">
                      Email sends a structured summary and secure internal link only. No PDF attachment is generated server-side.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={handlePrint}>
                      <Printer className="mr-2 h-4 w-4" />
                      Print / Save as PDF
                    </Button>
                    <Dialog
                      open={isEmailDialogOpen}
                      onOpenChange={(nextOpen) => {
                        setIsEmailDialogOpen(nextOpen)
                        if (!nextOpen) {
                          sendSheetMutation.reset()
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          type="button"
                          className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm hover:brightness-95"
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Send by Email
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                          <DialogTitle>Send employee information sheet</DialogTitle>
                          <DialogDescription>
                            The email will include a structured summary and a secure internal application link.
                          </DialogDescription>
                        </DialogHeader>

                        <form className="space-y-4" onSubmit={onSubmit}>
                          {sendSheetMutation.isError ? (
                            <Alert variant="destructive">
                              <AlertTitle>Email sending failed</AlertTitle>
                              <AlertDescription>{sendSheetMutation.error.message}</AlertDescription>
                            </Alert>
                          ) : null}

                          <div className="space-y-2">
                            <Label htmlFor="sheet-recipient-email">Recipient email</Label>
                            <Input
                              id="sheet-recipient-email"
                              type="email"
                              placeholder="internal.service@company.com"
                              disabled={sendSheetMutation.isPending}
                              {...form.register('recipientEmail')}
                            />
                            {form.formState.errors.recipientEmail?.message ? (
                              <p className="text-sm text-destructive">
                                {form.formState.errors.recipientEmail.message}
                              </p>
                            ) : null}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="sheet-subject">Subject</Label>
                            <Input
                              id="sheet-subject"
                              placeholder={defaultSubject}
                              disabled={sendSheetMutation.isPending}
                              {...form.register('subject')}
                            />
                            {form.formState.errors.subject?.message ? (
                              <p className="text-sm text-destructive">
                                {form.formState.errors.subject.message}
                              </p>
                            ) : null}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="sheet-custom-message">Custom message</Label>
                            <Textarea
                              id="sheet-custom-message"
                              rows={5}
                              disabled={sendSheetMutation.isPending}
                              {...form.register('customMessage')}
                            />
                            {form.formState.errors.customMessage?.message ? (
                              <p className="text-sm text-destructive">
                                {form.formState.errors.customMessage.message}
                              </p>
                            ) : null}
                          </div>

                          <DialogFooter className="gap-2 sm:justify-between">
                            <p className="text-xs text-slate-500">
                              Secure link target: internal admin employee profile.
                            </p>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsEmailDialogOpen(false)}
                                disabled={sendSheetMutation.isPending}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="submit"
                                disabled={sendSheetMutation.isPending}
                                className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm hover:brightness-95"
                              >
                                {sendSheetMutation.isPending ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="mr-2 h-4 w-4" />
                                )}
                                {sendSheetMutation.isPending ? 'Sending...' : 'Send by Email'}
                              </Button>
                            </div>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {typeof document !== 'undefined'
        ? createPortal(
            <div className="employee-sheet-print-root" aria-hidden="true">
              <InformationSheetDocument
                employee={employee}
                departmentName={departmentName}
                accountRole={accountRole}
                isAccountLinked={isAccountLinked}
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
