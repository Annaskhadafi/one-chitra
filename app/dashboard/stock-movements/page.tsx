import { getStockMovements } from "@/app/actions/stock-movement"
import { getWarehouses } from "@/app/actions/warehouse"
import { MovementTable } from "./_components/movement-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportBarChart, ReportPieChart } from "@/components/reports/report-charts"
import { ArrowUpRight, ArrowDownLeft, Activity, ListChecks } from "lucide-react"

export default async function StockMovementsPage() {
    const [movements, warehouses] = await Promise.all([
        getStockMovements(),
        getWarehouses()
    ])

    // KPI Calculations
    const today = new Date().toISOString().split('T')[0]
    const movementsToday = movements.filter(m => m.createdAt.toISOString().startsWith(today))

    const stockInTypes = ["GR_SAP", "GR_MANUAL", "TRANSFER_IN"]
    const stockOutTypes = ["DELIVERY", "TRANSFER_OUT"]

    const totalIn = movements.filter(m => stockInTypes.includes(m.type)).reduce((sum, m) => sum + m.quantity, 0)
    const totalOut = movements.filter(m => stockOutTypes.includes(m.type)).reduce((sum, m) => sum + m.quantity, 0)

    // Chart Data: Movements by Type
    const typeDistributionMap: Record<string, number> = {}
    movements.forEach(m => {
        typeDistributionMap[m.type] = (typeDistributionMap[m.type] || 0) + 1
    })

    const typeData = Object.entries(typeDistributionMap).map(([name, value]) => ({
        name,
        value
    })).sort((a, b) => b.value - a.value)

    // Chart Data: Quantity by Type
    const qtyByTypeMap: Record<string, number> = {}
    movements.forEach(m => {
        qtyByTypeMap[m.type] = (qtyByTypeMap[m.type] || 0) + m.quantity
    })

    const qtyData = Object.entries(qtyByTypeMap).map(([name, value]) => ({
        name,
        value
    })).sort((a, b) => b.value - a.value)

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight">Stock Movement Log</h1>
                <p className="text-muted-foreground">
                    Track all incoming and outgoing stock transactions.
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Gerakan Hari Ini</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{movementsToday.length}</div>
                        <p className="text-xs text-muted-foreground">Transaksi yang tercatat hari ini</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Stock In</CardTitle>
                        <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalIn.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Total unit masuk (GR & Transfer In)</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Stock Out</CardTitle>
                        <ArrowUpRight className="h-4 w-4 text-rose-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalOut.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Total unit keluar (Delivery & Transfer Out)</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Total Transaksi</CardTitle>
                        <ListChecks className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{movements.length}</div>
                        <p className="text-xs text-muted-foreground">Seluruh riwayat pergerakan</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <ReportPieChart
                        data={typeData}
                        title="Distribusi Tipe Gerakan"
                        description="Berdasarkan jumlah transaksi per tipe"
                        variant="donut"
                        height={350}
                    />
                </div>
                <div className="lg:col-span-2">
                    <ReportBarChart
                        data={qtyData}
                        title="Volume Gerakan per Tipe"
                        description="Berdasarkan total quantity unit yang bergerak"
                        height={350}
                    />
                </div>
            </div>

            <div className="flex-1">
                <MovementTable
                    data={movements}
                    warehouses={warehouses}
                />
            </div>
        </div>
    )
}
