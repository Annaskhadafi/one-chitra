import { Metadata } from "next"
import { PageHeader } from "@/components/page-header"
import { DynamicSafetyStock } from "./_components/dynamic-safety-stock"

export const metadata: Metadata = {
    title: "ML Inventory Forecast",
    description: "Predictive Replenishment & Dynamic Safety Stock Optimization via ML",
}

export default function InventoryMLPage() {
    return (
        <div className="flex flex-col gap-4 p-4 md:p-6">
            <PageHeader
                title="ML Inventory Forecast"
                subtitle="ML-powered predictive replenishment and dynamic safety stock optimization."
            />
            <DynamicSafetyStock />
        </div>
    )
}
