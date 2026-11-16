import * as fs from "fs"

function parseCsvSimple(csvText: string): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/)
  if (lines.length < 2) return []

  function parseLine(line: string): string[] {
    const result: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === "," && !inQuotes) {
        result.push(current)
        current = ""
      } else {
        current += char
      }
    }
    result.push(current)
    return result
  }

  const rawHeaders = parseLine(lines[0])
  const headers = rawHeaders.map((h) => h.trim().replace(/^"|"$/g, ""))
  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i].trim()
    if (!rawLine) continue
    const values = parseLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || "").trim().replace(/^"|"$/g, "")
    })
    rows.push(row)
  }
  return rows
}

const csvPath = "C:/Users/Abdul Rajab/.gemini/antigravity/brain/2c5cbd4b-da8f-4610-93d7-085e97c8b11b/.user_uploaded/media_1794753099920_40d93ac5.csv"
const records = parseCsvSimple(fs.readFileSync(csvPath, "utf-8"))

const files = fs.readdirSync("public/uploads/vendor-invoices/sharepoint").filter(f => f.endsWith(".pdf"))
const fileByItemId = new Map<number, string>()
for (const f of files) {
  const m = f.match(/^(\d+)_(.+)$/)
  if (m) fileByItemId.set(parseInt(m[1], 10), f)
}

console.log("Total Records:", records.length)

// Cetak 25 record pertama dan bandingkan dengan ID (3474, 3473, ...)
let estimatedId = 3474
let matchedCount = 0

for (let i = 0; i < 25; i++) {
  const r = records[i]
  const inv = r["Invoice Number"]
  const vendor = r["Nama Vendor"]
  const hasAttachment = r["Lampiran"] === "1"
  
  // Cek apakah file dengan estimatedId cocok
  const file = fileByItemId.get(estimatedId)
  console.log(`Rec ${i+1} | SP-ID: ${estimatedId} | Inv: ${inv} | Vendor: ${vendor} | File: ${file || "(tidak ada file)"}`)
  estimatedId--
}
