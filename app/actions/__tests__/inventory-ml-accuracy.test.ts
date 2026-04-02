/**
 * Unit Tests for Prediction Accuracy Calculation
 * Feature: ai-inventory-forecast-enhancement
 * Task: 5.1 Create accuracy calculation background job
 * Requirements: 3.1, 3.2, 3.4
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { db } from '@/db'
import { aiInventoryPredictions, salesRevenueSap, user } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'

// Mock the RBAC module to bypass authentication in tests
vi.mock('@/lib/rbac', () => ({
  getAuthenticatedSession: vi.fn().mockResolvedValue({
    user: { id: 'test-user-accuracy' },
  }),
  checkPermission: vi.fn().mockResolvedValue(true),
}))

// Test data setup
let testUserId: string
const createdPredictionIds: number[] = []
const createdSalesIds: number[] = []
let salesRevIdCounter = Math.floor(Date.now() % 1_000_000_000)

const nextSalesRevId = () => {
  salesRevIdCounter += 1
  return salesRevIdCounter
}

beforeAll(async () => {
  // Create a test user with unique email based on timestamp
  const uniqueEmail = `test-accuracy-${Date.now()}@example.com`
  const uniqueId = `test-user-accuracy-${Date.now()}`

  const [testUser] = await db.insert(user).values({
    id: uniqueId,
    name: 'Test User Accuracy',
    email: uniqueEmail,
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
  if (createdSalesIds.length > 0) {
    await db.delete(salesRevenueSap).where(
      inArray(salesRevenueSap.salesRevId, createdSalesIds)
    )
  }
  await db.delete(user).where(eq(user.id, testUserId))
})

describe('Prediction Accuracy Calculation - Unit Tests', () => {

  /**
   * Test: calculatePredictionAccuracy returns correct structure
   * Validates: Requirements 3.1, 3.2
   */
  it('should return result with correct structure', async () => {
    const { calculatePredictionAccuracy } = await import('@/app/actions/inventory-ml')

    const result = await calculatePredictionAccuracy()

    expect(result.success).toBe(true)
    expect(result).toHaveProperty('message')
    expect(result).toHaveProperty('processed')
    expect(result).toHaveProperty('updated')

    expect(typeof result.processed).toBe('number')
    expect(typeof result.updated).toBe('number')
  })

  /**
   * Test: No predictions to process
   * Validates: Requirements 3.1, 3.2
   */
  it('should handle case with no old predictions gracefully', async () => {
    const { calculatePredictionAccuracy } = await import('@/app/actions/inventory-ml')

    const result = await calculatePredictionAccuracy()

    expect(result.success).toBe(true)
    expect(result.processed).toBeGreaterThanOrEqual(0)
    expect(result.updated).toBeGreaterThanOrEqual(0)
  })

  /**
   * Test: Accuracy calculation with actual sales data
   * Validates: Requirements 3.2, 3.4
   */
  it('should calculate accuracy correctly when actual sales exist', async () => {
    // Create a prediction from 35 days ago (older than 30 days)
    const predictionDate = new Date()
    predictionDate.setDate(predictionDate.getDate() - 35)

    // Use unique product code to avoid conflicts with previous test runs
    const uniqueProductCode = `TEST-ACC-${Date.now()}`

    const [prediction] = await db.insert(aiInventoryPredictions).values({
      productCode: uniqueProductCode,
      productName: 'Test Accuracy Product',
      predictionType: 'REPLENISHMENT',
      recommendedStock: 100, // Predicted 100 units
      rationale: 'Test accuracy calculation',
      currentStock: 50,
      createdAt: predictionDate,
      accuracyPercentage: null, // Not yet calculated
    }).returning()

    createdPredictionIds.push(prediction.id)

    // Create actual sales data for the 30-day period after prediction
    const salesDate = new Date(predictionDate)
    salesDate.setDate(salesDate.getDate() + 15) // 15 days after prediction

    const [salesRecord] = await db.insert(salesRevenueSap).values({
      salesRevId: nextSalesRevId(),
      materialNo: uniqueProductCode,
      materialDescription: 'Test Accuracy Product',
      customer: 'TEST-CUST',
      customerName: 'Test Customer',
      qty: 90, // Actual sales: 90 units
      billingDate: salesDate.toISOString(),
      revenueInLocCurr: 9000,
    }).returning()

    createdSalesIds.push(salesRecord.salesRevId)

    // Run accuracy calculation
    const { calculatePredictionAccuracy } = await import('@/app/actions/inventory-ai')
    const result = await calculatePredictionAccuracy()

    expect(result.success).toBe(true)
    expect(result.processed).toBeGreaterThanOrEqual(1)
    expect(result.updated).toBeGreaterThanOrEqual(1)

    // Verify the prediction was updated with accuracy
    const [updatedPrediction] = await db.select()
      .from(aiInventoryPredictions)
      .where(eq(aiInventoryPredictions.id, prediction.id))

    expect(updatedPrediction.actualSales).toBe(90)
    expect(updatedPrediction.accuracyPercentage).not.toBeNull()

    if (updatedPrediction.accuracyPercentage !== null) {
      // Formula: 100 - ABS((100 - 90) / 90 * 100) = 100 - 11.11 = 88.89
      expect(updatedPrediction.accuracyPercentage).toBeGreaterThan(85)
      expect(updatedPrediction.accuracyPercentage).toBeLessThan(92)
    }
  })

  /**
   * Test: Perfect prediction accuracy
   * Validates: Requirement 3.4
   */
  it('should calculate 100% accuracy for perfect predictions', async () => {
    // Create a prediction from 35 days ago
    const predictionDate = new Date()
    predictionDate.setDate(predictionDate.getDate() - 35)

    const uniqueProductCode = `TEST-PERFECT-${Date.now()}`

    const [prediction] = await db.insert(aiInventoryPredictions).values({
      productCode: uniqueProductCode,
      productName: 'Perfect Prediction Product',
      predictionType: 'REPLENISHMENT',
      recommendedStock: 150, // Predicted 150 units
      rationale: 'Test perfect accuracy',
      createdAt: predictionDate,
      accuracyPercentage: null,
    }).returning()

    createdPredictionIds.push(prediction.id)

    // Create actual sales data matching the prediction exactly
    const salesDate = new Date(predictionDate)
    salesDate.setDate(salesDate.getDate() + 10)

    const [salesRecord] = await db.insert(salesRevenueSap).values({
      salesRevId: nextSalesRevId(),
      materialNo: uniqueProductCode,
      materialDescription: 'Perfect Prediction Product',
      customer: 'TEST-CUST',
      customerName: 'Test Customer',
      qty: 150, // Actual sales: 150 units (matches prediction)
      billingDate: salesDate.toISOString(),
      revenueInLocCurr: 15000,
    }).returning()

    createdSalesIds.push(salesRecord.salesRevId)

    // Run accuracy calculation
    const { calculatePredictionAccuracy } = await import('@/app/actions/inventory-ai')
    const result = await calculatePredictionAccuracy()

    expect(result.success).toBe(true)

    // Verify 100% accuracy
    const [updatedPrediction] = await db.select()
      .from(aiInventoryPredictions)
      .where(eq(aiInventoryPredictions.id, prediction.id))

    expect(updatedPrediction.actualSales).toBe(150)
    expect(updatedPrediction.accuracyPercentage).toBe(100)
  })

  /**
   * Test: Low accuracy for poor predictions
   * Validates: Requirement 3.4
   */
  it('should calculate low accuracy for poor predictions', async () => {
    // Create a prediction from 35 days ago
    const predictionDate = new Date()
    predictionDate.setDate(predictionDate.getDate() - 35)

    const uniqueProductCode = `TEST-POOR-${Date.now()}`

    const [prediction] = await db.insert(aiInventoryPredictions).values({
      productCode: uniqueProductCode,
      productName: 'Poor Prediction Product',
      predictionType: 'REPLENISHMENT',
      recommendedStock: 100, // Predicted 100 units
      rationale: 'Test poor accuracy',
      createdAt: predictionDate,
      accuracyPercentage: null,
    }).returning()

    createdPredictionIds.push(prediction.id)

    // Create actual sales data very different from prediction
    const salesDate = new Date(predictionDate)
    salesDate.setDate(salesDate.getDate() + 10)

    const [salesRecord] = await db.insert(salesRevenueSap).values({
      salesRevId: nextSalesRevId(),
      materialNo: uniqueProductCode,
      materialDescription: 'Poor Prediction Product',
      customer: 'TEST-CUST',
      customerName: 'Test Customer',
      qty: 300, // Actual sales: 300 units (3x the prediction)
      billingDate: salesDate.toISOString(),
      revenueInLocCurr: 30000,
    }).returning()

    createdSalesIds.push(salesRecord.salesRevId)

    // Run accuracy calculation
    const { calculatePredictionAccuracy } = await import('@/app/actions/inventory-ai')
    const result = await calculatePredictionAccuracy()

    expect(result.success).toBe(true)

    // Verify low accuracy
    const [updatedPrediction] = await db.select()
      .from(aiInventoryPredictions)
      .where(eq(aiInventoryPredictions.id, prediction.id))

    expect(updatedPrediction.actualSales).toBe(300)
    expect(updatedPrediction.accuracyPercentage).not.toBeNull()

    if (updatedPrediction.accuracyPercentage !== null) {
      // Formula: 100 - ABS((100 - 300) / 300 * 100) = 100 - 66.67 = 33.33
      // Should be low accuracy (around 33%)
      expect(updatedPrediction.accuracyPercentage).toBeLessThan(50)
      expect(updatedPrediction.accuracyPercentage).toBeGreaterThanOrEqual(0)
    }
  })

  /**
   * Test: Accuracy bounds (0-100)
   * Validates: Requirement 3.4
   */
  it('should ensure accuracy is always between 0 and 100', async () => {
    // Create a prediction from 35 days ago with extreme variance
    const predictionDate = new Date()
    predictionDate.setDate(predictionDate.getDate() - 35)

    const uniqueProductCode = `TEST-EXTREME-${Date.now()}`

    const [prediction] = await db.insert(aiInventoryPredictions).values({
      productCode: uniqueProductCode,
      productName: 'Extreme Variance Product',
      predictionType: 'REPLENISHMENT',
      recommendedStock: 10, // Predicted 10 units
      rationale: 'Test extreme variance',
      createdAt: predictionDate,
      accuracyPercentage: null,
    }).returning()

    createdPredictionIds.push(prediction.id)

    // Create actual sales data with extreme difference
    const salesDate = new Date(predictionDate)
    salesDate.setDate(salesDate.getDate() + 10)

    const [salesRecord] = await db.insert(salesRevenueSap).values({
      salesRevId: nextSalesRevId(),
      materialNo: uniqueProductCode,
      materialDescription: 'Extreme Variance Product',
      customer: 'TEST-CUST',
      customerName: 'Test Customer',
      qty: 1000, // Actual sales: 1000 units (100x the prediction)
      billingDate: salesDate.toISOString(),
      revenueInLocCurr: 100000,
    }).returning()

    createdSalesIds.push(salesRecord.salesRevId)

    // Run accuracy calculation
    const { calculatePredictionAccuracy } = await import('@/app/actions/inventory-ai')
    const result = await calculatePredictionAccuracy()

    expect(result.success).toBe(true)

    // Verify accuracy is clamped to 0-100 range
    const [updatedPrediction] = await db.select()
      .from(aiInventoryPredictions)
      .where(eq(aiInventoryPredictions.id, prediction.id))

    expect(updatedPrediction.actualSales).toBe(1000)
    expect(updatedPrediction.accuracyPercentage).not.toBeNull()

    if (updatedPrediction.accuracyPercentage !== null) {
      expect(updatedPrediction.accuracyPercentage).toBeGreaterThanOrEqual(0)
      expect(updatedPrediction.accuracyPercentage).toBeLessThanOrEqual(100)
    }
  })

  /**
   * Test: Skip predictions with no actual sales
   * Validates: Requirements 3.1, 3.2
   */
  it('should skip predictions with no actual sales data', async () => {
    // Create a prediction from 35 days ago
    const predictionDate = new Date()
    predictionDate.setDate(predictionDate.getDate() - 35)

    const [prediction] = await db.insert(aiInventoryPredictions).values({
      productCode: 'TEST-NOSALES-001',
      productName: 'No Sales Product',
      predictionType: 'REPLENISHMENT',
      recommendedStock: 100,
      rationale: 'Test no sales',
      createdAt: predictionDate,
      accuracyPercentage: null,
    }).returning()

    createdPredictionIds.push(prediction.id)

    // Don't create any sales data

    // Run accuracy calculation
    const { calculatePredictionAccuracy } = await import('@/app/actions/inventory-ai')
    const result = await calculatePredictionAccuracy()

    expect(result.success).toBe(true)

    // Verify prediction was NOT updated (no sales data)
    const [updatedPrediction] = await db.select()
      .from(aiInventoryPredictions)
      .where(eq(aiInventoryPredictions.id, prediction.id))

    expect(updatedPrediction.actualSales).toBeNull()
    expect(updatedPrediction.accuracyPercentage).toBeNull()
  })

  /**
   * Test: Only process predictions older than 30 days
   * Validates: Requirement 3.2
   */
  it('should only process predictions older than 30 days', async () => {
    // Create a recent prediction (5 days ago)
    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - 5)

    const [recentPrediction] = await db.insert(aiInventoryPredictions).values({
      productCode: 'TEST-RECENT-001',
      productName: 'Recent Prediction',
      predictionType: 'REPLENISHMENT',
      recommendedStock: 100,
      rationale: 'Test recent prediction',
      createdAt: recentDate,
      accuracyPercentage: null,
    }).returning()

    createdPredictionIds.push(recentPrediction.id)

    // Create sales data
    const salesDate = new Date(recentDate)
    salesDate.setDate(salesDate.getDate() + 2)

    const [salesRecord] = await db.insert(salesRevenueSap).values({
      salesRevId: nextSalesRevId(),
      materialNo: 'TEST-RECENT-001',
      materialDescription: 'Recent Prediction',
      customer: 'TEST-CUST',
      customerName: 'Test Customer',
      qty: 90,
      billingDate: salesDate.toISOString(),
      revenueInLocCurr: 9000,
    }).returning()

    createdSalesIds.push(salesRecord.salesRevId)

    // Run accuracy calculation
    const { calculatePredictionAccuracy } = await import('@/app/actions/inventory-ai')
    await calculatePredictionAccuracy()

    // Verify recent prediction was NOT processed
    const [updatedPrediction] = await db.select()
      .from(aiInventoryPredictions)
      .where(eq(aiInventoryPredictions.id, recentPrediction.id))

    expect(updatedPrediction.accuracyPercentage).toBeNull()
  })

  /**
   * Test: Multiple sales records aggregation
   * Validates: Requirements 3.1, 3.2, 3.4
   */
  it('should aggregate multiple sales records for accuracy calculation', async () => {
    // Create a prediction from 35 days ago
    const predictionDate = new Date()
    predictionDate.setDate(predictionDate.getDate() - 35)

    const uniqueProductCode = `TEST-MULTI-${Date.now()}`

    const [prediction] = await db.insert(aiInventoryPredictions).values({
      productCode: uniqueProductCode,
      productName: 'Multi Sales Product',
      predictionType: 'REPLENISHMENT',
      recommendedStock: 200, // Predicted 200 units
      rationale: 'Test multiple sales',
      createdAt: predictionDate,
      accuracyPercentage: null,
    }).returning()

    createdPredictionIds.push(prediction.id)

    // Create multiple sales records within the 30-day period
    const salesDate1 = new Date(predictionDate)
    salesDate1.setDate(salesDate1.getDate() + 5)

    const salesDate2 = new Date(predictionDate)
    salesDate2.setDate(salesDate2.getDate() + 15)

    const salesDate3 = new Date(predictionDate)
    salesDate3.setDate(salesDate3.getDate() + 25)

    const salesRecords = await db.insert(salesRevenueSap).values([
      {
        salesRevId: nextSalesRevId(),
        materialNo: uniqueProductCode,
        materialDescription: 'Multi Sales Product',
        customer: 'TEST-CUST-1',
        customerName: 'Test Customer 1',
        qty: 70, // First sale: 70 units
        billingDate: salesDate1.toISOString(),
        revenueInLocCurr: 7000,
      },
      {
        salesRevId: nextSalesRevId(),
        materialNo: uniqueProductCode,
        materialDescription: 'Multi Sales Product',
        customer: 'TEST-CUST-2',
        customerName: 'Test Customer 2',
        qty: 80, // Second sale: 80 units
        billingDate: salesDate2.toISOString(),
        revenueInLocCurr: 8000,
      },
      {
        salesRevId: nextSalesRevId(),
        materialNo: uniqueProductCode,
        materialDescription: 'Multi Sales Product',
        customer: 'TEST-CUST-3',
        customerName: 'Test Customer 3',
        qty: 50, // Third sale: 50 units
        billingDate: salesDate3.toISOString(),
        revenueInLocCurr: 5000,
      },
    ]).returning()

    salesRecords.forEach(s => createdSalesIds.push(s.salesRevId))

    // Run accuracy calculation
    const { calculatePredictionAccuracy } = await import('@/app/actions/inventory-ai')
    const result = await calculatePredictionAccuracy()

    expect(result.success).toBe(true)

    // Verify the prediction was updated with aggregated sales
    const [updatedPrediction] = await db.select()
      .from(aiInventoryPredictions)
      .where(eq(aiInventoryPredictions.id, prediction.id))

    // Total actual sales: 70 + 80 + 50 = 200
    expect(updatedPrediction.actualSales).toBe(200)
    expect(updatedPrediction.accuracyPercentage).toBe(100) // Perfect prediction
  })
})
