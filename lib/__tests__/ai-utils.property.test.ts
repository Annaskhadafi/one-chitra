/**
 * Property-Based Tests for AI Inventory Forecast Enhancement
 * Feature: ai-inventory-forecast-enhancement
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { calculateAccuracy } from '../ai-utils'

// ─── Arbitraries (Test Data Generators) ────────────────────────────────────

/**
 * Generates valid positive numbers for stock/sales values
 */
const positiveNumberArbitrary = () => fc.float({ 
  min: 0, 
  max: 1000000,
  noNaN: true,
  noDefaultInfinity: true
})

/**
 * Generates non-negative numbers including zero
 */
const nonNegativeNumberArbitrary = () => fc.float({ 
  min: 0, 
  max: 1000000,
  noNaN: true,
  noDefaultInfinity: true
})

// ─── Property Tests ─────────────────────────────────────────────────────────

describe('AI Inventory Forecast Enhancement - Property Tests', () => {
  
  /**
   * Property 1: Accuracy bounds
   * **Validates: Requirements 3.4**
   * 
   * For any predicted and actual values, the accuracy calculation should always
   * return a value between 0 and 100 (inclusive). This ensures the accuracy
   * percentage is always valid and can be safely displayed to users.
   */
  it('Property 1: Accuracy is always between 0 and 100', async () => {
    await fc.assert(
      fc.property(
        nonNegativeNumberArbitrary(),
        nonNegativeNumberArbitrary(),
        (predicted, actual) => {
          const accuracy = calculateAccuracy(predicted, actual)
          
          // Accuracy must be within valid percentage range
          expect(accuracy).toBeGreaterThanOrEqual(0)
          expect(accuracy).toBeLessThanOrEqual(100)
          
          // Accuracy should be a finite number
          expect(Number.isFinite(accuracy)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 1b: Perfect prediction gives 100% accuracy
   * **Validates: Requirements 3.4**
   * 
   * When the predicted value exactly matches the actual value, the accuracy
   * should always be 100%, regardless of the magnitude of the values.
   */
  it('Property 1b: Perfect prediction gives 100% accuracy', async () => {
    await fc.assert(
      fc.property(
        positiveNumberArbitrary(),
        (value) => {
          const accuracy = calculateAccuracy(value, value)
          
          // Perfect prediction should always give 100% accuracy
          expect(accuracy).toBe(100)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 1c: Zero actual and zero predicted gives 100% accuracy
   * **Validates: Requirements 3.4**
   * 
   * When both predicted and actual are zero, this represents a perfect prediction
   * and should return 100% accuracy.
   */
  it('Property 1c: Zero predicted and zero actual gives 100% accuracy', () => {
    const accuracy = calculateAccuracy(0, 0)
    expect(accuracy).toBe(100)
  })

  /**
   * Property 1d: Non-zero predicted with zero actual gives 0% accuracy
   * **Validates: Requirements 3.4**
   * 
   * When actual is zero but predicted is non-zero, this represents a complete
   * miss and should return 0% accuracy.
   */
  it('Property 1d: Non-zero predicted with zero actual gives 0% accuracy', async () => {
    await fc.assert(
      fc.property(
        positiveNumberArbitrary().filter(n => n > 0),
        (predicted) => {
          const accuracy = calculateAccuracy(predicted, 0)
          
          // Predicting something when actual is zero should give 0% accuracy
          expect(accuracy).toBe(0)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 1e: Accuracy symmetry for equal deviations
   * **Validates: Requirements 3.4**
   * 
   * Over-prediction and under-prediction by the same percentage should result
   * in the same accuracy value. For example, predicting 120 when actual is 100
   * should give the same accuracy as predicting 80 when actual is 100.
   */
  it('Property 1e: Accuracy is symmetric for equal percentage deviations', async () => {
    await fc.assert(
      fc.property(
        positiveNumberArbitrary().filter(n => n > 10),
        fc.float({ min: Math.fround(0.1), max: Math.fround(0.5) }), // deviation percentage (10% to 50%)
        (actual, deviationPercent) => {
          const deviation = actual * deviationPercent
          const overPredicted = actual + deviation
          const underPredicted = actual - deviation
          
          const accuracyOver = calculateAccuracy(overPredicted, actual)
          const accuracyUnder = calculateAccuracy(underPredicted, actual)
          
          // Both should give the same accuracy (within floating point tolerance)
          expect(Math.abs(accuracyOver - accuracyUnder)).toBeLessThan(0.0001)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 1f: Larger deviations result in lower accuracy
   * **Validates: Requirements 3.4**
   * 
   * For a given actual value, as the predicted value deviates further from
   * the actual, the accuracy should decrease (or stay the same at 0).
   */
  it('Property 1f: Larger deviations result in lower or equal accuracy', async () => {
    await fc.assert(
      fc.property(
        positiveNumberArbitrary().filter(n => n > 10),
        fc.float({ min: Math.fround(0.1), max: Math.fround(0.3) }), // smaller deviation
        fc.float({ min: Math.fround(0.4), max: Math.fround(0.8) }), // larger deviation
        (actual, smallDeviation, largeDeviation) => {
          const smallDiff = actual * smallDeviation
          const largeDiff = actual * largeDeviation
          
          const accuracySmall = calculateAccuracy(actual + smallDiff, actual)
          const accuracyLarge = calculateAccuracy(actual + largeDiff, actual)
          
          // Smaller deviation should give higher or equal accuracy
          expect(accuracySmall).toBeGreaterThanOrEqual(accuracyLarge)
        }
      ),
      { numRuns: 100 }
    )
  })
})
