import { NextResponse } from "next/server"
import { triggerApprovalRequestEvent } from "@/app/actions/approval"

export async function POST(request: Request) {
  const eventsSecret = process.env.APPROVAL_EVENTS_SECRET || process.env.CRON_SECRET
  if (eventsSecret) {
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${eventsSecret}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
  }

  let payload: {
    requestId?: string
    eventKey?: string
    eventValue?: unknown
  }

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const requestId = String(payload.requestId ?? "").trim()
  const eventKey = String(payload.eventKey ?? "").trim()

  if (!requestId || !eventKey) {
    return NextResponse.json(
      { success: false, error: "requestId and eventKey are required" },
      { status: 400 }
    )
  }

  const result = await triggerApprovalRequestEvent({
    requestId,
    eventKey,
    eventValue: payload.eventValue,
  })

  const status = result.success ? 200 : 400
  return NextResponse.json(result, { status })
}
