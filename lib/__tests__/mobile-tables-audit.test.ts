import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"

function hasOverflowHandling(code: string): boolean {
  if (!/(<Table\b|<table\b)/.test(code)) return true
  if (/overflow-x-auto|overflow-auto|ResponsiveTableWrapper/.test(code)) return true
  if (/md:hidden/.test(code) && /hidden\s+md:block/.test(code)) return true
  return false
}

describe("Mobile tables audit (targeted critical screens)", () => {
  it("ensures critical screens have mobile overflow handling", () => {
    const base = path.resolve(__dirname, "../../")
    const targets = [
      "app/dashboard/deliveries/_components/delivery-form.tsx",
      "app/dashboard/sales-orders/_components/sales-order-detail.tsx",
      "app/dashboard/approvals/[requestId]/page.tsx",
      "app/dashboard/inventory/dead-stock/page.tsx",
      "app/dashboard/admin/users/_components/user-list.tsx",
      "app/dashboard/admin/roles/_components/role-list.tsx",
      "app/dashboard/settings/email/_components/email-logs.tsx",
      "app/dashboard/billing/[poNo]/client-page.tsx",
      "app/dashboard/products/_components/product-table-csv.tsx",
      "app/dashboard/competitor-info-new/_components/price-competitor-tab.tsx",
      "app/dashboard/inventory-ml/_components/comparison-view.tsx",
      "app/dashboard/price-management/_components/margin-alerts-tab.tsx",
      "app/dashboard/quotation-analysis/_components/quotation-analysis-client.tsx",
    ]
    const failed: string[] = []
    for (const rel of targets) {
      const p = path.join(base, rel)
      const code = fs.readFileSync(p, "utf8")
      if (!hasOverflowHandling(code)) failed.push(rel)
    }
    expect(failed, `Screens missing overflow handling:\n${failed.join("\n")}`).toEqual([])
  })
})
