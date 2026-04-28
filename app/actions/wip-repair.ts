"use server"

import type { WipRepairApiResponse, WipRepairRecord } from "@/lib/types/wip-repair"

const WIP_REPAIR_API_URL =
  process.env.WIP_REPAIR_API_URL ??
  "https://ics.chitraparatama.co.id/product/get_api.php?function=wo_repair"

export async function getWipRepairData(): Promise<WipRepairRecord[]> {
  try {
    const response = await fetch(WIP_REPAIR_API_URL, {
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch WIP Repair data: ${response.status}`)
    }

    const payload = (await response.json()) as WipRepairApiResponse

    if (!payload || !Array.isArray(payload.data)) {
      return []
    }

    return payload.data
  } catch (error) {
    console.error("Failed to load WIP Repair data", error)
    return []
  }
}
