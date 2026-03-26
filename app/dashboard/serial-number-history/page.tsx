import { Suspense } from "react"
import { getSerialNumberHistory } from "@/app/actions/serial-number"
import { SerialNumberTable } from "./_components/serial-number-table"
import { Barcode, Loader2 } from "lucide-react"

async function SerialNumberContent() {
    const data = await getSerialNumberHistory()
    return <SerialNumberTable data={data} />
}

export default function SerialNumberHistoryPage() {
    return (
        <div className="flex flex-col gap-6 p-4 md:p-8">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Barcode className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Serial Number History</h1>
                    <p className="text-sm text-muted-foreground">
                        Riwayat semua serial number dari Delivery Order dan E-VHS
                    </p>
                </div>
            </div>

            <Suspense
                fallback={
                    <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Memuat data serial number...</span>
                    </div>
                }
            >
                <SerialNumberContent />
            </Suspense>
        </div>
    )
}
