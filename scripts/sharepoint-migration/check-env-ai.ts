import fs from "fs"

const envContent = fs.readFileSync(".env", "utf-8")
const lines = envContent.split("\n")
const aiKeys = lines
  .map(l => l.split("=")[0].trim())
  .filter(k => k && !k.startsWith("#") && /OCR|OLLAMA|OPENAI|ROUTER|VISION/i.test(k))

console.log("Configured AI/OCR Keys in .env:", aiKeys)
