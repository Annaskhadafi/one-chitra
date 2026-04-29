"use server"

import type {
  WipRepairApiResponse,
  WipRepairRecord,
  WipRepairWorkOrderDetailApiResponse,
  WipRepairWorkOrderDetailRecord,
} from "@/lib/types/wip-repair"
import { isVisibleWipRepairRecord, isVisibleWipRepairWorkOrderDetail } from "@/lib/wip-repair-visibility"

const WIP_REPAIR_API_URL =
  process.env.WIP_REPAIR_API_URL ??
  "https://ics.chitraparatama.co.id/product/get_api.php?function=wo_repair"

const WIP_REPAIR_WORK_ORDER_DETAIL_API_URL =
  process.env.WIP_REPAIR_WORK_ORDER_DETAIL_API_URL ??
  "https://ics.chitraparatama.co.id/product/get_api.php?function=repair_work_order_detail_material"

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

    return payload.data.filter(isVisibleWipRepairRecord)
  } catch (error) {
    console.error("Failed to load WIP Repair data", error)
    return []
  }
}

export async function getWipRepairWorkOrderDetails(): Promise<WipRepairWorkOrderDetailRecord[]> {
  try {
    const response = await fetch(WIP_REPAIR_WORK_ORDER_DETAIL_API_URL, {
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch WIP Repair WO detail data: ${response.status}`)
    }

    const payload = (await response.json()) as WipRepairWorkOrderDetailApiResponse

    if (!payload || !Array.isArray(payload.data)) {
      return []
    }

    return payload.data.filter(isVisibleWipRepairWorkOrderDetail)
  } catch (error) {
    console.error("Failed to load WIP Repair WO detail data", error)
    return []
  }
}
