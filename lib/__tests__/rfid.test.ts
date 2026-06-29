import { describe, expect, it } from "vitest"

import { parseRfidScanPayload } from "@/lib/rfid"

const payload = {
    material: {
        plnt: "2001",
        category: "TYRE",
        material: "110149C110",
        description: "27.00 R 49 XDR3 B E4R TL *",
        sloc: "101",
        slocDescription: "CP TRD BPN",
        actStock: 11,
    },
    items: [
        {
            sn: "MXL24000125",
            epc: "E28011700000021B2F6D7DD6",
            rssi: "90",
            linked: true,
        },
        {
            sn: "MXL24000126",
            epc: "E280699500005012FAF7F4F9",
            rssi: "88",
            linked: true,
        },
    ],
    createdBy: "operator",
    createdAt: "2026-06-29 10:30:00",
}

describe("parseRfidScanPayload", () => {
    it("accepts the Flutter RFID payload shape", () => {
        const parsed = parseRfidScanPayload(payload)

        expect(parsed.material.material).toBe("110149C110")
        expect(parsed.items).toHaveLength(2)
        expect(parsed.createdAt).toBeInstanceOf(Date)
    })

    it("rejects empty EPC values", () => {
        expect(() =>
            parseRfidScanPayload({
                ...payload,
                items: [{ ...payload.items[0], epc: "" }],
            }),
        ).toThrow()
    })

    it("keeps string false as false", () => {
        const parsed = parseRfidScanPayload({
            ...payload,
            items: [{ ...payload.items[0], linked: "false" }],
        })

        expect(parsed.items[0].linked).toBe(false)
    })
})
