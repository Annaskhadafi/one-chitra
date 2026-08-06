import { getTireScanMasterData, getTireScansList } from "@/app/actions/tire-scan"
import { TireScanClient } from "./_components/tire-scan-client"
import Link from "next/link"
import { ArrowLeft, RadioTower } from "lucide-react"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

export default async function TireScanPage() {
    const masterData = await getTireScanMasterData()
    const historyData = await getTireScansList()

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-balance text-2xl font-bold tracking-tight">Scan Tire Serial Number (OCR)</h1>
                    <p className="text-pretty text-sm text-muted-foreground">
                        Pindai Serial Number (SN) ban dengan kamera & OCR Vision API setelah memilih Warehouse dan Material.
                    </p>
                </div>
                <div>
                    <Button variant="outline" asChild className="gap-2">
                        <Link href="/dashboard/rfid">
                            <RadioTower className="size-4" />
                            <span>Kembali ke RFID Main</span>
                        </Link>
                    </Button>
                </div>
            </div>

            <TireScanClient masterData={masterData} initialRows={historyData.rows} />
        </div>
    )
}
