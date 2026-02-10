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
import type { AuditAction, AuditLogItem } from '@/types/audit-log'

const ACTION_OPTIONS: Array<{ value: AuditAction | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All actions' },
  { value: 'EMPLOYEE_CREATED', label: 'EMPLOYEE_CREATED' },
  { value: 'EMPLOYEE_UPDATED', label: 'EMPLOYEE_UPDATED' },
  { value: 'EMPLOYEE_DEACTIVATED', label: 'EMPLOYEE_DEACTIVATED' },
  { value: 'REQUEST_SUBMITTED', label: 'REQUEST_SUBMITTED' },
  { value: 'REQUEST_APPROVED', label: 'REQUEST_APPROVED' },
  { value: 'REQUEST_REJECTED', label: 'REQUEST_REJECTED' },
  { value: 'QR_REGENERATED', label: 'QR_REGENERATED' },
  { value: 'QR_REVOKED', label: 'QR_REVOKED' },
  { value: 'VISIBILITY_UPDATED', label: 'VISIBILITY_UPDATED' },
  { value: 'EMPLOYEE_SELF_UPDATED', label: 'EMPLOYEE_SELF_UPDATED' },
]

function shortId(value: string | null): string {
  if (!value) {
    return '-'
  }

  return value.length > 8 ? `${value.slice(0, 8)}...` : value
}

export function AuditLogPage() {
  const [action, setAction] = useState<AuditAction | 'ALL'>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [targetSearch, setTargetSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null)

  const debouncedTargetSearch = useDebouncedValue(targetSearch, 400)
  const filters = useMemo(
    () => ({
      action,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      targetEmployeeSearch: debouncedTargetSearch || undefined,
      page,
      pageSize,
    }),
    [action, dateFrom, dateTo, debouncedTargetSearch, page, pageSize],
  )

  const auditLogQuery = useAuditLogQuery(filters)
  const total = auditLogQuery.data?.total ?? 0
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = total === 0 ? 0 : Math.min(page * pageSize, total)

  return (
    <DashboardLayout title="Audit Log" subtitle="Review sensitive actions and trace decisions.">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-6">
            <Select
              value={action}
              onValueChange={(value) => {
                setAction(value as AuditAction | 'ALL')
                setPage(1)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Action type" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value)
                setPage(1)
              }}
              aria-label="Date from"
            />

            <Input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value)
                setPage(1)
              }}
              aria-label="Date to"
            />

            <Input
              className="md:col-span-2"
              placeholder="Search target employee (matricule, nom, prenom)"
              value={targetSearch}
              onChange={(event) => {
                setTargetSearch(event.target.value)
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
                        <TableHead className="min-w-[170px]">Action</TableHead>
                        <TableHead className="min-w-[220px]">Target type/id</TableHead>
                        <TableHead className="min-w-[260px]">Details</TableHead>
                        <TableHead className="w-[70px]">View</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogQuery.data.items.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                          <TableCell>{log.actorLabel}</TableCell>
                          <TableCell>{log.action}</TableCell>
                          <TableCell>
                            <div className="text-sm">{log.targetType}</div>
                            <div className="text-xs text-muted-foreground">
                              {shortId(log.targetId)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="line-clamp-1 text-xs text-muted-foreground">
                              {log.detailsPreview}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" onClick={() => setSelectedLog(log)}>
                              View
                            </Button>
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
                No audit events yet.
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
              Full details JSON payload for the selected event.
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
