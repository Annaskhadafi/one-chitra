import { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import { InventoryAIClient } from "./_components/inventory-ai-client"
import { FilterProvider } from "./_components/filter-context"

export const metadata: Metadata = {
    title: "AI Inventory Forecast",
    description: "Predictive Replenishment & Dynamic Safety Stock Optimization via AI",
}

export default function InventoryAIPage() {
    return (
        <div className="flex flex-col gap-4 p-4 md:p-6">
            <PageHeader
                title="AI Inventory Forecast"
                subtitle="AI-powered predictive replenishment and dynamic safety stock optimization."
            />
            <FilterProvider>
                <InventoryAIClient />
            </FilterProvider>
        </div>
    )
}
