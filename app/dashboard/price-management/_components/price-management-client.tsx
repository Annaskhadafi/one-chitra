"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PriceListsTab } from "./price-lists-tab"
import { MarginAlertsTab } from "./margin-alerts-tab"
import type { getPriceLists, getMarginAlerts } from "@/app/actions/price-management"

type PriceList = Awaited<ReturnType<typeof getPriceLists>>[number]
type MarginAlert = Awaited<ReturnType<typeof getMarginAlerts>>[number]

interface Props {
    priceLists: PriceList[]
    marginAlerts: MarginAlert[]
}

export function PriceManagementClient({ priceLists, marginAlerts }: Props) {
    const [activeTab, setActiveTab] = useState("price-lists")

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-4">
            <TabsList className="w-fit">
                <TabsTrigger value="price-lists">
                    Price Lists
                    <span className="ml-1.5 bg-muted text-muted-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {priceLists.length}
                    </span>
                </TabsTrigger>
                <TabsTrigger value="margin-alerts">
                    Margin Alerts
                    {marginAlerts.length > 0 && (
                        <span className="ml-1.5 bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {marginAlerts.length}
                        </span>
                    )}
                </TabsTrigger>
            </TabsList>

            <TabsContent value="price-lists" className="m-0">
                <PriceListsTab priceLists={priceLists} />
            </TabsContent>

            <TabsContent value="margin-alerts" className="m-0">
                <MarginAlertsTab alerts={marginAlerts} />
            </TabsContent>
        </Tabs>
    )
}
