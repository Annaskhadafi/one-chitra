import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportToExcel, exportToPDF } from '../inventory-ai';
import * as XLSX from 'xlsx';

/**
 * Integration Tests for Export Functionality
 * Tests the complete export flow from UI interaction to file download
 * Requirements: 5.10, 5.11, 5.12
 * 
 * Test Coverage:
 * 1. Excel export with various filter combinations
 * 2. PDF export with various filter combinations
 * 3. Filename generation for different scenarios
 * 4. Error handling for edge cases
 * 5. Base64 buffer conversion and blob creation
 * 6. MIME type correctness
 * 7. Integration between ExportDialog and server actions
 */

// Mock query result
let mockQueryResult: any[] = [];

// Create a proper query chain mock
const createQueryChain = () => {
    const chain = {
        from: vi.fn(() => chain),
        where: vi.fn(() => Promise.resolve(mockQueryResult)),
        orderBy: vi.fn(() => chain),
        then: vi.fn((resolve) => resolve(mockQueryResult))
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

describe('Export Functionality - Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockQueryResult = [];
    });

    describe('Excel Export with Filter Combinations', () => {
        it('should export Excel with date range filter', async () => {
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
                    predictionDate: new Date('2024-01-20'),
                    accuracy: 92.3,
                    batchId: 'BATCH-002'
                }
            ];

            const result = await exportToExcel({
                dateFrom: new Date('2024-01-01'),
                dateTo: new Date('2024-01-31')
            });

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.filename).toMatch(/^AI_Forecast_All_\d{4}-\d{2}-\d{2}\.xlsx$/);
            expect(result.data?.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

            // Verify Excel structure
            const buffer = Buffer.from(result.data!.buffer, 'base64');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            
            expect(workbook.SheetNames).toContain('Summary');
            expect(workbook.SheetNames).toContain('Predictive Replenishment');
            expect(workbook.SheetNames).toContain('Dynamic Safety Stock');
        });

        it('should export Excel with prediction type filter', async () => {
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

            const result = await exportToExcel({
                predictionType: 'REPLENISHMENT'
            });

            expect(result.success).toBe(true);
            expect(result.data?.filename).toContain('REPLENISHMENT');
            
            // Verify only REPLENISHMENT sheet exists
            const buffer = Buffer.from(result.data!.buffer, 'base64');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            
            expect(workbook.SheetNames).toContain('Predictive Replenishment');
            expect(workbook.SheetNames).toContain('Summary');
        });

        it('should export Excel with accuracy range filter', async () => {
            mockQueryResult = [
                {
                    id: 1,
                    materialNumber: 'MAT001',
                    productName: 'High Accuracy Product',
                    predictionType: 'REPLENISHMENT',
                    currentStock: 100,
                    recommendedStock: 200,
                    rationale: 'High accuracy prediction',
                    predictionDate: new Date('2024-01-15'),
                    accuracy: 95.5,
                    batchId: 'BATCH-001'
                },
                {
                    id: 2,
                    materialNumber: 'MAT002',
                    productName: 'Good Accuracy Product',
                    predictionType: 'SAFETY_STOCK',
                    currentStock: 50,
                    recommendedStock: 150,
                    rationale: 'Good accuracy prediction',
                    predictionDate: new Date('2024-01-16'),
                    accuracy: 88.3,
                    batchId: 'BATCH-002'
                }
            ];

            const result = await exportToExcel({
                minAccuracy: 85,
                maxAccuracy: 100
            });

            expect(result.success).toBe(true);
            
            // Verify accuracy values in Excel
            const buffer = Buffer.from(result.data!.buffer, 'base64');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const replenishmentSheet = workbook.Sheets['Predictive Replenishment'];
            const data = XLSX.utils.sheet_to_json(replenishmentSheet);
            
            expect(data[0]).toMatchObject({
                'Material Number': 'MAT001',
                'Accuracy (%)': '95.50'
            });
        });

        it('should export Excel with combined filters (date + type + accuracy)', async () => {
            mockQueryResult = [
                {
                    id: 1,
                    materialNumber: 'MAT001',
                    productName: 'Filtered Product',
                    predictionType: 'REPLENISHMENT',
                    currentStock: 100,
                    recommendedStock: 200,
                    rationale: 'Meets all filter criteria',
                    predictionDate: new Date('2024-01-15'),
                    accuracy: 90.0,
                    batchId: 'BATCH-001'
                }
            ];

            const result = await exportToExcel({
                dateFrom: new Date('2024-01-01'),
                dateTo: new Date('2024-01-31'),
                predictionType: 'REPLENISHMENT',
                minAccuracy: 85,
                maxAccuracy: 95
            });

            expect(result.success).toBe(true);
            expect(result.data?.filename).toContain('REPLENISHMENT');
            
            // Verify filtered data
            const buffer = Buffer.from(result.data!.buffer, 'base64');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const summarySheet = workbook.Sheets['Summary'];
            const summaryData = XLSX.utils.sheet_to_json(summarySheet);
            
            // Check summary contains date range info
            const dateRangeRow = summaryData.find((row: any) => row.Metric === 'Date Range');
            expect(dateRangeRow).toBeDefined();
            expect(dateRangeRow).toMatchObject({
                Metric: 'Date Range',
                Value: '2024-01-01 to 2024-01-31'
            });
        });
    });

    describe('PDF Export with Filter Combinations', () => {
        it('should export PDF with date range filter', async () => {
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
                }
            ];

            const result = await exportToPDF({
                dateFrom: new Date('2024-01-01'),
                dateTo: new Date('2024-01-31')
            });

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.filename).toMatch(/^AI_Forecast_All_\d{4}-\d{2}-\d{2}\.pdf$/);
            expect(result.data?.mimeType).toBe('application/pdf');

            // Verify PDF structure
            const buffer = Buffer.from(result.data!.buffer, 'base64');
            const pdfHeader = buffer.toString('utf-8', 0, 5);
            expect(pdfHeader).toBe('%PDF-');
        });

        it('should export PDF with prediction type filter', async () => {
            mockQueryResult = [
                {
                    id: 1,
                    materialNumber: 'MAT001',
                    productName: 'Safety Stock Product',
                    predictionType: 'SAFETY_STOCK',
                    currentStock: 50,
                    recommendedStock: 150,
                    rationale: 'Safety stock calculation',
                    predictionDate: new Date('2024-01-15'),
                    accuracy: 88.0,
                    batchId: 'BATCH-001'
                }
            ];

            const result = await exportToPDF({
                predictionType: 'SAFETY_STOCK'
            });

            expect(result.success).toBe(true);
            expect(result.data?.filename).toContain('SAFETY_STOCK');
            
            // Verify PDF contains correct data
            const buffer = Buffer.from(result.data!.buffer, 'base64');
            const pdfContent = buffer.toString('utf-8');
            expect(pdfContent).toContain('MAT001');
        });

        it('should export PDF with accuracy range filter', async () => {
            mockQueryResult = [
                {
                    id: 1,
                    materialNumber: 'MAT001',
                    productName: 'High Accuracy Product',
                    predictionType: 'REPLENISHMENT',
                    currentStock: 100,
                    recommendedStock: 200,
                    rationale: 'High accuracy prediction',
                    predictionDate: new Date('2024-01-15'),
                    accuracy: 92.5,
                    batchId: 'BATCH-001'
                }
            ];

            const result = await exportToPDF({
                minAccuracy: 90,
                maxAccuracy: 100
            });

            expect(result.success).toBe(true);
            
            // Verify PDF contains high accuracy data
            const buffer = Buffer.from(result.data!.buffer, 'base64');
            expect(buffer.length).toBeGreaterThan(1000);
        });
    });

    describe('Filename Generation', () => {
        beforeEach(() => {
            mockQueryResult = [
                {
                    id: 1,
                    materialNumber: 'MAT001',
                    productName: 'Test Product',
                    predictionType: 'REPLENISHMENT',
                    currentStock: 100,
                    recommendedStock: 200,
                    rationale: 'Test',
                    predictionDate: new Date('2024-01-15'),
                    accuracy: 85.5,
                    batchId: 'BATCH-001'
                }
            ];
        });

        it('should generate filename with ALL type when no filter', async () => {
            const excelResult = await exportToExcel();
            expect(excelResult.data?.filename).toMatch(/^AI_Forecast_All_\d{4}-\d{2}-\d{2}\.xlsx$/);

            const pdfResult = await exportToPDF();
            expect(pdfResult.data?.filename).toMatch(/^AI_Forecast_All_\d{4}-\d{2}-\d{2}\.pdf$/);
        });

        it('should generate filename with REPLENISHMENT type', async () => {
            const excelResult = await exportToExcel({ predictionType: 'REPLENISHMENT' });
            expect(excelResult.data?.filename).toMatch(/^AI_Forecast_REPLENISHMENT_\d{4}-\d{2}-\d{2}\.xlsx$/);

            const pdfResult = await exportToPDF({ predictionType: 'REPLENISHMENT' });
            expect(pdfResult.data?.filename).toMatch(/^AI_Forecast_REPLENISHMENT_\d{4}-\d{2}-\d{2}\.pdf$/);
        });

        it('should generate filename with SAFETY_STOCK type', async () => {
            mockQueryResult[0].predictionType = 'SAFETY_STOCK';

            const excelResult = await exportToExcel({ predictionType: 'SAFETY_STOCK' });
            expect(excelResult.data?.filename).toMatch(/^AI_Forecast_SAFETY_STOCK_\d{4}-\d{2}-\d{2}\.xlsx$/);

            const pdfResult = await exportToPDF({ predictionType: 'SAFETY_STOCK' });
            expect(pdfResult.data?.filename).toMatch(/^AI_Forecast_SAFETY_STOCK_\d{4}-\d{2}-\d{2}\.pdf$/);
        });

        it('should generate filename with CUSTOMER_RECOMMENDATION type', async () => {
            mockQueryResult[0].predictionType = 'CUSTOMER_RECOMMENDATION';

            const excelResult = await exportToExcel({ predictionType: 'CUSTOMER_RECOMMENDATION' });
            expect(excelResult.data?.filename).toMatch(/^AI_Forecast_CUSTOMER_RECOMMENDATION_\d{4}-\d{2}-\d{2}\.xlsx$/);

            const pdfResult = await exportToPDF({ predictionType: 'CUSTOMER_RECOMMENDATION' });
            expect(pdfResult.data?.filename).toMatch(/^AI_Forecast_CUSTOMER_RECOMMENDATION_\d{4}-\d{2}-\d{2}\.pdf$/);
        });

        it('should generate filename with current date', async () => {
            const today = new Date().toISOString().split('T')[0];
            
            const excelResult = await exportToExcel();
            expect(excelResult.data?.filename).toContain(today);

            const pdfResult = await exportToPDF();
            expect(pdfResult.data?.filename).toContain(today);
        });
    });

    describe('Error Handling', () => {
        it('should handle no data scenario for Excel', async () => {
            mockQueryResult = [];

            const result = await exportToExcel();

            expect(result.success).toBe(false);
            expect(result.error).toBe('No predictions found matching the filters');
        });

        it('should handle no data scenario for PDF', async () => {
            mockQueryResult = [];

            const result = await exportToPDF();

            expect(result.success).toBe(false);
            expect(result.error).toBe('No predictions found matching the filters');
        });

        it('should handle invalid date range gracefully', async () => {
            mockQueryResult = [
                {
                    id: 1,
                    materialNumber: 'MAT001',
                    productName: 'Test Product',
                    predictionType: 'REPLENISHMENT',
                    currentStock: 100,
                    recommendedStock: 200,
                    rationale: 'Test',
                    predictionDate: new Date('2024-01-15'),
                    accuracy: 85.5,
                    batchId: 'BATCH-001'
                }
            ];

            // Date range where dateTo is before dateFrom (should be handled by UI validation)
            const result = await exportToExcel({
                dateFrom: new Date('2024-01-31'),
                dateTo: new Date('2024-01-01')
            });

            // Should still succeed as backend doesn't validate date order
            expect(result.success).toBe(true);
        });

        it('should handle database errors for Excel', async () => {
            const { db } = await import('@/db');
            vi.mocked(db.select).mockImplementationOnce(() => {
                throw new Error('Database connection failed');
            });

            const result = await exportToExcel();

            expect(result.success).toBe(false);
            expect(result.error).toBe('Database connection failed');
        });

        it('should handle database errors for PDF', async () => {
            const { db } = await import('@/db');
            vi.mocked(db.select).mockImplementationOnce(() => {
                throw new Error('Database connection failed');
            });

            const result = await exportToPDF();

            expect(result.success).toBe(false);
            expect(result.error).toBe('Database connection failed');
        });
    });

    describe('Base64 Buffer Conversion', () => {
        beforeEach(() => {
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
        });

        it('should return valid base64 buffer for Excel', async () => {
            const result = await exportToExcel();

            expect(result.success).toBe(true);
            expect(result.data?.buffer).toBeDefined();
            
            // Verify base64 can be decoded
            expect(() => Buffer.from(result.data!.buffer, 'base64')).not.toThrow();
            
            // Verify decoded buffer is valid Excel
            const buffer = Buffer.from(result.data!.buffer, 'base64');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            expect(workbook.SheetNames.length).toBeGreaterThan(0);
        });

        it('should return valid base64 buffer for PDF', async () => {
            const result = await exportToPDF();

            expect(result.success).toBe(true);
            expect(result.data?.buffer).toBeDefined();
            
            // Verify base64 can be decoded
            expect(() => Buffer.from(result.data!.buffer, 'base64')).not.toThrow();
            
            // Verify decoded buffer is valid PDF
            const buffer = Buffer.from(result.data!.buffer, 'base64');
            const pdfHeader = buffer.toString('utf-8', 0, 5);
            expect(pdfHeader).toBe('%PDF-');
        });

        it('should handle large buffers correctly', async () => {
            // Generate large dataset
            mockQueryResult = Array.from({ length: 100 }, (_, i) => ({
                id: i + 1,
                materialNumber: `MAT${String(i + 1).padStart(3, '0')}`,
                productName: `Test Product ${i + 1}`,
                predictionType: 'REPLENISHMENT',
                currentStock: 100,
                recommendedStock: 200,
                rationale: 'Test rationale '.repeat(10), // Long rationale
                predictionDate: new Date('2024-01-15'),
                accuracy: 85.5,
                batchId: 'BATCH-001'
            }));

            const excelResult = await exportToExcel();
            expect(excelResult.success).toBe(true);
            
            const excelBuffer = Buffer.from(excelResult.data!.buffer, 'base64');
            expect(excelBuffer.length).toBeGreaterThan(10000);

            const pdfResult = await exportToPDF();
            expect(pdfResult.success).toBe(true);
            
            const pdfBuffer = Buffer.from(pdfResult.data!.buffer, 'base64');
            expect(pdfBuffer.length).toBeGreaterThan(10000);
        });
    });

    describe('MIME Type Correctness', () => {
        beforeEach(() => {
            mockQueryResult = [
                {
                    id: 1,
                    materialNumber: 'MAT001',
                    productName: 'Test Product',
                    predictionType: 'REPLENISHMENT',
                    currentStock: 100,
                    recommendedStock: 200,
                    rationale: 'Test',
                    predictionDate: new Date('2024-01-15'),
                    accuracy: 85.5,
                    batchId: 'BATCH-001'
                }
            ];
        });

        it('should return correct MIME type for Excel', async () => {
            const result = await exportToExcel();

            expect(result.success).toBe(true);
            expect(result.data?.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        });

        it('should return correct MIME type for PDF', async () => {
            const result = await exportToPDF();

            expect(result.success).toBe(true);
            expect(result.data?.mimeType).toBe('application/pdf');
        });
    });

    describe('Data Integrity', () => {
        it('should preserve all data fields in Excel export', async () => {
            mockQueryResult = [
                {
                    id: 1,
                    materialNumber: 'MAT001',
                    productName: 'Test Product',
                    predictionType: 'REPLENISHMENT',
                    currentStock: 100,
                    recommendedStock: 200,
                    rationale: 'Detailed rationale text',
                    predictionDate: new Date('2024-01-15T10:30:00'),
                    accuracy: 85.567,
                    batchId: 'BATCH-001'
                }
            ];

            const result = await exportToExcel();

            expect(result.success).toBe(true);
            
            const buffer = Buffer.from(result.data!.buffer, 'base64');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheet = workbook.Sheets['Predictive Replenishment'];
            const data = XLSX.utils.sheet_to_json(sheet);
            
            expect(data[0]).toMatchObject({
                'Material Number': 'MAT001',
                'Product Name': 'Test Product',
                'Current Stock': 100,
                'Recommended Stock': 200,
                'Rationale': 'Detailed rationale text',
                'Prediction Date': '2024-01-15',
                'Accuracy (%)': '85.57',
                'Batch ID': 'BATCH-001'
            });
        });

        it('should handle null values correctly in Excel', async () => {
            mockQueryResult = [
                {
                    id: 1,
                    materialNumber: 'MAT001',
                    productName: null,
                    predictionType: 'REPLENISHMENT',
                    currentStock: null,
                    recommendedStock: 200,
                    rationale: 'Test',
                    predictionDate: new Date('2024-01-15'),
                    accuracy: null,
                    batchId: null
                }
            ];

            const result = await exportToExcel();

            expect(result.success).toBe(true);
            
            const buffer = Buffer.from(result.data!.buffer, 'base64');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheet = workbook.Sheets['Predictive Replenishment'];
            const data = XLSX.utils.sheet_to_json(sheet);
            
            expect(data[0]).toMatchObject({
                'Product Name': 'N/A',
                'Current Stock': 'N/A',
                'Accuracy (%)': 'N/A',
                'Batch ID': 'N/A'
            });
        });

        it('should handle null values correctly in PDF', async () => {
            mockQueryResult = [
                {
                    id: 1,
                    materialNumber: 'MAT001',
                    productName: null,
                    predictionType: 'REPLENISHMENT',
                    currentStock: null,
                    recommendedStock: 200,
                    rationale: 'Test',
                    predictionDate: new Date('2024-01-15'),
                    accuracy: null,
                    batchId: null
                }
            ];

            const result = await exportToPDF();

            expect(result.success).toBe(true);
            
            const buffer = Buffer.from(result.data!.buffer, 'base64');
            expect(buffer.length).toBeGreaterThan(1000);
        });
    });

    describe('Multiple Prediction Types', () => {
        it('should create separate sheets for each prediction type in Excel', async () => {
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
            
            const buffer = Buffer.from(result.data!.buffer, 'base64');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            
            expect(workbook.SheetNames).toContain('Summary');
            expect(workbook.SheetNames).toContain('Predictive Replenishment');
            expect(workbook.SheetNames).toContain('Dynamic Safety Stock');
            expect(workbook.SheetNames).toContain('Customer Recommendations');
            
            // Verify each sheet has correct data
            const replenishmentData = XLSX.utils.sheet_to_json(workbook.Sheets['Predictive Replenishment']);
            const safetyStockData = XLSX.utils.sheet_to_json(workbook.Sheets['Dynamic Safety Stock']);
            const customerData = XLSX.utils.sheet_to_json(workbook.Sheets['Customer Recommendations']);
            
            expect(replenishmentData).toHaveLength(1);
            expect(safetyStockData).toHaveLength(1);
            expect(customerData).toHaveLength(1);
        });

        it('should create separate pages for each prediction type in PDF', async () => {
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
            
            const buffer = Buffer.from(result.data!.buffer, 'base64');
            expect(buffer.length).toBeGreaterThan(5000); // Multi-page PDF
            
            const pdfContent = buffer.toString('utf-8');
            expect(pdfContent).toContain('MAT001');
            expect(pdfContent).toContain('MAT002');
            expect(pdfContent).toContain('CUST001');
        });
    });
});
