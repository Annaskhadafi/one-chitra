import { getStockCardCatalogAction } from "@/app/actions/stock-card"
import { AutoCloseSidebar } from "@/components/auto-close-sidebar"
import { PageHeader } from "@/components/page-header"
import { QrCode } from "lucide-react"
import { StockCardManager } from "./_components/stock-card-manager"

export const dynamic = "force-dynamic"

export default async function StockCardPage() {
    const data = await getStockCardCatalogAction()

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <AutoCloseSidebar />
            <PageHeader
                title="Stock Card"
                subtitle="Cetak stiker barcode per produk dan warehouse, lalu gunakan hasil scan untuk melihat stok dan histori order tanpa price."
                icon={QrCode}
            />

            <StockCardManager data={data} />
        </div>
    )
}
