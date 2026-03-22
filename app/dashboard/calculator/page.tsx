import { getAuthenticatedSession } from "@/lib/rbac"
import { getBundlingFormDependencies } from "@/app/actions/bundling-ml"
import { getProducts } from "@/app/actions/product"
import { BundlingCalculator } from "./_components/bundling-calculator"

export const metadata = {
    title: "Bundling Builder | One Chitra",
    description: "Kalkulator dan optimasi minimum Qty Primer via Subsidi Silang.",
}

export default async function BundlingCalculatorPage() {
    await getAuthenticatedSession("bundling-calculator", "view")

    // Fetch products to be used in the combobox
    const products = await getProducts()
    const { usdRate } = await getBundlingFormDependencies()

    // Format products for the client component
    const formattedProducts = products.map(p => {
        const hppUsd = p.costSap && !isNaN(parseFloat(p.costSap)) ? parseFloat(p.costSap) : 0
        return {
            id: p.id.toString(),
            name: `${p.materialNumber} - ${p.materialDescription || 'Unknown'}`,
            hppUsd: hppUsd,
            hppIdr: hppUsd * usdRate,
            stock: p.totalStock || 0,
            category: p.category || "",
            materialNo: p.materialNumber
        }
    })

    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black tracking-tight text-primary">
                    Bundling <span className="text-foreground">Builder</span>
                </h1>
                <p className="text-muted-foreground text-sm font-medium">
                    Kalkulator cerdas berbasis ML untuk menganalisis dan mengoptimalkan harga serta margin paket bundling Anda.
                </p>
            </div>

            <BundlingCalculator products={formattedProducts} usdRate={usdRate} />
        </div>
    )
}
