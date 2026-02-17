import { getSalesOrder } from "@/app/actions/sales-order"
import { getCustomers } from "@/app/actions/customer"
import { getProducts } from "@/app/actions/product"
import { SalesOrderForm } from "../../_components/sales-order-form"
import { notFound } from "next/navigation"

export default async function EditSalesOrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const orderId = parseInt(id)

    const [order, customers, products] = await Promise.all([
        getSalesOrder(orderId),
        getCustomers(),
        getProducts(),
    ])

    if (!order) {
        notFound()
    }

    return (
        <SalesOrderForm
            customers={customers}
            products={products}
            initialData={order}
        />
    )
}
