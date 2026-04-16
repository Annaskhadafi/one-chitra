"use client"

import Link from "next/link"

import {
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  ClipboardList,
  LineChart,
  PackageCheck,
  ShoppingCart,
  TrendingUp,
  TriangleAlert,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type DashboardQuickAccessProps = {
  variant?: "default" | "sidebar"
}

type QuickAccessItem = {
  title: string
  href: string
  description: string
  icon: LucideIcon
  iconClassName: string
  accentClassName: string
}

const QUICK_ACCESS_ITEMS: QuickAccessItem[] = [
  {
    title: "Sales Revenue",
    href: "/dashboard/revenue-forecast",
    description: "Ringkasan sales revenue dan performanya.",
    icon: TrendingUp,
    iconClassName: "bg-emerald-50 text-emerald-600",
    accentClassName: "from-emerald-400/80 to-teal-400/80",
  },
  {
    title: "R49 Dashboard",
    href: "/dashboard/r49-dashboard",
    description: "Ringkasan performa R49 secara cepat.",
    icon: BarChart3,
    iconClassName: "bg-sky-50 text-sky-600",
    accentClassName: "from-sky-400/80 to-blue-400/80",
  },
  {
    title: "Quotations",
    href: "/dashboard/quotations",
    description: "Pantau dan buka dokumen quotation.",
    icon: ClipboardList,
    iconClassName: "bg-amber-50 text-amber-600",
    accentClassName: "from-amber-400/80 to-orange-400/80",
  },
  {
    title: "Sales Orders",
    href: "/dashboard/sales-orders",
    description: "Akses order penjualan dan statusnya.",
    icon: ShoppingCart,
    iconClassName: "bg-violet-50 text-violet-600",
    accentClassName: "from-violet-400/80 to-fuchsia-400/80",
  },
  {
    title: "Deliveries",
    href: "/dashboard/deliveries",
    description: "Kelola pengiriman yang sedang berjalan.",
    icon: Truck,
    iconClassName: "bg-rose-50 text-rose-600",
    accentClassName: "from-rose-400/80 to-pink-400/80",
  },
  {
    title: "Good Receive Manual",
    href: "/dashboard/good-receive-manual",
    description: "Penerimaan barang manual dengan cepat.",
    icon: PackageCheck,
    iconClassName: "bg-cyan-50 text-cyan-600",
    accentClassName: "from-cyan-400/80 to-teal-400/80",
  },
  {
    title: "Stock Alerts",
    href: "/dashboard/stock-alerts",
    description: "Lihat item stok yang perlu perhatian.",
    icon: TriangleAlert,
    iconClassName: "bg-red-50 text-red-600",
    accentClassName: "from-red-400/80 to-orange-400/80",
  },
  {
    title: "Customer Segmentation",
    href: "/dashboard/customer-segmentation",
    description: "Segmentasi pelanggan untuk insight sales.",
    icon: Users,
    iconClassName: "bg-indigo-50 text-indigo-600",
    accentClassName: "from-indigo-400/80 to-blue-400/80",
  },
  {
    title: "Sales Dashboard",
    href: "/dashboard/sales-dashboard",
    description: "Monitoring performa penjualan harian.",
    icon: LineChart,
    iconClassName: "bg-lime-50 text-lime-600",
    accentClassName: "from-lime-400/80 to-emerald-400/80",
  },
  {
    title: "Approvals",
    href: "/dashboard/approvals",
    description: "Cek approval yang menunggu tindakan.",
    icon: BadgeCheck,
    iconClassName: "bg-slate-100 text-slate-700",
    accentClassName: "from-slate-400/80 to-slate-500/80",
  },
]

export function DashboardQuickAccess({
  variant = "default",
}: DashboardQuickAccessProps) {
  const isSidebar = variant === "sidebar"

  return (
    <Card className="h-full border bg-card shadow-sm">
      <CardHeader className={isSidebar ? "pb-2" : "pb-3"}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-xl">Quick Access</CardTitle>
            {!isSidebar ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Shortcut cepat ke halaman yang paling sering dipakai.
              </p>
            ) : null}
          </div>
          <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-[11px]">
            10 shortcut utama
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className={isSidebar ? "grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1" : "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5"}>
          {QUICK_ACCESS_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={isSidebar
                ? "group relative overflow-hidden rounded-2xl border bg-gradient-to-r from-card via-muted/30 to-muted/50 px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                : "group relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-muted/20 to-muted/50 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"}
            >
              {isSidebar ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`inline-flex rounded-xl p-2 shadow-sm ring-1 ring-black/5 ${item.iconClassName}`}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    <p className="truncate text-[13px] font-semibold leading-5 text-foreground">{item.title}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-500" />
                </div>
              ) : (
                <>
                  <div className={`mb-4 inline-flex rounded-2xl p-2.5 shadow-sm ring-1 ring-black/5 ${item.iconClassName}`}>
                    <item.icon className="h-5 w-5" />
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-5 text-foreground">{item.title}</p>
                      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{item.description}</p>
                    </div>
                    <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-500" />
                  </div>
                </>
              )}

              <div className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${item.accentClassName} opacity-0 transition-opacity duration-200 group-hover:opacity-100`} />
            </Link>
          ))}
        </div>

        {!isSidebar ? (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-dashed bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
            <Boxes className="h-4 w-4 opacity-50" />
            Pilih salah satu modul untuk berpindah halaman lebih cepat dari dashboard utama.
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
