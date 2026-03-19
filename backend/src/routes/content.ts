import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq, like, and, desc } from "drizzle-orm";
import { db, schema } from "../db/index";
import { authenticate } from "../middleware/auth";

const postSchema = z.object({
  type: z.enum(["blog", "case_study"]).default("blog"),
  title: z.string().min(1).max(300),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  excerpt: z.string().default(""),
  content: z.string().default(""),
  featuredImage: z.string().optional(),
  author: z.string().default("Stella Jimenez"),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  tags: z.array(z.string()).default([]),
  category: z.string().optional(),
  client: z.string().optional(),
  challenge: z.string().optional(),
  solution: z.string().optional(),
  results: z.string().optional(),
  testimonial: z.string().optional(),
});

const serviceSchema = z.object({
  title: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().default(""),
  icon: z.string().optional(),
  features: z.array(z.string()).default([]),
  price: z.string().optional(),
  duration: z.string().optional(),
  status: z.enum(["active", "archived"]).default("active"),
  sortOrder: z.number().default(0),
});

/** Converts a plain string to a URL-friendly slug */
function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Logs a platform activity entry (fire-and-forget) */
function logActivity(
  userEmail: string,
  action: string,
  resourceType: string,
  resourceId: string,
  resourceName: string
): void {
  void db.insert(schema.activityLog).values({
    id: nanoid(),
    userEmail,
    action,
    resourceType,
    resourceId,
    resourceName,
    metadata: "{}",
  });
}

/**
 * Registers content-related routes: blog posts, case studies, and services.
 * All routes require JWT authentication.
 */
export async function contentRoutes(app: FastifyInstance): Promise<void> {
  // ── Blog Posts & Case Studies ──────────────────────────────────────────────

  /** List content posts with optional type/status/search filters */
  app.get("/api/content/posts", { preHandler: authenticate }, async (request, reply) => {
    const q = request.query as {
      type?: string;
      status?: string;
      search?: string;
      limit?: string;
      offset?: string;
    };
    const limit = parseInt(q.limit ?? "20", 10);
    const offset = parseInt(q.offset ?? "0", 10);

    // Build conditions array
    const conditions = [];
    if (q.type) conditions.push(eq(schema.contentPosts.type, q.type as "blog" | "case_study"));
    if (q.status) conditions.push(eq(schema.contentPosts.status, q.status as "draft" | "published" | "archived"));
    if (q.search) conditions.push(like(schema.contentPosts.title, `%${q.search}%`));

    let results;
    if (conditions.length > 0) {
      results = await db
        .select()
        .from(schema.contentPosts)
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))
        .orderBy(desc(schema.contentPosts.updatedAt))
        .limit(limit)
        .offset(offset);
    } else {
      results = await db
        .select()
        .from(schema.contentPosts)
        .orderBy(desc(schema.contentPosts.updatedAt))
        .limit(limit)
        .offset(offset);
    }

    const total = (await db.select().from(schema.contentPosts)).length;

    return reply.send({
      success: true,
      data: results.map((p) => ({ ...p, tags: JSON.parse(p.tags) as string[] })),
      total,
      page: Math.floor(offset / limit),
      limit,
    });
  });

  /** Get single content post by ID */
  app.get("/api/content/posts/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [post] = await db
      .select()
      .from(schema.contentPosts)
      .where(eq(schema.contentPosts.id, id))
      .limit(1);

    if (!post) return reply.code(404).send({ success: false, error: "Not found" });
    return reply.send({ success: true, data: { ...post, tags: JSON.parse(post.tags) as string[] } });
  });

  /** Create a new content post */
  app.post("/api/content/posts", { preHandler: authenticate }, async (request, reply) => {
    const result = postSchema.safeParse(request.body);
    if (!result.success) return reply.code(400).send({ success: false, error: result.error.message });

    const data = result.data;
    const id = nanoid();
    const slug = data.slug ?? slugify(data.title);

    await db.insert(schema.contentPosts).values({
      id,
      type: data.type,
      title: data.title,
      slug,
      excerpt: data.excerpt,
      content: data.content,
      featuredImage: data.featuredImage,
      author: data.author,
      status: data.status,
      tags: JSON.stringify(data.tags),
      category: data.category,
      client: data.client,
      challenge: data.challenge,
      solution: data.solution,
      results: data.results,
      testimonial: data.testimonial,
    });

    const jwt = request.user as { email: string };
    logActivity(jwt.email ?? "system", "created", data.type, id, data.title);

    const [created] = await db.select().from(schema.contentPosts).where(eq(schema.contentPosts.id, id)).limit(1);
    return reply.code(201).send({ success: true, data: { ...created!, tags: JSON.parse(created!.tags) as string[] } });
  });

  /** Update a content post */
  app.put("/api/content/posts/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = postSchema.partial().safeParse(request.body);
    if (!result.success) return reply.code(400).send({ success: false, error: result.error.message });

    const data = result.data;
    const updateData: Record<string, unknown> = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    if (data.tags !== undefined) updateData["tags"] = JSON.stringify(data.tags);

    await db.update(schema.contentPosts).set(updateData).where(eq(schema.contentPosts.id, id));

    const [updated] = await db.select().from(schema.contentPosts).where(eq(schema.contentPosts.id, id)).limit(1);
    if (!updated) return reply.code(404).send({ success: false, error: "Not found" });

    const jwt = request.user as { email: string };
    logActivity(jwt.email ?? "system", "updated", updated.type, id, updated.title);

    return reply.send({ success: true, data: { ...updated, tags: JSON.parse(updated.tags) as string[] } });
  });

  /** Toggle publish/draft status for a content post */
  app.put("/api/content/posts/:id/publish", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [post] = await db.select().from(schema.contentPosts).where(eq(schema.contentPosts.id, id)).limit(1);
    if (!post) return reply.code(404).send({ success: false, error: "Not found" });

    const newStatus = post.status === "published" ? "draft" : "published";
    await db.update(schema.contentPosts).set({
      status: newStatus,
      publishedAt: newStatus === "published" ? new Date().toISOString() : post.publishedAt,
      updatedAt: new Date().toISOString(),
    }).where(eq(schema.contentPosts.id, id));

    return reply.send({ success: true, data: { status: newStatus } });
  });

  /** Delete a content post by ID */
  app.delete("/api/content/posts/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await db.delete(schema.contentPosts).where(eq(schema.contentPosts.id, id));
    return reply.send({ success: true });
  });

  // ── Services ───────────────────────────────────────────────────────────────

  /** List all services ordered by sortOrder */
  app.get("/api/content/services", { preHandler: authenticate }, async (_request, reply) => {
    const services = await db.select().from(schema.siteServices).orderBy(schema.siteServices.sortOrder);
    return reply.send({
      success: true,
      data: services.map((s) => ({ ...s, features: JSON.parse(s.features) as string[] })),
    });
  });

  /** Create a new service */
  app.post("/api/content/services", { preHandler: authenticate }, async (request, reply) => {
    const result = serviceSchema.safeParse(request.body);
    if (!result.success) return reply.code(400).send({ success: false, error: result.error.message });

    const data = result.data;
    const id = nanoid();
    await db.insert(schema.siteServices).values({
      id,
      title: data.title,
      slug: data.slug ?? slugify(data.title),
      description: data.description,
      icon: data.icon,
      features: JSON.stringify(data.features),
      price: data.price,
      duration: data.duration,
      status: data.status,
      sortOrder: data.sortOrder,
    });

    const [created] = await db.select().from(schema.siteServices).where(eq(schema.siteServices.id, id)).limit(1);
    return reply.code(201).send({ success: true, data: { ...created!, features: JSON.parse(created!.features) as string[] } });
  });

  /** Update an existing service */
  app.put("/api/content/services/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = serviceSchema.partial().safeParse(request.body);
    if (!result.success) return reply.code(400).send({ success: false, error: result.error.message });

    const data = result.data;
    const updateData: Record<string, unknown> = { ...data, updatedAt: new Date().toISOString() };
    if (data.features !== undefined) updateData["features"] = JSON.stringify(data.features);

    await db.update(schema.siteServices).set(updateData).where(eq(schema.siteServices.id, id));

    const [updated] = await db.select().from(schema.siteServices).where(eq(schema.siteServices.id, id)).limit(1);
    return reply.send({ success: true, data: { ...updated!, features: JSON.parse(updated!.features) as string[] } });
  });

  /** Delete a service by ID */
  app.delete("/api/content/services/:id", { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await db.delete(schema.siteServices).where(eq(schema.siteServices.id, id));
    return reply.send({ success: true });
  });
}
