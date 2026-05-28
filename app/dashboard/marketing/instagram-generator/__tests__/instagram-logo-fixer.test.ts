import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const root = process.cwd()
const clientSource = readFileSync(join(root, "app/dashboard/marketing/instagram-generator/instagram-image-generator-client.tsx"), "utf8")
const routePath = join(root, "app/api/instagram-logo-fixer/route.ts")
const routeSource = existsSync(routePath) ? readFileSync(routePath, "utf8") : ""

describe("Instagram Logo Fixer AI", () => {
  it("adds Logo Fixer AI as a third tab", () => {
    expect(clientSource).toContain('value="logo-fixer"')
    expect(clientSource).toContain("Logo Fixer AI")
  })

  it("can send AI generator output to Logo Fixer AI", () => {
    expect(clientSource).toContain("Kirim ke Logo Fixer AI")
    expect(clientSource).toContain("setActiveTab(\"logo-fixer\")")
  })

  it("supports default cp_logo and custom logo upload", () => {
    expect(clientSource).toContain("/cp_logo.png")
    expect(clientSource).toContain("Upload logo custom")
    expect(routeSource).toContain("cp_logo.png")
  })

  it("posts source image and logo to the Logo Fixer API", () => {
    expect(clientSource).toContain("/api/instagram-logo-fixer")
    expect(routeSource).toContain("replace")
    expect(routeSource).toContain("helmet")
    expect(routeSource).toContain("left chest")
  })

  it("keeps Logo Fixer provider parsing resilient", () => {
    expect(routeSource).toContain("MAX_PROVIDER_ATTEMPTS")
    expect(routeSource).toContain("resolveOneImageCandidate")
    expect(routeSource).toContain("image_url")
    expect(routeSource).toContain("Object.values(record)")
  })

  it("protects official overlay logo and footer from edits", () => {
    expect(routeSource).toContain("Do not modify the official overlay logo")
    expect(routeSource).toContain("top-left")
    expect(routeSource).toContain("footer")
    expect(routeSource).toContain("generated logos inside the scene")
  })
})

