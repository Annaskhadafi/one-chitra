import { Suspense } from "react"
import { ClipboardList, Loader2, Wrench } from "lucide-react"

import { getRepairMasterData } from "@/app/actions/repair-master"
import { getWipRepairData, getWipRepairWorkOrderDetails, getWipRepairInvoiceMappings } from "@/app/actions/wip-repair"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { WipRepairTable } from "./_components/wip-repair-table"

function normalizeValue(value: string | null | undefined) {
  return value?.trim() || "-"
}

async function WipRepairContent() {
  const [data, workOrderDetails, repairMasterData] = await Promise.all([
    getWipRepairData(),
    getWipRepairWorkOrderDetails(),
    getRepairMasterData(),
  ])

  // Extract all unique WO numbers
  const woNumbers = Array.from(new Set(data.map(item => normalizeValue(item.wo)).filter(wo => wo !== "-")))
  
  // Fetch invoice mappings
  const invoiceMappings = await getWipRepairInvoiceMappings(woNumbers)

  const progressCount = data.filter((item) => item.status.toLowerCase().includes("progress")).length
  const siteCount = new Set(data.map((item) => normalizeValue(item.site)).filter((item) => item !== "-")).size
  const brandCount = new Set(data.map((item) => normalizeValue(item.brand)).filter((item) => item !== "-")).size

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription>Total WO Repair</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">{data.length.toLocaleString("id-ID")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Seluruh work order repair yang tersedia dari API central services.</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription>Status Progress</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">{progressCount.toLocaleString("id-ID")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Work order yang masih berjalan dan perlu dimonitor.</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription>Cakupan Site / Brand</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">{siteCount.toLocaleString("id-ID")} / {brandCount.toLocaleString("id-ID")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Jumlah site dan brand unik yang sedang muncul pada WIP repair.</p>
          </CardContent>
        </Card>
      </div>

      <WipRepairTable
        data={data}
        workOrderDetails={workOrderDetails}
        invoiceMappings={invoiceMappings}
        repairMasterItems={repairMasterData.items.map((item) => ({
          materialCode: item.materialCode,
          materialName: item.materialName,
          uom: item.uom,
        }))}
        repairMasterSites={repairMasterData.sites.map((site) => ({
          siteCode: site.siteCode,
          siteName: site.siteName,
        }))}
      />
    </div>
  )
}

export default function WipRepairPage() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
          <Wrench className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Central Services</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight [text-wrap:balance]">WIP Repair</h1>
          <p className="max-w-3xl text-sm text-muted-foreground [text-wrap:pretty]">
            Monitoring work order repair dari central services untuk memantau status pengerjaan, tire serial number, customer, dan lokasi site.
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Memuat data WIP Repair...</span>
          </div>
        }
      >
        <WipRepairContent />
      </Suspense>
    </div>
  )
}
