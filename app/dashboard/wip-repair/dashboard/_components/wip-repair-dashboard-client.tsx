"use client"

import type { ComponentType, Dispatch, SetStateAction } from "react"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Boxes,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  ClipboardList,
  Filter,
  Gauge,
  PackageSearch,
  RotateCcw,
  Search,
  TimerReset,
  Users,
  Wrench,
  X,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
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
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { WipRepairRecord, WipRepairWorkOrderDetailRecord } from "@/lib/types/wip-repair"
import { buildWipRepairDashboardData, type WipRepairDashboardData } from "@/lib/wip-repair-dashboard"
import { normalizeWipRepairBrand } from "@/lib/wip-repair-brand"

type WipRepairDashboardClientProps = {
  data: WipRepairRecord[]
  workOrderDetails: WipRepairWorkOrderDetailRecord[]
  initialDashboardData: WipRepairDashboardData
}

const CHART_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899"]

const chartConfig = {
  value: { label: "Jumlah", color: "#2563eb" },
  workOrders: { label: "WO", color: "#2563eb" },
  withWo: { label: "Sudah Ada WO", color: "#10b981" },
  waitingWo: { label: "Waiting WO", color: "#f59e0b" },
  emptyWo: { label: "WO Kosong", color: "#94a3b8" },
  jobs: { label: "Job", color: "#2563eb" },
  minutes: { label: "Menit", color: "#8b5cf6" },
  hours: { label: "Jam", color: "#8b5cf6" },
  quantity: { label: "Qty", color: "#10b981" },
  material: { label: "Material", color: "#f59e0b" },
  progress: { label: "Progress", color: "#f59e0b" },
} satisfies ChartConfig

const ALL_FILTER = "__all__"
const RECENT_PAGE_SIZE = 5

function normalizeValue(value: string | null | undefined) {
  return value?.trim() || "-"
}

function normalizeTireSn(value: string | null | undefined) {
  return normalizeValue(value).toUpperCase()
}

function parseNumber(value: string | null | undefined) {
  const normalized = normalizeValue(value)

  if (normalized === "-") {
    return 0
  }

  const parsed = Number(normalized.replace(",", "."))

  return Number.isFinite(parsed) ? parsed : 0
}

function isWaitingWorkOrder(value: string | null | undefined) {
  return normalizeValue(value).toLowerCase() === "waiting wo"
}

function isEmptyWorkOrder(value: string | null | undefined) {
  const normalized = normalizeValue(value).toLowerCase()

  return normalized === "-" || normalized === "waiting" || normalized === "n/a" || normalized === "na"
}

function hasActualWorkOrder(value: string | null | undefined) {
  return !isEmptyWorkOrder(value) && !isWaitingWorkOrder(value)
}

function isWaitingDetailWorkOrder(value: string | null | undefined) {
  const normalized = normalizeValue(value).toLowerCase()

  return normalized === "waiting wo" || normalized === "waiting"
}

function getHeaderDetailLookupKey(item: WipRepairRecord) {
  if (isWaitingWorkOrder(item.wo)) {
    const tireSn = normalizeTireSn(item.tire_sn)
    return tireSn === "-" ? `WAITING_ID:${normalizeValue(item.id_wo)}` : `WAITING_SN:${tireSn}`
  }

  return normalizeValue(item.wo)
}

function getDetailLookupKeys(detail: WipRepairWorkOrderDetailRecord) {
  if (!isWaitingDetailWorkOrder(detail.wo)) {
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

function getWorkOrderDate(item: WipRepairRecord) {
  const candidate = item.received_date || item.wo_date || item.inspect_date

  if (!candidate) {
    return null
  }

  const parsed = new Date(`${candidate}T00:00:00`)

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatMonthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`
}

function formatMonthLabel(value: string) {
  if (value === ALL_FILTER) {
    return "Semua Bulan"
  }

  const parsed = new Date(`${value}-01T00:00:00`)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("id-ID", { month: "short", year: "numeric" }).format(parsed)
}

function formatDate(value: string | null | undefined) {
  const normalized = normalizeValue(value)

  if (normalized === "-") {
    return "-"
  }

  const parsed = new Date(`${normalized}T00:00:00`)

  if (Number.isNaN(parsed.getTime())) {
    return normalized
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed)
}

function formatNumber(value: number, maximumFractionDigits = 0) {
  return value.toLocaleString("id-ID", { maximumFractionDigits })
}

function formatMinutes(value: number) {
  const totalMinutes = Math.max(0, Math.round(value))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0 && minutes > 0) {
    return `${formatNumber(hours)} jam ${formatNumber(minutes)} menit`
  }

  if (hours > 0) {
    return `${formatNumber(hours)} jam`
  }

  return `${formatNumber(minutes)} menit`
}

function buildOptions(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(normalizeValue).filter((value) => value !== "-"))).sort((left, right) =>
    left.localeCompare(right)
  )
}

function getStatusTone(status: string) {
  const normalized = status.toLowerCase()

  if (normalized.includes("progress")) {
    return "border-amber-200 bg-amber-50 text-amber-700"
  }

  if (normalized.includes("complete") || normalized.includes("finish")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700"
  }

  if (normalized.includes("reject") || normalized.includes("cancel")) {
    return "border-rose-200 bg-rose-50 text-rose-700"
  }

  return "border-slate-200 bg-slate-50 text-slate-700"
}

function MultiSelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string[]
  options: string[]
  onChange: (value: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const selectedSet = useMemo(() => new Set(value), [value])
  const summary =
    value.length === 0
      ? label
      : value.length === 1
        ? value[0]
        : `${value[0]} +${value.length - 1}`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("h-9 w-full justify-between rounded-md bg-white px-3 text-sm font-normal shadow-sm", value.length === 0 && "text-muted-foreground")}
        >
          <span className="truncate text-left">{summary}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(360px,calc(100vw-2rem))] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Cari ${label.toLowerCase()}...`} />
          <div className="flex items-center justify-between border-b px-2 py-1.5">
            <Button type="button" variant="ghost" size="sm" className="h-8 rounded-md text-xs" onClick={() => onChange(options)}>
              Pilih Semua
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 rounded-md text-xs" onClick={() => onChange([])}>
              Kosongkan
            </Button>
          </div>
          <CommandList>
            <CommandEmpty>Data tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const selected = selectedSet.has(option)

                return (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => {
                      const next = new Set(value)

                      if (next.has(option)) {
                        next.delete(option)
                      } else {
                        next.add(option)
                      }

                      onChange(Array.from(next))
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{option}</span>
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

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("h-9 w-full justify-between rounded-md bg-white px-3 text-sm font-normal shadow-sm", value === ALL_FILTER && "text-muted-foreground")}
        >
          <span className="truncate text-left">{value === ALL_FILTER ? label : value}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(320px,calc(100vw-2rem))] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Cari ${label.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>Data tidak ditemukan.</CommandEmpty>
            <CommandGroup>
              <CommandItem value={label} onSelect={() => onChange(ALL_FILTER)}>
                <Check className={cn("mr-2 h-4 w-4", value === ALL_FILTER ? "opacity-100" : "opacity-0")} />
                {label}
              </CommandItem>
              {options.map((option) => (
                <CommandItem key={option} value={option} onSelect={() => onChange(option)}>
                  <Check className={cn("mr-2 h-4 w-4", value === option ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{option}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone,
  sparklineData,
}: {
  title: string
  value: string
  detail: string
  icon: ComponentType<{ className?: string }>
  tone: "blue" | "green" | "orange" | "violet" | "rose"
  sparklineData: Array<{ name: string; workOrders: number }>
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-600",
    violet: "bg-violet-50 text-violet-600",
    rose: "bg-rose-50 text-rose-600",
  }[tone]
  const lineColor = {
    blue: "#2563eb",
    green: "#10b981",
    orange: "#f97316",
    violet: "#8b5cf6",
    rose: "#ef4444",
  }[tone]
  const chartData =
    sparklineData.length > 1
      ? sparklineData
      : sparklineData.length === 1
        ? [
            { ...sparklineData[0], name: `${sparklineData[0].name} start` },
            { ...sparklineData[0], name: `${sparklineData[0].name} end` },
          ]
        : [
            { name: "Start", workOrders: 0 },
            { name: "End", workOrders: 0 },
          ]

  return (
    <Card className="overflow-hidden rounded-lg border-slate-200 bg-white py-0 shadow-sm">
      <CardContent className="grid h-full gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-600">{title}</p>
            <p className="mt-2 text-2xl font-bold leading-none text-slate-950 tabular-nums">{value}</p>
          </div>
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-full", toneClass)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="min-h-5 text-xs text-slate-500">{detail}</p>
        <ChartContainer config={chartConfig} className="!aspect-auto h-12 w-full">
          <AreaChart data={chartData} margin={{ left: 0, right: 0, top: 4, bottom: 2 }}>
            <Area type="monotone" dataKey="workOrders" stroke={lineColor} fill={lineColor} fillOpacity={0.12} strokeWidth={2.25} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function WorkshopStatCard({
  title,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  title: string
  value: string
  detail: string
  icon: ComponentType<{ className?: string }>
  tone: "blue" | "green" | "orange" | "violet" | "rose" | "slate"
}) {
  const toneClass = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    orange: "border-amber-200 bg-amber-50 text-amber-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  }[tone]

  return (
    <Card className={cn("flex h-full flex-col rounded-lg py-0 shadow-sm", toneClass)}>
      <CardContent className="grid min-h-[132px] flex-1 gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold">{title}</p>
            <p className="mt-2 text-2xl font-bold leading-none text-slate-950 tabular-nums">{value}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 shadow-sm">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="text-xs leading-5 text-slate-600">{detail}</p>
      </CardContent>
    </Card>
  )
}

function SummaryItem({ label, value, icon: Icon }: { label: string; value: string; icon: ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-0">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm text-slate-600">{label}</span>
      </div>
      <span className="font-semibold text-slate-950 tabular-nums">{value}</span>
    </div>
  )
}

function RankingList({
  title,
  data,
  color,
  onSelect,
}: {
  title: string
  data: Array<{ name: string; value: number; percentage: number }>
  color: string
  onSelect?: (value: string) => void
}) {
  const max = Math.max(...data.map((item) => item.value), 1)

  return (
    <Card className="flex h-full flex-col rounded-lg border-slate-200 bg-white py-0 shadow-sm">
      <CardHeader className="px-5 py-4">
        <CardTitle className="text-base text-slate-950">{title}</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-5 pb-5">
        <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
        {data.map((item) => (
          <button
            key={item.name}
            type="button"
            className="grid w-full gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-slate-50 active:scale-[0.96]"
            onClick={() => onSelect?.(item.name)}
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium text-slate-800">{item.name}</span>
              <span className="text-xs text-slate-500 tabular-nums">{formatNumber(item.value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={cn("h-full rounded-full", color)} style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
          </button>
        ))}
        </div>
      </CardContent>
    </Card>
  )
}

function addFilter(setter: Dispatch<SetStateAction<string[]>>, value: string) {
  setter((current) => (current.includes(value) ? current : [...current, value]))
}

export function WipRepairDashboardClient({
  data,
  workOrderDetails,
  initialDashboardData,
}: WipRepairDashboardClientProps) {
  const defaultMonthKey = useMemo(() => formatMonthKey(new Date()), [])
  const [query, setQuery] = useState("")
  const [storeLocFilter, setStoreLocFilter] = useState(ALL_FILTER)
  const [siteFilter, setSiteFilter] = useState(ALL_FILTER)
  const [sizeFilter, setSizeFilter] = useState(ALL_FILTER)
  const [brandFilter, setBrandFilter] = useState(ALL_FILTER)
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [injuryFilters, setInjuryFilters] = useState<string[]>([])
  const [customerFilters, setCustomerFilters] = useState<string[]>([])
  const [materialFilters, setMaterialFilters] = useState<string[]>([])
  const [selectedMonth, setSelectedMonth] = useState(defaultMonthKey)
  const [recentPage, setRecentPage] = useState(1)

  const filterOptions = useMemo(
    () => ({
      storeLocs: buildOptions(data.map((item) => item.store_loc)),
      sites: buildOptions(data.map((item) => item.site)),
      sizes: buildOptions(data.map((item) => item.size)),
      brands: buildOptions(data.map((item) => normalizeWipRepairBrand(item.brand))),
      statuses: buildOptions(data.map((item) => item.status)),
      injuries: buildOptions(data.map((item) => item.injury)),
      customers: buildOptions(data.map((item) => item.customer)),
      materials: buildOptions(workOrderDetails.map((item) => item.material_name)),
    }),
    [data, workOrderDetails]
  )

  const monthOptions = useMemo(() => {
    return Array.from(
      new Set(
        data
          .map(getWorkOrderDate)
          .filter((date): date is Date => Boolean(date))
          .map(formatMonthKey)
      )
    ).sort((left, right) => right.localeCompare(left))
  }, [data])

  const detailsByWorkOrder = useMemo(() => {
    return workOrderDetails.reduce<Record<string, WipRepairWorkOrderDetailRecord[]>>((accumulator, detail) => {
      for (const key of getDetailLookupKeys(detail)) {
        if (key === "-") {
          continue
        }

        accumulator[key] ??= []
        accumulator[key].push(detail)
      }

      return accumulator
    }, {})
  }, [workOrderDetails])

  const filteredWorkOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return data.filter((item) => {
      const details = detailsByWorkOrder[getHeaderDetailLookupKey(item)] ?? []
      const itemDate = getWorkOrderDate(item)
      const monthMatch = selectedMonth === ALL_FILTER || (itemDate ? formatMonthKey(itemDate) === selectedMonth : false)
      const materialMatch =
        materialFilters.length === 0 ||
        details.some((detail) => materialFilters.includes(normalizeValue(detail.material_name)))
      const queryMatch =
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
          item.size,
          item.status,
          item.store_loc,
        ]
          .map((value) => normalizeValue(value).toLowerCase())
          .some((value) => value.includes(normalizedQuery)) ||
        details.some((detail) =>
          [
            detail.job,
            detail.material_name,
            detail.category,
            detail.person,
            detail.date,
          ]
            .map((value) => normalizeValue(value).toLowerCase())
            .some((value) => value.includes(normalizedQuery))
        )

      return (
        (storeLocFilter === ALL_FILTER || normalizeValue(item.store_loc) === storeLocFilter) &&
        (siteFilter === ALL_FILTER || normalizeValue(item.site) === siteFilter) &&
        (sizeFilter === ALL_FILTER || normalizeValue(item.size) === sizeFilter) &&
        (brandFilter === ALL_FILTER || normalizeWipRepairBrand(item.brand) === brandFilter) &&
        (statusFilters.length === 0 || statusFilters.includes(normalizeValue(item.status))) &&
        (injuryFilters.length === 0 || injuryFilters.includes(normalizeValue(item.injury))) &&
        (customerFilters.length === 0 || customerFilters.includes(normalizeValue(item.customer))) &&
        monthMatch &&
        materialMatch &&
        queryMatch
      )
    })
  }, [brandFilter, customerFilters, data, detailsByWorkOrder, injuryFilters, materialFilters, query, selectedMonth, siteFilter, sizeFilter, statusFilters, storeLocFilter])

  const filteredDetails = useMemo(() => {
    const selectedWorkOrders = new Set(filteredWorkOrders.map(getHeaderDetailLookupKey))

    return workOrderDetails.filter((detail) => getDetailLookupKeys(detail).some((key) => selectedWorkOrders.has(key)))
  }, [filteredWorkOrders, workOrderDetails])

  const dashboard = useMemo(() => {
    return buildWipRepairDashboardData(filteredWorkOrders, filteredDetails)
  }, [filteredDetails, filteredWorkOrders])

  const detailRows = useMemo(() => {
    const workOrderByKey = filteredWorkOrders.reduce<Record<string, WipRepairRecord>>((accumulator, item) => {
      accumulator[getHeaderDetailLookupKey(item)] = item
      return accumulator
    }, {})

    return filteredDetails.map((detail) => {
      const workOrder = getDetailLookupKeys(detail).map((key) => workOrderByKey[key]).find(Boolean)
      const minutes = parseNumber(detail.time)
      const quantity = parseNumber(detail.qty)

      return {
        key: `${normalizeValue(detail.id_job)}-${normalizeValue(detail.wo)}-${normalizeValue(detail.material_id)}`,
        detail,
        workOrder,
        wo: normalizeValue(workOrder?.wo ?? detail.wo),
        tireSn: normalizeTireSn(workOrder?.tire_sn ?? detail.tire_sn),
        customer: normalizeValue(workOrder?.customer),
        site: normalizeValue(workOrder?.site),
        storeLoc: normalizeValue(workOrder?.store_loc),
        job: normalizeValue(detail.job),
        material: normalizeValue(detail.material_name),
        category: normalizeValue(detail.category),
        unit: normalizeValue(detail.smu),
        person: normalizeValue(detail.person),
        date: normalizeValue(detail.date ?? workOrder?.received_date ?? workOrder?.wo_date ?? workOrder?.inspect_date),
        minutes,
        quantity,
      }
    })
  }, [filteredDetails, filteredWorkOrders])

  const productivity = useMemo(() => {
    const grouped = detailRows.reduce<
      Record<
        string,
        {
          name: string
          jobs: number
          minutes: number
          workOrders: Set<string>
          activeDays: Set<string>
          materialRows: number
          jobCounts: Record<string, number>
        }
      >
    >((accumulator, row) => {
      const name = row.person === "-" ? "Tanpa person" : row.person

      accumulator[name] ??= {
        name,
        jobs: 0,
        minutes: 0,
        workOrders: new Set<string>(),
        activeDays: new Set<string>(),
        materialRows: 0,
        jobCounts: {},
      }

      const item = accumulator[name]
      item.jobs += 1
      item.minutes += row.minutes
      item.workOrders.add(row.wo)

      if (row.date !== "-") {
        item.activeDays.add(row.date)
      }

      if (row.material !== "-") {
        item.materialRows += 1
      }

      item.jobCounts[row.job] = (item.jobCounts[row.job] ?? 0) + 1

      return accumulator
    }, {})

    const rows = Object.values(grouped)
      .map((item) => ({
        ...item,
        workOrderCount: item.workOrders.size,
        activeDayCount: item.activeDays.size,
        averageMinutes: item.jobs > 0 ? item.minutes / item.jobs : 0,
        topJob:
          Object.entries(item.jobCounts)
            .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? "-",
      }))
      .sort((left, right) => right.minutes - left.minutes || right.jobs - left.jobs || left.name.localeCompare(right.name))

    return {
      rows,
      totalJobs: detailRows.length,
      activePersons: rows.filter((item) => item.name !== "Tanpa person").length,
      totalMinutes: detailRows.reduce((sum, row) => sum + row.minutes, 0),
      materialRows: detailRows.filter((row) => row.material !== "-").length,
      activeDays: new Set(detailRows.map((row) => row.date).filter((date) => date !== "-")).size,
    }
  }, [detailRows])

  const materialByStoreLoc = useMemo(() => {
    const grouped = detailRows
      .filter((row) => row.material !== "-")
      .reduce<Record<string, { name: string; rows: number; quantity: number; minutes: number; workOrders: Set<string> }>>(
        (accumulator, row) => {
          accumulator[row.storeLoc] ??= { name: row.storeLoc, rows: 0, quantity: 0, minutes: 0, workOrders: new Set<string>() }
          accumulator[row.storeLoc].rows += 1
          accumulator[row.storeLoc].quantity += row.quantity
          accumulator[row.storeLoc].minutes += row.minutes
          accumulator[row.storeLoc].workOrders.add(row.wo)
          return accumulator
        },
        {}
      )

    return Object.values(grouped)
      .map((item) => ({ ...item, workOrderCount: item.workOrders.size }))
      .sort((left, right) => right.rows - left.rows || right.quantity - left.quantity || left.name.localeCompare(right.name))
  }, [detailRows])

  const materialDetailRows = useMemo(() => {
    return detailRows
      .filter((row) => row.material !== "-")
      .sort((left, right) => right.quantity - left.quantity || right.minutes - left.minutes || left.material.localeCompare(right.material))
      .slice(0, 12)
  }, [detailRows])

  const workshopAging = useMemo(() => {
    return dashboard.workOrderInsights.reduce(
      (total, item) => {
        if (item.agingDays === null) {
          total.noDate += 1
        } else if (item.agingDays <= 7) {
          total.normal += 1
        } else if (item.agingDays <= 14) {
          total.warning += 1
        } else {
          total.overdue += 1
        }

        return total
      },
      { normal: 0, warning: 0, overdue: 0, noDate: 0 }
    )
  }, [dashboard.workOrderInsights])

  const completionRate =
    dashboard.summary.totalWorkOrders > 0
      ? (dashboard.summary.completeWorkOrders / dashboard.summary.totalWorkOrders) * 100
      : 0
  const progressRate =
    dashboard.summary.totalWorkOrders > 0
      ? (dashboard.summary.progressWorkOrders / dashboard.summary.totalWorkOrders) * 100
      : 0
  const scrapRiskCount = dashboard.summary.rejectWorkOrders + dashboard.injuryBreakdown.filter((item) => item.name !== "-").slice(0, 1).reduce((sum, item) => sum + item.value, 0)

  const storeLocRows = useMemo(() => {
    const insightById = new Map(dashboard.workOrderInsights.map((item) => [item.idWo, item]))
    const grouped = filteredWorkOrders.reduce<
      Record<
        string,
        {
          name: string
          workOrders: number
          progress: number
          complete: number
          withWo: number
          waitingWo: number
          emptyWo: number
          customers: Set<string>
          sites: Set<string>
          materialRows: number
          totalMinutes: number
          injuries: Record<string, number>
        }
      >
    >((accumulator, item) => {
      const name = normalizeValue(item.store_loc)
      const status = normalizeValue(item.status).toLowerCase()
      const customer = normalizeValue(item.customer)
      const site = normalizeValue(item.site)
      const injury = normalizeValue(item.injury)
      const insight = insightById.get(normalizeValue(item.id_wo))
      const hasWo = hasActualWorkOrder(item.wo)
      const waitingWo = isWaitingWorkOrder(item.wo)
      const emptyWo = isEmptyWorkOrder(item.wo)

      accumulator[name] ??= {
        name,
        workOrders: 0,
        progress: 0,
        complete: 0,
        withWo: 0,
        waitingWo: 0,
        emptyWo: 0,
        customers: new Set<string>(),
        sites: new Set<string>(),
        materialRows: 0,
        totalMinutes: 0,
        injuries: {},
      }

      const row = accumulator[name]
      row.workOrders += 1
      row.materialRows += insight?.materialRows ?? 0
      row.totalMinutes += insight?.totalMinutes ?? 0
      row.injuries[injury] = (row.injuries[injury] ?? 0) + 1

      if (hasWo) {
        row.withWo += 1
      }

      if (waitingWo) {
        row.waitingWo += 1
      }

      if (emptyWo) {
        row.emptyWo += 1
      }

      if (status.includes("progress")) {
        row.progress += 1
      }

      if (status.includes("complete") || status.includes("finish")) {
        row.complete += 1
      }

      if (customer !== "-") {
        row.customers.add(customer)
      }

      if (site !== "-") {
        row.sites.add(site)
      }

      return accumulator
    }, {})

    return Object.values(grouped)
      .map((item) => ({
        ...item,
        customersCount: item.customers.size,
        sitesCount: item.sites.size,
        topInjury:
          Object.entries(item.injuries)
            .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? "-",
      }))
      .sort((left, right) => right.waitingWo - left.waitingWo || right.emptyWo - left.emptyWo || right.workOrders - left.workOrders || left.name.localeCompare(right.name))
  }, [dashboard.workOrderInsights, filteredWorkOrders])

  const storeLocStatusTotals = useMemo(
    () =>
      storeLocRows.reduce(
        (total, item) => ({
          withWo: total.withWo + item.withWo,
          waitingWo: total.waitingWo + item.waitingWo,
          emptyWo: total.emptyWo + item.emptyWo,
        }),
        { withWo: 0, waitingWo: 0, emptyWo: 0 }
      ),
    [storeLocRows]
  )

  const brandRepairRows = useMemo(() => {
    const insightById = new Map(dashboard.workOrderInsights.map((item) => [item.idWo, item]))
    const grouped = filteredWorkOrders.reduce<
      Record<
        string,
        {
          name: string
          workOrders: number
          progress: number
          complete: number
          reject: number
          waitingWo: number
          emptyWo: number
          materialRows: number
          totalMinutes: number
          sizes: Record<string, number>
          injuries: Record<string, number>
          customers: Record<string, number>
        }
      >
    >((accumulator, item) => {
      const name = normalizeWipRepairBrand(item.brand)
      const size = normalizeValue(item.size)
      const injury = normalizeValue(item.injury)
      const customer = normalizeValue(item.customer)
      const status = normalizeValue(item.status).toLowerCase()
      const insight = insightById.get(normalizeValue(item.id_wo))

      accumulator[name] ??= {
        name,
        workOrders: 0,
        progress: 0,
        complete: 0,
        reject: 0,
        waitingWo: 0,
        emptyWo: 0,
        materialRows: 0,
        totalMinutes: 0,
        sizes: {},
        injuries: {},
        customers: {},
      }

      const row = accumulator[name]
      row.workOrders += 1
      row.materialRows += insight?.materialRows ?? 0
      row.totalMinutes += insight?.totalMinutes ?? 0
      row.sizes[size] = (row.sizes[size] ?? 0) + 1
      row.injuries[injury] = (row.injuries[injury] ?? 0) + 1
      row.customers[customer] = (row.customers[customer] ?? 0) + 1

      if (status.includes("progress")) {
        row.progress += 1
      }

      if (status.includes("complete") || status.includes("finish")) {
        row.complete += 1
      }

      if (status.includes("reject")) {
        row.reject += 1
      }

      if (isWaitingWorkOrder(item.wo)) {
        row.waitingWo += 1
      }

      if (isEmptyWorkOrder(item.wo)) {
        row.emptyWo += 1
      }

      return accumulator
    }, {})

    return Object.values(grouped)
      .map((item) => ({
        ...item,
        topSize:
          Object.entries(item.sizes)
            .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? "-",
        topInjury:
          Object.entries(item.injuries)
            .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? "-",
        topCustomer:
          Object.entries(item.customers)
            .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? "-",
      }))
      .sort((left, right) => right.workOrders - left.workOrders || right.totalMinutes - left.totalMinutes || left.name.localeCompare(right.name))
  }, [dashboard.workOrderInsights, filteredWorkOrders])

  const brandSizeRows = useMemo(() => {
    const grouped = filteredWorkOrders.reduce<
      Record<
        string,
        {
          key: string
          brand: string
          size: string
          workOrders: number
          progress: number
          complete: number
          reject: number
          waitingWo: number
          emptyWo: number
          injuries: Record<string, number>
        }
      >
    >((accumulator, item) => {
      const brand = normalizeWipRepairBrand(item.brand)
      const size = normalizeValue(item.size)
      const key = `${brand}__${size}`
      const status = normalizeValue(item.status).toLowerCase()
      const injury = normalizeValue(item.injury)

      accumulator[key] ??= {
        key,
        brand,
        size,
        workOrders: 0,
        progress: 0,
        complete: 0,
        reject: 0,
        waitingWo: 0,
        emptyWo: 0,
        injuries: {},
      }

      const row = accumulator[key]
      row.workOrders += 1
      row.injuries[injury] = (row.injuries[injury] ?? 0) + 1

      if (status.includes("progress")) {
        row.progress += 1
      }

      if (status.includes("complete") || status.includes("finish")) {
        row.complete += 1
      }

      if (status.includes("reject")) {
        row.reject += 1
      }

      if (isWaitingWorkOrder(item.wo)) {
        row.waitingWo += 1
      }

      if (isEmptyWorkOrder(item.wo)) {
        row.emptyWo += 1
      }

      return accumulator
    }, {})

    return Object.values(grouped)
      .map((item) => ({
        ...item,
        name: `${item.brand} / ${item.size}`,
        topInjury:
          Object.entries(item.injuries)
            .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? "-",
      }))
      .sort((left, right) => right.workOrders - left.workOrders || left.brand.localeCompare(right.brand) || left.size.localeCompare(right.size))
  }, [filteredWorkOrders])

  const monthTrend = useMemo(() => {
    const buckets = filteredWorkOrders.reduce<Record<string, { name: string; workOrders: number; progress: number; material: number }>>(
      (accumulator, item) => {
        const date = getWorkOrderDate(item)
        const monthKey = date ? formatMonthKey(date) : "Tanpa tanggal"
        const label = date
          ? new Intl.DateTimeFormat("id-ID", { month: "short", year: "2-digit" }).format(date)
          : "N/A"
        const details = detailsByWorkOrder[getHeaderDetailLookupKey(item)] ?? []

        accumulator[monthKey] ??= { name: label, workOrders: 0, progress: 0, material: 0 }
        accumulator[monthKey].workOrders += 1
        accumulator[monthKey].material += details.filter((detail) => normalizeValue(detail.material_name) !== "-").length

        if (normalizeValue(item.status).toLowerCase().includes("progress")) {
          accumulator[monthKey].progress += 1
        }

        return accumulator
      },
      {}
    )

    const prepared = Object.entries(buckets)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, value]) => value)

    return prepared.length > 0 ? prepared.slice(-6) : [{ name: "-", workOrders: 0, progress: 0, material: 0 }]
  }, [detailsByWorkOrder, filteredWorkOrders])

  const recentActivities = useMemo(() => {
    return [...filteredWorkOrders]
      .sort((left, right) => (getWorkOrderDate(right)?.getTime() ?? 0) - (getWorkOrderDate(left)?.getTime() ?? 0))
  }, [filteredWorkOrders])
  const recentPageCount = Math.max(1, Math.ceil(recentActivities.length / RECENT_PAGE_SIZE))
  const currentRecentPage = Math.min(recentPage, recentPageCount)
  const pagedRecentActivities = recentActivities.slice(
    (currentRecentPage - 1) * RECENT_PAGE_SIZE,
    currentRecentPage * RECENT_PAGE_SIZE
  )

  useEffect(() => {
    setRecentPage(1)
  }, [brandFilter, customerFilters, injuryFilters, materialFilters, query, selectedMonth, siteFilter, sizeFilter, statusFilters, storeLocFilter])

  const activeFilters = [
    ...(storeLocFilter !== ALL_FILTER ? [{ label: "Store Loc", value: storeLocFilter, clear: () => setStoreLocFilter(ALL_FILTER) }] : []),
    ...(siteFilter !== ALL_FILTER ? [{ label: "Jobsite", value: siteFilter, clear: () => setSiteFilter(ALL_FILTER) }] : []),
    ...(sizeFilter !== ALL_FILTER ? [{ label: "Tire Size", value: sizeFilter, clear: () => setSizeFilter(ALL_FILTER) }] : []),
    ...(brandFilter !== ALL_FILTER ? [{ label: "Brand", value: brandFilter, clear: () => setBrandFilter(ALL_FILTER) }] : []),
    ...(selectedMonth !== ALL_FILTER ? [{ label: "Bulan", value: formatMonthLabel(selectedMonth), clear: () => setSelectedMonth(ALL_FILTER) }] : []),
    ...statusFilters.map((value) => ({ label: "Status", value, clear: () => setStatusFilters(statusFilters.filter((item) => item !== value)) })),
    ...injuryFilters.map((value) => ({ label: "Injury", value, clear: () => setInjuryFilters(injuryFilters.filter((item) => item !== value)) })),
    ...customerFilters.map((value) => ({ label: "Customer", value, clear: () => setCustomerFilters(customerFilters.filter((item) => item !== value)) })),
    ...materialFilters.map((value) => ({ label: "Material", value, clear: () => setMaterialFilters(materialFilters.filter((item) => item !== value)) })),
  ]

  function resetFilters() {
    setQuery("")
    setStoreLocFilter(ALL_FILTER)
    setSiteFilter(ALL_FILTER)
    setSizeFilter(ALL_FILTER)
    setBrandFilter(ALL_FILTER)
    setStatusFilters([])
    setInjuryFilters([])
    setCustomerFilters([])
    setMaterialFilters([])
    setSelectedMonth(defaultMonthKey)
  }

  return (
    <div className="min-h-screen bg-slate-50 px-1 pb-2 text-slate-950 md:px-0">
      <div className="-mx-1 rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:mx-0">
        <div className="grid gap-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Store Loc</span>
            <FilterSelect label="Semua store loc" value={storeLocFilter} options={filterOptions.storeLocs} onChange={setStoreLocFilter} />
          </label>
          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Jobsite</span>
            <FilterSelect label="Semua jobsite" value={siteFilter} options={filterOptions.sites} onChange={setSiteFilter} />
          </label>
          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tire Size</span>
            <FilterSelect label="Semua size" value={sizeFilter} options={filterOptions.sizes} onChange={setSizeFilter} />
          </label>
          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Brand</span>
            <FilterSelect label="Semua brand" value={brandFilter} options={filterOptions.brands} onChange={setBrandFilter} />
          </label>
          <div className="flex items-end">
            <Button type="button" className="h-9 w-full gap-2 rounded-md bg-blue-600 px-4 text-sm shadow-sm hover:bg-blue-700 active:scale-[0.96]" onClick={resetFilters}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50/80 px-2.5 py-2">
          <div className="mr-1 flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <CalendarDays className="h-3.5 w-3.5 text-blue-600" />
            Bulan
          </div>
          <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-gutter:stable]">
            <div className="flex w-max gap-1.5 pr-2">
            <Button
              type="button"
              variant={selectedMonth === ALL_FILTER ? "default" : "outline"}
              className={cn(
                "h-8 shrink-0 rounded-md px-3 text-xs font-semibold",
                selectedMonth === ALL_FILTER ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-white"
              )}
              onClick={() => setSelectedMonth(ALL_FILTER)}
            >
              Semua Bulan
            </Button>
            {monthOptions.map((month) => (
              <Button
                key={month}
                type="button"
                variant={selectedMonth === month ? "default" : "outline"}
                className={cn(
                  "h-8 shrink-0 rounded-md px-3 text-xs font-semibold",
                  selectedMonth === month ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700" : "bg-white"
                )}
                onClick={() => setSelectedMonth(month)}
              >
                {formatMonthLabel(month)}
              </Button>
            ))}
            </div>
          </div>
          <span className="shrink-0 text-[11px] text-slate-500">Default: {formatMonthLabel(defaultMonthKey)}</span>
        </div>

        <div className="mt-2 grid gap-2 lg:grid-cols-[minmax(260px,1.25fr)_repeat(4,minmax(0,1fr))]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari WO, tire SN, customer, injury, job, material"
              className="h-9 rounded-md bg-white pl-9 text-sm shadow-sm"
            />
          </div>
          <MultiSelectFilter label="Semua status" value={statusFilters} options={filterOptions.statuses} onChange={setStatusFilters} />
          <MultiSelectFilter label="Semua customer" value={customerFilters} options={filterOptions.customers} onChange={setCustomerFilters} />
          <MultiSelectFilter label="Semua injury" value={injuryFilters} options={filterOptions.injuries} onChange={setInjuryFilters} />
          <MultiSelectFilter label="Semua material" value={materialFilters} options={filterOptions.materials} onChange={setMaterialFilters} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1 rounded-md border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">
            <Filter className="h-3.5 w-3.5" />
            {formatNumber(dashboard.summary.totalWorkOrders)} dari {formatNumber(initialDashboardData.summary.totalWorkOrders)} WO
          </Badge>
          {activeFilters.map((filter) => (
            <Badge key={`${filter.label}-${filter.value}`} variant="secondary" className="gap-1 rounded-md bg-slate-100 px-3 py-1 text-slate-700">
              {filter.label}: {filter.value}
              <button type="button" onClick={filter.clear} aria-label={`Hapus filter ${filter.label}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>

      <Tabs defaultValue="overview" className="mt-5 space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-lg bg-slate-200/70 p-1 lg:grid-cols-6">
          <TabsTrigger value="overview" className="rounded-md">
            Overview
          </TabsTrigger>
          <TabsTrigger value="store-loc" className="rounded-md">
            Per Store Loc
          </TabsTrigger>
          <TabsTrigger value="brand-repair" className="rounded-md">
            Brand Repair
          </TabsTrigger>
          <TabsTrigger value="productivity" className="rounded-md">
            Produktivitas
          </TabsTrigger>
          <TabsTrigger value="material" className="rounded-md">
            Material
          </TabsTrigger>
          <TabsTrigger value="workshop" className="rounded-md">
            Workshop Control
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Total WO Repair" value={formatNumber(dashboard.summary.totalWorkOrders)} detail="Work order pada filter aktif." icon={Wrench} tone="blue" sparklineData={monthTrend} />
        <MetricCard title="Repair In Progress" value={formatNumber(dashboard.summary.progressWorkOrders)} detail={`${formatNumber(progressRate, 1)}% dari WO terfilter.`} icon={Activity} tone="orange" sparklineData={monthTrend} />
        <MetricCard title="Complete" value={formatNumber(dashboard.summary.completeWorkOrders)} detail={`${formatNumber(completionRate, 1)}% sudah selesai.`} icon={BadgeCheck} tone="green" sparklineData={monthTrend} />
        <MetricCard title="Total Waktu" value={formatMinutes(dashboard.summary.totalMinutes)} detail={`Rata-rata ${formatMinutes(dashboard.summary.averageMinutesPerWorkOrder)} per WO.`} icon={Clock3} tone="violet" sparklineData={monthTrend} />
        <MetricCard title="Risk / Injury" value={formatNumber(scrapRiskCount)} detail="Sinyal reject dan injury dominan." icon={AlertTriangle} tone="rose" sparklineData={monthTrend} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.55fr_0.65fr]">
        <Card className="rounded-lg border-slate-200 bg-white py-0 shadow-sm">
          <CardHeader className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base text-slate-950">WIP Aging Distribution</CardTitle>
              <CardDescription>Distribusi umur WO mengikuti filter aktif.</CardDescription>
            </div>
            <Badge variant="outline" className="w-fit rounded-md border-blue-200 bg-blue-50 text-blue-700">
              Target monitor: 0-14 hari
            </Badge>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <ChartContainer config={chartConfig} className="h-[310px] w-full">
              <BarChart data={dashboard.agingBuckets} margin={{ left: -18, right: 18, top: 20, bottom: 10 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {dashboard.agingBuckets.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
            <div className="mt-2 grid grid-cols-5 overflow-hidden rounded-md border border-slate-200 text-center text-xs text-slate-600">
              {dashboard.agingBuckets.map((item) => (
                <div key={item.name} className="border-r border-slate-200 px-2 py-2 last:border-r-0">
                  <div className="font-medium">{item.name}</div>
                  <div className="mt-1 font-semibold text-slate-950 tabular-nums">{formatNumber(item.value)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border-slate-200 bg-white py-0 shadow-sm">
          <CardHeader className="px-5 py-4">
            <CardTitle className="text-base text-slate-950">Summary (This Period)</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <SummaryItem label="Total WO Repair" value={`${formatNumber(dashboard.summary.totalWorkOrders)} pcs`} icon={Wrench} />
            <SummaryItem label="Avg Process Time" value={formatMinutes(dashboard.summary.averageMinutesPerWorkOrder)} icon={Clock3} />
            <SummaryItem label="% Complete" value={`${formatNumber(completionRate, 1)}%`} icon={BadgeCheck} />
            <SummaryItem label="Repair In Progress" value={`${formatNumber(dashboard.summary.progressWorkOrders)} pcs`} icon={Activity} />
            <SummaryItem label="Material Lines" value={formatNumber(dashboard.summary.totalMaterialRows)} icon={PackageSearch} />
            <Button asChild variant="ghost" className="mt-4 h-9 w-full justify-end gap-2 rounded-md text-blue-600 hover:text-blue-700">
              <Link href="/dashboard/wip-repair">View Full Report</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="rounded-lg border-slate-200 bg-white py-0 shadow-sm">
          <CardHeader className="px-5 py-4">
            <CardTitle className="text-base text-slate-950">Status Repair</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <ChartContainer config={chartConfig} className="h-[230px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie data={dashboard.statusBreakdown} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={3}>
                  {dashboard.statusBreakdown.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="space-y-2">
              {dashboard.statusBreakdown.slice(0, 4).map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="font-semibold text-slate-950 tabular-nums">{formatNumber(item.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border-slate-200 bg-white py-0 shadow-sm lg:col-span-1">
          <CardHeader className="px-5 py-4">
            <CardTitle className="text-base text-slate-950">WO Trend (This Period)</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <ChartContainer config={chartConfig} className="h-[295px] w-full">
              <AreaChart data={monthTrend} margin={{ left: -18, right: 12, top: 10, bottom: 8 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="workOrders" stroke="#2563eb" fill="#2563eb" fillOpacity={0.18} strokeWidth={3} />
                <Area type="monotone" dataKey="progress" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.12} strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <RankingList
          title="Injury (This Period)"
          data={dashboard.injuryBreakdown}
          color="bg-rose-500"
          onSelect={(value) => addFilter(setInjuryFilters, value)}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <RankingList
          title="Top Customer"
          data={dashboard.topCustomers}
          color="bg-blue-500"
          onSelect={(value) => addFilter(setCustomerFilters, value)}
        />
        <RankingList
          title="Top Jobsite"
          data={dashboard.topSites}
          color="bg-cyan-500"
          onSelect={(value) => setSiteFilter(value)}
        />
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="self-start overflow-hidden rounded-lg border-slate-200 bg-white py-0 shadow-sm">
          <CardHeader className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base text-slate-950">Recent Activities</CardTitle>
              <CardDescription>
                Menampilkan {formatNumber(pagedRecentActivities.length)} dari {formatNumber(recentActivities.length)} WO.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-md"
                disabled={currentRecentPage <= 1}
                onClick={() => setRecentPage((page) => Math.max(1, page - 1))}
              >
                Prev
              </Button>
              <Badge variant="outline" className="rounded-md px-2.5 py-1 tabular-nums">
                {currentRecentPage} / {recentPageCount}
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-md"
                disabled={currentRecentPage >= recentPageCount}
                onClick={() => setRecentPage((page) => Math.min(recentPageCount, page + 1))}
              >
                Next
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">WO</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Customer / Site</th>
                    <th className="px-4 py-3">Tire</th>
                    <th className="px-4 py-3">Injury</th>
                    <th className="px-4 py-3 text-right">Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRecentActivities.length > 0 ? (
                    pagedRecentActivities.map((item) => {
                      const insight = dashboard.workOrderInsights.find((candidate) => candidate.idWo === normalizeValue(item.id_wo))

                      return (
                        <tr key={`${item.id_wo}-${item.tire_sn}`} className="border-t border-slate-100">
                          <td className="px-4 py-3">
                            <div className="font-mono text-xs font-semibold text-slate-950">{normalizeValue(item.wo)}</div>
                            <div className="text-xs text-slate-500">{formatDate(item.received_date || item.wo_date || item.inspect_date)}</div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={cn("rounded-full px-2.5 py-1 text-xs", getStatusTone(normalizeValue(item.status)))}>
                              {normalizeValue(item.status)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-950">{normalizeValue(item.customer)}</div>
                            <div className="text-xs text-slate-500">{normalizeValue(item.site)}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-950">{normalizeTireSn(item.tire_sn)}</div>
                            <div className="text-xs text-slate-500">{normalizeWipRepairBrand(item.brand)} - {normalizeValue(item.size)}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{normalizeValue(item.injury)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-950 tabular-nums">{formatMinutes(insight?.totalMinutes ?? 0)}</td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                        Data tidak ditemukan untuk filter saat ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="self-start rounded-lg border-slate-200 bg-white py-0 shadow-sm">
          <CardHeader className="px-5 py-4">
            <CardTitle className="text-base text-slate-950">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 px-5 pb-5">
            <Button asChild variant="outline" className="h-10 justify-start gap-2 rounded-md bg-white active:scale-[0.96]">
              <Link href="/dashboard/wip-repair">
                <Gauge className="h-4 w-4 text-blue-600" />
                List WO
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 justify-start gap-2 rounded-md bg-white active:scale-[0.96]"
              onClick={() => {
                const progressStatus = filterOptions.statuses.find((status) => status.toLowerCase().includes("progress"))
                if (progressStatus) {
                  addFilter(setStatusFilters, progressStatus)
                }
              }}
            >
              <Activity className="h-4 w-4 text-orange-600" />
              Progress
            </Button>
            <Button type="button" variant="outline" className="h-10 justify-start gap-2 rounded-md bg-white active:scale-[0.96]" onClick={resetFilters}>
              <RotateCcw className="h-4 w-4 text-slate-600" />
              Reset
            </Button>
            <Button asChild variant="outline" className="h-10 justify-start gap-2 rounded-md bg-white active:scale-[0.96]">
              <Link href="/dashboard/wip-repair">
                <PackageSearch className="h-4 w-4 text-emerald-600" />
                Detail
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

        </TabsContent>

        <TabsContent value="brand-repair" className="space-y-4">
          <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <WorkshopStatCard title="Brand Aktif" value={formatNumber(brandRepairRows.length)} detail="Jumlah brand repair pada filter aktif." icon={BadgeCheck} tone="blue" />
            <WorkshopStatCard title="Tyre Size Aktif" value={formatNumber(dashboard.topSizes.length)} detail="Ukuran ban yang muncul di WO repair." icon={Gauge} tone="green" />
            <WorkshopStatCard title="Brand / Size Mix" value={formatNumber(brandSizeRows.length)} detail="Kombinasi brand dan tyre size yang masuk workshop." icon={Boxes} tone="orange" />
            <WorkshopStatCard title="Risk Brand" value={formatNumber(brandRepairRows.reduce((sum, item) => sum + item.reject + item.waitingWo + item.emptyWo, 0))} detail="Reject, Waiting WO, dan WO kosong per brand." icon={AlertTriangle} tone="rose" />
          </div>

          <div className="grid items-stretch gap-4 xl:grid-cols-[1fr_1fr]">
            <Card className="flex h-full flex-col rounded-lg border-slate-200 bg-white py-0 shadow-sm">
              <CardHeader className="px-5 py-4">
                <CardTitle className="text-base text-slate-950">Brand Repair Mix</CardTitle>
                <CardDescription>Komposisi WO repair berdasarkan brand, sudah mengikuti filter aktif.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 px-5 pb-5">
                <ChartContainer config={chartConfig} className="h-[340px] w-full">
                  <BarChart data={brandRepairRows.slice(0, 12)} layout="vertical" margin={{ left: 28, right: 24, top: 8, bottom: 8 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={126} fontSize={11} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="workOrders" name="WO" fill="#2563eb" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="flex h-full flex-col rounded-lg border-slate-200 bg-white py-0 shadow-sm">
              <CardHeader className="px-5 py-4">
                <CardTitle className="text-base text-slate-950">Tyre Size Mix</CardTitle>
                <CardDescription>Ukuran ban dominan untuk repair; klik untuk filter Tire Size.</CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 px-5 pb-5">
                <div className="max-h-[340px] space-y-3 overflow-y-auto pr-1">
                  {dashboard.topSizes.map((item) => {
                    const maxSize = Math.max(...dashboard.topSizes.map((row) => row.value), 1)

                    return (
                      <button
                        key={item.name}
                        type="button"
                        className="grid w-full gap-2 rounded-md border border-slate-200 bg-white p-3 text-left transition-colors hover:border-emerald-200 hover:bg-emerald-50/40 active:scale-[0.96]"
                        onClick={() => setSizeFilter(item.name)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate font-semibold text-slate-950">{item.name}</span>
                          <span className="text-xs font-semibold text-slate-600 tabular-nums">{formatNumber(item.value)} WO</span>
                        </div>
                        <Progress value={(item.value / maxSize) * 100} className="h-1.5 bg-emerald-100 [&>div]:bg-emerald-500" />
                        <span className="text-xs text-slate-500">{formatNumber(item.percentage, 1)}% dari WO terfilter</span>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid items-stretch gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="flex h-full flex-col rounded-lg border-slate-200 bg-white py-0 shadow-sm">
              <CardHeader className="px-5 py-4">
                <CardTitle className="text-base text-slate-950">Brand Condition</CardTitle>
                <CardDescription>Status repair per brand: progress, complete, reject, dan WO belum final.</CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 px-5 pb-5">
                <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                  {brandRepairRows.map((item) => {
                    const unresolved = item.progress + item.waitingWo + item.emptyWo
                    const unresolvedRate = item.workOrders > 0 ? (unresolved / item.workOrders) * 100 : 0

                    return (
                      <button
                        key={item.name}
                        type="button"
                        className="grid w-full gap-2 rounded-md border border-slate-200 bg-white p-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/40 active:scale-[0.96]"
                        onClick={() => setBrandFilter(item.name)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate font-semibold text-slate-950">{item.name}</span>
                          <span className="text-xs font-semibold text-slate-600 tabular-nums">{formatNumber(item.workOrders)} WO</span>
                        </div>
                        <Progress value={unresolvedRate} className="h-1.5 bg-emerald-100 [&>div]:bg-blue-500" />
                        <div className="grid grid-cols-4 gap-2 text-xs text-slate-500">
                          <span>Progress {formatNumber(item.progress)}</span>
                          <span>Complete {formatNumber(item.complete)}</span>
                          <span>Reject {formatNumber(item.reject)}</span>
                          <span>Pending {formatNumber(item.waitingWo + item.emptyWo)}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-lg border-slate-200 bg-white py-0 shadow-sm">
              <CardHeader className="border-b border-slate-100 px-5 py-4">
                <CardTitle className="text-base text-slate-950">Brand & Tyre Size Detail</CardTitle>
                <CardDescription>Kombinasi brand-size untuk melihat size mana yang dominan per brand.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[430px] overflow-auto">
                  <table className="w-full min-w-[920px] text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Brand</th>
                        <th className="px-4 py-3">Tyre Size</th>
                        <th className="px-4 py-3 text-right">WO</th>
                        <th className="px-4 py-3 text-right">Progress</th>
                        <th className="px-4 py-3 text-right">Complete</th>
                        <th className="px-4 py-3 text-right">Reject</th>
                        <th className="px-4 py-3 text-right">Waiting/Kosong</th>
                        <th className="px-4 py-3">Top Injury</th>
                      </tr>
                    </thead>
                    <tbody>
                      {brandSizeRows.length > 0 ? (
                        brandSizeRows.map((item) => (
                          <tr key={item.key} className="border-t border-slate-100">
                            <td className="px-4 py-3 font-semibold text-slate-950">{item.brand}</td>
                            <td className="px-4 py-3">{item.size}</td>
                            <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatNumber(item.workOrders)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.progress)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.complete)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.reject)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.waitingWo + item.emptyWo)}</td>
                            <td className="px-4 py-3">{item.topInjury}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                            Data brand dan tyre size tidak ditemukan untuk filter saat ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden rounded-lg border-slate-200 bg-white py-0 shadow-sm">
            <CardHeader className="border-b border-slate-100 px-5 py-4">
              <CardTitle className="text-base text-slate-950">Brand Repair Summary</CardTitle>
              <CardDescription>Ringkasan brand dengan top size, top injury, customer dominan, material, dan total waktu.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[360px] overflow-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Brand</th>
                      <th className="px-4 py-3 text-right">WO</th>
                      <th className="px-4 py-3">Top Size</th>
                      <th className="px-4 py-3">Top Injury</th>
                      <th className="px-4 py-3">Top Customer</th>
                      <th className="px-4 py-3 text-right">Material</th>
                      <th className="px-4 py-3 text-right">Waiting/Kosong</th>
                      <th className="px-4 py-3 text-right">Total Waktu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brandRepairRows.length > 0 ? (
                      brandRepairRows.map((item) => (
                        <tr key={item.name} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-semibold text-slate-950">{item.name}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatNumber(item.workOrders)}</td>
                          <td className="px-4 py-3">{item.topSize}</td>
                          <td className="px-4 py-3">{item.topInjury}</td>
                          <td className="px-4 py-3">{item.topCustomer}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.materialRows)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.waitingWo + item.emptyWo)}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatMinutes(item.totalMinutes)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                          Data brand repair tidak ditemukan untuk filter saat ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="productivity" className="space-y-4">
          <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <WorkshopStatCard title="Job Lines" value={formatNumber(productivity.totalJobs)} detail="Total baris pekerjaan dari WO terfilter." icon={ClipboardList} tone="blue" />
            <WorkshopStatCard title="Active Person" value={formatNumber(productivity.activePersons)} detail="Person/mekanik yang tercatat pada detail job." icon={Users} tone="green" />
            <WorkshopStatCard title="Total Jam" value={formatMinutes(productivity.totalMinutes)} detail="Akumulasi waktu pengerjaan pada filter aktif." icon={Clock3} tone="violet" />
            <WorkshopStatCard title="Material Job" value={formatNumber(productivity.materialRows)} detail="Job line yang memakai material." icon={PackageSearch} tone="orange" />
          </div>

          <div className="grid items-stretch gap-4 xl:grid-cols-[1fr_0.9fr]">
            <Card className="flex h-full flex-col rounded-lg border-slate-200 bg-white py-0 shadow-sm">
              <CardHeader className="px-5 py-4">
                <CardTitle className="text-base text-slate-950">Produktivitas Person</CardTitle>
                <CardDescription>Ranking person berdasarkan total waktu dan jumlah job line.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 px-5 pb-5">
                <ChartContainer config={chartConfig} className="h-[360px] w-full">
                  <BarChart data={productivity.rows.slice(0, 10)} layout="vertical" margin={{ left: 28, right: 24, top: 8, bottom: 8 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={120} fontSize={11} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="jobs" name="Job line" fill="#2563eb" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="flex h-full flex-col rounded-lg border-slate-200 bg-white py-0 shadow-sm">
              <CardHeader className="px-5 py-4">
                <CardTitle className="text-base text-slate-950">Job Bottleneck</CardTitle>
                <CardDescription>Pekerjaan yang paling menyerap waktu workshop.</CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 px-5 pb-5">
                <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                {dashboard.jobTimeBreakdown.map((item) => {
                  const maxMinutes = Math.max(...dashboard.jobTimeBreakdown.map((row) => row.value), 1)

                  return (
                    <button
                      key={item.name}
                      type="button"
                      className="grid w-full gap-2 rounded-md border border-slate-200 bg-white p-3 text-left transition-colors hover:border-violet-200 hover:bg-violet-50/40 active:scale-[0.96]"
                      onClick={() => setQuery(item.name)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate font-semibold text-slate-950">{item.name}</span>
                        <span className="text-xs font-semibold text-slate-600 tabular-nums">{formatMinutes(item.value)}</span>
                      </div>
                      <Progress value={(item.value / maxMinutes) * 100} className="h-1.5 bg-violet-100 [&>div]:bg-violet-500" />
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>{formatNumber(item.rows)} job line</span>
                        <span>avg {formatMinutes(item.averageMinutes)}</span>
                      </div>
                    </button>
                  )
                })}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden rounded-lg border-slate-200 bg-white py-0 shadow-sm">
            <CardHeader className="border-b border-slate-100 px-5 py-4">
              <CardTitle className="text-base text-slate-950">Detail Produktivitas</CardTitle>
              <CardDescription>Ringkasan person yang bisa dipakai untuk review kapasitas workshop.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[430px] overflow-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Person</th>
                      <th className="px-4 py-3 text-right">Job Line</th>
                      <th className="px-4 py-3 text-right">WO</th>
                      <th className="px-4 py-3 text-right">Hari Aktif</th>
                      <th className="px-4 py-3">Top Job</th>
                      <th className="px-4 py-3 text-right">Material Line</th>
                      <th className="px-4 py-3 text-right">Avg Time</th>
                      <th className="px-4 py-3 text-right">Total Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productivity.rows.length > 0 ? (
                      productivity.rows.slice(0, 12).map((item) => (
                        <tr key={item.name} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-semibold text-slate-950">{item.name}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.jobs)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.workOrderCount)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.activeDayCount)}</td>
                          <td className="px-4 py-3">{item.topJob}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.materialRows)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatMinutes(item.averageMinutes)}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatMinutes(item.minutes)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                          Data produktivitas tidak ditemukan untuk filter saat ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="material" className="space-y-4">
          <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <WorkshopStatCard title="Material Line" value={formatNumber(dashboard.summary.totalMaterialRows)} detail="Jumlah detail yang memakai material." icon={Boxes} tone="orange" />
            <WorkshopStatCard title="Material Item" value={formatNumber(dashboard.materialUsage.length)} detail="Jenis material unik pada filter aktif." icon={PackageSearch} tone="blue" />
            <WorkshopStatCard title="Kategori" value={formatNumber(dashboard.materialCategories.length)} detail="Kategori material yang muncul." icon={ClipboardList} tone="green" />
            <WorkshopStatCard title="Store Loc Aktif" value={formatNumber(materialByStoreLoc.length)} detail="Store loc dengan konsumsi material." icon={Gauge} tone="violet" />
          </div>

          <div className="grid items-stretch gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="flex h-full flex-col rounded-lg border-slate-200 bg-white py-0 shadow-sm">
              <CardHeader className="px-5 py-4">
                <CardTitle className="text-base text-slate-950">Top Material Usage</CardTitle>
                <CardDescription>Material paling sering dipakai, bukan hanya total quantity.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 px-5 pb-5">
                <ChartContainer config={chartConfig} className="h-[360px] w-full">
                  <BarChart data={dashboard.materialUsage.slice(0, 10)} layout="vertical" margin={{ left: 28, right: 24, top: 8, bottom: 8 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={138} fontSize={11} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="rows" name="Line" fill="#f59e0b" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <div className="grid auto-rows-fr gap-4">
              <RankingList title="Material Category" data={dashboard.materialCategories} color="bg-emerald-500" onSelect={(value) => setQuery(value)} />
              <Card className="flex h-full flex-col rounded-lg border-slate-200 bg-white py-0 shadow-sm">
                <CardHeader className="px-5 py-4">
                  <CardTitle className="text-base text-slate-950">Material Per Store Loc</CardTitle>
                </CardHeader>
                <CardContent className="min-h-0 flex-1 px-5 pb-5">
                  <div className="max-h-[260px] space-y-3 overflow-y-auto pr-1">
                  {materialByStoreLoc.map((item) => {
                    const maxRows = Math.max(...materialByStoreLoc.map((row) => row.rows), 1)

                    return (
                      <button
                        key={item.name}
                        type="button"
                        className="grid w-full gap-2 rounded-md border border-slate-200 bg-white p-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/40 active:scale-[0.96]"
                        onClick={() => setStoreLocFilter(item.name)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate font-semibold text-slate-950">{item.name}</span>
                          <span className="text-xs font-semibold text-slate-600 tabular-nums">{formatNumber(item.rows)} line</span>
                        </div>
                        <Progress value={(item.rows / maxRows) * 100} className="h-1.5 bg-blue-100 [&>div]:bg-blue-500" />
                        <div className="flex justify-between text-xs text-slate-500">
                          <span>{formatNumber(item.workOrderCount)} WO</span>
                          <span>{formatNumber(item.quantity, 2)} qty</span>
                        </div>
                      </button>
                    )
                  })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="overflow-hidden rounded-lg border-slate-200 bg-white py-0 shadow-sm">
            <CardHeader className="border-b border-slate-100 px-5 py-4">
              <CardTitle className="text-base text-slate-950">Detail Material</CardTitle>
              <CardDescription>Material terbesar pada filter aktif untuk audit kebutuhan dan konsumsi workshop.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[430px] overflow-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Material</th>
                      <th className="px-4 py-3">WO / Tire</th>
                      <th className="px-4 py-3">Customer / Site</th>
                      <th className="px-4 py-3">Job</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3">Person</th>
                      <th className="px-4 py-3 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialDetailRows.length > 0 ? (
                      materialDetailRows.map((row) => (
                        <tr key={row.key} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-semibold text-slate-950">{row.material}</td>
                          <td className="px-4 py-3">
                            <div className="font-mono text-xs font-semibold text-slate-950">{row.wo}</div>
                            <div className="text-xs text-slate-500">{row.tireSn}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-950">{row.customer}</div>
                            <div className="text-xs text-slate-500">{row.site}</div>
                          </td>
                          <td className="px-4 py-3">{row.job}</td>
                          <td className="px-4 py-3">{row.category}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatNumber(row.quantity, 2)}</td>
                          <td className="px-4 py-3">{row.unit}</td>
                          <td className="px-4 py-3">{row.person}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatMinutes(row.minutes)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                          Data material tidak ditemukan untuk filter saat ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workshop" className="space-y-4">
          <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <WorkshopStatCard title="Normal Aging" value={formatNumber(workshopAging.normal)} detail="WO 0-7 hari, masih dalam ritme normal." icon={BadgeCheck} tone="green" />
            <WorkshopStatCard title="Warning" value={formatNumber(workshopAging.warning)} detail="WO 8-14 hari, perlu dipantau." icon={Clock3} tone="orange" />
            <WorkshopStatCard title="Overdue" value={formatNumber(workshopAging.overdue)} detail="WO lebih dari 14 hari, prioritas follow-up." icon={AlertTriangle} tone="rose" />
            <WorkshopStatCard title="Waiting/Kosong" value={formatNumber(storeLocStatusTotals.waitingWo + storeLocStatusTotals.emptyWo)} detail="WO belum final atau field WO kosong." icon={TimerReset} tone="violet" />
          </div>

          <div className="grid items-stretch gap-4 xl:grid-cols-[1fr_1fr]">
            <Card className="flex h-full flex-col rounded-lg border-slate-200 bg-white py-0 shadow-sm">
              <CardHeader className="px-5 py-4">
                <CardTitle className="text-base text-slate-950">Workshop Load Control</CardTitle>
                <CardDescription>Status pekerjaan, aging, dan risiko bottleneck pada filter aktif.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4 px-5 pb-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-700">In Progress</p>
                    <p className="mt-2 text-xl font-bold text-slate-950 tabular-nums">{formatNumber(dashboard.summary.progressWorkOrders)}</p>
                  </div>
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-semibold text-emerald-700">Complete</p>
                    <p className="mt-2 text-xl font-bold text-slate-950 tabular-nums">{formatNumber(dashboard.summary.completeWorkOrders)}</p>
                  </div>
                  <div className="rounded-md border border-rose-200 bg-rose-50 p-3">
                    <p className="text-xs font-semibold text-rose-700">Reject</p>
                    <p className="mt-2 text-xl font-bold text-slate-950 tabular-nums">{formatNumber(dashboard.summary.rejectWorkOrders)}</p>
                  </div>
                </div>

                <ChartContainer config={chartConfig} className="h-[260px] w-full">
                  <BarChart data={dashboard.agingBuckets} margin={{ left: -18, right: 18, top: 20, bottom: 10 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="flex h-full flex-col rounded-lg border-slate-200 bg-white py-0 shadow-sm">
              <CardHeader className="px-5 py-4">
                <CardTitle className="text-base text-slate-950">Priority WO</CardTitle>
                <CardDescription>WO dengan waktu proses atau aging tertinggi.</CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 px-5 pb-5">
                <div className="max-h-[382px] space-y-3 overflow-y-auto pr-1">
                {dashboard.workOrderInsights.map((item) => (
                  <button
                    key={item.insightKey}
                    type="button"
                    className="grid w-full gap-2 rounded-md border border-slate-200 bg-white p-3 text-left transition-colors hover:border-rose-200 hover:bg-rose-50/40 active:scale-[0.96]"
                    onClick={() => setQuery(item.wo)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-mono text-xs font-semibold text-slate-950">{item.wo}</div>
                        <div className="mt-1 truncate text-sm font-semibold text-slate-950">{item.customer}</div>
                        <div className="text-xs text-slate-500">{item.site} - {item.tireSn}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-950 tabular-nums">{formatMinutes(item.totalMinutes)}</div>
                        <div className="text-xs text-slate-500">{item.agingDays === null ? "Tanpa tanggal" : `${formatNumber(item.agingDays)} hari`}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className={cn("rounded-full px-2.5 py-1 text-xs", getStatusTone(item.status))}>{item.status}</Badge>
                      <Badge variant="outline" className="rounded-full px-2.5 py-1 text-xs">{item.injury}</Badge>
                      <Badge variant="outline" className="rounded-full px-2.5 py-1 text-xs">{formatNumber(item.materialRows)} material</Badge>
                    </div>
                  </button>
                ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden rounded-lg border-slate-200 bg-white py-0 shadow-sm">
            <CardHeader className="border-b border-slate-100 px-5 py-4">
              <CardTitle className="text-base text-slate-950">Workshop Action Queue</CardTitle>
              <CardDescription>Fokus tindakan per store loc: waiting/kosong, in progress, dan total waktu.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[360px] overflow-auto">
                <table className="w-full min-w-[840px] text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Store Loc</th>
                      <th className="px-4 py-3 text-right">Total WO</th>
                      <th className="px-4 py-3 text-right">Waiting WO</th>
                      <th className="px-4 py-3 text-right">WO Kosong</th>
                      <th className="px-4 py-3 text-right">Progress</th>
                      <th className="px-4 py-3 text-right">Complete</th>
                      <th className="px-4 py-3">Top Injury</th>
                      <th className="px-4 py-3 text-right">Total Waktu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeLocRows.length > 0 ? (
                      storeLocRows.map((item) => (
                        <tr key={item.name} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-semibold text-slate-950">{item.name}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.workOrders)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-amber-700 tabular-nums">{formatNumber(item.waitingWo)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-600 tabular-nums">{formatNumber(item.emptyWo)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.progress)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.complete)}</td>
                          <td className="px-4 py-3">{item.topInjury}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatMinutes(item.totalMinutes)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                          Tidak ada action queue untuk filter saat ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="store-loc" className="space-y-4">
          <div className="grid auto-rows-fr gap-4 md:grid-cols-3">
            <WorkshopStatCard
              title="Sudah Ada WO"
              value={formatNumber(storeLocStatusTotals.withWo)}
              detail="WO aktual per store loc pada filter aktif."
              icon={BadgeCheck}
              tone="green"
            />
            <WorkshopStatCard
              title="Waiting WO"
              value={formatNumber(storeLocStatusTotals.waitingWo)}
              detail="Data sudah masuk repair, nomor WO belum final."
              icon={TimerReset}
              tone="orange"
            />
            <WorkshopStatCard
              title="WO Kosong"
              value={formatNumber(storeLocStatusTotals.emptyWo)}
              detail="WO blank/unknown dan perlu dicek kelengkapannya."
              icon={PackageSearch}
              tone="slate"
            />
          </div>

          <div className="grid items-stretch gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="flex h-full flex-col rounded-lg border-slate-200 bg-white py-0 shadow-sm">
              <CardHeader className="px-5 py-4">
                <CardTitle className="text-base text-slate-950">Status WO Per Store Loc</CardTitle>
                <CardDescription>Perbandingan WO aktual, Waiting WO, dan WO kosong pada setiap store loc.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 px-5 pb-5">
                <ChartContainer config={chartConfig} className="h-[360px] w-full">
                  <BarChart data={storeLocRows.slice(0, 10)} layout="vertical" margin={{ left: 26, right: 24, top: 8, bottom: 8 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={116} fontSize={11} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="withWo" stackId="wo" radius={[0, 0, 0, 0]} fill="#10b981" />
                    <Bar dataKey="waitingWo" stackId="wo" radius={[0, 0, 0, 0]} fill="#f59e0b" />
                    <Bar dataKey="emptyWo" stackId="wo" radius={[0, 6, 6, 0]} fill="#94a3b8" />
                  </BarChart>
                </ChartContainer>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Sudah Ada WO</span>
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Waiting WO</span>
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" />WO Kosong</span>
                </div>
              </CardContent>
            </Card>

            <Card className="flex h-full flex-col rounded-lg border-slate-200 bg-white py-0 shadow-sm">
              <CardHeader className="px-5 py-4">
                <CardTitle className="text-base text-slate-950">Store Loc Summary</CardTitle>
                <CardDescription>Ringkasan lokasi dari semua data WIP Repair yang lolos filter.</CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 px-5 pb-5">
                <div className="max-h-[426px] space-y-3 overflow-y-auto pr-1">
                  {storeLocRows.slice(0, 8).map((item) => {
                    const pendingValue = item.workOrders > 0 ? ((item.waitingWo + item.emptyWo) / item.workOrders) * 100 : 0

                    return (
                      <button
                        key={item.name}
                        type="button"
                        className="grid w-full gap-2 rounded-md border border-slate-200 bg-white p-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/40 active:scale-[0.96]"
                        onClick={() => {
                          setQuery(item.name)
                        }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate font-semibold text-slate-950">{item.name}</span>
                          <span className="shrink-0 text-sm font-semibold text-slate-950 tabular-nums">{formatNumber(item.workOrders)} WO</span>
                        </div>
                        <Progress value={pendingValue} className="h-1.5 bg-emerald-100 [&>div]:bg-amber-500" />
                        <div className="grid grid-cols-3 gap-2 text-xs text-slate-500">
                          <span className="grid gap-0.5">
                            <span>Ada WO</span>
                            <span className="font-semibold text-slate-700 tabular-nums">{formatNumber(item.withWo)}</span>
                          </span>
                          <span className="grid gap-0.5">
                            <span>Waiting</span>
                            <span className="font-semibold text-slate-700 tabular-nums">{formatNumber(item.waitingWo)}</span>
                          </span>
                          <span className="grid gap-0.5 text-right">
                            <span>Kosong</span>
                            <span className="font-semibold text-slate-700 tabular-nums">{formatNumber(item.emptyWo)}</span>
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden rounded-lg border-slate-200 bg-white py-0 shadow-sm">
            <CardHeader className="border-b border-slate-100 px-5 py-4">
              <CardTitle className="text-base text-slate-950">Detail Per Store Loc</CardTitle>
              <CardDescription>Semua angka di tabel ini ikut berubah saat filter dashboard diubah.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[430px] overflow-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Store Loc</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Ada WO</th>
                      <th className="px-4 py-3 text-right">Waiting WO</th>
                      <th className="px-4 py-3 text-right">WO Kosong</th>
                      <th className="px-4 py-3 text-right">Progress</th>
                      <th className="px-4 py-3 text-right">Complete</th>
                      <th className="px-4 py-3 text-right">Customer</th>
                      <th className="px-4 py-3 text-right">Site</th>
                      <th className="px-4 py-3">Top Injury</th>
                      <th className="px-4 py-3 text-right">Material</th>
                      <th className="px-4 py-3 text-right">Total Waktu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeLocRows.length > 0 ? (
                      storeLocRows.map((item) => (
                        <tr key={item.name} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-semibold text-slate-950">{item.name}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatNumber(item.workOrders)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-700 tabular-nums">{formatNumber(item.withWo)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-amber-700 tabular-nums">{formatNumber(item.waitingWo)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-600 tabular-nums">{formatNumber(item.emptyWo)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.progress)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.complete)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.customersCount)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.sitesCount)}</td>
                          <td className="px-4 py-3">{item.topInjury}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatNumber(item.materialRows)}</td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatMinutes(item.totalMinutes)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={12} className="px-4 py-10 text-center text-slate-500">
                          Data store loc tidak ditemukan untuk filter saat ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="mt-4 text-right text-xs text-slate-500">
        Dashboard mengikuti filter aktif dari {formatNumber(dashboard.summary.totalDetailRows)} baris detail WIP Repair.
      </p>
    </div>
  )
}
