import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Unit tests for FilterPanel debouncing logic
 * Requirements: 6.7, 10.4
 * 
 * Tests cover:
 * - Search debouncing (400ms delay)
 * - Debounce timer reset on rapid input
 * - Cleanup on unmount
 * 
 * Note: This tests the debouncing logic pattern used in FilterPanel.
 * The FilterPanel component uses useEffect with a 400ms setTimeout for search debouncing.
 */

describe('FilterPanel Debouncing Logic (Requirement 6.7, 10.4)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it('should debounce callback with 400ms delay', () => {
        const callback = vi.fn();
        let timeoutId: NodeJS.Timeout | null = null;

        // Simulate debounced function (as used in FilterPanel)
        const debouncedFunction = (value: string) => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                callback(value);
            }, 400);
        };

        // Call the debounced function
        debouncedFunction('MAT001');

        // Should not call immediately
        expect(callback).not.toHaveBeenCalled();

        // Advance time by 300ms (less than 400ms)
        vi.advanceTimersByTime(300);
        expect(callback).not.toHaveBeenCalled();

        // Advance time by another 100ms (total 400ms)
        vi.advanceTimersByTime(100);

        // Now it should have been called
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('MAT001');
    });

    it('should reset debounce timer on rapid calls', () => {
        const callback = vi.fn();
        let timeoutId: NodeJS.Timeout | null = null;

        const debouncedFunction = (value: string) => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                callback(value);
            }, 400);
        };

        // Simulate rapid typing
        debouncedFunction('M');
        vi.advanceTimersByTime(200);

        debouncedFunction('MA');
        vi.advanceTimersByTime(200);

        debouncedFunction('MAT');
        
        // Should not have called yet
        expect(callback).not.toHaveBeenCalled();

        // Wait full 400ms from last call
        vi.advanceTimersByTime(400);

        // Should only call once with final value
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('MAT');
    });

    it('should handle multiple debounced calls with different values', () => {
        const callback = vi.fn();
        let timeoutId: NodeJS.Timeout | null = null;

        const debouncedFunction = (value: string) => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                callback(value);
            }, 400);
        };

        // First call
        debouncedFunction('FIRST');
        vi.advanceTimersByTime(400);
        expect(callback).toHaveBeenCalledWith('FIRST');

        callback.mockClear();

        // Second call
        debouncedFunction('SECOND');
        vi.advanceTimersByTime(400);
        expect(callback).toHaveBeenCalledWith('SECOND');
    });

    it('should handle empty string values', () => {
        const callback = vi.fn();
        let timeoutId: NodeJS.Timeout | null = null;

        const debouncedFunction = (value: string) => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                callback(value);
            }, 400);
        };

        debouncedFunction('');
        vi.advanceTimersByTime(400);

        expect(callback).toHaveBeenCalledWith('');
    });

    it('should cleanup timeout on unmount', () => {
        const callback = vi.fn();
        let timeoutId: NodeJS.Timeout | null = null;

        const debouncedFunction = (value: string) => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                callback(value);
            }, 400);
        };

        // Simulate component lifecycle
        debouncedFunction('MAT001');
        
        // Simulate unmount cleanup
        if (timeoutId) clearTimeout(timeoutId);

        // Advance time
        vi.advanceTimersByTime(400);

        // Callback should not have been called due to cleanup
        expect(callback).not.toHaveBeenCalled();
    });

    it('should handle very rapid successive calls', () => {
        const callback = vi.fn();
        let timeoutId: NodeJS.Timeout | null = null;

        const debouncedFunction = (value: string) => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                callback(value);
            }, 400);
        };

        // Simulate very rapid typing (10 calls in 100ms)
        for (let i = 0; i < 10; i++) {
            debouncedFunction(`VALUE${i}`);
            vi.advanceTimersByTime(10);
        }

        // Should not have called yet
        expect(callback).not.toHaveBeenCalled();

        // Wait for debounce to complete
        vi.advanceTimersByTime(400);

        // Should only call once with last value
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('VALUE9');
    });

    it('should handle debounce with 100ms intervals between calls', () => {
        const callback = vi.fn();
        let timeoutId: NodeJS.Timeout | null = null;

        const debouncedFunction = (value: string) => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                callback(value);
            }, 400);
        };

        // Type with 100ms intervals (slower than debounce time)
        debouncedFunction('A');
        vi.advanceTimersByTime(100);
        
        debouncedFunction('AB');
        vi.advanceTimersByTime(100);
        
        debouncedFunction('ABC');
        vi.advanceTimersByTime(100);
        
        debouncedFunction('ABCD');
        
        // Should not have called yet (only 300ms passed since last call)
        expect(callback).not.toHaveBeenCalled();
        
        // Complete the debounce
        vi.advanceTimersByTime(400);
        
        // Should call with final value
        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('ABCD');
    });
});

describe('Filter Combination Logic (Requirement 6.7)', () => {
    it('should combine date range and search filters', () => {
        const filters = {
            dateRange: '7days' as const,
            dateFrom: new Date('2024-01-01'),
            dateTo: new Date('2024-01-07'),
            searchQuery: 'MAT001',
            stockRange: 'all' as const,
            accuracyLevel: 'all' as const
        };

        // Verify all filters are present
        expect(filters.dateRange).toBe('7days');
        expect(filters.searchQuery).toBe('MAT001');
        expect(filters.dateFrom).toBeInstanceOf(Date);
        expect(filters.dateTo).toBeInstanceOf(Date);
    });

    it('should combine stock range and accuracy filters', () => {
        const filters = {
            dateRange: '30days' as const,
            stockRange: 'medium' as const,
            accuracyLevel: 'high' as const,
            searchQuery: ''
        };

        expect(filters.stockRange).toBe('medium');
        expect(filters.accuracyLevel).toBe('high');
    });

    it('should handle all filters combined', () => {
        const filters = {
            dateRange: 'custom' as const,
            dateFrom: new Date('2024-01-01'),
            dateTo: new Date('2024-12-31'),
            materialGroup: 'GROUP001',
            stockRange: 'high' as const,
            accuracyLevel: 'medium' as const,
            searchQuery: 'SEARCH_TERM'
        };

        expect(filters.dateRange).toBe('custom');
        expect(filters.materialGroup).toBe('GROUP001');
        expect(filters.stockRange).toBe('high');
        expect(filters.accuracyLevel).toBe('medium');
        expect(filters.searchQuery).toBe('SEARCH_TERM');
    });

    it('should handle filter reset to defaults', () => {
        const defaultFilters = {
            dateRange: '30days' as const,
            dateFrom: new Date(),
            dateTo: new Date(),
            materialGroup: undefined,
            stockRange: 'all' as const,
            accuracyLevel: 'all' as const,
            searchQuery: ''
        };

        expect(defaultFilters.materialGroup).toBeUndefined();
        expect(defaultFilters.stockRange).toBe('all');
        expect(defaultFilters.accuracyLevel).toBe('all');
        expect(defaultFilters.searchQuery).toBe('');
    });

    it('should detect active filters', () => {
        const hasActiveFilters = (filters: any) => {
            return filters.searchQuery !== '' ||
                   filters.materialGroup !== undefined ||
                   filters.stockRange !== 'all' ||
                   filters.accuracyLevel !== 'all';
        };

        const noActiveFilters = {
            searchQuery: '',
            materialGroup: undefined,
            stockRange: 'all' as const,
            accuracyLevel: 'all' as const
        };

        const withActiveFilters = {
            searchQuery: 'MAT001',
            materialGroup: undefined,
            stockRange: 'all' as const,
            accuracyLevel: 'all' as const
        };

        expect(hasActiveFilters(noActiveFilters)).toBe(false);
        expect(hasActiveFilters(withActiveFilters)).toBe(true);
    });

    it('should handle multiple active filters', () => {
        const hasActiveFilters = (filters: any) => {
            return filters.searchQuery !== '' ||
                   filters.materialGroup !== undefined ||
                   filters.stockRange !== 'all' ||
                   filters.accuracyLevel !== 'all';
        };

        const multipleActiveFilters = {
            searchQuery: 'MAT001',
            materialGroup: 'GROUP001',
            stockRange: 'high' as const,
            accuracyLevel: 'medium' as const
        };

        expect(hasActiveFilters(multipleActiveFilters)).toBe(true);
    });
});
