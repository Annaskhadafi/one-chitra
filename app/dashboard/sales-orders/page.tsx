import { getSalesOrders } from "@/app/actions/sales-order"
import { SalesOrderTable } from "./_components/sales-order-table"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus, ShoppingCart } from "lucide-react"
import { PermissionGuard } from "@/components/permission-guard"
import { PageHeader } from "@/components/page-header"
import { AutoCloseSidebar } from "@/components/auto-close-sidebar"

export default async function SalesOrdersPage() {
    const orders = await getSalesOrders()

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <AutoCloseSidebar />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-1">
                    <PageHeader
                        title="Sales Order Record"
                        subtitle="Manage sales orders, invoices, and order tracking."
                        icon={ShoppingCart}
                    />
                </div>
                <PermissionGuard resource="sales-orders" action="create">
                    <Link href="/dashboard/sales-orders/create">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Sales Order
                        </Button>
                    </Link>
                </PermissionGuard>
            </div>

            <div className="flex-1">
                <SalesOrderTable data={orders} />
            </div>
        </div>
    )
}
