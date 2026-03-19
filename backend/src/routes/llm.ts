import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import { authenticate } from "../middleware/auth";
import { config } from "../config/index";
import { llmService } from "../services/llm";

const connectSchema = z.object({
  provider: z.enum(["openai", "anthropic", "grok", "ollama"]),
  apiKey: z.string().optional(),
  ollamaUrl: z.string().optional(),
  selectedModel: z.string().min(1),
});

const setActiveSchema = z.object({
  connectionId: z.string(),
  model: z.string().min(1),
});

// ─── Safe connection (strips secrets) ────────────────────────────────────────

function safeConn(c: typeof schema.llmConnections.$inferSelect) {
  return {
    id: c.id,
    provider: c.provider,
    displayName: c.displayName,
    email: c.email ?? undefined,
    selectedModel: c.selectedModel,
    isOAuth: c.isOAuth,
    createdAt: c.createdAt,
    hasCredentials: !!(c.apiKey || c.accessToken || c.ollamaUrl),
  };
}

export async function llmRoutes(app: FastifyInstance): Promise<void> {
  // ── List supported providers ──────────────────────────────────────────────
  app.get("/api/llm/providers", { preHandler: authenticate }, async (_req, reply) => {
    return reply.send({ success: true, data: llmService.providers });
  });

  // ── List connected providers ──────────────────────────────────────────────
  app.get("/api/llm/connections", { preHandler: authenticate }, async (_req, reply) => {
    const connections = await db.select().from(schema.llmConnections);
    return reply.send({ success: true, data: connections.map(safeConn) });
  });

  // ── Connect an API-key provider ───────────────────────────────────────────
  app.post("/api/llm/connections", { preHandler: authenticate }, async (request, reply) => {
    const result = connectSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ success: false, error: result.error.message });
    }

    const { provider, apiKey, ollamaUrl, selectedModel } = result.data;

    const def = llmService.providers.find((p) => p.id === provider);
    if (!def) {
      return reply.code(400).send({ success: false, error: "Unknown provider" });
    }

    // Remove existing connection for this provider
    await db.delete(schema.llmConnections).where(eq(schema.llmConnections.provider, provider));

    const id = nanoid();
    await db.insert(schema.llmConnections).values({
      id,
      provider,
      displayName: def.name,
      apiKey: apiKey ?? null,
      ollamaUrl: ollamaUrl ?? null,
      selectedModel,
      isOAuth: false,
    });

    // Auto-set as active if it's the only connection
    const allConns = await db.select().from(schema.llmConnections);
    if (allConns.length === 1) {
      await db
        .insert(schema.settings)
        .values({ key: "llm_active_connection_id", value: id, updatedAt: new Date().toISOString() })
        .onConflictDoUpdate({
          target: schema.settings.key,
          set: { value: id, updatedAt: new Date().toISOString() },
        });
      await db
        .insert(schema.settings)
        .values({ key: "llm_active_model", value: selectedModel, updatedAt: new Date().toISOString() })
        .onConflictDoUpdate({
          target: schema.settings.key,
          set: { value: selectedModel, updatedAt: new Date().toISOString() },
        });
    }

    const [conn] = await db.select().from(schema.llmConnections).where(eq(schema.llmConnections.id, id)).limit(1);
    return reply.send({ success: true, data: safeConn(conn!) });
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  app.delete("/api/llm/connections/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await db.delete(schema.llmConnections).where(eq(schema.llmConnections.id, id));

    // Clear active if this was it
    const [active] = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, "llm_active_connection_id"))
      .limit(1);

    if (active?.value === id) {
      const [next] = await db.select().from(schema.llmConnections).limit(1);
      const nextId = next?.id ?? "";
      await db
        .insert(schema.settings)
        .values({ key: "llm_active_connection_id", value: nextId, updatedAt: new Date().toISOString() })
        .onConflictDoUpdate({
          target: schema.settings.key,
          set: { value: nextId, updatedAt: new Date().toISOString() },
        });
    }

    return reply.send({ success: true });
  });

  // ── Get active provider ───────────────────────────────────────────────────
  app.get("/api/llm/active", { preHandler: authenticate }, async (_req, reply) => {
    const active = await llmService.getActive();
    return reply.send({
      success: true,
      data: {
        connectionId: active.conn?.id ?? null,
        provider: active.provider,
        model: active.model,
        displayName: active.conn?.displayName ?? "Gemini (env key)",
        email: active.conn?.email ?? null,
      },
    });
  });

  // ── Set active provider ───────────────────────────────────────────────────
  app.put("/api/llm/active", { preHandler: authenticate }, async (request, reply) => {
    const result = setActiveSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ success: false, error: result.error.message });
    }

    const { connectionId, model } = result.data;

    const [conn] = await db
      .select()
      .from(schema.llmConnections)
      .where(eq(schema.llmConnections.id, connectionId))
      .limit(1);

    if (!conn) {
      return reply.code(404).send({ success: false, error: "Connection not found" });
    }

    // Update selected model on the connection
    await db
      .update(schema.llmConnections)
      .set({ selectedModel: model, updatedAt: new Date().toISOString() })
      .where(eq(schema.llmConnections.id, connectionId));

    // Store as active in settings
    for (const [key, value] of [
      ["llm_active_connection_id", connectionId],
      ["llm_active_model", model],
    ] as const) {
      await db
        .insert(schema.settings)
        .values({ key, value, updatedAt: new Date().toISOString() })
        .onConflictDoUpdate({
          target: schema.settings.key,
          set: { value, updatedAt: new Date().toISOString() },
        });
    }

    return reply.send({ success: true });
  });

  // ── Google OAuth — start ──────────────────────────────────────────────────
  // Note: accepts token as query param because browser redirects can't set auth headers
  app.get("/api/llm/oauth/google/start", async (request, reply) => {
    if (!config.google.clientId) {
      return reply.code(400).send({
        success: false,
        error: "Google OAuth not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your .env file.",
      });
    }

    // Validate the JWT from query param
    const { token } = request.query as { token?: string };
    if (!token) {
      return reply.redirect(`${config.app.frontendUrl}/settings?llm_error=unauthorized`);
    }
    try {
      await request.jwtVerify({ onlyCookie: false });
    } catch {
      // Accept token from query param
      try {
        app.jwt.verify(token);
      } catch {
        return reply.redirect(`${config.app.frontendUrl}/settings?llm_error=unauthorized`);
      }
    }

    const state = nanoid(32);
    const jwt = token;

    await db
      .insert(schema.settings)
      .values({ key: `oauth_state_${state}`, value: jwt, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({
        target: schema.settings.key,
        set: { value: jwt, updatedAt: new Date().toISOString() },
      });

    const params = new URLSearchParams({
      client_id: config.google.clientId,
      redirect_uri: config.google.redirectUri,
      response_type: "code",
      scope: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/generative-language",
      ].join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    });

    return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  // ── Google OAuth — callback ───────────────────────────────────────────────
  app.get("/api/llm/oauth/google/callback", async (request, reply) => {
    const { code, state, error } = request.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    const frontendUrl = config.app.frontendUrl;

    if (error || !code || !state) {
      return reply.redirect(`${frontendUrl}/settings?llm_error=${error ?? "cancelled"}`);
    }

    // Validate state
    const [stateRecord] = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, `oauth_state_${state}`))
      .limit(1);

    if (!stateRecord) {
      return reply.redirect(`${frontendUrl}/settings?llm_error=invalid_state`);
    }

    // Clean up state
    await db.delete(schema.settings).where(eq(schema.settings.key, `oauth_state_${state}`));

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: config.google.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
    };

    if (tokens.error || !tokens.access_token) {
      return reply.redirect(`${frontendUrl}/settings?llm_error=${tokens.error ?? "token_exchange_failed"}`);
    }

    // Get user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userRes.json() as { email?: string; name?: string };

    const expiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();
    const defaultModel = "gemini-2.0-flash-exp";

    // Remove existing Gemini OAuth connection
    await db
      .delete(schema.llmConnections)
      .where(eq(schema.llmConnections.provider, "gemini"));

    const id = nanoid();
    await db.insert(schema.llmConnections).values({
      id,
      provider: "gemini",
      displayName: `Gemini (${userInfo.email ?? userInfo.name ?? "Google Account"})`,
      email: userInfo.email ?? null,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      tokenExpiry: expiry,
      selectedModel: defaultModel,
      isOAuth: true,
    });

    // Set as active
    for (const [key, value] of [
      ["llm_active_connection_id", id],
      ["llm_active_model", defaultModel],
    ] as const) {
      await db
        .insert(schema.settings)
        .values({ key, value, updatedAt: new Date().toISOString() })
        .onConflictDoUpdate({
          target: schema.settings.key,
          set: { value, updatedAt: new Date().toISOString() },
        });
    }

    return reply.redirect(`${frontendUrl}/settings?llm_connected=gemini`);
  });
}
