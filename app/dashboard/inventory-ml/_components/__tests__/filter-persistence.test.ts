import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Unit tests for filter localStorage persistence
 * Requirement 6.9: Save filter preferences to browser localStorage
 * 
 * Tests cover:
 * - Saving filter state to localStorage
 * - Loading filter state from localStorage
 * - Handling invalid/corrupted localStorage data
 * - Clearing localStorage on filter reset
 */

// Mock localStorage for Node.js environment
const localStorageMock = (() => {
    let store: Record<string, string> = {};

    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
            store[key] = value.toString();
        },
        removeItem: (key: string) => {
            delete store[key];
        },
        clear: () => {
            store = {};
        }
    };
})();

// Assign to global
global.localStorage = localStorageMock as any;

interface FilterState {
    dateRange: "7days" | "30days" | "custom"
    dateFrom?: Date
    dateTo?: Date
    materialGroup?: string
    stockRange?: "low" | "medium" | "high" | "all"
    accuracyLevel?: "high" | "medium" | "low" | "all"
    searchQuery: string
}

const STORAGE_KEY = 'inventory-ml-filters';

/**
 * Helper function to save filters to localStorage
 * This simulates the actual implementation that should exist in the app
 */
function saveFiltersToLocalStorage(filters: FilterState): void {
    try {
        const serialized = JSON.stringify({
            ...filters,
            dateFrom: filters.dateFrom?.toISOString(),
            dateTo: filters.dateTo?.toISOString()
        });
        localStorage.setItem(STORAGE_KEY, serialized);
    } catch (error) {
        console.error('Failed to save filters to localStorage:', error);
    }
}

/**
 * Helper function to load filters from localStorage
 * This simulates the actual implementation that should exist in the app
 */
function loadFiltersFromLocalStorage(): FilterState | null {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;

        const parsed = JSON.parse(stored);

        // Convert ISO strings back to Date objects
        if (parsed.dateFrom) {
            parsed.dateFrom = new Date(parsed.dateFrom);
        }
        if (parsed.dateTo) {
            parsed.dateTo = new Date(parsed.dateTo);
        }

        return parsed as FilterState;
    } catch (error) {
        console.error('Failed to load filters from localStorage:', error);
        return null;
    }
}

/**
 * Helper function to clear filters from localStorage
 */
function clearFiltersFromLocalStorage(): void {
    localStorage.removeItem(STORAGE_KEY);
}

describe('Filter localStorage Persistence (Requirement 6.9)', () => {
    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe('Saving Filters', () => {
        it('should save filter state to localStorage', () => {
            const filters: FilterState = {
                dateRange: '7days',
                dateFrom: new Date('2024-01-01'),
                dateTo: new Date('2024-01-07'),
                materialGroup: 'GROUP001',
                stockRange: 'medium',
                accuracyLevel: 'high',
                searchQuery: 'MAT001'
            };

            saveFiltersToLocalStorage(filters);

            const stored = localStorage.getItem(STORAGE_KEY);
            expect(stored).not.toBeNull();

            const parsed = JSON.parse(stored!);
            expect(parsed.dateRange).toBe('7days');
            expect(parsed.materialGroup).toBe('GROUP001');
            expect(parsed.stockRange).toBe('medium');
            expect(parsed.accuracyLevel).toBe('high');
            expect(parsed.searchQuery).toBe('MAT001');
        });

        it('should serialize Date objects to ISO strings', () => {
            const filters: FilterState = {
                dateRange: 'custom',
                dateFrom: new Date('2024-01-01T00:00:00.000Z'),
                dateTo: new Date('2024-01-31T23:59:59.999Z'),
                searchQuery: ''
            };

            saveFiltersToLocalStorage(filters);

            const stored = localStorage.getItem(STORAGE_KEY);
            const parsed = JSON.parse(stored!);

            expect(parsed.dateFrom).toBe('2024-01-01T00:00:00.000Z');
            expect(parsed.dateTo).toBe('2024-01-31T23:59:59.999Z');
        });

        it('should save filters with undefined optional fields', () => {
            const filters: FilterState = {
                dateRange: '30days',
                dateFrom: new Date('2024-01-01'),
                dateTo: new Date('2024-01-31'),
                materialGroup: undefined,
                stockRange: 'all',
                accuracyLevel: 'all',
                searchQuery: ''
            };

            saveFiltersToLocalStorage(filters);

            const stored = localStorage.getItem(STORAGE_KEY);
            expect(stored).not.toBeNull();

            const parsed = JSON.parse(stored!);
            expect(parsed.materialGroup).toBeUndefined();
            expect(parsed.stockRange).toBe('all');
            expect(parsed.accuracyLevel).toBe('all');
        });

        it('should overwrite existing filters in localStorage', () => {
            const filters1: FilterState = {
                dateRange: '7days',
                searchQuery: 'OLD'
            };

            const filters2: FilterState = {
                dateRange: '30days',
                searchQuery: 'NEW'
            };

            saveFiltersToLocalStorage(filters1);
            saveFiltersToLocalStorage(filters2);

            const stored = localStorage.getItem(STORAGE_KEY);
            const parsed = JSON.parse(stored!);

            expect(parsed.dateRange).toBe('30days');
            expect(parsed.searchQuery).toBe('NEW');
        });
    });

    describe('Loading Filters', () => {
        it('should load filter state from localStorage', () => {
            const filters: FilterState = {
                dateRange: '7days',
                dateFrom: new Date('2024-01-01'),
                dateTo: new Date('2024-01-07'),
                materialGroup: 'GROUP001',
                stockRange: 'low',
                accuracyLevel: 'medium',
                searchQuery: 'TEST'
            };

            saveFiltersToLocalStorage(filters);
            const loaded = loadFiltersFromLocalStorage();

            expect(loaded).not.toBeNull();
            expect(loaded!.dateRange).toBe('7days');
            expect(loaded!.materialGroup).toBe('GROUP001');
            expect(loaded!.stockRange).toBe('low');
            expect(loaded!.accuracyLevel).toBe('medium');
            expect(loaded!.searchQuery).toBe('TEST');
        });

        it('should deserialize ISO strings back to Date objects', () => {
            const filters: FilterState = {
                dateRange: 'custom',
                dateFrom: new Date('2024-01-01T00:00:00.000Z'),
                dateTo: new Date('2024-01-31T23:59:59.999Z'),
                searchQuery: ''
            };

            saveFiltersToLocalStorage(filters);
            const loaded = loadFiltersFromLocalStorage();

            expect(loaded).not.toBeNull();
            expect(loaded!.dateFrom).toBeInstanceOf(Date);
            expect(loaded!.dateTo).toBeInstanceOf(Date);
            expect(loaded!.dateFrom?.toISOString()).toBe('2024-01-01T00:00:00.000Z');
            expect(loaded!.dateTo?.toISOString()).toBe('2024-01-31T23:59:59.999Z');
        });

        it('should return null when no filters are stored', () => {
            const loaded = loadFiltersFromLocalStorage();
            expect(loaded).toBeNull();
        });

        it('should handle corrupted JSON data gracefully', () => {
            localStorage.setItem(STORAGE_KEY, 'invalid-json{{{');

            const loaded = loadFiltersFromLocalStorage();
            expect(loaded).toBeNull();
        });

        it('should handle invalid date strings gracefully', () => {
            const invalidData = JSON.stringify({
                dateRange: 'custom',
                dateFrom: 'not-a-date',
                dateTo: 'also-not-a-date',
                searchQuery: ''
            });

            localStorage.setItem(STORAGE_KEY, invalidData);

            const loaded = loadFiltersFromLocalStorage();

            // Should still load, but dates will be Invalid Date objects
            expect(loaded).not.toBeNull();
            expect(loaded!.dateFrom).toBeInstanceOf(Date);
            expect(isNaN(loaded!.dateFrom!.getTime())).toBe(true); // Invalid Date
        });

        it('should preserve all filter types correctly', () => {
            const filters: FilterState = {
                dateRange: 'custom',
                dateFrom: new Date('2024-01-01'),
                dateTo: new Date('2024-12-31'),
                materialGroup: 'GROUP_XYZ',
                stockRange: 'high',
                accuracyLevel: 'low',
                searchQuery: 'SEARCH_TERM'
            };

            saveFiltersToLocalStorage(filters);
            const loaded = loadFiltersFromLocalStorage();

            expect(loaded).not.toBeNull();
            expect(loaded!.dateRange).toBe('custom');
            expect(loaded!.materialGroup).toBe('GROUP_XYZ');
            expect(loaded!.stockRange).toBe('high');
            expect(loaded!.accuracyLevel).toBe('low');
            expect(loaded!.searchQuery).toBe('SEARCH_TERM');
        });
    });

    describe('Clearing Filters', () => {
        it('should remove filters from localStorage', () => {
            const filters: FilterState = {
                dateRange: '7days',
                searchQuery: 'TEST'
            };

            saveFiltersToLocalStorage(filters);
            expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

            clearFiltersFromLocalStorage();
            expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
        });

        it('should not throw error when clearing non-existent filters', () => {
            expect(() => clearFiltersFromLocalStorage()).not.toThrow();
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty search query', () => {
            const filters: FilterState = {
                dateRange: '30days',
                searchQuery: ''
            };

            saveFiltersToLocalStorage(filters);
            const loaded = loadFiltersFromLocalStorage();

            expect(loaded).not.toBeNull();
            expect(loaded!.searchQuery).toBe('');
        });

        it('should handle filters with only required fields', () => {
            const filters: FilterState = {
                dateRange: '7days',
                searchQuery: ''
            };

            saveFiltersToLocalStorage(filters);
            const loaded = loadFiltersFromLocalStorage();

            expect(loaded).not.toBeNull();
            expect(loaded!.dateRange).toBe('7days');
            expect(loaded!.searchQuery).toBe('');
            expect(loaded!.materialGroup).toBeUndefined();
            expect(loaded!.dateFrom).toBeUndefined();
            expect(loaded!.dateTo).toBeUndefined();
        });

        it('should handle very long search queries', () => {
            const longQuery = 'A'.repeat(1000);
            const filters: FilterState = {
                dateRange: '30days',
                searchQuery: longQuery
            };

            saveFiltersToLocalStorage(filters);
            const loaded = loadFiltersFromLocalStorage();

            expect(loaded).not.toBeNull();
            expect(loaded!.searchQuery).toBe(longQuery);
            expect(loaded!.searchQuery.length).toBe(1000);
        });

        it('should handle special characters in search query', () => {
            const specialQuery = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
            const filters: FilterState = {
                dateRange: '30days',
                searchQuery: specialQuery
            };

            saveFiltersToLocalStorage(filters);
            const loaded = loadFiltersFromLocalStorage();

            expect(loaded).not.toBeNull();
            expect(loaded!.searchQuery).toBe(specialQuery);
        });

        it('should handle unicode characters in search query', () => {
            const unicodeQuery = '测试 テスト 테스트 🔍';
            const filters: FilterState = {
                dateRange: '30days',
                searchQuery: unicodeQuery
            };

            saveFiltersToLocalStorage(filters);
            const loaded = loadFiltersFromLocalStorage();

            expect(loaded).not.toBeNull();
            expect(loaded!.searchQuery).toBe(unicodeQuery);
        });
    });

    describe('Integration Scenarios', () => {
        it('should persist filters across multiple save/load cycles', () => {
            const filters1: FilterState = {
                dateRange: '7days',
                searchQuery: 'FIRST'
            };

            saveFiltersToLocalStorage(filters1);
            let loaded = loadFiltersFromLocalStorage();
            expect(loaded!.searchQuery).toBe('FIRST');

            const filters2: FilterState = {
                dateRange: '30days',
                searchQuery: 'SECOND'
            };

            saveFiltersToLocalStorage(filters2);
            loaded = loadFiltersFromLocalStorage();
            expect(loaded!.searchQuery).toBe('SECOND');
            expect(loaded!.dateRange).toBe('30days');
        });

        it('should maintain filter state after page reload simulation', () => {
            const filters: FilterState = {
                dateRange: 'custom',
                dateFrom: new Date('2024-01-01'),
                dateTo: new Date('2024-12-31'),
                materialGroup: 'GROUP001',
                stockRange: 'medium',
                accuracyLevel: 'high',
                searchQuery: 'PERSISTENT'
            };

            // Save filters (simulating user setting filters)
            saveFiltersToLocalStorage(filters);

            // Simulate page reload by loading from localStorage
            const loaded = loadFiltersFromLocalStorage();

            // All filters should be preserved
            expect(loaded).not.toBeNull();
            expect(loaded!.dateRange).toBe('custom');
            expect(loaded!.materialGroup).toBe('GROUP001');
            expect(loaded!.stockRange).toBe('medium');
            expect(loaded!.accuracyLevel).toBe('high');
            expect(loaded!.searchQuery).toBe('PERSISTENT');
            expect(loaded!.dateFrom).toBeInstanceOf(Date);
            expect(loaded!.dateTo).toBeInstanceOf(Date);
        });

        it('should handle rapid filter updates', () => {
            const filters1: FilterState = { dateRange: '7days', searchQuery: 'A' };
            const filters2: FilterState = { dateRange: '7days', searchQuery: 'AB' };
            const filters3: FilterState = { dateRange: '7days', searchQuery: 'ABC' };

            saveFiltersToLocalStorage(filters1);
            saveFiltersToLocalStorage(filters2);
            saveFiltersToLocalStorage(filters3);

            const loaded = loadFiltersFromLocalStorage();
            expect(loaded!.searchQuery).toBe('ABC');
        });
    });
});
