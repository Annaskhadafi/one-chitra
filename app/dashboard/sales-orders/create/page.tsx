import { getCustomers } from "@/app/actions/customer"
import { getProducts } from "@/app/actions/product"
import { getWarehouses } from "@/app/actions/warehouse"
import { getSalesOrderPicUsers } from "@/app/actions/sales-order"
import { SalesOrderForm } from "../_components/sales-order-form"

export default async function CreateSalesOrderPage() {
    const [customers, products, warehouses, users] = await Promise.all([
        getCustomers(),
        getProducts(),
        getWarehouses(),
        getSalesOrderPicUsers(),
    ])

    return <SalesOrderForm customers={customers} products={products} warehouses={warehouses} users={users} />
}
