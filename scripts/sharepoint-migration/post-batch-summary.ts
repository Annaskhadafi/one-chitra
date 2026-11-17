import "dotenv/config"
import { db } from "@/db"
import { vendorInvoices } from "@/db/schema/vendor-invoices"

async function summary() {
  const july1 = new Date("2026-07-01T00:00:00.000Z")
  const all = await db.select({
    id: vendorInvoices.id,
    poNumber: vendorInvoices.poNumber,
    createdAt: vendorInvoices.createdAt,
    invoiceDate: vendorInvoices.invoiceDate,
  }).from(vendorInvoices)

  const july = all.filter((inv) => {
    const dCreated = inv.createdAt ? new Date(inv.createdAt) : null
    const dInv = inv.invoiceDate ? new Date(inv.invoiceDate) : null
    return (dCreated && dCreated >= july1) || (dInv && dInv >= july1)
  })

  const validPo = july.filter((inv) =>
    /^(82\d{8}|81\d{8}|45\d{8})$/.test((inv.poNumber || "").trim())
  )

  console.log("--------------------------------------------------")
  console.log("📊 REKAPITULASI DATA DATABASE (JULI S/D SEKARANG):")
  console.log("--------------------------------------------------")
  console.log(`Total Invoice Periode Juli - Sekarang : ${july.length}`)
  console.log(`Invoice Memiliki Nomor PO SAP Valid  : ${validPo.length} (${((validPo.length / july.length) * 100).toFixed(1)}%)`)
  console.log(`Invoice Belum Ada PO                 : ${july.length - validPo.length}`)
  console.log("--------------------------------------------------")
  process.exit(0)
}

summary()
