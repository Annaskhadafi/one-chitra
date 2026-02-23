import { db } from './index'
import { sql } from 'drizzle-orm'

async function addIsConsignmentColumn() {
  try {
    // Check if column exists
    const result = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      AND column_name = 'is_consignment'
    `)
    
    if (result.rows.length === 0) {
      console.log('Adding is_consignment column...')
      await db.execute(sql`
        ALTER TABLE "products" 
        ADD COLUMN "is_consignment" boolean DEFAULT false NOT NULL
      `)
      console.log('✓ Column added successfully')
    } else {
      console.log('✓ Column already exists')
    }
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
  
  process.exit(0)
}

addIsConsignmentColumn()
