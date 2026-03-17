import { describe, expect, it } from "vitest"

import { normalizeSloc } from "../sloc"

describe("normalizeSloc", () => {
  it("keeps a 3-digit sloc unchanged", () => {
    expect(normalizeSloc("101")).toBe("101")
  })

  it("removes extra leading zeros when the sloc already resolves to 3 digits", () => {
    expect(normalizeSloc("0101")).toBe("101")
  })

  it("pads short numeric slocs to 3 digits", () => {
    expect(normalizeSloc("1")).toBe("001")
  })

  it("normalizes zero-padded short slocs into the same 3-digit key", () => {
    expect(normalizeSloc("0001")).toBe("001")
  })

  it("uppercases non-numeric slocs", () => {
    expect(normalizeSloc(" ab1 ")).toBe("AB1")
  })

  it("returns an empty string for blank values", () => {
    expect(normalizeSloc("   ")).toBe("")
  })
})
