"use server"

import { getAuthenticatedSession } from "@/lib/rbac"
import { getAllowedWarehouseIdsForCurrentUser } from "@/lib/warehouse-access"
import {
    getStockCardCatalog,
    getStockCardDetail,
    getStockCardLabelsByIds,
} from "@/lib/stock-card"

export async function getStockCardCatalogAction() {
    await getAuthenticatedSession("stocks", "view")
    const allowedWarehouseIds = await getAllowedWarehouseIdsForCurrentUser("view")
    return getStockCardCatalog(allowedWarehouseIds)
}

export async function getStockCardLabelsByIdsAction(stockIds: number[]) {
    await getAuthenticatedSession("stocks", "view")
    const allowedWarehouseIds = await getAllowedWarehouseIdsForCurrentUser("view")
    return getStockCardLabelsByIds(stockIds, allowedWarehouseIds)
}

export async function getStockCardDetailAction(stockId: number) {
    await getAuthenticatedSession("stocks", "view")
    return getStockCardDetail(stockId)
}
