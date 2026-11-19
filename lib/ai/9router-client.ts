import "dotenv/config";

/**
 * Interface Message yang kompatibel dengan format OpenAI / 9Router / Ollama
 */
export interface AiChatMessage {
    role: "system" | "user" | "assistant" | "tool";
    content: string | null;
    name?: string;
    tool_call_id?: string;
    tool_calls?: Array<{
        id: string;
        type: "function";
        function: {
            name: string;
            arguments: string;
        };
    }>;
}

/**
 * Interface Tool Definition untuk Function Calling
 */
export interface AiToolDefinition {
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: {
            type: "object";
            properties: Record<string, any>;
            required?: string[];
        };
    };
}

export interface NineRouterClientOptions {
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    timeoutMs?: number;
    ollamaUrl?: string;
    ollamaModel?: string;
    ollamaApiKey?: string;
}

export interface ChatCompletionResponse {
    success: boolean;
    provider: "9router" | "ollama" | "fallback";
    message: AiChatMessage;
    finishReason?: string;
    rawError?: string;
}

export class NineRouterClient {
    private baseUrl: string;
    private apiKey: string;
    private model: string;
    private timeoutMs: number;
    private ollamaUrl: string;
    private ollamaModel: string;
    private ollamaApiKey: string;

    constructor(options: NineRouterClientOptions = {}) {
        this.baseUrl = (
            options.baseUrl ||
            process.env.OPENAI_BASE_URL ||
            process.env.NINEROUTER_URL ||
            "https://9router.chitraparatama.com"
        ).replace(/\/$/, "");

        this.apiKey =
            options.apiKey ||
            process.env.OPENAI_API_KEY ||
            process.env.NINEROUTER_KEY ||
            process.env.INSTAGRAM_IMAGE_API_KEY ||
            "";

        this.model = options.model || process.env.OPENAI_MODEL || process.env.NINEROUTER_MODEL || "cx/gpt-5.6-luna";
        this.timeoutMs = options.timeoutMs || 30000;

        const rawOllama = (
            options.ollamaUrl ||
            process.env.OLLAMA_URL ||
            "http://localhost:11434"
        ).replace(/\/$/, "");
        this.ollamaUrl = rawOllama.endsWith("/api/chat") ? rawOllama : `${rawOllama}/api/chat`;

        this.ollamaModel =
            options.ollamaModel || process.env.OLLAMA_MODEL || "glm-5.3-flash:cloud";
        this.ollamaApiKey = options.ollamaApiKey || process.env.OLLAMA_API_KEY || "";
    }

    /**
     * Memanggil Chat Completion ke 9Router dengan auto-fallback ke Ollama
     */
    async chatCompletion(
        messages: AiChatMessage[],
        tools?: AiToolDefinition[],
        overrideOptions?: { model?: string; temperature?: number }
    ): Promise<ChatCompletionResponse> {
        let routerError: string | null = null;

        // 1. Percobaan Primer: 9Router Gateway
        try {
            const endpoint = `${this.baseUrl}/v1/chat/completions`;
            const payload: any = {
                model: overrideOptions?.model || this.model,
                messages,
                temperature: overrideOptions?.temperature ?? 0.2,
                stream: false,
            };

            if (tools && tools.length > 0) {
                payload.tools = tools;
                payload.tool_choice = "auto";
            }

            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            if (this.apiKey) {
                headers["Authorization"] = `Bearer ${this.apiKey}`;
            }

            const response = await fetch(endpoint, {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(this.timeoutMs),
            });

            if (response.ok) {
                const data = await response.json();
                const choice = data.choices?.[0];
                if (choice?.message) {
                    const normalizedMessage = this.normalizeOpenAiMessage(choice.message);
                    return {
                        success: true,
                        provider: "9router",
                        message: normalizedMessage,
                        finishReason: choice.finish_reason || "stop",
                    };
                }
            } else {
                const errorText = await response.text();
                routerError = `9Router HTTP ${response.status}: ${errorText}`;
                console.warn(`[9Router] Panggilan gagal (${response.status}), bersiap fallback ke Ollama... Detail:`, errorText.slice(0, 160));
            }
        } catch (err: any) {
            routerError = `9Router Network/Timeout Error: ${err.message}`;
            console.warn(`[9Router] Koneksi gagal/timeout (${err.message}), beralih ke fallback Ollama...`);
        }

        // 2. Percobaan Sekunder: Fallback ke Ollama
        try {
            console.log(`[AI Fallback] Menghubungi Ollama di ${this.ollamaUrl} (model: ${this.ollamaModel})...`);
            const ollamaPayload: any = {
                model: this.ollamaModel,
                messages: messages.map((m) => ({
                    role: m.role,
                    content: m.content || "",
                })),
                stream: false,
            };

            if (tools && tools.length > 0) {
                ollamaPayload.tools = tools;
            }

            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            if (this.ollamaApiKey) {
                headers["Authorization"] = `Bearer ${this.ollamaApiKey}`;
            }

            const ollamaResponse = await fetch(this.ollamaUrl, {
                method: "POST",
                headers,
                body: JSON.stringify(ollamaPayload),
                signal: AbortSignal.timeout(this.timeoutMs),
            });

            if (ollamaResponse.ok) {
                const ollamaData = await ollamaResponse.json();
                const choiceMessage = ollamaData.message;
                if (choiceMessage) {
                    const normalizedMessage = this.normalizeOllamaMessage(choiceMessage);
                    return {
                        success: true,
                        provider: "ollama",
                        message: normalizedMessage,
                        finishReason: ollamaData.done_reason || "stop",
                    };
                }
            } else {
                const ollamaErrorText = await ollamaResponse.text();
                console.warn(`[Ollama Fallback] HTTP ${ollamaResponse.status}: ${ollamaErrorText.slice(0, 160)}`);
            }
        } catch (ollamaErr: any) {
            console.warn(`[Ollama Fallback] Error: ${ollamaErr.message}`);
        }

        // 3. Jika kedua gateway LLM eksternal tidak dapat merespons
        return {
            success: false,
            provider: "fallback",
            message: {
                role: "assistant",
                content: null,
            },
            rawError: routerError || "AI Gateway unreachable",
        };
    }

    private normalizeOpenAiMessage(msg: any): AiChatMessage {
        const normalized: AiChatMessage = {
            role: msg.role || "assistant",
            content: msg.content ?? null,
        };

        if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
            normalized.tool_calls = msg.tool_calls.map((tc: any, index: number) => ({
                id: tc.id || `call_${Date.now()}_${index}`,
                type: "function",
                function: {
                    name: tc.function?.name || "",
                    arguments:
                        typeof tc.function?.arguments === "string"
                            ? tc.function.arguments
                            : JSON.stringify(tc.function?.arguments || {}),
                },
            }));
        }

        return normalized;
    }

    private normalizeOllamaMessage(msg: any): AiChatMessage {
        const normalized: AiChatMessage = {
            role: msg.role || "assistant",
            content: msg.content ?? null,
        };

        if (Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
            normalized.tool_calls = msg.tool_calls.map((tc: any, index: number) => ({
                id: `ollama_call_${Date.now()}_${index}`,
                type: "function",
                function: {
                    name: tc.function?.name || "",
                    arguments:
                        typeof tc.function?.arguments === "string"
                            ? tc.function.arguments
                            : JSON.stringify(tc.function?.arguments || {}),
                },
            }));
        }

        return normalized;
    }
}

export const defaultNineRouterClient = new NineRouterClient();
