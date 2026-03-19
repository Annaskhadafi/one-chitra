"use server"

export async function generateEmailHtml(prompt: string, history: { role: string; content: string }[] = []) {
  const baseUrl = (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/$/, "")
  const ollamaModel = process.env.OLLAMA_MODEL || "kimi-k2.5:cloud"
  const ollamaApiKey = process.env.OLLAMA_API_KEY || ""

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ollamaApiKey ? { "Authorization": `Bearer ${ollamaApiKey}` } : {}),
      },
      body: JSON.stringify({
        model: ollamaModel,
        messages: [
          {
            role: "system",
            content: `You are a World-Class Professional Email Designer and Copywriter Expert for "One Chitra" (a company specializing in Tires/Ban and industrial equipment). 
            Your expertise covers both high-converting marketing campaigns and clear, professional notification emails.
            
            Key Capabilities & Requirements:
            1. Visual Excellence: Create stunning, modern, and mobile-responsive HTML layouts. Use professional color palettes, clean typography (Arial/sans-serif), and balanced whitespace.
            2. Professional Copywriting: Write persuasive, engaging, and professional copy in the language requested (defaulting to Indonesian if not specified).
            3. Responsive Design: Use solid inline CSS to ensure the email looks perfect on all devices and email clients.
            4. Dynamic Personalization: Naturally integrate placeholders like {{name}}, {{company}}, or {{position}}.
            5. Design Aesthetics: Use rounded corners, subtle borders, and professional headers/footers.
            
            Strict Rules:
            - ONLY output the raw HTML code. 
            - DO NOT include any preamble, introduction, or post-explanation.
            - DO NOT wrap the code in markdown backticks (\`\`\`).
            - Ensure the design feels premium and state-of-the-art.
            `
          },
          ...history,
          { role: "user", content: prompt }
        ],
        stream: false,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      try {
        const errorData = JSON.parse(errorText)
        throw new Error(errorData.error || `Failed to connect to Ollama: ${response.statusText}`)
      } catch (e) {
        throw new Error(`Failed to connect to Ollama: ${response.statusText}. Response: ${errorText.substring(0, 100)}`)
      }
    }

    const data = await response.json()
    let html = data.message?.content || ""
    
    // Clean up HTML if AI adds markdown backticks
    html = html.replace(/```html/g, "").replace(/```/g, "").trim()

    return { success: true, html }
  } catch (error: any) {
    console.error("Ollama Error:", error)
    return { success: false, error: error.message }
  }
}
