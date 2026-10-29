export interface RosterPerson {
    id: string
    name: string
    shifts: Record<number, "11" | "FB">
    total11: number
    totalFb: number
}

export interface QuotationRosterData {
    monthName: string
    year: number
    daysInMonth: number
    daysArray: number[]
    persons: RosterPerson[]
    totalAll11: number
    totalAllFb: number
}

interface QuotationItemLike {
    id?: number
    description?: string | null
    quantity: number
    product?: {
        materialDescription?: string | null
        materialNumber?: string | null
    } | null
}

export function generateRosterFromQuotation(
    quotationDate: Date | string,
    items: QuotationItemLike[],
    customOverrides?: Record<string, Record<number, "11" | "FB">>
): QuotationRosterData {
    const date = new Date(quotationDate)
    const validDate = Number.isNaN(date.getTime()) ? new Date() : date
    const year = validDate.getFullYear()
    const month = validDate.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1)

    const monthName = validDate.toLocaleString("id-ID", { month: "long" })

    // Build person list from items
    const rawPersons: { id: string; name: string }[] = []

    if (!items || items.length === 0) {
        rawPersons.push({ id: "p-default-1", name: "Tyre Technician 1" })
        rawPersons.push({ id: "p-default-2", name: "Tyre Technician 2" })
    } else {
        items.forEach((item, itemIdx) => {
            const baseName =
                item.description?.trim() ||
                item.product?.materialDescription?.trim() ||
                item.product?.materialNumber?.trim() ||
                `Manpower ${itemIdx + 1}`

            const qty = Math.max(1, Math.min(Math.floor(item.quantity || 1), 10))

            if (qty === 1) {
                rawPersons.push({
                    id: `item-${itemIdx}-1`,
                    name: baseName,
                })
            } else {
                for (let q = 1; q <= qty; q++) {
                    rawPersons.push({
                        id: `item-${itemIdx}-${q}`,
                        name: `${baseName} #${q}`,
                    })
                }
            }
        })
    }

    let totalAll11 = 0
    let totalAllFb = 0

    const persons: RosterPerson[] = rawPersons.map((person, pIdx) => {
        const shifts: Record<number, "11" | "FB"> = {}
        let total11 = 0
        let totalFb = 0

        daysArray.forEach((day) => {
            // Check if user manually overrode this cell
            const overrideVal = customOverrides?.[person.id]?.[day]
            if (overrideVal === "11" || overrideVal === "FB") {
                shifts[day] = overrideVal
            } else {
                // Default staggered mining roster pattern (10 work days 11 hours, 2 field break)
                // Shift cycle of 12 days
                const cycle = (day + pIdx * 3) % 12
                if (cycle === 10 || cycle === 11) {
                    shifts[day] = "FB"
                } else {
                    shifts[day] = "11"
                }
            }

            if (shifts[day] === "11") {
                total11 += 1
                totalAll11 += 1
            } else {
                totalFb += 1
                totalAllFb += 1
            }
        })

        return {
            id: person.id,
            name: person.name,
            shifts,
            total11,
            totalFb,
        }
    })

    return {
        monthName,
        year,
        daysInMonth,
        daysArray,
        persons,
        totalAll11,
        totalAllFb,
    }
}
