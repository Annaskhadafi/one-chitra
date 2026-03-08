"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Box, ChevronLeft, ChevronRight } from "lucide-react"
import { getRecentPredictions } from "@/app/actions/inventory-ai"
import type { PredictionFilters } from "@/app/actions/inventory-ai"

interface PredictionHistoryListProps {
    predictionType: 'REPLENISHMENT' | 'SAFETY_STOCK' | 'CUSTOMER_RECOMMENDATION'
    title: string
    icon: React.ReactNode
    filters?: Omit<PredictionFilters, 'page' | 'pageSize'>
    onRefresh?: number // Trigger to refresh the list
}

/**
 * Reusable prediction history list component with pagination
 * Requirements: 10.2 - Lazy loading with pagination (20 items per page)
 */
export function PredictionHistoryList({ 
    predictionType, 
    title, 
    icon,
    filters,
    onRefresh 
}: PredictionHistoryListProps) {
    const [history, setHistory] = useState<any[]>([])
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const [isLoading, setIsLoading] = useState(false)
    const pageSize = 20 // Requirements: 10.2 - Load 20 items at a time

    useEffect(() => {
        loadHistory()
    }, [currentPage, onRefresh, filters])

    const loadHistory = async () => {
        setIsLoading(true)
        try {
            const res = await getRecentPredictions({
                ...filters,
                page: currentPage,
                pageSize
            })
            
            if (res.success && res.data) {
                const filteredData = res.data.filter((d: any) => d.predictionType === predictionType)
                setHistory(filteredData)
                setTotalPages(res.totalPages || 1)
                setTotalCount(res.totalCount || 0)
            }
        } catch (error) {
            console.error("Failed to load history:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const handlePreviousPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1)
        }
    }

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1)
        }
    }

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-muted-foreground">
                    {icon}
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
                <div className="flex-1 space-y-4 min-h-[400px]">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : history.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            Belum ada data riwayat prediksi.
                        </p>
                    ) : (
                        history.map((item) => (
                            <div 
                                key={item.id} 
                                className="p-3 rounded-lg border bg-card text-card-foreground shadow-sm space-y-2 text-sm"
                            >
                                <div className="flex justify-between items-center font-medium">
                                    <span className="flex items-center gap-1.5">
                                        <Box className="w-4 h-4" /> {item.productCode}
                                    </span>
                                    <span className="text-primary">{item.recommendedStock} Pcs</span>
                                </div>
                                {item.productName && (
                                    <p className="text-muted-foreground text-xs">{item.productName}</p>
                                )}
                                <p className="pt-1">{item.rationale}</p>
                                <div className="text-[10px] text-muted-foreground pt-2 text-right">
                                    {new Date(item.createdAt).toLocaleString('id-ID')}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Pagination Controls - Requirements: 10.2 */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t mt-4">
                        <div className="text-sm text-muted-foreground">
                            Halaman {currentPage} dari {totalPages} ({totalCount} total)
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handlePreviousPage}
                                disabled={currentPage === 1 || isLoading}
                            >
                                <ChevronLeft className="w-4 h-4 mr-1" />
                                Sebelumnya
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleNextPage}
                                disabled={currentPage === totalPages || isLoading}
                            >
                                Selanjutnya
                                <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
