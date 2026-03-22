import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportToExcel } from '../inventory-ai';
import * as XLSX from 'xlsx';

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

describe('exportToExcel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockQueryResult = []; // Reset mock data
    });

    it('should return error when no predictions found', async () => {
        mockQueryResult = [];

        const result = await exportToExcel();

        expect(result.success).toBe(false);
        expect(result.error).toBe('No predictions found matching the filters');
    });

    it('should generate Excel file with correct structure', async () => {
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

        const result = await exportToExcel();

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data?.filename).toMatch(/^AI_Forecast_All_\d{4}-\d{2}-\d{2}\.xlsx$/);
        expect(result.data?.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        expect(result.data?.buffer).toBeDefined();
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

        const result = await exportToExcel({ dateFrom, dateTo });

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

        const result = await exportToExcel({ predictionType: 'REPLENISHMENT' });

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

        const result = await exportToExcel({ minAccuracy: 80, maxAccuracy: 95 });

        expect(result.success).toBe(true);
    });

    it('should format data correctly for Excel', async () => {
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
                accuracy: 85.567,
                batchId: 'BATCH-001'
            }
        ];

        const result = await exportToExcel();

        expect(result.success).toBe(true);
        
        // Decode base64 and verify Excel structure
        if (result.data?.buffer) {
            const buffer = Buffer.from(result.data.buffer, 'base64');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            
            // Verify sheets exist
            expect(workbook.SheetNames).toContain('Summary');
            expect(workbook.SheetNames).toContain('Predictive Replenishment');
            
            // Verify summary sheet has correct data
            const summarySheet = workbook.Sheets['Summary'];
            expect(summarySheet).toBeDefined();
            
            // Verify replenishment sheet has correct columns
            const replenishmentSheet = workbook.Sheets['Predictive Replenishment'];
            expect(replenishmentSheet).toBeDefined();
        }
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

        const result = await exportToExcel();

        expect(result.success).toBe(true);
        
        if (result.data?.buffer) {
            const buffer = Buffer.from(result.data.buffer, 'base64');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheet = workbook.Sheets['Predictive Replenishment'];
            
            // Verify N/A is used for null values
            const data = XLSX.utils.sheet_to_json(sheet);
            expect(data[0]).toMatchObject({
                'Product Name': 'N/A',
                'Current Stock': 'N/A',
                'Accuracy (%)': 'N/A',
                'Batch ID': 'N/A'
            });
        }
    });

    it('should create separate sheets for each prediction type', async () => {
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

        const result = await exportToExcel();

        expect(result.success).toBe(true);
        
        if (result.data?.buffer) {
            const buffer = Buffer.from(result.data.buffer, 'base64');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            
            // Verify all three prediction type sheets exist
            expect(workbook.SheetNames).toContain('Predictive Replenishment');
            expect(workbook.SheetNames).toContain('Dynamic Safety Stock');
            expect(workbook.SheetNames).toContain('Customer Recommendations');
            expect(workbook.SheetNames).toContain('Summary');
            
            // Verify each sheet has the correct number of rows
            const replenishmentData = XLSX.utils.sheet_to_json(workbook.Sheets['Predictive Replenishment']);
            const safetyStockData = XLSX.utils.sheet_to_json(workbook.Sheets['Dynamic Safety Stock']);
            const customerData = XLSX.utils.sheet_to_json(workbook.Sheets['Customer Recommendations']);
            
            expect(replenishmentData).toHaveLength(1);
            expect(safetyStockData).toHaveLength(1);
            expect(customerData).toHaveLength(1);
        }
    });

    it('should handle errors gracefully', async () => {
        // Mock the db.select to throw an error
        const { db } = await import('@/db');
        vi.mocked(db.select).mockImplementationOnce(() => {
            throw new Error('Database error');
        });

        const result = await exportToExcel();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Database error');
    });
});
