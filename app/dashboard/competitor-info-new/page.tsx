import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PriceCompetitorTab } from "./_components/price-competitor-tab"
import { CompetitorActivityTab } from "./_components/competitor-activity-tab"
import { LostSaleTab } from "./_components/lost-sale-tab"
import { PermissionGuard } from "@/components/permission-guard"
import { getCompetitorPrices, getCompetitorActivities, getLostSales } from "@/app/actions/competitor-new"

export default async function CompetitorInfoNewPage() {
    // Pre-fetch all data on the server for faster initial load
    const [prices, activities, lostSales] = await Promise.all([
        getCompetitorPrices(),
        getCompetitorActivities(),
        getLostSales()
    ])

    return (
        <PermissionGuard resource="competitor-info-new" action="view">
            <div className="flex flex-col gap-6 p-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Competitor Info New</h1>
                    <p className="text-muted-foreground">
                        Manage competitor database, activities, and lost sales information.
                    </p>
                </div>

                <Tabs defaultValue="price" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 max-w-[600px] mb-4">
                        <TabsTrigger value="price">Price Competitor</TabsTrigger>
                        <TabsTrigger value="activity">Competitor Activity</TabsTrigger>
                        <TabsTrigger value="lost-sale">Lost Sale</TabsTrigger>
                    </TabsList>
                    <TabsContent value="price" className="mt-0">
                        <PriceCompetitorTab initialData={prices} />
                    </TabsContent>
                    <TabsContent value="activity" className="mt-0">
                        <CompetitorActivityTab initialData={activities} />
                    </TabsContent>
                    <TabsContent value="lost-sale" className="mt-0">
                        <LostSaleTab initialData={lostSales} />
                    </TabsContent>
                </Tabs>
            </div>
        </PermissionGuard>
    )
}
