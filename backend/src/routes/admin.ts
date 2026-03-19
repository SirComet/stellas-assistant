import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "../db/index";
import { authenticate } from "../middleware/auth";
import { hash } from "bcryptjs";
import fs from "fs";
import { config } from "../config/index";

/** Middleware that requires admin role — calls authenticate then checks role */
async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await authenticate(request, reply);
  const user = request.user as { role?: string };
  if (user.role !== "admin") {
    reply.code(403).send({ success: false, error: "Admin access required" });
  }
}

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(["admin", "editor", "viewer"]).default("editor"),
});

const updateRoleSchema = z.object({
  role: z.enum(["admin", "editor", "viewer"]),
});

/**
 * Registers admin-only routes: user management, DB stats, and activity log.
 * All routes require admin role via requireAdmin middleware.
 */
export async function adminRoutes(app: FastifyInstance): Promise<void> {
  /** List all users (sensitive fields excluded) */
  app.get("/api/admin/users", { preHandler: requireAdmin }, async (_request, reply) => {
    const users = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        active: schema.users.active,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .orderBy(schema.users.createdAt);

    return reply.send({ success: true, data: users });
  });

  /** Create / invite a new user with hashed password */
  app.post("/api/admin/users", { preHandler: requireAdmin }, async (request, reply) => {
    const result = createUserSchema.safeParse(request.body);
    if (!result.success) return reply.code(400).send({ success: false, error: result.error.message });

    const { email, name, password, role } = result.data;
    const passwordHash = await hash(password, 10);
    const id = nanoid();

    await db.insert(schema.users).values({ id, email, name, passwordHash, role });
    return reply.code(201).send({ success: true, data: { id, email, name, role } });
  });

  /** Update a user's role */
  app.put("/api/admin/users/:id/role", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = updateRoleSchema.safeParse(request.body);
    if (!result.success) return reply.code(400).send({ success: false, error: result.error.message });

    await db
      .update(schema.users)
      .set({ role: result.data.role, updatedAt: new Date().toISOString() })
      .where(eq(schema.users.id, id));
    return reply.send({ success: true });
  });

  /** Activate or deactivate a user account */
  app.put("/api/admin/users/:id/active", { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { active } = request.body as { active: boolean };
    await db
      .update(schema.users)
      .set({ active, updatedAt: new Date().toISOString() })
      .where(eq(schema.users.id, id));
    return reply.send({ success: true });
  });

  /** Database statistics: table row counts and DB file size in bytes */
  app.get("/api/admin/db-stats", { preHandler: requireAdmin }, async (_request, reply) => {
    const tables = [
      { name: "users", table: schema.users },
      { name: "pages", table: schema.pages },
      { name: "contacts", table: schema.contacts },
      { name: "projects", table: schema.projects },
      { name: "content_posts", table: schema.contentPosts },
      { name: "site_services", table: schema.siteServices },
      { name: "deployments", table: schema.deployments },
      { name: "ai_sessions", table: schema.aiSessions },
      { name: "media", table: schema.media },
    ] as const;

    const counts: Record<string, number> = {};
    for (const { name, table } of tables) {
      counts[name] = (await db.select().from(table)).length;
    }

    let fileSizeBytes = 0;
    try {
      const stat = fs.statSync(config.database.url);
      fileSizeBytes = stat.size;
    } catch { /* ignore if file not found */ }

    return reply.send({ success: true, data: { counts, fileSizeBytes } });
  });

  /** Paginated platform activity log ordered by most recent first */
  app.get("/api/admin/activity", { preHandler: requireAdmin }, async (request, reply) => {
    const { limit = "50", offset = "0" } = request.query as { limit?: string; offset?: string };
    const lim = parseInt(limit, 10);
    const off = parseInt(offset, 10);

    const entries = await db
      .select()
      .from(schema.activityLog)
      .orderBy(desc(schema.activityLog.createdAt))
      .limit(lim)
      .offset(off);

    return reply.send({
      success: true,
      data: entries.map((e) => ({
        ...e,
        metadata: JSON.parse(e.metadata) as Record<string, unknown>,
      })),
    });
  });
}
