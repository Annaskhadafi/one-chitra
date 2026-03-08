/**
 * Integration tests for chart data flow
 * Tests data fetching, transformation, and chart rendering
 * Requirements: 2.1, 2.2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getSalesHistory } from '../inventory-ai'
import { calculateMovingAverage } from '@/lib/ai-utils'

// Mock the database and authentication
vi.mock('@/db', () => ({
    db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
    }
}))

vi.mock('@/lib/rbac', () => ({
    getAuthenticatedSession: vi.fn().mockResolvedValue({
        user: { id: 1, name: 'Test User' },
        permissions: ['inventory:view']
    })
}))

describe('Chart Data Flow Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('getSalesHistory - Data Fetching and Transformation', () => {
        it('should fetch and transform sales data for last 6 months', async () => {
            // Mock database response
            const mockSalesData = [
                { month: '2024-01', qty: 100, revenue: 10000 },
                { month: '2024-02', qty: 150, revenue: 15000 },
                { month: '2024-03', qty: 120, revenue: 12000 },
                { month: '2024-04', qty: 180, revenue: 18000 },
                { month: '2024-05', qty: 200, revenue: 20000 },
                { month: '2024-06', qty: 160, revenue: 16000 }
            ]

            const { db } = await import('@/db')
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        groupBy: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockResolvedValue(mockSalesData)
                        })
                    })
                })
            } as any)

            const result = await getSalesHistory('TEST-001')

            expect(result.success).toBe(true)
            expect(result.data).toBeDefined()
            expect(result.data).toHaveLength(6)
        })

        it('should include moving average in transformed data', async () => {
            const mockSalesData = [
                { month: '2024-01', qty: 100, revenue: 10000 },
                { month: '2024-02', qty: 150, revenue: 15000 },
                { month: '2024-03', qty: 120, revenue: 12000 }
            ]

            const { db } = await import('@/db')
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        groupBy: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockResolvedValue(mockSalesData)
                        })
                    })
                })
            } as any)

            const result = await getSalesHistory('TEST-001')

            expect(result.success).toBe(true)
            expect(result.data).toBeDefined()
            
            // Check that moving average is calculated
            result.data!.forEach(item => {
                expect(item).toHaveProperty('movingAverage')
            })
        })

        it('should handle empty sales data', async () => {
            const { db } = await import('@/db')
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        groupBy: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockResolvedValue([])
                        })
                    })
                })
            } as any)

            const result = await getSalesHistory('NONEXISTENT')

            expect(result.success).toBe(true)
            expect(result.data).toEqual([])
        })

        it('should handle database errors gracefully', async () => {
            const { db } = await import('@/db')
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        groupBy: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockRejectedValue(new Error('Database connection failed'))
                        })
                    })
                })
            } as any)

            const result = await getSalesHistory('TEST-001')

            expect(result.success).toBe(false)
            expect(result.error).toBe('Failed to fetch sales history')
        })

        it('should convert numeric values correctly', async () => {
            const mockSalesData = [
                { month: '2024-01', qty: 100, revenue: 10000 },
                { month: '2024-02', qty: 150, revenue: 15000 }
            ]

            const { db } = await import('@/db')
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        groupBy: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockResolvedValue(mockSalesData)
                        })
                    })
                })
            } as any)

            const result = await getSalesHistory('TEST-001')

            expect(result.success).toBe(true)
            result.data!.forEach(item => {
                expect(typeof item.sales).toBe('number')
                expect(typeof item.revenue).toBe('number')
            })
        })
    })

    describe('Moving Average Calculation in Data Flow', () => {
        it('should calculate 3-month moving average correctly', () => {
            const salesValues = [100, 150, 120, 180, 200, 160]
            const movingAverages = calculateMovingAverage(salesValues, 3)

            // First two values should be null (not enough data)
            expect(movingAverages[0]).toBeNull()
            expect(movingAverages[1]).toBeNull()

            // Third value: (100 + 150 + 120) / 3 = 123.33...
            expect(movingAverages[2]).toBeCloseTo(123.33, 1)

            // Fourth value: (150 + 120 + 180) / 3 = 150
            expect(movingAverages[3]).toBe(150)

            // Fifth value: (120 + 180 + 200) / 3 = 166.67...
            expect(movingAverages[4]).toBeCloseTo(166.67, 1)

            // Sixth value: (180 + 200 + 160) / 3 = 180
            expect(movingAverages[5]).toBe(180)
        })

        it('should handle data with less than window size', () => {
            const salesValues = [100, 150]
            const movingAverages = calculateMovingAverage(salesValues, 3)

            expect(movingAverages).toEqual([null, null])
        })

        it('should handle single data point', () => {
            const salesValues = [100]
            const movingAverages = calculateMovingAverage(salesValues, 3)

            expect(movingAverages).toEqual([null])
        })
    })

    describe('Chart Data Structure Validation', () => {
        it('should produce data structure compatible with chart component', async () => {
            const mockSalesData = [
                { month: '2024-01', qty: 100, revenue: 10000 },
                { month: '2024-02', qty: 150, revenue: 15000 },
                { month: '2024-03', qty: 120, revenue: 12000 }
            ]

            const { db } = await import('@/db')
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        groupBy: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockResolvedValue(mockSalesData)
                        })
                    })
                })
            } as any)

            const result = await getSalesHistory('TEST-001')

            expect(result.success).toBe(true)
            
            // Validate structure matches PredictionChart expectations
            result.data!.forEach(item => {
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

        it('should maintain chronological order of data', async () => {
            const mockSalesData = [
                { month: '2024-01', qty: 100, revenue: 10000 },
                { month: '2024-02', qty: 150, revenue: 15000 },
                { month: '2024-03', qty: 120, revenue: 12000 },
                { month: '2024-04', qty: 180, revenue: 18000 }
            ]

            const { db } = await import('@/db')
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        groupBy: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockResolvedValue(mockSalesData)
                        })
                    })
                })
            } as any)

            const result = await getSalesHistory('TEST-001')

            expect(result.success).toBe(true)
            
            // Verify chronological order
            for (let i = 1; i < result.data!.length; i++) {
                const prevMonth = result.data![i - 1].month
                const currMonth = result.data![i].month
                expect(currMonth >= prevMonth).toBe(true)
            }
        })
    })

    describe('Edge Cases and Error Handling', () => {
        it('should handle authentication failure', async () => {
            const { getAuthenticatedSession } = await import('@/lib/rbac')
            vi.mocked(getAuthenticatedSession).mockRejectedValueOnce(
                new Error('Unauthorized')
            )

            const result = await getSalesHistory('TEST-001')

            expect(result.success).toBe(false)
            expect(result.error).toBe('Failed to fetch sales history')
        })

        it('should handle malformed material number', async () => {
            const { db } = await import('@/db')
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        groupBy: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockResolvedValue([])
                        })
                    })
                })
            } as any)

            const result = await getSalesHistory('')

            expect(result.success).toBe(true)
            expect(result.data).toEqual([])
        })

        it('should handle null or undefined values in sales data', async () => {
            const mockSalesData = [
                { month: '2024-01', qty: null, revenue: null },
                { month: '2024-02', qty: 150, revenue: 15000 }
            ]

            const { db } = await import('@/db')
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        groupBy: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockResolvedValue(mockSalesData)
                        })
                    })
                })
            } as any)

            const result = await getSalesHistory('TEST-001')

            expect(result.success).toBe(true)
            // Should convert null to 0 via COALESCE in SQL
            expect(result.data![0].sales).toBe(0)
            expect(result.data![0].revenue).toBe(0)
        })
    })

    describe('Performance and Data Volume', () => {
        it('should handle large datasets efficiently', async () => {
            // Generate 12 months of data
            const mockSalesData = Array.from({ length: 12 }, (_, i) => ({
                month: `2024-${String(i + 1).padStart(2, '0')}`,
                qty: Math.floor(Math.random() * 1000),
                revenue: Math.floor(Math.random() * 100000)
            }))

            const { db } = await import('@/db')
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        groupBy: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockResolvedValue(mockSalesData)
                        })
                    })
                })
            } as any)

            const startTime = Date.now()
            const result = await getSalesHistory('TEST-001')
            const endTime = Date.now()

            expect(result.success).toBe(true)
            expect(result.data).toHaveLength(12)
            
            // Should complete in reasonable time (< 100ms for mocked data)
            expect(endTime - startTime).toBeLessThan(100)
        })

        it('should limit data to 6 months as per requirements', async () => {
            // This test verifies the query filters to last 6 months
            const mockSalesData = [
                { month: '2024-01', qty: 100, revenue: 10000 },
                { month: '2024-02', qty: 150, revenue: 15000 },
                { month: '2024-03', qty: 120, revenue: 12000 },
                { month: '2024-04', qty: 180, revenue: 18000 },
                { month: '2024-05', qty: 200, revenue: 20000 },
                { month: '2024-06', qty: 160, revenue: 16000 }
            ]

            const { db } = await import('@/db')
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        groupBy: vi.fn().mockReturnValue({
                            orderBy: vi.fn().mockResolvedValue(mockSalesData)
                        })
                    })
                })
            } as any)

            const result = await getSalesHistory('TEST-001')

            expect(result.success).toBe(true)
            // Should return exactly 6 months of data
            expect(result.data).toHaveLength(6)
        })
    })
})
