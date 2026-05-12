"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardCopy, Search, Wrench, X, Download, Filter } from "lucide-react"
import { toast } from "sonner"
import * as xlsx from "xlsx"

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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { buildWipRepairSapCopyText, countWipRepairSapCopyRows, resolveWipRepairSite, resolveWipRepairSiteCode } from "@/lib/wip-repair-sap-copy"
import type { WipRepairRecord, WipRepairWorkOrderDetailRecord } from "@/lib/types/wip-repair"

type WipRepairTableProps = {
  data: WipRepairRecord[]
  workOrderDetails: WipRepairWorkOrderDetailRecord[]
  invoiceMappings: Record<string, { noInv: string | null; tanggalInvoice: string | null }>
  pmoMappings: Record<string, { actualTotalRevenue: number | null; actualTotalCost: number | null; systemStatus: string | null; poNumber: string | null; poDate: string | null; poCustomer: string | null }>
  repairMasterItems: RepairMasterLookupItem[]
  repairMasterSites: RepairMasterLookupSite[]
}

type RepairMasterLookupItem = {
  materialCode: string | null
  materialName: string | null
  uom?: string | null
}

type RepairMasterLookupSite = {
  siteCode: string | null
  siteName: string | null
}

const ALL_FILTER = "__all__"
const TECO_DONE = "TECO_DONE"
const TECO_PENDING = "TECO_PENDING"
const MIGO_DONE = "MIGO_DONE"
const MIGO_PENDING = "MIGO_PENDING"
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
const DETAIL_JOB_ORDER = [
  "SKIVING",
  "BUFFING",
  "DIMENSI LUKA",
  "CEMENTING",
  "BUFFING INNERLINNER",
  "INSTAL PATCH",
  "BUILT UP",
  "CURING",
  "FINISHING",
  "PAINTING",
] as const
const DETAIL_JOB_ORDER_INDEX = new Map<string, number>(DETAIL_JOB_ORDER.map((job, index) => [job, index]))

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

function normalizeDetailJob(value: string | null | undefined) {
  return normalizeValue(value)
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/\bINSTALL\b/g, "INSTAL")
    .replace(/\bINNERLINER\b/g, "INNERLINNER")
    .replace(/\bBUILTUP\b/g, "BUILT UP")
    .trim()
}

function hasVisibleDetailData(detail: WipRepairWorkOrderDetailRecord) {
  return [
    detail.job,
    detail.material_id,
    detail.material_name,
    detail.category,
    detail.qty,
    detail.time,
    detail.date,
    detail.person,
  ].some((value) => normalizeValue(value) !== "-")
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

function formatExportDate(value: string | null | undefined) {
  if (!value || value === "-") {
    return "-"
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  const dd = String(parsed.getDate()).padStart(2, "0")
  const MM = String(parsed.getMonth() + 1).padStart(2, "0")
  const yyyy = parsed.getFullYear()

  return `${dd}.${MM}.${yyyy}`
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

function hasActualValue(value: number | null | undefined) {
  return value !== null && value !== undefined && Number.isFinite(value) && value !== 0
}

function formatCurrency(value: number | null | undefined) {
  if (!hasActualValue(value)) {
    return "-"
  }

  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value ?? 0)
}

function getTecoStatus(mapping: { actualTotalRevenue: number | null; actualTotalCost: number | null; systemStatus: string | null; poNumber: string | null; poDate: string | null; poCustomer: string | null } | undefined) {
  if (!mapping) {
    return null
  }

  return normalizeValue(mapping.systemStatus).toUpperCase().includes("REL") ? TECO_PENDING : TECO_DONE
}

function getMigoStatus(mapping: { actualTotalRevenue: number | null; actualTotalCost: number | null; systemStatus: string | null; poNumber: string | null; poDate: string | null; poCustomer: string | null } | undefined) {
  if (!hasActualValue(mapping?.actualTotalRevenue)) {
    return null
  }

  return hasActualValue(mapping?.actualTotalCost) ? MIGO_DONE : MIGO_PENDING
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
  const orderedJobIndex = DETAIL_JOB_ORDER_INDEX.get(normalizeDetailJob(detail.job))

  if (orderedJobIndex !== undefined) {
    return orderedJobIndex
  }

  const parsed = Number(detail.id_job)

  return Number.isFinite(parsed) ? DETAIL_JOB_ORDER.length + parsed : Number.MAX_SAFE_INTEGER
}

async function copyTextToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }
  } catch {
    // Some embedded browsers reject the Clipboard API; fall back below.
  }

  const textArea = document.createElement("textarea")
  textArea.value = text
  textArea.setAttribute("readonly", "true")
  textArea.style.position = "fixed"
  textArea.style.top = "-9999px"
  textArea.style.left = "-9999px"
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()

  const copied = document.execCommand("copy")
  document.body.removeChild(textArea)

  if (!copied) {
    throw new Error("Clipboard copy command failed")
  }
}

export function WipRepairTable({ data, workOrderDetails, invoiceMappings, pmoMappings, repairMasterItems, repairMasterSites }: WipRepairTableProps) {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState(ALL_FILTER)
  const [storeLocFilter, setStoreLocFilter] = useState(ALL_FILTER)
  const [siteFilter, setSiteFilter] = useState(ALL_FILTER)
  const [brandFilter, setBrandFilter] = useState(ALL_FILTER)
  const [customerFilters, setCustomerFilters] = useState<string[]>([])
  const [sizeFilters, setSizeFilters] = useState<string[]>([])
  const [injuryFilters, setInjuryFilters] = useState<string[]>([])
  const [invoiceFilter, setInvoiceFilter] = useState(ALL_FILTER)
  const [tecoFilter, setTecoFilter] = useState(ALL_FILTER)
  const [migoFilter, setMigoFilter] = useState(ALL_FILTER)
  const [woFilters, setWoFilters] = useState<string[]>([])
  const [woPasteOpen, setWoPasteOpen] = useState(false)
  const [woPasteText, setWoPasteText] = useState("")
  const [expandedWorkOrders, setExpandedWorkOrders] = useState<Set<string>>(() => new Set())
  const [copiedSapKey, setCopiedSapKey] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(25)

  const detailsByWorkOrder = useMemo(() => {
    const grouped = workOrderDetails.reduce<Record<string, WipRepairWorkOrderDetailRecord[]>>((accumulator, detail) => {
      const keys = getDetailGroupingKeys(detail)

      if (keys.length === 0) {
        return accumulator
      }

      for (const key of keys) {
        accumulator[key] ??= []
        if (hasVisibleDetailData(detail)) {
          accumulator[key].push(detail)
        }
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
    () => Array.from(new Set(data.map((item) => normalizeValue(resolveWipRepairSiteCode(item, repairMasterSites))).filter((item) => item !== "-"))).sort(),
    [data, repairMasterSites]
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
            item.inspector,
            item.createby,
            item.store_loc,
            resolveWipRepairSiteCode(item, repairMasterSites),
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
              detail.date,
              detail.person,
            ]
              .map((value) => getNormalizedText(value))
              .some((value) => value.includes(normalizedQuery))
          )

        const matchesStatus = statusFilter === ALL_FILTER || normalizeValue(item.status) === statusFilter
        const matchesStoreLoc = storeLocFilter === ALL_FILTER || normalizeValue(resolveWipRepairSiteCode(item, repairMasterSites)) === storeLocFilter
        const matchesSite = siteFilter === ALL_FILTER || normalizeValue(item.site) === siteFilter
        const matchesBrand = brandFilter === ALL_FILTER || normalizeWipRepairBrand(item.brand) === brandFilter
        const matchesCustomer = customerFilters.length === 0 || customerFilters.includes(normalizeValue(item.customer))
        const matchesSize = sizeFilters.length === 0 || sizeFilters.includes(normalizeValue(item.size))
        const matchesInjury = injuryFilters.length === 0 || injuryFilters.includes(normalizeValue(item.injury))
        
        const workOrder = normalizeValue(item.wo)
        const pmoMapping = pmoMappings[workOrder]
        const isTecoMatched = tecoFilter === ALL_FILTER || getTecoStatus(pmoMapping) === tecoFilter
        const isMigoMatched = migoFilter === ALL_FILTER || getMigoStatus(pmoMapping) === migoFilter
        const isInvoiceMatched = invoiceFilter === ALL_FILTER || (invoiceFilter === "INVOICED" ? !!invoiceMappings[workOrder]?.noInv : !invoiceMappings[workOrder]?.noInv)
        const isWoMatched = woFilters.length === 0 || woFilters.includes(workOrder)

        return matchesQuery && matchesStatus && matchesStoreLoc && matchesSite && matchesBrand && matchesCustomer && matchesSize && matchesInjury && isTecoMatched && isMigoMatched && isInvoiceMatched && isWoMatched
      })
      .sort((left, right) => getSortTimestamp(right) - getSortTimestamp(left))
  }, [brandFilter, customerFilters, data, detailsByWorkOrder, injuryFilters, invoiceFilter, invoiceMappings, migoFilter, pmoMappings, query, repairMasterSites, siteFilter, sizeFilters, statusFilter, storeLocFilter, tecoFilter, woFilters])

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const pageStartIndex = (safePage - 1) * pageSize
  const pageEndIndex = Math.min(pageStartIndex + pageSize, filteredData.length)
  const paginatedData = filteredData.slice(pageStartIndex, pageEndIndex)
  const displayStart = filteredData.length > 0 ? pageStartIndex + 1 : 0

  useEffect(() => {
    setCurrentPage(1)
  }, [query, statusFilter, storeLocFilter, siteFilter, brandFilter, customerFilters, sizeFilters, injuryFilters, invoiceFilter, tecoFilter, migoFilter, woFilters, pageSize])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

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

  async function copySapFormat(item: WipRepairRecord, details: WipRepairWorkOrderDetailRecord[], detailKey: string) {
    const text = buildWipRepairSapCopyText({
      workOrder: item,
      details,
      repairMasterItems,
      repairMasterSites,
    })
    const rowCount = countWipRepairSapCopyRows(details, repairMasterItems)

    if (rowCount === 0) {
      toast.error("Tidak ada material yang cocok untuk format SAP")
      return
    }

    try {
      await copyTextToClipboard(text)
      setCopiedSapKey(detailKey)
      window.setTimeout(() => {
        setCopiedSapKey((current) => (current === detailKey ? null : current))
      }, 2500)
      toast.success(`${rowCount.toLocaleString("id-ID")} baris material SAP disalin`)
    } catch (error) {
      console.error("Copy SAP format failed:", error)
      toast.error("Gagal menyalin format SAP")
    }
  }

  function handleApplyWoPaste() {
    const rawWos = woPasteText.split(/\r?\n|,|\t/).map((w) => w.trim()).filter(Boolean)
    const uniqueWos = Array.from(new Set(rawWos))
    setWoFilters(uniqueWos)
    setWoPasteOpen(false)
    if (uniqueWos.length > 0) {
      toast.success(`${uniqueWos.length} WO berhasil difilter`)
    }
  }

  function handleExport() {
    if (filteredData.length === 0) {
      toast.error("Tidak ada data untuk diekspor")
      return
    }

    const exportData = filteredData.map((item) => {
      const workOrder = normalizeValue(item.wo)
      const details = getDetailLookupKeys(item).flatMap((key) => detailsByWorkOrder[key] ?? [])

      const inspectDate = formatExportDate(item.inspect_date)
      
      let finishDate = "-"
      if (details.length > 0) {
        // Since details are already sorted by id_job ascending, the last one is the latest job id
        const latestDetail = details[details.length - 1]
        finishDate = formatExportDate(latestDetail.date)
      }

      const invoiceDate = formatExportDate(invoiceMappings[workOrder]?.tanggalInvoice)
      const pmoMapping = pmoMappings[workOrder]

      return {
        "WO": workOrder,
        "Start Date": inspectDate,
        "Finish Date": finishDate,
        "Invoice Date": invoiceDate,
        "Actual Total Revenue": pmoMapping?.actualTotalRevenue ?? 0,
        "Actual Total Cost": pmoMapping?.actualTotalCost ?? 0,
        "System Status": normalizeValue(pmoMapping?.systemStatus),
        "PO Number": normalizeValue(pmoMapping?.poNumber),
        "PO Date": formatExportDate(pmoMapping?.poDate),
      }
    })

    const worksheet = xlsx.utils.json_to_sheet(exportData)
    const workbook = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(workbook, worksheet, "WIP Repair")

    const timestamp = new Date().toISOString().split("T")[0]
    xlsx.writeFile(workbook, `WIP_Repair_Export_${timestamp}.xlsx`)
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="rounded-2xl border-border/60 py-0 shadow-sm">
        <CardContent className="px-4 py-4 md:px-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari WO, site code, tire SN, customer, site, atau brand"
                  className="h-10 rounded-xl pl-9"
                />
              </div>
              
              <Dialog open={woPasteOpen} onOpenChange={(open) => {
                setWoPasteOpen(open)
                if (open) setWoPasteText(woFilters.join("\n"))
              }}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" className="h-10 rounded-xl shrink-0">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter WO
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Bulk Filter WO</DialogTitle>
                  </DialogHeader>
                  <div className="py-4">
                    <p className="text-sm text-muted-foreground mb-3">Paste Nomor WO (bisa dipisahkan dengan enter, koma, atau tab).</p>
                    <Textarea 
                      value={woPasteText}
                      onChange={(e) => setWoPasteText(e.target.value)}
                      placeholder="WO/26/0001&#10;WO/26/0002"
                      className="min-h-[150px] resize-y"
                    />
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => { setWoFilters([]); setWoPasteOpen(false); setWoPasteText(""); }}>Reset</Button>
                    <Button onClick={handleApplyWoPaste}>Apply Filter</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button type="button" variant="outline" className="h-10 rounded-xl shrink-0" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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

              <Select value={invoiceFilter} onValueChange={setInvoiceFilter}>
                <SelectTrigger className="h-10 w-full rounded-xl sm:min-w-40">
                  <SelectValue placeholder="Semua Invoice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>Semua Invoice</SelectItem>
                  <SelectItem value="INVOICED">Sudah Invoice</SelectItem>
                  <SelectItem value="NOT_INVOICED">Belum Invoice</SelectItem>
                </SelectContent>
              </Select>

              <Select value={tecoFilter} onValueChange={setTecoFilter}>
                <SelectTrigger className="h-10 w-full rounded-xl sm:min-w-40">
                  <SelectValue placeholder="Semua TECO" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>Semua TECO</SelectItem>
                  <SelectItem value={TECO_DONE}>Sudah TECO</SelectItem>
                  <SelectItem value={TECO_PENDING}>Belum TECO</SelectItem>
                </SelectContent>
              </Select>

              <Select value={migoFilter} onValueChange={setMigoFilter}>
                <SelectTrigger className="h-10 w-full rounded-xl sm:min-w-40">
                  <SelectValue placeholder="Semua MIGO" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>Semua MIGO</SelectItem>
                  <SelectItem value={MIGO_DONE}>Sudah MIGO</SelectItem>
                  <SelectItem value={MIGO_PENDING}>Belum MIGO</SelectItem>
                </SelectContent>
              </Select>

              <Select value={storeLocFilter} onValueChange={setStoreLocFilter}>
                <SelectTrigger className="h-10 w-full rounded-xl sm:min-w-40">
                  <SelectValue placeholder="Semua site code" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>Semua site code</SelectItem>
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
          {storeLocFilter !== ALL_FILTER || invoiceFilter !== ALL_FILTER || tecoFilter !== ALL_FILTER || migoFilter !== ALL_FILTER || customerFilters.length > 0 || sizeFilters.length > 0 || injuryFilters.length > 0 || woFilters.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {[
                ...(storeLocFilter !== ALL_FILTER ? [{ type: "Site Code", value: storeLocFilter, onClear: () => setStoreLocFilter(ALL_FILTER) }] : []),
                ...(invoiceFilter !== ALL_FILTER ? [{ type: "Invoice", value: invoiceFilter === "INVOICED" ? "Sudah Invoice" : "Belum Invoice", onClear: () => setInvoiceFilter(ALL_FILTER) }] : []),
                ...(tecoFilter !== ALL_FILTER ? [{ type: "TECO", value: tecoFilter === TECO_DONE ? "Sudah TECO" : "Belum TECO", onClear: () => setTecoFilter(ALL_FILTER) }] : []),
                ...(migoFilter !== ALL_FILTER ? [{ type: "MIGO", value: migoFilter === MIGO_DONE ? "Sudah MIGO" : "Belum MIGO", onClear: () => setMigoFilter(ALL_FILTER) }] : []),
                ...(woFilters.length > 0 ? [{ type: "WO", value: `${woFilters.length} WO`, onClear: () => setWoFilters([]) }] : []),
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
                <TableHead className="px-4 py-3">Site Code</TableHead>
                <TableHead className="px-4 py-3">WO</TableHead>
                <TableHead className="px-4 py-3">Status</TableHead>
                <TableHead className="px-4 py-3">Customer / Site</TableHead>
                <TableHead className="px-4 py-3">Tire SN</TableHead>
                <TableHead className="px-4 py-3">Brand / Pattern</TableHead>
                <TableHead className="px-4 py-3">Size</TableHead>
                <TableHead className="px-4 py-3">Injury</TableHead>
                <TableHead className="px-4 py-3">Total Waktu</TableHead>
                <TableHead className="px-4 py-3">No Inv</TableHead>
                <TableHead className="px-4 py-3">Tanggal Invoice</TableHead>
                <TableHead className="px-4 py-3">PO Number</TableHead>
                <TableHead className="px-4 py-3">PO Date</TableHead>
                <TableHead className="px-4 py-3">Actual Total Revenue</TableHead>
                <TableHead className="px-4 py-3">Actual Total Cost</TableHead>
                <TableHead className="px-4 py-3">Inspect</TableHead>
                <TableHead className="px-4 py-3">Created By</TableHead>
                <TableHead className="px-4 py-3">Received / Receiver</TableHead>
                <TableHead className="px-4 py-3">WO Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length > 0 ? (
                paginatedData.map((item) => {
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
                    item.inspector,
                    item.createby,
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
                            detail.date,
                            detail.person,
                          ]
                            .map((value) => getNormalizedText(value))
                            .some((value) => value.includes(normalizedQuery))
                        )
                        .map((detail) => detail.id_job)
                      : []
                  )
                  const isExpanded = expandedWorkOrders.has(detailKey) || (hasSearch && details.length > 0 && (isSearchMatched || matchingDetailIds.size > 0))
                  const totalMinutes = details.reduce((sum, detail) => sum + (parseMinutes(detail.time) ?? 0), 0)
                  const sapCopyRowCount = countWipRepairSapCopyRows(details, repairMasterItems)
                  const isSapCopied = copiedSapKey === detailKey
                  const siteInfo = resolveWipRepairSite(item, repairMasterSites)
                  const pmoMapping = pmoMappings[workOrder]

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
                        <TableCell className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium">{normalizeValue(siteInfo.siteCode)}</span>
                            <span className="text-xs text-muted-foreground">{normalizeValue(siteInfo.siteName)}</span>
                          </div>
                        </TableCell>
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
                        <TableCell className="px-4 py-3">{normalizeValue(invoiceMappings[workOrder]?.noInv)}</TableCell>
                        <TableCell className="px-4 py-3">{formatDate(invoiceMappings[workOrder]?.tanggalInvoice || null)}</TableCell>
                        <TableCell className="px-4 py-3 font-mono text-xs">{normalizeValue(pmoMapping?.poNumber)}</TableCell>
                        <TableCell className="px-4 py-3">{formatDate(pmoMapping?.poDate || null)}</TableCell>
                        <TableCell className="px-4 py-3 font-medium tabular-nums">{formatCurrency(pmoMapping?.actualTotalRevenue)}</TableCell>
                        <TableCell className="px-4 py-3 font-medium tabular-nums">{formatCurrency(pmoMapping?.actualTotalCost)}</TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-medium">{formatDate(item.inspect_date)}</span>
                            <span className="text-xs text-muted-foreground">{normalizeValue(item.inspector)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-muted-foreground">{normalizeValue(item.createby)}</TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-muted-foreground">{formatDate(item.received_date)}</span>
                            <span className="text-xs text-muted-foreground">{normalizeValue(item.receiver)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-muted-foreground">{formatDate(item.wo_date)}</TableCell>
                      </TableRow>
                      {isExpanded ? (
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={20} className="px-4 py-4">
                            <div className="rounded-xl border bg-background p-4">
                              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                                <Button
                                  type="button"
                                  variant={isSapCopied ? "default" : "outline"}
                                  size="sm"
                                  className="w-fit gap-2 rounded-lg"
                                  disabled={sapCopyRowCount === 0}
                                  onClick={() => copySapFormat(item, details, detailKey)}
                                >
                                  {isSapCopied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
                                  {isSapCopied ? "Berhasil dicopy" : "Copy SAP"}
                                </Button>
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
                                      <TableHead className="px-3 py-2">Tanggal</TableHead>
                                      <TableHead className="px-3 py-2">Dikerjakan Oleh</TableHead>
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
                                        <TableCell className="px-3 py-2 text-muted-foreground">
                                          <HighlightText value={formatDate(detail.date ?? null)} query={query} />
                                        </TableCell>
                                        <TableCell className="px-3 py-2 text-muted-foreground">
                                          <HighlightText value={detail.person ?? null} query={query} />
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
                  <TableCell colSpan={20} className="h-40 px-4 py-3 text-center">
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

      <div className="flex flex-col gap-3 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p>
          Menampilkan{" "}
          <span className="tabular-nums">
            {displayStart.toLocaleString("id-ID")}-{pageEndIndex.toLocaleString("id-ID")}
          </span>{" "}
          dari <span className="tabular-nums">{filteredData.length.toLocaleString("id-ID")}</span> data terfilter
          <span className="tabular-nums"> (total {data.length.toLocaleString("id-ID")} data)</span>
        </p>
        <div className="flex flex-wrap items-center gap-2 md:justify-end md:pr-24">
          <Select
            value={String(pageSize)}
            onValueChange={(value) => setPageSize(Number(value) as (typeof PAGE_SIZE_OPTIONS)[number])}
          >
            <SelectTrigger className="h-9 w-[116px] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option} / halaman
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-24 text-center tabular-nums">
              Halaman {safePage.toLocaleString("id-ID")} / {totalPages.toLocaleString("id-ID")}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              aria-label="Halaman berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}






