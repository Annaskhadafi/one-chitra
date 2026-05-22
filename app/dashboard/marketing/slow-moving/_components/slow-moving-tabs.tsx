"use client"

import type { getCosmeticTires } from "@/app/actions/cosmetic-tires"
import type { getProducts } from "@/app/actions/product"
import type { getSlowMovingProducts } from "@/app/actions/slow-moving-products"
import type { MonthlySellingQty } from "@/app/actions/slow-moving-products"
import type { getStocks } from "@/app/actions/stock"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CosmeticTireClient } from "./cosmetic-tire-client"
import { SlowMovingClient } from "./slow-moving-client"

type StockRow = Awaited<ReturnType<typeof getStocks>>[number]
type SavedSlowMovingProduct = Awaited<ReturnType<typeof getSlowMovingProducts>>[number]
type CosmeticTireRow = Awaited<ReturnType<typeof getCosmeticTires>>[number]
type ProductRow = Awaited<ReturnType<typeof getProducts>>[number]

export function SlowMovingTabs({
    stocks,
    defaultRate,
    savedProducts,
    cosmeticTires,
    products,
    sellingOutByMonth,
}: {
    stocks: StockRow[]
    defaultRate: string
    savedProducts: SavedSlowMovingProduct[]
    cosmeticTires: CosmeticTireRow[]
    products: ProductRow[]
    sellingOutByMonth: MonthlySellingQty[]
}) {
    return (
        <div className="flex min-h-screen flex-1 flex-col gap-6 bg-white p-4 text-zinc-950 md:p-8 lg:p-10">
            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight">Slow Moving</h1>
                        <Badge variant="outline">{stocks.length} stock rows</Badge>
                    </div>
                </div>
                <Tabs defaultValue="slow-moving" className="gap-4">
                    <TabsList>
                        <TabsTrigger value="slow-moving">Slow Moving</TabsTrigger>
                        <TabsTrigger value="cosmetic-tire">Cosmetic Tire</TabsTrigger>
                    </TabsList>
                    <TabsContent value="slow-moving" className="mt-0">
                        <SlowMovingClient
                            stocks={stocks}
                            defaultRate={defaultRate}
                            savedProducts={savedProducts}
                            showHeader={false}
                            sellingOutByMonth={sellingOutByMonth}
                        />
                    </TabsContent>
                    <TabsContent value="cosmetic-tire" className="mt-0">
                        <CosmeticTireClient data={cosmeticTires} products={products} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}