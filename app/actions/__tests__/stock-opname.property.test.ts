/**
 * Property-Based Tests for Stock Opname Enhancement
 * Feature: stock-opname-enhancement
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import * as fc from 'fast-check'
import { db } from '@/db'
import { stockOpnameSessions, stockOpnameSignatures, warehouses, user } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'

// Mock the RBAC module to bypass authentication in tests
vi.mock('@/lib/rbac', () => ({
  getAuthenticatedSession: vi.fn().mockResolvedValue({
    user: { id: 'test-user-opname' },
  }),
  checkPermission: vi.fn().mockResolvedValue(true),
}))

// Test database setup
let testWarehouseId: number
let testUserId: string

beforeAll(async () => {
  // Create a test warehouse
  const [warehouse] = await db.insert(warehouses).values({
    sloc: 'TEST-OPNAME',
    description: 'Test Warehouse for Opname',
    type: 'MAIN',
  }).returning()
  testWarehouseId = warehouse.id

  // Create a test user
  const [testUser] = await db.insert(user).values({
    id: 'test-user-opname',
    name: 'Test User',
    email: 'test-opname@example.com',
    emailVerified: false,
  }).returning()
  testUserId = testUser.id
})

afterAll(async () => {
  // Cleanup test data
  await db.delete(stockOpnameSessions).where(eq(stockOpnameSessions.warehouseId, testWarehouseId))
  await db.delete(warehouses).where(eq(warehouses.id, testWarehouseId))
  await db.delete(user).where(eq(user.id, testUserId))
})

// ─── Arbitraries (Test Data Generators) ────────────────────────────────────

/**
 * Generates a valid signature entry
 */
const signatureArbitrary = () => fc.record({
  name: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
  position: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
})

/**
 * Generates a valid time string in HH:MM format
 */
const timeStringArbitrary = () => fc.tuple(
  fc.integer({ min: 0, max: 23 }),
  fc.integer({ min: 0, max: 59 })
).map(([hours, minutes]) => 
  `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
)

/**
 * Generates valid session data with all pre-count documentation fields
 */
const sessionDataArbitrary = () => fc.record({
  name: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
  opnameDate: fc.date({ 
    min: new Date('2020-01-01'), 
    max: new Date('2030-12-31') 
  }),
  opnameTime: timeStringArbitrary(),
  location: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
  signatures: fc.array(signatureArbitrary(), { minLength: 1, maxLength: 20 }),
  notes: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
})

// ─── Property Tests ─────────────────────────────────────────────────────────

describe('Stock Opname Enhancement - Property Tests', () => {
  
  /**
   * Property 1: Session Data Round-Trip Persistence
   * **Validates: Requirements 1.4, 1.5, 2.5**
   * 
   * For any valid stock opname session with date, time, location, and signature entries,
   * after saving and then retrieving the session from the database, all fields should
   * match the original values exactly.
   */
  it('Property 1: Session data persists correctly through save/retrieve cycle', { timeout: 120000 }, async () => {
    const createdSessionIds: number[] = []
    
    try {
      await fc.assert(
        fc.asyncProperty(
          sessionDataArbitrary(),
          async (sessionData) => {
            // Save session to database
            const [createdSession] = await db.insert(stockOpnameSessions).values({
              name: sessionData.name,
              warehouseId: testWarehouseId,
              opnameDate: sessionData.opnameDate,
              opnameTime: sessionData.opnameTime,
              location: sessionData.location,
              notes: sessionData.notes ?? undefined,
              createdById: testUserId,
              status: 'open',
            }).returning()

            createdSessionIds.push(createdSession.id)

            // Save signatures
            if (sessionData.signatures.length > 0) {
              await db.insert(stockOpnameSignatures).values(
                sessionData.signatures.map((sig, index) => ({
                  sessionId: createdSession.id,
                  name: sig.name,
                  position: sig.position,
                  order: index,
                }))
              )
            }

            // Retrieve session from database
            const retrievedSession = await db.query.stockOpnameSessions.findFirst({
              where: eq(stockOpnameSessions.id, createdSession.id),
              with: {
                signatures: {
                  orderBy: (sigs, { asc }) => [asc(sigs.order)],
                },
              },
            })

            // Assertions
            expect(retrievedSession).toBeDefined()
            expect(retrievedSession!.name).toBe(sessionData.name)
            expect(retrievedSession!.location).toBe(sessionData.location)
            expect(retrievedSession!.opnameTime).toBe(sessionData.opnameTime)
            
            // Compare dates (normalize to same timezone)
            const savedDate = new Date(retrievedSession!.opnameDate)
            const originalDate = new Date(sessionData.opnameDate)
            expect(savedDate.toISOString()).toBe(originalDate.toISOString())
            
            // Compare notes (handle null/undefined)
            if (sessionData.notes === null) {
              expect(retrievedSession!.notes).toBeNull()
            } else {
              expect(retrievedSession!.notes).toBe(sessionData.notes)
            }

            // Verify signatures
            expect(retrievedSession!.signatures).toHaveLength(sessionData.signatures.length)
            
            sessionData.signatures.forEach((originalSig, index) => {
              const retrievedSig = retrievedSession!.signatures[index]
              expect(retrievedSig.name).toBe(originalSig.name)
              expect(retrievedSig.position).toBe(originalSig.position)
              expect(retrievedSig.order).toBe(index)
            })
          }
        ),
        { numRuns: 20 }
      )
    } finally {
      // Cleanup all created sessions
      if (createdSessionIds.length > 0) {
        await db.delete(stockOpnameSessions).where(
          inArray(stockOpnameSessions.id, createdSessionIds)
        )
      }
    }
  })

  /**
   * Property 2: Multiple Signatures Support
   * **Validates: Requirements 2.3**
   * 
   * For any number of signature entries (from 1 to a reasonable maximum like 20),
   * the system should accept, store, and retrieve all signature entries in the
   * correct order.
   */
  it('Property 2: Multiple signatures are stored and retrieved in correct order', { timeout: 120000 }, async () => {
    const createdSessionIds: number[] = []
    
    try {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 20 }),
          fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          timeStringArbitrary(),
          async (signatureCount, sessionName, location, opnameTime) => {
            // Generate the specified number of signatures
            const signatures = Array.from({ length: signatureCount }, (_, i) => ({
              name: `Person ${i + 1}`,
              position: `Position ${i + 1}`,
            }))

            // Create session with signatures
            const [createdSession] = await db.insert(stockOpnameSessions).values({
              name: sessionName,
              warehouseId: testWarehouseId,
              opnameDate: new Date('2024-01-15'),
              opnameTime: opnameTime,
              location: location,
              createdById: testUserId,
              status: 'open',
            }).returning()

            createdSessionIds.push(createdSession.id)

            // Insert all signatures with their order
            await db.insert(stockOpnameSignatures).values(
              signatures.map((sig, index) => ({
                sessionId: createdSession.id,
                name: sig.name,
                position: sig.position,
                order: index,
              }))
            )

            // Retrieve session with signatures
            const retrievedSession = await db.query.stockOpnameSessions.findFirst({
              where: eq(stockOpnameSessions.id, createdSession.id),
              with: {
                signatures: {
                  orderBy: (sigs, { asc }) => [asc(sigs.order)],
                },
              },
            })

            // Assertions
            expect(retrievedSession).toBeDefined()
            expect(retrievedSession!.signatures).toHaveLength(signatureCount)

            // Verify all signatures are present and in correct order
            signatures.forEach((originalSig, index) => {
              const retrievedSig = retrievedSession!.signatures[index]
              expect(retrievedSig).toBeDefined()
              expect(retrievedSig.name).toBe(originalSig.name)
              expect(retrievedSig.position).toBe(originalSig.position)
              expect(retrievedSig.order).toBe(index)
            })
          }
        ),
        { numRuns: 20 }
      )
    } finally {
      // Cleanup all created sessions
      if (createdSessionIds.length > 0) {
        await db.delete(stockOpnameSessions).where(
          inArray(stockOpnameSessions.id, createdSessionIds)
        )
      }
    }
  })

  /**
   * Property 4: Minimum Signature Validation
   * **Validates: Requirements 2.6**
   * 
   * For any session creation attempt with zero signature entries, the system should
   * reject the request with a validation error.
   */
  it('Property 4: Zero signatures are rejected with validation error', async () => {
    await fc.assert(
      fc.asyncProperty(
        sessionDataArbitrary(),
        async (sessionData) => {
          // Create session data with zero signatures
          const invalidSessionData = {
            ...sessionData,
            signatures: [], // Empty array - should be rejected
          }

          // Import the schema for validation
          const { createOpnameSessionSchema } = await import('@/lib/schemas')

          // Attempt to validate with zero signatures
          const result = createOpnameSessionSchema.safeParse(invalidSessionData)

          // Assertions
          expect(result.success).toBe(false)
          
          if (!result.success) {
            // Verify the error message mentions signatures
            const signatureError = result.error.issues.find(
              (err) => err.path.includes('signatures')
            )
            expect(signatureError).toBeDefined()
            expect(signatureError?.message).toMatch(/at least one/i)
          }
        }
      ),
      { numRuns: 20 }
    )
  })

  /**
   * Property 9: Closed Session Data Integrity
   * **Validates: Requirements 5.1**
   * 
   * For any closed stock opname session, the generated PDF report should only include
   * data associated with that specific session ID and should not include data from
   * other sessions.
   */
  it('Property 9: PDF data only includes items from specified session', { timeout: 120000 }, async () => {
    const createdSessionIds: number[] = []
    
    try {
      await fc.assert(
        fc.asyncProperty(
          sessionDataArbitrary(),
          sessionDataArbitrary(),
          async (sessionData1, sessionData2) => {
            // Create two separate sessions
            const [session1] = await db.insert(stockOpnameSessions).values({
              name: sessionData1.name,
              warehouseId: testWarehouseId,
              opnameDate: sessionData1.opnameDate,
              opnameTime: sessionData1.opnameTime,
              location: sessionData1.location,
              notes: sessionData1.notes ?? undefined,
              createdById: testUserId,
              status: 'closed',
              closedById: testUserId,
              closedAt: new Date(),
            }).returning()

            createdSessionIds.push(session1.id)

            const [session2] = await db.insert(stockOpnameSessions).values({
              name: sessionData2.name,
              warehouseId: testWarehouseId,
              opnameDate: sessionData2.opnameDate,
              opnameTime: sessionData2.opnameTime,
              location: sessionData2.location,
              notes: sessionData2.notes ?? undefined,
              createdById: testUserId,
              status: 'closed',
              closedById: testUserId,
              closedAt: new Date(),
            }).returning()

            createdSessionIds.push(session2.id)

            // Add signatures to both sessions
            await db.insert(stockOpnameSignatures).values(
              sessionData1.signatures.map((sig, index) => ({
                sessionId: session1.id,
                name: sig.name,
                position: sig.position,
                order: index,
              }))
            )

            await db.insert(stockOpnameSignatures).values(
              sessionData2.signatures.map((sig, index) => ({
                sessionId: session2.id,
                name: sig.name,
                position: sig.position,
                order: index,
              }))
            )

            // Import the function to test
            const { getOpnamePdfReportData } = await import('@/app/actions/stock-opname')

            // Get PDF data for session 1
            const result = await getOpnamePdfReportData(session1.id)

            // Assertions
            expect(result.success).toBe(true)
            expect(result.data).toBeDefined()
            
            if (result.data) {
              // Verify the session ID matches
              expect(result.data.session.id).toBe(session1.id)
              expect(result.data.session.name).toBe(sessionData1.name)
              
              // Verify signatures belong to session 1 only
              expect(result.data.signatures).toHaveLength(sessionData1.signatures.length)
              result.data.signatures.forEach((sig) => {
                expect(sig.sessionId).toBe(session1.id)
              })
              
              // Verify no data from session 2 is included
              expect(result.data.session.id).not.toBe(session2.id)
              expect(result.data.session.name).not.toBe(sessionData2.name)
            }
          }
        ),
        { numRuns: 10 }
      )
    } finally {
      // Cleanup all created sessions
      if (createdSessionIds.length > 0) {
        await db.delete(stockOpnameSessions).where(
          inArray(stockOpnameSessions.id, createdSessionIds)
        )
      }
    }
  })

  /**
   * Property 11: Open Session PDF Prevention
   * **Validates: Requirements 5.4**
   * 
   * For any stock opname session with status "open" or "cancelled", attempting to
   * generate a PDF report should be rejected with an appropriate error.
   */
  it('Property 11: Open and cancelled sessions are rejected for PDF generation', { timeout: 120000 }, async () => {
    const createdSessionIds: number[] = []
    
    try {
      await fc.assert(
        fc.asyncProperty(
          sessionDataArbitrary(),
          fc.constantFrom('open', 'cancelled'),
          async (sessionData, status) => {
            // Create session with non-closed status
            const [session] = await db.insert(stockOpnameSessions).values({
              name: sessionData.name,
              warehouseId: testWarehouseId,
              opnameDate: sessionData.opnameDate,
              opnameTime: sessionData.opnameTime,
              location: sessionData.location,
              notes: sessionData.notes ?? undefined,
              createdById: testUserId,
              status: status as 'open' | 'cancelled',
            }).returning()

            createdSessionIds.push(session.id)

            // Add signatures
            await db.insert(stockOpnameSignatures).values(
              sessionData.signatures.map((sig, index) => ({
                sessionId: session.id,
                name: sig.name,
                position: sig.position,
                order: index,
              }))
            )

            // Import the function to test
            const { getOpnamePdfReportData } = await import('@/app/actions/stock-opname')

            // Attempt to get PDF data for non-closed session
            const result = await getOpnamePdfReportData(session.id)

            // Assertions
            expect(result.success).toBe(false)
            expect(result.error).toBeDefined()
            expect(result.error).toMatch(/tidak dapat|belum ditutup/i)
            expect(result.data).toBeUndefined()
          }
        ),
        { numRuns: 20 }
      )
    } finally {
      // Cleanup all created sessions
      if (createdSessionIds.length > 0) {
        await db.delete(stockOpnameSessions).where(
          inArray(stockOpnameSessions.id, createdSessionIds)
        )
      }
    }
  })
})
