import { getProducts } from "@/app/actions/product"
import { ProductTable } from "./_components/product-table"

export default async function ProductsPage() {
    const products = await getProducts()

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight">Product Management</h1>
                <p className="text-muted-foreground">
                    Manage your material catalog, categories, and descriptions.
                </p>
            </div>

            <div className="flex-1">
                <ProductTable data={products} />
            </div>
        </div>
    )
}
