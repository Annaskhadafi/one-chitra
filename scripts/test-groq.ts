// Quick test script for Groq API - v2 with max_tokens
async function main() {
    const GROQ_API_KEY = "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";
    const GROQ_MODEL = "qwen/qwen3-32b";

    const prompt = `Anda adalah AI Analis Inventory berpengalaman.
Tugas Anda adalah menghitung Dynamic Safety Stock.
Material: 112112A301 - 7.00-12/5.00 XP1000.
Stok saat ini: 100.
Histori Penjualan: 2025-01: 10, 2025-02: 15, 2025-03: 8

Hitung Safety Stock optimal.
Jawab HANYA dengan JSON:
{"recommendedStock": 500, "rationale": "penjelasan singkat"}`;

    console.log("Calling Groq API with max_tokens: 8192...");
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${GROQ_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
                { role: "system", content: "Respond with ONLY a JSON object: {\"recommendedStock\": number, \"rationale\": \"string in Indonesian\"}. No other text." },
                { role: "user", content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 8192
        })
    });

    if (!response.ok) {
        console.error("API Error:", response.status, await response.text());
        process.exit(1);
    }

    const json = await response.json();
    const content = json.choices[0]?.message?.content || "";
    const finishReason = json.choices[0]?.finish_reason;

    console.log("\n=== FINISH REASON ===", finishReason);
    console.log("\n=== RAW CONTENT (length:", content.length, ") ===");

    // Check for think tags
    const hasThink = content.includes("<think>");
    const hasThinkEnd = content.includes("</think>");
    console.log("Has <think>:", hasThink, "Has </think>:", hasThinkEnd);

    if (hasThinkEnd) {
        const afterThink = content.substring(content.lastIndexOf("</think>") + 8).trim();
        console.log("\n=== CONTENT AFTER </think> ===");
        console.log(afterThink);

        // Extract JSON 
        const openBrace = afterThink.indexOf('{');
        const closeBrace = afterThink.lastIndexOf('}');
        if (openBrace !== -1 && closeBrace > openBrace) {
            const jsonStr = afterThink.substring(openBrace, closeBrace + 1);
            console.log("\n=== EXTRACTED JSON ===");
            console.log(jsonStr);
            try {
                console.log("\n=== PARSED ===");
                console.log(JSON.parse(jsonStr));
            } catch (e) {
                console.error("Parse failed:", e);
            }
        } else {
            console.log("NO JSON FOUND after </think> tag!");
        }
    } else {
        console.log("\n=== FULL CONTENT (no think tags) ===");
        console.log(content);
    }
}

main().catch(console.error);
