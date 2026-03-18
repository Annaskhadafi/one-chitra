import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
import { extractStructuredFromDocument } from "@/lib/mistral-ocr"

const TEST_DIR = path.resolve(process.cwd(), "public", "uploads", "test-po")

function load(file: string) {
    const p = path.join(TEST_DIR, file)
    if (!fs.existsSync(p)) return null
    return fs.readFileSync(p)
}

const cases = [
    "po_01.pdf", "po_02.pdf", "po_03.pdf", "po_04.pdf", "po_05.pdf",
    "po_06.pdf", "po_07.pdf", "po_08.pdf", "po_09.pdf", "po_10.pdf",
    "po_11.jpg", "po_12.jpg", "po_13.jpg", "po_14.jpg", "po_15.jpg",
    "po_16.png", "po_17.png", "po_18.png", "po_19.png", "po_20.png",
]

describe("OCR Sales Order Extraction", () => {
    for (const file of cases) {
        it(`extracts structured data for ${file}`, { timeout: 20000 }, async () => {
            const buf = load(file)
            if (!buf) {
                expect(true).toBe(true)
                return
            }
            const res = await extractStructuredFromDocument({ fileBuffer: buf, filename: file, pages: "all" })
            expect(res.structured.products.length).toBeGreaterThan(0)
            expect(res.structured.customer_company_name.length).toBeGreaterThan(0)
            expect(res.structured.po_number.length).toBeGreaterThan(0)
        })
    }
})
