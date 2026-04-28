"use client"

import type { ComponentType } from "react"
import { useMemo, useState } from "react"
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Boxes,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Factory,
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
import { normalizeWipRepairBrand } from "@/lib/wip-repair-brand"
import {
  buildWipRepairDashboardData,
  type WipRepairDashboardData,
  type WipRepairRankingItem,
} from "@/lib/wip-repair-dashboard"
import type { WipRepairRecord, WipRepairWorkOrderDetailRecord } from "@/lib/types/wip-repair"

type WipRepairDashboardClientProps = {
  data: WipRepairRecord[]
  workOrderDetails: WipRepairWorkOrderDetailRecord[]
  initialDashboardData: WipRepairDashboardData
}

const CHART_COLORS = ["#2563eb", "#16a34a", "#f97316", "#db2777", "#7c3aed", "#0891b2", "#ca8a04", "#dc2626"]

const chartConfig = {
  value: { label: "Jumlah", color: "#2563eb" },
  quantity: { label: "Qty", color: "#f97316" },
  rows: { label: "Pemakaian", color: "#16a34a" },
  minutes: { label: "Menit", color: "#7c3aed" },
} satisfies ChartConfig

function normalizeValue(value: string | null | undefined) {
  return value?.trim() || "-"
}

function normalizeTireSn(value: string | null | undefined) {
  return normalizeValue(value).toUpperCase()
}

function isWaitingWorkOrder(value: string | null | undefined) {
  return normalizeValue(value).toLowerCase() === "waiting wo"
}

function getHeaderDetailLookupKey(item: WipRepairRecord) {
  if (isWaitingWorkOrder(item.wo)) {
    const tireSn = normalizeTireSn(item.tire_sn)
    return tireSn === "-" ? `${normalizeValue(item.wo)}:${normalizeValue(item.id_wo)}` : `WAITING_SN:${tireSn}`
  }

  return normalizeValue(item.wo)
}

function formatNumber(value: number, maximumFractionDigits = 0) {
  return value.toLocaleString("id-ID", { maximumFractionDigits })
}

function formatDateInput(value: Date) {
  return value.toISOString().slice(0, 10)
}

function parseDateInput(value: string) {
  if (!value) {
    return null
  }

  const parsed = new Date(`${value}T00:00:00`)

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function getWorkOrderDate(item: WipRepairRecord) {
  const candidate = item.received_date || item.wo_date || item.inspect_date

  if (!candidate) {
    return null
  }

  const parsed = new Date(`${candidate}T00:00:00`)

  return Number.isNaN(parsed.getTime()) ? null : parsed
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

function formatHoursFromMinutes(value: number) {
  return `${formatNumber(value / 60, 1)} jam`
}

function buildOptions(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(normalizeValue).filter((value) => value !== "-"))).sort((left, right) =>
    left.localeCompare(right)
  )
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone,
}: {
  title: string
  value: string
  description: string
  icon: ComponentType<{ className?: string }>
  tone: "blue" | "green" | "orange" | "violet" | "rose" | "cyan"
}) {
  const toneClass = {
    blue: "border-l-blue-500 text-blue-600 bg-blue-50/70 dark:bg-blue-950/20 dark:text-blue-300",
    green: "border-l-emerald-500 text-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/20 dark:text-emerald-300",
    orange: "border-l-orange-500 text-orange-600 bg-orange-50/70 dark:bg-orange-950/20 dark:text-orange-300",
    violet: "border-l-violet-500 text-violet-600 bg-violet-50/70 dark:bg-violet-950/20 dark:text-violet-300",
    rose: "border-l-rose-500 text-rose-600 bg-rose-50/70 dark:bg-rose-950/20 dark:text-rose-300",
    cyan: "border-l-cyan-500 text-cyan-600 bg-cyan-50/70 dark:bg-cyan-950/20 dark:text-cyan-300",
  }[tone]

  return (
    <Card className={cn("overflow-hidden rounded-lg border-l-4 border-y-border/70 border-r-border/70 py-0 shadow-sm", toneClass)}>
      <CardContent className="grid h-full gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-background/90 shadow-sm">
            <Icon className="h-4.5 w-4.5" />
          </div>
        </div>
        <p className="text-2xl font-bold leading-none tabular-nums text-foreground">{value}</p>
        <p className="min-h-10 text-xs leading-5 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function HorizontalRanking({
  title,
  description,
  data,
  color = "bg-blue-500",
  onSelect,
}: {
  title: string
  description: string
  data: WipRepairRankingItem[]
  color?: string
  onSelect?: (value: string) => void
}) {
  const max = Math.max(...data.map((item) => item.value), 1)

  return (
    <Card className="rounded-lg border-border/70 py-0 shadow-sm">
      <CardHeader className="px-7 py-6">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="pt-1">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-7 pb-7">
        {data.slice(0, 7).map((item) => (
          <button
            key={item.name}
            type="button"
            className="group grid min-h-12 w-full gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted/60 active:scale-[0.96]"
            onClick={() => onSelect?.(item.name)}
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium group-hover:text-primary">{item.name}</span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {formatNumber(item.value)} ({formatNumber(item.percentage, 1)}%)
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  )
}

function JobFrequencyRanking({ data }: { data: WipRepairDashboardData["jobTimeBreakdown"] }) {
  const ordered = [...data].sort((left, right) => right.rows - left.rows || right.value - left.value).slice(0, 8)
  const max = Math.max(...ordered.map((item) => item.rows), 1)

  return (
    <Card className="rounded-lg border-border/70 py-0 shadow-sm">
      <CardHeader className="px-7 py-6">
        <CardTitle className="text-base">Job Frequency</CardTitle>
        <CardDescription className="pt-1">Frekuensi pekerjaan, total waktu, dan rata-rata dalam satuan jam.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-7 pb-7">
        {ordered.map((item) => (
          <div key={item.name} className="grid min-h-14 gap-2 rounded-md px-2 py-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-medium">{item.name}</span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {formatNumber(item.rows)}x · {formatHoursFromMinutes(item.value)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${(item.rows / max) * 100}%` }} />
              </div>
              <span className="min-w-28 text-right text-[11px] text-muted-foreground">
                avg {formatHoursFromMinutes(item.averageMinutes)}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function MaterialList({
  data,
  onSelect,
}: {
  data: WipRepairDashboardData["materialUsage"]
  onSelect: (value: string) => void
}) {
  const max = Math.max(...data.map((item) => item.rows), 1)

  return (
    <Card className="h-[430px] rounded-lg border-border/70 py-0 shadow-sm">
      <CardHeader className="shrink-0 px-6 py-5">
        <CardTitle className="flex items-center gap-2 text-base">
          <Boxes className="h-4 w-4 text-orange-500" />
          Material Paling Banyak Dipakai
        </CardTitle>
        <CardDescription className="pt-1">Ranking berdasarkan frekuensi pemakaian, qty tetap ditampilkan per unit.</CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 px-6 pb-5">
        <div className="h-full overflow-y-auto pr-2 [scrollbar-gutter:stable]">
          <div className="space-y-3">
            {data.slice(0, 12).map((item, index) => (
              <button
                key={`${item.name}-${item.unit}`}
                type="button"
                className="grid w-full gap-2 rounded-md border bg-background p-3 text-left transition-colors hover:border-orange-300 hover:bg-orange-50/60 active:scale-[0.96] dark:hover:bg-orange-950/20"
                onClick={() => onSelect(item.name)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700 dark:bg-orange-950 dark:text-orange-200">
                        {index + 1}
                      </span>
                      <p className="truncate font-medium">{item.name}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.category} · {formatNumber(item.quantity, 2)} {item.unit}</p>
                  </div>
                  <Badge variant="secondary" className="rounded-md">{formatNumber(item.rows)}x</Badge>
                </div>
                <Progress value={(item.rows / max) * 100} className="h-1.5 bg-orange-100 [&>div]:bg-orange-500" />
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
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
      : value.length <= 1
        ? value[0]
        : `${value[0]} +${value.length - 1}`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("h-10 w-full justify-between rounded-md px-3 font-normal", value.length === 0 && "text-muted-foreground")}
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

export function WipRepairDashboardClient({
  data,
  workOrderDetails,
  initialDashboardData,
}: WipRepairDashboardClientProps) {
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [customerFilters, setCustomerFilters] = useState<string[]>([])
  const [siteFilters, setSiteFilters] = useState<string[]>([])
  const [injuryFilters, setInjuryFilters] = useState<string[]>([])
  const [sizeFilters, setSizeFilters] = useState<string[]>([])
  const [brandFilters, setBrandFilters] = useState<string[]>([])
  const [materialFilters, setMaterialFilters] = useState<string[]>([])
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [processMetric, setProcessMetric] = useState<"total" | "average">("total")
  const [query, setQuery] = useState("")

  const filterOptions = useMemo(
    () => ({
      statuses: buildOptions(data.map((item) => item.status)),
      customers: buildOptions(data.map((item) => item.customer)),
      sites: buildOptions(data.map((item) => item.site)),
      injuries: buildOptions(data.map((item) => item.injury)),
      sizes: buildOptions(data.map((item) => item.size)),
      brands: buildOptions(data.map((item) => normalizeWipRepairBrand(item.brand))),
      materials: buildOptions(workOrderDetails.map((item) => item.material_name)),
    }),
    [data, workOrderDetails]
  )

  const detailsByWorkOrder = useMemo(() => {
    return workOrderDetails.reduce<Record<string, WipRepairWorkOrderDetailRecord[]>>((accumulator, detail) => {
      const wo = normalizeValue(detail.wo)

      if (wo === "-") {
        return accumulator
      }

      accumulator[wo] ??= []
      accumulator[wo].push(detail)

      return accumulator
    }, {})
  }, [workOrderDetails])

  const filteredWorkOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const parsedStartDate = parseDateInput(startDate)
    const parsedEndDate = parseDateInput(endDate)

    return data.filter((item) => {
      const details = detailsByWorkOrder[getHeaderDetailLookupKey(item)] ?? []
      const itemDate = getWorkOrderDate(item)
      const materialMatch =
        materialFilters.length === 0 ||
        details.some((detail) => materialFilters.includes(normalizeValue(detail.material_name)))
      const startMatch = !parsedStartDate || !itemDate || itemDate >= parsedStartDate
      const endMatch = !parsedEndDate || !itemDate || itemDate <= parsedEndDate
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
        ]
          .map((value) => normalizeValue(value).toLowerCase())
          .some((value) => value.includes(normalizedQuery)) ||
        details.some((detail) =>
          [detail.job, detail.material_name, detail.category]
            .map((value) => normalizeValue(value).toLowerCase())
            .some((value) => value.includes(normalizedQuery))
        )

      return (
        (statusFilters.length === 0 || statusFilters.includes(normalizeValue(item.status))) &&
        (customerFilters.length === 0 || customerFilters.includes(normalizeValue(item.customer))) &&
        (siteFilters.length === 0 || siteFilters.includes(normalizeValue(item.site))) &&
        (injuryFilters.length === 0 || injuryFilters.includes(normalizeValue(item.injury))) &&
        (sizeFilters.length === 0 || sizeFilters.includes(normalizeValue(item.size))) &&
        (brandFilters.length === 0 || brandFilters.includes(normalizeWipRepairBrand(item.brand))) &&
        startMatch &&
        endMatch &&
        materialMatch &&
        queryMatch
      )
    })
  }, [brandFilters, customerFilters, data, detailsByWorkOrder, endDate, injuryFilters, materialFilters, query, siteFilters, sizeFilters, startDate, statusFilters])

  const filteredDetails = useMemo(() => {
    const selectedWorkOrders = new Set(
      filteredWorkOrders
        .filter((item) => !isWaitingWorkOrder(item.wo))
        .map((item) => normalizeValue(item.wo))
    )

    return workOrderDetails.filter((detail) => selectedWorkOrders.has(normalizeValue(detail.wo)))
  }, [filteredWorkOrders, workOrderDetails])

  const dashboard = useMemo(() => {
    if (
      statusFilters.length === 0 &&
      customerFilters.length === 0 &&
      siteFilters.length === 0 &&
      injuryFilters.length === 0 &&
      sizeFilters.length === 0 &&
      brandFilters.length === 0 &&
      materialFilters.length === 0 &&
      !startDate &&
      !endDate &&
      query.trim().length === 0
    ) {
      return initialDashboardData
    }

    return buildWipRepairDashboardData(filteredWorkOrders, filteredDetails)
  }, [brandFilters, customerFilters, endDate, filteredDetails, filteredWorkOrders, initialDashboardData, injuryFilters, materialFilters, query, siteFilters, sizeFilters, startDate, statusFilters])

  const activeFilters = [
    ...statusFilters.map((value) => ({ label: "Status", value, clear: () => setStatusFilters(statusFilters.filter((item) => item !== value)) })),
    ...customerFilters.map((value) => ({ label: "Customer", value, clear: () => setCustomerFilters(customerFilters.filter((item) => item !== value)) })),
    ...siteFilters.map((value) => ({ label: "Site", value, clear: () => setSiteFilters(siteFilters.filter((item) => item !== value)) })),
    ...injuryFilters.map((value) => ({ label: "Injury", value, clear: () => setInjuryFilters(injuryFilters.filter((item) => item !== value)) })),
    ...sizeFilters.map((value) => ({ label: "Size", value, clear: () => setSizeFilters(sizeFilters.filter((item) => item !== value)) })),
    ...brandFilters.map((value) => ({ label: "Brand", value, clear: () => setBrandFilters(brandFilters.filter((item) => item !== value)) })),
    ...materialFilters.map((value) => ({ label: "Material", value, clear: () => setMaterialFilters(materialFilters.filter((item) => item !== value)) })),
    ...(startDate ? [{ label: "Dari", value: startDate, clear: () => setStartDate("") }] : []),
    ...(endDate ? [{ label: "Sampai", value: endDate, clear: () => setEndDate("") }] : []),
  ]

  function resetFilters() {
    setStatusFilters([])
    setCustomerFilters([])
    setSiteFilters([])
    setInjuryFilters([])
    setSizeFilters([])
    setBrandFilters([])
    setMaterialFilters([])
    setStartDate("")
    setEndDate("")
    setQuery("")
  }

  function addFilter(setter: (updater: (current: string[]) => string[]) => void, value: string) {
    setter((current) => (current.includes(value) ? current : [...current, value]))
  }

  const topWorkOrders = dashboard.workOrderInsights.slice(0, 8)
  const completionRate = dashboard.summary.totalWorkOrders > 0
    ? (dashboard.summary.completeWorkOrders / dashboard.summary.totalWorkOrders) * 100
    : 0
  const progressRate = dashboard.summary.totalWorkOrders > 0
    ? (dashboard.summary.progressWorkOrders / dashboard.summary.totalWorkOrders) * 100
    : 0
  const processChartData = useMemo(
    () =>
      dashboard.jobTimeBreakdown.map((item) => ({
        ...item,
        value: processMetric === "total" ? Number((item.value / 60).toFixed(1)) : Number((item.averageMinutes / 60).toFixed(1)),
      })),
    [dashboard.jobTimeBreakdown, processMetric]
  )

  return (
    <div className="flex flex-col gap-5">
      <Card className="rounded-lg border-border/70 py-0 shadow-sm">
        <CardHeader className="border-b bg-muted/20 px-8 py-6">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Filter className="h-4 w-4 text-primary" />
            Filter Dashboard
          </CardTitle>
          <CardDescription>Search, multi-select, dan date range memakai tanggal received/WO/inspect yang tersedia.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 px-8 py-6">
          <div className="grid gap-3 xl:grid-cols-[minmax(280px,1.2fr)_minmax(0,2fr)]">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Search</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="WO, tire SN, customer, injury, job, material"
                  className="h-10 rounded-md pl-9"
                />
              </div>
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Dari Tanggal</span>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} className="h-10 rounded-md pl-9" />
                </div>
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Sampai Tanggal</span>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="date" value={endDate} min={startDate || undefined} max={formatDateInput(new Date())} onChange={(event) => setEndDate(event.target.value)} className="h-10 rounded-md pl-9" />
                </div>
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Status</span>
                <MultiSelectFilter label="Semua status" value={statusFilters} options={filterOptions.statuses} onChange={setStatusFilters} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Injury</span>
                <MultiSelectFilter label="Semua injury" value={injuryFilters} options={filterOptions.injuries} onChange={setInjuryFilters} />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Customer</span>
              <MultiSelectFilter label="Semua customer" value={customerFilters} options={filterOptions.customers} onChange={setCustomerFilters} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Site</span>
              <MultiSelectFilter label="Semua site" value={siteFilters} options={filterOptions.sites} onChange={setSiteFilters} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Size</span>
              <MultiSelectFilter label="Semua size" value={sizeFilters} options={filterOptions.sizes} onChange={setSizeFilters} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Brand</span>
              <MultiSelectFilter label="Semua brand" value={brandFilters} options={filterOptions.brands} onChange={setBrandFilters} />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Material</span>
              <MultiSelectFilter label="Semua material" value={materialFilters} options={filterOptions.materials} onChange={setMaterialFilters} />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <Badge variant="outline" className="gap-1 rounded-md px-3 py-1">
              <Filter className="h-3.5 w-3.5" />
              {formatNumber(dashboard.summary.totalWorkOrders)} dari {formatNumber(initialDashboardData.summary.totalWorkOrders)} WO
            </Badge>
            {activeFilters.map((filter) => (
              <Badge key={`${filter.label}-${filter.value}`} variant="secondary" className="gap-1 rounded-md px-3 py-1">
                {filter.label}: {filter.value}
                <button type="button" onClick={filter.clear} aria-label={`Hapus filter ${filter.label}`}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {(activeFilters.length > 0 || query.trim().length > 0) ? (
              <Button type="button" variant="ghost" size="sm" className="h-8 gap-2 rounded-md active:scale-[0.96]" onClick={resetFilters}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total WO" value={formatNumber(dashboard.summary.totalWorkOrders)} description="Work order repair dalam filter aktif." icon={Wrench} tone="blue" />
        <StatCard title="Progress" value={formatNumber(dashboard.summary.progressWorkOrders)} description={`${formatNumber(progressRate, 1)}% masih berjalan dan perlu dipantau.`} icon={Activity} tone="orange" />
        <StatCard title="Complete" value={formatNumber(dashboard.summary.completeWorkOrders)} description={`${formatNumber(completionRate, 1)}% sudah selesai dari WO terfilter.`} icon={BadgeCheck} tone="green" />
        <StatCard title="Total Waktu" value={formatMinutes(dashboard.summary.totalMinutes)} description={`Rata-rata ${formatMinutes(dashboard.summary.averageMinutesPerWorkOrder)} per WO.`} icon={Clock3} tone="violet" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Material Line" value={formatNumber(dashboard.summary.totalMaterialRows)} description="Baris material dari detail pekerjaan." icon={PackageSearch} tone="cyan" />
        <StatCard title="Customer Aktif" value={formatNumber(dashboard.summary.activeCustomers)} description="Customer unik pada filter aktif." icon={Users} tone="rose" />
        <StatCard title="Site Aktif" value={formatNumber(dashboard.summary.activeSites)} description="Site unik yang muncul di WO repair." icon={Factory} tone="green" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-lg border-border/70 py-0 shadow-sm">
          <CardHeader className="px-7 py-6">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="h-4 w-4 text-blue-500" />
              Status & Aging Pipeline
            </CardTitle>
            <CardDescription className="pt-1">Komposisi status dan umur WO sejak received date.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 px-7 pb-7 lg:grid-cols-2">
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie data={dashboard.statusBreakdown} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={3}>
                  {dashboard.statusBreakdown.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <BarChart data={dashboard.agingBuckets} margin={{ left: -20, right: 12, top: 10, bottom: 5 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {dashboard.agingBuckets.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[(index + 2) % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <HorizontalRanking
          title="Injury Paling Dominan"
          description="Klik injury untuk langsung memfilter dashboard."
          data={dashboard.injuryBreakdown}
          color="bg-rose-500"
          onSelect={(value) => addFilter(setInjuryFilters, value)}
        />
      </div>

      <Tabs defaultValue="material" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-lg bg-muted p-1 md:w-fit md:grid-cols-4">
          <TabsTrigger value="material" className="rounded-md">Material</TabsTrigger>
          <TabsTrigger value="customer" className="rounded-md">Customer</TabsTrigger>
          <TabsTrigger value="process" className="rounded-md">Process Time</TabsTrigger>
          <TabsTrigger value="tire" className="rounded-md">Tire Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="material" className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <MaterialList data={dashboard.materialUsage} onSelect={(value) => addFilter(setMaterialFilters, value)} />
          <Card className="h-[430px] rounded-lg border-border/70 py-0 shadow-sm">
            <CardHeader className="shrink-0 px-6 py-5">
              <CardTitle className="text-base">Material Category Mix</CardTitle>
              <CardDescription className="pt-1">Distribusi kategori material dari detail WO.</CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 px-6 pb-5">
              <ChartContainer config={chartConfig} className="h-full min-h-[300px] w-full">
                <BarChart data={dashboard.materialCategories} layout="vertical" margin={{ left: 20, right: 22 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={100} fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#f97316" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customer" className="grid gap-4 lg:grid-cols-2">
          <HorizontalRanking title="Top Customer" description="Customer dengan WO repair terbanyak." data={dashboard.topCustomers} color="bg-blue-500" onSelect={(value) => addFilter(setCustomerFilters, value)} />
          <HorizontalRanking title="Top Site" description="Lokasi site dengan frekuensi WO terbesar." data={dashboard.topSites} color="bg-cyan-500" onSelect={(value) => addFilter(setSiteFilters, value)} />
        </TabsContent>

        <TabsContent value="process" className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="rounded-lg border-border/70 py-0 shadow-sm">
            <CardHeader className="px-7 py-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TimerReset className="h-4 w-4 text-violet-500" />
                    Job Time Bottleneck
                  </CardTitle>
                  <CardDescription className="pt-1">
                    {processMetric === "total" ? "Total jam per proses pekerjaan." : "Rata-rata jam per proses pekerjaan."}
                  </CardDescription>
                </div>
                <div className="grid w-fit grid-cols-2 rounded-md bg-muted p-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={processMetric === "total" ? "secondary" : "ghost"}
                    className="h-8 rounded-sm px-3 text-xs"
                    onClick={() => setProcessMetric("total")}
                  >
                    Total
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={processMetric === "average" ? "secondary" : "ghost"}
                    className="h-8 rounded-sm px-3 text-xs"
                    onClick={() => setProcessMetric("average")}
                  >
                    Rata-rata
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-7 pb-7">
              <ChartContainer config={chartConfig} className="h-[360px] w-full">
                <AreaChart data={processChartData} margin={{ left: -18, right: 16, top: 10, bottom: 35 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={10} angle={-20} textAnchor="end" height={55} />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="value" name="jam" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.22} strokeWidth={3} />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <JobFrequencyRanking data={dashboard.jobTimeBreakdown} />
        </TabsContent>

        <TabsContent value="tire" className="grid gap-4 lg:grid-cols-3">
          <HorizontalRanking title="Top Size" description="Ukuran ban paling sering masuk repair." data={dashboard.topSizes} color="bg-emerald-500" onSelect={(value) => addFilter(setSizeFilters, value)} />
          <HorizontalRanking title="Top Brand" description="Brand paling sering muncul di WIP Repair." data={dashboard.topBrands} color="bg-amber-500" onSelect={(value) => addFilter(setBrandFilters, value)} />
          <HorizontalRanking title="Injury Mix" description="Klik untuk memfilter injury." data={dashboard.injuryBreakdown} color="bg-rose-500" onSelect={(value) => addFilter(setInjuryFilters, value)} />
        </TabsContent>
      </Tabs>

      <Card className="overflow-hidden rounded-lg border-border/70 py-0 shadow-sm">
        <CardHeader className="border-b bg-muted/30 px-8 py-6">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            WO Dengan Waktu Proses Tertinggi
          </CardTitle>
          <CardDescription>Drilldown cepat untuk WO yang paling berat berdasarkan total menit detail pekerjaan.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">WO</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Customer / Site</th>
                  <th className="px-4 py-3">Tire</th>
                  <th className="px-4 py-3">Injury</th>
                  <th className="px-4 py-3">Material</th>
                  <th className="px-4 py-3">Aging</th>
                  <th className="px-4 py-3 text-right">Waktu</th>
                </tr>
              </thead>
              <tbody>
                {topWorkOrders.length > 0 ? (
                  topWorkOrders.map((item) => (
                    <tr key={item.insightKey} className="border-t">
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{item.wo}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="rounded-full">{item.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.customer}</div>
                        <div className="text-xs text-muted-foreground">{item.site}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.tireSn}</div>
                        <div className="text-xs text-muted-foreground">{item.brand} · {item.size}</div>
                      </td>
                      <td className="px-4 py-3">{item.injury}</td>
                      <td className="px-4 py-3">{formatNumber(item.materialRows)} / {formatNumber(item.detailRows)} line</td>
                      <td className="px-4 py-3">{item.agingDays === null ? "-" : `${formatNumber(item.agingDays)} hari`}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatMinutes(item.totalMinutes)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                      Data tidak ditemukan untuk filter saat ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-right text-xs text-muted-foreground">
        Dashboard dibuat dari {formatNumber(dashboard.summary.totalDetailRows)} baris detail dan diperbarui mengikuti cache API WIP Repair.
      </p>
    </div>
  )
}
