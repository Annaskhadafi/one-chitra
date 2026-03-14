import { describe, expect, it } from "vitest"
import { extractFallbackSections, extractRationaleJson } from "../ml-report-viewer"

describe("ml-report-viewer parsers", () => {
    it("parses plain JSON rationale", () => {
        const data = extractRationaleJson('{"summary":"ok","status":"Safe","metrics":[]}')
        expect(data?.summary).toBe("ok")
        expect(data?.status).toBe("Safe")
    })

    it("parses JSON wrapped in markdown fence", () => {
        const rationale = "```json\n{\"summary\":\"wrapped\",\"status\":\"Warning\",\"metrics\":[]}\n```"
        const data = extractRationaleJson(rationale)
        expect(data?.summary).toBe("wrapped")
        expect(data?.status).toBe("Warning")
    })

    it("returns fallback sections for semi-structured text", () => {
        const fallback = extractFallbackSections("Analisa stok menurun\n- tambah safety stock\n- monitor lead time")
        expect(fallback.summary).toContain("Analisa stok")
        expect(fallback.recommendations?.length).toBe(2)
    })
})
