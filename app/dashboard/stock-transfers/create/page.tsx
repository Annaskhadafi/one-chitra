import { getWarehouses } from "@/app/actions/warehouse"
import { getProducts } from "@/app/actions/product"
import { CreateTransferForm } from "./_components/create-transfer-form"

export default async function CreateStockTransferPage() {
    const [warehouses, products] = await Promise.all([
        getWarehouses(),
        getProducts(),
    ])

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Create Stock Transfer</h2>
            </div>
            <div className="hidden h-full flex-1 flex-col space-y-8 md:flex">
                <CreateTransferForm warehouses={warehouses} products={products} />
            </div>
        </div>
    )
}
