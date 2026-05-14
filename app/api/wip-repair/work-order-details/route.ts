import { NextResponse } from "next/server"

import { getWipRepairWorkOrderDetails } from "@/app/actions/wip-repair"
import { requireWipRepairApiKey } from "@/lib/api/wip-repair-auth"

export async function GET(request: Request) {
  const unauthorized = requireWipRepairApiKey(request)
  if (unauthorized) {
    return unauthorized
  }

  const data = await getWipRepairWorkOrderDetails()

  return NextResponse.json({
    data,
    meta: {
      count: data.length,
      source: "wip-repair-work-order-details",
    },
  })
}
