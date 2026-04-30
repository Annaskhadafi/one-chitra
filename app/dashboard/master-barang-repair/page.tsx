import { ClipboardList, MapPin, Wrench } from "lucide-react"

import { getRepairMasterData } from "@/app/actions/repair-master"
import { RepairMasterClient } from "./_components/repair-master-client"

export default async function MasterBarangRepairPage() {
  const data = await getRepairMasterData()

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Wrench className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ClipboardList className="h-4 w-4" />
              <span>Master Data</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Master Barang Repair</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Kelola katalog material repair dan daftar site repair dalam satu halaman.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{data.sites.length.toLocaleString("id-ID")} site repair</span>
        </div>
      </div>

      <RepairMasterClient initialItems={data.items} initialSites={data.sites} />
    </div>
  )
}
