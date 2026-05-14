import { NextResponse } from "next/server"

export function requireWipRepairApiKey(request: Request) {
  const expectedApiKey = process.env.WIP_REPAIR_API_KEY

  if (!expectedApiKey) {
    return NextResponse.json({ error: "WIP_REPAIR_API_KEY is not configured" }, { status: 503 })
  }

  const apiKey = request.headers.get("x-api-key")

  if (apiKey !== expectedApiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return null
}