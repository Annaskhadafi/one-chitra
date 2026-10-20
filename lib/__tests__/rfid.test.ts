import { describe, expect, it } from "vitest"

import { parseDeleteRfidScanPayload, parseRfidScanPayload } from "@/lib/rfid"

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

    it("accepts incoming payload with ekspedisi, tire_condition, and null actStock", () => {
        const masukPayload = {
            material: {
                plnt: "2001",
                category: null,
                material: "MAT-001",
                description: "Ban ...",
                sloc: "101",
                slocDescription: null,
                actStock: null,
            },
            items: [
                {
                    sn: "SN-001",
                    epc: "E280116012345678",
                    rssi: "",
                    linked: true,
                    tire_condition: "GOOD",
                    remarks: "",
                    ekspedisi: "JNE",
                    plat_truk: "",
                    tujuan: "",
                    nama_driver: "",
                },
            ],
            createdBy: "operator",
            createdAt: "2026-10-20T14:30:00.000",
        }

        const parsed = parseRfidScanPayload(masukPayload)
        expect(parsed.material.actStock).toBeNull()
        expect(parsed.items[0].ekspedisi).toBe("JNE")
        expect(parsed.items[0].tire_condition).toBe("GOOD")
    })

    it("accepts outgoing payload with plat_truk, tujuan, and nama_driver", () => {
        const keluarPayload = {
            material: {
                plnt: "2001",
                category: null,
                material: "MAT-001",
                description: "Ban ...",
                sloc: "101",
                slocDescription: null,
                actStock: null,
            },
            items: [
                {
                    sn: "SN-001",
                    epc: "E280116012345678",
                    rssi: "",
                    linked: true,
                    tire_condition: "GOOD",
                    remarks: "",
                    ekspedisi: "",
                    plat_truk: "KT 1234 AB",
                    tujuan: "Site A",
                    nama_driver: "Budi",
                },
            ],
            createdBy: "operator",
            createdAt: "2026-10-20T14:30:00.000",
        }

        const parsed = parseRfidScanPayload(keluarPayload)
        expect(parsed.items[0].plat_truk).toBe("KT 1234 AB")
        expect(parsed.items[0].tujuan).toBe("Site A")
        expect(parsed.items[0].nama_driver).toBe("Budi")
    })
})

const deletePayload = {
    material: {
        plnt: "2001",
        material: "110149C110",
        sloc: "101",
    },
    epcs: ["E28011700000021B2F6D7DD6", "E280699500005012FAF7F4F9"],
}

describe("parseDeleteRfidScanPayload", () => {
    it("accepts delete payload with material and epcs", () => {
        const parsed = parseDeleteRfidScanPayload(deletePayload)

        expect(parsed.epcs).toHaveLength(2)
        expect(parsed.material!.material).toBe("110149C110")
    })

    it("accepts delete payload with epcs only (no material)", () => {
        const parsed = parseDeleteRfidScanPayload({
            epcs: ["E28011700000021B2F6D7DD6"],
        })

        expect(parsed.epcs).toHaveLength(1)
        expect(parsed.material).toBeUndefined()
    })

    it("rejects empty epcs array", () => {
        expect(() =>
            parseDeleteRfidScanPayload({
                ...deletePayload,
                epcs: [],
            }),
        ).toThrow()
    })

    it("rejects epcs with empty string", () => {
        expect(() =>
            parseDeleteRfidScanPayload({
                ...deletePayload,
                epcs: [""],
            }),
        ).toThrow()
    })

    it("rejects missing epcs", () => {
        expect(() =>
            parseDeleteRfidScanPayload({}),
        ).toThrow()
    })
})
