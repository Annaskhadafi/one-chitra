"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, X, RotateCcw, Download } from "lucide-react"
import * as XLSX from "xlsx"
import { getApprovalStatusList } from "@/app/actions/approval"
import type { ApprovalStatusItem, StatusFilter } from "@/app/dashboard/approvals/_lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
] as const

const STATUS_BADGE: Record<
  ApprovalStatusItem["status"],
  { label: string; className: string }
> = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  approved: { label: "Approved", className: "bg-green-100 text-green-800 border-green-200" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800 border-red-200" },
  cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-700 border-gray-200" },
}

const DEFAULT_FILTER: StatusFilter = {
  status: "all",
  search: "",
  dateFrom: null,
  dateTo: null,
  formKey: null,
}

function readFiltersFromParams(params: URLSearchParams): StatusFilter {
  const status = params.get("s_status") as StatusFilter["status"] | null
  return {
    status: status ?? "all",
    search: params.get("s_search") ?? "",
    dateFrom: params.get("s_dateFrom") ?? null,
    dateTo: params.get("s_dateTo") ?? null,
    formKey: params.get("s_formKey") ?? null,
  }
}

export function StatusTab() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [filters, setFilters] = useState<StatusFilter>(() =>
    readFiltersFromParams(searchParams)
  )
  const [data, setData] = useState<ApprovalStatusItem[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  // Sync filters → URL params
  const pushFilters = useCallback(
    (next: StatusFilter) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next.status && next.status !== "all") {
        params.set("s_status", next.status)
      } else {
        params.delete("s_status")
      }
      if (next.search) {
        params.set("s_search", next.search)
      } else {
        params.delete("s_search")
      }
      if (next.dateFrom) {
        params.set("s_dateFrom", next.dateFrom)
      } else {
        params.delete("s_dateFrom")
      }
      if (next.dateTo) {
        params.set("s_dateTo", next.dateTo)
      } else {
        params.delete("s_dateTo")
      }
      if (next.formKey) {
        params.set("s_formKey", next.formKey)
      } else {
        params.delete("s_formKey")
      }
      router.replace(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams]
  )

  // Fetch data when filters change
  useEffect(() => {
    startTransition(async () => {
      const result = await getApprovalStatusList(filters)
      setData(result)
      setSelectedIds(new Set())
    })
  }, [filters])

  const updateFilter = useCallback(
    <K extends keyof StatusFilter>(key: K, value: StatusFilter[K]) => {
      const next = { ...filters, [key]: value }
      setFilters(next)
      pushFilters(next)
    },
    [filters, pushFilters]
  )

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTER)
    pushFilters(DEFAULT_FILTER)
  }, [pushFilters])

  const exportData = useCallback(
    (format: "csv" | "xlsx") => {
      const rows = data.map((item) => ({
        ID: item.requestId,
        Form: item.formKey,
        Requester: item.requesterName,
        Status: STATUS_BADGE[item.status].label,
        Step: item.currentStepOrder != null ? `#${item.currentStepOrder}` : "—",
        Submitted: new Date(item.submittedAt).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
        Completed: item.completedAt
          ? new Date(item.completedAt).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "—",
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Approval Status")

      const fileName = `approval-status-${new Date().toISOString().slice(0, 10)}`
      if (format === "csv") {
        XLSX.writeFile(wb, `${fileName}.csv`, { bookType: "csv" })
      } else {
        XLSX.writeFile(wb, `${fileName}.xlsx`, { bookType: "xlsx" })
      }
    },
    [data]
  )

  const hasActiveFilters =
    filters.status !== "all" ||
    !!filters.search ||
    !!filters.dateFrom ||
    !!filters.dateTo ||
    !!filters.formKey

  // Checkbox selection
  const allSelected = data.length > 0 && selectedIds.size === data.length
  const someSelected = selectedIds.size > 0 && !allSelected

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(data.map((r) => r.requestId)))
    }
  }

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Status */}
        <div className="w-40">
          <Select
            value={filters.status}
            onValueChange={(v) => updateFilter("status", v as StatusFilter["status"])}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search by request ID */}
        <div className="relative w-56">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Cari ID request..."
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
          />
          {filters.search && (
            <button
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
              onClick={() => updateFilter("search", "")}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Date From */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Dari</label>
          <Input
            type="date"
            className="w-36"
            value={filters.dateFrom ?? ""}
            onChange={(e) => updateFilter("dateFrom", e.target.value || null)}
          />
        </div>

        {/* Date To */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Sampai</label>
          <Input
            type="date"
            className="w-36"
            value={filters.dateTo ?? ""}
            onChange={(e) => updateFilter("dateTo", e.target.value || null)}
          />
        </div>

        {/* Reset */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        )}

        {/* Export */}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={data.length === 0}
            onClick={() => exportData("csv")}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={data.length === 0}
            onClick={() => exportData("xlsx")}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            XLSX
          </Button>
        </div>
      </div>

      {/* Selection indicator */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
          <span className="font-medium">{selectedIds.size} dipilih</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setSelectedIds(new Set())}
          >
            Batalkan pilihan
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border">
        {isPending ? (
          <div className="flex items-center justify-center p-10 text-sm text-muted-foreground">
            Memuat data...
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <p className="text-sm font-medium text-muted-foreground">Tidak ada data</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasActiveFilters
                ? "Tidak ada request yang sesuai dengan filter yang diterapkan."
                : "Belum ada approval request."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                    aria-label="Pilih semua"
                  />
                </TableHead>
                <TableHead className="w-[120px]">ID</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>Requester</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[60px]">Step</TableHead>
                <TableHead className="w-[140px]">Submitted</TableHead>
                <TableHead className="w-[140px]">Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => {
                const badge = STATUS_BADGE[item.status]
                const isSelected = selectedIds.has(item.requestId)
                return (
                  <TableRow
                    key={item.requestId}
                    className="cursor-pointer hover:bg-muted/50"
                    data-state={isSelected ? "selected" : undefined}
                    onClick={() => toggleRow(item.requestId)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRow(item.requestId)}
                        aria-label={`Pilih ${item.requestId}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.requestId.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{item.formKey}</div>
                      <div className="text-xs text-muted-foreground">{item.definitionName}</div>
                    </TableCell>
                    <TableCell className="text-sm">{item.requesterName}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-xs ${badge.className}`}
                      >
                        {badge.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.currentStepOrder != null ? `#${item.currentStepOrder}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(item.submittedAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.completedAt
                        ? new Date(item.completedAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
