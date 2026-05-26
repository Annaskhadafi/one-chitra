import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const root = process.cwd()
const clientSource = readFileSync(join(root, "app/dashboard/marketing/instagram-generator/instagram-image-generator-client.tsx"), "utf8")
const imageApiSource = readFileSync(join(root, "app/api/instagram-image-generator/route.ts"), "utf8")
const enhancerApiSource = readFileSync(join(root, "app/api/instagram-prompt-enhancer/route.ts"), "utf8")

const retroKeywords = [
  "retro poster",
  "gouache illustration",
  "fisheye perspective",
  "tiny planet",
  "heroic composition",
  "editorial illustration",
  "travel poster",
  "grain texture",
  "stylized environment",
  "dynamic low angle",
]

describe("Instagram generator retro style", () => {
  it("exposes Style Retro in the visual style selector", () => {
    expect(clientSource).toContain('"Style Retro"')
  })

  it("uses the requested retro keywords in generated prompts", () => {
    for (const keyword of retroKeywords) {
      expect(clientSource).toContain(keyword)
      expect(imageApiSource).toContain(keyword)
      expect(enhancerApiSource).toContain(keyword)
    }
  })
})
