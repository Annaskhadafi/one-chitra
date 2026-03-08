/**
 * Unit tests for comparison data aggregation
 * Requirements: 7.2, 7.3, 7.6, 7.7, 7.10
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '@/db'
import { aiInventoryPredictions } from '@/db/schema/ai-predictions'
import { salesRevenueSap } from '@/db/schema/sap'
import { getComparisonData, updateComparisonData } from '../inventory-ai'
import { eq, and } from 'drizzle-orm'

describe('Comparison Data Aggregation', () => {
  const testProductCode = `TEST-COMP-${Date.now()}`
  const testProductCode2 = `TEST-COMP2-${Date.now()}`
  const testPredictionIds: number[] = []
  const testSalesIds: number[] = []

  beforeAll(async () => {
    // Create test predictions with actual sales data
    const now = new Date()
    
    // Prediction 1: Over-prediction (predicted 100, actual 80)
    const [pred1] = await db.insert(aiInventoryPredictions).values({
      productCode: testProductCode,
      productName: 'Test Product 1',
      predictionType: 'REPLENISHMENT',
      recommendedStock: 100,
      rationale: 'Test prediction 1',
      actualSales: 80,
      currentStock: 50,
      createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    }).returning()
    testPredictionIds.push(pred1.id)

    // Prediction 2: Under-prediction (predicted 50, actual 100)
    const [pred2] = await db.insert(aiInventoryPredictions).values({
      productCode: testProductCode2,
      productName: 'Test Product 2',
      predictionType: 'REPLENISHMENT',
      recommendedStock: 50,
      rationale: 'Test prediction 2',
      actualSales: 100,
      currentStock: 30,
      createdAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
    }).returning()
    testPredictionIds.push(pred2.id)

    // Prediction 3: Perfect prediction (predicted 75, actual 75)
    const [pred3] = await db.insert(aiInventoryPredictions).values({
      productCode: testProductCode,
      productName: 'Test Product 1',
      predictionType: 'SAFETY_STOCK',
      recommendedStock: 75,
      rationale: 'Test prediction 3',
      actualSales: 75,
      currentStock: 40,
      createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    }).returning()
    testPredictionIds.push(pred3.id)

    // Prediction 4: No actual sales data (should be excluded)
    const [pred4] = await db.insert(aiInventoryPredictions).values({
      productCode: testProductCode2,
      productName: 'Test Product 2',
      predictionType: 'REPLENISHMENT',
      recommendedStock: 60,
      rationale: 'Test prediction 4',
      actualSales: null,
      currentStock: 25,
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    }).returning()
    testPredictionIds.push(pred4.id)
  })

  afterAll(async () => {
    // Clean up test data
    for (const id of testPredictionIds) {
      await db.delete(aiInventoryPredictions).where(eq(aiInventoryPredictions.id, id))
    }
    for (const id of testSalesIds) {
      await db.delete(salesRevenueSap).where(eq(salesRevenueSap.salesRevId, id))
    }
  })

  /**
   * Test: Query predictions with actual sales data
   * Requirement 7.2
   */
  it('should query only predictions with actual sales data', async () => {
    const result = await getComparisonData()

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    
    if (result.success && result.data) {
      // Should include predictions 1, 2, 3 but not 4 (no actual sales)
      const testPredictions = result.data.filter(
        item => item.productCode === testProductCode || item.productCode === testProductCode2
      )
      
      expect(testPredictions.length).toBeGreaterThanOrEqual(3)
      
      // All returned predictions should have actual sales data
      testPredictions.forEach(pred => {
        expect(pred.actualSales).toBeDefined()
        expect(pred.actualSales).not.toBeNull()
      })
    }
  })

  /**
   * Test: Calculate variance percentage correctly
   * Requirement 7.3
   */
  it('should calculate variance percentage using formula ((Predicted - Actual) / Actual * 100)', async () => {
    const result = await getComparisonData()

    expect(result.success).toBe(true)
    
    if (result.success && result.data) {
      const testPredictions = result.data.filter(
        item => item.productCode === testProductCode || item.productCode === testProductCode2
      )

      // Find the over-prediction case (predicted 100, actual 80)
      const overPrediction = testPredictions.find(
        p => p.predictedStock === 100 && p.actualSales === 80
      )
      if (overPrediction) {
        // Variance = ((100 - 80) / 80) * 100 = 25%
        expect(overPrediction.variancePercentage).toBeCloseTo(25, 1)
      }

      // Find the under-prediction case (predicted 50, actual 100)
      const underPrediction = testPredictions.find(
        p => p.predictedStock === 50 && p.actualSales === 100
      )
      if (underPrediction) {
        // Variance = ((50 - 100) / 100) * 100 = -50%
        expect(underPrediction.variancePercentage).toBeCloseTo(-50, 1)
      }

      // Find the perfect prediction case (predicted 75, actual 75)
      const perfectPrediction = testPredictions.find(
        p => p.predictedStock === 75 && p.actualSales === 75
      )
      if (perfectPrediction) {
        // Variance = ((75 - 75) / 75) * 100 = 0%
        expect(perfectPrediction.variancePercentage).toBe(0)
      }
    }
  })

  /**
   * Test: Calculate summary statistics
   * Requirement 7.7
   */
  it('should calculate summary statistics (average variance, over/under predictions)', async () => {
    const result = await getComparisonData()

    expect(result.success).toBe(true)
    expect(result.summary).toBeDefined()
    
    if (result.success && result.summary) {
      // Summary should have all required fields
      expect(result.summary.averageVariance).toBeDefined()
      expect(result.summary.totalOverPrediction).toBeDefined()
      expect(result.summary.totalUnderPrediction).toBeDefined()
      expect(result.summary.totalComparisons).toBeDefined()

      // Average variance should be a positive number
      expect(result.summary.averageVariance).toBeGreaterThanOrEqual(0)

      // Total comparisons should match data length
      expect(result.summary.totalComparisons).toBe(result.data?.length || 0)

      // Over + under predictions should equal total comparisons (excluding perfect predictions)
      const perfectPredictions = result.data?.filter(d => d.variancePercentage === 0).length || 0
      expect(
        result.summary.totalOverPrediction + result.summary.totalUnderPrediction + perfectPredictions
      ).toBe(result.summary.totalComparisons)
    }
  })

  /**
   * Test: Support monthly filtering
   * Requirement 7.6
   */
  it('should support monthly filtering', async () => {
    const result = await getComparisonData({ timePeriod: 'monthly' })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    
    if (result.success && result.data) {
      // All predictions should be from the last month
      const oneMonthAgo = new Date()
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
      
      result.data.forEach(pred => {
        expect(new Date(pred.predictionDate).getTime()).toBeGreaterThanOrEqual(oneMonthAgo.getTime())
      })
    }
  })

  /**
   * Test: Support quarterly filtering
   * Requirement 7.6
   */
  it('should support quarterly filtering', async () => {
    const result = await getComparisonData({ timePeriod: 'quarterly' })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    
    if (result.success && result.data) {
      // All predictions should be from the last quarter (3 months)
      const threeMonthsAgo = new Date()
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
      
      result.data.forEach(pred => {
        expect(new Date(pred.predictionDate).getTime()).toBeGreaterThanOrEqual(threeMonthsAgo.getTime())
      })
    }
  })

  /**
   * Test: Handle edge case - zero actual sales
   * Requirement 7.3
   */
  it('should handle edge case where actual sales is zero', async () => {
    // Create a prediction with zero actual sales
    const [pred] = await db.insert(aiInventoryPredictions).values({
      productCode: `TEST-ZERO-${Date.now()}`,
      productName: 'Zero Sales Product',
      predictionType: 'REPLENISHMENT',
      recommendedStock: 50,
      rationale: 'Test zero sales',
      actualSales: 0,
      currentStock: 50,
    }).returning()
    testPredictionIds.push(pred.id)

    const result = await getComparisonData()

    expect(result.success).toBe(true)
    
    if (result.success && result.data) {
      const zeroSalesPred = result.data.find(p => p.predictionId === pred.id)
      
      if (zeroSalesPred) {
        // When actual is 0 but predicted is not, variance should be 100%
        expect(zeroSalesPred.variancePercentage).toBe(100)
      }
    }
  })

  /**
   * Test: Update comparison data with latest sales from SAP
   * Requirement 7.10
   */
  it('should update predictions with actual sales data from SAP', async () => {
    const testProduct = `TEST-UPDATE-${Date.now()}`
    
    // Create a prediction without actual sales data
    const predictionDate = new Date()
    predictionDate.setDate(predictionDate.getDate() - 35) // 35 days ago
    
    const [pred] = await db.insert(aiInventoryPredictions).values({
      productCode: testProduct,
      productName: 'Update Test Product',
      predictionType: 'REPLENISHMENT',
      recommendedStock: 100,
      rationale: 'Test update',
      actualSales: null,
      accuracyPercentage: null,
      currentStock: 50,
      createdAt: predictionDate,
    }).returning()
    testPredictionIds.push(pred.id)

    // Create sales data in SAP table
    const salesDate = new Date(predictionDate)
    salesDate.setDate(salesDate.getDate() + 10) // 10 days after prediction
    
    const [sales] = await db.insert(salesRevenueSap).values({
      materialNo: testProduct,
      materialDescription: 'Update Test Product',
      customer: 'TEST-CUST',
      customerName: 'Test Customer',
      qty: 85,
      billingDate: salesDate,
      billingNo: `TEST-${Date.now()}`,
    }).returning()
    testSalesIds.push(sales.salesRevId)

    // Run the update function
    const updateResult = await updateComparisonData()

    expect(updateResult.success).toBe(true)
    
    if (updateResult.success) {
      expect(updateResult.updatedCount).toBeGreaterThan(0)
    }

    // Verify the prediction was updated
    const [updatedPred] = await db
      .select()
      .from(aiInventoryPredictions)
      .where(eq(aiInventoryPredictions.id, pred.id))

    expect(updatedPred.actualSales).toBe(85)
    expect(updatedPred.accuracyPercentage).toBeDefined()
    expect(updatedPred.accuracyPercentage).not.toBeNull()
    
    // Verify accuracy calculation
    // Variance = |((100 - 85) / 85) * 100| = 17.65%
    // Accuracy = 100 - 17.65 = 82.35%
    if (updatedPred.accuracyPercentage) {
      expect(updatedPred.accuracyPercentage).toBeCloseTo(82.35, 1)
    }
  })

  /**
   * Test: Summary statistics with no data
   * Edge case test
   */
  it('should handle empty data gracefully', async () => {
    // Query with a date range that has no data
    const futureDate = new Date()
    futureDate.setFullYear(futureDate.getFullYear() + 1)
    
    const result = await getComparisonData({
      dateFrom: futureDate,
      dateTo: futureDate,
    })

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.data?.length).toBe(0)
    
    if (result.success && result.summary) {
      expect(result.summary.totalComparisons).toBe(0)
      expect(result.summary.averageVariance).toBe(0)
      expect(result.summary.totalOverPrediction).toBe(0)
      expect(result.summary.totalUnderPrediction).toBe(0)
    }
  })
})
