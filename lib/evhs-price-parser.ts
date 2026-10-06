/**
 * EVHS Price and Warehouse Parsing Utilities
 * Digunakan untuk normalisasi harga dan pencocokan warehouse/sloc pada import Master Price CK.
 */

export interface WarehouseOption {
    id: number
    sloc: string | null
    description: string | null
}

/**
 * Normalisasi format teks harga dari berbagai format:
 * - "540.000" -> 540000
 * - "540.000,00" -> 540000
 * - "540,000.00" -> 540000
 * - "142.959.000" -> 142959000
 * - "Rp 540.000" -> 540000
 * - 540000 -> 540000
 */
export function parseCleanPrice(value: unknown): number | null {
    if (value === null || value === undefined) return null

    if (typeof value === "number") {
        return Number.isFinite(value) && value >= 0 ? value : null
    }

    let raw = String(value).trim()
    if (!raw) return null

    // Hapus prefix mata uang dan spasi
    raw = raw.replace(/^(rp\.?|idr)\s*/i, "").trim()
    // Hapus karakter non angka selain titik, koma, minus
    raw = raw.replace(/[^\d.,-]/g, "")
    if (!raw) return null

    const dotCount = (raw.match(/\./g) ?? []).length
    const commaCount = (raw.match(/,/g) ?? []).length

    // Kasus 1: Tepat 1 titik, 0 koma (misal "540.000" vs "540.50")
    if (dotCount === 1 && commaCount === 0) {
        const parts = raw.split(".")
        if (parts[1]?.length === 3) {
            // "540.000" -> Ribuan Indonesia
            const parsed = Number(raw.replace(".", ""))
            return Number.isFinite(parsed) ? parsed : null
        }
    }

    // Kasus 2: Tepat 1 koma, 0 titik (misal "540,000" vs "540,50")
    if (commaCount === 1 && dotCount === 0) {
        const parts = raw.split(",")
        if (parts[1]?.length === 3) {
            // "540,000" -> Ribuan format US
            const parsed = Number(raw.replace(",", ""))
            return Number.isFinite(parsed) ? parsed : null
        }
        // "540,50" -> Desimal Indonesia
        const parsed = Number(raw.replace(",", "."))
        return Number.isFinite(parsed) ? parsed : null
    }

    // Kasus 3: Lebih dari 1 titik, 0 koma (misal "1.429.590" atau "142.959.000")
    if (dotCount > 1 && commaCount === 0) {
        const parsed = Number(raw.replaceAll(".", ""))
        return Number.isFinite(parsed) ? parsed : null
    }

    // Kasus 4: Lebih dari 1 koma, 0 titik (misal "1,429,590")
    if (commaCount > 1 && dotCount === 0) {
        const parsed = Number(raw.replaceAll(",", ""))
        return Number.isFinite(parsed) ? parsed : null
    }

    // Kasus 5: Ada titik dan koma (misal "1.429.590,00" atau "1,429,590.00")
    if (dotCount > 0 && commaCount > 0) {
        const lastComma = raw.lastIndexOf(",")
        const lastDot = raw.lastIndexOf(".")
        const decimalSep = lastComma > lastDot ? "," : "."
        const thousandsSep = decimalSep === "," ? "." : ","
        const canonical = raw.replaceAll(thousandsSep, "").replace(decimalSep, ".")
        const parsed = Number(canonical)
        return Number.isFinite(parsed) ? parsed : null
    }

    // Kasus 6: Angka biasa tanpa ribuan (misal "540000" atau "540000.50")
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
}

/**
 * Format number to PostgreSQL numeric/decimal string ("540000.00")
 */
export function formatPriceToDbString(price: number): string {
    return price.toFixed(2)
}

/**
 * Helper pencocokan warehouse yang fleksibel dan toleran
 */
export function matchWarehouse(
    warehouses: WarehouseOption[],
    slocInput?: string | null,
    warehouseNameInput?: string | null
): WarehouseOption | undefined {
    const rawSloc = slocInput?.toString().trim() || ""
    const rawName = warehouseNameInput?.toString().trim() || ""

    if (!rawSloc && !rawName) return undefined

    // 1. Cek berdasarkan SLOC
    if (rawSloc) {
        // A. Exact match SLOC
        const bySloc = warehouses.find(
            (w) => w.sloc && w.sloc.trim().toLowerCase() === rawSloc.toLowerCase()
        )
        if (bySloc) return bySloc

        // B. Numeric match SLOC ("06" vs "6", "002" vs "2")
        const numSloc = parseInt(rawSloc, 10)
        if (!isNaN(numSloc)) {
            const bySlocNum = warehouses.find((w) => {
                if (!w.sloc) return false
                const num = parseInt(w.sloc.trim(), 10)
                return !isNaN(num) && num === numSloc
            })
            if (bySlocNum) return bySlocNum
        }

        // C. Cek jika rawSloc sebenarnya adalah description/nama gudang (misal diisi "CK BIB" atau "BIB")
        const byDescExact = warehouses.find(
            (w) => w.description && w.description.trim().toLowerCase() === rawSloc.toLowerCase()
        )
        if (byDescExact) return byDescExact

        // D. Cek prefix CK (misal user masukkan "BIB" dicocokkan ke "CK BIB")
        const cleanSloc = rawSloc.replace(/^ck[\s\.\-_]*/i, "").trim().toLowerCase()
        if (cleanSloc) {
            const byCleanDesc = warehouses.find((w) => {
                const descClean = (w.description || "").replace(/^ck[\s\.\-_]*/i, "").trim().toLowerCase()
                return descClean.length > 0 && descClean === cleanSloc
            })
            if (byCleanDesc) return byCleanDesc
        }
    }

    // 2. Cek berdasarkan Warehouse Name
    if (rawName) {
        // A. Exact match description
        const byName = warehouses.find(
            (w) => w.description && w.description.trim().toLowerCase() === rawName.toLowerCase()
        )
        if (byName) return byName

        // B. Clean description match (abaikan prefix "CK ")
        const cleanName = rawName.replace(/^ck[\s\.\-_]*/i, "").trim().toLowerCase()
        if (cleanName) {
            const byCleanName = warehouses.find((w) => {
                const descClean = (w.description || "").replace(/^ck[\s\.\-_]*/i, "").trim().toLowerCase()
                return descClean.length > 0 && descClean === cleanName
            })
            if (byCleanName) return byCleanName
        }

        // C. Cek apakah rawName berisi Sloc
        const bySlocInName = warehouses.find(
            (w) => w.sloc && w.sloc.trim().toLowerCase() === rawName.toLowerCase()
        )
        if (bySlocInName) return bySlocInName
    }

    return undefined
}
