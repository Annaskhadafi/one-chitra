type CustomerLike = {
    name?: string | null
    customerCode?: string | null
} | null | undefined

export type CkMasterPriceReference = {
    materialNumberCp?: string | null
    materialNumberCk?: string | null
    warehouseId: number
    price: string | number
}

export type CkMasterPriceProductReference = {
    materialNumber?: string | null
    materialNumberCk?: string | null
}

export type CkMasterPriceSuggestion = {
    unitPrice: number
    source: "warehouse" | "shared" | "default"
    matchedWarehouseId: number | null
}

function normalizeText(value?: string | null) {
    return value?.trim().toUpperCase() ?? ""
}

function normalizePrice(value: string | number) {
    const numericValue = typeof value === "number" ? value : Number(value)
    return Number.isFinite(numericValue) ? numericValue : 0
}

function matchesMaterial(
    masterPrice: CkMasterPriceReference,
    product: CkMasterPriceProductReference
) {
    const productCp = normalizeText(product.materialNumber)
    const productCk = normalizeText(product.materialNumberCk)
    const masterCp = normalizeText(masterPrice.materialNumberCp)
    const masterCk = normalizeText(masterPrice.materialNumberCk)

    return (
        (productCp.length > 0 && masterCp === productCp) ||
        (productCk.length > 0 && masterCk === productCk)
    )
}

export function isCkCustomer(customer: CustomerLike) {
    const normalizedName = normalizeText(customer?.name)
    const normalizedCode = normalizeText(customer?.customerCode)

    return normalizedName.includes("CIPTA KRIDATAMA") || normalizedCode === "CK"
}

export function findCkMasterPriceSuggestion({
    product,
    warehouseId,
    masterPrices,
}: {
    product: CkMasterPriceProductReference
    warehouseId?: number | null
    masterPrices: CkMasterPriceReference[]
}): CkMasterPriceSuggestion | null {
    const matchedPrices = masterPrices.filter((masterPrice) => matchesMaterial(masterPrice, product))

    if (matchedPrices.length === 0) {
        return null
    }

    if (warehouseId != null) {
        const warehouseMatch = matchedPrices.find((masterPrice) => masterPrice.warehouseId === warehouseId)
        if (warehouseMatch) {
            return {
                unitPrice: normalizePrice(warehouseMatch.price),
                source: "warehouse",
                matchedWarehouseId: warehouseMatch.warehouseId,
            }
        }
    }

    const distinctPriceValues = Array.from(
        new Map(
            matchedPrices.map((masterPrice) => {
                const normalized = normalizePrice(masterPrice.price)
                return [normalized.toFixed(2), normalized]
            })
        ).values()
    )

    if (distinctPriceValues.length === 1) {
        return {
            unitPrice: distinctPriceValues[0],
            source: "shared",
            matchedWarehouseId: matchedPrices[0]?.warehouseId ?? null,
        }
    }

    return null
}

export function findCkDefaultMasterPriceSuggestion({
    product,
    masterPrices,
}: {
    product: CkMasterPriceProductReference
    masterPrices: CkMasterPriceReference[]
}): CkMasterPriceSuggestion | null {
    const matchedPrices = masterPrices.filter((masterPrice) => matchesMaterial(masterPrice, product))

    if (matchedPrices.length === 0) {
        return null
    }

    const priceStats = new Map<string, { unitPrice: number; count: number; matchedWarehouseId: number | null; firstIndex: number }>()

    matchedPrices.forEach((masterPrice, index) => {
        const unitPrice = normalizePrice(masterPrice.price)
        const priceKey = unitPrice.toFixed(2)
        const current = priceStats.get(priceKey)

        if (current) {
            current.count += 1
            return
        }

        priceStats.set(priceKey, {
            unitPrice,
            count: 1,
            matchedWarehouseId: masterPrice.warehouseId,
            firstIndex: index,
        })
    })

    const bestMatch = Array.from(priceStats.values()).sort((left, right) => {
        if (right.count !== left.count) {
            return right.count - left.count
        }

        return left.firstIndex - right.firstIndex
    })[0]

    if (!bestMatch) {
        return null
    }

    return {
        unitPrice: bestMatch.unitPrice,
        source: priceStats.size === 1 ? "shared" : "default",
        matchedWarehouseId: bestMatch.matchedWarehouseId,
    }
}

export function getCkMasterPriceLabel(source?: CkMasterPriceSuggestion["source"] | null) {
    if (source === "warehouse") {
        return "Auto CK Master"
    }

    if (source === "shared") {
        return "Auto CK Master (Shared)"
    }

    if (source === "default") {
        return "Auto CK Master (Default)"
    }

    return null
}
