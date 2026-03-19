import { GoogleGenerativeAI } from "@google/generative-ai";
import { db, schema } from "../db/index";
import { eq } from "drizzle-orm";
import { config } from "../config/index";
import type { LLMChatMessage, LLMProviderType } from "../types/index";

export const SYSTEM_CONTEXT = `You are Stella's Assistant, an AI specialized in helping Stella Jimenez — a business innovation and digital transformation consultant — build her professional website and manage her consultancy.

About Stella:
- She helps leaders and organizations turn vision into impact by connecting technology, design, purpose, and people
- Services: Business Diagnosis & Discovery, Digital Product Design, Innovation Strategy & Digital Transformation
- Target clients: C-suite executives, mid-to-large companies, entrepreneurs, startups
- Brand: Professional, approachable, forward-thinking, human-centered

Your capabilities:
1. Generate complete webpage content (hero sections, about, services, testimonials, CTAs)
2. Create clean, semantic HTML/CSS for website components
3. Write compelling copy that matches Stella's brand voice
4. Suggest layouts and design improvements
5. Help with CRM data organization and insights
6. Assist with deployment configurations

Always produce output that matches Stella's professional yet approachable tone.`;

export const LLM_PROVIDERS = [
  {
    id: "gemini" as LLMProviderType,
    name: "Gemini",
    description: "Google's AI — sign in with your Google account",
    authType: "oauth" as const,
    defaultModel: "gemini-2.0-flash-exp",
    freeTier: true,
    freeNote: "Free with your Google account",
    models: [
      { id: "gemini-2.0-flash-exp", name: "Gemini 2.0 Flash", note: "Fast · Free" },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", note: "Fast · Free" },
      { id: "gemini-1.5-flash-8b", name: "Gemini 1.5 Flash 8B", note: "Fastest · Free" },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", note: "Capable · Free (limited)" },
      { id: "gemini-2.0-flash-thinking-exp", name: "Gemini 2.0 Thinking", note: "Reasoning · Free" },
    ],
  },
  {
    id: "openai" as LLMProviderType,
    name: "ChatGPT / OpenAI",
    description: "OpenAI GPT models — requires API key",
    authType: "apikey" as const,
    defaultModel: "gpt-4o-mini",
    freeTier: false,
    freeNote: "Requires paid API credits",
    models: [
      { id: "gpt-4o", name: "GPT-4o", note: "Flagship" },
      { id: "gpt-4o-mini", name: "GPT-4o mini", note: "Fast · Affordable" },
      { id: "o3-mini", name: "o3-mini", note: "Reasoning" },
    ],
  },
  {
    id: "anthropic" as LLMProviderType,
    name: "Claude (Anthropic)",
    description: "Anthropic Claude models — requires API key",
    authType: "apikey" as const,
    defaultModel: "claude-haiku-4-5",
    freeTier: false,
    freeNote: "Requires paid API credits",
    models: [
      { id: "claude-opus-4-6", name: "Claude Opus 4.6", note: "Most capable" },
      { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", note: "Balanced" },
      { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", note: "Fast · Affordable" },
    ],
  },
  {
    id: "grok" as LLMProviderType,
    name: "Grok (xAI)",
    description: "Elon Musk's xAI Grok — requires API key",
    authType: "apikey" as const,
    defaultModel: "grok-3-mini",
    freeTier: false,
    freeNote: "Free tier available at xAI",
    models: [
      { id: "grok-3", name: "Grok 3", note: "Most capable" },
      { id: "grok-3-mini", name: "Grok 3 Mini", note: "Fast" },
      { id: "grok-2", name: "Grok 2", note: "Previous gen" },
    ],
  },
  {
    id: "ollama" as LLMProviderType,
    name: "Ollama (Local)",
    description: "Run AI models locally — completely free",
    authType: "url" as const,
    defaultModel: "llama3.2",
    freeTier: true,
    freeNote: "Free — runs on your machine",
    models: [
      { id: "llama3.2", name: "Llama 3.2", note: "Meta" },
      { id: "mistral", name: "Mistral 7B", note: "Fast" },
      { id: "gemma3", name: "Gemma 3", note: "Google" },
      { id: "qwen2.5", name: "Qwen 2.5", note: "Alibaba" },
      { id: "phi4", name: "Phi-4", note: "Microsoft" },
    ],
  },
];

// ─── Token refresh for Google OAuth ─────────────────────────────────────────

async function refreshGoogleToken(connectionId: string, refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json() as { access_token?: string; expires_in?: number; error?: string };

  if (!data.access_token) {
    throw new Error(`Google token refresh failed: ${data.error ?? "unknown"}`);
  }

  const expiry = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();

  await db
    .update(schema.llmConnections)
    .set({ accessToken: data.access_token, tokenExpiry: expiry, updatedAt: new Date().toISOString() })
    .where(eq(schema.llmConnections.id, connectionId));

  return data.access_token;
}

async function getValidGoogleToken(conn: typeof schema.llmConnections.$inferSelect): Promise<string> {
  if (!conn.refreshToken) throw new Error("No refresh token stored");

  const isExpired = conn.tokenExpiry
    ? new Date(conn.tokenExpiry).getTime() - Date.now() < 60_000
    : true;

  if (isExpired) {
    return refreshGoogleToken(conn.id, conn.refreshToken);
  }

  return conn.accessToken!;
}

// ─── Provider implementations ────────────────────────────────────────────────

async function chatGeminiOAuth(
  conn: typeof schema.llmConnections.$inferSelect,
  model: string,
  messages: LLMChatMessage[]
): Promise<string> {
  const token = await getValidGoogleToken(conn);
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: SYSTEM_CONTEXT }] },
      }),
    }
  );

  const data = await res.json() as {
    candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
    error?: { message: string };
  };

  if (data.error) throw new Error(data.error.message);
  return data.candidates?.[0]?.content.parts[0]?.text ?? "";
}

async function streamGeminiOAuth(
  conn: typeof schema.llmConnections.$inferSelect,
  model: string,
  messages: LLMChatMessage[],
  onChunk: (text: string) => void
): Promise<void> {
  const token = await getValidGoogleToken(conn);
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: SYSTEM_CONTEXT }] },
      }),
    }
  );

  const text = await res.text();
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    try {
      const d = JSON.parse(line.slice(6)) as {
        candidates?: Array<{ content: { parts: Array<{ text: string }> } }>;
      };
      const chunk = d.candidates?.[0]?.content.parts[0]?.text;
      if (chunk) onChunk(chunk);
    } catch { /* skip malformed lines */ }
  }
}

async function chatGeminiApiKey(
  apiKey: string,
  model: string,
  messages: LLMChatMessage[]
): Promise<string> {
  const client = new GoogleGenerativeAI(apiKey);
  const genModel = client.getGenerativeModel({ model, systemInstruction: SYSTEM_CONTEXT });

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" as const : "user" as const,
    parts: [{ text: m.content }],
  }));
  const lastMessage = messages[messages.length - 1]!.content;

  const chat = genModel.startChat({ history });
  const result = await chat.sendMessage(lastMessage);
  return result.response.text();
}

async function chatOpenAI(
  apiKey: string,
  model: string,
  messages: LLMChatMessage[],
  baseUrl = "https://api.openai.com/v1"
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_CONTEXT },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  const data = await res.json() as {
    choices?: Array<{ message: { content: string } }>;
    error?: { message: string };
  };

  if (data.error) throw new Error(data.error.message);
  return data.choices?.[0]?.message.content ?? "";
}

async function chatAnthropic(
  apiKey: string,
  model: string,
  messages: LLMChatMessage[]
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: SYSTEM_CONTEXT,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  const data = await res.json() as {
    content?: Array<{ type: string; text: string }>;
    error?: { message: string };
  };

  if (data.error) throw new Error(data.error.message);
  return data.content?.find((c) => c.type === "text")?.text ?? "";
}

async function chatOllama(
  ollamaUrl: string,
  model: string,
  messages: LLMChatMessage[]
): Promise<string> {
  const baseUrl = ollamaUrl.replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: SYSTEM_CONTEXT },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  const data = await res.json() as {
    message?: { content: string };
    error?: string;
  };

  if (data.error) throw new Error(data.error);
  return data.message?.content ?? "";
}

// ─── Active connection resolver ──────────────────────────────────────────────

async function getActiveConnection(): Promise<{
  conn: typeof schema.llmConnections.$inferSelect | null;
  provider: LLMProviderType;
  model: string;
}> {
  // Check settings for active connection preference
  const [providerSetting] = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, "llm_active_connection_id"))
    .limit(1);

  const [modelSetting] = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, "llm_active_model"))
    .limit(1);

  if (providerSetting?.value) {
    const [conn] = await db
      .select()
      .from(schema.llmConnections)
      .where(eq(schema.llmConnections.id, providerSetting.value))
      .limit(1);

    if (conn) {
      const model = modelSetting?.value || conn.selectedModel || getDefaultModel(conn.provider as LLMProviderType);
      return { conn, provider: conn.provider as LLMProviderType, model };
    }
  }

  // Fallback: use first available connection
  const [firstConn] = await db.select().from(schema.llmConnections).limit(1);
  if (firstConn) {
    const model = firstConn.selectedModel || getDefaultModel(firstConn.provider as LLMProviderType);
    return { conn: firstConn, provider: firstConn.provider as LLMProviderType, model };
  }

  // Last resort: use Gemini API key from config/settings
  return { conn: null, provider: "gemini", model: config.gemini.model };
}

function getDefaultModel(provider: LLMProviderType): string {
  return LLM_PROVIDERS.find((p) => p.id === provider)?.defaultModel ?? "gemini-2.0-flash-exp";
}

// ─── Public LLM service ───────────────────────────────────────────────────────

export const llmService = {
  async chat(messages: LLMChatMessage[]): Promise<string> {
    const { conn, provider, model } = await getActiveConnection();

    if (!conn) {
      // Fallback to env Gemini API key
      const apiKey = config.gemini.apiKey;
      if (!apiKey) throw new Error("No LLM provider connected. Go to Settings → AI Providers.");
      return chatGeminiApiKey(apiKey, model, messages);
    }

    switch (provider) {
      case "gemini":
        if (conn.isOAuth) return chatGeminiOAuth(conn, model, messages);
        return chatGeminiApiKey(conn.apiKey!, model, messages);

      case "openai":
        return chatOpenAI(conn.apiKey!, model, messages);

      case "grok":
        return chatOpenAI(conn.apiKey!, model, messages, "https://api.x.ai/v1");

      case "anthropic":
        return chatAnthropic(conn.apiKey!, model, messages);

      case "ollama":
        return chatOllama(conn.ollamaUrl ?? "http://localhost:11434", model, messages);

      default:
        throw new Error(`Unknown provider: ${String(provider)}`);
    }
  },

  async streamChat(
    messages: LLMChatMessage[],
    onChunk: (text: string) => void
  ): Promise<void> {
    const { conn, provider, model } = await getActiveConnection();

    if (!conn || provider !== "gemini") {
      // For non-Gemini or no connection: do full chat and emit as one chunk
      const response = await llmService.chat(messages);
      onChunk(response);
      return;
    }

    if (conn.isOAuth) {
      await streamGeminiOAuth(conn, model, messages, onChunk);
    } else {
      // Gemini SDK streaming
      const client = new GoogleGenerativeAI(conn.apiKey ?? config.gemini.apiKey);
      const genModel = client.getGenerativeModel({ model, systemInstruction: SYSTEM_CONTEXT });
      const history = messages.slice(0, -1).map((m) => ({
        role: m.role === "assistant" ? "model" as const : "user" as const,
        parts: [{ text: m.content }],
      }));
      const lastMessage = messages[messages.length - 1]!.content;
      const chat = genModel.startChat({ history });
      const stream = await chat.sendMessageStream(lastMessage);
      for await (const chunk of stream.stream) {
        const text = chunk.text();
        if (text) onChunk(text);
      }
    }
  },

  async generateContent(prompt: string): Promise<string> {
    return llmService.chat([{ role: "user", content: prompt }]);
  },

  async getActive() {
    return getActiveConnection();
  },

  providers: LLM_PROVIDERS,
};
