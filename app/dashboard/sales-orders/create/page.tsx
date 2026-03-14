import { getCustomers } from "@/app/actions/customer"
import { getEvhsMasterPrices } from "@/app/actions/evhs-master"
import { getProducts } from "@/app/actions/product"
import { getWarehouses } from "@/app/actions/warehouse"
import { SalesOrderForm } from "../_components/sales-order-form"

export default async function CreateSalesOrderPage() {
    const [customers, products, warehouses, ckMasterPrices] = await Promise.all([
        getCustomers(),
        getProducts(),
        getWarehouses(),
        getEvhsMasterPrices(),
    ])

    return (
        <SalesOrderForm
            customers={customers}
            products={products}
            warehouses={warehouses}
            ckMasterPrices={ckMasterPrices}
        />
    )
}
