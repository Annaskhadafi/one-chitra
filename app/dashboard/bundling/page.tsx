import { getBundles } from "@/app/actions/product-bundle"
import { getProducts } from "@/app/actions/product"
import { BundleTable } from "./_components/bundle-table"

export default async function BundlingPage() {
    const bundles = await getBundles()
    const allProducts = await getProducts()

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-8 lg:p-10">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight">Product Bundling</h1>
                <p className="text-muted-foreground">
                    Create and manage product packages with multiple components.
                </p>
            </div>

            <div className="flex-1">
                <BundleTable initialData={bundles} allProducts={allProducts} />
            </div>
        </div>
    )
}
