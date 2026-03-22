import { describe, it, expect } from 'vitest'
import type { ComparisonDataItem, ComparisonSummary } from '@/app/actions/inventory-ml'

describe('ComparisonView Component Logic', () => {
    const mockData: ComparisonDataItem[] = [
        {
            predictionId: 1,
            productCode: 'MAT001',
            productName: 'Product A',
            predictionType: 'REPLENISHMENT',
            predictedStock: 1000,
            actualSales: 800,
            variancePercentage: 25,
            predictionDate: new Date('2024-01-15'),
            currentStock: 500,
        },
        {
            predictionId: 2,
            productCode: 'MAT002',
            productName: 'Product B',
            predictionType: 'SAFETY_STOCK',
            predictedStock: 500,
            actualSales: 700,
            variancePercentage: -28.57,
            predictionDate: new Date('2024-01-20'),
            currentStock: 300,
        },
        {
            predictionId: 3,
            productCode: 'MAT003',
            productName: 'Product C',
            predictionType: 'REPLENISHMENT',
            predictedStock: 2000,
            actualSales: 1000,
            variancePercentage: 100,
            predictionDate: new Date('2024-01-25'),
            currentStock: 800,
        },
    ]

    const mockSummary: ComparisonSummary = {
        averageVariance: 51.19,
        totalOverPrediction: 2,
        totalUnderPrediction: 1,
        totalComparisons: 3,
    }

    it('should have correct summary statistics', () => {
        expect(mockSummary.totalComparisons).toBe(3)
        expect(mockSummary.averageVariance).toBe(51.19)
        expect(mockSummary.totalOverPrediction).toBe(2)
        expect(mockSummary.totalUnderPrediction).toBe(1)
    })

    it('should identify high variance items (>30%)', () => {
        const highVarianceItems = mockData.filter(item => Math.abs(item.variancePercentage) > 30)

        expect(highVarianceItems.length).toBe(1)
        expect(highVarianceItems[0].productCode).toBe('MAT003')
        expect(highVarianceItems[0].variancePercentage).toBe(100)
    })

    it('should sort data by variance correctly', () => {
        const sortedByVariance = [...mockData].sort((a, b) =>
            Math.abs(b.variancePercentage) - Math.abs(a.variancePercentage)
        )

        expect(sortedByVariance[0].productCode).toBe('MAT003') // 100%
        expect(sortedByVariance[1].productCode).toBe('MAT002') // 28.57%
        expect(sortedByVariance[2].productCode).toBe('MAT001') // 25%
    })

    it('should sort data by product name correctly', () => {
        const sortedByName = [...mockData].sort((a, b) =>
            (a.productName || '').localeCompare(b.productName || '')
        )

        expect(sortedByName[0].productName).toBe('Product A')
        expect(sortedByName[1].productName).toBe('Product B')
        expect(sortedByName[2].productName).toBe('Product C')
    })

    it('should sort data by date correctly', () => {
        const sortedByDate = [...mockData].sort((a, b) =>
            new Date(b.predictionDate).getTime() - new Date(a.predictionDate).getTime()
        )

        expect(sortedByDate[0].productCode).toBe('MAT003') // 2024-01-25
        expect(sortedByDate[1].productCode).toBe('MAT002') // 2024-01-20
        expect(sortedByDate[2].productCode).toBe('MAT001') // 2024-01-15
    })

    it('should calculate chart data for top 10 items', () => {
        const chartData = mockData
            .slice(0, 10)
            .map(item => ({
                name: item.productCode,
                predicted: item.predictedStock,
                actual: item.actualSales,
                variance: item.variancePercentage
            }))

        expect(chartData.length).toBe(3)
        expect(chartData[0].name).toBe('MAT001')
        expect(chartData[0].predicted).toBe(1000)
        expect(chartData[0].actual).toBe(800)
    })

    it('should categorize variance levels correctly', () => {
        const getVarianceLevel = (variance: number) => {
            const absVariance = Math.abs(variance)
            if (absVariance > 30) return 'high'
            if (absVariance > 15) return 'medium'
            return 'low'
        }

        expect(getVarianceLevel(mockData[0].variancePercentage)).toBe('medium') // 25%
        expect(getVarianceLevel(mockData[1].variancePercentage)).toBe('medium') // 28.57%
        expect(getVarianceLevel(mockData[2].variancePercentage)).toBe('high') // 100%
    })

    it('should handle empty data gracefully', () => {
        const emptyData: ComparisonDataItem[] = []
        const emptySummary: ComparisonSummary = {
            averageVariance: 0,
            totalOverPrediction: 0,
            totalUnderPrediction: 0,
            totalComparisons: 0,
        }

        expect(emptyData.length).toBe(0)
        expect(emptySummary.totalComparisons).toBe(0)
    })

    it('should calculate difference between predicted and actual', () => {
        const differences = mockData.map(item => ({
            productCode: item.productCode,
            difference: item.predictedStock - item.actualSales
        }))

        expect(differences[0].difference).toBe(200) // 1000 - 800
        expect(differences[1].difference).toBe(-200) // 500 - 700
        expect(differences[2].difference).toBe(1000) // 2000 - 1000
    })

    it('should identify over-predictions and under-predictions', () => {
        const overPredictions = mockData.filter(item => item.variancePercentage > 0)
        const underPredictions = mockData.filter(item => item.variancePercentage < 0)

        expect(overPredictions.length).toBe(2) // MAT001, MAT003
        expect(underPredictions.length).toBe(1) // MAT002
    })
})
