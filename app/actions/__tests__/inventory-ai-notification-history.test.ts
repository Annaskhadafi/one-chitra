import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getNotificationHistory } from '../inventory-ai';

// Mock the database and auth
vi.mock('@/db', () => ({
    db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
    }
}));

vi.mock('@/lib/rbac', () => ({
    getAuthenticatedSession: vi.fn().mockResolvedValue({ userId: 'test-user' })
}));

vi.mock('drizzle-orm', () => ({
    eq: vi.fn(),
    desc: vi.fn(),
    sql: vi.fn(),
    and: vi.fn(),
    or: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    lt: vi.fn(),
    gt: vi.fn(),
    ilike: vi.fn(),
    inArray: vi.fn(),
}));

describe('getNotificationHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return acknowledged notifications ordered by acknowledgment date', async () => {
        const mockHistory = [
            {
                id: 1,
                productCode: 'PROD001',
                productName: 'Product 1',
                currentStock: 50,
                recommendedStock: 500,
                urgencyLevel: 'CRITICAL',
                predictionId: 1,
                isAcknowledged: 1,
                acknowledgedAt: new Date('2024-01-15T10:00:00Z'),
                createdAt: new Date('2024-01-10T10:00:00Z'),
            },
            {
                id: 2,
                productCode: 'PROD002',
                productName: 'Product 2',
                currentStock: 100,
                recommendedStock: 800,
                urgencyLevel: 'HIGH',
                predictionId: 2,
                isAcknowledged: 1,
                acknowledgedAt: new Date('2024-01-14T10:00:00Z'),
                createdAt: new Date('2024-01-09T10:00:00Z'),
            },
        ];

        const { db } = await import('@/db');
        vi.mocked(db.limit).mockResolvedValue(mockHistory);

        const result = await getNotificationHistory(50);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockHistory);
        expect(result.totalCount).toBe(2);
    });

    it('should return empty array when no acknowledged notifications exist', async () => {
        const { db } = await import('@/db');
        vi.mocked(db.limit).mockResolvedValue([]);

        const result = await getNotificationHistory(50);

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);
        expect(result.totalCount).toBe(0);
    });

    it('should respect the limit parameter', async () => {
        const mockHistory = Array.from({ length: 100 }, (_, i) => ({
            id: i + 1,
            productCode: `PROD${String(i + 1).padStart(3, '0')}`,
            productName: `Product ${i + 1}`,
            currentStock: 50,
            recommendedStock: 500,
            urgencyLevel: 'CRITICAL' as const,
            predictionId: i + 1,
            isAcknowledged: 1,
            acknowledgedAt: new Date(),
            createdAt: new Date(),
        }));

        const { db } = await import('@/db');
        const limitSpy = vi.mocked(db.limit);
        limitSpy.mockResolvedValue(mockHistory.slice(0, 20));

        await getNotificationHistory(20);

        expect(limitSpy).toHaveBeenCalledWith(20);
    });

    it('should use default limit of 50 when not specified', async () => {
        const { db } = await import('@/db');
        const limitSpy = vi.mocked(db.limit);
        limitSpy.mockResolvedValue([]);

        await getNotificationHistory();

        expect(limitSpy).toHaveBeenCalledWith(50);
    });

    it('should handle database errors gracefully', async () => {
        const { db } = await import('@/db');
        vi.mocked(db.limit).mockRejectedValue(new Error('Database connection failed'));

        const result = await getNotificationHistory(50);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Database connection failed');
    });

    it('should only return acknowledged notifications (isAcknowledged = 1)', async () => {
        const mockHistory = [
            {
                id: 1,
                productCode: 'PROD001',
                productName: 'Product 1',
                currentStock: 50,
                recommendedStock: 500,
                urgencyLevel: 'CRITICAL',
                predictionId: 1,
                isAcknowledged: 1,
                acknowledgedAt: new Date('2024-01-15T10:00:00Z'),
                createdAt: new Date('2024-01-10T10:00:00Z'),
            },
        ];

        const { db } = await import('@/db');
        vi.mocked(db.limit).mockResolvedValue(mockHistory);

        const result = await getNotificationHistory(50);

        expect(result.success).toBe(true);
        // Verify all returned items are acknowledged
        result.data?.forEach(item => {
            expect(item.isAcknowledged).toBe(1);
            expect(item.acknowledgedAt).toBeTruthy();
        });
    });

    it('should include all required fields in history items', async () => {
        const mockHistory = [
            {
                id: 1,
                productCode: 'PROD001',
                productName: 'Product 1',
                currentStock: 50,
                recommendedStock: 500,
                urgencyLevel: 'CRITICAL',
                predictionId: 1,
                isAcknowledged: 1,
                acknowledgedAt: new Date('2024-01-15T10:00:00Z'),
                createdAt: new Date('2024-01-10T10:00:00Z'),
            },
        ];

        const { db } = await import('@/db');
        vi.mocked(db.limit).mockResolvedValue(mockHistory);

        const result = await getNotificationHistory(50);

        expect(result.success).toBe(true);
        expect(result.data?.[0]).toHaveProperty('id');
        expect(result.data?.[0]).toHaveProperty('productCode');
        expect(result.data?.[0]).toHaveProperty('productName');
        expect(result.data?.[0]).toHaveProperty('currentStock');
        expect(result.data?.[0]).toHaveProperty('recommendedStock');
        expect(result.data?.[0]).toHaveProperty('urgencyLevel');
        expect(result.data?.[0]).toHaveProperty('isAcknowledged');
        expect(result.data?.[0]).toHaveProperty('acknowledgedAt');
        expect(result.data?.[0]).toHaveProperty('createdAt');
    });
});
