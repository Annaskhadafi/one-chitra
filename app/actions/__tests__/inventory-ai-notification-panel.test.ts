import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
    getRestockNotifications, 
    acknowledgeNotification,
    getNotificationCount 
} from '../inventory-ai';

// Mock dependencies
vi.mock('@/db', () => ({
    db: {
        select: vi.fn(),
        update: vi.fn(),
    }
}));

vi.mock('@/lib/rbac', () => ({
    getAuthenticatedSession: vi.fn().mockResolvedValue({ userId: 'test-user' })
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn()
}));

// Import mocked db after mocking
import { db } from '@/db';

describe('Notification Panel Server Actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getRestockNotifications', () => {
        it('should return notifications sorted by urgency', async () => {
            const mockNotifications = [
                {
                    id: 1,
                    productCode: 'MAT001',
                    productName: 'Product 1',
                    currentStock: 5,
                    recommendedStock: 100,
                    urgencyLevel: 'CRITICAL',
                    predictionId: 1,
                    isAcknowledged: 0,
                    acknowledgedAt: null,
                    createdAt: new Date()
                },
                {
                    id: 2,
                    productCode: 'MAT002',
                    productName: 'Product 2',
                    currentStock: 15,
                    recommendedStock: 100,
                    urgencyLevel: 'HIGH',
                    predictionId: 2,
                    isAcknowledged: 0,
                    acknowledgedAt: null,
                    createdAt: new Date()
                }
            ];

            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockReturnThis();
            const mockOrderBy = vi.fn().mockResolvedValue(mockNotifications);

            (db.select as any).mockReturnValue({
                from: mockFrom,
            });
            mockFrom.mockReturnValue({
                where: mockWhere,
            });
            mockWhere.mockReturnValue({
                orderBy: mockOrderBy,
            });

            const result = await getRestockNotifications();

            expect(result.success).toBe(true);
            expect(result.data).toEqual(mockNotifications);
            expect(result.totalCount).toBe(2);
            expect(result.countByUrgency).toEqual({
                critical: 1,
                high: 1,
                medium: 0
            });
        });

        it('should handle empty notifications', async () => {
            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockReturnThis();
            const mockOrderBy = vi.fn().mockResolvedValue([]);

            (db.select as any).mockReturnValue({
                from: mockFrom,
            });
            mockFrom.mockReturnValue({
                where: mockWhere,
            });
            mockWhere.mockReturnValue({
                orderBy: mockOrderBy,
            });

            const result = await getRestockNotifications();

            expect(result.success).toBe(true);
            expect(result.data).toEqual([]);
            expect(result.totalCount).toBe(0);
            expect(result.countByUrgency).toEqual({
                critical: 0,
                high: 0,
                medium: 0
            });
        });

        it('should handle errors gracefully', async () => {
            (db.select as any).mockImplementation(() => {
                throw new Error('Database error');
            });

            const result = await getRestockNotifications();

            expect(result.success).toBe(false);
            expect(result.error).toBe('Database error');
        });
    });

    describe('acknowledgeNotification', () => {
        it('should mark notification as acknowledged', async () => {
            const mockSet = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockResolvedValue(undefined);

            (db.update as any).mockReturnValue({
                set: mockSet,
            });
            mockSet.mockReturnValue({
                where: mockWhere,
            });

            const result = await acknowledgeNotification(1);

            expect(result.success).toBe(true);
            expect(result.message).toBe('Notification acknowledged successfully');
            expect(mockSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    isAcknowledged: 1,
                    acknowledgedAt: expect.any(Date)
                })
            );
        });

        it('should handle errors when acknowledging', async () => {
            (db.update as any).mockImplementation(() => {
                throw new Error('Update failed');
            });

            const result = await acknowledgeNotification(1);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Update failed');
        });
    });

    describe('getNotificationCount', () => {
        it('should return count of unacknowledged notifications', async () => {
            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockResolvedValue([{ count: 5 }]);

            (db.select as any).mockReturnValue({
                from: mockFrom,
            });
            mockFrom.mockReturnValue({
                where: mockWhere,
            });

            const result = await getNotificationCount();

            expect(result.success).toBe(true);
            expect(result.count).toBe(5);
        });

        it('should return 0 when no notifications exist', async () => {
            const mockSelect = vi.fn().mockReturnThis();
            const mockFrom = vi.fn().mockReturnThis();
            const mockWhere = vi.fn().mockResolvedValue([{ count: 0 }]);

            (db.select as any).mockReturnValue({
                from: mockFrom,
            });
            mockFrom.mockReturnValue({
                where: mockWhere,
            });

            const result = await getNotificationCount();

            expect(result.success).toBe(true);
            expect(result.count).toBe(0);
        });

        it('should handle errors and return 0', async () => {
            (db.select as any).mockImplementation(() => {
                throw new Error('Database error');
            });

            const result = await getNotificationCount();

            expect(result.success).toBe(false);
            expect(result.count).toBe(0);
        });
    });
});
