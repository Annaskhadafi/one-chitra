import { NextResponse } from "next/server"

// Default Bearer / API key jika belum di-override di environment variable
export const DEFAULT_SALES_REVENUE_API_KEY =
  "och_sap_6fd98d6a2b26388f261aa6825f06bbd12cf8dcea16fe5ee1153d29f2d957bfef"

export function validateSalesRevenueApiKey(request: Request): { authorized: boolean; response?: NextResponse } {
  const expectedKey =
    process.env.SALES_REVENUE_API_KEY?.trim() ||
    process.env.EXTERNAL_API_KEY?.trim() ||
    DEFAULT_SALES_REVENUE_API_KEY

  // 1. Cek Header Authorization: Bearer <token>
  const authHeader = request.headers.get("authorization")
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, "").trim()

  // 2. Cek Header x-api-key / X-API-KEY
  const apiKeyHeader = request.headers.get("x-api-key")?.trim() || request.headers.get("X-API-KEY")?.trim()

  // 3. Cek Query Param ?api_key=... / ?apiKey=...
  let queryApiKey: string | undefined
  try {
    const url = new URL(request.url)
    queryApiKey = url.searchParams.get("api_key")?.trim() || url.searchParams.get("apiKey")?.trim() || undefined
  } catch {
    // ignore URL parsing error
  }

  const providedKey = bearerToken || apiKeyHeader || queryApiKey

  if (!providedKey || providedKey !== expectedKey) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          status: "ERROR",
          message: "Unauthorized: Invalid or missing Bearer token / API key. Provide header 'Authorization: Bearer <KEY>' or 'x-api-key: <KEY>' or '?api_key=<KEY>'.",
        },
        { status: 401 }
      ),
    }
  }

  return { authorized: true }
}
