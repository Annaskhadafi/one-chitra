"use client"

import { Fragment, useMemo, useState } from "react"
import { Check, ChevronDown, Search, Wrench, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
import { normalizeWipRepairBrand } from "@/lib/wip-repair-brand"
import type { WipRepairRecord, WipRepairWorkOrderDetailRecord } from "@/lib/types/wip-repair"

type WipRepairTableProps = {
  data: WipRepairRecord[]
  workOrderDetails: WipRepairWorkOrderDetailRecord[]
}

const ALL_FILTER = "__all__"

type MultiSelectOption = {
  value: string
  label: string
}

function normalizeValue(value: string | null | undefined) {
  return value?.trim() || "-"
}

function normalizeTireSn(value: string | null | undefined) {
  return normalizeValue(value).toUpperCase()
}

function isWaitingWorkOrder(value: string | null | undefined) {
  return normalizeValue(value).toLowerCase() === "waiting wo"
}

function getWorkOrderDetailKey(item: WipRepairRecord) {
  if (!isWaitingWorkOrder(item.wo)) {
    return normalizeValue(item.wo)
  }

  const tireSn = normalizeTireSn(item.tire_sn)
  const idWo = normalizeValue(item.id_wo)

  return `${normalizeValue(item.wo)}:${tireSn}:${idWo}`
}

function getDetailLookupKeys(item: WipRepairRecord) {
  if (!isWaitingWorkOrder(item.wo)) {
    return [normalizeValue(item.wo)]
  }

  const keys = new Set<string>()
  const tireSn = normalizeTireSn(item.tire_sn)
  const idWo = normalizeValue(item.id_wo)

  if (tireSn !== "-") {
    keys.add(`WAITING_SN:${tireSn}`)
  }

  if (idWo !== "-") {
    keys.add(`WAITING_ID:${idWo}`)
  }

  return Array.from(keys)
}

function getDetailGroupingKeys(detail: WipRepairWorkOrderDetailRecord) {
  if (!isWaitingWorkOrder(detail.wo) && normalizeValue(detail.wo).toLowerCase() !== "waiting") {
    return [normalizeValue(detail.wo)]
  }

  const keys = new Set<string>()
  const tireSn = normalizeTireSn(detail.tire_sn)
  const idWo = normalizeValue(detail.id_wo)

  if (tireSn !== "-") {
    keys.add(`WAITING_SN:${tireSn}`)
  }

  if (idWo !== "-") {
    keys.add(`WAITING_ID:${idWo}`)
  }

  return Array.from(keys)
}

function getNormalizedText(value: string | null | undefined) {
  return normalizeValue(value).toLowerCase()
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function HighlightText({ value, query }: { value: string | null | undefined; query: string }) {
  const text = normalizeValue(value)
  const normalizedQuery = query.trim()

  if (!normalizedQuery) {
    return text
  }

  const parts = text.split(new RegExp(`(${escapeRegExp(normalizedQuery)})`, "ig"))

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === normalizedQuery.toLowerCase() ? (
          <mark key={`${part}-${index}`} className="rounded bg-yellow-200 px-0.5 text-yellow-950 dark:bg-yellow-400/30 dark:text-yellow-100">
            {part}
          </mark>
        ) : (
          <Fragment key={`${part}-${index}`}>{part}</Fragment>
        )
      )}
    </>
  )
}

function MultiSelectFilter({
  title,
  placeholder,
  options,
  value,
  onChange,
}: {
  title: string
  placeholder: string
  options: MultiSelectOption[]
  value: string[]
  onChange: (nextValue: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const selectedSet = useMemo(() => new Set(value), [value])
  const selectedLabels = options.filter((option) => selectedSet.has(option.value)).map((option) => option.label)
  const summaryText =
    selectedLabels.length === 0
      ? title
      : selectedLabels.length <= 2
        ? selectedLabels.join(", ")
        : `${selectedLabels.slice(0, 2).join(", ")} +${selectedLabels.length - 2}`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("h-10 w-full justify-between rounded-xl font-normal sm:min-w-44", selectedLabels.length === 0 && "text-muted-foreground")}
        >
          <span className="truncate text-left">{summaryText}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(420px,calc(100vw-2rem))] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <div className="flex items-center justify-between border-b px-2 py-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onChange(options.map((option) => option.value))}
            >
              Pilih Semua
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onChange([])}>
              Kosongkan
            </Button>
          </div>
          <CommandList>
            <CommandEmpty>Data tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedSet.has(option.value)

                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      const next = new Set(value)

                      if (next.has(option.value)) {
                        next.delete(option.value)
                      } else {
                        next.add(option.value)
                      }

                      onChange(Array.from(next))
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
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

function formatQty(value: string | null, smu: string | null) {
  const normalizedValue = normalizeValue(value)
  const normalizedSmu = normalizeValue(smu)

  if (normalizedValue === "-") {
    return "-"
  }

  const parsed = Number(normalizedValue)
  const formattedValue = Number.isFinite(parsed)
    ? parsed.toLocaleString("id-ID", { maximumFractionDigits: 2 })
    : normalizedValue

  return normalizedSmu === "-" ? formattedValue : `${formattedValue} ${normalizedSmu}`
}

function parseMinutes(value: string | null) {
  const normalizedValue = normalizeValue(value)

  if (normalizedValue === "-") {
    return null
  }

  const parsed = Number(normalizedValue)

  if (!Number.isFinite(parsed)) {
    return null
  }

  return parsed
}

function formatDurationFromMinutes(value: number) {
  const totalMinutes = Math.max(0, Math.round(value))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0 && minutes > 0) {
    return `${hours.toLocaleString("id-ID")} jam ${minutes.toLocaleString("id-ID")} menit`
  }

  if (hours > 0) {
    return `${hours.toLocaleString("id-ID")} jam`
  }

  return `${minutes.toLocaleString("id-ID")} menit`
}

function formatMinutes(value: string | null) {
  const parsed = parseMinutes(value)

  if (parsed === null) {
    const normalizedValue = normalizeValue(value)

    if (normalizedValue !== "-") {
      return normalizedValue
    }

    return "-"
  }

  return formatDurationFromMinutes(parsed)
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

function getDetailSortValue(detail: WipRepairWorkOrderDetailRecord) {
  const parsed = Number(detail.id_job)

  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER
}

export function WipRepairTable({ data, workOrderDetails }: WipRepairTableProps) {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER)
  const [storeLocFilter, setStoreLocFilter] = useState(ALL_FILTER)
  const [siteFilter, setSiteFilter] = useState(ALL_FILTER)
  const [brandFilter, setBrandFilter] = useState(ALL_FILTER)
  const [customerFilters, setCustomerFilters] = useState<string[]>([])
  const [sizeFilters, setSizeFilters] = useState<string[]>([])
  const [injuryFilters, setInjuryFilters] = useState<string[]>([])
  const [expandedWorkOrders, setExpandedWorkOrders] = useState<Set<string>>(() => new Set())

  const detailsByWorkOrder = useMemo(() => {
    const grouped = workOrderDetails.reduce<Record<string, WipRepairWorkOrderDetailRecord[]>>((accumulator, detail) => {
      const keys = getDetailGroupingKeys(detail)

      if (keys.length === 0) {
        return accumulator
      }

      for (const key of keys) {
        accumulator[key] ??= []
        accumulator[key].push(detail)
      }

      return accumulator
    }, {})

    for (const details of Object.values(grouped)) {
      details.sort((left, right) => {
        const sortDiff = getDetailSortValue(left) - getDetailSortValue(right)

        if (sortDiff !== 0) {
          return sortDiff
        }

        return normalizeValue(left.id_job).localeCompare(normalizeValue(right.id_job))
      })
    }

    return grouped
  }, [workOrderDetails])

  const statusOptions = useMemo(
    () => Array.from(new Set(data.map((item) => normalizeValue(item.status)).filter((item) => item !== "-"))).sort(),
    [data]
  )
  const storeLocOptions = useMemo(
    () => Array.from(new Set(data.map((item) => normalizeValue(item.store_loc)).filter((item) => item !== "-"))).sort(),
    [data]
  )
  const siteOptions = useMemo(
    () => Array.from(new Set(data.map((item) => normalizeValue(item.site)).filter((item) => item !== "-"))).sort(),
    [data]
  )
  const brandOptions = useMemo(
    () => Array.from(new Set(data.map((item) => normalizeWipRepairBrand(item.brand)).filter((item) => item !== "-"))).sort(),
    [data]
  )
  const customerOptions = useMemo<MultiSelectOption[]>(
    () => Array.from(new Set(data.map((item) => normalizeValue(item.customer)).filter((item) => item !== "-"))).sort().map((value) => ({ value, label: value })),
    [data]
  )
  const sizeOptions = useMemo<MultiSelectOption[]>(
    () => Array.from(new Set(data.map((item) => normalizeValue(item.size)).filter((item) => item !== "-"))).sort().map((value) => ({ value, label: value })),
    [data]
  )
  const injuryOptions = useMemo<MultiSelectOption[]>(
    () => Array.from(new Set(data.map((item) => normalizeValue(item.injury)).filter((item) => item !== "-"))).sort().map((value) => ({ value, label: value })),
    [data]
  )

  const filteredData = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return data
      .filter((item) => {
        const details = getDetailLookupKeys(item).flatMap((key) => detailsByWorkOrder[key] ?? [])
        const matchesQuery =
          normalizedQuery.length === 0 ||
          [
            item.wo,
            item.tire_sn,
            item.customer,
            item.site,
            item.brand,
            normalizeWipRepairBrand(item.brand),
            item.pattern,
            item.injury,
            item.receiver,
            item.store_loc,
          ]
            .map((value) => getNormalizedText(value))
            .some((value) => value.includes(normalizedQuery)) ||
          details.some((detail) =>
            [
              detail.id_job,
              detail.job,
              detail.material_id,
              detail.material_name,
              detail.category,
              detail.smu,
              detail.qty,
              detail.time,
            ]
              .map((value) => getNormalizedText(value))
              .some((value) => value.includes(normalizedQuery))
          )

        const matchesStatus = statusFilter === ALL_FILTER || normalizeValue(item.status) === statusFilter
        const matchesStoreLoc = storeLocFilter === ALL_FILTER || normalizeValue(item.store_loc) === storeLocFilter
        const matchesSite = siteFilter === ALL_FILTER || normalizeValue(item.site) === siteFilter
        const matchesBrand = brandFilter === ALL_FILTER || normalizeWipRepairBrand(item.brand) === brandFilter
        const matchesCustomer = customerFilters.length === 0 || customerFilters.includes(normalizeValue(item.customer))
        const matchesSize = sizeFilters.length === 0 || sizeFilters.includes(normalizeValue(item.size))
        const matchesInjury = injuryFilters.length === 0 || injuryFilters.includes(normalizeValue(item.injury))

        return matchesQuery && matchesStatus && matchesStoreLoc && matchesSite && matchesBrand && matchesCustomer && matchesSize && matchesInjury
      })
      .sort((left, right) => getSortTimestamp(right) - getSortTimestamp(left))
  }, [brandFilter, customerFilters, data, detailsByWorkOrder, injuryFilters, query, siteFilter, sizeFilters, statusFilter, storeLocFilter])

  function toggleWorkOrder(wo: string) {
    setExpandedWorkOrders((current) => {
      const next = new Set(current)

      if (next.has(wo)) {
        next.delete(wo)
      } else {
        next.add(wo)
      }

      return next
    })
  }

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
                placeholder="Cari WO, store loc, tire SN, customer, site, atau brand"
                className="h-10 rounded-xl pl-9"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
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

              <Select value={storeLocFilter} onValueChange={setStoreLocFilter}>
                <SelectTrigger className="h-10 w-full rounded-xl sm:min-w-40">
                  <SelectValue placeholder="Semua store loc" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>Semua store loc</SelectItem>
                  {storeLocOptions.map((option) => (
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

              <MultiSelectFilter
                title="Semua customer"
                placeholder="Cari customer..."
                options={customerOptions}
                value={customerFilters}
                onChange={setCustomerFilters}
              />

              <MultiSelectFilter
                title="Semua size"
                placeholder="Cari size..."
                options={sizeOptions}
                value={sizeFilters}
                onChange={setSizeFilters}
              />

              <MultiSelectFilter
                title="Semua injury"
                placeholder="Cari injury..."
                options={injuryOptions}
                value={injuryFilters}
                onChange={setInjuryFilters}
              />
            </div>
          </div>
          {storeLocFilter !== ALL_FILTER || customerFilters.length > 0 || sizeFilters.length > 0 || injuryFilters.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {[
                ...(storeLocFilter !== ALL_FILTER ? [{ type: "Store Loc", value: storeLocFilter, onClear: () => setStoreLocFilter(ALL_FILTER) }] : []),
                ...customerFilters.map((value) => ({ type: "Customer", value, onClear: () => setCustomerFilters(customerFilters.filter((item) => item !== value)) })),
                ...sizeFilters.map((value) => ({ type: "Size", value, onClear: () => setSizeFilters(sizeFilters.filter((item) => item !== value)) })),
                ...injuryFilters.map((value) => ({ type: "Injury", value, onClear: () => setInjuryFilters(injuryFilters.filter((item) => item !== value)) }))].map((filter) => (
                <Badge key={`${filter.type}-${filter.value}`} variant="secondary" className="gap-1 rounded-full px-2.5 py-1">
                  <span>{filter.type}: {filter.value}</span>
                  <button type="button" className="rounded-full p-0.5 hover:bg-background/80" onClick={filter.onClear} aria-label={`Hapus filter ${filter.type} ${filter.value}`}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-2xl border-border/60 py-0 shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-12 px-4 py-3" aria-label="Detail pekerjaan" />
                <TableHead className="px-4 py-3">Store Loc</TableHead>
                <TableHead className="px-4 py-3">WO</TableHead>
                <TableHead className="px-4 py-3">Status</TableHead>
                <TableHead className="px-4 py-3">Customer / Site</TableHead>
                <TableHead className="px-4 py-3">Tire SN</TableHead>
                <TableHead className="px-4 py-3">Brand / Pattern</TableHead>
                <TableHead className="px-4 py-3">Size</TableHead>
                <TableHead className="px-4 py-3">Injury</TableHead>
                <TableHead className="px-4 py-3">Total Waktu</TableHead>
                <TableHead className="px-4 py-3">Received</TableHead>
                <TableHead className="px-4 py-3">WO Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length > 0 ? (
                filteredData.map((item) => {
                  const workOrder = normalizeValue(item.wo)
                  const detailKey = getWorkOrderDetailKey(item)
                  const details = getDetailLookupKeys(item).flatMap((key) => detailsByWorkOrder[key] ?? [])
                  const normalizedQuery = query.trim().toLowerCase()
                  const hasSearch = normalizedQuery.length > 0
                  const isSearchMatched = hasSearch && [
                    item.wo,
                    item.tire_sn,
                    item.customer,
                    item.site,
                    item.brand,
                    normalizeWipRepairBrand(item.brand),
                    item.pattern,
                    item.injury,
                    item.receiver,
                    item.store_loc,
                  ].map((value) => getNormalizedText(value)).some((value) => value.includes(normalizedQuery))
                  const matchingDetailIds = new Set(
                    hasSearch
                      ? details
                        .filter((detail) =>
                          [
                            detail.id_job,
                            detail.job,
                            detail.material_id,
                            detail.material_name,
                            detail.category,
                            detail.smu,
                            detail.qty,
                            detail.time,
                          ]
                            .map((value) => getNormalizedText(value))
                            .some((value) => value.includes(normalizedQuery))
                        )
                        .map((detail) => detail.id_job)
                      : []
                  )
                  const isExpanded = expandedWorkOrders.has(detailKey) || (hasSearch && details.length > 0 && (isSearchMatched || matchingDetailIds.size > 0))
                  const totalMinutes = details.reduce((sum, detail) => sum + (parseMinutes(detail.time) ?? 0), 0)

                  return (
                    <Fragment key={item.id_wo}>
                      <TableRow>
                        <TableCell className="px-4 py-3">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            disabled={details.length === 0}
                            aria-expanded={isExpanded}
                            aria-label={`Detail pekerjaan WO ${workOrder} ${normalizeTireSn(item.tire_sn)}`}
                            onClick={() => toggleWorkOrder(detailKey)}
                          >
                            <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                          </Button>
                        </TableCell>
                        <TableCell className="px-4 py-3 font-medium">{normalizeValue(item.store_loc)}</TableCell>
                        <TableCell className="px-4 py-3 font-medium tabular-nums">{workOrder}</TableCell>
                        <TableCell className="px-4 py-3">
                          <Badge variant="outline" className={cn("rounded-full px-2.5 py-1 text-xs font-medium", getStatusClasses(item.status))}>
                            {normalizeValue(item.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium">{normalizeValue(item.customer)}</span>
                            <span className="text-xs text-muted-foreground">{normalizeValue(item.site)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 font-mono text-xs">{normalizeTireSn(item.tire_sn)}</TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium">{normalizeWipRepairBrand(item.brand)}</span>
                            <span className="text-xs text-muted-foreground">{normalizeValue(item.pattern)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">{normalizeValue(item.size)}</TableCell>
                        <TableCell className="px-4 py-3">{normalizeValue(item.injury)}</TableCell>
                        <TableCell className="px-4 py-3 font-medium tabular-nums">
                          {details.length > 0 ? formatDurationFromMinutes(totalMinutes) : "-"}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-muted-foreground">{formatDate(item.received_date)}</TableCell>
                        <TableCell className="px-4 py-3 text-muted-foreground">{formatDate(item.wo_date)}</TableCell>
                      </TableRow>
                      {isExpanded ? (
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={12} className="px-4 py-4">
                            <div className="rounded-xl border bg-background p-4">
                              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="font-medium">Detail pekerjaan WO {workOrder}</p>
                                  {isWaitingWorkOrder(item.wo) ? (
                                    <p className="text-sm text-muted-foreground">Tire SN {normalizeTireSn(item.tire_sn)}</p>
                                  ) : null}
                                  <p className="text-sm text-muted-foreground">
                                    {details.length.toLocaleString("id-ID")} aktivitas pekerjaan dan material dari API detail.
                                  </p>
                                </div>
                              </div>

                              <div className="overflow-x-auto rounded-lg border">
                                <Table>
                                  <TableHeader className="bg-muted/40">
                                    <TableRow>
                                      <TableHead className="px-3 py-2">Job ID</TableHead>
                                      <TableHead className="px-3 py-2">Pekerjaan</TableHead>
                                      <TableHead className="px-3 py-2">Material</TableHead>
                                      <TableHead className="px-3 py-2">Kategori</TableHead>
                                      <TableHead className="px-3 py-2">Qty</TableHead>
                                      <TableHead className="px-3 py-2">Waktu</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {details.map((detail) => (
                                      <TableRow key={detail.id_job} className={cn(matchingDetailIds.has(detail.id_job) && "bg-yellow-50/80 dark:bg-yellow-400/10")}>
                                        <TableCell className="px-3 py-2 font-mono text-xs">
                                          <HighlightText value={detail.id_job} query={query} />
                                        </TableCell>
                                        <TableCell className="px-3 py-2 font-medium">
                                          <HighlightText value={detail.job} query={query} />
                                        </TableCell>
                                        <TableCell className="px-3 py-2">
                                          <HighlightText value={detail.material_name} query={query} />
                                        </TableCell>
                                        <TableCell className="px-3 py-2">
                                          <HighlightText value={detail.category} query={query} />
                                        </TableCell>
                                        <TableCell className="px-3 py-2 tabular-nums">
                                          <HighlightText value={formatQty(detail.qty, detail.smu)} query={query} />
                                        </TableCell>
                                        <TableCell className="px-3 py-2 tabular-nums text-muted-foreground">
                                          <HighlightText value={formatMinutes(detail.time)} query={query} />
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={12} className="h-40 px-4 py-3 text-center">
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
