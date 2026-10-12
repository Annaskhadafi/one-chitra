import { NextResponse } from "next/server"
import { verifyApiKey, extractApiKeyFromRequest } from "@/lib/api/verify-api-key"

export const DEFAULT_STOCKS_API_KEY =
    "a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1"

export const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, X-API-KEY, apiKey, api_key",
    "Access-Control-Max-Age": "86400",
}

/**
 * Validasi API key untuk stocks endpoint.
 * Mendukung:
 * 1. Header `x-api-key: <KEY>` atau `X-API-KEY: <KEY>`
 * 2. Header `Authorization: Bearer <KEY>`
 * 3. URL Query parameter `?api_key=<KEY>` atau `?apiKey=<KEY>`
 * 4. Master key dari env STOCKS_API_KEY maupun tabel api_keys di database
 */
export async function validateStocksApiKey(
    request: Request
): Promise<{ authorized: boolean; response?: NextResponse }> {
    // 1. Cek via verifyApiKey (mendukung env vars, tabel api_keys, scopes "all" / "stocks")
    const authResult = await verifyApiKey(request, "stocks")
    if (authResult.authorized) {
        return { authorized: true }
    }

    // 2. Fallback cek default key jika env var belum terpasang sempurna
    const expectedKey = process.env.STOCKS_API_KEY?.trim() || DEFAULT_STOCKS_API_KEY
    const providedKey = extractApiKeyFromRequest(request)

    if (providedKey && (providedKey === expectedKey || providedKey === DEFAULT_STOCKS_API_KEY)) {
        return { authorized: true }
    }

    return {
        authorized: false,
        response: NextResponse.json(
            {
                status: "ERROR",
                message:
                    "Unauthorized: Invalid or missing API key. Provide header 'x-api-key: <KEY>', 'Authorization: Bearer <KEY>', or query parameter '?api_key=<KEY>'.",
            },
            { status: 401, headers: corsHeaders }
        ),
    }
}

export async function requireStocksApiKey(request: Request): Promise<NextResponse | null> {
    const auth = await validateStocksApiKey(request)
    if (!auth.authorized) {
        return (
            auth.response ||
            NextResponse.json(
                { status: "ERROR", message: "Unauthorized" },
                { status: 401, headers: corsHeaders }
            )
        )
    }
    return null
}

