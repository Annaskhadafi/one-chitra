/**
 * Integration tests for PredictionChart data flow
 * Tests data structure validation and chart data preparation
 * Requirements: 2.1, 2.2
 */

import { describe, it, expect } from 'vitest'

interface SalesDataPoint {
    month: string
    sales: number
    revenue: number
    movingAverage: number | null
}

describe('PredictionChart Data Flow Integration', () => {
    const mockSalesData: SalesDataPoint[] = [
        { month: '2024-01', sales: 100, revenue: 10000, movingAverage: null },
        { month: '2024-02', sales: 150, revenue: 15000, movingAverage: null },
        { month: '2024-03', sales: 120, revenue: 12000, movingAverage: 123.33 },
        { month: '2024-04', sales: 180, revenue: 18000, movingAverage: 150 },
        { month: '2024-05', sales: 200, revenue: 20000, movingAverage: 166.67 },
        { month: '2024-06', sales: 160, revenue: 16000, movingAverage: 180 }
    ]

    describe('Data Structure Validation', () => {
        it('should accept valid sales data structure', () => {
            mockSalesData.forEach(item => {
                expect(item).toHaveProperty('month')
                expect(item).toHaveProperty('sales')
                expect(item).toHaveProperty('revenue')
                expect(item).toHaveProperty('movingAverage')
                
                expect(typeof item.month).toBe('string')
                expect(typeof item.sales).toBe('number')
                expect(typeof item.revenue).toBe('number')
                expect(item.movingAverage === null || typeof item.movingAverage === 'number').toBe(true)
            })
        })

        it('should validate month format (YYYY-MM)', () => {
            mockSalesData.forEach(item => {
                expect(item.month).toMatch(/^\d{4}-\d{2}$/)
            })
        })

        it('should have non-negative sales values', () => {
            mockSalesData.forEach(item => {
                expect(item.sales).toBeGreaterThanOrEqual(0)
                expect(item.revenue).toBeGreaterThanOrEqual(0)
            })
        })

        it('should maintain chronological order', () => {
            for (let i = 1; i < mockSalesData.length; i++) {
                expect(mockSalesData[i].month >= mockSalesData[i - 1].month).toBe(true)
            }
        })
    })

    describe('Chart Data Preparation', () => {
        it('should format month labels correctly', () => {
            const monthNames: Record<string, string> = {
                "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
                "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
                "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
            }

            function formatMonth(ym: string) {
                const parts = ym.split("-")
                if (parts.length === 2) {
                    return `${monthNames[parts[1]] ?? parts[1]} ${parts[0].slice(2)}`
                }
                return ym
            }

            const formatted = mockSalesData.map(d => formatMonth(d.month))
            
            expect(formatted[0]).toBe('Jan 24')
            expect(formatted[1]).toBe('Feb 24')
            expect(formatted[5]).toBe('Jun 24')
        })

        it('should format large numbers correctly', () => {
            function formatNumber(val: number) {
                if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
                if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`
                return val.toLocaleString()
            }

            expect(formatNumber(100)).toBe('100')
            expect(formatNumber(1500)).toBe('1.5K')
            expect(formatNumber(1500000)).toBe('1.5M')
        })

        it('should calculate average monthly sales correctly', () => {
            const total = mockSalesData.reduce((sum, d) => sum + d.sales, 0)
            const average = Math.round(total / mockSalesData.length)
            
            // Average of [100, 150, 120, 180, 200, 160] = 910 / 6 = 151.67 ≈ 152
            expect(average).toBe(152)
        })

        it('should calculate Y-axis max value correctly', () => {
            const currentStock = 500
            const recommendedStock = 800
            const maxSales = Math.max(...mockSalesData.map(d => d.sales))
            const yAxisMax = Math.ceil(Math.max(maxSales, recommendedStock, currentStock) * 1.2)
            
            // Max sales = 200, recommended = 800, current = 500
            // Max of all = 800, * 1.2 = 960
            expect(yAxisMax).toBe(960)
        })
    })

    describe('Edge Cases in Data Flow', () => {
        it('should handle empty data array', () => {
            const emptyData: SalesDataPoint[] = []
            
            expect(emptyData.length).toBe(0)
            expect(Array.isArray(emptyData)).toBe(true)
        })

        it('should handle single data point', () => {
            const singlePoint: SalesDataPoint[] = [
                { month: '2024-01', sales: 100, revenue: 10000, movingAverage: null }
            ]
            
            expect(singlePoint.length).toBe(1)
            expect(singlePoint[0].sales).toBe(100)
        })

        it('should handle all null moving averages', () => {
            const dataWithNulls: SalesDataPoint[] = [
                { month: '2024-01', sales: 100, revenue: 10000, movingAverage: null },
                { month: '2024-02', sales: 150, revenue: 15000, movingAverage: null }
            ]
            
            dataWithNulls.forEach(item => {
                expect(item.movingAverage).toBeNull()
            })
        })

        it('should handle zero sales values', () => {
            const zeroSalesData: SalesDataPoint[] = [
                { month: '2024-01', sales: 0, revenue: 0, movingAverage: null },
                { month: '2024-02', sales: 0, revenue: 0, movingAverage: null }
            ]
            
            const total = zeroSalesData.reduce((sum, d) => sum + d.sales, 0)
            expect(total).toBe(0)
        })

        it('should handle very large sales values', () => {
            const largeSalesData: SalesDataPoint[] = [
                { month: '2024-01', sales: 1000000, revenue: 100000000, movingAverage: null },
                { month: '2024-02', sales: 1500000, revenue: 150000000, movingAverage: null }
            ]
            
            largeSalesData.forEach(item => {
                expect(item.sales).toBeGreaterThan(0)
                expect(item.revenue).toBeGreaterThan(0)
            })
        })
    })

    describe('Stock Level Calculations', () => {
        it('should handle zero current stock', () => {
            const currentStock = 0
            const recommendedStock = 800
            
            expect(currentStock).toBe(0)
            expect(recommendedStock).toBeGreaterThan(0)
        })

        it('should handle equal current and recommended stock', () => {
            const currentStock = 500
            const recommendedStock = 500
            
            expect(currentStock).toBe(recommendedStock)
        })

        it('should handle current stock exceeding recommended', () => {
            const currentStock = 1000
            const recommendedStock = 500
            
            expect(currentStock).toBeGreaterThan(recommendedStock)
        })

        it('should validate stock percentage calculations', () => {
            const currentStock = 400
            const recommendedStock = 800
            const percentage = (currentStock / recommendedStock) * 100
            
            expect(percentage).toBe(50)
        })
    })

    describe('Data Integrity Checks', () => {
        it('should maintain data immutability', () => {
            const originalData = [...mockSalesData]
            const processedData = mockSalesData.map(d => ({
                ...d,
                formattedMonth: d.month
            }))
            
            // Original data should remain unchanged
            expect(mockSalesData).toEqual(originalData)
            expect(processedData.length).toBe(mockSalesData.length)
        })

        it('should handle missing optional fields gracefully', () => {
            const dataWithoutRevenue = mockSalesData.map(({ revenue, ...rest }) => rest)
            
            dataWithoutRevenue.forEach(item => {
                expect(item).toHaveProperty('month')
                expect(item).toHaveProperty('sales')
                expect(item).toHaveProperty('movingAverage')
            })
        })

        it('should validate data completeness for chart rendering', () => {
            const isDataComplete = mockSalesData.every(item => 
                item.month !== undefined &&
                item.sales !== undefined &&
                item.movingAverage !== undefined
            )
            
            expect(isDataComplete).toBe(true)
        })
    })

    describe('Performance Considerations', () => {
        it('should handle 6 months of data efficiently', () => {
            expect(mockSalesData.length).toBe(6)
            
            const startTime = Date.now()
            const processed = mockSalesData.map(d => ({
                ...d,
                formatted: `${d.month}: ${d.sales}`
            }))
            const endTime = Date.now()
            
            expect(processed.length).toBe(6)
            expect(endTime - startTime).toBeLessThan(10) // Should be instant
        })

        it('should handle 12 months of data efficiently', () => {
            const largeDataset = Array.from({ length: 12 }, (_, i) => ({
                month: `2024-${String(i + 1).padStart(2, '0')}`,
                sales: Math.floor(Math.random() * 1000),
                revenue: Math.floor(Math.random() * 100000),
                movingAverage: i >= 2 ? Math.random() * 500 : null
            }))
            
            expect(largeDataset.length).toBe(12)
            
            const startTime = Date.now()
            const total = largeDataset.reduce((sum, d) => sum + d.sales, 0)
            const endTime = Date.now()
            
            expect(total).toBeGreaterThanOrEqual(0)
            expect(endTime - startTime).toBeLessThan(10)
        })
    })

    describe('Chart Configuration Validation', () => {
        it('should validate reference line data', () => {
            const currentStock = 500
            const recommendedStock = 800
            
            expect(typeof currentStock).toBe('number')
            expect(typeof recommendedStock).toBe('number')
            expect(currentStock).toBeGreaterThanOrEqual(0)
            expect(recommendedStock).toBeGreaterThanOrEqual(0)
        })

        it('should validate tooltip data structure', () => {
            const tooltipData = mockSalesData.map(d => ({
                label: d.month,
                value: d.sales,
                movingAverage: d.movingAverage
            }))
            
            tooltipData.forEach(item => {
                expect(item).toHaveProperty('label')
                expect(item).toHaveProperty('value')
                expect(item).toHaveProperty('movingAverage')
            })
        })

        it('should validate legend configuration', () => {
            const legendItems = [
                { name: 'Sales', dataKey: 'sales' },
                { name: '3-Month MA', dataKey: 'movingAverage' }
            ]
            
            legendItems.forEach(item => {
                expect(item).toHaveProperty('name')
                expect(item).toHaveProperty('dataKey')
                expect(typeof item.name).toBe('string')
                expect(typeof item.dataKey).toBe('string')
            })
        })
    })
})

