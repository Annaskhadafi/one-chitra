import "dotenv/config"

async function testOcr() {
  const openAiKey = process.env.OPENAI_API_KEY?.trim()
  const rawBaseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://9router.chitraparatama.com/v1"
  const baseUrl = rawBaseUrl.replace(/\/$/, "")
  const endpoint = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`
  const model = process.env.OPENAI_MODEL?.trim() || "cx/gpt-5.6-luna"

  console.log("Endpoint:", endpoint)
  console.log("Model:", model)
  console.log("Has Key:", !!openAiKey)

  const ollamaUrl = process.env.OLLAMA_URL?.trim()
  const ollamaModel = process.env.OLLAMA_MODEL?.trim()
  console.log("Ollama URL:", ollamaUrl, "Model:", ollamaModel)

  const rarayUrl = process.env.RARAY_VISION_API_BASE_URL
  console.log("Raray URL:", rarayUrl)
}

testOcr().then(() => process.exit(0)).catch(console.error)
