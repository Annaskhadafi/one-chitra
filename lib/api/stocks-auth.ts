import { NextResponse } from "next/server"

export function requireStocksApiKey(request: Request) {
    const expectedApiKey = process.env.STOCKS_API_KEY

    if (!expectedApiKey) {
        return NextResponse.json(
            { status: "ERROR", message: "STOCKS_API_KEY is not configured" },
            { status: 503 }
        )
    }

    const apiKey = request.headers.get("x-api-key")

    if (apiKey !== expectedApiKey) {
        return NextResponse.json(
            { status: "ERROR", message: "Unauthorized" },
            { status: 401 }
        )
    }

    return null
}
