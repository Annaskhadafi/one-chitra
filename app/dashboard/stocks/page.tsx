import { getStocks } from "@/app/actions/stock"
import { getProducts } from "@/app/actions/product"
import { getWarehouses } from "@/app/actions/warehouse"
import { getSetting } from "@/app/actions/settings"
import { StockTable } from "./_components/stock-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StackedBarChart, formatCurrency } from "@/components/reports/report-charts"
import { Package, DollarSign, AlertTriangle, Warehouse } from "lucide-react"

export default async function StocksPage() {
    // Force re-compile to fix module factory error
    const [stocks, products, warehouses, savedRate] = await Promise.all([
        getStocks(),
        getProducts(),
        getWarehouses(),
        getSetting("manual_usd_rate")
    ])

    const usdRate = parseFloat(savedRate || "16000")

    // KPI Calculations
    const totalValuation = stocks.reduce((sum, s) => {
        const cost = parseFloat((s as any).product?.costSap || "0")
        return sum + (s.totalStock * cost * usdRate)
    }, 0)

    const lowStockItems = stocks.filter(s => s.totalStock > 0 && s.totalStock <= s.minStock).length
    const outOfStockItems = stocks.filter(s => s.totalStock <= 0).length

    // Stacked Bar Chart Data
    const warehouseData = warehouses.map(w => {
        const wStocks = stocks.filter(s => s.warehouseId === w.id)
        return {
            name: w.description || w.sloc,
            stock: wStocks.filter(s => s.totalStock > s.minStock).length,
            lowStock: wStocks.filter(s => s.totalStock > 0 && s.totalStock <= s.minStock).length,
            outOfStock: wStocks.filter(s => s.totalStock <= 0).length,
        }
    })

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight">Stock Management</h1>
                <p className="text-muted-foreground">
                    Monitor inventory levels and valuations across all locations.
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total SKU</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{products.length}</div>
                        <p className="text-xs text-muted-foreground">Jumlah produk terdaftar</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Nilai Stok (Est.)</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalValuation)}</div>
                        <p className="text-xs text-muted-foreground">Valuasi berbasis Cost SAP (IDR)</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Items Low Stock</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{lowStockItems}</div>
                        <p className="text-xs text-muted-foreground">Produk di bawah batas minimum</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-rose-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{outOfStockItems}</div>
                        <p className="text-xs text-muted-foreground">Produk dengan stok kosong</p>
                    </CardContent>
                </Card>
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
