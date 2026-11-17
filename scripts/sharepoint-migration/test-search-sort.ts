import { getVendorInvoicesAction } from "@/app/actions/vendor-invoices"

async function testSearchAndSort() {
  console.log("🔍 Menguji pencarian invoice AJP/2610/4537...")
  const searchRes = await getVendorInvoicesAction({ search: "AJP/2610/4537" })
  console.log(`Hasil Pencarian (Search "AJP/2610/4537"): Ditemukan ${searchRes.length} invoice`)
  if (searchRes.length > 0) {
    console.log({
      invoiceNumber: searchRes[0].invoiceNumber,
      vendor: searchRes[0].tenant.name,
      grandTotal: searchRes[0].grandTotal,
      topDays: searchRes[0].topDays,
      createdAt: searchRes[0].createdAt,
      fileUrl: searchRes[0].invoiceFileUrl,
    })
  }

  console.log("\n📊 Menguji Sorting:")
  const sortedByVendor = await getVendorInvoicesAction({ sortBy: "vendor_name", sortOrder: "asc", limit: 3 })
  console.log("Top 3 Sort By Vendor (ASC):", sortedByVendor.map(i => i.tenant.name))

  const sortedByTop = await getVendorInvoicesAction({ sortBy: "top", sortOrder: "desc", limit: 3 })
  console.log("Top 3 Sort By TOP (DESC):", sortedByTop.map(i => `TOP ${i.topDays}d - ${i.tenant.name}`))
}

testSearchAndSort().then(() => process.exit(0)).catch(console.error)
