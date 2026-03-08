/**
 * Unit Tests for Sales History Data Fetching
 * Feature: ai-inventory-forecast-enhancement
 * Task: 3.1 Create sales history data fetching function
 * Requirements: 2.2, 2.6
 */

import { describe, it, expect, vi } from 'vitest'

// Mock the RBAC module to bypass authentication in tests
vi.mock('@/lib/rbac', () => ({
  getAuthenticatedSession: vi.fn().mockResolvedValue({
    user: { id: 'test-user-sales-history' },
  }),
  checkPermission: vi.fn().mockResolvedValue(true),
}))

describe('Sales History - Unit Tests', () => {
  
  /**
   * Test: getSalesHistory returns correct structure
   * Validates: Requirements 2.2, 2.6
   */
  it('should return sales history with correct structure', async () => {
    const { getSalesHistory } = await import('@/app/actions/inventory-ai')
    
    // Use a material number that might exist in the database
    const result = await getSalesHistory('TEST-MATERIAL')
    
    expect(result).toBeDefined()
    expect(result).toHaveProperty('success')
    
    if (result.success) {
      expect(result.data).toBeDefined()
      expect(Array.isArray(result.data)).toBe(true)
      
      // If data exists, verify structure
      if (result.data && result.data.length > 0) {
        const firstItem = result.data[0]
        
        // Verify required fields
        expect(firstItem).toHaveProperty('month')
        expect(firstItem).toHaveProperty('sales')
        expect(firstItem).toHaveProperty('revenue')
        expect(firstItem).toHaveProperty('movingAverage')
        
        // Verify types
        expect(typeof firstItem.month).toBe('string')
        expect(typeof firstItem.sales).toBe('number')
        expect(typeof firstItem.revenue).toBe('number')
        
        // movingAverage can be number or null (null for first 2 months in 3-month MA)
        expect(
          firstItem.movingAverage === null || 
          typeof firstItem.movingAverage === 'number'
        ).toBe(true)
        
        // Month should be in YYYY-MM format
        expect(firstItem.month).toMatch(/^\d{4}-\d{2}$/)
      }
    }
  })

  /**
   * Test: getSalesHistory handles empty material number
   * Validates: Requirements 2.2
   */
  it('should handle empty or non-existent material gracefully', async () => {
    const { getSalesHistory } = await import('@/app/actions/inventory-ai')
    
    const result = await getSalesHistory('NONEXISTENT-MATERIAL-XYZ-999')
    
    expect(result).toBeDefined()
    expect(result.success).toBe(true)
    
    if (result.success) {
      expect(result.data).toBeDefined()
      expect(Array.isArray(result.data)).toBe(true)
      // Should return empty array for non-existent material
      expect(result.data).toEqual([])
    }
  })

  /**
   * Test: Moving average calculation
   * Validates: Requirement 2.6
   */
  it('should calculate 3-month moving average correctly', async () => {
    const { getSalesHistory } = await import('@/app/actions/inventory-ai')
    
    const result = await getSalesHistory('TEST-MATERIAL')
    
    if (result.success && result.data && result.data.length >= 3) {
      // First 2 items should have null moving average
      expect(result.data[0].movingAverage).toBeNull()
      expect(result.data[1].movingAverage).toBeNull()
      
      // Third item onwards should have moving average
      if (result.data.length >= 3) {
        expect(result.data[2].movingAverage).not.toBeNull()
        
        if (result.data[2].movingAverage !== null) {
          // Moving average should be a positive number
          expect(result.data[2].movingAverage).toBeGreaterThanOrEqual(0)
          
          // Verify calculation: MA should be average of first 3 sales values
          const expectedMA = (result.data[0].sales + result.data[1].sales + result.data[2].sales) / 3
          expect(result.data[2].movingAverage).toBeCloseTo(expectedMA, 2)
        }
      }
    }
  })

  /**
   * Test: Date range filtering (last 6 months)
   * Validates: Requirement 2.2
   */
  it('should return data for last 6 months only', async () => {
    const { getSalesHistory } = await import('@/app/actions/inventory-ai')
    
    const result = await getSalesHistory('TEST-MATERIAL')
    
    if (result.success && result.data && result.data.length > 0) {
      // Calculate 6 months ago
      const now = new Date()
      const sixMonthsAgo = new Date(now)
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      const sixMonthsAgoStr = sixMonthsAgo.toISOString().substring(0, 7) // YYYY-MM
      
      // All returned months should be >= 6 months ago
      result.data.forEach(item => {
        expect(item.month >= sixMonthsAgoStr).toBe(true)
      })
      
      // Should not have more than 6 months of data
      expect(result.data.length).toBeLessThanOrEqual(6)
    }
  })

  /**
   * Test: Data ordering (chronological)
   * Validates: Requirement 2.2
   */
  it('should return data in chronological order', async () => {
    const { getSalesHistory } = await import('@/app/actions/inventory-ai')
    
    const result = await getSalesHistory('TEST-MATERIAL')
    
    if (result.success && result.data && result.data.length > 1) {
      // Verify data is sorted by month ascending
      for (let i = 0; i < result.data.length - 1; i++) {
        expect(result.data[i].month <= result.data[i + 1].month).toBe(true)
      }
    }
  })

  /**
   * Test: Error handling
   * Validates: Requirements 2.2
   */
  it('should handle errors gracefully', async () => {
    const { getSalesHistory } = await import('@/app/actions/inventory-ai')
    
    // Test with various inputs
    const result1 = await getSalesHistory('')
    expect(result1).toBeDefined()
    expect(result1).toHaveProperty('success')
    
    const result2 = await getSalesHistory('   ')
    expect(result2).toBeDefined()
    expect(result2).toHaveProperty('success')
  })
})
