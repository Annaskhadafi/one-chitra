import { getSalesOrders } from "@/app/actions/sales-order"
import { SalesOrderTable } from "./_components/sales-order-table"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus, ShoppingCart, FileText, Zap } from "lucide-react"
import { PermissionGuard } from "@/components/permission-guard"
import { PageHeader } from "@/components/page-header"
import { AutoCloseSidebar } from "@/components/auto-close-sidebar"

export const dynamic = "force-dynamic"

export default async function SalesOrdersPage() {
    const allOrders = await getSalesOrders()

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <AutoCloseSidebar />
            <div className="flex flex-col items-start gap-3">
                <div className="min-w-0 w-full">
                    <PageHeader
                        title="Sales Order Record"
                        subtitle="Manage sales orders, invoices, and order tracking."
                        icon={ShoppingCart}
                    />
                </div>
                <PermissionGuard resource="sales-orders" action="create">
                    <div className="flex w-full flex-col sm:flex-row gap-2">
                        <Link href="/dashboard/sales-orders/create" className="w-full sm:w-auto">
                            <Button className="w-full sm:w-auto sm:min-w-[190px] justify-center">
                                <Plus className="mr-2 h-4 w-4" />
                                Create Sales Order
                            </Button>
                        </Link>
                        <Link href="/dashboard/sales-orders/ocr-upload" className="w-full sm:w-auto">
                            <Button className="w-full sm:w-auto sm:min-w-[190px] justify-center bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-700 hover:via-violet-700 hover:to-purple-700 border-none shadow-lg shadow-indigo-200/50 transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] group relative overflow-hidden">
                                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                <Zap className="mr-2 h-4 w-4 fill-white flex-shrink-0" />
                                <span className="relative">Sales Order OCR</span>
                                <div className="ml-2 px-1.5 py-0.5 rounded-[4px] bg-white/20 text-[8px] font-black uppercase tracking-tight flex items-center justify-center border border-white/30 backdrop-blur-sm">
                                    AI
                                </div>
                            </Button>
                        </Link>
                    </div>
                </PermissionGuard>
            </div>


            <div className="flex-1">
                <SalesOrderTable data={allOrders} />
            </div>
        </div>
    )
}
