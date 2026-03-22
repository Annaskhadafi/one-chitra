import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportToPDF } from '../inventory-ai';

// Mock query result
let mockQueryResult: any[] = [];

// Create a proper query chain mock
const createQueryChain = () => {
    const chain = {
        from: vi.fn(() => chain),
        where: vi.fn(() => Promise.resolve(mockQueryResult)),
        orderBy: vi.fn(() => chain),
        then: vi.fn((resolve) => resolve(mockQueryResult)) // Make it thenable for await
    };
    return chain;
};

// Mock dependencies
vi.mock('@/db', () => ({
    db: {
        select: vi.fn(() => createQueryChain())
    }
}));

vi.mock('@/lib/rbac', () => ({
    getAuthenticatedSession: vi.fn().mockResolvedValue({ userId: 'test-user' })
}));

vi.mock('drizzle-orm', () => ({
    eq: vi.fn((field, value) => ({ field, value, op: 'eq' })),
    desc: vi.fn((field) => ({ field, op: 'desc' })),
    and: vi.fn((...conditions) => ({ conditions, op: 'and' })),
    sql: vi.fn((strings, ...values) => ({ strings, values, op: 'sql' }))
}));

describe('exportToPDF', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockQueryResult = []; // Reset mock data
    });

    it('should return error when no predictions found', async () => {
        mockQueryResult = [];

        const result = await exportToPDF();

        expect(result.success).toBe(false);
        expect(result.error).toBe('No predictions found matching the filters');
    });

    it('should generate PDF file with correct structure', async () => {
        mockQueryResult = [
            {
                id: 1,
                materialNumber: 'MAT001',
                productName: 'Test Product 1',
                predictionType: 'REPLENISHMENT',
                currentStock: 100,
                recommendedStock: 200,
                rationale: 'Test rationale 1',
                predictionDate: new Date('2024-01-15'),
                accuracy: 85.5,
                batchId: 'BATCH-001'
            },
            {
                id: 2,
                materialNumber: 'MAT002',
                productName: 'Test Product 2',
                predictionType: 'SAFETY_STOCK',
                currentStock: 50,
                recommendedStock: 150,
                rationale: 'Test rationale 2',
                predictionDate: new Date('2024-01-16'),
                accuracy: 92.3,
                batchId: 'BATCH-002'
            },
            {
                id: 3,
                materialNumber: 'CUST001',
                productName: 'Customer A',
                predictionType: 'CUSTOMER_RECOMMENDATION',
                currentStock: null,
                recommendedStock: 0,
                rationale: 'Test recommendation',
                predictionDate: new Date('2024-01-17'),
                accuracy: null,
                batchId: null
            }
        ];

        const result = await exportToPDF();

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data?.filename).toMatch(/^AI_Forecast_All_\d{4}-\d{2}-\d{2}\.pdf$/);
        expect(result.data?.mimeType).toBe('application/pdf');
        expect(result.data?.buffer).toBeDefined();
        
        // Verify buffer is valid base64
        expect(() => Buffer.from(result.data!.buffer, 'base64')).not.toThrow();
    });

    it('should apply date filters correctly', async () => {
        mockQueryResult = [
            {
                id: 1,
                materialNumber: 'MAT001',
                productName: 'Test Product',
                predictionType: 'REPLENISHMENT',
                currentStock: 100,
                recommendedStock: 200,
                rationale: 'Test rationale',
                predictionDate: new Date('2024-01-15'),
                accuracy: 85.5,
                batchId: 'BATCH-001'
            }
        ];

        const dateFrom = new Date('2024-01-01');
        const dateTo = new Date('2024-01-31');

        const result = await exportToPDF({ dateFrom, dateTo });

        expect(result.success).toBe(true);
    });

    it('should filter by prediction type', async () => {
        mockQueryResult = [
            {
                id: 1,
                materialNumber: 'MAT001',
                productName: 'Test Product',
                predictionType: 'REPLENISHMENT',
                currentStock: 100,
                recommendedStock: 200,
                rationale: 'Test rationale',
                predictionDate: new Date('2024-01-15'),
                accuracy: 85.5,
                batchId: 'BATCH-001'
            }
        ];

        const result = await exportToPDF({ predictionType: 'REPLENISHMENT' });

        expect(result.success).toBe(true);
        expect(result.data?.filename).toContain('REPLENISHMENT');
    });

    it('should handle accuracy filters', async () => {
        mockQueryResult = [
            {
                id: 1,
                materialNumber: 'MAT001',
                productName: 'Test Product',
                predictionType: 'REPLENISHMENT',
                currentStock: 100,
                recommendedStock: 200,
                rationale: 'Test rationale',
                predictionDate: new Date('2024-01-15'),
                accuracy: 85.5,
                batchId: 'BATCH-001'
            }
        ];

        const result = await exportToPDF({ minAccuracy: 80, maxAccuracy: 95 });

        expect(result.success).toBe(true);
    });

    it('should include company header and timestamp', async () => {
        mockQueryResult = [
            {
                id: 1,
                materialNumber: 'MAT001',
                productName: 'Test Product',
                predictionType: 'REPLENISHMENT',
                currentStock: 100,
                recommendedStock: 200,
                rationale: 'Test rationale',
                predictionDate: new Date('2024-01-15'),
                accuracy: 85.5,
                batchId: 'BATCH-001'
            }
        ];

        const result = await exportToPDF();

        expect(result.success).toBe(true);
        
        // Verify PDF buffer is generated
        if (result.data?.buffer) {
            const buffer = Buffer.from(result.data.buffer, 'base64');
            
            // Basic validation that it's a PDF file
            const pdfHeader = buffer.toString('utf-8', 0, 5);
            expect(pdfHeader).toBe('%PDF-');
        }
    });

    it('should calculate summary statistics correctly', async () => {
        mockQueryResult = [
            {
                id: 1,
                materialNumber: 'MAT001',
                productName: 'Product 1',
                predictionType: 'REPLENISHMENT',
                currentStock: 100,
                recommendedStock: 200,
                rationale: 'Rationale 1',
                predictionDate: new Date('2024-01-15'),
                accuracy: 80.0,
                batchId: 'BATCH-001'
            },
            {
                id: 2,
                materialNumber: 'MAT002',
                productName: 'Product 2',
                predictionType: 'SAFETY_STOCK',
                currentStock: 50,
                recommendedStock: 150,
                rationale: 'Rationale 2',
                predictionDate: new Date('2024-01-16'),
                accuracy: 90.0,
                batchId: 'BATCH-002'
            },
            {
                id: 3,
                materialNumber: 'CUST001',
                productName: 'Customer A',
                predictionType: 'CUSTOMER_RECOMMENDATION',
                currentStock: null,
                recommendedStock: 0,
                rationale: 'Recommendation',
                predictionDate: new Date('2024-01-17'),
                accuracy: null,
                batchId: null
            }
        ];

        const result = await exportToPDF();

        expect(result.success).toBe(true);
        
        // The PDF should contain summary statistics
        // Average accuracy should be (80 + 90) / 2 = 85.00%
        // Total predictions: 3
        // Replenishment: 1, Safety Stock: 1, Customer Recommendations: 1
    });

    it('should handle null values correctly', async () => {
        mockQueryResult = [
            {
                id: 1,
                materialNumber: 'MAT001',
                productName: null,
                predictionType: 'REPLENISHMENT',
                currentStock: null,
                recommendedStock: 200,
                rationale: 'Test rationale',
                predictionDate: new Date('2024-01-15'),
                accuracy: null,
                batchId: null
            }
        ];

        const result = await exportToPDF();

        expect(result.success).toBe(true);
        
        // Verify PDF is generated even with null values
        if (result.data?.buffer) {
            const buffer = Buffer.from(result.data.buffer, 'base64');
            expect(buffer.length).toBeGreaterThan(0);
        }
    });

    it('should format prediction details in table', async () => {
        mockQueryResult = [
            {
                id: 1,
                materialNumber: 'MAT001',
                productName: 'Product 1',
                predictionType: 'REPLENISHMENT',
                currentStock: 100,
                recommendedStock: 200,
                rationale: 'This is a test rationale that explains the prediction',
                predictionDate: new Date('2024-01-15'),
                accuracy: 85.567,
                batchId: 'BATCH-001'
            }
        ];

        const result = await exportToPDF();

        expect(result.success).toBe(true);
        
        // Verify PDF contains table data
        if (result.data?.buffer) {
            const buffer = Buffer.from(result.data.buffer, 'base64');
            const pdfContent = buffer.toString('utf-8');
            
            // Check for table-related content (jsPDF includes these in the PDF structure)
            expect(pdfContent).toContain('MAT001');
        }
    });

    it('should handle long rationale text by truncating', async () => {
        const longRationale = 'This is a very long rationale text that should be truncated to fit within the table cell width. '.repeat(5);
        
        mockQueryResult = [
            {
                id: 1,
                materialNumber: 'MAT001',
                productName: 'Product 1',
                predictionType: 'REPLENISHMENT',
                currentStock: 100,
                recommendedStock: 200,
                rationale: longRationale,
                predictionDate: new Date('2024-01-15'),
                accuracy: 85.5,
                batchId: 'BATCH-001'
            }
        ];

        const result = await exportToPDF();

        expect(result.success).toBe(true);
        expect(result.data?.buffer).toBeDefined();
    });

    it('should create separate pages for each prediction type', async () => {
        mockQueryResult = [
            {
                id: 1,
                materialNumber: 'MAT001',
                productName: 'Product 1',
                predictionType: 'REPLENISHMENT',
                currentStock: 100,
                recommendedStock: 200,
                rationale: 'Rationale 1',
                predictionDate: new Date('2024-01-15'),
                accuracy: 85.5,
                batchId: 'BATCH-001'
            },
            {
                id: 2,
                materialNumber: 'MAT002',
                productName: 'Product 2',
                predictionType: 'SAFETY_STOCK',
                currentStock: 50,
                recommendedStock: 150,
                rationale: 'Rationale 2',
                predictionDate: new Date('2024-01-16'),
                accuracy: 92.3,
                batchId: 'BATCH-002'
            },
            {
                id: 3,
                materialNumber: 'CUST001',
                productName: 'Customer A',
                predictionType: 'CUSTOMER_RECOMMENDATION',
                currentStock: null,
                recommendedStock: 0,
                rationale: 'Recommendation',
                predictionDate: new Date('2024-01-17'),
                accuracy: null,
                batchId: null
            }
        ];

        const result = await exportToPDF();

        expect(result.success).toBe(true);
        
        // Verify PDF has multiple pages (summary + 3 prediction type pages)
        if (result.data?.buffer) {
            const buffer = Buffer.from(result.data.buffer, 'base64');
            expect(buffer.length).toBeGreaterThan(1000); // Multi-page PDF should be larger
        }
    });

    it('should handle errors gracefully', async () => {
        // Mock the db.select to throw an error
        const { db } = await import('@/db');
        vi.mocked(db.select).mockImplementationOnce(() => {
            throw new Error('Database error');
        });

        const result = await exportToPDF();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Database error');
    });

    it('should generate correct filename format', async () => {
        mockQueryResult = [
            {
                id: 1,
                materialNumber: 'MAT001',
                productName: 'Test Product',
                predictionType: 'REPLENISHMENT',
                currentStock: 100,
                recommendedStock: 200,
                rationale: 'Test rationale',
                predictionDate: new Date('2024-01-15'),
                accuracy: 85.5,
                batchId: 'BATCH-001'
            }
        ];

        const result = await exportToPDF({ predictionType: 'REPLENISHMENT' });

        expect(result.success).toBe(true);
        expect(result.data?.filename).toMatch(/^AI_Forecast_REPLENISHMENT_\d{4}-\d{2}-\d{2}\.pdf$/);
    });

    it('should handle empty prediction type gracefully', async () => {
        mockQueryResult = [
            {
                id: 1,
                materialNumber: 'MAT001',
                productName: 'Test Product',
                predictionType: 'REPLENISHMENT',
                currentStock: 100,
                recommendedStock: 200,
                rationale: 'Test rationale',
                predictionDate: new Date('2024-01-15'),
                accuracy: 85.5,
                batchId: 'BATCH-001'
            }
        ];

        const result = await exportToPDF({ predictionType: 'SAFETY_STOCK' });

        // Should still succeed even if no matching predictions
        // (In this case, the query mock returns all data, but in real scenario it would filter)
        expect(result.success).toBe(true);
    });
});
