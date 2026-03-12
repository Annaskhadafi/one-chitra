import { getSalesOrder, getSalesOrderPicUsers } from "@/app/actions/sales-order"
import { getCustomers } from "@/app/actions/customer"
import { getProducts } from "@/app/actions/product"
import { getWarehouses } from "@/app/actions/warehouse"
import { SalesOrderForm } from "../../_components/sales-order-form"
import { notFound } from "next/navigation"

export default async function EditSalesOrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const orderId = parseInt(id)

    const [order, customers, products, warehouses, users] = await Promise.all([
        getSalesOrder(orderId),
        getCustomers(),
        getProducts(),
        getWarehouses(),
        getSalesOrderPicUsers(),
    ])

    if (!order) {
        notFound()
    }

    return (
        <SalesOrderForm
            customers={customers}
            products={products}
            warehouses={warehouses}
            users={users}
            initialData={order as Parameters<typeof SalesOrderForm>[0]["initialData"]}
        />
    )
}
