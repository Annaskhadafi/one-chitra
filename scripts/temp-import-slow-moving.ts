import { db } from "../db/index"
import { slowMovingProducts } from "../db/schema/slow-moving-products"
import { eq } from "drizzle-orm"

const data = [
  { "materialNumber": "110124Q203", "description": "325/95R24 X WORKS Z 2 162/160K VG M" },
  { "materialNumber": "110125J101", "description": "23.5 R 25 XH A TL *" },
  { "materialNumber": "110151B109", "description": "33.00 R 51 XDR3 B E4R TL **" },
  { "materialNumber": "119120H202", "description": "12.00 R 20 ETFN" },
  { "materialNumber": "110125H102", "description": "20.5 R 25 XHA2 TL" },
  { "materialNumber": "110125J103", "description": "23.5 R 25 XHA2 TL" },
  { "materialNumber": "110129B101", "description": "29.5 R 29 XLD D2 A TL *" },
  { "materialNumber": "110125H101", "description": "20.5 R 25 XLD D2 A TL *" },
  { "materialNumber": "110125J102", "description": "23.5 R 25 XLD D2 A TL *" },
  { "materialNumber": "112125J102", "description": "23.5R25 201A2 EMR 1051 TL" },
  { "materialNumber": "110109A301", "description": "6.00 R 9 XZM TL" },
  { "materialNumber": "110129B102", "description": "29.5 R 29 XTS TL **" },
  { "materialNumber": "110133D104", "description": "35/65 R 33 XTRA POWER L5" },
  { "materialNumber": "112125M101", "description": "29.5R25 200B/216A2 EMR 1042 TL" },
  { "materialNumber": "116316A202", "description": "7.50-16 /14 S88N HD" },
  { "materialNumber": "110115C301", "description": "8.25 R 15 XZM TL 153 A5" },
  { "materialNumber": "117122D201", "description": "11 R 22.5 TL HN08" },
  { "materialNumber": "119120G201", "description": "11.00 R 20 ETOT" },
  { "materialNumber": "110125M105", "description": "29.5 R 25 XTRA DEFEND E4 TL 200B" },
  { "materialNumber": "117122D202", "description": "11 R 22.5 TL HN10" },
  { "materialNumber": "110116A203", "description": "7.50 R 16 121L AGILIS HD" },
  { "materialNumber": "110145A102", "description": "45/65 R 45 XLD D1A L4 TL ** 244A2" },
  { "materialNumber": "110151B107", "description": "33.00 R 51 XDT B E4T TL **" },
  { "materialNumber": "110157A105", "description": "37.00 R 57 XDR3 B E4R TL**" },
  { "materialNumber": "117220F201", "description": "10.00 R 20 TT HN10" },
  { "materialNumber": "119120H201", "description": "12.00 R 20 ETOT" },
  { "materialNumber": "199224H201", "description": "14.00-24 TIRE" }
]

async function run() {
  let newCount = 0;
  let skippedCount = 0;
  
  for (const item of data) {
    const existing = await db.query.slowMovingProducts.findFirst({
      where: eq(slowMovingProducts.materialKey, item.materialNumber)
    })
    
    if (existing) {
      console.log(`Skipping duplicate: ${item.materialNumber}`)
      skippedCount++;
    } else {
      await db.insert(slowMovingProducts).values({
        materialKey: item.materialNumber,
        materialNumber: item.materialNumber,
        description: item.description,
      })
      console.log(`Inserted new: ${item.materialNumber}`)
      newCount++;
    }
  }
  
  console.log(`Done! Inserted: ${newCount}, Skipped: ${skippedCount}`)
  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
