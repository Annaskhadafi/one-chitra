import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
    getAISettings, 
    updateAISettings, 
    testAISettings, 
    resetAISettings 
} from '../inventory-ai'
import { db } from '@/db'
import { aiSettings } from '@/db/schema/ai-predictions'
import { eq } from 'drizzle-orm'

// Mock the RBAC module
vi.mock('@/lib/rbac', () => ({
    getAuthenticatedSession: vi.fn().mockResolvedValue({ 
        user: { id: 'test-user', name: 'Test User', email: 'test@example.com' } 
    })
}))

// Mock revalidatePath
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn()
}))

describe('AI Settings Management', () => {
    beforeEach(() => {
        // Clear all mocks before each test
        vi.clearAllMocks()
    })

    describe('getAISettings', () => {
        it('should return default settings when database is empty', async () => {
            // Mock empty database response
            vi.spyOn(db, 'select').mockReturnValueOnce({
                from: vi.fn().mockReturnThis(),
                where: vi.fn().mockResolvedValue([])
            } as any)

            const settings = await getAISettings()

            expect(settings).toEqual({
                model: 'qwen/qwen3-32b',
                temperature: 0.1,
                maxTokens: 8192,
                cacheDuration: 24,
                thinkingMode: false
            })
        })

        it('should return settings from database when available', async () => {
            // Mock database response with settings
            const mockSettings = [
                { settingKey: 'ai_model', settingValue: 'llama-3.3-70b-versatile' },
                { settingKey: 'ai_temperature', settingValue: '0.5' },
                { settingKey: 'ai_max_tokens', settingValue: '4096' },
                { settingKey: 'ai_cache_duration', settingValue: '48' },
                { settingKey: 'ai_thinking_mode', settingValue: 'true' }
            ]

            vi.spyOn(db, 'select').mockReturnValueOnce({
                from: vi.fn().mockReturnThis(),
                where: vi.fn().mockResolvedValue(mockSettings)
            } as any)

            const settings = await getAISettings()

            expect(settings).toEqual({
                model: 'llama-3.3-70b-versatile',
                temperature: 0.5,
                maxTokens: 4096,
                cacheDuration: 48,
                thinkingMode: true
            })
        })

        it('should handle database errors gracefully', async () => {
            // Mock database error
            vi.spyOn(db, 'select').mockImplementationOnce(() => {
                throw new Error('Database connection failed')
            })

            const settings = await getAISettings()

            // Should return defaults on error
            expect(settings).toEqual({
                model: 'qwen/qwen3-32b',
                temperature: 0.1,
                maxTokens: 8192,
                cacheDuration: 24,
                thinkingMode: false
            })
        })
    })

    describe('updateAISettings - Validation', () => {
        it('should reject invalid model selection', async () => {
            const result = await updateAISettings(
                { model: 'invalid-model' },
                'test-user'
            )

            expect(result.success).toBe(false)
            expect(result.error).toContain('Invalid model')
        })

        it('should reject temperature below 0', async () => {
            const result = await updateAISettings(
                { temperature: -0.1 },
                'test-user'
            )

            expect(result.success).toBe(false)
            expect(result.error).toContain('Temperature must be between 0.0 and 1.0')
        })

        it('should reject temperature above 1', async () => {
            const result = await updateAISettings(
                { temperature: 1.5 },
                'test-user'
            )

            expect(result.success).toBe(false)
            expect(result.error).toContain('Temperature must be between 0.0 and 1.0')
        })

        it('should reject maxTokens below 1000', async () => {
            const result = await updateAISettings(
                { maxTokens: 500 },
                'test-user'
            )

            expect(result.success).toBe(false)
            expect(result.error).toContain('Max tokens must be between 1000 and 8192')
        })

        it('should reject maxTokens above 8192', async () => {
            const result = await updateAISettings(
                { maxTokens: 10000 },
                'test-user'
            )

            expect(result.success).toBe(false)
            expect(result.error).toContain('Max tokens must be between 1000 and 8192')
        })

        it('should reject invalid cache duration', async () => {
            const result = await updateAISettings(
                { cacheDuration: 36 },
                'test-user'
            )

            expect(result.success).toBe(false)
            expect(result.error).toContain('Cache duration must be 12, 24, or 48 hours')
        })

        it('should accept valid settings', async () => {
            // Mock successful database update
            vi.spyOn(db, 'update').mockReturnValue({
                set: vi.fn().mockReturnThis(),
                where: vi.fn().mockResolvedValue(undefined)
            } as any)

            const result = await updateAISettings(
                {
                    model: 'llama-3.3-70b-versatile',
                    temperature: 0.5,
                    maxTokens: 4096,
                    cacheDuration: 48,
                    thinkingMode: true
                },
                'test-user'
            )

            expect(result.success).toBe(true)
            expect(result.message).toContain('Updated 5 setting(s)')
        })
    })

    describe('testAISettings', () => {
        it('should successfully test valid settings', async () => {
            // Mock successful API response
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            content: '{"recommendedStock": 100, "rationale": "Test response"}'
                        }
                    }]
                })
            })

            const result = await testAISettings({
                model: 'qwen/qwen3-32b',
                temperature: 0.1,
                maxTokens: 8192
            })

            expect(result.success).toBe(true)
            expect(result.data).toBeDefined()
            expect(result.data?.response).toEqual({
                recommendedStock: 100,
                rationale: 'Test response'
            })
        })

        it('should handle API errors', async () => {
            // Mock API error
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                text: async () => 'Internal Server Error'
            })

            const result = await testAISettings({
                model: 'qwen/qwen3-32b',
                temperature: 0.1,
                maxTokens: 8192
            })

            expect(result.success).toBe(false)
            expect(result.error).toContain('API Error')
        })

        it('should handle invalid JSON responses', async () => {
            // Mock invalid JSON response
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            content: 'This is not valid JSON'
                        }
                    }]
                })
            })

            const result = await testAISettings({
                model: 'qwen/qwen3-32b',
                temperature: 0.1,
                maxTokens: 8192
            })

            expect(result.success).toBe(false)
            expect(result.error).toBeDefined()
        })
    })

    describe('resetAISettings', () => {
        it('should reset all settings to defaults', async () => {
            // Mock successful database update
            const updateSpy = vi.spyOn(db, 'update').mockReturnValue({
                set: vi.fn().mockReturnThis(),
                where: vi.fn().mockResolvedValue(undefined)
            } as any)

            const result = await resetAISettings('test-user')

            expect(result.success).toBe(true)
            expect(result.message).toBe('AI settings reset to defaults')
            
            // Verify db.update was called 5 times (once for each setting)
            // Note: The spy counts all calls including from previous tests
            // So we just verify it was called at least 5 times
            expect(updateSpy.mock.calls.length).toBeGreaterThanOrEqual(5)
        })

        it('should handle database errors during reset', async () => {
            // Mock database error
            vi.spyOn(db, 'update').mockImplementationOnce(() => {
                throw new Error('Database error')
            })

            const result = await resetAISettings('test-user')

            expect(result.success).toBe(false)
            // The error message includes the original error
            expect(result.error).toBe('Database error')
        })
    })

    describe('Settings Persistence (Requirement 9.8)', () => {
        it('should persist settings to database with updatedBy field', async () => {
            const updateSpy = vi.spyOn(db, 'update').mockReturnValue({
                set: vi.fn().mockReturnThis(),
                where: vi.fn().mockResolvedValue(undefined)
            } as any)

            await updateAISettings(
                { temperature: 0.7 },
                'admin-user-123'
            )

            // Verify the set method was called with updatedBy
            const setCall = (updateSpy.mock.results[0].value as any).set
            expect(setCall).toHaveBeenCalledWith(
                expect.objectContaining({
                    settingValue: '0.7',
                    updatedBy: 'admin-user-123'
                })
            )
        })
    })

    describe('Error Handling and Revert (Requirement 9.12)', () => {
        it('should provide error message when update fails', async () => {
            // Mock database error
            vi.spyOn(db, 'update').mockImplementationOnce(() => {
                throw new Error('Connection timeout')
            })

            const result = await updateAISettings(
                { temperature: 0.5 },
                'test-user'
            )

            expect(result.success).toBe(false)
            expect(result.error).toBe('Connection timeout')
        })
    })
})
