import { getCosmeticTires } from "@/app/actions/cosmetic-tires"
import { getProducts } from "@/app/actions/product"
import { getSetting } from "@/app/actions/settings"
import { getSlowMovingProducts } from "@/app/actions/slow-moving-products"
import { getStocks } from "@/app/actions/stock"
import { SlowMovingTabs } from "./_components/slow-moving-tabs"

export const metadata = {
    title: "Slow Moving",
}

export default async function SlowMovingPage() {
    const [stocks, savedRate, savedProducts, cosmeticTires, products] = await Promise.all([
        getStocks(),
        getSetting("manual_usd_rate"),
        getSlowMovingProducts(),
        getCosmeticTires(),
        getProducts(),
    ])

    return (
        <SlowMovingTabs
            stocks={stocks}
            defaultRate={savedRate || "1"}
            savedProducts={savedProducts}
            cosmeticTires={cosmeticTires}
            products={products}
        />
    )
}
