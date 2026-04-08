import {
  AlertCircle,
  CheckCircle2,
  FileSearch,
  Loader2,
  Upload,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { StatusBadge } from '@/components/common/status-badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { useEmployeeDossierImportMutation } from '@/services/employeeDossierImportService'
import {
  EMPLOYEE_DOSSIER_ACCEPT_ATTRIBUTE,
  formatEmployeeDossierFileSize,
  type EmployeeDossierExtractionResponse,
} from '@/types/employee-dossier-import'

interface EmployeeDossierImportDialogProps {
  disabled?: boolean
  onApply: (result: EmployeeDossierExtractionResponse) => void
}

function formatConfidence(confidence: number | null): string {
  if (confidence === null) {
    return 'Confidence unavailable'
  }

  return `${Math.round(confidence * 100)}% confidence`
}

export function EmployeeDossierImportDialog({
  disabled = false,
  onApply,
}: EmployeeDossierImportDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [extractionResult, setExtractionResult] =
    useState<EmployeeDossierExtractionResponse | null>(null)

  const importMutation = useEmployeeDossierImportMutation({
    onSuccess: (result) => {
      setExtractionResult(result)
      setFileError(null)
    },
    onError: (error) => {
      setExtractionResult(null)
      setFileError(error.message)
    },
  })

  const importedFields = useMemo(
    () =>
      Object.values(extractionResult?.fields ?? {}).filter(
        (field) => field.status === 'imported' || field.status === 'low_confidence',
      ),
    [extractionResult],
  )

  const lowConfidenceFields = useMemo(
    () =>
      importedFields.filter((field) => field.status === 'low_confidence'),
    [importedFields],
  )

  const missingFields = useMemo(
    () =>
      Object.values(extractionResult?.fields ?? {}).filter((field) => field.status === 'missing'),
    [extractionResult],
  )

  const unmappedFields = useMemo(
    () =>
      Object.values(extractionResult?.fields ?? {}).filter((field) => field.status === 'unmapped'),
    [extractionResult],
  )

  const handleExtract = async () => {
    if (!selectedFile) {
      setFileError('Select a dossier file first.')
      return
    }

    setFileError(null)
    setExtractionResult(null)
    await importMutation.mutateAsync(selectedFile)
  }

  const resetDialog = () => {
    setSelectedFile(null)
    setFileError(null)
    setExtractionResult(null)
    importMutation.reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)

        if (!nextOpen) {
          resetDialog()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled}>
          <Upload className="mr-2 h-4 w-4" />
          Import from dossier
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import employee draft from dossier</DialogTitle>
          <DialogDescription>
            Upload a PDF or image dossier, extract supported employee fields through the
            server-side OCR pipeline, then review the imported values before applying them
            to the create form.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base font-semibold">Upload dossier</CardTitle>
              <p className="text-sm text-muted-foreground">
                Supported types: PDF, JPG / JPEG, PNG. Files stay in the extraction request only
                and are not created as employee records automatically.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="employee-dossier-file">Administrative dossier</Label>
                <Input
                  id="employee-dossier-file"
                  type="file"
                  accept={EMPLOYEE_DOSSIER_ACCEPT_ATTRIBUTE}
                  disabled={importMutation.isPending}
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null
                    setSelectedFile(nextFile)
                    setFileError(null)
                    setExtractionResult(null)
                  }}
                />
              </div>

              {selectedFile ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <div className="font-medium">{selectedFile.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedFile.type || 'Unknown type'} • {formatEmployeeDossierFileSize(selectedFile.size)}
                  </div>
                </div>
              ) : null}

              {fileError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Extraction failed</AlertTitle>
                  <AlertDescription>
                    {fileError} You can close this dialog and continue with manual entry.
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          {extractionResult ? (
            <Card className="rounded-2xl border border-slate-200/80 shadow-sm">
              <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base font-semibold">Extraction review</CardTitle>
                  <StatusBadge tone="info">{extractionResult.provider}</StatusBadge>
                  <StatusBadge tone="neutral" emphasis="outline">
                    {extractionResult.modelId}
                  </StatusBadge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Imported values are not saved automatically. Apply them to the form, review the
                  low-confidence fields, then confirm the employee manually.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                      Imported
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-emerald-900">
                      {importedFields.length}
                    </div>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-amber-700">
                      Review closely
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-amber-900">
                      {lowConfidenceFields.length}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-600">
                      Missing or unmapped
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">
                      {missingFields.length + unmappedFields.length}
                    </div>
                  </div>
                </div>

                {extractionResult.warnings.length > 0 ? (
                  <Alert className="rounded-2xl border border-amber-200 bg-amber-50 text-amber-900">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Review warnings</AlertTitle>
                    <AlertDescription>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                        {extractionResult.warnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <FileSearch className="h-4 w-4 text-[#ff6b35]" />
                    Extracted fields
                  </div>
                  <div className="space-y-2">
                    {Object.values(extractionResult.fields).map((field) => (
                      <div
                        key={field.key}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium text-slate-900">{field.label}</div>
                          <StatusBadge
                            tone={
                              field.status === 'imported'
                                ? 'success'
                                : field.status === 'low_confidence'
                                  ? 'warning'
                                  : field.status === 'missing'
                                    ? 'neutral'
                                    : 'danger'
                            }
                          >
                            {field.status === 'imported'
                              ? 'Imported'
                              : field.status === 'low_confidence'
                                ? 'Low confidence'
                                : field.status === 'missing'
                                  ? 'Missing'
                                  : 'Not applied'}
                          </StatusBadge>
                          <span className="text-xs text-muted-foreground">
                            {formatConfidence(field.confidence)}
                          </span>
                        </div>
                        <div className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                          <div>
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">
                              Extracted value
                            </div>
                            <div className="text-slate-900">
                              {field.extractedValue ?? 'Not found'}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">
                              Normalized for form
                            </div>
                            <div className="text-slate-900">
                              {field.normalizedValue ?? 'Not applied'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!extractionResult && !fileError && !importMutation.isPending ? (
            <Alert className="rounded-2xl border border-slate-200 bg-slate-50 text-slate-800">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Manual review remains mandatory</AlertTitle>
              <AlertDescription>
                This import only prefills the current Add Employee form. No employee record is
                created until the admin reviews the imported values and submits the existing form.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={importMutation.isPending}
          >
            {extractionResult ? 'Close' : 'Cancel'}
          </Button>
          {extractionResult ? (
            <Button
              type="button"
              className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm transition hover:opacity-95 hover:shadow-md"
              onClick={() => {
                onApply(extractionResult)
                setOpen(false)
              }}
            >
              Apply to form
            </Button>
          ) : (
            <Button
              type="button"
              className="bg-gradient-to-br from-[#ff6b35] to-[#ffc947] text-white shadow-sm transition hover:opacity-95 hover:shadow-md"
              onClick={() => {
                void handleExtract()
              }}
              disabled={importMutation.isPending || !selectedFile}
            >
              {importMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSearch className="mr-2 h-4 w-4" />
              )}
              {importMutation.isPending ? 'Extracting...' : 'Extract fields'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

