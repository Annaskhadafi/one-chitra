import * as fs from "fs"

const csvPath = "C:/Users/Abdul Rajab/.gemini/antigravity/brain/2c5cbd4b-da8f-4610-93d7-085e97c8b11b/.user_uploaded/media_1794753099920_40d93ac5.csv"
const lines = fs.readFileSync(csvPath, "utf-8").split(/\r?\n/).slice(1, 20)

for (const line of lines) {
  const m = line.match(/\"(Rp[^\"]+)\"/)
  if (m) console.log(m[1])
}
