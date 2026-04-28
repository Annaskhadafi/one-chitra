import { Suspense } from "react"
import { BarChart3, Loader2, Sparkles } from "lucide-react"

import { getWipRepairData, getWipRepairWorkOrderDetails } from "@/app/actions/wip-repair"
import { buildWipRepairDashboardData } from "@/lib/wip-repair-dashboard"
import { WipRepairDashboardClient } from "./_components/wip-repair-dashboard-client"

async function WipRepairDashboardContent() {
  const [data, workOrderDetails] = await Promise.all([
    getWipRepairData(),
    getWipRepairWorkOrderDetails(),
  ])
  const dashboardData = buildWipRepairDashboardData(data, workOrderDetails)

  return (
    <WipRepairDashboardClient
      data={data}
      workOrderDetails={workOrderDetails}
      initialDashboardData={dashboardData}
    />
  )
}

export default function WipRepairDashboardPage() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 overflow-hidden rounded-lg border border-slate-200 bg-[linear-gradient(135deg,#fff7ed_0%,#ecfeff_40%,#f5f3ff_100%)] p-5 shadow-sm dark:border-slate-800 dark:bg-[linear-gradient(135deg,#1e1b4b_0%,#083344_45%,#111827_100%)] md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-white text-orange-600 shadow-sm ring-1 ring-orange-100 dark:bg-slate-950 dark:text-orange-300 dark:ring-orange-900/40">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                <Sparkles className="h-4 w-4 text-violet-500" />
                <span>Central Services Analytics</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 [text-wrap:balance] dark:text-white md:text-3xl">
                WIP Repair Intelligence Dashboard
              </h1>
              <p className="max-w-4xl text-sm leading-6 text-slate-700 [text-wrap:pretty] dark:text-slate-300">
                Dashboard interaktif untuk membaca injury, konsumsi material, customer/site dominan,
                status pekerjaan, aging WO, dan bottleneck waktu dari data WIP Repair.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center gap-2 rounded-lg border text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Memuat dashboard WIP Repair...</span>
          </div>
        }
      >
        <WipRepairDashboardContent />
      </Suspense>
    </div>
  )
}
