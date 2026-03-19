import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq, like, desc } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { authenticate } from "../middleware/auth.js";

const pageSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  content: z.string().optional(),
  metadata: z.string().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  template: z.string().optional(),
});

export async function pagesRoutes(app: FastifyInstance): Promise<void> {
  // List pages
  app.get("/api/pages", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const query = request.query as { search?: string; status?: string; limit?: string; offset?: string };
    const limit = parseInt(query.limit ?? "20", 10);
    const offset = parseInt(query.offset ?? "0", 10);

    let pagesQuery = db.select().from(schema.pages).orderBy(desc(schema.pages.updatedAt));

    if (query.search) {
      pagesQuery = db
        .select()
        .from(schema.pages)
        .where(like(schema.pages.title, `%${query.search}%`))
        .orderBy(desc(schema.pages.updatedAt)) as typeof pagesQuery;
    }

    const results = await pagesQuery.limit(limit).offset(offset);
    const total = (await db.select().from(schema.pages)).length;

    return reply.send({
      success: true,
      data: results,
      total,
      page: Math.floor(offset / limit),
      limit,
    });
  });

  // Get single page
  app.get("/api/pages/:id", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [page] = await db
      .select()
      .from(schema.pages)
      .where(eq(schema.pages.id, id))
      .limit(1);

    if (!page) {
      return reply.code(404).send({ success: false, error: "Page not found" });
    }

    return reply.send({
      success: true,
      data: {
        ...page,
        content: JSON.parse(page.content),
        metadata: JSON.parse(page.metadata),
      },
    });
  });

  // Create page
  app.post("/api/pages", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const result = pageSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ success: false, error: result.error.message });
    }

    const { title, content, metadata, status, template } = result.data;
    const slug = result.data.slug ?? generateSlug(title);
    const id = nanoid();

    // Check slug uniqueness
    const [existing] = await db
      .select()
      .from(schema.pages)
      .where(eq(schema.pages.slug, slug))
      .limit(1);

    if (existing) {
      return reply.code(409).send({ success: false, error: "Slug already exists" });
    }

    await db.insert(schema.pages).values({
      id,
      title,
      slug,
      content: content ?? "[]",
      metadata: metadata ?? "{}",
      status: status ?? "draft",
      template,
    });

    const [page] = await db
      .select()
      .from(schema.pages)
      .where(eq(schema.pages.id, id))
      .limit(1);

    return reply.code(201).send({ success: true, data: page });
  });

  // Update page
  app.put("/api/pages/:id", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = pageSchema.partial().safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ success: false, error: result.error.message });
    }

    const updates: Partial<typeof schema.pages.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };

    if (result.data.title !== undefined) updates.title = result.data.title;
    if (result.data.slug !== undefined) updates.slug = result.data.slug;
    if (result.data.content !== undefined) updates.content = result.data.content;
    if (result.data.metadata !== undefined) updates.metadata = result.data.metadata;
    if (result.data.status !== undefined) updates.status = result.data.status;
    if (result.data.template !== undefined) updates.template = result.data.template;

    await db.update(schema.pages).set(updates).where(eq(schema.pages.id, id));

    const [page] = await db
      .select()
      .from(schema.pages)
      .where(eq(schema.pages.id, id))
      .limit(1);

    return reply.send({ success: true, data: page });
  });

  // Delete page
  app.delete("/api/pages/:id", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await db.delete(schema.pages).where(eq(schema.pages.id, id));
    return reply.send({ success: true });
  });

  // Export page as HTML
  app.get("/api/pages/:id/export", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [page] = await db
      .select()
      .from(schema.pages)
      .where(eq(schema.pages.id, id))
      .limit(1);

    if (!page) {
      return reply.code(404).send({ success: false, error: "Page not found" });
    }

    const metadata = JSON.parse(page.metadata) as { description?: string; keywords?: string[]; customCss?: string };

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${metadata.description ?? ""}">
  <title>${page.title}</title>
  <style>${metadata.customCss ?? ""}</style>
</head>
<body>
  ${renderComponents(JSON.parse(page.content) as unknown[])}
</body>
</html>`;

    reply.header("Content-Type", "text/html");
    return reply.send(html);
  });
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function renderComponents(components: unknown[]): string {
  if (!Array.isArray(components)) return "";
  return components.map((c) => {
    const comp = c as { type: string; props?: Record<string, unknown>; children?: unknown[] };
    return `<div class="component component-${comp.type}">${JSON.stringify(comp.props)}</div>`;
  }).join("\n");
}
