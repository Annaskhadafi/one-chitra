import { getSalesOrders } from "@/app/actions/sales-order"
import { SalesOrderTable } from "./_components/sales-order-table"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus, ShoppingCart, FileText } from "lucide-react"
import { PermissionGuard } from "@/components/permission-guard"
import { PageHeader } from "@/components/page-header"
import { AutoCloseSidebar } from "@/components/auto-close-sidebar"

export const dynamic = "force-dynamic"

type SalesOrdersPageProps = {
    searchParams: Promise<{ tab?: string }>
}

export default async function SalesOrdersPage({ searchParams }: SalesOrdersPageProps) {
    const { tab } = await searchParams
    const activeTab = tab ?? "all"
    const allOrders = await getSalesOrders()
    const orders = activeTab === "ocr" ? allOrders.filter(o => o.status === "ocr") : allOrders

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
                            <Button variant="outline" className="w-full sm:w-auto sm:min-w-[190px] justify-center">
                                <FileText className="mr-2 h-4 w-4" />
                                Sales Order OCR
                            </Button>
                        </Link>
                    </div>
                </PermissionGuard>
            </div>

            <div className="flex items-center gap-2">
                <Link href="/dashboard/sales-orders?tab=all">
                    <Button variant={activeTab === "all" ? "default" : "outline"} size="sm">
                        Semua
                    </Button>
                </Link>
                <Link href="/dashboard/sales-orders?tab=ocr">
                    <Button variant={activeTab === "ocr" ? "default" : "outline"} size="sm">
                        Draft OCR
                    </Button>
                </Link>
            </div>

            <div className="flex-1">
                <SalesOrderTable data={orders} />
            </div>
        </div>
    )
}
