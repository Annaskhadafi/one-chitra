import { getStockMovements } from "@/app/actions/stock-movement"
import { getWarehouses } from "@/app/actions/warehouse"
import { MovementTable } from "./_components/movement-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ReportBarChart, ReportPieChart } from "@/components/reports/report-charts"
import { ScoreCard } from "@/components/score-card"
import { ArrowUpRight, ArrowDownLeft, Activity, ListChecks, Database, ClipboardCheck, TrendingUp } from "lucide-react"

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

    const inboundSapMovements = movements.filter(m => m.type === "GR_SAP")
    const inboundManualMovements = movements.filter(m => m.type === "GR_MANUAL")
    const inboundSapQty = inboundSapMovements.reduce((sum, m) => sum + m.quantity, 0)
    const inboundManualQty = inboundManualMovements.reduce((sum, m) => sum + m.quantity, 0)
    const inboundTotalQty = inboundSapQty + inboundManualQty

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

    const inboundSourceVolumeData = [
        { name: "Inbound SAP", value: inboundSapQty },
        { name: "Inbound Manual", value: inboundManualQty },
    ]

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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <ScoreCard
                    title="Inbound SAP"
                    value={inboundSapMovements.length}
                    description={`${inboundSapQty.toLocaleString()} unit masuk dari SAP`}
                    icon={Database}
                    gradient="from-blue-500/10 via-blue-400/5 to-cyan-500/10 border-blue-200/50 hover:shadow-lg"
                    iconColor="text-blue-600"
                    textColor="text-blue-900"
                />
                <ScoreCard
                    title="Inbound Manual"
                    value={inboundManualMovements.length}
                    description={`${inboundManualQty.toLocaleString()} unit masuk manual`}
                    icon={ClipboardCheck}
                    gradient="from-emerald-500/10 via-emerald-400/5 to-teal-500/10 border-emerald-200/50 hover:shadow-lg"
                    iconColor="text-emerald-600"
                    textColor="text-emerald-900"
                />
                <ScoreCard
                    title="Total Inbound Qty"
                    value={inboundTotalQty.toLocaleString()}
                    description="Akumulasi unit dari GR SAP + GR Manual"
                    icon={TrendingUp}
                    gradient="from-violet-500/10 via-violet-400/5 to-fuchsia-500/10 border-violet-200/50 hover:shadow-lg"
                    iconColor="text-violet-600"
                    textColor="text-violet-900"
                />
            </div>

            <div className="grid grid-cols-1 gap-6">
                <ReportBarChart
                    data={inboundSourceVolumeData}
                    title="Volume Inbound per Source"
                    description="Perbandingan total unit masuk dari Good Receive SAP vs Good Receive Manual"
                    height={320}
                />
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
