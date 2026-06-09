import { db } from "../db/index"
import { cosmeticTires } from "../db/schema/cosmetic-tires"
import { eq, and } from "drizzle-orm"

const data = [
  { tyreSize: "27.00 R 49", pattern: "XD-GRIP B", serialNumber: "ICJ 1066 S6A", month: "MAY", city: "BRAZIL", year: "2023" },
  { tyreSize: "27.00 R 49", pattern: "XD-GRIP B", serialNumber: "VCO 1349 S3A", month: "OCTOBER", city: "BRAZIL", year: "2022" },
  { tyreSize: "27.00 R 49", pattern: "XD-GRIP B", serialNumber: "AVX 0021 L7A", month: "JANUARY", city: "SPANYOL", year: "2024" },
  { tyreSize: "27.00 R 49", pattern: "XD-GRIP B", serialNumber: "ICP 0247 S5A", month: "AGUSTUS", city: "BRAZIL", year: "2024" },
  { tyreSize: "27.00 R 49", pattern: "XD-GRIP B", serialNumber: "FCP 0373 S9A", month: "NOVEMBER", city: "BRAZIL", year: "2024" },
  { tyreSize: "27.00 R 49", pattern: "XD-GRIP B", serialNumber: "BCK 0021 F2A", month: "MARET", city: "BRAZIL", year: "2025" },
  { tyreSize: "27.00 R 49", pattern: "XDR3 B4", serialNumber: "DCK 0089 T5B", month: "JULI", city: "BRAZIL", year: "2025" },
  { tyreSize: "27.00 R 49", pattern: "XDR3 B4", serialNumber: "DCK 0090 T4B", month: "JULI", city: "BRAZIL", year: "2025" },
  { tyreSize: "27.00 R 49", pattern: "XDR3 B4", serialNumber: "DCK 0092 T2B", month: "JULI", city: "BRAZIL", year: "2025" },
  { tyreSize: "27.00 R 49", pattern: "XDR3 B", serialNumber: "DCK 0068 T8B", month: "JULI", city: "BRAZIL", year: "2025" },
  { tyreSize: "27.00 R 49", pattern: "XDR3 B", serialNumber: "CVX 0080 V2A", month: "MAY", city: "SPAIN", year: "2024" },
  { tyreSize: "27.00 R 49", pattern: "XDR3 B4", serialNumber: "DCK 0093 T1B", month: "JULY", city: "BRAZIL", year: "2025" },
  { tyreSize: "27.00 R 49", pattern: "XDR3 B4", serialNumber: "DCK 0132 T2B", month: "JULY", city: "BRAZIL", year: "2025" },
  { tyreSize: "27.00 R 49", pattern: "XDR3 B4", serialNumber: "DCK 0101 T3B", month: "JULY", city: "BRAZIL", year: "2025" },
  { tyreSize: "27.00 R 49", pattern: "XDR3 B4", serialNumber: "DCK 0125 T9B", month: "JULY", city: "BRAZIL", year: "2025" },
  { tyreSize: "27.00 R 49", pattern: "XDR3 B4", serialNumber: "ICK 0002 T2B", month: "MAY", city: "BRAZIL", year: "2025" }
]

async function run() {
  let newCount = 0;
  let skippedCount = 0;
  
  for (const item of data) {
    const existing = await db.query.cosmeticTires.findFirst({
      where: eq(cosmeticTires.serialNumber, item.serialNumber)
    })
    
    if (existing) {
      console.log(`Skipping duplicate: ${item.serialNumber}`)
      skippedCount++;
    } else {
      await db.insert(cosmeticTires).values(item)
      console.log(`Inserted new: ${item.serialNumber}`)
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
