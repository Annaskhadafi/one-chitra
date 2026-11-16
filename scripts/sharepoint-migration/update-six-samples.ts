import "dotenv/config"
import { db } from "@/db"
import { vendorInvoices } from "@/db/schema/vendor-invoices"
import { ilike } from "drizzle-orm"

async function updateSixSamples() {
  const updates = [
    { no: "110/RB/CP/PCRC/X/2026", po: "8220025060", file: "/api/uploads/vendor-invoices/sharepoint/3445_REAL%20BORNEO%20-%20110RBCPPCRCX2026.pdf" },
    { no: "107/RB/CP/PCRC/VII/2026", po: "8220024629", file: "/api/uploads/vendor-invoices/sharepoint/2817_REAL%20BORNEO%20-%20107RBCPPCRCVII2026.pdf" },
    { no: "MGK 02601749", po: "8210010589", file: "/api/uploads/vendor-invoices/sharepoint/3409_MENTARI%20-%20MGK%2002601748.pdf" },
    { no: "INV/DJU-1167/IX/2026", po: "8210010428", file: "/api/uploads/vendor-invoices/sharepoint/3135_DJU%20-%20NVDJU-1167IX2026.pdf" },
    { no: "015E2609-05587", po: "8220024915", file: "/api/uploads/vendor-invoices/sharepoint/3108_ARK%20-%2001SE2609-05587.pdf" },
    { no: "025/INV-GJMBPN/VII/2026", po: "8220024697", file: "/api/uploads/vendor-invoices/sharepoint/2830_GJM%20-%20025INV-GJMBPNVII2026.pdf" },
  ]

  for (const item of updates) {
    const res = await db
      .update(vendorInvoices)
      .set({
        poNumber: item.po,
        invoiceFileUrl: item.file,
      })
      .where(ilike(vendorInvoices.invoiceNumber, `%${item.no}%`))
      .returning({ id: vendorInvoices.id, inv: vendorInvoices.invoiceNumber, po: vendorInvoices.poNumber })

    console.log(`Updated ${item.no}:`, res)
  }

  process.exit(0)
}

updateSixSamples().catch((e) => {
  console.error(e)
  process.exit(1)
})
