import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PriceCompetitorDashboard } from "./_components/price-competitor-dashboard"
import { CompetitorActivityDashboard } from "./_components/activity-dashboard"
import { LostSaleDashboard } from "./_components/lost-sale-dashboard"
import { MonthlyReportTab } from "./_components/monthly-report-tab"
import { PermissionGuard } from "@/components/permission-guard"

export default function CompetitorInfoNewPage() {
    return (
        <PermissionGuard resource="competitor-info-new" action="view">
            <div className="flex flex-col gap-6 p-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Competitor Info New</h1>
                    <p className="text-muted-foreground">
                        Competitor price benchmark, activity tracking, lost sale analysis, and live dashboard insight.
                    </p>
                </div>

                <Tabs defaultValue="price" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 max-w-[780px] mb-4">
                        <TabsTrigger value="price">Price Competitor</TabsTrigger>
                        <TabsTrigger value="activity">Competitor Activity</TabsTrigger>
                        <TabsTrigger value="lost-sale">Lost Sale</TabsTrigger>
                        <TabsTrigger value="monthly-report">Monthly Report</TabsTrigger>
                    </TabsList>
                    <TabsContent value="price" className="mt-0">
                        <PriceCompetitorDashboard />
                    </TabsContent>
                    <TabsContent value="activity" className="mt-0">
                        <CompetitorActivityDashboard />
                    </TabsContent>
                    <TabsContent value="lost-sale" className="mt-0">
                        <LostSaleDashboard />
                    </TabsContent>
                    <TabsContent value="monthly-report" className="mt-0">
                        <MonthlyReportTab />
                    </TabsContent>
                </Tabs>
            </div>
        </PermissionGuard>
    )
}
