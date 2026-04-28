"use client"

import { useMemo, useState } from "react"
import { Search, Wrench } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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
import { cn } from "@/lib/utils"
import type { WipRepairRecord } from "@/lib/types/wip-repair"

type WipRepairTableProps = {
  data: WipRepairRecord[]
}

const ALL_FILTER = "__all__"

function normalizeValue(value: string | null | undefined) {
  return value?.trim() || "-"
}

function formatDate(value: string | null) {
  if (!value) {
    return "-"
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed)
}

function getStatusClasses(status: string) {
  const normalized = status.toLowerCase()

  if (normalized.includes("progress")) {
    return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200"
  }

  if (normalized.includes("complete") || normalized.includes("finish")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
  }

  if (normalized.includes("hold") || normalized.includes("pending")) {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
  }

  return "border-border bg-muted text-foreground"
}

function getSortTimestamp(item: WipRepairRecord) {
  const candidates = [item.wo_date, item.received_date, item.inspect_date]

  for (const candidate of candidates) {
    if (!candidate) {
      continue
    }

    const timestamp = Date.parse(candidate)

    if (!Number.isNaN(timestamp)) {
      return timestamp
    }
  }

  return 0
}

export function WipRepairTable({ data }: WipRepairTableProps) {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER)
  const [siteFilter, setSiteFilter] = useState(ALL_FILTER)
  const [brandFilter, setBrandFilter] = useState(ALL_FILTER)

  const statusOptions = useMemo(
    () => Array.from(new Set(data.map((item) => normalizeValue(item.status)).filter((item) => item !== "-"))).sort(),
    [data]
  )
  const siteOptions = useMemo(
    () => Array.from(new Set(data.map((item) => normalizeValue(item.site)).filter((item) => item !== "-"))).sort(),
    [data]
  )
  const brandOptions = useMemo(
    () => Array.from(new Set(data.map((item) => normalizeValue(item.brand)).filter((item) => item !== "-"))).sort(),
    [data]
  )

  const filteredData = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return data
      .filter((item) => {
        const matchesQuery =
          normalizedQuery.length === 0 ||
          [
            item.wo,
            item.tire_sn,
            item.customer,
            item.site,
            item.brand,
            item.pattern,
            item.injury,
            item.receiver,
            item.store_loc,
          ]
            .map((value) => normalizeValue(value).toLowerCase())
            .some((value) => value.includes(normalizedQuery))

        const matchesStatus = statusFilter === ALL_FILTER || normalizeValue(item.status) === statusFilter
        const matchesSite = siteFilter === ALL_FILTER || normalizeValue(item.site) === siteFilter
        const matchesBrand = brandFilter === ALL_FILTER || normalizeValue(item.brand) === brandFilter

        return matchesQuery && matchesStatus && matchesSite && matchesBrand
      })
      .sort((left, right) => getSortTimestamp(right) - getSortTimestamp(left))
  }, [brandFilter, data, query, siteFilter, statusFilter])

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-2xl border-border/60 py-0 shadow-sm">
        <CardContent className="px-4 py-4 md:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari WO, tire SN, customer, site, atau brand"
                className="h-10 rounded-xl pl-9"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 w-full rounded-xl sm:min-w-40">
                  <SelectValue placeholder="Semua status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>Semua status</SelectItem>
                  {statusOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger className="h-10 w-full rounded-xl sm:min-w-44">
                  <SelectValue placeholder="Semua site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>Semua site</SelectItem>
                  {siteOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className="h-10 w-full rounded-xl sm:min-w-40">
                  <SelectValue placeholder="Semua brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>Semua brand</SelectItem>
                  {brandOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-2xl border-border/60 py-0 shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="px-4 py-3">WO</TableHead>
                <TableHead className="px-4 py-3">Status</TableHead>
                <TableHead className="px-4 py-3">Tire SN</TableHead>
                <TableHead className="px-4 py-3">Brand / Pattern</TableHead>
                <TableHead className="px-4 py-3">Size</TableHead>
                <TableHead className="px-4 py-3">Injury</TableHead>
                <TableHead className="px-4 py-3">Customer / Site</TableHead>
                <TableHead className="px-4 py-3">Received</TableHead>
                <TableHead className="px-4 py-3">WO Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length > 0 ? (
                filteredData.map((item) => (
                  <TableRow key={item.id_wo}>
                    <TableCell className="px-4 py-3 font-medium tabular-nums">{normalizeValue(item.wo)}</TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge variant="outline" className={cn("rounded-full px-2.5 py-1 text-xs font-medium", getStatusClasses(item.status))}>
                        {normalizeValue(item.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 font-mono text-xs">{normalizeValue(item.tire_sn)}</TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{normalizeValue(item.brand)}</span>
                        <span className="text-xs text-muted-foreground">{normalizeValue(item.pattern)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">{normalizeValue(item.size)}</TableCell>
                    <TableCell className="px-4 py-3">{normalizeValue(item.injury)}</TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{normalizeValue(item.customer)}</span>
                        <span className="text-xs text-muted-foreground">{normalizeValue(item.site)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">{formatDate(item.received_date)}</TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">{formatDate(item.wo_date)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-40 px-4 py-3 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Wrench className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Data WIP Repair tidak ditemukan</p>
                        <p className="text-sm">Coba ubah kata kunci pencarian atau filter yang dipilih.</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <p className="text-right text-xs text-muted-foreground">
        Menampilkan <span className="tabular-nums">{filteredData.length.toLocaleString("id-ID")}</span> dari <span className="tabular-nums">{data.length.toLocaleString("id-ID")}</span> data WIP Repair
      </p>
    </div>
  )
}
