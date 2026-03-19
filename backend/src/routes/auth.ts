import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db/index.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
  setupKey: z.string().optional(),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Login
  app.post("/api/auth/login", async (request, reply) => {
    const result = loginSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ success: false, error: result.error.message });
    }

    const { email, password } = result.data;

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return reply.code(401).send({ success: false, error: "Invalid credentials" });
    }

    const token = app.jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return reply.send({
      success: true,
      data: {
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      },
    });
  });

  // Register (only works if no users exist, or with setup key)
  app.post("/api/auth/register", async (request, reply) => {
    const result = registerSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ success: false, error: result.error.message });
    }

    const { email, name, password } = result.data;

    // Check if users exist
    const userCount = await db.select().from(schema.users);
    if (userCount.length > 0) {
      const setupKey = process.env["SETUP_KEY"];
      const data = result.data as { setupKey?: string };
      if (!setupKey || data.setupKey !== setupKey) {
        return reply.code(403).send({ success: false, error: "Registration is closed" });
      }
    }

    // Check if email already exists
    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (existing) {
      return reply.code(409).send({ success: false, error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = nanoid();
    const role = userCount.length === 0 ? "admin" : "editor";

    await db.insert(schema.users).values({
      id,
      email,
      name,
      passwordHash,
      role,
    });

    const token = app.jwt.sign({ id, email, role });

    return reply.code(201).send({
      success: true,
      data: {
        token,
        user: { id, email, name, role },
      },
    });
  });

  // Get current user
  app.get("/api/auth/me", {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch {
        reply.code(401).send({ success: false, error: "Unauthorized" });
      }
    },
  }, async (request, reply) => {
    const payload = request.user as { id: string };
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, payload.id))
      .limit(1);

    if (!user) {
      return reply.code(404).send({ success: false, error: "User not found" });
    }

    return reply.send({
      success: true,
      data: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  });

  // Check if setup needed
  app.get("/api/auth/setup-status", async (_request, reply) => {
    const users = await db.select().from(schema.users).limit(1);
    return reply.send({
      success: true,
      data: { needsSetup: users.length === 0 },
    });
  });
}
