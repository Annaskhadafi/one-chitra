/**
 * Unit Tests for Stock Opname Server Actions
 * Feature: stock-opname-enhancement
 * 
 * These tests verify specific scenarios and edge cases for the createStockOpnameSession
 * server action, complementing the property-based tests.
 * 
 * **Validates: Requirements 1.4, 2.5, 2.6**
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { db } from '@/db'
import { stockOpnameSessions, stockOpnameSignatures, stockOpnameItems, warehouses, user, stockLevels, products } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { createStockOpnameSession, getOpnamePdfReportData, closeStockOpnameSession } from '../stock-opname'
import type { CreateOpnameSessionInput } from '@/lib/schemas'

// Mock the RBAC module
vi.mock('@/lib/rbac', () => ({
  getAuthenticatedSession: vi.fn().mockResolvedValue({
    user: { id: 'test-user-unit' },
    session: { id: 'test-session' }
  })
}))

// Mock revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}))

// Test data setup
let testWarehouseId: number
let testUserId: string
let testProductId: number
let createdSessionIds: number[] = []

beforeAll(async () => {
  // Clean up any existing test data first
  await db.delete(stockOpnameSessions).where(eq(stockOpnameSessions.createdById, 'test-user-unit'))
  await db.delete(stockLevels).where(eq(stockLevels.warehouseId, testWarehouseId || 0))
  await db.delete(warehouses).where(eq(warehouses.sloc, 'TEST-UNIT'))
  await db.delete(user).where(eq(user.id, 'test-user-unit'))
  
  // Create test user
  const [testUser] = await db.insert(user).values({
    id: 'test-user-unit',
    name: 'Test User Unit',
    email: 'test-unit@example.com',
    emailVerified: false,
  }).returning()
  testUserId = testUser.id

  // Create test warehouse
  const [warehouse] = await db.insert(warehouses).values({
    sloc: 'TEST-UNIT',
    description: 'Test Warehouse for Unit Tests',
    type: 'MAIN',
  }).returning()
  testWarehouseId = warehouse.id

  // Use an existing product or create one without isConsignment field
  const existingProduct = await db.query.products.findFirst()
  
  if (existingProduct) {
    testProductId = existingProduct.id
    
    // Ensure there's a stock level for this product in our test warehouse
    const existingStockLevel = await db.query.stockLevels.findFirst({
      where: (stockLevels, { and, eq }) => and(
        eq(stockLevels.productId, testProductId),
        eq(stockLevels.warehouseId, testWarehouseId)
      )
    })
    
    if (!existingStockLevel) {
      await db.insert(stockLevels).values({
        productId: testProductId,
        warehouseId: testWarehouseId,
        totalStock: 100,
      })
    }
  } else {
    // If no products exist, create one with only required fields
    const [product] = await db.insert(products).values({
      category: 'TEST',
      materialNumber: 'TEST-SKU-001',
      materialDescription: 'Test product for unit tests',
    }).returning()
    testProductId = product.id

    // Create stock level for the product
    await db.insert(stockLevels).values({
      productId: testProductId,
      warehouseId: testWarehouseId,
      totalStock: 100,
    })
  }
})

afterAll(async () => {
  // Cleanup in reverse order of dependencies
  await db.delete(stockLevels).where(eq(stockLevels.warehouseId, testWarehouseId))
  
  // Only delete the product if we created it (check if it's our test product)
  const product = await db.query.products.findFirst({
    where: eq(products.id, testProductId)
  })
  
  if (product && product.materialNumber === 'TEST-SKU-001') {
    await db.delete(products).where(eq(products.id, testProductId))
  }
  
  await db.delete(stockOpnameSessions).where(eq(stockOpnameSessions.warehouseId, testWarehouseId))
  await db.delete(warehouses).where(eq(warehouses.id, testWarehouseId))
  await db.delete(user).where(eq(user.id, testUserId))
})

beforeEach(() => {
  createdSessionIds = []
})

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Creates valid session input data for testing
 */
function createValidSessionInput(overrides?: Partial<CreateOpnameSessionInput>): CreateOpnameSessionInput {
  return {
    name: 'Test Session',
    warehouseId: testWarehouseId,
    opnameDate: new Date('2024-06-15'),
    opnameTime: '14:30',
    location: 'Warehouse A - Section 1',
    signatures: [
      { name: 'John Doe', position: 'Warehouse Manager' },
      { name: 'Jane Smith', position: 'Inventory Clerk' }
    ],
    notes: 'Test notes',
    ...overrides
  }
}

// ─── Unit Tests ─────────────────────────────────────────────────────────────

describe('createStockOpnameSession - Unit Tests', () => {
  
  describe('Successful session creation', () => {
    
    it('should create session with valid data and return success', async () => {
      const input = createValidSessionInput()
      
      const result = await createStockOpnameSession(input)
      
      expect(result.success).toBe(true)
      expect(result.sessionId).toBeDefined()
      expect(typeof result.sessionId).toBe('number')
      
      if (result.sessionId) {
        createdSessionIds.push(result.sessionId)
        
        // Verify session was created in database
        const session = await db.query.stockOpnameSessions.findFirst({
          where: eq(stockOpnameSessions.id, result.sessionId),
          with: {
            signatures: {
              orderBy: (sigs, { asc }) => [asc(sigs.order)]
            }
          }
        })
        
        expect(session).toBeDefined()
        expect(session!.name).toBe(input.name)
        expect(session!.location).toBe(input.location)
        expect(session!.opnameTime).toBe(input.opnameTime)
        expect(session!.status).toBe('open')
      }
    })
    
    it('should create session with all signature entries in correct order', async () => {
      const input = createValidSessionInput({
        signatures: [
          { name: 'Person 1', position: 'Position 1' },
          { name: 'Person 2', position: 'Position 2' },
          { name: 'Person 3', position: 'Position 3' }
        ]
      })
      
      const result = await createStockOpnameSession(input)
      
      expect(result.success).toBe(true)
      
      if (result.sessionId) {
        createdSessionIds.push(result.sessionId)
        
        const signatures = await db.query.stockOpnameSignatures.findMany({
          where: eq(stockOpnameSignatures.sessionId, result.sessionId),
          orderBy: (sigs, { asc }) => [asc(sigs.order)]
        })
        
        expect(signatures).toHaveLength(3)
        expect(signatures[0].name).toBe('Person 1')
        expect(signatures[0].position).toBe('Position 1')
        expect(signatures[0].order).toBe(0)
        expect(signatures[1].name).toBe('Person 2')
        expect(signatures[1].order).toBe(1)
        expect(signatures[2].name).toBe('Person 3')
        expect(signatures[2].order).toBe(2)
      }
    })
    
    it('should populate stock items from warehouse inventory', async () => {
      const input = createValidSessionInput()
      
      const result = await createStockOpnameSession(input)
      
      expect(result.success).toBe(true)
      
      if (result.sessionId) {
        createdSessionIds.push(result.sessionId)
        
        const items = await db.query.stockOpnameItems.findMany({
          where: eq(stockOpnameItems.sessionId, result.sessionId)
        })
        
        // Should have at least one item from the test product
        expect(items.length).toBeGreaterThan(0)
        
        const testItem = items.find(item => item.productId === testProductId)
        expect(testItem).toBeDefined()
        expect(testItem!.systemQty).toBe(100) // From stock level
        expect(testItem!.countedQty).toBeNull() // Not counted yet
        expect(testItem!.variance).toBeNull()
      }
    })
    
    it('should handle optional notes field', async () => {
      const inputWithNotes = createValidSessionInput({ notes: 'Important notes' })
      const resultWithNotes = await createStockOpnameSession(inputWithNotes)
      
      expect(resultWithNotes.success).toBe(true)
      
      if (resultWithNotes.sessionId) {
        createdSessionIds.push(resultWithNotes.sessionId)
        
        const sessionWithNotes = await db.query.stockOpnameSessions.findFirst({
          where: eq(stockOpnameSessions.id, resultWithNotes.sessionId)
        })
        
        expect(sessionWithNotes!.notes).toBe('Important notes')
      }
      
      // Test without notes
      const inputWithoutNotes = createValidSessionInput({ notes: undefined })
      const resultWithoutNotes = await createStockOpnameSession(inputWithoutNotes)
      
      expect(resultWithoutNotes.success).toBe(true)
      
      if (resultWithoutNotes.sessionId) {
        createdSessionIds.push(resultWithoutNotes.sessionId)
        
        const sessionWithoutNotes = await db.query.stockOpnameSessions.findFirst({
          where: eq(stockOpnameSessions.id, resultWithoutNotes.sessionId)
        })
        
        expect(sessionWithoutNotes!.notes).toBeNull()
      }
    })
    
    it('should set createdById to authenticated user', async () => {
      const input = createValidSessionInput()
      
      const result = await createStockOpnameSession(input)
      
      expect(result.success).toBe(true)
      
      if (result.sessionId) {
        createdSessionIds.push(result.sessionId)
        
        const session = await db.query.stockOpnameSessions.findFirst({
          where: eq(stockOpnameSessions.id, result.sessionId)
        })
        
        expect(session!.createdById).toBe('test-user-unit')
      }
    })
  })
  
  describe('Validation errors', () => {
    
    it('should reject session with empty name', async () => {
      const input = createValidSessionInput({ name: '' })
      
      const result = await createStockOpnameSession(input)
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
    
    it('should reject session with missing location', async () => {
      const input = createValidSessionInput({ location: '' })
      
      const result = await createStockOpnameSession(input)
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
    
    it('should reject session with invalid time format', async () => {
      const invalidTimes = ['25:00', '12:60', '1:30', '12:5', 'invalid', '']
      
      for (const invalidTime of invalidTimes) {
        const input = createValidSessionInput({ opnameTime: invalidTime })
        
        const result = await createStockOpnameSession(input)
        
        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      }
    })
    
    it('should reject session with zero signatures', async () => {
      const input = createValidSessionInput({ signatures: [] })
      
      const result = await createStockOpnameSession(input)
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
    
    it('should reject session with signature missing name', async () => {
      const input = createValidSessionInput({
        signatures: [
          { name: '', position: 'Manager' }
        ]
      })
      
      const result = await createStockOpnameSession(input)
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
    
    it('should reject session with signature missing position', async () => {
      const input = createValidSessionInput({
        signatures: [
          { name: 'John Doe', position: '' }
        ]
      })
      
      const result = await createStockOpnameSession(input)
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
    
    it('should reject session with invalid warehouse ID', async () => {
      const input = createValidSessionInput({ warehouseId: 0 })
      
      const result = await createStockOpnameSession(input)
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })
  
  describe('Transaction rollback', () => {
    
    it('should rollback transaction on database error', async () => {
      // Use a non-existent warehouse ID to trigger foreign key constraint error
      const uniqueName = `Test Session Rollback ${Date.now()}`
      const uniqueSignatures = [
        { name: `Unique Person ${Date.now()}`, position: 'Manager' },
        { name: `Unique Person ${Date.now() + 1}`, position: 'Clerk' }
      ]
      
      const input = createValidSessionInput({ 
        warehouseId: 999999,
        name: uniqueName,
        signatures: uniqueSignatures
      })
      
      const result = await createStockOpnameSession(input)
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      
      // Verify no session was created with this unique name
      const sessions = await db.query.stockOpnameSessions.findMany({
        where: eq(stockOpnameSessions.name, uniqueName)
      })
      
      expect(sessions).toHaveLength(0)
      
      // Verify no signatures were created with these unique names
      const allSignatures = await db.query.stockOpnameSignatures.findMany()
      const orphanedSignatures = allSignatures.filter(sig => 
        uniqueSignatures.some(inputSig => sig.name === inputSig.name)
      )
      
      expect(orphanedSignatures).toHaveLength(0)
    })
  })
  
  describe('Authentication checks', () => {
    
    it('should call getAuthenticatedSession with correct parameters', async () => {
      const { getAuthenticatedSession } = await import('@/lib/rbac')
      
      const input = createValidSessionInput()
      
      await createStockOpnameSession(input)
      
      expect(getAuthenticatedSession).toHaveBeenCalledWith('stock-opname', 'create')
    })
  })
  
  describe('Edge cases', () => {
    
    it('should handle single signature entry', async () => {
      const input = createValidSessionInput({
        signatures: [
          { name: 'Solo Manager', position: 'Manager' }
        ]
      })
      
      const result = await createStockOpnameSession(input)
      
      expect(result.success).toBe(true)
      
      if (result.sessionId) {
        createdSessionIds.push(result.sessionId)
        
        const signatures = await db.query.stockOpnameSignatures.findMany({
          where: eq(stockOpnameSignatures.sessionId, result.sessionId)
        })
        
        expect(signatures).toHaveLength(1)
        expect(signatures[0].name).toBe('Solo Manager')
      }
    })
    
    it('should handle maximum signature entries (20)', async () => {
      const signatures = Array.from({ length: 20 }, (_, i) => ({
        name: `Person ${i + 1}`,
        position: `Position ${i + 1}`
      }))
      
      const input = createValidSessionInput({ signatures })
      
      const result = await createStockOpnameSession(input)
      
      expect(result.success).toBe(true)
      
      if (result.sessionId) {
        createdSessionIds.push(result.sessionId)
        
        const savedSignatures = await db.query.stockOpnameSignatures.findMany({
          where: eq(stockOpnameSignatures.sessionId, result.sessionId),
          orderBy: (sigs, { asc }) => [asc(sigs.order)]
        })
        
        expect(savedSignatures).toHaveLength(20)
        expect(savedSignatures[19].order).toBe(19)
      }
    })
    
    it('should handle special characters in text fields', async () => {
      const input = createValidSessionInput({
        name: 'Test & Special <Characters> "Quotes"',
        location: 'Warehouse #1 - Section A/B',
        signatures: [
          { name: "O'Brien", position: 'Manager & Supervisor' }
        ],
        notes: 'Notes with special chars: @#$%^&*()'
      })
      
      const result = await createStockOpnameSession(input)
      
      expect(result.success).toBe(true)
      
      if (result.sessionId) {
        createdSessionIds.push(result.sessionId)
        
        const session = await db.query.stockOpnameSessions.findFirst({
          where: eq(stockOpnameSessions.id, result.sessionId),
          with: { signatures: true }
        })
        
        expect(session!.name).toBe(input.name)
        expect(session!.location).toBe(input.location)
        expect(session!.notes).toBe(input.notes)
        expect(session!.signatures[0].name).toBe("O'Brien")
      }
    })
    
    it('should handle valid time formats at boundaries', async () => {
      const validTimes = ['00:00', '23:59', '12:00', '09:05']
      
      for (const time of validTimes) {
        const input = createValidSessionInput({ 
          opnameTime: time,
          name: `Session ${time}` // Unique name for each
        })
        
        const result = await createStockOpnameSession(input)
        
        expect(result.success).toBe(true)
        
        if (result.sessionId) {
          createdSessionIds.push(result.sessionId)
          
          const session = await db.query.stockOpnameSessions.findFirst({
            where: eq(stockOpnameSessions.id, result.sessionId)
          })
          
          expect(session!.opnameTime).toBe(time)
        }
      }
    })
  })
})

// ─── Unit Tests for getOpnamePdfReportData ─────────────────────────────────

describe('getOpnamePdfReportData - Unit Tests', () => {
  
  describe('Successful data retrieval', () => {
    
    it('should retrieve PDF data for closed session with all required relations', async () => {
      // Create a session
      const input = createValidSessionInput()
      const createResult = await createStockOpnameSession(input)
      
      expect(createResult.success).toBe(true)
      expect(createResult.sessionId).toBeDefined()
      
      if (!createResult.sessionId) return
      
      createdSessionIds.push(createResult.sessionId)
      
      // Close the session
      const closeResult = await closeStockOpnameSession(createResult.sessionId, false)
      expect(closeResult.success).toBe(true)
      
      // Get PDF report data
      const pdfResult = await getOpnamePdfReportData(createResult.sessionId)
      
      expect(pdfResult.success).toBe(true)
      expect(pdfResult.data).toBeDefined()
      
      if (pdfResult.data) {
        // Verify session data
        expect(pdfResult.data.session).toBeDefined()
        expect(pdfResult.data.session.id).toBe(createResult.sessionId)
        expect(pdfResult.data.session.status).toBe('closed')
        expect(pdfResult.data.session.closedAt).toBeDefined()
        expect(pdfResult.data.session.closedById).toBe('test-user-unit')
        
        // Verify warehouse relation is loaded
        expect(pdfResult.data.session.warehouse).toBeDefined()
        expect(pdfResult.data.session.warehouse!.id).toBe(testWarehouseId)
        
        // Verify closedBy user relation is loaded
        expect(pdfResult.data.session.closedBy).toBeDefined()
        expect(pdfResult.data.session.closedBy!.id).toBe('test-user-unit')
        
        // Verify signatures are loaded
        expect(pdfResult.data.signatures).toBeDefined()
        expect(pdfResult.data.signatures.length).toBe(2)
        expect(pdfResult.data.signatures[0].name).toBe('John Doe')
        expect(pdfResult.data.signatures[1].name).toBe('Jane Smith')
        
        // Verify items are loaded with product relations
        expect(pdfResult.data.items).toBeDefined()
        expect(pdfResult.data.items.length).toBeGreaterThan(0)
        expect(pdfResult.data.items[0].product).toBeDefined()
        expect(pdfResult.data.items[0].product.id).toBeDefined()
        
        // Verify company logo is included
        expect(pdfResult.data.companyLogo).toBeDefined()
      }
    })
    
    it('should include closure metadata in PDF data', async () => {
      // Create and close a session
      const input = createValidSessionInput({ name: 'Session for Closure Metadata Test' })
      const createResult = await createStockOpnameSession(input)
      
      expect(createResult.success).toBe(true)
      
      if (!createResult.sessionId) return
      
      createdSessionIds.push(createResult.sessionId)
      
      const closeResult = await closeStockOpnameSession(createResult.sessionId, false)
      expect(closeResult.success).toBe(true)
      
      // Get PDF report data
      const pdfResult = await getOpnamePdfReportData(createResult.sessionId)
      
      expect(pdfResult.success).toBe(true)
      expect(pdfResult.data).toBeDefined()
      
      if (pdfResult.data) {
        // Verify closure timestamp is present
        expect(pdfResult.data.session.closedAt).toBeDefined()
        expect(pdfResult.data.session.closedAt).toBeInstanceOf(Date)
        
        // Verify closed by user is present
        expect(pdfResult.data.session.closedById).toBe('test-user-unit')
        expect(pdfResult.data.session.closedBy).toBeDefined()
        expect(pdfResult.data.session.closedBy!.name).toBe('Test User Unit')
      }
    })
  })
  
  describe('Error handling', () => {
    
    it('should return error for non-existent session', async () => {
      const nonExistentSessionId = 999999
      
      const result = await getOpnamePdfReportData(nonExistentSessionId)
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error).toMatch(/tidak ditemukan/i)
      expect(result.data).toBeUndefined()
    })
    
    it('should return error for open session', async () => {
      // Create a session but don't close it
      const input = createValidSessionInput({ name: 'Open Session Test' })
      const createResult = await createStockOpnameSession(input)
      
      expect(createResult.success).toBe(true)
      
      if (!createResult.sessionId) return
      
      createdSessionIds.push(createResult.sessionId)
      
      // Try to get PDF data without closing the session
      const pdfResult = await getOpnamePdfReportData(createResult.sessionId)
      
      expect(pdfResult.success).toBe(false)
      expect(pdfResult.error).toBeDefined()
      expect(pdfResult.error).toMatch(/belum ditutup/i)
      expect(pdfResult.data).toBeUndefined()
    })
    
    it('should return error for cancelled session', async () => {
      // Create a session
      const input = createValidSessionInput({ name: 'Cancelled Session Test' })
      const createResult = await createStockOpnameSession(input)
      
      expect(createResult.success).toBe(true)
      
      if (!createResult.sessionId) return
      
      createdSessionIds.push(createResult.sessionId)
      
      // Manually set session status to cancelled
      await db
        .update(stockOpnameSessions)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(stockOpnameSessions.id, createResult.sessionId))
      
      // Try to get PDF data for cancelled session
      const pdfResult = await getOpnamePdfReportData(createResult.sessionId)
      
      expect(pdfResult.success).toBe(false)
      expect(pdfResult.error).toBeDefined()
      expect(pdfResult.error).toMatch(/belum ditutup/i)
      expect(pdfResult.data).toBeUndefined()
    })
  })
  
  describe('Data completeness', () => {
    
    it('should load all required relations for PDF generation', async () => {
      // Create a session with multiple signatures
      const input = createValidSessionInput({
        name: 'Complete Relations Test',
        signatures: [
          { name: 'Manager 1', position: 'Warehouse Manager' },
          { name: 'Clerk 1', position: 'Inventory Clerk' },
          { name: 'Supervisor 1', position: 'Supervisor' }
        ]
      })
      
      const createResult = await createStockOpnameSession(input)
      expect(createResult.success).toBe(true)
      
      if (!createResult.sessionId) return
      
      createdSessionIds.push(createResult.sessionId)
      
      // Close the session
      await closeStockOpnameSession(createResult.sessionId, false)
      
      // Get PDF report data
      const pdfResult = await getOpnamePdfReportData(createResult.sessionId)
      
      expect(pdfResult.success).toBe(true)
      expect(pdfResult.data).toBeDefined()
      
      if (pdfResult.data) {
        // Verify all signatures are loaded in correct order
        expect(pdfResult.data.signatures).toHaveLength(3)
        expect(pdfResult.data.signatures[0].name).toBe('Manager 1')
        expect(pdfResult.data.signatures[1].name).toBe('Clerk 1')
        expect(pdfResult.data.signatures[2].name).toBe('Supervisor 1')
        
        // Verify items have product data
        for (const item of pdfResult.data.items) {
          expect(item.product).toBeDefined()
          expect(item.product.id).toBeDefined()
          expect(item.product.materialDescription).toBeDefined()
        }
        
        // Verify session metadata
        expect(pdfResult.data.session.opnameDate).toBeDefined()
        expect(pdfResult.data.session.opnameTime).toBeDefined()
        expect(pdfResult.data.session.location).toBeDefined()
      }
    })
    
    it('should include all stock items in PDF data', async () => {
      // Create a session
      const input = createValidSessionInput({ name: 'All Items Test' })
      const createResult = await createStockOpnameSession(input)
      
      expect(createResult.success).toBe(true)
      
      if (!createResult.sessionId) return
      
      createdSessionIds.push(createResult.sessionId)
      
      // Get the count of items in the session
      const itemsBeforeClose = await db.query.stockOpnameItems.findMany({
        where: eq(stockOpnameItems.sessionId, createResult.sessionId)
      })
      
      const itemCount = itemsBeforeClose.length
      
      // Close the session
      await closeStockOpnameSession(createResult.sessionId, false)
      
      // Get PDF report data
      const pdfResult = await getOpnamePdfReportData(createResult.sessionId)
      
      expect(pdfResult.success).toBe(true)
      expect(pdfResult.data).toBeDefined()
      
      if (pdfResult.data) {
        // Verify all items are included in PDF data
        expect(pdfResult.data.items).toHaveLength(itemCount)
        
        // Verify each item has required fields
        for (const item of pdfResult.data.items) {
          expect(item.id).toBeDefined()
          expect(item.productId).toBeDefined()
          expect(item.systemQty).toBeDefined()
          expect(item.product).toBeDefined()
        }
      }
    })
  })
  
  describe('Authentication checks', () => {
    
    it('should call getAuthenticatedSession with correct parameters', async () => {
      const { getAuthenticatedSession } = await import('@/lib/rbac')
      
      // Create and close a session
      const input = createValidSessionInput({ name: 'Auth Check Test' })
      const createResult = await createStockOpnameSession(input)
      
      if (!createResult.sessionId) return
      
      createdSessionIds.push(createResult.sessionId)
      
      await closeStockOpnameSession(createResult.sessionId, false)
      
      // Clear previous calls
      vi.clearAllMocks()
      
      // Get PDF report data
      await getOpnamePdfReportData(createResult.sessionId)
      
      // Verify authentication was checked
      expect(getAuthenticatedSession).toHaveBeenCalledWith('stock-opname', 'view')
    })
  })
})
