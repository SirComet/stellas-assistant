import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import staticPlugin from "@fastify/static";
import path from "path";
import fs from "fs";
import { config } from "./config/index";
import { initDb, db, schema } from "./db/index";
import { authRoutes } from "./routes/auth";
import { aiRoutes } from "./routes/ai";
import { pagesRoutes } from "./routes/pages";
import { crmRoutes } from "./routes/crm";
import { deployRoutes } from "./routes/deploy";
import { gitRoutes } from "./routes/git";
import { nanoid } from "nanoid";

async function main(): Promise<void> {
  const app = Fastify({
    logger: {
      level: config.env === "production" ? "info" : "debug",
      transport:
        config.env !== "production"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  // Ensure directories exist
  for (const dir of [config.builds.outputDir, config.uploads.dir]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Plugins
  await app.register(cors, {
    origin: [config.cors.origin, "http://172.16.106.240:3000", "http://localhost:3000"],
    credentials: true,
  });

  await app.register(jwt, {
    secret: config.jwt.secret,
    sign: { expiresIn: config.jwt.expiresIn },
  });

  await app.register(multipart, {
    limits: { fileSize: config.uploads.maxSizeMb * 1024 * 1024 },
  });

  // Serve uploaded files
  const uploadsDir = config.uploads.dir;
  await app.register(staticPlugin, {
    root: uploadsDir,
    prefix: "/uploads/",
    decorateReply: true,
  });

  // Health check
  app.get("/health", async () => ({
    status: "ok",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  }));

  // Register routes
  await app.register(authRoutes);
  await app.register(aiRoutes);
  await app.register(pagesRoutes);
  await app.register(crmRoutes);
  await app.register(deployRoutes);
  await app.register(gitRoutes);

  // Media upload
  app.post("/api/media/upload", {
    preHandler: async (request, reply) => {
      try {
        await request.jwtVerify();
      } catch {
        reply.code(401).send({ success: false, error: "Unauthorized" });
      }
    },
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ success: false, error: "No file provided" });
    }

    const id = nanoid();
    const ext = path.extname(data.filename);
    const filename = `${id}${ext}`;
    const filepath = path.join(uploadsDir, filename);

    const buffer = await data.toBuffer();
    fs.writeFileSync(filepath, buffer);

    await db.insert(schema.media).values({
      id,
      name: data.filename,
      filename,
      mimeType: data.mimetype,
      size: buffer.length,
      url: `/uploads/${filename}`,
    });

    return reply.send({
      success: true,
      data: { id, url: `/uploads/${filename}`, filename },
    });
  });

  // Settings
  app.get("/api/settings", {
    preHandler: async (request, reply) => {
      try { await request.jwtVerify(); } catch { reply.code(401).send({ success: false, error: "Unauthorized" }); }
    },
  }, async (_request, reply) => {
    const allSettings = await db.select().from(schema.settings);
    const result: Record<string, string> = {};
    for (const s of allSettings) {
      result[s.key] = s.value;
    }
    return reply.send({ success: true, data: result });
  });

  app.put("/api/settings", {
    preHandler: async (request, reply) => {
      try { await request.jwtVerify(); } catch { reply.code(401).send({ success: false, error: "Unauthorized" }); }
    },
  }, async (request, reply) => {
    const body = request.body as Record<string, string>;
    for (const [key, value] of Object.entries(body)) {
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

  // Initialize database
  initDb();

  // Start server
  await app.listen({ port: config.port, host: config.host });
  console.log(`Stella's Assistant API running at http://${config.host}:${config.port}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
