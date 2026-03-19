import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "../db/index";
import { authenticate } from "../middleware/auth";
import { testSshConnection, deployViaSftp, runSshCommand } from "../services/ssh";
import { config } from "../config/index";
import path from "path";

const targetSchema = z.object({
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().min(1),
  authType: z.enum(["password", "key"]),
  privateKey: z.string().optional(),
  password: z.string().optional(),
  remotePath: z.string().min(1),
  webUrl: z.string().optional(),
});

export async function deployRoutes(app: FastifyInstance): Promise<void> {
  // List deploy targets
  app.get("/api/deploy/targets", {
    preHandler: authenticate,
  }, async (_request, reply) => {
    const targets = await db
      .select()
      .from(schema.deployTargets)
      .orderBy(schema.deployTargets.name);

    // Don't expose credentials
    const safe = targets.map(({ password: _p, privateKey: _k, ...t }) => t);
    return reply.send({ success: true, data: safe });
  });

  // Get target
  app.get("/api/deploy/targets/:id", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [target] = await db
      .select()
      .from(schema.deployTargets)
      .where(eq(schema.deployTargets.id, id))
      .limit(1);

    if (!target) {
      return reply.code(404).send({ success: false, error: "Target not found" });
    }

    const { password: _p, privateKey: _k, ...safe } = target;
    return reply.send({ success: true, data: { ...safe, hasPassword: !!_p, hasKey: !!_k } });
  });

  // Create target
  app.post("/api/deploy/targets", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const result = targetSchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ success: false, error: result.error.message });
    }

    const id = nanoid();
    await db.insert(schema.deployTargets).values({
      id,
      ...result.data,
      port: result.data.port ?? 22,
    });

    const [target] = await db
      .select()
      .from(schema.deployTargets)
      .where(eq(schema.deployTargets.id, id))
      .limit(1);

    const { password: _p, privateKey: _k, ...safe } = target!;
    return reply.code(201).send({ success: true, data: safe });
  });

  // Update target
  app.put("/api/deploy/targets/:id", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = targetSchema.partial().safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ success: false, error: result.error.message });
    }

    await db
      .update(schema.deployTargets)
      .set({ ...result.data, updatedAt: new Date().toISOString() })
      .where(eq(schema.deployTargets.id, id));

    return reply.send({ success: true });
  });

  // Delete target
  app.delete("/api/deploy/targets/:id", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await db.delete(schema.deployTargets).where(eq(schema.deployTargets.id, id));
    return reply.send({ success: true });
  });

  // Test connection
  app.post("/api/deploy/targets/:id/test", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [target] = await db
      .select()
      .from(schema.deployTargets)
      .where(eq(schema.deployTargets.id, id))
      .limit(1);

    if (!target) {
      return reply.code(404).send({ success: false, error: "Target not found" });
    }

    const result = await testSshConnection(target);
    return reply.send({ success: true, data: result });
  });

  // Deploy
  app.post("/api/deploy/targets/:id/deploy", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { pageId?: string; buildDir?: string; postCommand?: string };

    const [target] = await db
      .select()
      .from(schema.deployTargets)
      .where(eq(schema.deployTargets.id, id))
      .limit(1);

    if (!target) {
      return reply.code(404).send({ success: false, error: "Target not found" });
    }

    // Create deployment record
    const deployId = nanoid();
    await db.insert(schema.deployments).values({
      id: deployId,
      targetId: id,
      status: "running",
    });

    // Run deployment async
    const buildDir = body.buildDir ?? config.builds.outputDir;
    const logs: string[] = [];

    void (async () => {
      try {
        logs.push(`[${new Date().toISOString()}] Starting deployment to ${target.name}`);

        const result = await deployViaSftp(target, buildDir, (percent, file) => {
          logs.push(`[${percent}%] Uploading ${file}`);
        });

        if (!result.success) {
          logs.push(...result.errors);
          await db
            .update(schema.deployments)
            .set({
              status: "failed",
              log: logs.join("\n"),
              completedAt: new Date().toISOString(),
            })
            .where(eq(schema.deployments.id, deployId));
          return;
        }

        logs.push(`[${new Date().toISOString()}] Transferred ${result.filesTransferred} files`);

        // Run post-deploy command if specified
        if (body.postCommand) {
          logs.push(`[${new Date().toISOString()}] Running: ${body.postCommand}`);
          const cmdResult = await runSshCommand(target, body.postCommand);
          if (cmdResult.stdout) logs.push(cmdResult.stdout);
          if (cmdResult.stderr) logs.push(`STDERR: ${cmdResult.stderr}`);
        }

        await db
          .update(schema.deployments)
          .set({
            status: "success",
            log: logs.join("\n"),
            completedAt: new Date().toISOString(),
          })
          .where(eq(schema.deployments.id, deployId));

        await db
          .update(schema.deployTargets)
          .set({ lastDeployedAt: new Date().toISOString() })
          .where(eq(schema.deployTargets.id, id));
      } catch (err) {
        const error = err as Error;
        logs.push(`ERROR: ${error.message}`);
        await db
          .update(schema.deployments)
          .set({
            status: "failed",
            log: logs.join("\n"),
            completedAt: new Date().toISOString(),
          })
          .where(eq(schema.deployments.id, deployId));
      }
    })();

    return reply.code(202).send({
      success: true,
      data: { deploymentId: deployId, message: "Deployment started" },
    });
  });

  // Get deployment status
  app.get("/api/deploy/deployments/:id", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const [deployment] = await db
      .select()
      .from(schema.deployments)
      .where(eq(schema.deployments.id, id))
      .limit(1);

    if (!deployment) {
      return reply.code(404).send({ success: false, error: "Deployment not found" });
    }

    return reply.send({ success: true, data: deployment });
  });

  // List deployments
  app.get("/api/deploy/deployments", {
    preHandler: authenticate,
  }, async (_request, reply) => {
    const deployments = await db
      .select()
      .from(schema.deployments)
      .orderBy(desc(schema.deployments.startedAt))
      .limit(50);

    return reply.send({ success: true, data: deployments });
  });

  // Run SSH command on target
  app.post("/api/deploy/targets/:id/exec", {
    preHandler: authenticate,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { command: string };

    if (!body.command) {
      return reply.code(400).send({ success: false, error: "Command is required" });
    }

    const [target] = await db
      .select()
      .from(schema.deployTargets)
      .where(eq(schema.deployTargets.id, id))
      .limit(1);

    if (!target) {
      return reply.code(404).send({ success: false, error: "Target not found" });
    }

    const result = await runSshCommand(target, body.command);
    return reply.send({ success: true, data: result });
  });
}
