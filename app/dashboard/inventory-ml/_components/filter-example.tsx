"use client"

/**
 * Example component demonstrating how to use FilterContext with FilterPanel
 * 
 * This is a reference implementation showing best practices for:
 * - Using the useFilters hook
 * - Integrating with FilterPanel component
 * - Applying filters to data queries
 * - Handling filter state updates
 */

import { useFilters } from "./filter-context"
import { FilterPanel } from "./filter-panel"
import { useEffect, useState } from "react"

interface Prediction {
    id: number
    materialNumber: string
    productName: string
    recommendedStock: number
    predictionDate: Date
    accuracy?: number
}

export function FilterExample() {
    const { filters, setFilters } = useFilters()
    const [predictions, setPredictions] = useState<Prediction[]>([])
    const [isLoading, setIsLoading] = useState(false)

    // Example: Fetch predictions based on current filters
    useEffect(() => {
        const fetchPredictions = async () => {
            setIsLoading(true)
            try {
                // In a real implementation, this would call a server action
                // const result = await getRecentPredictions({
                //     searchQuery: filters.searchQuery,
                //     dateFrom: filters.dateFrom,
                //     dateTo: filters.dateTo,
                //     materialGroup: filters.materialGroup,
                //     stockRange: filters.stockRange,
                //     accuracyLevel: filters.accuracyLevel
                // })
                
                // For this example, we'll just log the filters
                console.log("Fetching predictions with filters:", filters)
                
                // Simulate API call
                await new Promise(resolve => setTimeout(resolve, 500))
                
                // Mock data would be set here
                setPredictions([])
            } catch (error) {
                console.error("Failed to fetch predictions:", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchPredictions()
    }, [filters])

    // Example material groups (in real app, fetch from database)
    const materialGroups = [
        { id: "ELECTRONICS", name: "Electronics" },
        { id: "AUTOMOTIVE", name: "Automotive" },
        { id: "INDUSTRIAL", name: "Industrial" }
    ]

    return (
        <div className="space-y-4">
            {/* Filter Panel - automatically syncs with FilterContext */}
            <FilterPanel
                filters={filters}
                onFiltersChange={setFilters}
                resultCount={predictions.length}
                availableMaterialGroups={materialGroups}
                showAccuracyFilter={true}
            />

            {/* Your filtered content */}
            <div className="p-4 border rounded-lg">
                {isLoading ? (
                    <p className="text-muted-foreground">Loading predictions...</p>
                ) : predictions.length === 0 ? (
                    <p className="text-muted-foreground">No predictions found matching filters.</p>
                ) : (
                    <div className="space-y-2">
                        {predictions.map(prediction => (
                            <div key={prediction.id} className="p-3 border rounded">
                                <div className="font-medium">{prediction.materialNumber}</div>
                                <div className="text-sm text-muted-foreground">
                                    {prediction.productName}
                                </div>
                                <div className="text-sm">
                                    Recommended: {prediction.recommendedStock} pcs
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Debug: Show current filter state */}
            <details className="p-4 border rounded-lg">
                <summary className="cursor-pointer font-medium">
                    Current Filter State (Debug)
                </summary>
                <pre className="mt-2 text-xs overflow-auto">
                    {JSON.stringify(filters, null, 2)}
                </pre>
            </details>
        </div>
    )
}
