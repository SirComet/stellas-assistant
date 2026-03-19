import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq, like, or, desc } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { authenticate } from "../middleware/auth.js";
import { geminiService } from "../services/gemini.js";

const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  company: z.string().optional(),
  role: z.string().optional(),
  status: z.enum(["lead", "prospect", "client", "inactive"]).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
  avatarUrl: z.string().optional(),
});

const projectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(["planning", "active", "review", "completed", "paused"]).optional(),
  clientId: z.string().optional(),
  budget: z.number().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export async function crmRoutes(app: FastifyInstance): Promise<void> {
  // ---- CONTACTS ----

  app.get("/api/crm/contacts", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const query = request.query as { search?: string; status?: string; limit?: string; offset?: string };
    const limit = parseInt(query.limit ?? "50", 10);
    const offset = parseInt(query.offset ?? "0", 10);

    let results;
    if (query.search) {
      results = await db
        .select()
        .from(schema.contacts)
        .where(
          or(
            like(schema.contacts.name, `%${query.search}%`),
            like(schema.contacts.email, `%${query.search}%`),
            like(schema.contacts.company, `%${query.search}%`)
          )
        )
        .orderBy(desc(schema.contacts.updatedAt))
        .limit(limit)
        .offset(offset);
    } else {
      results = await db
        .select()
        .from(schema.contacts)
        .orderBy(desc(schema.contacts.updatedAt))
        .limit(limit)
        .offset(offset);
    }

    const contacts = results.map((c) => ({
      ...c,
      tags: JSON.parse(c.tags) as string[],
    }));

    const total = (await db.select().from(schema.contacts)).length;

    return reply.send({ success: true, data: contacts, total });
  });

  app.get("/api/crm/contacts/:id", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [contact] = await db
      .select()
      .from(schema.contacts)
      .where(eq(schema.contacts.id, id))
      .limit(1);

    if (!contact) {
      return reply.code(404).send({ success: false, error: "Contact not found" });
    }

    return reply.send({
      success: true,
      data: { ...contact, tags: JSON.parse(contact.tags) as string[] },
    });
  });

  app.post("/api/crm/contacts", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const result = contactSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ success: false, error: result.error.message });
    }

    const id = nanoid();
    const { tags, ...data } = result.data;

    await db.insert(schema.contacts).values({
      id,
      ...data,
      tags: JSON.stringify(tags ?? []),
      notes: data.notes ?? "",
    });

    const [contact] = await db
      .select()
      .from(schema.contacts)
      .where(eq(schema.contacts.id, id))
      .limit(1);

    return reply.code(201).send({ success: true, data: contact });
  });

  app.put("/api/crm/contacts/:id", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = contactSchema.partial().safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ success: false, error: result.error.message });
    }

    const updates: Partial<typeof schema.contacts.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };

    const { tags, ...data } = result.data;
    if (tags !== undefined) updates.tags = JSON.stringify(tags);
    Object.assign(updates, data);

    await db.update(schema.contacts).set(updates).where(eq(schema.contacts.id, id));

    const [contact] = await db
      .select()
      .from(schema.contacts)
      .where(eq(schema.contacts.id, id))
      .limit(1);

    return reply.send({ success: true, data: contact });
  });

  app.delete("/api/crm/contacts/:id", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await db.delete(schema.contacts).where(eq(schema.contacts.id, id));
    return reply.send({ success: true });
  });

  // ---- PROJECTS ----

  app.get("/api/crm/projects", {
    preHandler: authenticate,
  }, async (_request, reply) => {
    const results = await db
      .select()
      .from(schema.projects)
      .orderBy(desc(schema.projects.updatedAt));

    const projects = results.map((p) => ({
      ...p,
      tags: JSON.parse(p.tags) as string[],
    }));

    return reply.send({ success: true, data: projects });
  });

  app.post("/api/crm/projects", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const result = projectSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ success: false, error: result.error.message });
    }

    const id = nanoid();
    const { tags, ...data } = result.data;

    await db.insert(schema.projects).values({
      id,
      ...data,
      name: data.name,
      description: data.description ?? "",
      tags: JSON.stringify(tags ?? []),
    });

    const [project] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, id))
      .limit(1);

    return reply.code(201).send({ success: true, data: project });
  });

  app.put("/api/crm/projects/:id", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = projectSchema.partial().safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ success: false, error: result.error.message });
    }

    const updates: Partial<typeof schema.projects.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };

    const { tags, ...data } = result.data;
    if (tags !== undefined) updates.tags = JSON.stringify(tags);
    Object.assign(updates, data);

    await db.update(schema.projects).set(updates).where(eq(schema.projects.id, id));
    const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, id)).limit(1);

    return reply.send({ success: true, data: project });
  });

  app.delete("/api/crm/projects/:id", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await db.delete(schema.projects).where(eq(schema.projects.id, id));
    return reply.send({ success: true });
  });

  // ---- ANALYTICS ----
  app.get("/api/crm/stats", {
    preHandler: authenticate,
  }, async (_request, reply) => {
    const contacts = await db.select().from(schema.contacts);
    const projects = await db.select().from(schema.projects);

    const byStatus = contacts.reduce<Record<string, number>>((acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    }, {});

    const projectsByStatus = projects.reduce<Record<string, number>>((acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    }, {});

    const totalBudget = projects.reduce((sum, p) => sum + (p.budget ?? 0), 0);

    return reply.send({
      success: true,
      data: {
        contacts: {
          total: contacts.length,
          byStatus,
        },
        projects: {
          total: projects.length,
          byStatus,
          totalBudget,
          activeCount: projectsByStatus["active"] ?? 0,
        },
      },
    });
  });

  // AI Analysis
  app.get("/api/crm/ai-insights", {
    preHandler: authenticate,
  }, async (_request, reply) => {
    const contacts = await db.select().from(schema.contacts);
    const projects = await db.select().from(schema.projects);

    const analysis = await geminiService.analyzeCrmData({
      contacts: contacts.slice(0, 20),
      projects: projects.slice(0, 20),
      summary: {
        totalContacts: contacts.length,
        totalProjects: projects.length,
      },
    });

    return reply.send({ success: true, data: { analysis } });
  });
}
