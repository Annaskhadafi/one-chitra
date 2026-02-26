import { getStocks } from "@/app/actions/stock"
import { getProducts } from "@/app/actions/product"
import { getWarehouses } from "@/app/actions/warehouse"
import { getSetting } from "@/app/actions/settings"
import { StockTable } from "./_components/stock-table"
import { StackedBarChart } from "@/components/reports/report-charts"

export default async function StocksPage() {
    // Force re-compile to fix module factory error
    const [stocks, products, warehouses, savedRate] = await Promise.all([
        getStocks(),
        getProducts(),
        getWarehouses(),
        getSetting("manual_usd_rate")
    ])

    // Stacked Bar Chart Data
    const warehouseData = warehouses
        .map(w => {
            const wStocks = stocks.filter(s => s.warehouseId === w.id)
            const normal = wStocks.filter(s => s.totalStock > s.minStock).length
            const low = wStocks.filter(s => s.totalStock > 0 && s.totalStock <= s.minStock).length
            const out = wStocks.filter(s => s.totalStock <= 0).length

            return {
                name: w.description || w.sloc,
                stock: normal,
                lowStock: low,
                outOfStock: out,
                hasStock: normal > 0 || low > 0
            }
        })
        .filter(w => w.hasStock) // Only show warehouses that have some stock
        .sort((a, b) => (b.stock + b.lowStock) - (a.stock + a.lowStock)) // Sort by volume for better visualization

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight">Stock Management</h1>
                <p className="text-muted-foreground">
                    Monitor inventory levels and valuations across all locations.
                </p>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 gap-6">
                <StackedBarChart
                    data={warehouseData}
                    title="Distribusi Status Stok per Gudang"
                    description="Jumlah produk berdasarkan level aman, kritis, dan kosong di setiap lokasi"
                    height={350}
                />
            </div>

            <div className="flex-1">
                <StockTable
                    data={stocks}
                    products={products}
                    warehouses={warehouses}
                    defaultRate={savedRate || "1"}
                />
            </div>
        </div>
    )
}
