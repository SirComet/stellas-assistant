import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index";
import { authenticate } from "../middleware/auth";
import {
  getGitStatus,
  commitAndPush,
  cloneOrInit,
  getRecentCommits,
  createGithubRepo,
  setupWebhook,
} from "../services/git";

const gitConfigSchema = z.object({
  name: z.string().min(1),
  repoUrl: z.string().url(),
  branch: z.string().optional(),
  token: z.string().optional(),
  localPath: z.string().min(1),
  autoPush: z.boolean().optional(),
  webhookSecret: z.string().optional(),
});

const commitSchema = z.object({
  message: z.string().min(1),
  files: z.array(z.string()).optional(),
  push: z.boolean().optional(),
});

const githubRepoSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  isPrivate: z.boolean().optional(),
});

const webhookSchema = z.object({
  token: z.string().min(1),
  owner: z.string().min(1),
  repo: z.string().min(1),
  webhookUrl: z.string().url(),
  secret: z.string().optional(),
  events: z.array(z.string()).optional(),
});

export async function gitRoutes(app: FastifyInstance): Promise<void> {
  // List git configs
  app.get("/api/git/configs", {
    preHandler: authenticate,
  }, async (_request, reply) => {
    const configs = await db.select().from(schema.gitConfigs);
    const safe = configs.map(({ token: _t, ...c }) => c);
    return reply.send({ success: true, data: safe });
  });

  // Create git config
  app.post("/api/git/configs", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const result = gitConfigSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ success: false, error: result.error.message });
    }

    const id = nanoid();
    await db.insert(schema.gitConfigs).values({
      id,
      ...result.data,
      branch: result.data.branch ?? "main",
    });

    return reply.code(201).send({ success: true, data: { id } });
  });

  // Get status
  app.get("/api/git/configs/:id/status", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [config] = await db
      .select()
      .from(schema.gitConfigs)
      .where(eq(schema.gitConfigs.id, id))
      .limit(1);

    if (!config) {
      return reply.code(404).send({ success: false, error: "Config not found" });
    }

    const status = await getGitStatus(config.localPath);
    return reply.send({ success: true, data: status });
  });

  // Get recent commits
  app.get("/api/git/configs/:id/commits", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [config] = await db
      .select()
      .from(schema.gitConfigs)
      .where(eq(schema.gitConfigs.id, id))
      .limit(1);

    if (!config) {
      return reply.code(404).send({ success: false, error: "Config not found" });
    }

    const commits = await getRecentCommits(config.localPath);
    return reply.send({ success: true, data: commits });
  });

  // Commit
  app.post("/api/git/configs/:id/commit", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = commitSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ success: false, error: result.error.message });
    }

    const [config] = await db
      .select()
      .from(schema.gitConfigs)
      .where(eq(schema.gitConfigs.id, id))
      .limit(1);

    if (!config) {
      return reply.code(404).send({ success: false, error: "Config not found" });
    }

    const commitResult = await commitAndPush(
      config.localPath,
      {
        message: result.data.message,
        files: result.data.files,
        push: result.data.push ?? config.autoPush,
      },
      config.token ?? undefined
    );

    return reply.send({
      success: true,
      data: { commit: commitResult.commit },
    });
  });

  // Init/clone repo
  app.post("/api/git/configs/:id/init", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [config] = await db
      .select()
      .from(schema.gitConfigs)
      .where(eq(schema.gitConfigs.id, id))
      .limit(1);

    if (!config) {
      return reply.code(404).send({ success: false, error: "Config not found" });
    }

    await cloneOrInit(config.localPath, config.repoUrl, config.branch);
    return reply.send({ success: true, message: "Repository initialized" });
  });

  // Create GitHub repo
  app.post("/api/git/github/create-repo", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const result = githubRepoSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ success: false, error: result.error.message });
    }

    const repo = await createGithubRepo(
      result.data.token,
      result.data.name,
      result.data.description,
      result.data.isPrivate
    );

    return reply.send({ success: true, data: repo });
  });

  // Setup GitHub webhook
  app.post("/api/git/github/webhook", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const result = webhookSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ success: false, error: result.error.message });
    }

    const webhook = await setupWebhook(
      result.data.token,
      result.data.owner,
      result.data.repo,
      result.data.webhookUrl,
      result.data.secret,
      result.data.events
    );

    return reply.send({ success: true, data: webhook });
  });

  // Receive webhook (public endpoint)
  app.post("/api/git/webhook/receive", async (request, reply) => {
    const event = request.headers["x-github-event"] as string;
    const payload = request.body as { repository?: { name: string } };

    app.log.info({ event, repo: payload.repository?.name }, "Webhook received");

    // Find matching git config with auto-push enabled
    const configs = await db
      .select()
      .from(schema.gitConfigs)
      .where(eq(schema.gitConfigs.autoPush, true));

    for (const config of configs) {
      if (config.webhookSecret) {
        // TODO: Verify HMAC signature
      }
    }

    return reply.send({ success: true });
  });
}
