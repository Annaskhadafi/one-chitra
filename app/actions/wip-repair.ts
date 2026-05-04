"use server"

import type {
  WipRepairApiResponse,
  WipRepairRecord,
  WipRepairWorkOrderDetailApiResponse,
  WipRepairWorkOrderDetailRecord,
} from "@/lib/types/wip-repair"
import { isVisibleWipRepairRecord, isVisibleWipRepairWorkOrderDetail } from "@/lib/wip-repair-visibility"
import { db } from "@/db"
import { salesRevenueSap } from "@/db/schema"
import { inArray, sql, or } from "drizzle-orm"
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

export type WipRepairInvoiceMapping = {
  noInv: string | null
  tanggalInvoice: string | null
}

export async function getWipRepairInvoiceMappings(woNumbers: string[]): Promise<Record<string, WipRepairInvoiceMapping>> {
  if (!woNumbers || woNumbers.length === 0) {
    return {}
  }

  try {
    const uniqueWos = Array.from(new Set(woNumbers)).filter(Boolean)
    
    // We will map based on workOrder or poNo in salesRevenueSap
    const records = await db.select({
      wo1: salesRevenueSap.workOrder,
      wo2: salesRevenueSap.poNo,
      noInv: sql<string>`MAX(${salesRevenueSap.billingNo})`,
      tanggalInvoice: sql<Date>`MAX(${salesRevenueSap.billingDate})`,
    })
    .from(salesRevenueSap)
    .where(
      or(
        inArray(salesRevenueSap.workOrder, uniqueWos),
        inArray(salesRevenueSap.poNo, uniqueWos)
      )
    )
    .groupBy(salesRevenueSap.workOrder, salesRevenueSap.poNo)

    const result: Record<string, WipRepairInvoiceMapping> = {}
    
    for (const record of records) {
      const formattedDate = record.tanggalInvoice ? new Date(record.tanggalInvoice).toISOString() : null
      
      // It might match workOrder or poNo
      if (record.wo1 && uniqueWos.includes(record.wo1)) {
        if (!result[record.wo1] || (formattedDate && (!result[record.wo1].tanggalInvoice || formattedDate > result[record.wo1].tanggalInvoice))) {
          result[record.wo1] = {
            noInv: record.noInv,
            tanggalInvoice: formattedDate
          }
        }
      }
      
      if (record.wo2 && uniqueWos.includes(record.wo2)) {
         if (!result[record.wo2] || (formattedDate && (!result[record.wo2].tanggalInvoice || formattedDate > result[record.wo2].tanggalInvoice))) {
          result[record.wo2] = {
            noInv: record.noInv,
            tanggalInvoice: formattedDate
          }
        }
      }
    }
    
    return result
  } catch (error) {
    console.error("Failed to load WIP Repair invoice mappings", error)
    return {}
  }
}
