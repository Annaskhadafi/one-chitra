import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const root = process.cwd()
const targetFiles = [
  "app/dashboard/marketing/instagram-generator/instagram-image-generator-client.tsx",
  "app/api/instagram-prompt-enhancer/route.ts",
  "app/api/instagram-image-generator/route.ts",
]
const sources = Object.fromEntries(targetFiles.map((file) => [file, readFileSync(join(root, file), "utf8")]))

const requiredPhrases = [
  "wearpack safety TWO-TONE resmi",
  "lengan BIRU NAVY GELAP (#002D56)",
  "dada/bahu HIJAU NEON (#8DC63F)",
  "strip reflektif silver di pundak dan perut",
  "BACKGROUND PUTIH SOLID di belakang logo",
  "bukan stiker mengambang",
  "Komposisi profesional, pencahayaan natural",
]

const oldPhrases = [
  "KEMEJA LENGAN PANJANG",
  "ROMPI/VEST",
  "FULL WIDTH",
  "two full-width silver reflective stripes",
  "dark navy blue long sleeve shirt underneath",
]

describe("Instagram generator wearpack prompt", () => {
  it("uses the new two-tone wearpack copy everywhere", () => {
    for (const [file, source] of Object.entries(sources)) {
      for (const phrase of requiredPhrases) {
        expect(source, `${file} should include ${phrase}`).toContain(phrase)
      }
    }
  })

  it("does not keep the old layered vest wording", () => {
    for (const [file, source] of Object.entries(sources)) {
      for (const phrase of oldPhrases) {
        expect(source, `${file} should not include ${phrase}`).not.toContain(phrase)
      }
    }
  })
})
