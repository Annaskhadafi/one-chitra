import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportToPDF } from '../inventory-ai';

// Mock query result with realistic data
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

describe('exportToPDF - Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockQueryResult = [];
    });

    it('should generate complete PDF with all prediction types and summary', async () => {
        // Realistic data with multiple prediction types
        mockQueryResult = [
            {
                id: 1,
                materialNumber: '27.00R49',
                productName: 'BRIDGESTONE VRPS 27.00R49 TL',
                predictionType: 'REPLENISHMENT',
                currentStock: 45,
                recommendedStock: 120,
                rationale: 'Berdasarkan analisis penjualan 6 bulan terakhir dengan rata-rata 20 unit/bulan, stok saat ini (45 unit) diperkirakan habis dalam 2.25 bulan. Dengan lead time 1-2 minggu, disarankan restock 120 unit pada tanggal 2024-03-15 untuk memenuhi demand hingga 6 bulan ke depan.',
                predictionDate: new Date('2024-01-15T10:30:00'),
                accuracy: 87.5,
                batchId: 'BATCH-20240115-001'
            },
            {
                id: 2,
                materialNumber: '24.00R35',
                productName: 'MICHELIN XDR2 24.00R35 TL',
                predictionType: 'REPLENISHMENT',
                currentStock: 12,
                recommendedStock: 80,
                rationale: 'Stok kritis! Penjualan rata-rata 15 unit/bulan. Stok saat ini hanya cukup untuk 0.8 bulan. Restock urgent diperlukan segera (2024-02-01) sebanyak 80 unit.',
                predictionDate: new Date('2024-01-16T14:20:00'),
                accuracy: 92.3,
                batchId: 'BATCH-20240115-001'
            },
            {
                id: 3,
                materialNumber: '27.00R49',
                productName: 'BRIDGESTONE VRPS 27.00R49 TL',
                predictionType: 'SAFETY_STOCK',
                currentStock: 45,
                recommendedStock: 35,
                rationale: 'Berdasarkan fluktuasi penjualan dengan standar deviasi ±8 unit, safety stock optimal adalah 35 unit untuk mengantisipasi demand tak terduga dengan service level 95%.',
                predictionDate: new Date('2024-01-17T09:15:00'),
                accuracy: 85.0,
                batchId: null
            },
            {
                id: 4,
                materialNumber: 'CUST-PT-ADARO',
                productName: 'PT Adaro Energy Indonesia',
                predictionType: 'CUSTOMER_RECOMMENDATION',
                currentStock: null,
                recommendedStock: 0,
                rationale: 'Rekomendasi produk untuk PT Adaro:\n1. BRIDGESTONE VRPS 27.00R49 TL - Customer memiliki 15 unit Komatsu 830E yang memerlukan ban size ini\n2. MICHELIN XDR2 24.00R35 TL - Untuk fleet Caterpillar 777D (8 units)\n3. Tube & Flap 27.00-49 - Produk pendamping yang belum dibeli\n4. O-Ring set - Maintenance parts yang sering dibutuhkan',
                predictionDate: new Date('2024-01-18T11:45:00'),
                accuracy: null,
                batchId: null
            },
            {
                id: 5,
                materialNumber: '33.00R51',
                productName: 'GOODYEAR RL-4K 33.00R51 TL',
                predictionType: 'REPLENISHMENT',
                currentStock: 8,
                recommendedStock: 60,
                rationale: 'Produk high-demand untuk mining sector. Penjualan konsisten 12 unit/bulan. Stok kritis, hanya cukup 0.67 bulan. Restock 60 unit diperlukan segera.',
                predictionDate: new Date('2024-01-19T16:00:00'),
                accuracy: 89.2,
                batchId: 'BATCH-20240119-002'
            }
        ];

        const result = await exportToPDF();

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        
        // Verify filename format
        expect(result.data?.filename).toMatch(/^AI_Forecast_All_\d{4}-\d{2}-\d{2}\.pdf$/);
        expect(result.data?.mimeType).toBe('application/pdf');
        
        // Verify buffer is valid base64
        expect(result.data?.buffer).toBeDefined();
        const buffer = Buffer.from(result.data!.buffer, 'base64');
        
        // Verify it's a valid PDF
        const pdfHeader = buffer.toString('utf-8', 0, 5);
        expect(pdfHeader).toBe('%PDF-');
        
        // Verify PDF has reasonable size (should be multi-page with all data)
        expect(buffer.length).toBeGreaterThan(5000); // Multi-page PDF with tables
        
        // Verify PDF contains key data
        const pdfContent = buffer.toString('utf-8');
        expect(pdfContent).toContain('27.00R49');
        expect(pdfContent).toContain('BRIDGESTONE');
    });

    it('should handle filtered export by date range', async () => {
        mockQueryResult = [
            {
                id: 1,
                materialNumber: '27.00R49',
                productName: 'BRIDGESTONE VRPS 27.00R49 TL',
                predictionType: 'REPLENISHMENT',
                currentStock: 45,
                recommendedStock: 120,
                rationale: 'Test rationale',
                predictionDate: new Date('2024-01-15'),
                accuracy: 87.5,
                batchId: 'BATCH-001'
            }
        ];

        const result = await exportToPDF({
            dateFrom: new Date('2024-01-01'),
            dateTo: new Date('2024-01-31'),
            predictionType: 'REPLENISHMENT'
        });

        expect(result.success).toBe(true);
        expect(result.data?.filename).toContain('REPLENISHMENT');
    });

    it('should handle export with accuracy filters', async () => {
        mockQueryResult = [
            {
                id: 1,
                materialNumber: '27.00R49',
                productName: 'BRIDGESTONE VRPS 27.00R49 TL',
                predictionType: 'REPLENISHMENT',
                currentStock: 45,
                recommendedStock: 120,
                rationale: 'High accuracy prediction',
                predictionDate: new Date('2024-01-15'),
                accuracy: 95.5,
                batchId: 'BATCH-001'
            },
            {
                id: 2,
                materialNumber: '24.00R35',
                productName: 'MICHELIN XDR2 24.00R35 TL',
                predictionType: 'REPLENISHMENT',
                currentStock: 12,
                recommendedStock: 80,
                rationale: 'High accuracy prediction',
                predictionDate: new Date('2024-01-16'),
                accuracy: 92.3,
                batchId: 'BATCH-001'
            }
        ];

        const result = await exportToPDF({
            minAccuracy: 90,
            maxAccuracy: 100
        });

        expect(result.success).toBe(true);
        
        // Verify PDF contains high accuracy predictions
        if (result.data?.buffer) {
            const buffer = Buffer.from(result.data.buffer, 'base64');
            const pdfContent = buffer.toString('utf-8');
            expect(pdfContent).toContain('27.00R49');
            expect(pdfContent).toContain('24.00R35');
        }
    });

    it('should properly format Indonesian text and special characters', async () => {
        mockQueryResult = [
            {
                id: 1,
                materialNumber: 'TEST-001',
                productName: 'Produk Tes dengan Karakter Spesial: & < > " \'',
                predictionType: 'REPLENISHMENT',
                currentStock: 100,
                recommendedStock: 200,
                rationale: 'Analisis menunjukkan bahwa stok perlu ditingkatkan. Faktor-faktor: 1) Peningkatan demand 2) Lead time yang panjang 3) Fluktuasi pasar',
                predictionDate: new Date('2024-01-15'),
                accuracy: 85.5,
                batchId: 'BATCH-001'
            }
        ];

        const result = await exportToPDF();

        expect(result.success).toBe(true);
        
        // Verify PDF is generated without errors despite special characters
        if (result.data?.buffer) {
            const buffer = Buffer.from(result.data.buffer, 'base64');
            expect(buffer.length).toBeGreaterThan(1000);
        }
    });

    it('should handle large dataset with pagination', async () => {
        // Generate 50 predictions to test pagination
        mockQueryResult = Array.from({ length: 50 }, (_, i) => ({
            id: i + 1,
            materialNumber: `MAT-${String(i + 1).padStart(3, '0')}`,
            productName: `Test Product ${i + 1}`,
            predictionType: i % 3 === 0 ? 'REPLENISHMENT' : i % 3 === 1 ? 'SAFETY_STOCK' : 'CUSTOMER_RECOMMENDATION',
            currentStock: Math.floor(Math.random() * 200),
            recommendedStock: Math.floor(Math.random() * 300) + 100,
            rationale: `Rationale for product ${i + 1}: Based on historical data and market trends`,
            predictionDate: new Date(`2024-01-${String((i % 28) + 1).padStart(2, '0')}`),
            accuracy: i % 3 === 2 ? null : Math.random() * 20 + 80,
            batchId: `BATCH-${String(Math.floor(i / 10)).padStart(3, '0')}`
        }));

        const result = await exportToPDF();

        expect(result.success).toBe(true);
        
        // Verify large PDF is generated
        if (result.data?.buffer) {
            const buffer = Buffer.from(result.data.buffer, 'base64');
            expect(buffer.length).toBeGreaterThan(10000); // Large multi-page PDF
        }
    });
});
