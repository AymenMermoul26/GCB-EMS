import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
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
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { DashboardLayout } from '@/layouts/dashboard-layout'
import { useAuditLogQuery } from '@/services/auditLogService'
import type { AuditLogItem } from '@/types/audit-log'

const ACTION_FILTER_OPTIONS = [
  'ALL',
  'EMPLOYEE_SELF_UPDATED',
  'REQUEST_SUBMITTED',
  'REQUEST_APPROVED',
  'REQUEST_REJECTED',
  'VISIBILITY_UPDATED',
  'QR_REGENERATED',
  'QR_REVOKED',
]

export function AdminAuditPage() {
  const [actionFilter, setActionFilter] = useState('ALL')
  const [targetEmployeeSearch, setTargetEmployeeSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null)

  const debouncedTargetSearch = useDebouncedValue(targetEmployeeSearch, 400)
  const filters = useMemo(
    () => ({
      actionFilter,
      targetEmployeeSearch: debouncedTargetSearch || undefined,
      page,
      pageSize,
    }),
    [actionFilter, debouncedTargetSearch, page, pageSize],
  )

  const auditLogQuery = useAuditLogQuery(filters)
  const total = auditLogQuery.data?.total ?? 0
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = total === 0 ? 0 : Math.min(page * pageSize, total)

  return (
    <DashboardLayout title="Audit Log" subtitle="Trace sensitive actions for defense/demo review.">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <Select
              value={actionFilter}
              onValueChange={(value) => {
                setActionFilter(value)
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter action" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_FILTER_OPTIONS.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action === 'ALL' ? 'All actions' : action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Search target employee (name or matricule)"
              value={targetEmployeeSearch}
              onChange={(event) => {
                setTargetEmployeeSearch(event.target.value)
                setPage(1)
              }}
            />

            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value))
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Page size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Events</CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogQuery.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}

          {auditLogQuery.isError ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive">{auditLogQuery.error.message}</p>
              <Button variant="outline" size="sm" onClick={() => void auditLogQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : null}

          {!auditLogQuery.isPending && !auditLogQuery.isError ? (
            auditLogQuery.data && auditLogQuery.data.items.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[170px]">Date/Time</TableHead>
                        <TableHead className="min-w-[180px]">Actor</TableHead>
                        <TableHead className="min-w-[140px]">Action</TableHead>
                        <TableHead className="min-w-[180px]">Target</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogQuery.data.items.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                          <TableCell>{log.actorLabel}</TableCell>
                          <TableCell>{log.action}</TableCell>
                          <TableCell>{log.targetLabel}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-between gap-2">
                              <span className="line-clamp-1 text-xs text-muted-foreground">
                                {log.detailsPreview}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedLog(log)}
                              >
                                View JSON
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {from}-{to} of {total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1 || auditLogQuery.isFetching}
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={to >= total || auditLogQuery.isFetching}
                      onClick={() => setPage((prev) => prev + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                No audit entries found for these filters.
              </div>
            )
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Details</DialogTitle>
            <DialogDescription>
              Full details_json payload for the selected event.
            </DialogDescription>
          </DialogHeader>
          {selectedLog ? (
            <pre className="max-h-[420px] overflow-auto rounded-md border bg-slate-950 p-4 text-xs text-slate-100">
              {JSON.stringify(selectedLog.detailsJson, null, 2)}
            </pre>
          ) : null}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
