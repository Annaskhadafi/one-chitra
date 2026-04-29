import { Suspense } from "react"
import { Loader2 } from "lucide-react"

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
    <div className="bg-slate-50 p-4 md:p-6">
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center gap-2 rounded-lg border bg-white text-muted-foreground">
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
