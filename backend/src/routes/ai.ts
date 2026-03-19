import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { geminiService, type GeminiMessage } from "../services/gemini.js";
import { authenticate } from "../middleware/auth.js";

const chatSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1),
  context: z.string().optional(),
});

const generatePageSchema = z.object({
  prompt: z.string().min(1),
});

const generateCopySchema = z.object({
  type: z.enum(["hero", "about", "services", "cta", "bio", "testimonial"]),
  context: z.string().optional(),
});

export async function aiRoutes(app: FastifyInstance): Promise<void> {
  // Chat with Gemini
  app.post("/api/ai/chat", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const result = chatSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ success: false, error: result.error.message });
    }

    const { sessionId, message, context } = result.data;

    // Get or create session
    let session: typeof schema.aiSessions.$inferSelect | undefined;
    let messages: GeminiMessage[] = [];

    if (sessionId) {
      const [existing] = await db
        .select()
        .from(schema.aiSessions)
        .where(eq(schema.aiSessions.id, sessionId))
        .limit(1);

      if (existing) {
        session = existing;
        messages = JSON.parse(existing.messages) as GeminiMessage[];
      }
    }

    if (!session) {
      const id = nanoid();
      const title = message.slice(0, 60) + (message.length > 60 ? "..." : "");
      await db.insert(schema.aiSessions).values({
        id,
        title,
        messages: "[]",
        context,
      });

      const [newSession] = await db
        .select()
        .from(schema.aiSessions)
        .where(eq(schema.aiSessions.id, id))
        .limit(1);

      session = newSession;
    }

    const response = await geminiService.chat(messages, message);

    // Update session with new messages
    const updatedMessages: GeminiMessage[] = [
      ...messages,
      { role: "user", parts: [{ text: message }] },
      { role: "model", parts: [{ text: response }] },
    ];

    await db
      .update(schema.aiSessions)
      .set({
        messages: JSON.stringify(updatedMessages),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.aiSessions.id, session!.id));

    return reply.send({
      success: true,
      data: {
        sessionId: session!.id,
        response,
        messageCount: updatedMessages.length,
      },
    });
  });

  // Stream chat
  app.post("/api/ai/chat/stream", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const result = chatSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ success: false, error: result.error.message });
    }

    const { sessionId, message } = result.data;

    let messages: GeminiMessage[] = [];
    let resolvedSessionId = sessionId;

    if (sessionId) {
      const [existing] = await db
        .select()
        .from(schema.aiSessions)
        .where(eq(schema.aiSessions.id, sessionId))
        .limit(1);

      if (existing) {
        messages = JSON.parse(existing.messages) as GeminiMessage[];
      }
    } else {
      const id = nanoid();
      await db.insert(schema.aiSessions).values({
        id,
        title: message.slice(0, 60),
        messages: "[]",
      });
      resolvedSessionId = id;
    }

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Session-Id", resolvedSessionId ?? "");

    let fullResponse = "";

    await geminiService.streamChat(messages, message, (chunk) => {
      fullResponse += chunk;
      reply.raw.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    });

    // Save to session
    if (resolvedSessionId) {
      const updatedMessages: GeminiMessage[] = [
        ...messages,
        { role: "user", parts: [{ text: message }] },
        { role: "model", parts: [{ text: fullResponse }] },
      ];

      await db
        .update(schema.aiSessions)
        .set({
          messages: JSON.stringify(updatedMessages),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.aiSessions.id, resolvedSessionId));
    }

    reply.raw.write(`data: ${JSON.stringify({ done: true, sessionId: resolvedSessionId })}\n\n`);
    reply.raw.end();
  });

  // Generate page content
  app.post("/api/ai/generate/page", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const result = generatePageSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ success: false, error: result.error.message });
    }

    const pageContent = await geminiService.generatePageContent(result.data.prompt);

    return reply.send({
      success: true,
      data: pageContent,
    });
  });

  // Generate copy
  app.post("/api/ai/generate/copy", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const result = generateCopySchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ success: false, error: result.error.message });
    }

    const copy = await geminiService.generateCopy(result.data.type, result.data.context);

    return reply.send({
      success: true,
      data: { copy },
    });
  });

  // List sessions
  app.get("/api/ai/sessions", {
    preHandler: authenticate,
  }, async (_request, reply) => {
    const sessions = await db
      .select({
        id: schema.aiSessions.id,
        title: schema.aiSessions.title,
        createdAt: schema.aiSessions.createdAt,
        updatedAt: schema.aiSessions.updatedAt,
      })
      .from(schema.aiSessions)
      .orderBy(schema.aiSessions.updatedAt);

    return reply.send({ success: true, data: sessions });
  });

  // Get session
  app.get("/api/ai/sessions/:id", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [session] = await db
      .select()
      .from(schema.aiSessions)
      .where(eq(schema.aiSessions.id, id))
      .limit(1);

    if (!session) {
      return reply.code(404).send({ success: false, error: "Session not found" });
    }

    return reply.send({
      success: true,
      data: {
        ...session,
        messages: JSON.parse(session.messages),
      },
    });
  });

  // Delete session
  app.delete("/api/ai/sessions/:id", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await db.delete(schema.aiSessions).where(eq(schema.aiSessions.id, id));
    return reply.send({ success: true });
  });
}
