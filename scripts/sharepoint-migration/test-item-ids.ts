import * as fs from "fs"
import * as path from "path"

const csvPath = "C:/Users/Abdul Rajab/.gemini/antigravity/brain/2c5cbd4b-da8f-4610-93d7-085e97c8b11b/.user_uploaded/media_1794753099920_40d93ac5.csv"
const files = fs.readdirSync("public/uploads/vendor-invoices/sharepoint").filter(f => f.endsWith(".pdf"))

console.log("Total files:", files.length)

// Buat map dari ItemId -> FileName
const fileByItemId = new Map<number, string>()
for (const f of files) {
  const m = f.match(/^(\d+)_(.+)$/)
  if (m) {
    fileByItemId.set(parseInt(m[1], 10), f)
  }
}

console.log("Total parsed ItemIDs:", fileByItemId.size)

// Cek sampel item ID
const sampleIds = [3474, 3473, 3472, 3471, 3470, 3469, 1000, 500, 100, 10, 1]
for (const id of sampleIds) {
  console.log(`ID ${id}:`, fileByItemId.get(id) || "NOT FOUND")
}
