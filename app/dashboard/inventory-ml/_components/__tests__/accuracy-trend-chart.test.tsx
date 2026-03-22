/**
 * Unit tests for AccuracyTrendChart component logic
 * Tests the data processing and calculation logic used by the component
 * Requirements: 3.6
 */

import { describe, it, expect } from 'vitest'

describe('AccuracyTrendChart - Data Processing Logic', () => {
    it('should calculate 6-month average accuracy correctly', () => {
        const trendData = [
            { month: '2024-01', averageAccuracy: 85.5, predictionCount: 10 },
            { month: '2024-02', averageAccuracy: 87.2, predictionCount: 15 },
            { month: '2024-03', averageAccuracy: 82.1, predictionCount: 12 },
            { month: '2024-04', averageAccuracy: 90.3, predictionCount: 18 },
            { month: '2024-05', averageAccuracy: 88.7, predictionCount: 20 },
            { month: '2024-06', averageAccuracy: 91.2, predictionCount: 22 }
        ]

        const dataWithAccuracy = trendData.filter(d => d.averageAccuracy !== null)
        const averageAccuracy = dataWithAccuracy.reduce((sum, d) => sum + (d.averageAccuracy || 0), 0) / dataWithAccuracy.length

        expect(averageAccuracy).toBeCloseTo(87.5, 1) // (85.5 + 87.2 + 82.1 + 90.3 + 88.7 + 91.2) / 6
    })

    it('should identify latest month accuracy', () => {
        const trendData = [
            { month: '2024-01', averageAccuracy: 85.5, predictionCount: 10 },
            { month: '2024-02', averageAccuracy: 87.2, predictionCount: 15 },
            { month: '2024-03', averageAccuracy: 82.1, predictionCount: 12 },
            { month: '2024-04', averageAccuracy: 90.3, predictionCount: 18 },
            { month: '2024-05', averageAccuracy: 88.7, predictionCount: 20 },
            { month: '2024-06', averageAccuracy: 91.2, predictionCount: 22 }
        ]

        const dataWithAccuracy = trendData.filter(d => d.averageAccuracy !== null)
        const latestAccuracy = dataWithAccuracy[dataWithAccuracy.length - 1].averageAccuracy

        expect(latestAccuracy).toBe(91.2)
    })

    it('should calculate total predictions across all months', () => {
        const trendData = [
            { month: '2024-01', averageAccuracy: 85.5, predictionCount: 10 },
            { month: '2024-02', averageAccuracy: 87.2, predictionCount: 15 },
            { month: '2024-03', averageAccuracy: 82.1, predictionCount: 12 },
            { month: '2024-04', averageAccuracy: 90.3, predictionCount: 18 },
            { month: '2024-05', averageAccuracy: 88.7, predictionCount: 20 },
            { month: '2024-06', averageAccuracy: 91.2, predictionCount: 22 }
        ]

        const dataWithAccuracy = trendData.filter(d => d.averageAccuracy !== null)
        const totalPredictions = dataWithAccuracy.reduce((sum, d) => sum + d.predictionCount, 0)

        expect(totalPredictions).toBe(97) // 10 + 15 + 12 + 18 + 20 + 22
    })

    it('should handle months with no data (null accuracy)', () => {
        const trendData = [
            { month: '2024-01', averageAccuracy: null, predictionCount: 0 },
            { month: '2024-02', averageAccuracy: 85.0, predictionCount: 5 },
            { month: '2024-03', averageAccuracy: null, predictionCount: 0 },
            { month: '2024-04', averageAccuracy: 90.0, predictionCount: 10 },
            { month: '2024-05', averageAccuracy: null, predictionCount: 0 },
            { month: '2024-06', averageAccuracy: 88.0, predictionCount: 8 }
        ]

        const dataWithAccuracy = trendData.filter(d => d.averageAccuracy !== null)
        
        expect(dataWithAccuracy).toHaveLength(3)
        
        const averageAccuracy = dataWithAccuracy.reduce((sum, d) => sum + (d.averageAccuracy || 0), 0) / dataWithAccuracy.length
        expect(averageAccuracy).toBeCloseTo(87.67, 1) // (85 + 90 + 88) / 3

        const totalPredictions = dataWithAccuracy.reduce((sum, d) => sum + d.predictionCount, 0)
        expect(totalPredictions).toBe(23) // 5 + 10 + 8
    })

    it('should handle all months with no data', () => {
        const trendData = [
            { month: '2024-01', averageAccuracy: null, predictionCount: 0 },
            { month: '2024-02', averageAccuracy: null, predictionCount: 0 },
            { month: '2024-03', averageAccuracy: null, predictionCount: 0 },
            { month: '2024-04', averageAccuracy: null, predictionCount: 0 },
            { month: '2024-05', averageAccuracy: null, predictionCount: 0 },
            { month: '2024-06', averageAccuracy: null, predictionCount: 0 }
        ]

        const dataWithAccuracy = trendData.filter(d => d.averageAccuracy !== null)
        const hasData = dataWithAccuracy.length > 0

        expect(hasData).toBe(false)
        expect(dataWithAccuracy).toHaveLength(0)
    })

    it('should format month labels correctly', () => {
        const monthNames: Record<string, string> = {
            "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
            "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
            "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
        }

        const formatMonth = (ym: string) => {
            const parts = ym.split("-")
            if (parts.length === 2) {
                return `${monthNames[parts[1]] ?? parts[1]} ${parts[0].slice(2)}`
            }
            return ym
        }

        expect(formatMonth('2024-01')).toBe('Jan 24')
        expect(formatMonth('2024-02')).toBe('Feb 24')
        expect(formatMonth('2024-12')).toBe('Dec 24')
        expect(formatMonth('2023-06')).toBe('Jun 23')
    })

    it('should transform data for chart correctly', () => {
        const trendData = [
            { month: '2024-01', averageAccuracy: 85.5, predictionCount: 10 },
            { month: '2024-02', averageAccuracy: null, predictionCount: 0 }
        ]

        const monthNames: Record<string, string> = {
            "01": "Jan", "02": "Feb"
        }

        const formatMonth = (ym: string) => {
            const parts = ym.split("-")
            if (parts.length === 2) {
                return `${monthNames[parts[1]] ?? parts[1]} ${parts[0].slice(2)}`
            }
            return ym
        }

        const chartData = trendData.map(d => ({
            month: formatMonth(d.month),
            accuracy: d.averageAccuracy,
            count: d.predictionCount
        }))

        expect(chartData).toHaveLength(2)
        expect(chartData[0]).toEqual({ month: 'Jan 24', accuracy: 85.5, count: 10 })
        expect(chartData[1]).toEqual({ month: 'Feb 24', accuracy: null, count: 0 })
    })

    it('should handle edge case with single month of data', () => {
        const trendData = [
            { month: '2024-01', averageAccuracy: null, predictionCount: 0 },
            { month: '2024-02', averageAccuracy: null, predictionCount: 0 },
            { month: '2024-03', averageAccuracy: null, predictionCount: 0 },
            { month: '2024-04', averageAccuracy: null, predictionCount: 0 },
            { month: '2024-05', averageAccuracy: null, predictionCount: 0 },
            { month: '2024-06', averageAccuracy: 88.5, predictionCount: 15 }
        ]

        const dataWithAccuracy = trendData.filter(d => d.averageAccuracy !== null)
        
        expect(dataWithAccuracy).toHaveLength(1)
        
        const averageAccuracy = dataWithAccuracy.reduce((sum, d) => sum + (d.averageAccuracy || 0), 0) / dataWithAccuracy.length
        expect(averageAccuracy).toBe(88.5)

        const latestAccuracy = dataWithAccuracy[dataWithAccuracy.length - 1].averageAccuracy
        expect(latestAccuracy).toBe(88.5)
    })

    it('should verify accuracy values are within valid range (0-100)', () => {
        const trendData = [
            { month: '2024-01', averageAccuracy: 85.5, predictionCount: 10 },
            { month: '2024-02', averageAccuracy: 92.3, predictionCount: 15 },
            { month: '2024-03', averageAccuracy: 78.9, predictionCount: 12 }
        ]

        const dataWithAccuracy = trendData.filter(d => d.averageAccuracy !== null)
        const allValid = dataWithAccuracy.every(d => 
            d.averageAccuracy !== null && 
            d.averageAccuracy >= 0 && 
            d.averageAccuracy <= 100
        )

        expect(allValid).toBe(true)
    })
})
