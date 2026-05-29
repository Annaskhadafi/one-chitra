"use client"

import { useEffect, useState, type ComponentType } from "react"
import { toPng } from "html-to-image"
import jsPDF from "jspdf"

import {
  ArrowDownToLine,
  BarChart3,
  Boxes,
  BrainCircuit,
  ClipboardCheck,
  Cog,
  Database,
  FileClock,
  FileText,
  Gauge,
  History,
  LockKeyhole,
  Mail,
  MailCheck,
  PackageCheck,
  PackageSearch,
  Printer,
  Route,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Truck,
  UsersRound,
  Wrench,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { navigationConfig } from "@/lib/navigation"
import { dashboardRoutePermissionRules } from "@/lib/route-permissions"
import { cn } from "@/lib/utils"

type FeatureNode = {
  id: string
  title: string
  subtitle: string
  color: string
  ring: string
  x: number
  y: number
  icon: ComponentType<{ className?: string }>
  features: string[]
}

type FlowLink = {
  from: string
  to: string
  label: string
  tone: "sales" | "ops" | "control" | "insight"
}

const featureNodes: FeatureNode[] = [
  {
    id: "master",
    title: "Master Data",
    subtitle: "Fondasi item, customer, warehouse",
    color: "bg-slate-900 text-white",
    ring: "border-slate-300",
    x: 14,
    y: 23,
    icon: Database,
    features: ["Products", "Bundling", "Warehouse", "Customer 360", "Industry Mapping"],
  },
  {
    id: "sales",
    title: "Sales Engine",
    subtitle: "Dari quotation sampai order",
    color: "bg-emerald-600 text-white",
    ring: "border-emerald-200",
    x: 38,
    y: 23,
    icon: ShoppingCart,
    features: ["Quotations", "Sales Order", "OCR PO", "Proforma", "Sales Document"],
  },
  {
    id: "inbound",
    title: "Inbound",
    subtitle: "Vendor dan penerimaan barang",
    color: "bg-cyan-600 text-white",
    ring: "border-cyan-200",
    x: 14,
    y: 51,
    icon: ArrowDownToLine,
    features: ["Good Receive SAP", "Good Receive Manual", "EPR Integrasi", "Vendor Quotation"],
  },
  {
    id: "inventory",
    title: "Inventory Control",
    subtitle: "Stock aktual, SAP, opname, reorder",
    color: "bg-blue-700 text-white",
    ring: "border-blue-200",
    x: 50,
    y: 51,
    icon: Boxes,
    features: ["Inventory", "Stocks", "Stock Card", "Movement Log", "Opname", "Safety Stock", "Procurement Next"],
  },
  {
    id: "outbound",
    title: "Outbound Ops",
    subtitle: "Delivery, DO, armada, voucher",
    color: "bg-orange-600 text-white",
    ring: "border-orange-200",
    x: 64,
    y: 23,
    icon: Truck,
    features: ["Deliveries", "Planning Board", "DO Monitoring", "Fleet Management", "E-VHS", "Serial Number"],
  },
  {
    id: "billing",
    title: "Billing & Cost",
    subtitle: "Biaya, billing, settlement",
    color: "bg-amber-500 text-slate-950",
    ring: "border-amber-200",
    x: 64,
    y: 79,
    icon: FileText,
    features: ["Billing", "Logistics Cost", "Master Price Delivery", "Request Cost", "Cost Fuel"],
  },
  {
    id: "marketing",
    title: "Marketing CRM",
    subtitle: "Campaign, history, content, form",
    color: "bg-rose-600 text-white",
    ring: "border-rose-200",
    x: 39,
    y: 79,
    icon: Mail,
    features: ["Campaign Manager", "Instagram Generator", "Email Lists", "Calendar", "Survey Builder", "Slow Moving"],
  },
  {
    id: "repair",
    title: "Repair Service",
    subtitle: "WIP dan master barang repair",
    color: "bg-violet-600 text-white",
    ring: "border-violet-200",
    x: 88,
    y: 79,
    icon: Wrench,
    features: ["WIP Dashboard", "WIP Repair Table", "Master Barang Repair"],
  },
  {
    id: "analytics",
    title: "Analytics Layer",
    subtitle: "Report, forecast, dashboard, ML",
    color: "bg-indigo-700 text-white",
    ring: "border-indigo-200",
    x: 88,
    y: 23,
    icon: BarChart3,
    features: ["Dashboard", "Sales Dashboard", "R49", "Revenue Forecast", "ABC", "Quotation Analysis", "Reports Hub"],
  },
  {
    id: "governance",
    title: "Governance",
    subtitle: "Approval, security, audit, settings",
    color: "bg-zinc-800 text-white",
    ring: "border-zinc-300",
    x: 14,
    y: 79,
    icon: ShieldCheck,
    features: ["Approval Inbox", "Matrix Approval", "Workflow Settings", "Roles", "Users", "Sessions", "Audit Log"],
  },
]

const flows: FlowLink[] = [
  { from: "master", to: "sales", label: "product, customer, price context", tone: "sales" },
  { from: "sales", to: "outbound", label: "SO -> delivery execution", tone: "ops" },
  { from: "inbound", to: "inventory", label: "receipt updates stock", tone: "control" },
  { from: "inventory", to: "outbound", label: "availability, SN, transfer", tone: "ops" },
  { from: "outbound", to: "billing", label: "DO, fleet, fuel cost", tone: "ops" },
  { from: "sales", to: "analytics", label: "revenue, customer, GP", tone: "insight" },
  { from: "inventory", to: "analytics", label: "stock risk, ABC, ML", tone: "insight" },
  { from: "billing", to: "analytics", label: "margin and settlement", tone: "insight" },
  { from: "marketing", to: "sales", label: "campaign -> pipeline", tone: "sales" },
  { from: "repair", to: "inventory", label: "parts and WIP usage", tone: "control" },
  { from: "governance", to: "sales", label: "approval gate", tone: "control" },
  { from: "governance", to: "billing", label: "audit and access", tone: "control" },
]

const inventoryIcons: Record<string, ComponentType<{ className?: string }>> = {
  Main: Route,
  "SCM Management": Truck,
  "Business & Analytics": Sparkles,
  "Central Services": Wrench,
  Approval: ClipboardCheck,
  "System Management": ShieldCheck,
}

const toTitleCase = (value: string) =>
  value
    .replace(/^\/dashboard\/?/, "")
    .replace(/\[[^\]]+\]/g, "detail")
    .replace(/[/-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim() || "Dashboard"

const uniqueList = (items: string[]) => Array.from(new Set(items.filter(Boolean)))

const navigationUrls = new Set<string>()
for (const section of navigationConfig) {
  for (const item of section.items) {
    if (item.url !== "#") navigationUrls.add(item.url)
    for (const subItem of item.items ?? []) {
      if (subItem.url !== "#") navigationUrls.add(subItem.url)
    }
  }
}

const ecosystemBands = [
  ...navigationConfig.map((section) => ({
    title: section.title,
    icon: inventoryIcons[section.title] ?? Route,
    items: uniqueList(
      section.items.flatMap((item) => [
        item.title,
        ...(item.items ?? []).map((subItem) => subItem.title),
      ]),
    ),
  })),
  {
    title: "Other Routes",
    icon: BrainCircuit,
    items: uniqueList(
      dashboardRoutePermissionRules
        .filter((rule) => rule.prefix.startsWith("/dashboard"))
        .filter((rule) => !navigationUrls.has(rule.prefix))
        .map((rule) => toTitleCase(rule.prefix)),
    ),
  },
]

const toneStroke: Record<FlowLink["tone"], string> = {
  sales: "#059669",
  ops: "#ea580c",
  control: "#334155",
  insight: "#4f46e5",
}

const nodeById = new Map(featureNodes.map((node) => [node.id, node]))

const controlAccessItems = [
  {
    title: "RBAC",
    body: "Role, resource, permission",
    icon: ShieldCheck,
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  {
    title: "Approval matrix",
    body: "Inbox, routing, authority",
    icon: ClipboardCheck,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  {
    title: "Audit trail",
    body: "Activity log & session trace",
    icon: History,
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
  {
    title: "Navbar settings",
    body: "Menu, theme, visibility",
    icon: Cog,
    className: "border-slate-200 bg-slate-100 text-slate-700",
  },
  {
    title: "Email settings",
    body: "SMTP, template, reminder",
    icon: MailCheck,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  {
    title: "Knowledge Chitra",
    body: "AI context and training base",
    icon: BrainCircuit,
    className: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
  },
]

const businessOutputItems = [
  {
    title: "Revenue visibility",
    body: "Sales dashboard, R49, forecast, top customers",
    icon: TrendingUp,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  {
    title: "Stock accuracy",
    body: "SAP feed, movement, opname, reorder alert",
    icon: PackageSearch,
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  {
    title: "Delivery control",
    body: "Planning board, DO, fleet, E-VHS, serial number",
    icon: Truck,
    className: "border-orange-200 bg-orange-50 text-orange-700",
  },
  {
    title: "Cost governance",
    body: "Logistics cost, master price, fuel, billing",
    icon: FileClock,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  {
    title: "Customer intelligence",
    body: "Customer 360, segmentation, industry, tire history",
    icon: UsersRound,
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
]

function FeatureCard({ node }: { node: FeatureNode }) {
  const Icon = node.icon

  return (
    <div
      className={cn(
        "absolute w-[156px] rounded-lg border bg-white p-2 shadow-[0_12px_28px_rgba(15,23,42,0.08)]",
        node.ring,
      )}
      style={{ left: `${node.x}%`, top: `${node.y}%`, transform: "translate(-50%, -50%)" }}
    >
      <div className="flex items-start gap-2">
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", node.color)}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold leading-tight text-slate-950">{node.title}</div>
          <div className="mt-0.5 text-[8px] font-medium leading-tight text-slate-500">{node.subtitle}</div>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {node.features.map((feature) => (
          <span
            key={feature}
            className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[6.5px] font-medium leading-tight text-slate-700"
          >
            {feature}
          </span>
        ))}
      </div>
    </div>
  )
}

function FlowCanvas() {
  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-lg border border-slate-200 bg-[linear-gradient(90deg,rgba(248,250,252,0.96)_0_25%,rgba(236,253,245,0.60)_25%_50%,rgba(255,247,237,0.58)_50%_76%,rgba(238,242,255,0.70)_76%_100%)]">
      <div className="absolute inset-x-4 top-3 z-10 grid grid-cols-4 gap-3 text-[8px] font-bold uppercase tracking-[0.14em] text-slate-400">
        <div>Foundation</div>
        <div>Commercial</div>
        <div>Operation</div>
        <div>Insight</div>
      </div>
      <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          {Object.entries(toneStroke).map(([tone, color]) => (
            <marker key={tone} id={`arrow-${tone}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 Z" fill={color} opacity="0.8" />
            </marker>
          ))}
        </defs>
        {flows.map((flow) => {
          const from = nodeById.get(flow.from)
          const to = nodeById.get(flow.to)
          if (!from || !to) return null

          const midX = (from.x + to.x) / 2
          const fromY = from.y
          const toY = to.y
          const routeY = flow.tone === "control" ? Math.max(fromY, toY) + 4 : (fromY + toY) / 2

          return (
            <g key={`${flow.from}-${flow.to}`}>
              <path
                d={`M ${from.x} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${to.x} ${toY}`}
                fill="none"
                stroke={toneStroke[flow.tone]}
                strokeWidth={flow.tone === "control" ? "0.36" : "0.44"}
                strokeLinecap="round"
                strokeDasharray={flow.tone === "control" ? "1.1 1.2" : undefined}
                opacity={flow.tone === "control" ? "0.42" : "0.48"}
                markerEnd={`url(#arrow-${flow.tone})`}
              />
              {flow.tone === "control" && (
                <path
                  d={`M ${from.x} ${fromY} L ${midX} ${routeY} L ${to.x} ${toY}`}
                  fill="none"
                  stroke={toneStroke[flow.tone]}
                  strokeWidth="0.18"
                  strokeLinecap="round"
                  strokeDasharray="0.7 1.2"
                  opacity="0.18"
                />
              )}
            </g>
          )
        })}
      </svg>

      {featureNodes.map((node) => (
        <FeatureCard key={node.id} node={node} />
      ))}
    </div>
  )
}

export function FeatureMapClient() {
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    const resetScroll = () => {
      window.history.scrollRestoration = "manual"
      window.scrollTo({ top: 0, left: 0 })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }

    resetScroll()
    const shortTimer = window.setTimeout(resetScroll, 80)
    const restoreTimer = window.setTimeout(resetScroll, 320)

    return () => {
      window.clearTimeout(shortTimer)
      window.clearTimeout(restoreTimer)
    }
  }, [])

  const handleExportPdf = async () => {
    const element = document.getElementById("one-chitra-feature-map")
    if (!element || isExporting) return

    setIsExporting(true)
    try {
      const rect = element.getBoundingClientRect()
      const width = Math.round(rect.width)
      const height = Math.round(rect.height)
      const dataUrl = await toPng(element, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 2.5,
        width,
        height,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          transform: "none",
        },
      })

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [width, height],
        compress: true,
      })

      pdf.addImage(dataUrl, "PNG", 0, 0, width, height, undefined, "FAST")
      pdf.save("one-chitra-feature-map.pdf")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <main className="min-h-[calc(100vh-var(--header-height))] bg-slate-100 px-4 pb-4 pt-14 text-slate-950 lg:px-6">
      <style jsx global>{`
        @page {
          size: 16in 9in landscape;
          margin: 0;
        }

        @media print {
          body * {
            visibility: hidden;
          }

          #one-chitra-feature-map,
          #one-chitra-feature-map * {
            visibility: visible;
          }

          #one-chitra-feature-map {
            position: fixed;
            inset: 0;
            width: 100vw !important;
            height: 100vh !important;
            box-shadow: none !important;
          }

          .feature-map-no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="feature-map-no-print mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-normal text-slate-950">One Chitra Feature Map</h1>
          <p className="text-sm text-slate-600">Satu halaman 16:9 untuk melihat hubungan fitur besar sebelum export PDF.</p>
        </div>
        <Button onClick={handleExportPdf} disabled={isExporting} className="gap-2">
          <Printer className="size-4" />
          {isExporting ? "Preparing PDF" : "Export PDF"}
        </Button>
      </div>

      <section
        id="one-chitra-feature-map"
        className="mx-auto aspect-video w-full max-w-[1600px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl print:rounded-none print:border-0"
      >
        <div className="grid h-full grid-rows-[70px_1fr_226px] gap-3 p-5">
          <header className="grid grid-cols-[1fr_292px] items-start gap-5 border-b border-slate-200 pb-3">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                <PackageCheck className="size-3.5" />
                One Chitra System Blueprint
              </div>
              <h2 className="mt-1 text-[30px] font-bold leading-none tracking-normal text-slate-950">
                Peta fitur besar dan hubungan proses end-to-end
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2 text-right">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-[22px] font-bold leading-none text-slate-950">10</div>
                <div className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">domain utama</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="text-[22px] font-bold leading-none text-slate-950">85+</div>
                <div className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">fitur terhubung</div>
              </div>
            </div>
          </header>

          <div className="grid min-h-0 grid-cols-[218px_1fr_226px] gap-3">
            <aside className="flex min-h-0 flex-col rounded-lg border border-blue-100 bg-gradient-to-b from-blue-50 via-white to-violet-50 p-3 shadow-[0_12px_28px_rgba(37,99,235,0.08)]">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                <span className="flex size-7 items-center justify-center rounded-md bg-slate-900 text-white shadow-sm">
                  <LockKeyhole className="size-3.5" />
                </span>
                Control & akses
              </div>
              <div className="space-y-2 text-[9px] leading-snug text-slate-600">
                <p>
                  Semua fitur berada di shell dashboard, dikendalikan oleh resource permission, roles, users, sessions, dan audit log.
                </p>
                <p>
                  Approval layer mengunci transaksi penting seperti quotation, cost request, dan workflow operasional sebelum masuk proses berikutnya.
                </p>
              </div>
              <div className="mt-3 grid gap-1.5">
                {controlAccessItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.title} className="rounded-md border border-white/80 bg-white/90 p-1.5 shadow-[0_6px_16px_rgba(15,23,42,0.06)]">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md border", item.className)}>
                          <Icon className="size-3.5" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[8.5px] font-bold leading-tight text-slate-900">{item.title}</div>
                          <div className="mt-0.5 text-[6.8px] font-semibold leading-tight text-slate-500">{item.body}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </aside>

            <div className="grid min-h-0 grid-rows-[1fr] gap-2">
              <FlowCanvas />
            </div>

            <aside className="flex min-h-0 flex-col rounded-lg border border-emerald-100 bg-gradient-to-b from-emerald-50 via-white to-amber-50 p-3 shadow-[0_12px_28px_rgba(16,185,129,0.08)]">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                <span className="flex size-7 items-center justify-center rounded-md bg-emerald-600 text-white shadow-sm">
                  <Gauge className="size-3.5" />
                </span>
                Output bisnis
              </div>
              <div className="grid gap-1.5">
                {businessOutputItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.title} className="rounded-md border border-white/80 bg-white/90 p-2 shadow-[0_6px_16px_rgba(15,23,42,0.06)]">
                      <div className="flex items-start gap-1.5">
                        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md border", item.className)}>
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[9px] font-bold leading-tight text-slate-900">{item.title}</div>
                          <div className="mt-0.5 text-[7px] font-semibold leading-snug text-slate-500">{item.body}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </aside>
          </div>

          <footer className="grid min-h-0 grid-cols-4 gap-2">
            {ecosystemBands.map((band) => {
              const Icon = band.icon
              return (
                <div key={band.title} className="min-h-0 rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[8.5px] font-bold leading-none text-slate-900">
                    <Icon className="size-3.5 shrink-0 text-slate-600" />
                    <span className="truncate">{band.title}</span>
                  </div>
                  <div className="flex flex-wrap content-start gap-1">
                    {band.items.map((item) => (
                      <span key={item} className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[5.5px] font-semibold leading-none text-slate-600">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </footer>
        </div>
      </section>
    </main>
  )
}
