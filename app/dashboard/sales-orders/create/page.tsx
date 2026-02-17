import { getCustomers } from "@/app/actions/customer"
import { getProducts } from "@/app/actions/product"
import { SalesOrderForm } from "../_components/sales-order-form"

export default async function CreateSalesOrderPage() {
    const [customers, products] = await Promise.all([
        getCustomers(),
        getProducts(),
    ])

    return <SalesOrderForm customers={customers} products={products} />
}
