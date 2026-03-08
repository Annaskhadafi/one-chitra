/**
 * Utility functions for AI Inventory Forecast features
 */

/**
 * Calculate the date range for a given period
 * @param days Number of days to look back
 * @returns Object with start and end dates
 */
export function getDateRange(days: number): { start: Date; end: Date } {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
    return { start, end }
}

/**
 * Calculate accuracy percentage based on predicted vs actual values
 * Formula: 100 - ABS((Predicted - Actual) / Actual * 100)
 * @param predicted Predicted stock value
 * @param actual Actual sales value
 * @returns Accuracy percentage (0-100)
 */
export function calculateAccuracy(predicted: number, actual: number): number {
    if (actual === 0) {
        // If actual is 0, return 0% accuracy if predicted > 0, else 100%
        return predicted === 0 ? 100 : 0
    }
    
    const accuracy = 100 - Math.abs((predicted - actual) / actual * 100)
    // Clamp between 0 and 100
    return Math.max(0, Math.min(100, accuracy))
}

/**
 * Determine urgency level based on stock percentage
 * @param currentStock Current stock level
 * @param recommendedStock Recommended stock level
 * @returns Urgency level: CRITICAL (<10%), HIGH (10-20%), MEDIUM (20-30%)
 */
export function calculateUrgencyLevel(
    currentStock: number,
    recommendedStock: number
): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'OK' {
    if (recommendedStock === 0) return 'OK'
    
    const percentage = (currentStock / recommendedStock) * 100
    
    if (percentage < 10) return 'CRITICAL'
    if (percentage < 20) return 'HIGH'
    if (percentage < 30) return 'MEDIUM'
    return 'OK'
}

/**
 * Format accuracy percentage with color indicator
 * @param accuracy Accuracy percentage
 * @returns Object with formatted text and color class
 */
export function formatAccuracyWithColor(accuracy: number | null): {
    text: string
    colorClass: string
    bgColorClass: string
} {
    if (accuracy === null) {
        return {
            text: 'N/A',
            colorClass: 'text-gray-500',
            bgColorClass: 'bg-gray-100'
        }
    }
    
    const formatted = `${accuracy.toFixed(1)}%`
    
    if (accuracy >= 80) {
        return {
            text: formatted,
            colorClass: 'text-green-700',
            bgColorClass: 'bg-green-100'
        }
    }
    
    if (accuracy >= 60) {
        return {
            text: formatted,
            colorClass: 'text-yellow-700',
            bgColorClass: 'bg-yellow-100'
        }
    }
    
    return {
        text: formatted,
        colorClass: 'text-red-700',
        bgColorClass: 'bg-red-100'
    }
}

/**
 * Format urgency level with color
 * @param urgency Urgency level
 * @returns Object with formatted text and color classes
 */
export function formatUrgencyWithColor(urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'OK'): {
    text: string
    colorClass: string
    bgColorClass: string
} {
    const urgencyMap = {
        CRITICAL: {
            text: 'Critical',
            colorClass: 'text-red-700',
            bgColorClass: 'bg-red-100'
        },
        HIGH: {
            text: 'High',
            colorClass: 'text-orange-700',
            bgColorClass: 'bg-orange-100'
        },
        MEDIUM: {
            text: 'Medium',
            colorClass: 'text-yellow-700',
            bgColorClass: 'bg-yellow-100'
        },
        OK: {
            text: 'OK',
            colorClass: 'text-green-700',
            bgColorClass: 'bg-green-100'
        }
    }
    
    return urgencyMap[urgency]
}

/**
 * Generate a unique batch ID for bulk predictions
 * @returns Batch ID in format: BATCH_YYYYMMDD_HHMMSS_RANDOM
 */
export function generateBatchId(): string {
    const now = new Date()
    const dateStr = now.toISOString().replace(/[-:]/g, '').split('.')[0]
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `BATCH_${dateStr}_${random}`
}

/**
 * Calculate moving average for a dataset
 * @param data Array of numbers
 * @param window Window size for moving average
 * @returns Array of moving averages
 */
export function calculateMovingAverage(data: number[], window: number): (number | null)[] {
    if (data.length < window) {
        return data.map(() => null)
    }
    
    const result: (number | null)[] = []
    
    for (let i = 0; i < data.length; i++) {
        if (i < window - 1) {
            result.push(null)
        } else {
            const sum = data.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0)
            result.push(sum / window)
        }
    }
    
    return result
}

/**
 * Check if a prediction is older than specified days
 * @param createdAt Prediction creation date
 * @param days Number of days
 * @returns True if prediction is older than specified days
 */
export function isPredictionOlderThan(createdAt: Date, days: number): boolean {
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - createdAt.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays > days
}

/**
 * Format date for display
 * @param date Date to format
 * @returns Formatted date string
 */
export function formatPredictionDate(date: Date): string {
    return new Intl.DateTimeFormat('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date)
}

/**
 * Get default AI configuration
 * @returns Default AI config object
 */
export function getDefaultAIConfig(): {
    model: string
    temperature: number
    maxTokens: number
    cacheDuration: number
    thinkingMode: boolean
} {
    return {
        model: 'qwen/qwen3-32b',
        temperature: 0.7,
        maxTokens: 4096,
        cacheDuration: 24, // hours
        thinkingMode: false
    }
}
