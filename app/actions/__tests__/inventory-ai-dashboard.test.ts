/**
 * Unit Tests for Dashboard Metrics Calculation
 * Feature: ai-inventory-forecast-enhancement
 * Task: 2.1 Create dashboard data aggregation server action
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { db } from '@/db'
import { aiInventoryPredictions, warehouses, user } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'

// Mock the RBAC module to bypass authentication in tests
vi.mock('@/lib/rbac', () => ({
  getAuthenticatedSession: vi.fn().mockResolvedValue({
    user: { id: 'test-user-ai-dashboard' },
  }),
  checkPermission: vi.fn().mockResolvedValue(true),
}))

// Test data setup
let testUserId: string
const createdPredictionIds: number[] = []

beforeAll(async () => {
  // Create a test user
  const [testUser] = await db.insert(user).values({
    id: 'test-user-ai-dashboard',
    name: 'Test User Dashboard',
    email: 'test-dashboard@example.com',
    emailVerified: false,
  }).returning()
  testUserId = testUser.id
})

afterAll(async () => {
  // Cleanup test data
  if (createdPredictionIds.length > 0) {
    await db.delete(aiInventoryPredictions).where(
      inArray(aiInventoryPredictions.id, createdPredictionIds)
    )
  }
  await db.delete(user).where(eq(user.id, testUserId))
})

describe('Dashboard Metrics - Unit Tests', () => {
  
  /**
   * Test: getDashboardMetrics returns correct structure
   * Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
   */
  it('should return dashboard metrics with correct structure', async () => {
    const { getDashboardMetrics } = await import('@/app/actions/inventory-ai')
    
    const result = await getDashboardMetrics()
    
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    
    if (result.data) {
      // Verify structure
      expect(result.data).toHaveProperty('predictions7Days')
      expect(result.data).toHaveProperty('predictions30Days')
      expect(result.data).toHaveProperty('predictionsByType')
      expect(result.data).toHaveProperty('topRestockProducts')
      expect(result.data).toHaveProperty('productsNearRestock')
      expect(result.data).toHaveProperty('averageAccuracy')
      
      // Verify types
      expect(typeof result.data.predictions7Days).toBe('number')
      expect(typeof result.data.predictions30Days).toBe('number')
      expect(typeof result.data.productsNearRestock).toBe('number')
      
      // Verify predictionsByType structure
      expect(result.data.predictionsByType).toHaveProperty('replenishment')
      expect(result.data.predictionsByType).toHaveProperty('safetyStock')
      expect(result.data.predictionsByType).toHaveProperty('customerRecommendation')
      
      // Verify topRestockProducts is an array
      expect(Array.isArray(result.data.topRestockProducts)).toBe(true)
      
      // Verify averageAccuracy is number or null
      expect(
        result.data.averageAccuracy === null || 
        typeof result.data.averageAccuracy === 'number'
      ).toBe(true)
    }
  })

  /**
   * Test: Metrics calculation with no data
   * Validates: Requirements 1.2, 1.3
   */
  it('should handle empty database gracefully', async () => {
    const { getDashboardMetrics } = await import('@/app/actions/inventory-ai')
    
    const result = await getDashboardMetrics()
    
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    
    if (result.data) {
      // All counts should be >= 0
      expect(result.data.predictions7Days).toBeGreaterThanOrEqual(0)
      expect(result.data.predictions30Days).toBeGreaterThanOrEqual(0)
      expect(result.data.productsNearRestock).toBeGreaterThanOrEqual(0)
      
      // Type breakdown should have all types
      expect(result.data.predictionsByType.replenishment).toBeGreaterThanOrEqual(0)
      expect(result.data.predictionsByType.safetyStock).toBeGreaterThanOrEqual(0)
      expect(result.data.predictionsByType.customerRecommendation).toBeGreaterThanOrEqual(0)
      
      // Top products should be an array (possibly empty)
      expect(Array.isArray(result.data.topRestockProducts)).toBe(true)
    }
  })

  /**
   * Test: Metrics calculation with single prediction
   * Validates: Requirements 1.2, 1.4, 1.5
   */
  it('should correctly count single prediction', async () => {
    // Create a test prediction
    const [prediction] = await db.insert(aiInventoryPredictions).values({
      productCode: 'TEST-001',
      productName: 'Test Product',
      predictionType: 'REPLENISHMENT',
      recommendedStock: 100,
      rationale: 'Test rationale',
      currentStock: 50,
      createdAt: new Date(), // Recent prediction
    }).returning()
    
    createdPredictionIds.push(prediction.id)
    
    const { getDashboardMetrics } = await import('@/app/actions/inventory-ai')
    const result = await getDashboardMetrics()
    
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    
    if (result.data) {
      // Should count in both 7 days and 30 days
      expect(result.data.predictions7Days).toBeGreaterThanOrEqual(1)
      expect(result.data.predictions30Days).toBeGreaterThanOrEqual(1)
      
      // Should count in replenishment type
      expect(result.data.predictionsByType.replenishment).toBeGreaterThanOrEqual(1)
      
      // Should appear in top restock products
      const foundProduct = result.data.topRestockProducts.find(
        p => p.productCode === 'TEST-001'
      )
      expect(foundProduct).toBeDefined()
      if (foundProduct) {
        expect(foundProduct.recommendedStock).toBe(100)
        expect(foundProduct.currentStock).toBe(50)
      }
    }
  })

  /**
   * Test: Products near restock calculation
   * Validates: Requirement 1.6
   */
  it('should correctly identify products near restock point', async () => {
    // Create predictions with different stock levels
    const predictions = await db.insert(aiInventoryPredictions).values([
      {
        productCode: 'TEST-LOW-1',
        productName: 'Low Stock Product 1',
        predictionType: 'REPLENISHMENT',
        recommendedStock: 1000,
        currentStock: 150, // 15% - should be counted
        rationale: 'Test',
      },
      {
        productCode: 'TEST-LOW-2',
        productName: 'Low Stock Product 2',
        predictionType: 'REPLENISHMENT',
        recommendedStock: 500,
        currentStock: 50, // 10% - should be counted
        rationale: 'Test',
      },
      {
        productCode: 'TEST-OK',
        productName: 'OK Stock Product',
        predictionType: 'REPLENISHMENT',
        recommendedStock: 100,
        currentStock: 50, // 50% - should NOT be counted
        rationale: 'Test',
      },
    ]).returning()
    
    predictions.forEach(p => createdPredictionIds.push(p.id))
    
    const { getDashboardMetrics } = await import('@/app/actions/inventory-ai')
    const result = await getDashboardMetrics()
    
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    
    if (result.data) {
      // Should count at least the 2 low stock products we created
      expect(result.data.productsNearRestock).toBeGreaterThanOrEqual(2)
    }
  })

  /**
   * Test: Prediction type breakdown
   * Validates: Requirement 1.4
   */
  it('should correctly break down predictions by type', async () => {
    // Create predictions of different types
    const predictions = await db.insert(aiInventoryPredictions).values([
      {
        productCode: 'TEST-TYPE-1',
        productName: 'Replenishment Test',
        predictionType: 'REPLENISHMENT',
        recommendedStock: 100,
        rationale: 'Test',
      },
      {
        productCode: 'TEST-TYPE-2',
        productName: 'Safety Stock Test',
        predictionType: 'SAFETY_STOCK',
        recommendedStock: 50,
        rationale: 'Test',
      },
      {
        productCode: 'TEST-TYPE-3',
        productName: 'Customer Rec Test',
        predictionType: 'CUSTOMER_RECOMMENDATION',
        recommendedStock: 0,
        rationale: 'Test recommendations',
      },
    ]).returning()
    
    predictions.forEach(p => createdPredictionIds.push(p.id))
    
    const { getDashboardMetrics } = await import('@/app/actions/inventory-ai')
    const result = await getDashboardMetrics()
    
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    
    if (result.data) {
      // Each type should have at least 1 prediction
      expect(result.data.predictionsByType.replenishment).toBeGreaterThanOrEqual(1)
      expect(result.data.predictionsByType.safetyStock).toBeGreaterThanOrEqual(1)
      expect(result.data.predictionsByType.customerRecommendation).toBeGreaterThanOrEqual(1)
    }
  })

  /**
   * Test: Top restock products ordering
   * Validates: Requirement 1.5
   */
  it('should return top products ordered by recommended stock', async () => {
    // Create predictions with different recommended stock levels
    const predictions = await db.insert(aiInventoryPredictions).values([
      {
        productCode: 'TEST-TOP-1',
        productName: 'Highest Stock',
        predictionType: 'REPLENISHMENT',
        recommendedStock: 5000,
        rationale: 'Test',
      },
      {
        productCode: 'TEST-TOP-2',
        productName: 'Medium Stock',
        predictionType: 'REPLENISHMENT',
        recommendedStock: 3000,
        rationale: 'Test',
      },
      {
        productCode: 'TEST-TOP-3',
        productName: 'Lower Stock',
        predictionType: 'REPLENISHMENT',
        recommendedStock: 1000,
        rationale: 'Test',
      },
    ]).returning()
    
    predictions.forEach(p => createdPredictionIds.push(p.id))
    
    const { getDashboardMetrics } = await import('@/app/actions/inventory-ai')
    const result = await getDashboardMetrics()
    
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    
    if (result.data) {
      const topProducts = result.data.topRestockProducts
      
      // Should have products
      expect(topProducts.length).toBeGreaterThan(0)
      
      // Should be ordered by recommendedStock descending
      for (let i = 0; i < topProducts.length - 1; i++) {
        expect(topProducts[i].recommendedStock).toBeGreaterThanOrEqual(
          topProducts[i + 1].recommendedStock
        )
      }
      
      // Should not exceed 10 products
      expect(topProducts.length).toBeLessThanOrEqual(10)
    }
  })

  /**
   * Test: Average accuracy calculation
   * Validates: Requirement 1.7
   */
  it('should calculate average accuracy for current month', async () => {
    const now = new Date()
    
    // Create predictions with accuracy data for current month (use current date to ensure it's in range)
    const predictions = await db.insert(aiInventoryPredictions).values([
      {
        productCode: 'TEST-ACC-1',
        productName: 'Accurate Prediction 1',
        predictionType: 'REPLENISHMENT',
        recommendedStock: 100,
        rationale: 'Test',
        accuracyPercentage: 85.5,
        createdAt: now, // Use current date
      },
      {
        productCode: 'TEST-ACC-2',
        productName: 'Accurate Prediction 2',
        predictionType: 'REPLENISHMENT',
        recommendedStock: 200,
        rationale: 'Test',
        accuracyPercentage: 90.0,
        createdAt: now, // Use current date
      },
    ]).returning()
    
    predictions.forEach(p => createdPredictionIds.push(p.id))
    
    const { getDashboardMetrics } = await import('@/app/actions/inventory-ai')
    const result = await getDashboardMetrics()
    
    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    
    if (result.data) {
      // Should have an average accuracy (or null if no data with accuracy in current month)
      // Since we just created data with accuracy, it should not be null
      expect(result.data.averageAccuracy).not.toBeNull()
      
      if (result.data.averageAccuracy !== null) {
        // Average should be between 0 and 100
        expect(result.data.averageAccuracy).toBeGreaterThanOrEqual(0)
        expect(result.data.averageAccuracy).toBeLessThanOrEqual(100)
        
        // Should be close to the average of our test data (87.75)
        expect(result.data.averageAccuracy).toBeGreaterThanOrEqual(85)
        expect(result.data.averageAccuracy).toBeLessThanOrEqual(92)
      }
    }
  })
})
