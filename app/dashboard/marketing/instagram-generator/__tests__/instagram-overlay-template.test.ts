import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const root = process.cwd()
const clientSource = readFileSync(join(root, "app/dashboard/marketing/instagram-generator/instagram-image-generator-client.tsx"), "utf8")
const composeSource = readFileSync(join(root, "lib/instagram-compose-engine.ts"), "utf8")

describe("Instagram overlay template tool", () => {
  it("adds a Bingkai / Overlay tab for manual image uploads", () => {
    expect(clientSource).toContain('value="overlay"')
    expect(clientSource).toContain("Bingkai / Overlay")
    expect(clientSource).toContain("Upload gambar")
  })

  it("uses feed and story template assets for overlay output", () => {
    expect(composeSource).toContain('"feed.png"')
    expect(composeSource).toContain('"Story.png"')
    expect(composeSource).toContain('"feed putih.png"')
    expect(composeSource).toContain('"Story putih.png"')
    expect(clientSource).toContain("/api/instagram-overlay-generator")
  })

  it("exposes Standard and White overlay choices before generate", () => {
    expect(clientSource).toContain("generatorOverlayVariant")
    expect(clientSource).toContain("Pilih overlay")
    expect(clientSource).toContain("Standar")
    expect(clientSource).toContain("Putih")
  })

  it("creates Standard and White previews together after overlay upload", () => {
    expect(clientSource).toContain('const variants: OverlayVariant[] = ["standard", "white"]')
    expect(clientSource).toContain("setOverlayResults(results)")
    expect(clientSource).toContain("Preview otomatis dua overlay")
    expect(clientSource).toContain("Lihat versi Standar dan Putih sekaligus")
  })
})
