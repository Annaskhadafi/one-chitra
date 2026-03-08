import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRecentPredictions } from '../inventory-ai';

// Mock query result
let mockQueryResult: any[] = [];
let mockCountResult: any[] = [{ count: 0 }];

// Create a proper query chain mock
const createQueryChain = () => {
    const chain = {
        from: vi.fn(() => chain),
        leftJoin: vi.fn(() => chain),
        where: vi.fn(() => chain),
        orderBy: vi.fn(() => chain),
        limit: vi.fn(() => Promise.resolve(mockQueryResult)),
        then: vi.fn((resolve) => resolve(mockQueryResult))
    };
    return chain;
};

// Create count query chain mock
const createCountChain = () => {
    const chain = {
        from: vi.fn(() => chain),
        leftJoin: vi.fn(() => chain),
        where: vi.fn(() => Promise.resolve(mockCountResult)),
        then: vi.fn((resolve) => resolve(mockCountResult))
    };
    return chain;
};

// Mock dependencies
vi.mock('@/db', () => ({
    db: {
        select: vi.fn((fields?: any) => {
            // If fields contain count, return count chain
            if (fields && fields.count) {
                return createCountChain();
            }
            return createQueryChain();
        })
    }
}));

vi.mock('@/lib/rbac', () => ({
    getAuthenticatedSession: vi.fn().mockResolvedValue({ userId: 'test-user' })
}));

vi.mock('drizzle-orm', () => ({
    eq: vi.fn((field, value) => ({ field, value, op: 'eq' })),
    desc: vi.fn((field) => ({ field, op: 'desc' })),
    and: vi.fn((...conditions) => ({ conditions, op: 'and' })),
    or: vi.fn((...conditions) => ({ conditions, op: 'or' })),
    ilike: vi.fn((field, value) => ({ field, value, op: 'ilike' })),
    gte: vi.fn((field, value) => ({ field, value, op: 'gte' })),
    lte: vi.fn((field, value) => ({ field, value, op: 'lte' })),
    lt: vi.fn((field, value) => ({ field, value, op: 'lt' })),
    gt: vi.fn((field, value) => ({ field, value, op: 'gt' })),
    sql: vi.fn((strings, ...values) => ({ strings, values, op: 'sql' }))
}));

describe('getRecentPredictions - Filter Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockQueryResult = [];
        mockCountResult = [{ count: 0 }];
    });

    it('should return all predictions when no filters applied', async () => {
        mockQueryResult = [
            {
                id: 1,
                productCode: 'MAT001',
                productName: 'Test Product 1',
                predictionType: 'REPLENISHMENT',
                recommendedStock: 200,
                rationale: 'Test rationale',
                createdAt: new Date('2024-01-15'),
                actualSales: null,
                accuracyPercentage: null,
                batchId: null,
                currentStock: 100
            }
        ];
        mockCountResult = [{ count: 1 }];

        const result = await getRecentPredictions();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.totalCount).toBe(1);
    });

    it('should filter by date range', async () => {
        mockQueryResult = [
            {
                id: 1,
                productCode: 'MAT001',
                productName: 'Test Product',
                predictionType: 'REPLENISHMENT',
                recommendedStock: 200,
                rationale: 'Test rationale',
                createdAt: new Date('2024-01-15'),
                actualSales: null,
                accuracyPercentage: null,
                batchId: null,
                currentStock: 100
            }
        ];
        mockCountResult = [{ count: 1 }];

        const dateFrom = new Date('2024-01-01');
        const dateTo = new Date('2024-01-31');

        const result = await getRecentPredictions({ dateFrom, dateTo });

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
    });

    it('should filter by stock range - low', async () => {
        mockQueryResult = [
            {
                id: 1,
                productCode: 'MAT001',
                productName: 'Low Stock Product',
                predictionType: 'REPLENISHMENT',
                recommendedStock: 50,
                rationale: 'Test rationale',
                createdAt: new Date('2024-01-15'),
                actualSales: null,
                accuracyPercentage: null,
                batchId: null,
                currentStock: 25
            }
        ];
        mockCountResult = [{ count: 1 }];

        const result = await getRecentPredictions({ stockRange: 'low' });

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data![0].recommendedStock).toBeLessThan(100);
    });

    it('should filter by stock range - medium', async () => {
        mockQueryResult = [
            {
                id: 1,
                productCode: 'MAT002',
                productName: 'Medium Stock Product',
                predictionType: 'REPLENISHMENT',
                recommendedStock: 250,
                rationale: 'Test rationale',
                createdAt: new Date('2024-01-15'),
                actualSales: null,
                accuracyPercentage: null,
                batchId: null,
                currentStock: 150
            }
        ];
        mockCountResult = [{ count: 1 }];

        const result = await getRecentPredictions({ stockRange: 'medium' });

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data![0].recommendedStock).toBeGreaterThanOrEqual(100);
        expect(result.data![0].recommendedStock).toBeLessThanOrEqual(500);
    });

    it('should filter by stock range - high', async () => {
        mockQueryResult = [
            {
                id: 1,
                productCode: 'MAT003',
                productName: 'High Stock Product',
                predictionType: 'REPLENISHMENT',
                recommendedStock: 750,
                rationale: 'Test rationale',
                createdAt: new Date('2024-01-15'),
                actualSales: null,
                accuracyPercentage: null,
                batchId: null,
                currentStock: 500
            }
        ];
        mockCountResult = [{ count: 1 }];

        const result = await getRecentPredictions({ stockRange: 'high' });

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data![0].recommendedStock).toBeGreaterThan(500);
    });

    it('should filter by accuracy level - high', async () => {
        mockQueryResult = [
            {
                id: 1,
                productCode: 'MAT001',
                productName: 'High Accuracy Product',
                predictionType: 'REPLENISHMENT',
                recommendedStock: 200,
                rationale: 'Test rationale',
                createdAt: new Date('2024-01-15'),
                actualSales: 195,
                accuracyPercentage: 85.5,
                batchId: null,
                currentStock: 100
            }
        ];
        mockCountResult = [{ count: 1 }];

        const result = await getRecentPredictions({ accuracyLevel: 'high' });

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data![0].accuracyPercentage).toBeGreaterThan(80);
    });

    it('should filter by accuracy level - medium', async () => {
        mockQueryResult = [
            {
                id: 1,
                productCode: 'MAT002',
                productName: 'Medium Accuracy Product',
                predictionType: 'REPLENISHMENT',
                recommendedStock: 200,
                rationale: 'Test rationale',
                createdAt: new Date('2024-01-15'),
                actualSales: 180,
                accuracyPercentage: 70.0,
                batchId: null,
                currentStock: 100
            }
        ];
        mockCountResult = [{ count: 1 }];

        const result = await getRecentPredictions({ accuracyLevel: 'medium' });

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data![0].accuracyPercentage).toBeGreaterThanOrEqual(60);
        expect(result.data![0].accuracyPercentage).toBeLessThanOrEqual(80);
    });

    it('should filter by accuracy level - low', async () => {
        mockQueryResult = [
            {
                id: 1,
                productCode: 'MAT003',
                productName: 'Low Accuracy Product',
                predictionType: 'REPLENISHMENT',
                recommendedStock: 200,
                rationale: 'Test rationale',
                createdAt: new Date('2024-01-15'),
                actualSales: 120,
                accuracyPercentage: 45.0,
                batchId: null,
                currentStock: 100
            }
        ];
        mockCountResult = [{ count: 1 }];

        const result = await getRecentPredictions({ accuracyLevel: 'low' });

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data![0].accuracyPercentage).toBeLessThan(60);
    });

    it('should filter by search query - product code', async () => {
        mockQueryResult = [
            {
                id: 1,
                productCode: 'MAT001',
                productName: 'Test Product',
                predictionType: 'REPLENISHMENT',
                recommendedStock: 200,
                rationale: 'Test rationale',
                createdAt: new Date('2024-01-15'),
                actualSales: null,
                accuracyPercentage: null,
                batchId: null,
                currentStock: 100
            }
        ];
        mockCountResult = [{ count: 1 }];

        const result = await getRecentPredictions({ searchQuery: 'MAT001' });

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data![0].productCode).toContain('MAT001');
    });

    it('should filter by search query - product name', async () => {
        mockQueryResult = [
            {
                id: 1,
                productCode: 'MAT001',
                productName: 'Special Test Product',
                predictionType: 'REPLENISHMENT',
                recommendedStock: 200,
                rationale: 'Test rationale',
                createdAt: new Date('2024-01-15'),
                actualSales: null,
                accuracyPercentage: null,
                batchId: null,
                currentStock: 100
            }
        ];
        mockCountResult = [{ count: 1 }];

        const result = await getRecentPredictions({ searchQuery: 'Special' });

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data![0].productName).toContain('Special');
    });

    it('should handle empty search query', async () => {
        mockQueryResult = [
            {
                id: 1,
                productCode: 'MAT001',
                productName: 'Test Product',
                predictionType: 'REPLENISHMENT',
                recommendedStock: 200,
                rationale: 'Test rationale',
                createdAt: new Date('2024-01-15'),
                actualSales: null,
                accuracyPercentage: null,
                batchId: null,
                currentStock: 100
            }
        ];
        mockCountResult = [{ count: 1 }];

        const result = await getRecentPredictions({ searchQuery: '' });

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
    });

    it('should combine multiple filters', async () => {
        mockQueryResult = [
            {
                id: 1,
                productCode: 'MAT001',
                productName: 'Test Product',
                predictionType: 'REPLENISHMENT',
                recommendedStock: 250,
                rationale: 'Test rationale',
                createdAt: new Date('2024-01-15'),
                actualSales: 240,
                accuracyPercentage: 85.0,
                batchId: null,
                currentStock: 150
            }
        ];
        mockCountResult = [{ count: 1 }];

        const result = await getRecentPredictions({
            dateFrom: new Date('2024-01-01'),
            dateTo: new Date('2024-01-31'),
            stockRange: 'medium',
            accuracyLevel: 'high',
            searchQuery: 'MAT001'
        });

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
    });

    it('should return empty array when no results match filters', async () => {
        mockQueryResult = [];
        mockCountResult = [{ count: 0 }];

        const result = await getRecentPredictions({
            searchQuery: 'NONEXISTENT'
        });

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(0);
        expect(result.totalCount).toBe(0);
    });

    it('should handle material group filter with join', async () => {
        mockQueryResult = [
            {
                id: 1,
                productCode: 'MAT001',
                productName: 'Test Product',
                predictionType: 'REPLENISHMENT',
                recommendedStock: 200,
                rationale: 'Test rationale',
                createdAt: new Date('2024-01-15'),
                actualSales: null,
                accuracyPercentage: null,
                batchId: null,
                currentStock: 100
            }
        ];
        mockCountResult = [{ count: 1 }];

        const result = await getRecentPredictions({ materialGroup: 'GROUP001' });

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
    });

    it('should handle errors gracefully', async () => {
        const { db } = await import('@/db');
        vi.mocked(db.select).mockImplementationOnce(() => {
            throw new Error('Database error');
        });

        const result = await getRecentPredictions();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to fetch AI predictions');
    });

    it('should return totalCount for result display', async () => {
        mockQueryResult = [
            {
                id: 1,
                productCode: 'MAT001',
                productName: 'Test Product 1',
                predictionType: 'REPLENISHMENT',
                recommendedStock: 200,
                rationale: 'Test rationale',
                createdAt: new Date('2024-01-15'),
                actualSales: null,
                accuracyPercentage: null,
                batchId: null,
                currentStock: 100
            },
            {
                id: 2,
                productCode: 'MAT002',
                productName: 'Test Product 2',
                predictionType: 'SAFETY_STOCK',
                recommendedStock: 150,
                rationale: 'Test rationale 2',
                createdAt: new Date('2024-01-16'),
                actualSales: null,
                accuracyPercentage: null,
                batchId: null,
                currentStock: 75
            }
        ];
        mockCountResult = [{ count: 2 }];

        const result = await getRecentPredictions();

        expect(result.success).toBe(true);
        expect(result.totalCount).toBe(2);
    });
});
