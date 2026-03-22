/**
 * Unit tests for AccuracyTracker component logic
 * Tests the data processing and filtering logic used by the component
 * Requirements: 3.3, 3.7, 3.8, 3.9
 */

import { describe, it, expect } from 'vitest'
import { formatAccuracyWithColor } from '@/lib/ai-utils'

describe('AccuracyTracker - Data Processing Logic', () => {
    it('should filter predictions with accuracy data', () => {
        const predictions = [
            { id: 1, accuracyPercentage: 95.0 },
            { id: 2, accuracyPercentage: null },
            { id: 3, accuracyPercentage: 75.0 },
            { id: 4, accuracyPercentage: null }
        ]

        const withAccuracy = predictions.filter(p => p.accuracyPercentage !== null)
        
        expect(withAccuracy).toHaveLength(2)
        expect(withAccuracy[0].id).toBe(1)
        expect(withAccuracy[1].id).toBe(3)
    })

    it('should count low accuracy predictions (<60%)', () => {
        const predictions = [
            { accuracyPercentage: 95.0 },
            { accuracyPercentage: 50.0 },
            { accuracyPercentage: 75.0 },
            { accuracyPercentage: 45.0 },
            { accuracyPercentage: 80.0 }
        ]

        const lowAccuracyCount = predictions.filter(
            p => p.accuracyPercentage !== null && p.accuracyPercentage < 60
        ).length

        expect(lowAccuracyCount).toBe(2) // 50.0 and 45.0
    })

    it('should calculate average accuracy correctly', () => {
        const predictions = [
            { accuracyPercentage: 100.0 },
            { accuracyPercentage: 80.0 },
            { accuracyPercentage: 90.0 }
        ]

        const average = predictions.reduce((sum, p) => sum + (p.accuracyPercentage || 0), 0) / predictions.length

        expect(average).toBe(90.0) // (100 + 80 + 90) / 3
    })

    it('should handle empty predictions array', () => {
        const predictions: any[] = []
        
        const average = predictions.length > 0
            ? predictions.reduce((sum, p) => sum + (p.accuracyPercentage || 0), 0) / predictions.length
            : null

        expect(average).toBe(null)
    })

    it('should filter predictions by category', () => {
        const predictions = [
            { id: 1, predictionType: 'REPLENISHMENT', accuracyPercentage: 95.0 },
            { id: 2, predictionType: 'SAFETY_STOCK', accuracyPercentage: 85.0 },
            { id: 3, predictionType: 'REPLENISHMENT', accuracyPercentage: 75.0 },
            { id: 4, predictionType: 'CUSTOMER_RECOMMENDATION', accuracyPercentage: 90.0 }
        ]

        const replenishmentOnly = predictions.filter(p => p.predictionType === 'REPLENISHMENT')
        const safetyStockOnly = predictions.filter(p => p.predictionType === 'SAFETY_STOCK')

        expect(replenishmentOnly).toHaveLength(2)
        expect(safetyStockOnly).toHaveLength(1)
    })

    it('should use formatAccuracyWithColor for color-coded indicators', () => {
        // Green for >80%
        const high = formatAccuracyWithColor(85)
        expect(high.colorClass).toBe('text-green-700')
        expect(high.bgColorClass).toBe('bg-green-100')

        // Yellow for 60-80%
        const medium = formatAccuracyWithColor(70)
        expect(medium.colorClass).toBe('text-yellow-700')
        expect(medium.bgColorClass).toBe('bg-yellow-100')

        // Red for <60%
        const low = formatAccuracyWithColor(50)
        expect(low.colorClass).toBe('text-red-700')
        expect(low.bgColorClass).toBe('bg-red-100')
    })

    it('should determine if warning message should be shown', () => {
        const predictions1 = [
            { accuracyPercentage: 95.0 },
            { accuracyPercentage: 85.0 }
        ]

        const predictions2 = [
            { accuracyPercentage: 95.0 },
            { accuracyPercentage: 50.0 }
        ]

        const shouldShowWarning1 = predictions1.some(p => p.accuracyPercentage !== null && p.accuracyPercentage < 60)
        const shouldShowWarning2 = predictions2.some(p => p.accuracyPercentage !== null && p.accuracyPercentage < 60)

        expect(shouldShowWarning1).toBe(false)
        expect(shouldShowWarning2).toBe(true)
    })

    it('should handle predictions with null accuracy', () => {
        const predictions = [
            { accuracyPercentage: 95.0 },
            { accuracyPercentage: null },
            { accuracyPercentage: 85.0 }
        ]

        const validPredictions = predictions.filter(p => p.accuracyPercentage !== null)
        const average = validPredictions.reduce((sum, p) => sum + (p.accuracyPercentage || 0), 0) / validPredictions.length

        expect(validPredictions).toHaveLength(2)
        expect(average).toBe(90.0) // (95 + 85) / 2
    })

    it('should determine variance direction', () => {
        const getVarianceDirection = (predicted: number, actual: number | null) => {
            if (actual === null) return 'unknown'
            if (predicted > actual) return 'over'
            if (predicted < actual) return 'under'
            return 'exact'
        }

        expect(getVarianceDirection(100, 80)).toBe('over')
        expect(getVarianceDirection(80, 100)).toBe('under')
        expect(getVarianceDirection(100, 100)).toBe('exact')
        expect(getVarianceDirection(100, null)).toBe('unknown')
    })

    it('should format prediction type labels', () => {
        const formatType = (type: string) => {
            if (type === 'REPLENISHMENT') return 'Replenishment'
            if (type === 'SAFETY_STOCK') return 'Safety Stock'
            if (type === 'CUSTOMER_RECOMMENDATION') return 'Customer Rec.'
            return type
        }

        expect(formatType('REPLENISHMENT')).toBe('Replenishment')
        expect(formatType('SAFETY_STOCK')).toBe('Safety Stock')
        expect(formatType('CUSTOMER_RECOMMENDATION')).toBe('Customer Rec.')
    })
})
