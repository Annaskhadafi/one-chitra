/**
 * Unit Tests for Bulk Prediction Processor
 * Feature: ai-inventory-forecast-enhancement
 * Task: 6.1 Create bulk prediction processor
 * Requirements: 4.2, 4.4, 4.5, 4.6, 4.7, 4.8, 4.11
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { db } from '@/db'
import { aiInventoryPredictions, user } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'

// Mock the RBAC module to bypass authentication in tests
vi.mock('@/lib/rbac', () => ({
  getAuthenticatedSession: vi.fn().mockResolvedValue({
    user: { id: 'test-user-bulk' },
  }),
  checkPermission: vi.fn().mockResolvedValue(true),
}))

// Mock Groq API to avoid actual API calls during tests
vi.mock('node-fetch', () => ({
  default: vi.fn(),
}))

// Test data setup
let testUserId: string
const createdPredictionIds: number[] = []

type SuccessfulBulkPredictionResult = {
  success: true
  batchId: string
  summary: {
    total: number
    successful: number
    failed: number
    cached: number
  }
  results: Array<{
    materialNo: string
    status: 'success' | 'failed' | 'cached'
    error?: string
    predictionId?: number
  }>
}

function expectBulkSuccess<T extends { success: boolean }>(
  result: T
): asserts result is T & SuccessfulBulkPredictionResult {
  expect(result.success).toBe(true)
}

beforeAll(async () => {
  // Create a test user
  const [testUser] = await db.insert(user).values({
    id: 'test-user-bulk',
    name: 'Test User Bulk',
    email: 'test-bulk@example.com',
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

describe('Bulk Prediction Processor - Unit Tests', () => {

  /**
   * Test: Validates input - empty array
   * Validates: Requirement 4.2
   */
  it('should reject empty material numbers array', async () => {
    const { processBulkPredictions } = await import('@/app/actions/inventory-ml')

    const result = await processBulkPredictions([], 'REPLENISHMENT')

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.error).toContain('No material numbers provided')
  })

  /**
   * Test: Validates max 50 products limit
   * Validates: Requirement 4.4
   */
  it('should reject more than 50 products', async () => {
    const { processBulkPredictions } = await import('@/app/actions/inventory-ml')

    // Create array with 51 material numbers
    const materialNumbers = Array.from({ length: 51 }, (_, i) => `MAT-${i}`)

    const result = await processBulkPredictions(materialNumbers, 'REPLENISHMENT')

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
    expect(result.error).toContain('Maximum 50 products')
  })

  /**
   * Test: Returns correct summary structure
   * Validates: Requirement 4.8
   */
  it('should return summary report with correct structure', async () => {
    const { processBulkPredictions } = await import('@/app/actions/inventory-ml')

    // Use small array to avoid long test execution
    const materialNumbers = ['TEST-BULK-001']

    const result = await processBulkPredictions(materialNumbers, 'REPLENISHMENT')

    expectBulkSuccess(result)
    expect(result).toHaveProperty('batchId')
    expect(result).toHaveProperty('summary')
    expect(result).toHaveProperty('results')

    {
      // Verify summary structure
      expect(result.summary).toBeDefined()
      expect(result.results).toBeDefined()
      expect(result.summary).toHaveProperty('total')
      expect(result.summary).toHaveProperty('successful')
      expect(result.summary).toHaveProperty('failed')
      expect(result.summary).toHaveProperty('cached')

      // Verify summary values
      expect(result.summary.total).toBe(materialNumbers.length)
      expect(result.summary.successful + result.summary.failed + result.summary.cached).toBe(result.summary.total)

      // Verify results array
      expect(Array.isArray(result.results)).toBe(true)
      expect(result.results.length).toBe(materialNumbers.length)
    }
  })

  /**
   * Test: Utilizes cache for recent predictions
   * Validates: Requirement 4.11
   */
  it('should use cached data for recent predictions', async () => {
    const materialNo = 'TEST-CACHE-001'

    // Create a recent prediction (less than 24 hours old)
    const [cachedPrediction] = await db.insert(aiInventoryPredictions).values({
      productCode: materialNo,
      productName: 'Cached Test Product',
      predictionType: 'REPLENISHMENT',
      recommendedStock: 500,
      rationale: 'Cached prediction',
      createdAt: new Date(), // Recent
    }).returning()

    createdPredictionIds.push(cachedPrediction.id)

    const { processBulkPredictions } = await import('@/app/actions/inventory-ai')

    const result = await processBulkPredictions([materialNo], 'REPLENISHMENT')

    expectBulkSuccess(result)

    {
      // Should have 1 cached result
      expect(result.summary).toBeDefined()
      expect(result.results).toBeDefined()
      expect(result.summary.cached).toBeGreaterThanOrEqual(1)

      // Find the result for our material
      const materialResult = result.results.find(r => r.materialNo === materialNo)
      expect(materialResult).toBeDefined()
      expect(materialResult?.status).toBe('cached')
    }
  })

  /**
   * Test: Handles individual failures gracefully
   * Validates: Requirement 4.7
   */
  it('should continue processing after individual failure', async () => {
    const { processBulkPredictions } = await import('@/app/actions/inventory-ai')

    // Mix of valid and invalid material numbers
    const materialNumbers = [
      '', // Empty - should fail
      'TEST-VALID-001', // Valid
      '   ', // Whitespace only - should fail
    ]

    const result = await processBulkPredictions(materialNumbers, 'REPLENISHMENT')

    expectBulkSuccess(result)

    {
      // Should have processed all items
      expect(result.summary).toBeDefined()
      expect(result.results).toBeDefined()
      expect(result.results.length).toBe(materialNumbers.length)

      // Should have at least 2 failures (empty strings)
      expect(result.summary.failed).toBeGreaterThanOrEqual(2)

      // Should track individual failures
      const failedResults = result.results.filter(r => r.status === 'failed')
      expect(failedResults.length).toBeGreaterThanOrEqual(2)

      // Failed results should have error messages
      failedResults.forEach(r => {
        expect(r.error).toBeDefined()
      })
    }
  })

  /**
   * Test: Assigns batch ID to all predictions
   * Validates: Requirement 4.9 (from design)
   */
  it('should assign same batch ID to all predictions in batch', async () => {
    const materialNo1 = 'TEST-BATCH-001'
    const materialNo2 = 'TEST-BATCH-002'

    // Create cached predictions for both materials
    const predictions = await db.insert(aiInventoryPredictions).values([
      {
        productCode: materialNo1,
        productName: 'Batch Test 1',
        predictionType: 'SAFETY_STOCK',
        recommendedStock: 100,
        rationale: 'Test',
        createdAt: new Date(),
      },
      {
        productCode: materialNo2,
        productName: 'Batch Test 2',
        predictionType: 'SAFETY_STOCK',
        recommendedStock: 200,
        rationale: 'Test',
        createdAt: new Date(),
      },
    ]).returning()

    predictions.forEach(p => createdPredictionIds.push(p.id))

    const { processBulkPredictions } = await import('@/app/actions/inventory-ai')

    const result = await processBulkPredictions(
      [materialNo1, materialNo2],
      'SAFETY_STOCK'
    )

    expectBulkSuccess(result)

    {
      expect(result.results).toBeDefined()
      const batchId = result.batchId
      expect(batchId).toBeDefined()
      expect(batchId).toContain('BATCH-')

      // Verify both predictions have the same batch ID
      const updatedPredictions = await db.select()
        .from(aiInventoryPredictions)
        .where(inArray(aiInventoryPredictions.id, predictions.map(p => p.id)))

      updatedPredictions.forEach(pred => {
        expect(pred.batchId).toBe(batchId)
      })
    }
  }, 10000) // Increase timeout for 2-second delay between items

  /**
   * Test: Handles different prediction types
   * Validates: Requirement 4.2
   */
  it('should process both REPLENISHMENT and SAFETY_STOCK types', async () => {
    const { processBulkPredictions } = await import('@/app/actions/inventory-ai')

    const materialNo = 'TEST-TYPE-001'

    // Create cached prediction for REPLENISHMENT
    const [replenishmentPred] = await db.insert(aiInventoryPredictions).values({
      productCode: materialNo,
      productName: 'Type Test',
      predictionType: 'REPLENISHMENT',
      recommendedStock: 100,
      rationale: 'Test',
      createdAt: new Date(),
    }).returning()

    createdPredictionIds.push(replenishmentPred.id)

    // Test REPLENISHMENT type
    const result1 = await processBulkPredictions([materialNo], 'REPLENISHMENT')
    expect(result1.success).toBe(true)

    // Create cached prediction for SAFETY_STOCK
    const [safetyStockPred] = await db.insert(aiInventoryPredictions).values({
      productCode: materialNo,
      productName: 'Type Test',
      predictionType: 'SAFETY_STOCK',
      recommendedStock: 50,
      rationale: 'Test',
      createdAt: new Date(),
    }).returning()

    createdPredictionIds.push(safetyStockPred.id)

    // Test SAFETY_STOCK type
    const result2 = await processBulkPredictions([materialNo], 'SAFETY_STOCK')
    expect(result2.success).toBe(true)
  })

  /**
   * Test: Tracks success/failure for each product
   * Validates: Requirement 4.7, 4.8
   */
  it('should track individual product status in results', async () => {
    const { processBulkPredictions } = await import('@/app/actions/inventory-ai')

    const materialNumbers = [
      'TEST-STATUS-001',
      '', // Will fail
      'TEST-STATUS-002',
    ]

    const result = await processBulkPredictions(materialNumbers, 'REPLENISHMENT')

    expectBulkSuccess(result)

    {
      // Each result should have materialNo and status
      expect(result.results).toBeDefined()
      result.results.forEach(r => {
        expect(r).toHaveProperty('materialNo')
        expect(r).toHaveProperty('status')
        expect(['success', 'failed', 'cached']).toContain(r.status)

        // If failed, should have error message
        if (r.status === 'failed') {
          expect(r.error).toBeDefined()
        }

        // If success or cached, should have predictionId
        if (r.status === 'success' || r.status === 'cached') {
          expect(r.predictionId).toBeDefined()
        }
      })
    }
  }, 15000) // Increase timeout to 15 seconds for API calls and delays

  /**
   * Test: Handles whitespace in material numbers
   * Validates: Requirement 4.2
   */
  it('should trim whitespace from material numbers', async () => {
    const materialNo = 'TEST-TRIM-001'

    // Create cached prediction
    const [prediction] = await db.insert(aiInventoryPredictions).values({
      productCode: materialNo,
      productName: 'Trim Test',
      predictionType: 'REPLENISHMENT',
      recommendedStock: 100,
      rationale: 'Test',
      createdAt: new Date(),
    }).returning()

    createdPredictionIds.push(prediction.id)

    const { processBulkPredictions } = await import('@/app/actions/inventory-ai')

    // Pass material number with whitespace
    const result = await processBulkPredictions([`  ${materialNo}  `], 'REPLENISHMENT')

    expectBulkSuccess(result)

    {
      // Should find the cached prediction despite whitespace
      expect(result.summary).toBeDefined()
      expect(result.results).toBeDefined()
      expect(result.summary.cached).toBeGreaterThanOrEqual(1)

      const materialResult = result.results.find(r => r.materialNo === materialNo)
      expect(materialResult).toBeDefined()
    }
  })
})
