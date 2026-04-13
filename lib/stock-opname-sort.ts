import type { StockOpnameItem } from "@/lib/types"

export type StockOpnameSortKey =
    | "default"
    | "materialNumber"
    | "materialDescription"
    | "category"
    | "systemQty"
    | "countedQty"
    | "variance"
    | "notes"
    | "status"

export type StockOpnameSortOrder = "asc" | "desc"

export const DEFAULT_STOCK_OPNAME_SORT_KEY: StockOpnameSortKey = "default"
export const DEFAULT_STOCK_OPNAME_SORT_ORDER: StockOpnameSortOrder = "asc"

function normalizeText(value: string | null | undefined) {
    return (value ?? "").trim().toLowerCase()
}

function getItemStatus(item: StockOpnameItem) {
    const isCounted = item.countedQty !== null
    const hasVariance = item.variance !== null && item.variance !== 0

    if (!isCounted) return "Belum"
    if (hasVariance) return "Selisih"
    return "OK"
}

function compareNullableNumber(left: number | null | undefined, right: number | null | undefined) {
    const leftMissing = left === null || left === undefined
    const rightMissing = right === null || right === undefined

    if (leftMissing && rightMissing) return 0
    if (leftMissing) return 1
    if (rightMissing) return -1

    return left - right
}

function compareText(left: string | null | undefined, right: string | null | undefined) {
    return normalizeText(left).localeCompare(normalizeText(right), undefined, {
        sensitivity: "base",
        numeric: true,
    })
}

export function isStockOpnameSortKey(value: string | null | undefined): value is StockOpnameSortKey {
    return [
        "default",
        "materialNumber",
        "materialDescription",
        "category",
        "systemQty",
        "countedQty",
        "variance",
        "notes",
        "status",
    ].includes(value ?? "")
}

export function isStockOpnameSortOrder(value: string | null | undefined): value is StockOpnameSortOrder {
    return value === "asc" || value === "desc"
}

export function parseStockOpnameSortKey(value: string | string[] | undefined): StockOpnameSortKey {
    const normalized = Array.isArray(value) ? value[0] : value
    return isStockOpnameSortKey(normalized) ? normalized : DEFAULT_STOCK_OPNAME_SORT_KEY
}

export function parseStockOpnameSortOrder(value: string | string[] | undefined): StockOpnameSortOrder {
    const normalized = Array.isArray(value) ? value[0] : value
    return isStockOpnameSortOrder(normalized) ? normalized : DEFAULT_STOCK_OPNAME_SORT_ORDER
}

export function sortStockOpnameItems(
    items: StockOpnameItem[],
    sortKey: StockOpnameSortKey,
    sortOrder: StockOpnameSortOrder,
) {
    const direction = sortOrder === "asc" ? 1 : -1

    return items
        .map((item, originalIndex) => ({ item, originalIndex }))
        .sort((left, right) => {
            let comparison = 0

            switch (sortKey) {
                case "materialNumber":
                    comparison = compareText(left.item.product?.materialNumber, right.item.product?.materialNumber)
                    break
                case "materialDescription":
                    comparison = compareText(left.item.product?.materialDescription, right.item.product?.materialDescription)
                    break
                case "category":
                    comparison = compareText(left.item.product?.category, right.item.product?.category)
                    break
                case "systemQty":
                    comparison = compareNullableNumber(left.item.systemQty, right.item.systemQty)
                    break
                case "countedQty":
                    comparison = compareNullableNumber(left.item.countedQty, right.item.countedQty)
                    break
                case "variance":
                    comparison = compareNullableNumber(left.item.variance, right.item.variance)
                    break
                case "notes":
                    comparison = compareText(left.item.notes, right.item.notes)
                    break
                case "status":
                    comparison = compareText(getItemStatus(left.item), getItemStatus(right.item))
                    break
                case "default":
                default:
                    comparison = left.originalIndex - right.originalIndex
                    break
            }

            if (comparison !== 0) {
                return comparison * direction
            }

            return left.originalIndex - right.originalIndex
        })
        .map(({ item }) => item)
}
