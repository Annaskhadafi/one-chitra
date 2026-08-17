import { NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { db } from "@/db"
import { apiKeys } from "@/db/schema/api-keys"

export type ApiScope = "all" | "stocks" | "sales-revenue" | "wip-repair" | "rfid" | "ocr" | "openapi"

export interface VerifyApiKeyResult {
    authorized: boolean
    keyName?: string
    scopes?: string[]
    source?: "env" | "db"
    response?: NextResponse
}

/**
 * Ekstrak API key dari berbagai sumber (Header / Query)
 */
export function extractApiKeyFromRequest(request: Request): string | null {
    // 1. Header Authorization: Bearer <key>
    const authHeader = request.headers.get("authorization")
    if (authHeader) {
        const bearer = authHeader.replace(/^Bearer\s+/i, "").trim()
        if (bearer) return bearer
    }

    // 2. Header x-api-key / X-API-KEY
    const apiKeyHeader = request.headers.get("x-api-key")?.trim() || request.headers.get("X-API-KEY")?.trim()
    if (apiKeyHeader) return apiKeyHeader

    // 3. Query Param ?api_key=... / ?apiKey=...
    try {
        const url = new URL(request.url)
        const queryKey = url.searchParams.get("api_key")?.trim() || url.searchParams.get("apiKey")?.trim()
        if (queryKey) return queryKey
    } catch {
        // Ignore URL parsing error
    }

    return null
}

/**
 * Validasi API key terhadap Environment Variables dan Database Table api_keys
 */
export async function verifyApiKey(
    request: Request,
    requiredScope: ApiScope = "all",
): Promise<VerifyApiKeyResult> {
    const providedKey = extractApiKeyFromRequest(request)

    if (!providedKey) {
        return {
            authorized: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        }
    }

    // 1. Cek Environment Variables (Master Keys)
    const envKeys: Record<string, ApiScope[]> = {}
    if (process.env.WIP_REPAIR_API_KEY) envKeys[process.env.WIP_REPAIR_API_KEY.trim()] = ["all", "wip-repair", "openapi"]
    if (process.env.STOCKS_API_KEY) envKeys[process.env.STOCKS_API_KEY.trim()] = ["all", "stocks", "openapi"]
    if (process.env.SALES_REVENUE_API_KEY) envKeys[process.env.SALES_REVENUE_API_KEY.trim()] = ["all", "sales-revenue", "openapi"]
    if (process.env.EXTERNAL_API_KEY) envKeys[process.env.EXTERNAL_API_KEY.trim()] = ["all", "openapi"]
    if (process.env.RFID_API_KEY) envKeys[process.env.RFID_API_KEY.trim()] = ["all", "rfid", "openapi"]
    // Default SAP Revenue API Key
    envKeys["och_sap_6fd98d6a2b26388f261aa6825f06bbd12cf8dcea16fe5ee1153d29f2d957bfef"] = ["all", "sales-revenue", "openapi"]

    if (envKeys[providedKey]) {
        const scopes = envKeys[providedKey]
        if (requiredScope === "all" || scopes.includes("all") || scopes.includes(requiredScope)) {
            return {
                authorized: true,
                keyName: "Master Env Key",
                scopes,
                source: "env",
            }
        }
    }

    // 2. Cek Database Table api_keys
    try {
        const record = await db.query.apiKeys.findFirst({
            where: and(
                eq(apiKeys.key, providedKey),
                eq(apiKeys.isActive, true),
            ),
        })

        if (record) {
            // Cek expiration date
            if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
                return {
                    authorized: false,
                    response: NextResponse.json(
                        {
                            status: "ERROR",
                            error: "Unauthorized",
                            message: "API key has expired",
                        },
                        { status: 401 },
                    ),
                }
            }

            // Cek scopes
            const recordScopes = record.scopes || ["all"]
            const hasScope =
                requiredScope === "all" ||
                recordScopes.includes("all") ||
                recordScopes.includes(requiredScope)

            if (!hasScope) {
                return {
                    authorized: false,
                    response: NextResponse.json(
                        {
                            status: "ERROR",
                            error: "Forbidden",
                            message: `API key does not have required '${requiredScope}' permission`,
                        },
                        { status: 403 },
                    ),
                }
            }

            // Update lastUsedAt secara background asynchronous tanpa memblokir request
            db.update(apiKeys)
                .set({ lastUsedAt: new Date() })
                .where(eq(apiKeys.id, record.id))
                .catch((err) => console.error("Failed to update api key lastUsedAt:", err))

            return {
                authorized: true,
                keyName: record.name,
                scopes: recordScopes,
                source: "db",
            }
        }
    } catch (dbError) {
        console.warn("Database lookup error during API key verification:", dbError)
    }

    return {
        authorized: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
}
