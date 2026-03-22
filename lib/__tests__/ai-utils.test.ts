import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
    getDateRange,
    calculateAccuracy,
    calculateUrgencyLevel,
    formatAccuracyWithColor,
    formatUrgencyWithColor,
    generateBatchId,
    calculateMovingAverage,
    isPredictionOlderThan,
    formatPredictionDate,
    getDefaultAIConfig
} from '../ai-utils'

describe('AI Utils - Date Functions', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
    })

    it('should calculate date range for 7 days', () => {
        const { start, end } = getDateRange(7)
        
        expect(start.getDate()).toBe(8) // 15 - 7 = 8
        expect(start.getHours()).toBe(0)
        expect(start.getMinutes()).toBe(0)
        
        expect(end.getDate()).toBe(15)
        expect(end.getHours()).toBe(23)
        expect(end.getMinutes()).toBe(59)
    })

    it('should calculate date range for 30 days', () => {
        const { start, end } = getDateRange(30)
        
        expect(start.getMonth()).toBe(11) // December (0-indexed)
        expect(start.getDate()).toBe(16) // 15 - 30 days
    })

    it('should check if prediction is older than specified days', () => {
        const oldDate = new Date('2024-01-01T12:00:00Z')
        const recentDate = new Date('2024-01-14T12:00:00Z')
        
        expect(isPredictionOlderThan(oldDate, 10)).toBe(true)
        expect(isPredictionOlderThan(recentDate, 10)).toBe(false)
    })

    it('should format prediction date correctly', () => {
        const date = new Date('2024-01-15T14:30:00Z')
        const formatted = formatPredictionDate(date)
        
        expect(formatted).toContain('2024')
        expect(formatted).toContain('15')
    })

    vi.useRealTimers()
})

describe('AI Utils - Accuracy Calculation', () => {
    it('should calculate 100% accuracy for perfect prediction', () => {
        expect(calculateAccuracy(100, 100)).toBe(100)
        expect(calculateAccuracy(50, 50)).toBe(100)
    })

    it('should calculate accuracy for over-prediction', () => {
        // Predicted 120, Actual 100
        // Accuracy = 100 - ABS((120 - 100) / 100 * 100) = 100 - 20 = 80
        expect(calculateAccuracy(120, 100)).toBe(80)
    })

    it('should calculate accuracy for under-prediction', () => {
        // Predicted 80, Actual 100
        // Accuracy = 100 - ABS((80 - 100) / 100 * 100) = 100 - 20 = 80
        expect(calculateAccuracy(80, 100)).toBe(80)
    })

    it('should handle zero actual value', () => {
        expect(calculateAccuracy(0, 0)).toBe(100) // Both zero = perfect
        expect(calculateAccuracy(50, 0)).toBe(0) // Predicted something when actual is 0
    })

    it('should clamp accuracy between 0 and 100', () => {
        // Very bad prediction: 1000 predicted vs 10 actual
        // = 100 - ABS((1000-10)/10*100) = 100 - 9900 = -9800, clamped to 0
        expect(calculateAccuracy(1000, 10)).toBe(0)
        
        // Very bad prediction: 10 predicted vs 1000 actual
        // = 100 - ABS((10-1000)/1000*100) = 100 - 99 = 1
        expect(calculateAccuracy(10, 1000)).toBe(1)
    })

    it('should handle decimal values', () => {
        const accuracy = calculateAccuracy(95, 100)
        expect(accuracy).toBe(95)
    })
})

describe('AI Utils - Urgency Level Calculation', () => {
    it('should return CRITICAL for stock < 10%', () => {
        expect(calculateUrgencyLevel(5, 100)).toBe('CRITICAL')
        expect(calculateUrgencyLevel(9, 100)).toBe('CRITICAL')
    })

    it('should return HIGH for stock 10-20%', () => {
        expect(calculateUrgencyLevel(10, 100)).toBe('HIGH')
        expect(calculateUrgencyLevel(15, 100)).toBe('HIGH')
        expect(calculateUrgencyLevel(19, 100)).toBe('HIGH')
    })

    it('should return MEDIUM for stock 20-30%', () => {
        expect(calculateUrgencyLevel(20, 100)).toBe('MEDIUM')
        expect(calculateUrgencyLevel(25, 100)).toBe('MEDIUM')
        expect(calculateUrgencyLevel(29, 100)).toBe('MEDIUM')
    })

    it('should return OK for stock >= 30%', () => {
        expect(calculateUrgencyLevel(30, 100)).toBe('OK')
        expect(calculateUrgencyLevel(50, 100)).toBe('OK')
        expect(calculateUrgencyLevel(100, 100)).toBe('OK')
    })

    it('should handle zero recommended stock', () => {
        expect(calculateUrgencyLevel(50, 0)).toBe('OK')
    })

    it('should handle edge cases', () => {
        expect(calculateUrgencyLevel(0, 100)).toBe('CRITICAL')
        expect(calculateUrgencyLevel(100, 50)).toBe('OK') // Over-stocked
    })
})

describe('AI Utils - Formatting Functions', () => {
    it('should format accuracy with correct colors', () => {
        const high = formatAccuracyWithColor(85)
        expect(high.text).toBe('85.0%')
        expect(high.colorClass).toBe('text-green-700')
        expect(high.bgColorClass).toBe('bg-green-100')

        const medium = formatAccuracyWithColor(70)
        expect(medium.text).toBe('70.0%')
        expect(medium.colorClass).toBe('text-yellow-700')
        expect(medium.bgColorClass).toBe('bg-yellow-100')

        const low = formatAccuracyWithColor(50)
        expect(low.text).toBe('50.0%')
        expect(low.colorClass).toBe('text-red-700')
        expect(low.bgColorClass).toBe('bg-red-100')

        const na = formatAccuracyWithColor(null)
        expect(na.text).toBe('N/A')
        expect(na.colorClass).toBe('text-gray-500')
    })

    it('should format urgency with correct colors', () => {
        const critical = formatUrgencyWithColor('CRITICAL')
        expect(critical.text).toBe('Critical')
        expect(critical.colorClass).toBe('text-red-700')

        const high = formatUrgencyWithColor('HIGH')
        expect(high.text).toBe('High')
        expect(high.colorClass).toBe('text-orange-700')

        const medium = formatUrgencyWithColor('MEDIUM')
        expect(medium.text).toBe('Medium')
        expect(medium.colorClass).toBe('text-yellow-700')

        const ok = formatUrgencyWithColor('OK')
        expect(ok.text).toBe('OK')
        expect(ok.colorClass).toBe('text-green-700')
    })
})

describe('AI Utils - Batch ID Generation', () => {
    it('should generate unique batch IDs', () => {
        const id1 = generateBatchId()
        const id2 = generateBatchId()
        
        expect(id1).toMatch(/^BATCH_\d{8}T\d{6}_[A-Z0-9]{6}$/)
        expect(id2).toMatch(/^BATCH_\d{8}T\d{6}_[A-Z0-9]{6}$/)
        expect(id1).not.toBe(id2) // Should be different due to random component
    })

    it('should start with BATCH_ prefix', () => {
        const id = generateBatchId()
        expect(id.startsWith('BATCH_')).toBe(true)
    })
})

describe('AI Utils - Moving Average Calculation', () => {
    it('should calculate 3-month moving average', () => {
        const data = [10, 20, 30, 40, 50]
        const ma = calculateMovingAverage(data, 3)
        
        expect(ma[0]).toBe(null)
        expect(ma[1]).toBe(null)
        expect(ma[2]).toBe(20) // (10 + 20 + 30) / 3
        expect(ma[3]).toBe(30) // (20 + 30 + 40) / 3
        expect(ma[4]).toBe(40) // (30 + 40 + 50) / 3
    })

    it('should return all nulls if data length < window', () => {
        const data = [10, 20]
        const ma = calculateMovingAverage(data, 3)
        
        expect(ma).toEqual([null, null])
    })

    it('should handle single window size', () => {
        const data = [10, 20, 30]
        const ma = calculateMovingAverage(data, 1)
        
        expect(ma).toEqual([10, 20, 30])
    })

    it('should handle empty array', () => {
        const data: number[] = []
        const ma = calculateMovingAverage(data, 3)
        
        expect(ma).toEqual([])
    })
})

describe('AI Utils - Default Configuration', () => {
    it('should return default AI config', () => {
        const config = getDefaultAIConfig()
        
        expect(config.model).toBe('qwen/qwen3-32b')
        expect(config.temperature).toBe(0.7)
        expect(config.maxTokens).toBe(4096)
        expect(config.cacheDuration).toBe(24)
        expect(config.thinkingMode).toBe(false)
    })

    it('should return consistent config', () => {
        const config1 = getDefaultAIConfig()
        const config2 = getDefaultAIConfig()
        
        expect(config1).toEqual(config2)
    })
})
