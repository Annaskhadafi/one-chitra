import { db } from "@/db"
import { sql } from "drizzle-orm"

async function main() {
    await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tire_scans (
      id SERIAL PRIMARY KEY,
      batch_id VARCHAR(100) NOT NULL,
      sloc VARCHAR(50) NOT NULL,
      sloc_description TEXT,
      material_number VARCHAR(100) NOT NULL,
      material_description TEXT,
      serial_number VARCHAR(100) NOT NULL,
      qty INTEGER NOT NULL DEFAULT 1,
      dot VARCHAR(50),
      brand VARCHAR(100),
      size VARCHAR(100),
      image_url TEXT,
      vision_scan_id VARCHAR(100),
      created_by VARCHAR(100),
      user_id VARCHAR(255) REFERENCES "user"(id),
      warehouse_id INTEGER REFERENCES warehouses(id),
      product_id INTEGER REFERENCES products(id),
      scanned_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `)
    console.log("tire_scans table created successfully!")
    process.exit(0)
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
