import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateRestockAlerts } from '../inventory-ai';

// Mock query results
type MockPredictionAlertRow = {
    id: number;
    productCode: string;
    productName: string;
    currentStock: number | null;
    recommendedStock: number;
};

type MockExistingAlertRow = {
    productCode: string;
};

let mockPredictionsResult: MockPredictionAlertRow[] = [];
let mockExistingAlertsResult: MockExistingAlertRow[] = [];

type SuccessfulAlertResult = {
    success: true;
    createdCount: number;
    totalEvaluated: number;
    message?: string;
    breakdown: {
        critical: number;
        high: number;
        medium: number;
    };
};

function expectAlertSuccess(
    result: Awaited<ReturnType<typeof generateRestockAlerts>>
): asserts result is Awaited<ReturnType<typeof generateRestockAlerts>> & SuccessfulAlertResult {
    expect(result.success).toBe(true);
}

// Track which query is being called
let queryCallCount = 0;

// Create a proper query chain mock
const createSelectChain = () => {
    const currentCall = queryCallCount++;
    const chain = {
        from: vi.fn(() => chain),
        where: vi.fn(() => {
            // First call is for predictions, second call is for existing alerts
            const result = currentCall === 0 ? mockPredictionsResult : mockExistingAlertsResult;
            return Promise.resolve(result);
        }),
        orderBy: vi.fn(() => chain),
        then: vi.fn((resolve) => {
            const result = currentCall === 0 ? mockPredictionsResult : mockExistingAlertsResult;
            return resolve(result);
        })
    };
    return chain;
};

// Mock dependencies
vi.mock('@/db', () => ({
    db: {
        select: vi.fn(() => createSelectChain()),
        insert: vi.fn(() => ({
            values: vi.fn(() => Promise.resolve({ rowCount: 1 }))
        }))
    }
}));

vi.mock('@/lib/rbac', () => ({
    getAuthenticatedSession: vi.fn().mockResolvedValue({ userId: 'test-user' })
}));

vi.mock('drizzle-orm', () => ({
    eq: vi.fn((field, value) => ({ field, value, op: 'eq' })),
    desc: vi.fn((field) => ({ field, op: 'desc' })),
    and: vi.fn((...conditions) => ({ conditions, op: 'and' })),
    gte: vi.fn((field, value) => ({ field, value, op: 'gte' })),
    lte: vi.fn((field, value) => ({ field, value, op: 'lte' })),
    or: vi.fn((...conditions) => ({ conditions, op: 'or' })),
    inArray: vi.fn((field, values) => ({ field, values, op: 'inArray' })),
    sql: vi.fn((strings, ...values) => ({ strings, values, op: 'sql' }))
}));

describe('generateRestockAlerts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPredictionsResult = [];
        mockExistingAlertsResult = [];
        queryCallCount = 0; // Reset query call counter
    });

    it('should generate critical alert for stock < 10% of recommended', async () => {
        mockPredictionsResult = [
            {
                id: 1,
                productCode: 'MAT001',
                productName: 'Test Product 1',
                currentStock: 5,
                recommendedStock: 100, // 5% stock level
            }
        ];
        mockExistingAlertsResult = [];

        const result = await generateRestockAlerts();

        expectAlertSuccess(result);
        expect(result.createdCount).toBe(1);
        expect(result.breakdown.critical).toBe(1);
        expect(result.breakdown.high).toBe(0);
        expect(result.breakdown.medium).toBe(0);
    });

    it('should generate high alert for stock between 10-20% of recommended', async () => {
        mockPredictionsResult = [
            {
                id: 1,
                productCode: 'MAT001',
                productName: 'Test Product 1',
                currentStock: 15,
                recommendedStock: 100, // 15% stock level
            }
        ];
        mockExistingAlertsResult = [];

        const result = await generateRestockAlerts();

        expectAlertSuccess(result);
        expect(result.createdCount).toBe(1);
        expect(result.breakdown.critical).toBe(0);
        expect(result.breakdown.high).toBe(1);
        expect(result.breakdown.medium).toBe(0);
    });

    it('should generate medium alert for stock between 20-30% of recommended', async () => {
        mockPredictionsResult = [
            {
                id: 1,
                productCode: 'MAT001',
                productName: 'Test Product 1',
                currentStock: 25,
                recommendedStock: 100, // 25% stock level
            }
        ];
        mockExistingAlertsResult = [];

        const result = await generateRestockAlerts();

        expectAlertSuccess(result);
        expect(result.createdCount).toBe(1);
        expect(result.breakdown.critical).toBe(0);
        expect(result.breakdown.high).toBe(0);
        expect(result.breakdown.medium).toBe(1);
    });

    it('should not generate alert for stock >= 30% of recommended', async () => {
        mockPredictionsResult = [
            {
                id: 1,
                productCode: 'MAT001',
                productName: 'Test Product 1',
                currentStock: 50,
                recommendedStock: 100, // 50% stock level
            }
        ];
        mockExistingAlertsResult = [];

        const result = await generateRestockAlerts();

        expectAlertSuccess(result);
        expect(result.createdCount).toBe(0);
        expect(result.totalEvaluated).toBe(1);
    });

    it('should generate multiple alerts with different urgency levels', async () => {
        mockPredictionsResult = [
            {
                id: 1,
                productCode: 'MAT001',
                productName: 'Product 1',
                currentStock: 5,
                recommendedStock: 100, // 5% - Critical
            },
            {
                id: 2,
                productCode: 'MAT002',
                productName: 'Product 2',
                currentStock: 15,
                recommendedStock: 100, // 15% - High
            },
            {
                id: 3,
                productCode: 'MAT003',
                productName: 'Product 3',
                currentStock: 25,
                recommendedStock: 100, // 25% - Medium
            },
            {
                id: 4,
                productCode: 'MAT004',
                productName: 'Product 4',
                currentStock: 50,
                recommendedStock: 100, // 50% - No alert
            }
        ];
        mockExistingAlertsResult = [];

        const result = await generateRestockAlerts();

        expectAlertSuccess(result);
        expect(result.createdCount).toBe(3);
        expect(result.totalEvaluated).toBe(4);
        expect(result.breakdown.critical).toBe(1);
        expect(result.breakdown.high).toBe(1);
        expect(result.breakdown.medium).toBe(1);
    });

    it('should not create duplicate alerts for products with existing unacknowledged alerts', async () => {
        mockPredictionsResult = [
            {
                id: 1,
                productCode: 'MAT001',
                productName: 'Product 1',
                currentStock: 5,
                recommendedStock: 100,
            },
            {
                id: 2,
                productCode: 'MAT002',
                productName: 'Product 2',
                currentStock: 15,
                recommendedStock: 100,
            }
        ];
        
        // MAT001 already has an unacknowledged alert
        mockExistingAlertsResult = [
            {
                productCode: 'MAT001'
            }
        ];

        const result = await generateRestockAlerts();

        expectAlertSuccess(result);
        expect(result.createdCount).toBe(1); // Only MAT002 should get a new alert
        expect(result.totalEvaluated).toBe(2);
    });

    it('should handle edge case of zero recommended stock', async () => {
        mockPredictionsResult = [
            {
                id: 1,
                productCode: 'MAT001',
                productName: 'Product 1',
                currentStock: 10,
                recommendedStock: 0, // Edge case
            }
        ];
        mockExistingAlertsResult = [];

        const result = await generateRestockAlerts();

        expectAlertSuccess(result);
        expect(result.createdCount).toBe(0); // Should not create alert for zero recommended
    });

    it('should handle null current stock', async () => {
        mockPredictionsResult = [
            {
                id: 1,
                productCode: 'MAT001',
                productName: 'Product 1',
                currentStock: null,
                recommendedStock: 100,
            }
        ];
        mockExistingAlertsResult = [];

        const result = await generateRestockAlerts();

        expectAlertSuccess(result);
        // Should treat null as 0 and generate critical alert
        expect(result.createdCount).toBe(1);
        expect(result.breakdown.critical).toBe(1);
    });

    it('should handle empty predictions list', async () => {
        mockPredictionsResult = [];
        mockExistingAlertsResult = [];

        const result = await generateRestockAlerts();

        expectAlertSuccess(result);
        expect(result.createdCount).toBe(0);
        expect(result.totalEvaluated).toBe(0);
    });

    it('should categorize urgency at exact boundary values', async () => {
        mockPredictionsResult = [
            {
                id: 1,
                productCode: 'MAT001',
                productName: 'Product 1',
                currentStock: 10,
                recommendedStock: 100, // Exactly 10% - should be HIGH
            },
            {
                id: 2,
                productCode: 'MAT002',
                productName: 'Product 2',
                currentStock: 20,
                recommendedStock: 100, // Exactly 20% - should be MEDIUM
            },
            {
                id: 3,
                productCode: 'MAT003',
                productName: 'Product 3',
                currentStock: 30,
                recommendedStock: 100, // Exactly 30% - should be no alert
            }
        ];
        mockExistingAlertsResult = [];

        const result = await generateRestockAlerts();

        expectAlertSuccess(result);
        expect(result.createdCount).toBe(2);
        expect(result.breakdown.critical).toBe(0);
        expect(result.breakdown.high).toBe(1);
        expect(result.breakdown.medium).toBe(1);
    });

    it('should handle errors gracefully', async () => {
        // Mock the db.select to throw an error
        const { db } = await import('@/db');
        vi.mocked(db.select).mockImplementationOnce(() => {
            throw new Error('Database connection error');
        });

        const result = await generateRestockAlerts();

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toBe('Database connection error');
        }
    });

    it('should return correct message format', async () => {
        mockPredictionsResult = [
            {
                id: 1,
                productCode: 'MAT001',
                productName: 'Product 1',
                currentStock: 5,
                recommendedStock: 100,
            }
        ];
        mockExistingAlertsResult = [];

        const result = await generateRestockAlerts();

        expectAlertSuccess(result);
        expect(result.message).toBe('Generated 1 new restock alerts');
        expect(result).toHaveProperty('createdCount');
        expect(result).toHaveProperty('totalEvaluated');
        expect(result).toHaveProperty('breakdown');
        expect(result.breakdown).toHaveProperty('critical');
        expect(result.breakdown).toHaveProperty('high');
        expect(result.breakdown).toHaveProperty('medium');
    });
});
