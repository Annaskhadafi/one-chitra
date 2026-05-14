import { NextResponse } from "next/server"

import { getWipRepairData } from "@/app/actions/wip-repair"
import { requireWipRepairApiKey } from "@/lib/api/wip-repair-auth"

export async function GET(request: Request) {
  const unauthorized = requireWipRepairApiKey(request)
  if (unauthorized) {
    return unauthorized
  }

  const data = await getWipRepairData()

  return NextResponse.json({
    data,
    meta: {
      count: data.length,
      source: "wip-repair-table",
    },
  })
}
