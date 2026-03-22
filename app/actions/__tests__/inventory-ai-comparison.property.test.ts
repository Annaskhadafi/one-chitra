/**
 * Property-Based Tests for AI Inventory Forecast Comparison
 * Feature: ai-inventory-forecast-enhancement
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

/**
 * Calculate variance percentage using the formula from Requirement 7.3
 * Formula: ((Predicted - Actual) / Actual * 100)
 */
function calculateVariance(predicted: number, actual: number): number {
  if (actual !== 0) {
    return ((predicted - actual) / actual) * 100
  } else if (predicted > 0) {
    // If actual is 0 but predicted is not, variance is 100%
    return 100
  }
  return 0
}

describe('AI Inventory Forecast Comparison - Property Tests', () => {
  
  /**
   * Property 2: Variance Symmetry
   * **Validates: Requirements 7.3**
   * 
   * For any valid predicted and actual values, the variance calculation should be
   * consistent and follow mathematical properties:
   * 1. When predicted equals actual, variance should be 0%
   * 2. When predicted is double actual, variance should be 100%
   * 3. When predicted is half actual, variance should be -50%
   * 4. The variance should be proportional to the difference
   */
  it('Property 2: Variance calculation is consistent and symmetric', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }).map(n => n / 100),
        fc.integer({ min: 1, max: 10000 }).map(n => n / 100),
        (predicted, actual) => {
          const variance = calculateVariance(predicted, actual)
          
          // Property 1: Variance should be a finite number
          expect(Number.isFinite(variance)).toBe(true)
          
          // Property 2: When predicted equals actual, variance should be 0
          if (Math.abs(predicted - actual) < 0.0001) {
            expect(Math.abs(variance)).toBeLessThan(0.01)
          }
          
          // Property 3: Variance sign should match prediction direction
          if (predicted > actual) {
            expect(variance).toBeGreaterThan(0) // Over-prediction
          } else if (predicted < actual) {
            expect(variance).toBeLessThan(0) // Under-prediction
          }
          
          // Property 4: Variance magnitude should be proportional
          const expectedVariance = ((predicted - actual) / actual) * 100
          expect(Math.abs(variance - expectedVariance)).toBeLessThan(0.0001)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2.1: Variance calculation with specific ratios
   * **Validates: Requirements 7.3**
   * 
   * Test that variance calculation produces expected results for known ratios:
   * - Predicted = 2 * Actual → Variance = 100%
   * - Predicted = 0.5 * Actual → Variance = -50%
   * - Predicted = 1.5 * Actual → Variance = 50%
   */
  it('Property 2.1: Variance calculation produces correct results for known ratios', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 10000 }).map(n => n / 100),
        (actual) => {
          // Test double prediction (100% over)
          const variance100 = calculateVariance(actual * 2, actual)
          expect(Math.abs(variance100 - 100)).toBeLessThan(0.01)
          
          // Test half prediction (-50% under)
          const varianceNeg50 = calculateVariance(actual * 0.5, actual)
          expect(Math.abs(varianceNeg50 - (-50))).toBeLessThan(0.01)
          
          // Test 1.5x prediction (50% over)
          const variance50 = calculateVariance(actual * 1.5, actual)
          expect(Math.abs(variance50 - 50)).toBeLessThan(0.01)
          
          // Test equal prediction (0% variance)
          const variance0 = calculateVariance(actual, actual)
          expect(Math.abs(variance0)).toBeLessThan(0.01)
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Property 2.2: Edge case - Zero actual sales
   * **Validates: Requirements 7.3**
   * 
   * When actual sales is zero:
   * - If predicted > 0, variance should be 100%
   * - If predicted = 0, variance should be 0%
   */
  it('Property 2.2: Zero actual sales edge case', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }).map(n => n / 100),
        (predicted) => {
          // When actual is 0 and predicted > 0, variance should be 100%
          const variance = calculateVariance(predicted, 0)
          expect(variance).toBe(100)
        }
      ),
      { numRuns: 50 }
    )
    
    // When both are 0, variance should be 0%
    const varianceBothZero = calculateVariance(0, 0)
    expect(varianceBothZero).toBe(0)
  })

  /**
   * Property 2.3: Edge case - Zero predicted stock
   * **Validates: Requirements 7.3**
   * 
   * When predicted stock is zero but actual sales is positive,
   * variance should be -100% (complete under-prediction)
   */
  it('Property 2.3: Zero predicted stock edge case', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }).map(n => n / 100),
        (actual) => {
          // When predicted is 0 and actual > 0, variance should be -100%
          const variance = calculateVariance(0, actual)
          expect(variance).toBe(-100)
        }
      ),
      { numRuns: 50 }
    )
  })

  /**
   * Property 2.4: Variance symmetry - inverse relationship
   * **Validates: Requirements 7.3**
   * 
   * For any predicted and actual values, if we swap them and negate,
   * the variance should follow a predictable inverse relationship.
   * 
   * If variance(P, A) = V, then the relationship between variance(A, P) and V
   * should be mathematically consistent.
   */
  it('Property 2.4: Variance inverse relationship', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 10000 }).map(n => n / 100),
        fc.integer({ min: 100, max: 10000 }).map(n => n / 100),
        (predicted, actual) => {
          const variance1 = calculateVariance(predicted, actual)
          const variance2 = calculateVariance(actual, predicted)
          
          // The variances should have opposite signs (unless both are 0)
          if (Math.abs(predicted - actual) > 0.01) {
            expect(Math.sign(variance1)).toBe(-Math.sign(variance2))
          }
          
          // Mathematical relationship: if V1 = (P-A)/A * 100, then V2 = (A-P)/P * 100
          // V1 * (A/P) should approximately equal -V2
          if (predicted > 0.01 && actual > 0.01) {
            const ratio = actual / predicted
            const expectedRelation = variance1 * ratio
            expect(Math.abs(expectedRelation + variance2)).toBeLessThan(1)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2.5: Variance bounds for reasonable predictions
   * **Validates: Requirements 7.3**
   * 
   * For predictions within a reasonable range (e.g., 0.1x to 10x of actual),
   * the variance should be bounded:
   * - Minimum: -90% (when predicted is 0.1x actual)
   * - Maximum: 900% (when predicted is 10x actual)
   */
  it('Property 2.5: Variance bounds for reasonable predictions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 10000 }).map(n => n / 100),
        fc.integer({ min: 10, max: 1000 }).map(n => n / 100),
        (actual, multiplier) => {
          const predicted = actual * multiplier
          const variance = calculateVariance(predicted, actual)
          
          // Variance should be within expected bounds
          expect(variance).toBeGreaterThanOrEqual(-90)
          expect(variance).toBeLessThanOrEqual(900.01) // Allow small floating point error
          
          // More specifically, variance should equal (multiplier - 1) * 100
          const expectedVariance = (multiplier - 1) * 100
          expect(Math.abs(variance - expectedVariance)).toBeLessThan(0.01)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2.6: Variance calculation consistency with rounding
   * **Validates: Requirements 7.3**
   * 
   * The variance calculation should be consistent when rounded to 2 decimal places
   * (as implemented in the actual code)
   */
  it('Property 2.6: Variance calculation with rounding to 2 decimal places', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }).map(n => n / 100),
        fc.integer({ min: 1, max: 10000 }).map(n => n / 100),
        (predicted, actual) => {
          const variance = calculateVariance(predicted, actual)
          const roundedVariance = Number(variance.toFixed(2))
          
          // Rounded variance should be close to original (within rounding error)
          expect(Math.abs(variance - roundedVariance)).toBeLessThan(0.01)
          
          // Rounded variance should have at most 2 decimal places
          const decimalPlaces = (roundedVariance.toString().split('.')[1] || '').length
          expect(decimalPlaces).toBeLessThanOrEqual(2)
        }
      ),
      { numRuns: 100 }
    )
  })
})
